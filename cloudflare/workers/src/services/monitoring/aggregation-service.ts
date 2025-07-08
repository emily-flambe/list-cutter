import { CostCalculator } from './cost-calculator.js';
import { StorageOperation, ErrorCategory } from '../../types/metrics.js';

/**
 * Aggregation service for storage metrics and cost tracking
 * Handles daily, weekly, and monthly rollups of storage metrics
 */
export class AggregationService {
  private db: D1Database;
  private costCalculator: CostCalculator;

  constructor(db: D1Database) {
    this.db = db;
    this.costCalculator = new CostCalculator(db);
  }

  /**
   * Run daily aggregation for all users
   */
  async runDailyAggregation(date: Date = new Date()): Promise<AggregationResult> {
    const dateStr = date.toISOString().split('T')[0];
    const startTime = Date.now();
    
    try {
      // Get all active users
      const users = await this.db
        .prepare(`
          SELECT DISTINCT user_id FROM files 
          UNION 
          SELECT DISTINCT user_id FROM file_access_logs WHERE DATE(created_at) = ?
        `)
        .bind(dateStr)
        .all();

      const results = await Promise.allSettled(
        users.results.map((user: { user_id: string }) => this.aggregateUserDailyMetrics(user.user_id, date))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        date: dateStr,
        type: 'daily',
        usersProcessed: users.results.length,
        successful,
        failed,
        duration: Date.now() - startTime,
        errors: results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason)
      };
    } catch (error) {
      console.error('Daily aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Run weekly aggregation for all users
   */
  async runWeeklyAggregation(date: Date = new Date()): Promise<AggregationResult> {
    const weekStart = this.getWeekStart(date);
    const weekEnd = this.getWeekEnd(date);
    const startTime = Date.now();

    try {
      // Get all users with activity in the week
      const users = await this.db
        .prepare(`
          SELECT DISTINCT user_id FROM storage_metrics 
          WHERE metric_date >= ? AND metric_date <= ?
        `)
        .bind(weekStart, weekEnd)
        .all();

      const results = await Promise.allSettled(
        users.results.map((user: { user_id: string }) => this.aggregateUserWeeklyMetrics(user.user_id, date))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        date: weekStart,
        type: 'weekly',
        usersProcessed: users.results.length,
        successful,
        failed,
        duration: Date.now() - startTime,
        errors: results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason)
      };
    } catch (error) {
      console.error('Weekly aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Run monthly aggregation for all users
   */
  async runMonthlyAggregation(date: Date = new Date()): Promise<AggregationResult> {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startTime = Date.now();

    try {
      // Get all users with activity in the month
      const users = await this.db
        .prepare(`
          SELECT DISTINCT user_id FROM storage_metrics 
          WHERE metric_date >= ? AND metric_date <= ?
        `)
        .bind(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0])
        .all();

      const results = await Promise.allSettled(
        users.results.map((user: { user_id: string }) => this.aggregateUserMonthlyMetrics(user.user_id, date))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        date: monthStart.toISOString().split('T')[0],
        type: 'monthly',
        usersProcessed: users.results.length,
        successful,
        failed,
        duration: Date.now() - startTime,
        errors: results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason)
      };
    } catch (error) {
      console.error('Monthly aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Aggregate daily metrics for a specific user
   */
  async aggregateUserDailyMetrics(userId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    
    // Get raw metrics from file_access_logs for the day
    const rawMetrics = await this.db
      .prepare(`
        SELECT 
          action,
          file_id,
          bytes_transferred,
          duration_ms,
          success,
          error_message,
          COUNT(*) as operation_count
        FROM file_access_logs 
        WHERE user_id = ? AND DATE(created_at) = ?
        GROUP BY action, file_id, success
      `)
      .bind(userId, dateStr)
      .all();

    // Process each metric group
    for (const metric of rawMetrics.results as DatabaseMetric[]) {
      await this.processRawMetric(userId, date, metric);
    }

    // Update daily storage snapshot
    await this.costCalculator.updateDailySnapshot(userId, date);
    
    // Aggregate hourly metrics into daily
    await this.aggregateHourlyToDaily(userId, date);
  }

  /**
   * Aggregate weekly metrics for a specific user
   */
  async aggregateUserWeeklyMetrics(userId: string, date: Date): Promise<void> {
    const weekStart = this.getWeekStart(date);
    const weekEnd = this.getWeekEnd(date);
    
    // Aggregate daily metrics into weekly
    const dailyMetrics = await this.db
      .prepare(`
        SELECT 
          metric_type,
          storage_class,
          SUM(total_bytes) as total_bytes,
          SUM(total_operations) as total_operations,
          SUM(total_cost_usd) as total_cost_usd,
          SUM(error_count) as error_count,
          AVG(success_rate) as avg_success_rate,
          COUNT(*) as source_records
        FROM storage_metrics
        WHERE user_id = ? AND metric_date >= ? AND metric_date <= ?
        AND aggregation_level = 'daily'
        GROUP BY metric_type, storage_class
      `)
      .bind(userId, weekStart, weekEnd)
      .all();

    // Insert/update weekly aggregations
    for (const metric of dailyMetrics.results as DatabaseMetric[]) {
      await this.db
        .prepare(`
          INSERT INTO storage_metrics (
            user_id, metric_date, metric_type, storage_class,
            total_bytes, total_operations, total_cost_usd,
            error_count, success_rate, is_aggregated,
            aggregation_level, source_records
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'weekly', ?)
          ON CONFLICT(user_id, metric_date, metric_type, storage_class, aggregation_level)
          DO UPDATE SET
            total_bytes = excluded.total_bytes,
            total_operations = excluded.total_operations,
            total_cost_usd = excluded.total_cost_usd,
            error_count = excluded.error_count,
            success_rate = excluded.success_rate,
            source_records = excluded.source_records,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          userId, weekStart, metric.metric_type, metric.storage_class,
          metric.total_bytes, metric.total_operations, metric.total_cost_usd,
          metric.error_count, metric.avg_success_rate, metric.source_records
        )
        .run();
    }
  }

  /**
   * Aggregate monthly metrics for a specific user
   */
  async aggregateUserMonthlyMetrics(userId: string, date: Date): Promise<void> {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];
    
    // Calculate monthly billing
    const monthlyBilling = await this.costCalculator.calculateMonthlyBilling(userId, monthStart);
    
    // Upsert monthly billing summary
    await this.db
      .prepare(`
        INSERT INTO monthly_billing_summary (
          user_id, billing_month, avg_storage_bytes, total_class_a_operations,
          total_class_b_operations, total_bytes_transferred_out, total_bytes_transferred_in,
          storage_cost_usd, class_a_cost_usd, class_b_cost_usd,
          transfer_out_cost_usd, transfer_in_cost_usd, total_monthly_cost_usd,
          free_storage_used_bytes, free_class_a_used, free_class_b_used,
          free_transfer_out_used_bytes, billing_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculated')
        ON CONFLICT(user_id, billing_month)
        DO UPDATE SET
          avg_storage_bytes = excluded.avg_storage_bytes,
          total_class_a_operations = excluded.total_class_a_operations,
          total_class_b_operations = excluded.total_class_b_operations,
          total_bytes_transferred_out = excluded.total_bytes_transferred_out,
          total_bytes_transferred_in = excluded.total_bytes_transferred_in,
          storage_cost_usd = excluded.storage_cost_usd,
          class_a_cost_usd = excluded.class_a_cost_usd,
          class_b_cost_usd = excluded.class_b_cost_usd,
          transfer_out_cost_usd = excluded.transfer_out_cost_usd,
          transfer_in_cost_usd = excluded.transfer_in_cost_usd,
          total_monthly_cost_usd = excluded.total_monthly_cost_usd,
          free_storage_used_bytes = excluded.free_storage_used_bytes,
          free_class_a_used = excluded.free_class_a_used,
          free_class_b_used = excluded.free_class_b_used,
          free_transfer_out_used_bytes = excluded.free_transfer_out_used_bytes,
          billing_status = 'calculated',
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        userId, monthStartStr, monthlyBilling.avgStorageBytes,
        monthlyBilling.totalClassAOperations, monthlyBilling.totalClassBOperations,
        monthlyBilling.totalBytesTransferredOut, monthlyBilling.totalBytesTransferredIn,
        monthlyBilling.storageCostUsd, monthlyBilling.classACostUsd, monthlyBilling.classBCostUsd,
        monthlyBilling.transferOutCostUsd, monthlyBilling.transferInCostUsd,
        monthlyBilling.totalMonthlyCostUsd, monthlyBilling.freeTierUsage.storageUsedBytes,
        monthlyBilling.freeTierUsage.classAUsed, monthlyBilling.freeTierUsage.classBUsed,
        monthlyBilling.freeTierUsage.transferOutUsedBytes
      )
      .run();

    // Aggregate daily metrics into monthly
    const dailyMetrics = await this.db
      .prepare(`
        SELECT 
          metric_type,
          storage_class,
          SUM(total_bytes) as total_bytes,
          SUM(total_operations) as total_operations,
          SUM(total_cost_usd) as total_cost_usd,
          SUM(error_count) as error_count,
          AVG(success_rate) as avg_success_rate,
          COUNT(*) as source_records
        FROM storage_metrics
        WHERE user_id = ? AND metric_date >= ? AND metric_date <= ?
        AND aggregation_level = 'daily'
        GROUP BY metric_type, storage_class
      `)
      .bind(userId, monthStartStr, monthEndStr)
      .all();

    // Insert/update monthly aggregations
    for (const metric of dailyMetrics.results as DatabaseMetric[]) {
      await this.db
        .prepare(`
          INSERT INTO storage_metrics (
            user_id, metric_date, metric_type, storage_class,
            total_bytes, total_operations, total_cost_usd,
            error_count, success_rate, is_aggregated,
            aggregation_level, source_records
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'monthly', ?)
          ON CONFLICT(user_id, metric_date, metric_type, storage_class, aggregation_level)
          DO UPDATE SET
            total_bytes = excluded.total_bytes,
            total_operations = excluded.total_operations,
            total_cost_usd = excluded.total_cost_usd,
            error_count = excluded.error_count,
            success_rate = excluded.success_rate,
            source_records = excluded.source_records,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          userId, monthStartStr, metric.metric_type, metric.storage_class,
          metric.total_bytes, metric.total_operations, metric.total_cost_usd,
          metric.error_count, metric.avg_success_rate, metric.source_records
        )
        .run();
    }
  }

  /**
   * Process raw metric and insert into storage_metrics
   */
  private async processRawMetric(
    userId: string,
    date: Date,
    rawMetric: RawMetric
  ): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    const metricType = this.getMetricTypeFromAction(rawMetric.action);
    const storageClass = 'Standard'; // Default for now
    
    // Get file info if available
    let fileSize = rawMetric.bytes_transferred ?? 0;
    if (rawMetric.file_id) {
      const file = await this.db
        .prepare(`SELECT file_size, storage_class FROM files WHERE id = ?`)
        .bind(rawMetric.file_id)
        .first();
      
      if (file) {
        fileSize = file.file_size ?? fileSize;
      }
    }

    // Calculate cost
    const operationCost = await this.costCalculator.calculateOperationCost(
      userId,
      this.getStorageOperationFromAction(rawMetric.action),
      fileSize,
      storageClass as 'Standard' | 'InfrequentAccess',
      date
    );

    // Process error information
    const errorCategories = rawMetric.success ? [] : [this.categorizeError(rawMetric.error_message)];
    
    // Insert/update storage metric
    await this.db
      .prepare(`
        INSERT INTO storage_metrics (
          user_id, metric_date, metric_type, storage_class,
          total_bytes, total_operations, unit_cost_usd, total_cost_usd,
          total_duration_ms, success_rate, error_count, error_types,
          is_aggregated, aggregation_level, source_records
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'daily', 1)
        ON CONFLICT(user_id, metric_date, metric_type, storage_class, aggregation_level)
        DO UPDATE SET
          total_bytes = total_bytes + excluded.total_bytes,
          total_operations = total_operations + excluded.total_operations,
          total_cost_usd = total_cost_usd + excluded.total_cost_usd,
          total_duration_ms = total_duration_ms + excluded.total_duration_ms,
          success_rate = (
            (success_rate * source_records + excluded.success_rate * excluded.source_records) /
            (source_records + excluded.source_records)
          ),
          error_count = error_count + excluded.error_count,
          source_records = source_records + excluded.source_records,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        userId, dateStr, metricType, storageClass,
        metricType === 'data_transfer_out' || metricType === 'data_transfer_in' ? fileSize : 0,
        rawMetric.operation_count, operationCost.unitCost, operationCost.totalCost,
        rawMetric.duration_ms ?? 0, rawMetric.success ? 1.0 : 0.0,
        rawMetric.success ? 0 : rawMetric.operation_count,
        JSON.stringify(errorCategories)
      )
      .run();
  }

  /**
   * Aggregate hourly metrics into daily
   */
  private async aggregateHourlyToDaily(userId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    
    // This would typically aggregate from hourly buckets
    // For now, we'll ensure daily aggregation is complete
    await this.db
      .prepare(`
        UPDATE storage_metrics 
        SET is_aggregated = 1
        WHERE user_id = ? AND metric_date = ? AND aggregation_level = 'daily'
      `)
      .bind(userId, dateStr)
      .run();
  }

  /**
   * Clean up old metrics based on retention policy
   */
  async cleanupOldMetrics(): Promise<CleanupResult> {
    const startTime = Date.now();
    
    // Clean up raw metrics older than 30 days
    const rawRetentionDate = new Date();
    rawRetentionDate.setDate(rawRetentionDate.getDate() - 30);
    
    const rawCleanup = await this.db
      .prepare(`
        DELETE FROM storage_metrics 
        WHERE metric_date < ? AND is_aggregated = 0
      `)
      .bind(rawRetentionDate.toISOString().split('T')[0])
      .run();

    // Clean up daily aggregations older than 365 days
    const dailyRetentionDate = new Date();
    dailyRetentionDate.setDate(dailyRetentionDate.getDate() - 365);
    
    const dailyCleanup = await this.db
      .prepare(`
        DELETE FROM storage_metrics 
        WHERE metric_date < ? AND aggregation_level = 'daily'
      `)
      .bind(dailyRetentionDate.toISOString().split('T')[0])
      .run();

    // Clean up daily snapshots older than 365 days
    const snapshotCleanup = await this.db
      .prepare(`
        DELETE FROM daily_storage_snapshots 
        WHERE snapshot_date < ?
      `)
      .bind(dailyRetentionDate.toISOString().split('T')[0])
      .run();

    // Clean up file access logs older than 90 days
    const logRetentionDate = new Date();
    logRetentionDate.setDate(logRetentionDate.getDate() - 90);
    
    const logCleanup = await this.db
      .prepare(`
        DELETE FROM file_access_logs 
        WHERE created_at < ?
      `)
      .bind(logRetentionDate.toISOString())
      .run();

    return {
      duration: Date.now() - startTime,
      rawMetricsDeleted: rawCleanup.meta.changes,
      dailyAggregationsDeleted: dailyCleanup.meta.changes,
      snapshotsDeleted: snapshotCleanup.meta.changes,
      logsDeleted: logCleanup.meta.changes
    };
  }

  /**
   * Get metric type from file access action
   */
  private getMetricTypeFromAction(action: string): string {
    switch (action) {
      case 'upload':
      case 'process':
        return 'requests_class_a';
      case 'download':
        return 'data_transfer_out';
      case 'delete':
        return 'requests_class_b';
      default:
        return 'requests_class_b';
    }
  }

  /**
   * Get storage operation from file access action
   */
  private getStorageOperationFromAction(action: string): StorageOperation {
    switch (action) {
      case 'upload':
        return 'upload_single';
      case 'download':
        return 'download';
      case 'delete':
        return 'delete';
      case 'process':
        return 'head';
      default:
        return 'head';
    }
  }

  /**
   * Categorize error message
   */
  private categorizeError(errorMessage: string): ErrorCategory {
    if (!errorMessage) return 'unknown_error';
    
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return 'network_error';
    }
    if (lowerMessage.includes('permission') || lowerMessage.includes('access denied')) {
      return 'permission_denied';
    }
    if (lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
      return 'quota_exceeded';
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      return 'file_not_found';
    }
    if (lowerMessage.includes('timeout')) {
      return 'timeout';
    }
    if (lowerMessage.includes('checksum') || lowerMessage.includes('integrity')) {
      return 'checksum_mismatch';
    }
    if (lowerMessage.includes('rate limit')) {
      return 'rate_limit_exceeded';
    }
    if (lowerMessage.includes('storage')) {
      return 'storage_limit_exceeded';
    }
    if (lowerMessage.includes('invalid') || lowerMessage.includes('bad request')) {
      return 'invalid_request';
    }
    if (lowerMessage.includes('server') || lowerMessage.includes('5')) {
      return 'server_error';
    }
    
    return 'unknown_error';
  }

  /**
   * Get start of week (Monday)
   */
  private getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  /**
   * Get end of week (Sunday)
   */
  private getWeekEnd(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Sunday
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }
}

// Type definitions
interface AggregationResult {
  date: string;
  type: 'daily' | 'weekly' | 'monthly';
  usersProcessed: number;
  successful: number;
  failed: number;
  duration: number;
  errors: unknown[];
}

interface CleanupResult {
  duration: number;
  rawMetricsDeleted: number;
  dailyAggregationsDeleted: number;
  snapshotsDeleted: number;
  logsDeleted: number;
}

// Type definitions for database operations
interface DatabaseMetric {
  metric_type: string;
  storage_class: string;
  total_bytes: number;
  total_operations: number;
  total_cost_usd: number;
  error_count: number;
  avg_success_rate?: number;
  source_records?: number;
}

interface RawMetric {
  action: string;
  file_id?: string;
  bytes_transferred?: number;
  duration_ms?: number;
  success: boolean;
  error_message?: string;
  operation_count: number;
}