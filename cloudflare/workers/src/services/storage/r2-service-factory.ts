import { R2StorageService } from './r2-service.js';
import { MetricsService } from '../monitoring/metrics-service.js';
import { UsageTracker } from '../monitoring/usage-tracker.js';
import { MetricsConfiguration } from '../../types/metrics.js';
import { CloudflareEnv } from '../../types/env.js';

/**
 * Enhanced R2 storage service factory with comprehensive monitoring
 */
export class EnhancedR2ServiceFactory {
  private static instance: EnhancedR2Service | null = null;

  /**
   * Create or get singleton instance of enhanced R2 service
   */
  static getInstance(env: CloudflareEnv, config?: Partial<MetricsConfiguration>): EnhancedR2Service {
    if (!this.instance) {
      this.instance = new EnhancedR2Service(env, config);
    }
    return this.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    this.instance = null;
  }
}

/**
 * Enhanced R2 storage service with comprehensive monitoring and metrics
 */
export class EnhancedR2Service {
  private r2Service: R2StorageService;
  private metricsService: MetricsService;
  private usageTracker: UsageTracker;
  private env: CloudflareEnv;

  constructor(env: CloudflareEnv, config?: Partial<MetricsConfiguration>) {
    this.env = env;
    
    // Initialize metrics service
    this.metricsService = new MetricsService(env.ANALYTICS, env.DB, config);
    
    // Initialize usage tracker
    this.usageTracker = new UsageTracker(env.DB, this.metricsService, env.ANALYTICS);
    
    // Initialize R2 service with metrics
    this.r2Service = new R2StorageService(env.FILE_STORAGE, env.DB, this.metricsService);
  }

  /**
   * Upload file with comprehensive monitoring
   */
  async uploadFile(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    options: {
      userId: string;
      fileId: string;
      fileName: string;
      contentType: string;
      metadata?: Record<string, string>;
      storageClass?: 'Standard' | 'InfrequentAccess';
    },
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ) {
    const startTime = Date.now();
    
    try {
      // Upload file using R2 service
      const result = await this.r2Service.uploadFile(fileData, options, context);
      
      // Track usage impact
      await this.usageTracker.trackFileUpload(
        options.userId,
        options.fileId,
        options.fileName,
        result.size,
        options.contentType,
        true
      );
      
      // Update user metrics
      await this.r2Service.updateUserMetrics(options.userId);
      
      return result;
    } catch (error) {
      // Track failed upload
      const fileSize = this.estimateFileSize(fileData);
      await this.usageTracker.trackFileUpload(
        options.userId,
        options.fileId,
        options.fileName,
        fileSize,
        options.contentType,
        false
      );
      
      throw error;
    }
  }

  /**
   * Download file with comprehensive monitoring
   */
  async downloadFile(
    fileId: string,
    userId: string,
    options: { range?: string } = {},
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ) {
    try {
      // Get file metadata first
      const fileMetadata = await this.r2Service.getFileMetadata(fileId, userId, context);
      
      // Download file using R2 service
      const result = await this.r2Service.downloadFile(fileId, userId, options, context);
      
      if (result) {
        // Track usage impact
        await this.usageTracker.trackFileDownload(
          userId,
          fileId,
          fileMetadata.filename,
          result.size,
          fileMetadata.mime_type,
          true,
          !!options.range
        );
      }
      
      return result;
    } catch (error) {
      // Track failed download
      try {
        const fileMetadata = await this.r2Service.getFileMetadata(fileId, userId, context);
        await this.usageTracker.trackFileDownload(
          userId,
          fileId,
          fileMetadata.filename,
          fileMetadata.file_size,
          fileMetadata.mime_type,
          false,
          !!options.range
        );
      } catch (metaError) {
        // If we can't get metadata, still track with minimal info
        await this.usageTracker.trackFileDownload(
          userId,
          fileId,
          'unknown',
          0,
          'application/octet-stream',
          false,
          !!options.range
        );
      }
      
      throw error;
    }
  }

  /**
   * Delete file with comprehensive monitoring
   */
  async deleteFile(
    fileId: string,
    userId: string,
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ) {
    try {
      // Get file metadata first
      const fileMetadata = await this.r2Service.getFileMetadata(fileId, userId, context);
      
      // Delete file using R2 service
      const result = await this.r2Service.deleteFile(fileId, userId, context);
      
      if (result) {
        // Track usage impact
        await this.usageTracker.trackFileDelete(
          userId,
          fileId,
          fileMetadata.filename,
          fileMetadata.file_size,
          fileMetadata.mime_type,
          true
        );
        
        // Update user metrics
        await this.r2Service.updateUserMetrics(userId);
      }
      
      return result;
    } catch (error) {
      // Track failed deletion
      try {
        const fileMetadata = await this.r2Service.getFileMetadata(fileId, userId, context);
        await this.usageTracker.trackFileDelete(
          userId,
          fileId,
          fileMetadata.filename,
          fileMetadata.file_size,
          fileMetadata.mime_type,
          false
        );
      } catch (metaError) {
        // If we can't get metadata, still track with minimal info
        await this.usageTracker.trackFileDelete(
          userId,
          fileId,
          'unknown',
          0,
          'application/octet-stream',
          false
        );
      }
      
      throw error;
    }
  }

  /**
   * List files with monitoring
   */
  async listFiles(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ) {
    return await this.r2Service.listFiles(userId, options, context);
  }

