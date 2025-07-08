import { MetricsService } from './metrics-service.js';
import { CostCalculator } from './cost-calculator.js';
import { AggregationService } from './aggregation-service.js';
import { MetricsQueryService } from './query-service.js';
import { MetricsScheduler } from './scheduler.js';
import { StorageOperation, ErrorCategory, OperationData } from '../../types/metrics.js';

/**
 * Enhanced metrics service that integrates all monitoring components
 * Provides a unified interface for storage metrics, cost tracking, and analytics
 */
export class EnhancedMetricsService {
  private metricsService: MetricsService;
  private costCalculator: CostCalculator;
  private aggregationService: AggregationService;
  private queryService: MetricsQueryService;
  private scheduler: MetricsScheduler;
  private db: D1Database;

  constructor(
    analytics: AnalyticsEngineDataset,
    db: D1Database,
    config: Record<string, unknown> = {}
  ) {
    this.db = db;
    this.metricsService = new MetricsService(analytics, db, config);
    this.costCalculator = new CostCalculator(db);
    this.aggregationService = new AggregationService(db);
    this.queryService = new MetricsQueryService(db);
    this.scheduler = new MetricsScheduler(db);
  }

  /**
   * Record a comprehensive storage operation with cost tracking
   */
  async recordOperation(
    operation: StorageOperation,
    fileId: string,
    userId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    success: boolean,
    duration: number,
    errorMessage?: string,
    additionalData: OperationData = {},
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ): Promise<void> {
    const startTime = Date.now() - duration;
    const endTime = Date.now();

    // Categorize error if operation failed
    let errorCategory: ErrorCategory | undefined;
    if (!success && errorMessage) {
      errorCategory = this.metricsService.categorizeError(errorMessage);
    }

    // Record metrics in Analytics Engine
    await this.metricsService.recordStorageMetric(
      operation,
      fileId,
      userId,
      fileName,
      fileSize,
      contentType,
      startTime,
      endTime,
      success,
      errorCategory,
      errorMessage,
      additionalData,
      context
    );

    // Record detailed access log for cost calculation
    await this.recordAccessLog(
      fileId,
      userId,
      this.mapOperationToAction(operation),
      context.ipAddress,
      context.userAgent,
      success,
      errorMessage,
      fileSize,
      duration,
      additionalData
    );

    // Calculate and record cost immediately for critical operations
    if (success && this.isCriticalOperation(operation)) {
      try {
        const cost = await this.costCalculator.calculateOperationCost(
          userId,
          operation,
          fileSize,
          additionalData.storageClass as 'Standard' | 'InfrequentAccess' || 'Standard'
        );

        await this.recordOperationCost(
          userId,
          operation,
          fileSize,
          cost.totalCost,
          additionalData.storageClass || 'Standard'
        );
      } catch (error) {
        console.error('Failed to calculate operation cost:', error);
      }
    }
  }

  /**
   * Get comprehensive user dashboard data
   */
  async getUserDashboard(userId: string): Promise<UserDashboard> {
    // Get overview
    const overview = await this.queryService.getUserStorageOverview(userId);
    
    // Get 30-day history
    const history = await this.queryService.getUserStorageHistory(userId, '30days');
    
    // Get cost breakdown
    const costs = await this.queryService.getUserCostBreakdown(userId, '30days');
    
    // Get error analytics
    const errors = await this.queryService.getErrorAnalytics(userId, '7days');
    
    // Get performance metrics
    const performance = await this.queryService.getPerformanceMetrics(userId, '7days');

    // Check quota status
    const quotaStatus = await this.checkQuotaStatus(userId);

    return {
      overview,
      history,
      costs,
      errors,
      performance,
      quotaStatus
    };
  }

