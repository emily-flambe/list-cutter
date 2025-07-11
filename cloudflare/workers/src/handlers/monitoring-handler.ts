import { MetricsService } from '../services/monitoring/metrics-service.js';
import { CostCalculator } from '../services/monitoring/cost-calculator.js';
import { AlertManagementService } from '../services/monitoring/alert-management-service.js';
import { AlertEvaluationService } from '../services/monitoring/alert-evaluation-service.js';
import { NotificationService } from '../services/monitoring/notification-service.js';
import { AlertConfiguration } from '../services/monitoring/alert-configuration.js';
import { StorageOperation } from '../types/metrics.js';
import type { CloudflareEnv } from '../types/env.js';

/**
 * MonitoringHandler
 * Handles monitoring and alerting endpoints for cron jobs
 */
export class MonitoringHandler {
  private metricsService: MetricsService;
  private costCalculator: CostCalculator;
  private alertManager: AlertManagementService;
  private alertEvaluator: AlertEvaluationService;
  private notificationService: NotificationService;
  private alertConfiguration: AlertConfiguration;

  constructor(
    private analytics: AnalyticsEngineDataset,
    private db: D1Database,
    private env: CloudflareEnv
  ) {
    this.metricsService = new MetricsService(analytics, db, {
      enableMetrics: true,
      enableDetailedMetrics: false,
      successMetricsSamplingRate: 0.1,
      errorMetricsSamplingRate: 1.0
    });
    
    this.costCalculator = new CostCalculator(db, analytics);
    this.alertEvaluator = new AlertEvaluationService(db, analytics);
    this.notificationService = new NotificationService(db);
    this.alertManager = new AlertManagementService(db, analytics, this.alertEvaluator, this.notificationService);
    this.alertConfiguration = new AlertConfiguration(db);
  }

