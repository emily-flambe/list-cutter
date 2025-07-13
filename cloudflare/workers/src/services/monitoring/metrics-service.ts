import {
  StorageMetrics,
  // UserStorageMetrics,
  // MultipartUploadMetrics,
  MetricsConfiguration,
  ErrorCategory,
  StorageOperation,
  OperationData
} from '../../types/metrics.js';

/**
 * Comprehensive metrics collection service for R2 storage monitoring
 * Integrates with Cloudflare Analytics Engine for real-time metrics
 */
export class MetricsService {
  private analytics?: AnalyticsEngineDataset;
  private db: D1Database;
  private config: MetricsConfiguration;
  private metricsQueue: StorageMetrics[] = [];
  private flushTimer: number | null = null;

  constructor(
    analytics: AnalyticsEngineDataset | undefined,
    db: D1Database,
    config: Partial<MetricsConfiguration> = {}
  ) {
    this.analytics = analytics;
    this.db = db;
    this.config = this.mergeConfig(config);
    
    // Start periodic flush if async metrics are enabled
    if (this.config.asyncMetrics) {
      this.startPeriodicFlush();
    }
  }

  /**
   * Record a storage operation metric
   */
  async recordStorageMetric(
    operation: StorageOperation,
    fileId: string,
    userId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    startTime: number,
    endTime: number,
    success: boolean,
    errorCategory?: ErrorCategory,
    errorMessage?: string,
    operationData: OperationData = {},
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ): Promise<void> {
    if (!this.config.enableMetrics) {
      return;
    }

    // Apply sampling for successful operations
    if (success && !this.shouldSample(this.config.successMetricsSamplingRate)) {
      return;
    }

    // Always record errors (with potential sampling)
    if (!success && !this.shouldSample(this.config.errorMetricsSamplingRate)) {
      return;
    }

    const duration = endTime - startTime;
    const throughput = fileSize > 0 ? (fileSize / duration) * 1000 : 0; // bytes per second

    const metric: StorageMetrics = {
      timestamp: startTime,
      operation,
      duration,
      fileId,
      userId,
      fileName,
      fileSize,
      contentType,
      success,
      errorCategory,
      errorMessage,
      operationData: {
        ...operationData,
        bytesTransferred: fileSize
      },
      throughput,
      latency: duration,
      ...context
    };

    if (this.config.asyncMetrics) {
      await this.queueMetric(metric);
    } else {
      await this.sendMetric(metric);
    }

    // Update storage analytics in database
    await this.updateStorageAnalytics(userId, operation, fileSize, success);
  }

  /**
   * Record multipart upload metrics
   */
  async recordMultipartUploadMetric(
    uploadId: string,
    fileId: string,
    userId: string,
    startTime: number,
    endTime: number,
    totalParts: number,
    completedParts: number,
    failedParts: number,
    totalBytes: number,
    status: 'active' | 'completed' | 'failed' | 'aborted',
    errorDetails?: {
      category: ErrorCategory;
      message: string;
      failedParts: number[];
    }
  ): Promise<void> {
    if (!this.config.enableMetrics) {
      return;
    }

    const duration = endTime - startTime;
    const averagePartSize = totalBytes / totalParts;
    const overallThroughput = totalBytes > 0 ? (totalBytes / duration) * 1000 : 0;

    // Multipart metric would be created here if needed

    // Send to Analytics Engine
    if (this.analytics) {
      await this.analytics.writeDataPoint({
      blobs: [
        'multipart_upload',
        uploadId,
        fileId,
        userId,
        status,
        errorDetails?.category || 'none'
      ],
      doubles: [
        duration,
        totalBytes,
        overallThroughput,
        averagePartSize,
        completedParts,
        failedParts
      ],
      indexes: [userId, fileId, uploadId]
    });
    }
  }

