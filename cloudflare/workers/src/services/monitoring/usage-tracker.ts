import { MetricsService } from './metrics-service.js';
import { UserStorageMetrics } from '../../types/metrics.js';

/**
 * Real-time storage usage tracking service
 */
export class UsageTracker {
  private db: D1Database;
  private metricsService: MetricsService;
  private analytics: AnalyticsEngineDataset;
  private usageCache: Map<string, UserStorageMetrics> = new Map();
  private cacheExpirationTime = 5 * 60 * 1000; // 5 minutes

  constructor(db: D1Database, metricsService: MetricsService, analytics: AnalyticsEngineDataset) {
    this.db = db;
    this.metricsService = metricsService;
    this.analytics = analytics;
  }

  /**
   * Track file upload impact on user storage
   */
  async trackFileUpload(
    userId: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    success: boolean
  ): Promise<void> {
    if (!success) {
      return;
    }

    try {
      // Update real-time cache
      const currentUsage = await this.getUserStorageUsage(userId);
      if (currentUsage) {
        currentUsage.totalFiles += 1;
        currentUsage.totalSizeBytes += fileSize;
        currentUsage.dailyUploads += 1;
        currentUsage.quotaUsagePercentage = this.calculateQuotaUsage(currentUsage.totalSizeBytes);
        
        this.usageCache.set(userId, currentUsage);
      }

      // Send usage metric to Analytics Engine
      await this.analytics.writeDataPoint({
        blobs: [
          'storage_usage',
          userId,
          'file_uploaded',
          contentType,
          this.getFileCategory(fileName)
        ],
        doubles: [
          fileSize,
          currentUsage?.totalSizeBytes || 0,
          currentUsage?.totalFiles || 0,
          currentUsage?.quotaUsagePercentage || 0
        ],
        indexes: [userId, fileId]
      });

      // Update database analytics
      await this.updateDatabaseUsage(userId, 'upload', fileSize);

      // Check for quota warnings
      await this.checkQuotaWarnings(userId, currentUsage);

    } catch (error) {
      console.error('Failed to track file upload:', error);
    }
  }

  /**
   * Track file download impact on user bandwidth
   */
  async trackFileDownload(
    userId: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    success: boolean,
    isRangeRequest: boolean = false
  ): Promise<void> {
    if (!success) {
      return;
    }

    try {
      // Update real-time cache
      const currentUsage = await this.getUserStorageUsage(userId);
      if (currentUsage) {
        currentUsage.dailyDownloads += 1;
        currentUsage.dailyBandwidthBytes += fileSize;
        this.usageCache.set(userId, currentUsage);
      }

      // Send usage metric to Analytics Engine
      await this.analytics.writeDataPoint({
        blobs: [
          'storage_usage',
          userId,
          'file_downloaded',
          contentType,
          this.getFileCategory(fileName),
          isRangeRequest ? 'range' : 'full'
        ],
        doubles: [
          fileSize,
          currentUsage?.dailyBandwidthBytes || 0,
          currentUsage?.dailyDownloads || 0
        ],
        indexes: [userId, fileId]
      });

      // Update database analytics
      await this.updateDatabaseUsage(userId, 'download', fileSize);

    } catch (error) {
      console.error('Failed to track file download:', error);
    }
  }

  /**
   * Track file deletion impact on user storage
   */
  async trackFileDelete(
    userId: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    success: boolean
  ): Promise<void> {
    if (!success) {
      return;
    }

    try {
      // Update real-time cache
      const currentUsage = await this.getUserStorageUsage(userId);
      if (currentUsage) {
        currentUsage.totalFiles -= 1;
        currentUsage.totalSizeBytes -= fileSize;
        currentUsage.dailyDeletes += 1;
        currentUsage.quotaUsagePercentage = this.calculateQuotaUsage(currentUsage.totalSizeBytes);
        
        this.usageCache.set(userId, currentUsage);
      }

      // Send usage metric to Analytics Engine
      await this.analytics.writeDataPoint({
        blobs: [
          'storage_usage',
          userId,
          'file_deleted',
          contentType,
          this.getFileCategory(fileName)
        ],
        doubles: [
          fileSize,
          currentUsage?.totalSizeBytes || 0,
          currentUsage?.totalFiles || 0,
          currentUsage?.quotaUsagePercentage || 0
        ],
        indexes: [userId, fileId]
      });

      // Update database analytics
      await this.updateDatabaseUsage(userId, 'delete', fileSize);

    } catch (error) {
      console.error('Failed to track file delete:', error);
    }
  }