  /**
   * Handle metrics collection cron job
   * Endpoint: /api/monitoring/collect-metrics
   */
  async handleMetricsCollection(): Promise<Response> {
    try {
      console.log('Starting metrics collection...');
      
      // 1. Collect storage metrics from database
      const storageMetrics = await this.collectStorageMetrics();
      
      // 2. Collect performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics();
      
      // 3. Send metrics to Analytics Engine
      await this.sendMetricsToAnalytics(storageMetrics, performanceMetrics);
      
      // 4. Update database statistics
      await this.updateDatabaseStats(storageMetrics);
      
      // 5. Check for anomalies
      const anomalies = await this.detectAnomalies(storageMetrics);
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        metricsCollected: storageMetrics.length,
        anomaliesDetected: anomalies.length,
        message: 'Metrics collection completed successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Metrics collection failed:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Metrics collection failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle cost calculation cron job
   * Endpoint: /api/monitoring/calculate-costs
   */
  async handleCostCalculation(): Promise<Response> {
    try {
      console.log('Starting cost calculation...');
      
      // 1. Calculate current costs for all users
      const costData = await this.costCalculator.calculateAllUserCosts();
      
      // 2. Update cost tracking in database
      await this.costCalculator.updateCostTracking(costData);
      
      // 3. Check cost thresholds and generate alerts
      const costAlerts = await this.checkCostThresholds(costData);
      
      // 4. Process cost alerts
      for (const alert of costAlerts) {
        await this.alertManager.createAlertRule(alert.userId, alert.alertRule);
      }
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        usersProcessed: costData.length,
        totalCost: costData.reduce((sum, user) => sum + user.totalCost, 0),
        alertsTriggered: costAlerts.length,
        message: 'Cost calculation completed successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Cost calculation failed:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Cost calculation failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle alert checking cron job
   * Endpoint: /api/monitoring/check-alerts
   */
  async handleAlertChecking(): Promise<Response> {
    try {
      console.log('Starting alert checking...');
      
      // 1. Get all active alert rules
      const activeAlerts = await this.alertManager.listAlertRules();
      
      let evaluatedRules = 0;
      let triggeredAlerts = 0;
      
      // 2. Evaluate each alert rule
      for (const rule of activeAlerts) {
        if (!rule.enabled) continue;
        
        try {
          const evaluation = await this.alertEvaluator.evaluateAlertRule(rule);
          evaluatedRules++;
          
          if (evaluation.shouldTrigger) {
            triggeredAlerts++;
            await this.alertEvaluator.triggerAlert(rule, evaluation);
          }
        } catch (error) {
          console.error(`Failed to evaluate alert rule ${rule.id}:`, error);
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        totalRules: activeAlerts.length,
        evaluatedRules,
        triggeredAlerts,
        message: 'Alert checking completed successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Alert checking failed:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Alert checking failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle daily report generation
   * Endpoint: /api/monitoring/generate-daily-report
   */
  async handleDailyReport(): Promise<Response> {
    try {
      console.log('Starting daily report generation...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Aggregate daily metrics
      const dailyMetrics = await this.aggregateDailyMetrics(today);
      
      // 2. Generate cost summary
      const costSummary = await this.costCalculator.generateDailyCostSummary(today);
      
      // 3. Generate alert summary
      const alertSummary = await this.generateAlertSummary(today);
      
      // 4. Store daily report
      await this.storeDailyReport(today, {
        metrics: dailyMetrics,
        costs: costSummary,
        alerts: alertSummary
      });
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        reportDate: today,
        totalFiles: dailyMetrics.totalFiles,
        totalCost: costSummary.totalCost,
        totalAlerts: alertSummary.totalAlerts,
        message: 'Daily report generated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Daily report generation failed:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Daily report generation failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle monthly report generation
   * Endpoint: /api/monitoring/generate-monthly-report
   */
  async handleMonthlyReport(): Promise<Response> {
    try {
      console.log('Starting monthly report generation...');
      
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      
      // 1. Aggregate monthly metrics
      const monthlyMetrics = await this.aggregateMonthlyMetrics(year, month);
      
      // 2. Generate monthly cost summary
      const costSummary = await this.costCalculator.generateMonthlyCostSummary(year, month);
      
      // 3. Generate monthly alert summary
      const alertSummary = await this.generateMonthlyAlertSummary(year, month);
      
      // 4. Store monthly report
      await this.storeMonthlyReport(year, month, {
        metrics: monthlyMetrics,
        costs: costSummary,
        alerts: alertSummary
      });
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        reportYear: year,
        reportMonth: month,
        totalFiles: monthlyMetrics.totalFiles,
        totalCost: costSummary.totalCost,
        totalAlerts: alertSummary.totalAlerts,
        message: 'Monthly report generated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Monthly report generation failed:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Monthly report generation failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle old metrics cleanup
   * Endpoint: /api/monitoring/cleanup-old-metrics
   */
  async handleCleanupOldMetrics(): Promise<Response> {
    try {
      console.log('Starting old metrics cleanup...');
      
      const retentionDays = 30;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // 1. Clean up old file access logs
      const deletedLogs = await this.db.prepare(`
        DELETE FROM file_access_logs WHERE created_at < ?
      `).bind(cutoffDate.toISOString()).run();
      
      // 2. Clean up old storage analytics (keep longer for reporting)
      const analyticsRetentionDays = 365;
      const analyticssCutoffDate = new Date(Date.now() - analyticsRetentionDays * 24 * 60 * 60 * 1000);
      
      const deletedAnalytics = await this.db.prepare(`
        DELETE FROM storage_analytics WHERE created_at < ?
      `).bind(analyticssCutoffDate.toISOString()).run();
      
      // 3. Clean up old alert instances
      const alertRetentionDays = 90;
      const alertsCutoffDate = new Date(Date.now() - alertRetentionDays * 24 * 60 * 60 * 1000);
      
      const deletedAlerts = await this.db.prepare(`
        DELETE FROM alert_instances WHERE created_at < ? AND state = 'resolved'
      `).bind(alertsCutoffDate.toISOString()).run();
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        deletedLogs: deletedLogs.meta?.changes || 0,
        deletedAnalytics: deletedAnalytics.meta?.changes || 0,
        deletedAlerts: deletedAlerts.meta?.changes || 0,
        message: 'Old metrics cleanup completed successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Old metrics cleanup failed:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Old metrics cleanup failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Private helper methods
  private async collectStorageMetrics(): Promise<StorageMetric[]> {
    const result = await this.db.prepare(`
      SELECT 
        user_id,
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as daily_uploads,
        AVG(file_size) as avg_file_size
      FROM files
      GROUP BY user_id
    `).all();
    
    return result.results.map((row: DatabaseRow) => ({
      userId: String(row.user_id),
      totalFiles: Number(row.total_files) || 0,
      totalSize: Number(row.total_size) || 0,
      dailyUploads: Number(row.daily_uploads) || 0,
      avgFileSize: Number(row.avg_file_size) || 0,
      timestamp: new Date().toISOString()
    }));
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetric[]> {
    const result = await this.db.prepare(`
      SELECT 
        user_id,
        action,
        COUNT(*) as total_operations,
        AVG(bytes_transferred) as avg_throughput,
        AVG(CAST(strftime('%s', created_at) AS INTEGER) - CAST(strftime('%s', created_at) AS INTEGER)) as avg_duration
      FROM file_access_logs
      WHERE DATE(created_at) = DATE('now')
      GROUP BY user_id, action
    `).all();
    
    return result.results.map((row: DatabaseRow) => ({
      userId: String(row.user_id),
      operation: String(row.action) as StorageOperation,
      totalOperations: Number(row.total_operations) || 0,
      avgThroughput: Number(row.avg_throughput) || 0,
      avgDuration: Number(row.avg_duration) || 0,
      timestamp: new Date().toISOString()
    }));
  }

  private async sendMetricsToAnalytics(storageMetrics: StorageMetric[], performanceMetrics: PerformanceMetric[]): Promise<void> {
    // Send storage metrics to Analytics Engine
    for (const metric of storageMetrics) {
      await this.analytics.writeDataPoint({
        blobs: [
          'storage_metrics',
          metric.userId,
          'daily_collection'
        ],
        doubles: [
          metric.totalFiles,
          metric.totalSize,
          metric.dailyUploads,
          metric.avgFileSize
        ],
        indexes: [metric.userId]
      });
    }

    // Send performance metrics to Analytics Engine
    for (const metric of performanceMetrics) {
      await this.analytics.writeDataPoint({
        blobs: [
          'performance_metrics',
          metric.userId,
          metric.operation,
          'daily_collection'
        ],
        doubles: [
          metric.totalOperations,
          metric.avgThroughput,
          metric.avgDuration
        ],
        indexes: [metric.userId, metric.operation]
      });
    }
  }

  private async updateDatabaseStats(storageMetrics: StorageMetric[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    for (const metric of storageMetrics) {
      await this.db.prepare(`
        INSERT OR REPLACE INTO storage_analytics (
          user_id, date, total_files, total_size_bytes, uploaded_files, 
          operations_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        metric.userId,
        today,
        metric.totalFiles,
        metric.totalSize,
        metric.dailyUploads,
        metric.totalFiles, // operations_count
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    }
  }

  private async detectAnomalies(storageMetrics: StorageMetric[]): Promise<any[]> {
    const anomalies = [];
    
    for (const metric of storageMetrics) {
      // Check for unusual upload patterns
      if (metric.dailyUploads > 1000) {
        anomalies.push({
          type: 'high_upload_volume',
          userId: metric.userId,
          value: metric.dailyUploads,
          threshold: 1000
        });
      }
      
      // Check for unusual file sizes
      if (metric.avgFileSize > 100 * 1024 * 1024) { // 100MB
        anomalies.push({
          type: 'large_file_size',
          userId: metric.userId,
          value: metric.avgFileSize,
          threshold: 100 * 1024 * 1024
        });
      }
    }
    
    return anomalies;
  }

  private async checkCostThresholds(costData: any[]): Promise<any[]> {
    const alerts = [];
    
    for (const userCost of costData) {
      if (userCost.totalCost > 100) { // $100 threshold
        alerts.push({
          userId: userCost.userId,
          alertRule: {
            name: 'High Monthly Cost Alert',
            description: `Monthly cost exceeded $100 for user ${userCost.userId}`,
            alertType: 'cost_threshold',
            metricType: 'monthly_cost',
            thresholdValue: 100,
            thresholdOperator: '>',
            severity: 'high',
            thresholdUnit: 'USD'
          }
        });
      }
    }
    
    return alerts;
  }

  private async aggregateDailyMetrics(date: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        COUNT(DISTINCT user_id) as active_users
      FROM files
      WHERE DATE(created_at) = ?
    `).bind(date).first();
    
    return {
      totalFiles: Number(result?.total_files) || 0,
      totalSize: Number(result?.total_size) || 0,
      activeUsers: Number(result?.active_users) || 0
    };
  }

  private async aggregateMonthlyMetrics(year: number, month: number): Promise<any> {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        COUNT(DISTINCT user_id) as active_users
      FROM files
      WHERE strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
    `).bind(year.toString(), month.toString().padStart(2, '0')).first();
    
    return {
      totalFiles: Number(result?.total_files) || 0,
      totalSize: Number(result?.total_size) || 0,
      activeUsers: Number(result?.active_users) || 0
    };
  }

  private async generateAlertSummary(date: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN state = 'active' THEN 1 END) as active_alerts,
        COUNT(CASE WHEN state = 'resolved' THEN 1 END) as resolved_alerts
      FROM alert_instances
      WHERE DATE(created_at) = ?
    `).bind(date).first();
    
    return {
      totalAlerts: Number(result?.total_alerts) || 0,
      activeAlerts: Number(result?.active_alerts) || 0,
      resolvedAlerts: Number(result?.resolved_alerts) || 0
    };
  }

  private async generateMonthlyAlertSummary(year: number, month: number): Promise<any> {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN state = 'active' THEN 1 END) as active_alerts,
        COUNT(CASE WHEN state = 'resolved' THEN 1 END) as resolved_alerts
      FROM alert_instances
      WHERE strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
    `).bind(year.toString(), month.toString().padStart(2, '0')).first();
    
    return {
      totalAlerts: Number(result?.total_alerts) || 0,
      activeAlerts: Number(result?.active_alerts) || 0,
      resolvedAlerts: Number(result?.resolved_alerts) || 0
    };
  }

  private async storeDailyReport(date: string, reportData: any): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO daily_reports (
        report_date, metrics_data, cost_data, alert_data, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      date,
      JSON.stringify(reportData.metrics),
      JSON.stringify(reportData.costs),
      JSON.stringify(reportData.alerts),
      new Date().toISOString()
    ).run();
  }

  private async storeMonthlyReport(year: number, month: number, reportData: any): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO monthly_reports (
        report_year, report_month, metrics_data, cost_data, alert_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      year,
      month,
      JSON.stringify(reportData.metrics),
      JSON.stringify(reportData.costs),
      JSON.stringify(reportData.alerts),
      new Date().toISOString()
    ).run();
  }

  /**
   * Initialize default alert rules
   * This should be called during system setup
   */
  async initializeDefaultAlerts(): Promise<Response> {
    try {
      console.log('Initializing default alert rules...');
      
      await this.alertConfiguration.setupDefaultAlerts();
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Default alert rules initialized successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Failed to initialize default alerts:', error);
      return new Response(JSON.stringify({
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to initialize default alert rules'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

// Type definitions
interface StorageMetric {
  userId: string;
  totalFiles: number;
  totalSize: number;
  dailyUploads: number;
  avgFileSize: number;
  timestamp: string;
}

interface PerformanceMetric {
  userId: string;
  operation: StorageOperation;
  totalOperations: number;
  avgThroughput: number;
  avgDuration: number;
  timestamp: string;
}

interface DatabaseRow {
  [key: string]: unknown;
}