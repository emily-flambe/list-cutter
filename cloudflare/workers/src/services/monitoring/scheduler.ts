import { AggregationService } from './aggregation-service.js';
import { CostCalculator } from './cost-calculator.js';

/**
 * Scheduler for storage metrics aggregation jobs
 * Handles cron-based scheduling and job execution
 */
export class MetricsScheduler {
  private db: D1Database;
  private aggregationService: AggregationService;
  private costCalculator: CostCalculator;

  constructor(db: D1Database) {
    this.db = db;
    this.aggregationService = new AggregationService(db);
    this.costCalculator = new CostCalculator(db);
  }

  /**
   * Handle scheduled job execution
   */
  async handleScheduledJob(jobType: string, _request: Request): Promise<Response> {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (jobType) {
        case 'daily-aggregation':
          result = await this.runDailyAggregation();
          break;
        case 'weekly-aggregation':
          result = await this.runWeeklyAggregation();
          break;
        case 'monthly-aggregation':
          result = await this.runMonthlyAggregation();
          break;
        case 'cleanup-old-metrics':
          result = await this.runCleanupJob();
          break;
        case 'update-daily-snapshots':
          result = await this.runDailySnapshotUpdate();
          break;
        case 'health-check':
          result = await this.runHealthCheck();
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      return new Response(JSON.stringify({
        success: true,
        jobType,
        duration: Date.now() - startTime,
        result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error(`Scheduled job ${jobType} failed:`, error);
      
      return new Response(JSON.stringify({
        success: false,
        jobType,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Run daily aggregation job
   * Schedule: Every day at 2 AM UTC
   */
  private async runDailyAggregation(): Promise<JobResult> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Run aggregation for yesterday's data
    const result = await this.aggregationService.runDailyAggregation(yesterday);
    
    // Log job execution
    await this.logJobExecution('daily-aggregation', result.successful > 0, {
      usersProcessed: result.usersProcessed,
      successful: result.successful,
      failed: result.failed,
      duration: result.duration
    });
    
    return result;
  }

  /**
   * Run weekly aggregation job
   * Schedule: Every Monday at 3 AM UTC
   */
  private async runWeeklyAggregation(): Promise<JobResult> {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const result = await this.aggregationService.runWeeklyAggregation(lastWeek);
    
    await this.logJobExecution('weekly-aggregation', result.successful > 0, {
      usersProcessed: result.usersProcessed,
      successful: result.successful,
      failed: result.failed,
      duration: result.duration
    });
    
    return result;
  }

  /**
   * Run monthly aggregation job
   * Schedule: 1st of every month at 4 AM UTC
   */
  private async runMonthlyAggregation(): Promise<JobResult> {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const result = await this.aggregationService.runMonthlyAggregation(lastMonth);
    
    await this.logJobExecution('monthly-aggregation', result.successful > 0, {
      usersProcessed: result.usersProcessed,
      successful: result.successful,
      failed: result.failed,
      duration: result.duration
    });
    
    return result;
  }

  /**
   * Run daily snapshot update job
   * Schedule: Every day at 1 AM UTC
   */
  private async runDailySnapshotUpdate(): Promise<JobResult> {
    const today = new Date();
    const startTime = Date.now();
    
    // Get all active users
    const users = await this.db
      .prepare(`SELECT id FROM users WHERE is_active = 1`)
      .all();

    const results = await Promise.allSettled(
      users.results.map((user: Record<string, unknown>) => 
        this.costCalculator.updateDailySnapshot(user.id, today)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    const result = {
      date: today.toISOString().split('T')[0],
      usersProcessed: users.results.length,
      successful,
      failed,
      duration: Date.now() - startTime
    };

    await this.logJobExecution('update-daily-snapshots', successful > 0, result);
    
    return result;
  }

  /**
   * Run cleanup job
   * Schedule: Every Sunday at 5 AM UTC
   */
  private async runCleanupJob(): Promise<JobResult> {
    const result = await this.aggregationService.cleanupOldMetrics();
    
    await this.logJobExecution('cleanup-old-metrics', true, result);
    
    return result;
  }

  /**
   * Run health check job
   * Schedule: Every 5 minutes
   */
  private async runHealthCheck(): Promise<JobResult> {
    const checks = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkStorageHealth(),
      this.checkMetricsHealth()
    ]);

    const result = {
      timestamp: new Date().toISOString(),
      checks: checks.map((check, index) => ({
        name: ['database', 'storage', 'metrics'][index],
        status: check.status,
        result: check.status === 'fulfilled' ? check.value : check.reason
      }))
    };

    const allHealthy = checks.every(check => check.status === 'fulfilled');
    
    await this.logJobExecution('health-check', allHealthy, result);
    
    return result;
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const result = await this.db
      .prepare(`SELECT COUNT(*) as user_count FROM users`)
      .first();
    
    return {
      healthy: true,
      userCount: result?.user_count || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<HealthCheckResult> {
    const result = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size,
          COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed_files,
          COUNT(CASE WHEN upload_status = 'failed' THEN 1 END) as failed_files
        FROM files
      `)
      .first();
    
    return {
      healthy: true,
      totalFiles: result?.total_files || 0,
      totalSize: result?.total_size || 0,
      completedFiles: result?.completed_files || 0,
      failedFiles: result?.failed_files || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check metrics health
   */
  private async checkMetricsHealth(): Promise<HealthCheckResult> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_metrics,
          COUNT(CASE WHEN metric_date = ? THEN 1 END) as todays_metrics,
          COUNT(CASE WHEN is_aggregated = 1 THEN 1 END) as aggregated_metrics
        FROM storage_metrics
      `)
      .bind(today)
      .first();
    
    return {
      healthy: true,
      totalMetrics: result?.total_metrics || 0,
      todaysMetrics: result?.todays_metrics || 0,
      aggregatedMetrics: result?.aggregated_metrics || 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log job execution
   */
  private async logJobExecution(
    jobType: string,
    success: boolean,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO audit_logs (
            action, resource_type, resource_id, metadata, created_at
          )
          VALUES (?, 'scheduled_job', ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          success ? 'job_completed' : 'job_failed',
          jobType,
          JSON.stringify({
            jobType,
            success,
            ...metadata
          })
        )
        .run();
    } catch (error) {
      console.error('Failed to log job execution:', error);
    }
  }

  /**
   * Get job execution history
   */
  async getJobHistory(
    jobType?: string,
    limit: number = 100
  ): Promise<JobHistoryEntry[]> {
    const query = jobType
      ? `
        SELECT * FROM audit_logs 
        WHERE resource_type = 'scheduled_job' AND resource_id = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `
      : `
        SELECT * FROM audit_logs 
        WHERE resource_type = 'scheduled_job'
        ORDER BY created_at DESC 
        LIMIT ?
      `;
    
    const params = jobType ? [jobType, limit] : [limit];
    
    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all();

    return result.results.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      jobType: row.resource_id as string,
      action: row.action as string,
      timestamp: row.created_at as string,
      metadata: JSON.parse((row.metadata as string) || '{}')
    }));
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(days: number = 30): Promise<JobStatistics> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    
    const result = await this.db
      .prepare(`
        SELECT 
          resource_id as job_type,
          action,
          COUNT(*) as count,
          AVG(CAST(json_extract(metadata, '$.duration') AS REAL)) as avg_duration
        FROM audit_logs
        WHERE resource_type = 'scheduled_job' 
        AND created_at >= ?
        GROUP BY resource_id, action
        ORDER BY resource_id, action
      `)
      .bind(sinceDate.toISOString())
      .all();

    const stats: JobStatistics = {
      period: `${days} days`,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      jobTypes: {}
    };

    for (const row of result.results as DatabaseRow[]) {
      stats.totalJobs += (row.count as number);
      
      if (row.action === 'job_completed') {
        stats.successfulJobs += (row.count as number);
      } else {
        stats.failedJobs += (row.count as number);
      }

      const jobType = row.job_type as string;
      if (!stats.jobTypes[jobType]) {
        stats.jobTypes[jobType] = {
          total: 0,
          successful: 0,
          failed: 0,
          avgDuration: 0
        };
      }

      stats.jobTypes[jobType].total += (row.count as number);
      if (row.action === 'job_completed') {
        stats.jobTypes[jobType].successful += (row.count as number);
        stats.jobTypes[jobType].avgDuration = (row.avg_duration as number) || 0;
      } else {
        stats.jobTypes[jobType].failed += (row.count as number);
      }
    }

    return stats;
  }
}

// Type definitions
interface JobHistoryEntry {
  id: string;
  jobType: string;
  action: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface JobStatistics {
  period: string;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  jobTypes: {
    [key: string]: {
      total: number;
      successful: number;
      failed: number;
      avgDuration: number;
    };
  };
}

interface JobResult {
  [key: string]: unknown;
}

interface HealthCheckResult {
  healthy: boolean;
  [key: string]: unknown;
}

interface DatabaseRow {
  [key: string]: unknown;
}