  /**
   * Get current user storage usage (with caching)
   */
  async getUserStorageUsage(userId: string): Promise<UserStorageMetrics | null> {
    // Check cache first
    const cached = this.usageCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpirationTime) {
      return cached;
    }

    try {
      // Get fresh data from database
      const storageStats = await this.db
        .prepare(`
          SELECT 
            COUNT(*) as total_files,
            SUM(file_size) as total_size_bytes,
            COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as daily_uploads
          FROM files 
          WHERE user_id = ? AND upload_status = 'completed'
        `)
        .bind(userId)
        .first();

      // Get daily activity
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

      dailyActivity.results.forEach((activity: any) => {
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

      // Get storage breakdown by file type
      const storageByType = await this.getStorageByType(userId);
      const storageByClass = await this.getStorageByClass(userId);

      // Calculate performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(userId);

      // Calculate growth metrics
      const growthMetrics = await this.getGrowthMetrics(userId);

      const usage: UserStorageMetrics = {
        userId,
        timestamp: Date.now(),
        totalFiles,
        totalSizeBytes,
        quotaUsagePercentage: this.calculateQuotaUsage(totalSizeBytes),
        dailyUploads,
        dailyDownloads,
        dailyDeletes,
        dailyBandwidthBytes,
        averageUploadSpeed: performanceMetrics.averageUploadSpeed,
        averageDownloadSpeed: performanceMetrics.averageDownloadSpeed,
        successRate: performanceMetrics.successRate,
        storageByType,
        storageByClass,
        weeklyGrowth: growthMetrics.weeklyGrowth,
        monthlyGrowth: growthMetrics.monthlyGrowth
      };

      // Cache the result
      this.usageCache.set(userId, usage);

      return usage;

    } catch (error) {
      console.error('Failed to get user storage usage:', error);
      return null;
    }
  }

  /**
   * Get storage breakdown by file type
   */
  private async getStorageByType(userId: string): Promise<Record<string, number>> {
    try {
      const typeStats = await this.db
        .prepare(`
          SELECT 
            mime_type,
            SUM(file_size) as total_size
          FROM files 
          WHERE user_id = ? AND upload_status = 'completed'
          GROUP BY mime_type
        `)
        .bind(userId)
        .all();

      const storageByType: Record<string, number> = {};
      typeStats.results.forEach((stat: any) => {
        const category = this.getFileCategory(stat.mime_type);
        storageByType[category] = (storageByType[category] || 0) + stat.total_size;
      });

      return storageByType;
    } catch (error) {
      console.error('Failed to get storage by type:', error);
      return {};
    }
  }

  /**
   * Get storage breakdown by storage class
   */
  private async getStorageByClass(userId: string): Promise<Record<string, number>> {
    try {
      const classStats = await this.db
        .prepare(`
          SELECT 
            storage_class,
            SUM(file_size) as total_size
          FROM files 
          WHERE user_id = ? AND upload_status = 'completed'
          GROUP BY storage_class
        `)
        .bind(userId)
        .all();

      const storageByClass: Record<string, number> = {};
      classStats.results.forEach((stat: any) => {
        storageByClass[stat.storage_class || 'Standard'] = stat.total_size;
      });

      return storageByClass;
    } catch (error) {
      console.error('Failed to get storage by class:', error);
      return {};
    }
  }

  /**
   * Get performance metrics for user
   */
  private async getPerformanceMetrics(userId: string): Promise<{
    averageUploadSpeed: number;
    averageDownloadSpeed: number;
    successRate: number;
  }> {
    try {
      // Get recent operation performance
      const recentOps = await this.db
        .prepare(`
          SELECT 
            action,
            AVG(CASE WHEN duration_ms > 0 AND bytes_transferred > 0 
                THEN (bytes_transferred * 1000.0 / duration_ms) 
                ELSE 0 END) as avg_speed,
            COUNT(*) as total_ops,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_ops
          FROM file_access_logs 
          WHERE user_id = ? 
          AND created_at >= datetime('now', '-7 days')
          AND duration_ms > 0
          GROUP BY action
        `)
        .bind(userId)
        .all();

      let averageUploadSpeed = 0;
      let averageDownloadSpeed = 0;
      let totalOps = 0;
      let successfulOps = 0;

      recentOps.results.forEach((op: any) => {
        totalOps += op.total_ops;
        successfulOps += op.successful_ops;
        
        if (op.action === 'upload') {
          averageUploadSpeed = op.avg_speed || 0;
        } else if (op.action === 'download') {
          averageDownloadSpeed = op.avg_speed || 0;
        }
      });

      const successRate = totalOps > 0 ? (successfulOps / totalOps) * 100 : 100;

      return {
        averageUploadSpeed,
        averageDownloadSpeed,
        successRate
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return {
        averageUploadSpeed: 0,
        averageDownloadSpeed: 0,
        successRate: 100
      };
    }
  }

  /**
   * Get growth metrics for user
   */
  private async getGrowthMetrics(userId: string): Promise<{
    weeklyGrowth: number;
    monthlyGrowth: number;
  }> {
    try {
      // Get storage growth over time
      const growthStats = await this.db
        .prepare(`
          SELECT 
            SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN file_size ELSE 0 END) as weekly_added,
            SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN file_size ELSE 0 END) as monthly_added,
            SUM(CASE WHEN created_at < datetime('now', '-7 days') THEN file_size ELSE 0 END) as previous_size
          FROM files 
          WHERE user_id = ? AND upload_status = 'completed'
        `)
        .bind(userId)
        .first();

      const weeklyAdded = growthStats?.weekly_added as number || 0;
      const monthlyAdded = growthStats?.monthly_added as number || 0;
      const previousSize = growthStats?.previous_size as number || 0;

      const weeklyGrowth = previousSize > 0 ? (weeklyAdded / previousSize) * 100 : 0;
      const monthlyGrowth = previousSize > 0 ? (monthlyAdded / previousSize) * 100 : 0;

      return {
        weeklyGrowth,
        monthlyGrowth
      };
    } catch (error) {
      console.error('Failed to get growth metrics:', error);
      return {
        weeklyGrowth: 0,
        monthlyGrowth: 0
      };
    }
  }

  /**
   * Update database usage analytics
   */
  private async updateDatabaseUsage(userId: string, action: string, fileSize: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await this.db
        .prepare(`
          INSERT INTO storage_analytics 
          (user_id, date, operations_count, 
           uploaded_files, uploaded_size_bytes, 
           deleted_files, deleted_size_bytes, 
           bandwidth_used_bytes)
          VALUES (?, ?, 1, 
                  CASE WHEN ? LIKE 'upload%' THEN 1 ELSE 0 END, 
                  CASE WHEN ? LIKE 'upload%' THEN ? ELSE 0 END,
                  CASE WHEN ? = 'delete' THEN 1 ELSE 0 END,
                  CASE WHEN ? = 'delete' THEN ? ELSE 0 END,
                  CASE WHEN ? = 'download' THEN ? ELSE 0 END)
          ON CONFLICT(user_id, date) DO UPDATE SET
            operations_count = operations_count + 1,
            uploaded_files = uploaded_files + CASE WHEN ? LIKE 'upload%' THEN 1 ELSE 0 END,
            uploaded_size_bytes = uploaded_size_bytes + CASE WHEN ? LIKE 'upload%' THEN ? ELSE 0 END,
            deleted_files = deleted_files + CASE WHEN ? = 'delete' THEN 1 ELSE 0 END,
            deleted_size_bytes = deleted_size_bytes + CASE WHEN ? = 'delete' THEN ? ELSE 0 END,
            bandwidth_used_bytes = bandwidth_used_bytes + CASE WHEN ? = 'download' THEN ? ELSE 0 END
        `)
        .bind(
          userId, today, 
          action, action, fileSize,
          action, action, fileSize,
          action, fileSize,
          action, action, fileSize,
          action, action, fileSize,
          action, fileSize
        )
        .run();
    } catch (error) {
      console.error('Failed to update database usage:', error);
    }
  }

  /**
   * Check for quota warnings and send alerts
   */
  private async checkQuotaWarnings(userId: string, usage: UserStorageMetrics | null): Promise<void> {
    if (!usage) return;

    const warningThresholds = [90, 95, 98]; // Percentage thresholds

    for (const threshold of warningThresholds) {
      if (usage.quotaUsagePercentage >= threshold) {
        await this.sendQuotaWarning(userId, usage.quotaUsagePercentage, threshold);
        break; // Only send the highest threshold warning
      }
    }
  }

  /**
   * Send quota warning
   */
  private async sendQuotaWarning(userId: string, currentUsage: number, threshold: number): Promise<void> {
    try {
      // Log warning in database
      await this.db
        .prepare(`
          INSERT INTO audit_logs 
          (user_id, action, resource_type, resource_id, metadata)
          VALUES (?, 'quota_warning', 'user', ?, ?)
        `)
        .bind(
          userId, 
          userId,
          JSON.stringify({
            current_usage_percentage: currentUsage,
            warning_threshold: threshold,
            timestamp: Date.now()
          })
        )
        .run();

      // Send metric to Analytics Engine
      await this.analytics.writeDataPoint({
        blobs: [
          'quota_warning',
          userId,
          `threshold_${threshold}`,
          'storage_limit'
        ],
        doubles: [
          currentUsage,
          threshold
        ],
        indexes: [userId]
      });

    } catch (error) {
      console.error('Failed to send quota warning:', error);
    }
  }

  /**
   * Calculate quota usage percentage
   */
  private calculateQuotaUsage(totalSizeBytes: number): number {
    const quotaSize = 5 * 1024 * 1024 * 1024; // 5GB default quota
    return Math.min((totalSizeBytes / quotaSize) * 100, 100);
  }

  /**
   * Get file category from filename or mime type
   */
  private getFileCategory(identifier: string): string {
    const lower = identifier.toLowerCase();
    
    if (lower.includes('image/') || lower.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
      return 'image';
    }
    if (lower.includes('video/') || lower.match(/\.(mp4|avi|mov|wmv|flv|mkv|webm)$/)) {
      return 'video';
    }
    if (lower.includes('audio/') || lower.match(/\.(mp3|wav|ogg|flac|aac|wma)$/)) {
      return 'audio';
    }
    if (lower.includes('text/') || lower.match(/\.(txt|md|json|xml|html|css|js|ts|py|java|cpp|c|php)$/)) {
      return 'text';
    }
    if (lower.includes('csv') || lower.match(/\.(csv|tsv)$/)) {
      return 'csv';
    }
    if (lower.includes('spreadsheet') || lower.match(/\.(xlsx|xls|ods)$/)) {
      return 'spreadsheet';
    }
    if (lower.includes('pdf') || lower.match(/\.pdf$/)) {
      return 'pdf';
    }
    if (lower.includes('zip') || lower.match(/\.(zip|rar|7z|tar|gz|bz2)$/)) {
      return 'archive';
    }
    
    return 'other';
  }

  /**
   * Clear cache for user
   */
  clearUserCache(userId: string): void {
    this.usageCache.delete(userId);
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    this.usageCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    totalMemoryUsage: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.usageCache.values());
    const totalEntries = entries.length;
    const totalMemoryUsage = entries.reduce((sum, entry) => sum + JSON.stringify(entry).length, 0);
    const timestamps = entries.map(entry => entry.timestamp);
    
    return {
      totalEntries,
      totalMemoryUsage,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps)
    };
  }
}