  /**
   * Get file metadata with monitoring
   */
  async getFileMetadata(
    fileId: string,
    userId: string,
    context: {
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
      region?: string;
    } = {}
  ) {
    return await this.r2Service.getFileMetadata(fileId, userId, context);
  }

  /**
   * Get user storage usage
   */
  async getUserStorageUsage(userId: string) {
    return await this.usageTracker.getUserStorageUsage(userId);
  }

  /**
   * Get user storage analytics
   */
  async getUserStorageAnalytics(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      granularity?: 'day' | 'week' | 'month';
    } = {}
  ) {
    try {
      const { startDate, endDate, granularity = 'day' } = options;
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      const analytics = await this.env.DB
        .prepare(`
          SELECT 
            date,
            total_files,
            total_size_bytes,
            uploaded_files,
            uploaded_size_bytes,
            deleted_files,
            deleted_size_bytes,
            bandwidth_used_bytes,
            operations_count,
            metadata
          FROM storage_analytics 
          WHERE user_id = ? 
          AND date >= ? 
          AND date <= ?
          ORDER BY date ASC
        `)
        .bind(userId, start, end)
        .all();

      return {
        userId,
        period: { start, end, granularity },
        analytics: analytics.results,
        summary: this.calculateAnalyticsSummary(analytics.results)
      };
    } catch (error) {
      console.error('Failed to get user storage analytics:', error);
      throw error;
    }
  }

  /**
   * Get system-wide storage metrics
   */
  async getSystemStorageMetrics() {
    try {
      const systemStats = await this.env.DB
        .prepare(`
          SELECT 
            COUNT(DISTINCT user_id) as total_users,
            COUNT(*) as total_files,
            SUM(file_size) as total_storage_bytes,
            COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as daily_uploads,
            AVG(file_size) as average_file_size
          FROM files 
          WHERE upload_status = 'completed'
        `)
        .first();

      const dailyActivity = await this.env.DB
        .prepare(`
          SELECT 
            action,
            COUNT(*) as count,
            SUM(bytes_transferred) as bytes,
            AVG(duration_ms) as avg_duration,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_ops
          FROM file_access_logs 
          WHERE DATE(created_at) = DATE('now')
          GROUP BY action
        `)
        .all();

      return {
        timestamp: Date.now(),
        totalUsers: systemStats?.total_users || 0,
        totalFiles: systemStats?.total_files || 0,
        totalStorageBytes: systemStats?.total_storage_bytes || 0,
        dailyUploads: systemStats?.daily_uploads || 0,
        averageFileSize: systemStats?.average_file_size || 0,
        dailyActivity: dailyActivity.results,
        healthStatus: this.calculateHealthStatus(dailyActivity.results)
      };
    } catch (error) {
      console.error('Failed to get system storage metrics:', error);
      throw error;
    }
  }

  /**
   * Flush all pending metrics
   */
  async flushMetrics() {
    await this.metricsService.flushMetrics();
  }

  /**
   * Clear user usage cache
   */
  clearUserCache(userId: string) {
    this.usageTracker.clearUserCache(userId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.usageTracker.getCacheStats();
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup() {
    await this.r2Service.cleanup();
    this.usageTracker.clearAllCache();
  }

  /**
   * Estimate file size from data
   */
  private estimateFileSize(fileData: ArrayBuffer | ReadableStream | Uint8Array): number {
    if (fileData instanceof ArrayBuffer) {
      return fileData.byteLength;
    } else if (fileData instanceof Uint8Array) {
      return fileData.byteLength;
    } else {
      return 0; // Unknown size for ReadableStream
    }
  }

  /**
   * Calculate analytics summary
   */
  private calculateAnalyticsSummary(analytics: any[]): any {
    if (analytics.length === 0) {
      return {
        totalOperations: 0,
        totalUploads: 0,
        totalDeletes: 0,
        totalBandwidth: 0,
        averageFileSize: 0,
        growthRate: 0
      };
    }

    const summary = analytics.reduce((acc, item) => {
      acc.totalOperations += item.operations_count || 0;
      acc.totalUploads += item.uploaded_files || 0;
      acc.totalDeletes += item.deleted_files || 0;
      acc.totalBandwidth += item.bandwidth_used_bytes || 0;
      return acc;
    }, {
      totalOperations: 0,
      totalUploads: 0,
      totalDeletes: 0,
      totalBandwidth: 0
    });

    const firstDay = analytics[0];
    const lastDay = analytics[analytics.length - 1];
    const growthRate = firstDay.total_size_bytes > 0 ? 
      ((lastDay.total_size_bytes - firstDay.total_size_bytes) / firstDay.total_size_bytes) * 100 : 0;

    return {
      ...summary,
      averageFileSize: summary.totalUploads > 0 ? 
        lastDay.total_size_bytes / lastDay.total_files : 0,
      growthRate
    };
  }

  /**
   * Calculate system health status
   */
  private calculateHealthStatus(dailyActivity: any[]): 'healthy' | 'warning' | 'critical' {
    const totalOps = dailyActivity.reduce((sum, activity) => sum + activity.count, 0);
    const successfulOps = dailyActivity.reduce((sum, activity) => sum + activity.successful_ops, 0);
    
    if (totalOps === 0) return 'healthy';
    
    const successRate = successfulOps / totalOps;
    
    if (successRate >= 0.98) return 'healthy';
    if (successRate >= 0.95) return 'warning';
    return 'critical';
  }
}