  /**
   * Get admin dashboard data
   */
  async getAdminDashboard(): Promise<AdminDashboard> {
    // Get system overview
    const systemOverview = await this.queryService.getSystemMetricsOverview();
    
    // Get system-wide error analytics
    const errorAnalytics = await this.queryService.getErrorAnalytics(undefined, '7days');
    
    // Get system-wide performance metrics
    const performanceMetrics = await this.queryService.getPerformanceMetrics(undefined, '7days');
    
    // Get job statistics
    const jobStats = await this.scheduler.getJobStatistics(30);
    
    // Get recent job history
    const jobHistory = await this.scheduler.getJobHistory(undefined, 50);

    // Get quota violations and alerts
    const alerts = await this.getSystemAlerts();

    return {
      systemOverview,
      errorAnalytics,
      performanceMetrics,
      jobStats,
      jobHistory,
      alerts
    };
  }

  /**
   * Trigger manual aggregation
   */
  async triggerAggregation(
    type: 'daily' | 'weekly' | 'monthly',
    date?: Date
  ): Promise<AggregationResult> {
    const targetDate = date || new Date();
    
    switch (type) {
      case 'daily':
        return await this.aggregationService.runDailyAggregation(targetDate);
      case 'weekly':
        return await this.aggregationService.runWeeklyAggregation(targetDate);
      case 'monthly':
        return await this.aggregationService.runMonthlyAggregation(targetDate);
      default:
        throw new Error(`Invalid aggregation type: ${type}`);
    }
  }

  /**
   * Handle scheduled job execution
   */
  async handleScheduledJob(jobType: string, request: Request): Promise<Response> {
    return await this.scheduler.handleScheduledJob(jobType, request);
  }

