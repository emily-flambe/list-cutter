import {
  MonitoringResult,
  MonitoringIssue,
  CutoverMonitoringConfig,
  PerformanceMetrics,
  DeploymentEnvironment,
  ValidationResult
} from '../../types/deployment.js';
import type { CloudflareEnv } from '../../types/env.js';

/**
 * Real-time monitoring service for production cutover operations
 * Tracks system health, performance, and stability during blue-green deployment transitions
 */
export class CutoverMonitoring {
  private analytics?: AnalyticsEngineDataset;
  private db: D1Database;
  private monitoringActive: boolean = false;
  private monitoringPromise: Promise<MonitoringResult> | null = null;

  constructor(env: CloudflareEnv) {
    this.analytics = env.ANALYTICS;
    this.db = env.DB;
  }

  /**
   * Start monitoring during cutover with configurable duration and thresholds
   */
  async monitorCutover(
    environment: DeploymentEnvironment,
    config: CutoverMonitoringConfig
  ): Promise<MonitoringResult> {
    if (this.monitoringActive) {
      throw new Error('Monitoring already in progress');
    }

    this.monitoringActive = true;
    const startTime = new Date().toISOString();
    
    try {
      this.monitoringPromise = this.executeMonitoring(environment, config, startTime);
      return await this.monitoringPromise;
    } finally {
      this.monitoringActive = false;
      this.monitoringPromise = null;
    }
  }