  /**
   * Record user storage metrics
   */
  async recordUserStorageMetrics(userId: string): Promise<void> {
    if (!this.config.enableUserMetrics) {
      return;
    }

    try {
      // Get user's current storage statistics
      const storageStats = await this.db
        .prepare(`
          SELECT 
            COUNT(*) as total_files,
            SUM(file_size) as total_size_bytes,
            COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as daily_uploads
          FROM files 
          WHERE user_id = ?
        `)
        .bind(userId)
        .first();

      // Get daily activity from access logs
      const dailyActivity = await this.db
        .prepare(`
          SELECT 
            action,
            COUNT(*) as count,
            SUM(bytes_transferred) as bytes
          FROM file_access_logs 
          WHERE user_id = ? AND DATE(created_at) = DATE('now')
          GROUP BY action
        `)
        .bind(userId)
        .all();

      // Calculate metrics
      const totalFiles = storageStats?.total_files as number || 0;
      const totalSizeBytes = storageStats?.total_size_bytes as number || 0;
      const dailyUploads = storageStats?.daily_uploads as number || 0;

      let dailyDownloads = 0;
      let dailyDeletes = 0;
      let dailyBandwidthBytes = 0;

      dailyActivity.results.forEach((activity: DatabaseRow) => {
        switch (activity.action) {
          case 'download':
            dailyDownloads = activity.count;
            dailyBandwidthBytes += activity.bytes || 0;
            break;
          case 'delete':
            dailyDeletes = activity.count;
            break;
        }
      });

      // Calculate success rate from recent operations
      const recentOperations = await this.db
        .prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
          FROM file_access_logs 
          WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')
        `)
        .bind(userId)
        .first();

      const successRate = recentOperations?.total ? 
        (recentOperations.successful / recentOperations.total) * 100 : 100;

      // User metrics would be created here if needed

      // Send to Analytics Engine
      if (this.analytics) {
      await this.analytics.writeDataPoint({
        blobs: [
          'user_storage',
          userId,
          'daily_summary'
        ],
        doubles: [
          totalFiles,
          totalSizeBytes,
          dailyUploads,
          dailyDownloads,
          dailyDeletes,
          dailyBandwidthBytes,
          successRate
        ],
        indexes: [userId]
      });
      }

      // Update storage analytics table
      await this.updateDailyStorageAnalytics(userId, {
        totalFiles,
        totalSizeBytes,
        dailyUploads,
        dailyDownloads,
        dailyDeletes,
        dailyBandwidthBytes
      });

    } catch (error) {
      console.error('Failed to record user storage metrics:', error);
    }
  }

  /**
   * Get error category from error message
   */
  categorizeError(error: Error | string): ErrorCategory {
    const errorMessage = typeof error === 'string' ? error : error.message;
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
   * Create a timing wrapper for async operations
   */
  createTimingWrapper<T>(
    operation: StorageOperation,
    fileId: string,
    userId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    operationData: OperationData = {},
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ): (asyncOperation: () => Promise<T>) => Promise<T> {
    return async (asyncOperation: () => Promise<T>): Promise<T> => {
      const startTime = Date.now();
      let success = false;
      let errorCategory: ErrorCategory | undefined;
      let errorMessage: string | undefined;

      try {
        const result = await asyncOperation();
        success = true;
        return result;
      } catch (error) {
        success = false;
        errorCategory = this.categorizeError(error as Error);
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw error;
      } finally {
        const endTime = Date.now();
        
        // Fire and forget - don't block the operation
        this.recordStorageMetric(
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
          operationData,
          context
        ).catch(metricsError => {
          console.error('Failed to record storage metric:', metricsError);
        });
      }
    };
  }

  /**
   * Flush queued metrics
   */
  async flushMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) {
      return;
    }

    const metricsToFlush = this.metricsQueue.splice(0, this.config.batchSize);
    
    try {
      // Send batch to Analytics Engine
      const dataPoints = metricsToFlush.map(metric => ({
        blobs: [
          'storage_operation',
          metric.operation,
          metric.fileId,
          metric.userId,
          metric.success ? 'success' : 'error',
          metric.errorCategory || 'none',
          metric.contentType
        ],
        doubles: [
          metric.duration,
          metric.fileSize,
          metric.throughput || 0,
          metric.operationData.retryCount || 0,
          metric.operationData.bytesTransferred || 0
        ],
        indexes: [metric.userId, metric.fileId, metric.operation]
      }));

      // Analytics Engine supports batch writes
      if (this.analytics) {
        await Promise.all(dataPoints.map(dp => this.analytics!.writeDataPoint(dp)));
      }
    } catch (error) {
      console.error('Failed to flush metrics to Analytics Engine:', error);
      // Re-queue failed metrics (with limit to prevent memory issues)
      if (this.metricsQueue.length < this.config.metricsQueueSize) {
        this.metricsQueue.unshift(...metricsToFlush);
      }
    }
  }

  /**
   * Queue a metric for batch processing
   */
  private async queueMetric(metric: StorageMetrics): Promise<void> {
    if (this.metricsQueue.length >= this.config.metricsQueueSize) {
      // Queue is full, flush immediately
      await this.flushMetrics();
    }

    this.metricsQueue.push(metric);

    // Flush if queue is at batch size
    if (this.metricsQueue.length >= this.config.batchSize) {
      await this.flushMetrics();
    }
  }

  /**
   * Send metric immediately
   */
  private async sendMetric(metric: StorageMetrics): Promise<void> {
    try {
      if (this.analytics) {
      await this.analytics.writeDataPoint({
        blobs: [
          'storage_operation',
          metric.operation,
          metric.fileId,
          metric.userId,
          metric.success ? 'success' : 'error',
          metric.errorCategory || 'none',
          metric.contentType
        ],
        doubles: [
          metric.duration,
          metric.fileSize,
          metric.throughput || 0,
          metric.operationData.retryCount || 0,
          metric.operationData.bytesTransferred || 0
        ],
        indexes: [metric.userId, metric.fileId, metric.operation]
      });
      }
    } catch (error) {
      console.error('Failed to send metric to Analytics Engine:', error);
    }
  }

  /**
   * Update storage analytics in database
   */
  private async updateStorageAnalytics(
    userId: string,
    operation: StorageOperation,
    fileSize: number,
    success: boolean
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Upsert daily analytics
      await this.db
        .prepare(`
          INSERT INTO storage_analytics 
          (user_id, date, total_files, total_size_bytes, uploaded_files, uploaded_size_bytes, 
           deleted_files, deleted_size_bytes, bandwidth_used_bytes, operations_count)
          VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 1)
          ON CONFLICT(user_id, date) DO UPDATE SET
            operations_count = operations_count + 1,
            uploaded_files = uploaded_files + CASE WHEN ? LIKE 'upload%' AND ? = 1 THEN 1 ELSE 0 END,
            uploaded_size_bytes = uploaded_size_bytes + CASE WHEN ? LIKE 'upload%' AND ? = 1 THEN ? ELSE 0 END,
            deleted_files = deleted_files + CASE WHEN ? = 'delete' AND ? = 1 THEN 1 ELSE 0 END,
            deleted_size_bytes = deleted_size_bytes + CASE WHEN ? = 'delete' AND ? = 1 THEN ? ELSE 0 END,
            bandwidth_used_bytes = bandwidth_used_bytes + CASE WHEN ? = 'download' AND ? = 1 THEN ? ELSE 0 END
        `)
        .bind(
          userId, today, 
          operation, success ? 1 : 0, 
          operation, success ? 1 : 0, fileSize,
          operation, success ? 1 : 0,
          operation, success ? 1 : 0, fileSize,
          operation, success ? 1 : 0, fileSize
        )
        .run();
    } catch (error) {
      console.error('Failed to update storage analytics:', error);
    }
  }

  /**
   * Update daily storage analytics
   */
  private async updateDailyStorageAnalytics(
    userId: string,
    metrics: {
      totalFiles: number;
      totalSizeBytes: number;
      dailyUploads: number;
      dailyDownloads: number;
      dailyDeletes: number;
      dailyBandwidthBytes: number;
    }
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.db
        .prepare(`
          INSERT INTO storage_analytics 
          (user_id, date, total_files, total_size_bytes, uploaded_files, 
           deleted_files, bandwidth_used_bytes, operations_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, date) DO UPDATE SET
            total_files = ?,
            total_size_bytes = ?,
            uploaded_files = ?,
            deleted_files = ?,
            bandwidth_used_bytes = ?,
            operations_count = operations_count + 1
        `)
        .bind(
          userId, today, 
          metrics.totalFiles, metrics.totalSizeBytes, 
          metrics.dailyUploads, metrics.dailyDeletes, 
          metrics.dailyBandwidthBytes, 1,
          metrics.totalFiles, metrics.totalSizeBytes,
          metrics.dailyUploads, metrics.dailyDeletes,
          metrics.dailyBandwidthBytes
        )
        .run();
    } catch (error) {
      console.error('Failed to update daily storage analytics:', error);
    }
  }

  /**
   * Start periodic metrics flush
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch(error => {
        console.error('Periodic metrics flush failed:', error);
      });
    }, this.config.flushInterval);
  }

  /**
   * Stop periodic metrics flush
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Check if we should sample this metric
   */
  private shouldSample(samplingRate: number): boolean {
    return Math.random() < samplingRate;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<MetricsConfiguration>): MetricsConfiguration {
    return {
      enableMetrics: config.enableMetrics ?? true,
      enableDetailedMetrics: config.enableDetailedMetrics ?? false,
      enableUserMetrics: config.enableUserMetrics ?? true,
      enableSystemMetrics: config.enableSystemMetrics ?? true,
      successMetricsSamplingRate: config.successMetricsSamplingRate ?? 0.1,
      errorMetricsSamplingRate: config.errorMetricsSamplingRate ?? 1.0,
      detailedMetricsSamplingRate: config.detailedMetricsSamplingRate ?? 0.01,
      rawMetricsRetentionDays: config.rawMetricsRetentionDays ?? 30,
      aggregatedMetricsRetentionDays: config.aggregatedMetricsRetentionDays ?? 365,
      enableAlerts: config.enableAlerts ?? true,
      alertThresholds: config.alertThresholds ?? {
        maxResponseTime: 5000,
        maxErrorRate: 0.05,
        maxQueueDepth: 1000,
        maxStorageUsage: 0.9,
        maxDailyBandwidth: 10 * 1024 * 1024 * 1024,
        maxFilesPerUser: 10000,
        maxConcurrentUploads: 10,
        maxFailedOperationsPerMinute: 100,
        customThresholds: {}
      },
      analyticsDataset: config.analyticsDataset ?? 'storage_metrics',
      batchSize: config.batchSize ?? 50,
      flushInterval: config.flushInterval ?? 30000,
      asyncMetrics: config.asyncMetrics ?? true,
      metricsQueueSize: config.metricsQueueSize ?? 1000,
      customDimensions: config.customDimensions ?? [],
      customMetrics: config.customMetrics ?? []
    };
  }

  /**
   * Cleanup method to flush remaining metrics
   */
  async cleanup(): Promise<void> {
    this.stopPeriodicFlush();
    await this.flushMetrics();
  }
}

// Type definitions
interface DatabaseRow {
  [key: string]: unknown;
}