  /**
   * Get user cost estimation for a planned operation
   */
  async estimateOperationCost(
    userId: string,
    operation: StorageOperation,
    fileSize: number,
    storageClass: 'Standard' | 'InfrequentAccess' = 'Standard'
  ): Promise<CostEstimation> {
    const cost = await this.costCalculator.calculateOperationCost(
      userId,
      operation,
      fileSize,
      storageClass
    );

    // Get current quota usage
    const overview = await this.queryService.getUserStorageOverview(userId);
    
    // Check if operation would exceed quotas
    const quotaWarnings = await this.checkOperationQuotas(
      userId,
      operation,
      fileSize,
      overview
    );

    return {
      estimatedCost: cost.totalCost,
      unitCost: cost.unitCost,
      freeTierUsed: cost.freeTierUsed,
      billableUnits: cost.billableUnits,
      quotaWarnings,
      breakdown: {
        operation,
        fileSize,
        storageClass,
        calculatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Update user quota settings
   */
  async updateUserQuota(
    userId: string,
    quotaUpdates: Partial<UserQuotaUpdate>
  ): Promise<void> {
    const updateFields: string[] = [];
    const params: unknown[] = [];

    if (quotaUpdates.maxStorageBytes !== undefined) {
      updateFields.push('max_storage_bytes = ?');
      params.push(quotaUpdates.maxStorageBytes);
    }
    if (quotaUpdates.maxObjects !== undefined) {
      updateFields.push('max_objects = ?');
      params.push(quotaUpdates.maxObjects);
    }
    if (quotaUpdates.maxMonthlyCost !== undefined) {
      updateFields.push('max_monthly_cost_usd = ?');
      params.push(quotaUpdates.maxMonthlyCost);
    }
    if (quotaUpdates.quotaType !== undefined) {
      updateFields.push('quota_type = ?');
      params.push(quotaUpdates.quotaType);
    }
    if (quotaUpdates.billingEnabled !== undefined) {
      updateFields.push('billing_enabled = ?');
      params.push(quotaUpdates.billingEnabled ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return;
    }

    params.push(userId);

    await this.db
      .prepare(`
        UPDATE user_storage_quotas 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `)
      .bind(...params)
      .run();

    // Clear related cache
    this.queryService.clearCache(userId);
  }

  /**
   * Clear cache for specific patterns
   */
  clearCache(pattern?: string): void {
    this.queryService.clearCache(pattern);
  }

  /**
   * Record access log for cost calculation
   */
  private async recordAccessLog(
    fileId: string,
    userId: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    errorMessage?: string,
    bytesTransferred: number = 0,
    durationMs: number = 0,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO file_access_logs (
            file_id, user_id, action, ip_address, user_agent,
            success, error_message, bytes_transferred, duration_ms, metadata
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fileId, userId, action, ipAddress, userAgent,
          success ? 1 : 0, errorMessage, bytesTransferred, durationMs,
          JSON.stringify(metadata)
        )
        .run();
    } catch (error) {
      console.error('Failed to record access log:', error);
    }
  }

  /**
   * Record operation cost in storage metrics
   */
  private async recordOperationCost(
    userId: string,
    operation: StorageOperation,
    bytes: number,
    cost: number,
    storageClass: string
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const metricType = this.getMetricTypeFromOperation(operation);

    try {
      await this.db
        .prepare(`
          INSERT INTO storage_metrics (
            user_id, metric_date, metric_type, storage_class,
            total_bytes, total_operations, total_cost_usd, is_aggregated, aggregation_level
          )
          VALUES (?, ?, ?, ?, ?, 1, ?, 0, 'daily')
          ON CONFLICT(user_id, metric_date, metric_type, storage_class, aggregation_level)
          DO UPDATE SET
            total_bytes = total_bytes + excluded.total_bytes,
            total_operations = total_operations + excluded.total_operations,
            total_cost_usd = total_cost_usd + excluded.total_cost_usd,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(userId, today, metricType, storageClass, bytes, cost)
        .run();
    } catch (error) {
      console.error('Failed to record operation cost:', error);
    }
  }

  /**
   * Check quota status for a user
   */
  private async checkQuotaStatus(userId: string): Promise<QuotaStatus> {
    const overview = await this.queryService.getUserStorageOverview(userId);
    
    const warnings: string[] = [];
    const violations: string[] = [];

    // Check storage quota
    if (overview.storage.usagePercentage > 90) {
      if (overview.storage.usagePercentage > 100) {
        violations.push('Storage quota exceeded');
      } else {
        warnings.push('Storage quota nearly full (>90%)');
      }
    }

    // Check monthly cost
    const costPercentage = overview.costs.currentMonthCost / 50; // Assuming $50 default limit
    if (costPercentage > 0.9) {
      if (costPercentage > 1.0) {
        violations.push('Monthly cost quota exceeded');
      } else {
        warnings.push('Monthly cost quota nearly reached (>90%)');
      }
    }

    return {
      status: violations.length > 0 ? 'violated' : warnings.length > 0 ? 'warning' : 'ok',
      warnings,
      violations,
      quotaType: overview.quota.quotaType,
      billingEnabled: overview.quota.billingEnabled
    };
  }

  /**
   * Check if operation would violate quotas
   */
  private async checkOperationQuotas(
    userId: string,
    operation: StorageOperation,
    fileSize: number,
    overview: UserStorageOverview
  ): Promise<string[]> {
    const warnings: string[] = [];

    // Check if upload would exceed storage quota
    if (operation.includes('upload')) {
      const newTotal = overview.storage.totalBytes + fileSize;
      const newPercentage = (newTotal / overview.quota.maxStorageBytes) * 100;
      
      if (newPercentage > 100) {
        warnings.push('Operation would exceed storage quota');
      } else if (newPercentage > 90) {
        warnings.push('Operation would push storage usage over 90%');
      }
    }

    return warnings;
  }

  /**
   * Get system alerts
   */
  private async getSystemAlerts(): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    // Check for users over quota
    const overQuotaUsers = await this.db
      .prepare(`
        SELECT u.username, u.email, ucu.storage_usage_percentage
        FROM user_current_usage ucu
        JOIN users u ON ucu.user_id = u.id
        WHERE ucu.storage_usage_percentage > 100
        ORDER BY ucu.storage_usage_percentage DESC
        LIMIT 10
      `)
      .all();

    for (const user of overQuotaUsers.results as Record<string, unknown>[]) {
      alerts.push({
        type: 'quota_violation',
        severity: 'high',
        message: `User ${user.username} (${user.email}) is over storage quota (${user.storage_usage_percentage}%)`,
        timestamp: new Date().toISOString(),
        data: user
      });
    }

    // Check for high error rates
    const errorRates = await this.db
      .prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_ops,
          COUNT(CASE WHEN success = 0 THEN 1 END) as failed_ops
        FROM file_access_logs
        WHERE created_at >= datetime('now', '-1 day')
        GROUP BY DATE(created_at)
        HAVING (COUNT(CASE WHEN success = 0 THEN 1 END) * 1.0 / COUNT(*)) > 0.05
      `)
      .all();

    for (const rate of errorRates.results as Record<string, unknown>[]) {
      const errorRate = (rate.failed_ops / rate.total_ops) * 100;
      alerts.push({
        type: 'high_error_rate',
        severity: 'medium',
        message: `High error rate detected: ${errorRate.toFixed(2)}% on ${rate.date}`,
        timestamp: new Date().toISOString(),
        data: rate
      });
    }

    return alerts;
  }

  /**
   * Map storage operation to access log action
   */
  private mapOperationToAction(operation: StorageOperation): string {
    switch (operation) {
      case 'upload_single':
      case 'upload_multipart':
      case 'upload_part':
      case 'complete_multipart':
        return 'upload';
      case 'download':
        return 'download';
      case 'delete':
        return 'delete';
      case 'list':
      case 'head':
        return 'process';
      case 'abort_multipart':
        return 'delete';
      default:
        return 'process';
    }
  }

  /**
   * Check if operation is critical for immediate cost tracking
   */
  private isCriticalOperation(operation: StorageOperation): boolean {
    return [
      'upload_single',
      'upload_multipart',
      'complete_multipart',
      'download',
      'delete'
    ].includes(operation);
  }

  /**
   * Get metric type from operation
   */
  private getMetricTypeFromOperation(operation: StorageOperation): string {
    switch (operation) {
      case 'upload_single':
      case 'upload_multipart':
      case 'upload_part':
      case 'complete_multipart':
        return 'requests_class_a';
      case 'download':
        return 'data_transfer_out';
      case 'delete':
      case 'list':
      case 'head':
      case 'abort_multipart':
        return 'requests_class_b';
      default:
        return 'requests_class_b';
    }
  }
}

// Type definitions
interface UserDashboard {
  overview: UserStorageOverview;
  history: StorageHistoryData;
  costs: CostBreakdownData;
  errors: ErrorAnalyticsData;
  performance: PerformanceMetricsData;
  quotaStatus: QuotaStatus;
}

interface AdminDashboard {
  systemOverview: SystemMetricsOverview;
  errorAnalytics: ErrorAnalyticsData;
  performanceMetrics: PerformanceMetricsData;
  jobStats: JobStatistics;
  jobHistory: JobHistoryEntry[];
  alerts: SystemAlert[];
}

interface CostEstimation {
  estimatedCost: number;
  unitCost: number;
  freeTierUsed: number;
  billableUnits: number;
  quotaWarnings: string[];
  breakdown: {
    operation: StorageOperation;
    fileSize: number;
    storageClass: string;
    calculatedAt: string;
  };
}

interface UserQuotaUpdate {
  maxStorageBytes: number;
  maxObjects: number;
  maxMonthlyCost: number;
  quotaType: 'free' | 'paid' | 'enterprise';
  billingEnabled: boolean;
}

interface QuotaStatus {
  status: 'ok' | 'warning' | 'violated';
  warnings: string[];
  violations: string[];
  quotaType: string;
  billingEnabled: boolean;
}

interface SystemAlert {
  type: 'quota_violation' | 'high_error_rate' | 'high_cost' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// Additional type definitions
interface AggregationResult {
  successful: number;
  failed: number;
  duration: number;
  [key: string]: unknown;
}

interface UserStorageOverview {
  storage: { totalBytes: number; usagePercentage: number; [key: string]: unknown };
  costs: { currentMonthCost: number; [key: string]: unknown };
  quota: { maxStorageBytes: number; billingEnabled: boolean; quotaType: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface StorageHistoryData {
  [key: string]: unknown;
}

interface CostBreakdownData {
  [key: string]: unknown;
}

interface ErrorAnalyticsData {
  [key: string]: unknown;
}

interface PerformanceMetricsData {
  [key: string]: unknown;
}

interface SystemMetricsOverview {
  [key: string]: unknown;
}

interface JobStatistics {
  [key: string]: unknown;
}

interface JobHistoryEntry {
  [key: string]: unknown;
}