  /**
   * Execute the monitoring loop
   */
  private async executeMonitoring(
    environment: DeploymentEnvironment,
    config: CutoverMonitoringConfig,
    startTime: string
  ): Promise<MonitoringResult> {
    const endTime = Date.now() + config.duration;
    const issues: MonitoringIssue[] = [];
    let totalChecks = 0;
    let successfulChecks = 0;
    let totalResponseTime = 0;
    let totalErrorCount = 0;

    console.log(`🔍 Starting cutover monitoring for ${environment} environment`);
    console.log(`📊 Duration: ${config.duration}ms, Check interval: ${config.checkInterval}ms`);

    while (Date.now() < endTime && this.monitoringActive) {
      const checkStart = Date.now();
      
      try {
        // Collect metrics from all endpoints
        const metrics = await this.collectSystemMetrics(environment, config.endpoints);
        totalChecks++;

        // Evaluate thresholds
        const checkIssues = this.evaluateThresholds(metrics, config.thresholds);
        issues.push(...checkIssues);

        // Track aggregate metrics
        totalResponseTime += metrics.responseTime;
        totalErrorCount += metrics.errorRate > 0 ? 1 : 0;

        if (checkIssues.length === 0) {
          successfulChecks++;
        }

        // Send metrics to Analytics Engine
        await this.recordMonitoringMetrics(environment, metrics, checkStart);

        // Check for critical issues that should trigger rollback
        const criticalIssues = checkIssues.filter(issue => issue.severity === 'critical');
        if (criticalIssues.length > 0) {
          console.error(`❌ Critical issues detected during monitoring:`, criticalIssues);
          
          const errorResult: MonitoringResult = {
            healthy: false,
            errorRate: metrics.errorRate,
            avgResponseTime: metrics.responseTime,
            successfulChecks,
            totalChecks,
            startTime,
            endTime: new Date().toISOString(),
            issues: [...issues, ...criticalIssues]
          };

          // Alert if configured
          if (config.alerting.enabled) {
            await this.sendAlert(environment, 'critical_threshold_exceeded', criticalIssues);
          }

          return errorResult;
        }

        // Log current status
        if (totalChecks % 10 === 0) {
          console.log(`📊 Monitoring check ${totalChecks}: Response time ${metrics.responseTime}ms, Error rate ${metrics.errorRate}%`);
        }

      } catch (error) {
        console.error('Error during monitoring check:', error);
        totalChecks++;
        issues.push({
          type: 'custom',
          severity: 'high',
          message: `Monitoring check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          value: 0,
          threshold: 0,
          timestamp: new Date().toISOString()
        });
      }

      // Wait for next check interval
      const checkDuration = Date.now() - checkStart;
      const remainingInterval = Math.max(0, config.checkInterval - checkDuration);
      if (remainingInterval > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingInterval));
      }
    }

    const finalEndTime = new Date().toISOString();
    const avgResponseTime = totalChecks > 0 ? totalResponseTime / totalChecks : 0;
    const errorRate = totalChecks > 0 ? (totalErrorCount / totalChecks) * 100 : 0;
    const healthy = errorRate <= config.thresholds.maxErrorRate && 
                   avgResponseTime <= config.thresholds.maxResponseTime;

    const result: MonitoringResult = {
      healthy,
      errorRate,
      avgResponseTime,
      successfulChecks,
      totalChecks,
      startTime,
      endTime: finalEndTime,
      issues
    };

    console.log(`✅ Cutover monitoring completed. Healthy: ${healthy}, Success rate: ${(successfulChecks/totalChecks)*100}%`);

    // Record final monitoring result
    await this.recordMonitoringResult(environment, result);

    return result;
  }

  /**
   * Collect system metrics from multiple endpoints
   */
  private async collectSystemMetrics(
    environment: DeploymentEnvironment,
    endpoints: string[]
  ): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics[] = [];
    
    for (const endpoint of endpoints) {
      try {
        const metric = await this.checkEndpoint(endpoint);
        metrics.push(metric);
      } catch (error) {
        // Add failed endpoint as error metric
        metrics.push({
          responseTime: 30000, // Timeout value
          throughput: 0,
          errorRate: 100,
          successRate: 0
        });
      }
    }

    // Aggregate metrics
    const totalMetrics = metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalMetrics;
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / totalMetrics;
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / totalMetrics;
    const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / totalMetrics;

    return {
      responseTime: avgResponseTime,
      throughput: avgThroughput,
      errorRate: avgErrorRate,
      successRate: avgSuccessRate,
      concurrentUsers: await this.estimateConcurrentUsers(),
      memoryUsage: await this.getMemoryUsage(),
      cpuUsage: await this.getCpuUsage()
    };
  }

  /**
   * Check individual endpoint health and performance
   */
  private async checkEndpoint(endpoint: string): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    let success = false;
    let responseTime = 0;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'User-Agent': 'ListCutter-CutoverMonitoring/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      responseTime = Date.now() - startTime;
      success = response.ok;

      return {
        responseTime,
        throughput: success ? 1000 / responseTime : 0, // Requests per second approximation
        errorRate: success ? 0 : 100,
        successRate: success ? 100 : 0
      };

    } catch (error) {
      responseTime = Date.now() - startTime;
      
      return {
        responseTime,
        throughput: 0,
        errorRate: 100,
        successRate: 0
      };
    }
  }

  /**
   * Evaluate metrics against thresholds and identify issues
   */
  private evaluateThresholds(
    metrics: PerformanceMetrics,
    thresholds: CutoverMonitoringConfig['thresholds']
  ): MonitoringIssue[] {
    const issues: MonitoringIssue[] = [];
    const timestamp = new Date().toISOString();

    // Check error rate
    if (metrics.errorRate > thresholds.maxErrorRate) {
      issues.push({
        type: 'error_rate',
        severity: metrics.errorRate > thresholds.maxErrorRate * 2 ? 'critical' : 'high',
        message: `Error rate ${metrics.errorRate}% exceeds threshold ${thresholds.maxErrorRate}%`,
        value: metrics.errorRate,
        threshold: thresholds.maxErrorRate,
        timestamp
      });
    }

    // Check response time
    if (metrics.responseTime > thresholds.maxResponseTime) {
      issues.push({
        type: 'response_time',
        severity: metrics.responseTime > thresholds.maxResponseTime * 2 ? 'critical' : 'high',
        message: `Response time ${metrics.responseTime}ms exceeds threshold ${thresholds.maxResponseTime}ms`,
        value: metrics.responseTime,
        threshold: thresholds.maxResponseTime,
        timestamp
      });
    }

    // Check success rate
    if (metrics.successRate < thresholds.minSuccessRate) {
      issues.push({
        type: 'availability',
        severity: metrics.successRate < thresholds.minSuccessRate * 0.5 ? 'critical' : 'high',
        message: `Success rate ${metrics.successRate}% below threshold ${thresholds.minSuccessRate}%`,
        value: metrics.successRate,
        threshold: thresholds.minSuccessRate,
        timestamp
      });
    }

    return issues;
  }

  /**
   * Record monitoring metrics in Analytics Engine
   */
  private async recordMonitoringMetrics(
    environment: DeploymentEnvironment,
    metrics: PerformanceMetrics,
    timestamp: number
  ): Promise<void> {
    try {
      if (this.analytics) {
        await this.analytics.writeDataPoint({
          blobs: [
            'cutover_monitoring',
            environment,
            'health_check'
          ],
          doubles: [
            metrics.responseTime,
            metrics.throughput,
            metrics.errorRate,
            metrics.successRate,
            metrics.memoryUsage || 0,
            metrics.cpuUsage || 0
          ],
          indexes: [environment, 'cutover_monitoring']
        });
      }
    } catch (error) {
      console.error('Failed to record monitoring metrics:', error);
    }
  }

  /**
   * Record final monitoring result in database
   */
  private async recordMonitoringResult(
    environment: DeploymentEnvironment,
    result: MonitoringResult
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO deployment_monitoring_results (
            environment, start_time, end_time, healthy, error_rate, 
            avg_response_time, successful_checks, total_checks, issues_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          environment,
          result.startTime,
          result.endTime,
          result.healthy ? 1 : 0,
          result.errorRate,
          result.avgResponseTime,
          result.successfulChecks,
          result.totalChecks,
          result.issues?.length || 0
        )
        .run();

      // Record individual issues
      if (result.issues && result.issues.length > 0) {
        for (const issue of result.issues) {
          await this.db
            .prepare(`
              INSERT INTO deployment_monitoring_issues (
                environment, timestamp, issue_type, severity, message, 
                value, threshold
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(
              environment,
              issue.timestamp,
              issue.type,
              issue.severity,
              issue.message,
              issue.value,
              issue.threshold
            )
            .run();
        }
      }
    } catch (error) {
      console.error('Failed to record monitoring result:', error);
    }
  }

  /**
   * Send alert for critical issues
   */
  private async sendAlert(
    environment: DeploymentEnvironment,
    alertType: string,
    issues: MonitoringIssue[]
  ): Promise<void> {
    try {
      // Record alert in database
      await this.db
        .prepare(`
          INSERT INTO deployment_alerts (
            environment, alert_type, severity, message, triggered_at, metadata
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          environment,
          alertType,
          'critical',
          `Critical monitoring issues detected: ${issues.map(i => i.message).join(', ')}`,
          new Date().toISOString(),
          JSON.stringify({ issues })
        )
        .run();

      console.error(`🚨 ALERT: Critical monitoring issues in ${environment}:`, issues);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Stop ongoing monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringActive) {
      console.log('🛑 Stopping cutover monitoring...');
      this.monitoringActive = false;
    }
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): {
    active: boolean;
    promise: Promise<MonitoringResult> | null;
  } {
    return {
      active: this.monitoringActive,
      promise: this.monitoringPromise
    };
  }

  /**
   * Get monitoring history for analysis
   */
  async getMonitoringHistory(
    environment?: DeploymentEnvironment,
    limit: number = 50
  ): Promise<MonitoringResult[]> {
    const query = environment 
      ? `SELECT * FROM deployment_monitoring_results WHERE environment = ? ORDER BY start_time DESC LIMIT ?`
      : `SELECT * FROM deployment_monitoring_results ORDER BY start_time DESC LIMIT ?`;
    
    const params = environment ? [environment, limit] : [limit];
    
    try {
      const results = await this.db
        .prepare(query)
        .bind(...params)
        .all();

      return results.results.map((row: any) => ({
        healthy: Boolean(row.healthy),
        errorRate: row.error_rate,
        avgResponseTime: row.avg_response_time,
        successfulChecks: row.successful_checks,
        totalChecks: row.total_checks,
        startTime: row.start_time,
        endTime: row.end_time,
        issues: [] // Issues would be loaded separately if needed
      }));
    } catch (error) {
      console.error('Failed to get monitoring history:', error);
      return [];
    }
  }

  /**
   * Estimate concurrent users (basic implementation)
   */
  private async estimateConcurrentUsers(): Promise<number> {
    try {
      // Get request count from last minute
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      
      const result = await this.db
        .prepare(`
          SELECT COUNT(DISTINCT user_id) as concurrent_users
          FROM file_access_logs 
          WHERE created_at >= ?
        `)
        .bind(oneMinuteAgo)
        .first();

      return (result?.concurrent_users as number) || 0;
    } catch (error) {
      console.error('Failed to estimate concurrent users:', error);
      return 0;
    }
  }

  /**
   * Get memory usage (placeholder - would integrate with CF Analytics)
   */
  private async getMemoryUsage(): Promise<number> {
    // In a real implementation, this would fetch from Cloudflare Analytics
    // For now, return a simulated value
    return Math.random() * 80; // 0-80% memory usage
  }

  /**
   * Get CPU usage (placeholder - would integrate with CF Analytics)
   */
  private async getCpuUsage(): Promise<number> {
    // In a real implementation, this would fetch from Cloudflare Analytics
    // For now, return a simulated value
    return Math.random() * 70; // 0-70% CPU usage
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    
    if (this.monitoringPromise) {
      try {
        await this.monitoringPromise;
      } catch (error) {
        console.error('Error during monitoring cleanup:', error);
      }
    }
  }
}