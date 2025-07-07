/**
 * Quota Analytics and Reporting Service
 * Provides comprehensive analytics and reporting for quota usage patterns
 */

import {
  QuotaAnalytics,
  QuotaReport,
  QuotaAlert,
  QuotaRecommendation,
  TimeSeriesData,
  FileUsageData,
  QuotaExceededEvent,
  QuotaType,
  QuotaOperationType,
  QuotaAlertType
} from '../../types/quota.js';

export interface AnalyticsOptions {
  db: D1Database;
  retentionDays?: number;
  aggregationIntervals?: {
    hourly: boolean;
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
  };
}

export interface UsagePattern {
  type: 'growth' | 'spike' | 'decline' | 'stable';
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
  detectedAt: Date;
  affectedQuotas: QuotaType[];
}

export interface QuotaForecast {
  quotaType: QuotaType;
  currentUsage: number;
  predictedUsage: number;
  timeframe: string;
  confidence: number;
  willExceedQuota: boolean;
  estimatedExceedDate?: Date;
}

export class QuotaAnalyticsService {
  private db: D1Database;
  private retentionDays: number;
  private aggregationIntervals: any;

  constructor(options: AnalyticsOptions) {
    this.db = options.db;
    this.retentionDays = options.retentionDays || 90;
    this.aggregationIntervals = options.aggregationIntervals || {
      hourly: true,
      daily: true,
      weekly: true,
      monthly: true
    };
  }

  /**
   * Get comprehensive quota analytics for a user
   */
  async getUserQuotaAnalytics(
    userId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    daysBack: number = 30
  ): Promise<QuotaAnalytics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Get time series data
    const timeSeriesData = await this.getTimeSeriesData(userId, startDate, endDate, period);
    
    // Get top files by size
    const topFiles = await this.getTopFilesBySize(userId, 10);
    
    // Get quota exceeded events
    const exceededEvents = await this.getQuotaExceededEvents(userId, startDate, endDate);

    return {
      userId,
      period,
      storageUsage: timeSeriesData.storage,
      fileCountUsage: timeSeriesData.fileCount,
      bandwidthUsage: timeSeriesData.bandwidth,
      requestsUsage: timeSeriesData.requests,
      topFilesBySize: topFiles,
      quotaExceededEvents: exceededEvents
    };
  }

  /**
   * Generate detailed quota report
   */
  async generateQuotaReport(
    userId: string,
    reportType: 'summary' | 'detailed' | 'trends',
    period: { start: Date; end: Date }
  ): Promise<QuotaReport> {
    // Get user's current quota information
    const userQuota = await this.getUserQuotaInfo(userId);
    
    // Calculate summary statistics
    const summary = await this.calculateSummaryStats(userId, period);
    
    // Calculate trends if needed
    let trends = { storageGrowth: 0, fileGrowth: 0, bandwidthGrowth: 0, requestGrowth: 0 };
    if (reportType === 'trends' || reportType === 'detailed') {
      trends = await this.calculateTrends(userId, period);
    }

    // Generate recommendations
    const recommendations = await this.generateRecommendations(userId, userQuota, trends, summary);

    return {
      userId,
      reportType,
      period,
      summary: {
        totalStorage: summary.totalStorage,
        totalFiles: summary.totalFiles,
        totalBandwidth: summary.totalBandwidth,
        totalRequests: summary.totalRequests,
        quotaUtilization: summary.quotaUtilization
      },
      trends,
      recommendations,
      generatedAt: new Date()
    };
  }

  /**
   * Detect usage patterns and anomalies
   */
  async detectUsagePatterns(userId: string, daysBack: number = 7): Promise<UsagePattern[]> {
    const patterns: UsagePattern[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Get daily usage data
    const dailyData = await this.db.prepare(`
      SELECT 
        date,
        storage_used,
        file_count,
        bandwidth_used,
        total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]).all();

    if (dailyData.results.length < 3) {
      return patterns;
    }

    // Analyze storage growth pattern
    const storagePattern = this.analyzeGrowthPattern(
      dailyData.results.map(row => row.storage_used as number),
      'storage'
    );
    if (storagePattern) patterns.push(storagePattern);

    // Analyze file count pattern
    const filePattern = this.analyzeGrowthPattern(
      dailyData.results.map(row => row.file_count as number),
      'file_count'
    );
    if (filePattern) patterns.push(filePattern);

    // Analyze bandwidth spikes
    const bandwidthPattern = this.analyzeSpikePattern(
      dailyData.results.map(row => row.bandwidth_used as number),
      'bandwidth'
    );
    if (bandwidthPattern) patterns.push(bandwidthPattern);

    // Analyze request patterns
    const requestPattern = this.analyzeSpikePattern(
      dailyData.results.map(row => row.total_requests as number),
      'requests'
    );
    if (requestPattern) patterns.push(requestPattern);

    return patterns;
  }

  /**
   * Forecast quota usage based on historical data
   */
  async forecastQuotaUsage(userId: string, forecastDays: number = 30): Promise<QuotaForecast[]> {
    const forecasts: QuotaForecast[] = [];
    
    // Get historical data for the last 30 days
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const historicalData = await this.db.prepare(`
      SELECT 
        date,
        storage_used,
        file_count,
        bandwidth_used,
        total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]).all();

    if (historicalData.results.length < 7) {
      return forecasts;
    }

    // Get user's current quota limits
    const userQuota = await this.getUserQuotaInfo(userId);

    // Forecast storage usage
    const storageForecast = this.calculateLinearForecast(
      historicalData.results.map(row => row.storage_used as number),
      forecastDays,
      userQuota.storageLimit,
      QuotaType.STORAGE
    );
    forecasts.push(storageForecast);

    // Forecast file count
    const fileForecast = this.calculateLinearForecast(
      historicalData.results.map(row => row.file_count as number),
      forecastDays,
      userQuota.fileCountLimit,
      QuotaType.FILE_COUNT
    );
    forecasts.push(fileForecast);

    // Forecast bandwidth (monthly)
    const bandwidthForecast = this.calculateLinearForecast(
      historicalData.results.map(row => row.bandwidth_used as number),
      forecastDays,
      userQuota.bandwidthLimit,
      QuotaType.BANDWIDTH
    );
    forecasts.push(bandwidthForecast);

    return forecasts;
  }

  /**
   * Get quota usage trends comparison
   */
  async getUsageTrendsComparison(
    userId: string,
    currentPeriod: { start: Date; end: Date },
    comparisonPeriod: { start: Date; end: Date }
  ): Promise<{
    current: any;
    comparison: any;
    changes: {
      storage: { value: number; percentage: number };
      files: { value: number; percentage: number };
      bandwidth: { value: number; percentage: number };
      requests: { value: number; percentage: number };
    };
  }> {
    const currentStats = await this.calculateSummaryStats(userId, currentPeriod);
    const comparisonStats = await this.calculateSummaryStats(userId, comparisonPeriod);

    const changes = {
      storage: {
        value: currentStats.totalStorage - comparisonStats.totalStorage,
        percentage: ((currentStats.totalStorage - comparisonStats.totalStorage) / comparisonStats.totalStorage) * 100
      },
      files: {
        value: currentStats.totalFiles - comparisonStats.totalFiles,
        percentage: ((currentStats.totalFiles - comparisonStats.totalFiles) / comparisonStats.totalFiles) * 100
      },
      bandwidth: {
        value: currentStats.totalBandwidth - comparisonStats.totalBandwidth,
        percentage: ((currentStats.totalBandwidth - comparisonStats.totalBandwidth) / comparisonStats.totalBandwidth) * 100
      },
      requests: {
        value: currentStats.totalRequests - comparisonStats.totalRequests,
        percentage: ((currentStats.totalRequests - comparisonStats.totalRequests) / comparisonStats.totalRequests) * 100
      }
    };

    return {
      current: currentStats,
      comparison: comparisonStats,
      changes
    };
  }

  /**
   * Export analytics data for external analysis
   */
  async exportAnalyticsData(
    userId: string,
    format: 'json' | 'csv',
    period: { start: Date; end: Date },
    includeRawEvents: boolean = false
  ): Promise<string> {
    const data: any = {
      userId,
      period,
      exportedAt: new Date().toISOString(),
      summary: await this.calculateSummaryStats(userId, period),
      dailyStats: [],
      quotaEvents: [],
      usageHistory: []
    };

    // Get daily aggregated stats
    data.dailyStats = await this.db.prepare(`
      SELECT * FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]).all();

    // Get quota exceeded events
    data.quotaEvents = await this.db.prepare(`
      SELECT * FROM quota_exceeded_events
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at ASC
    `).bind(userId, period.start.toISOString(), period.end.toISOString()).all();

    // Get raw usage history if requested
    if (includeRawEvents) {
      data.usageHistory = await this.db.prepare(`
        SELECT * FROM quota_usage_history
        WHERE user_id = ? AND created_at >= ? AND created_at <= ?
        ORDER BY created_at ASC
      `).bind(userId, period.start.toISOString(), period.end.toISOString()).all();
    }

    if (format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Aggregate quota usage data for performance
   */
  async aggregateQuotaUsage(targetDate?: Date): Promise<void> {
    const date = targetDate || new Date();
    const dateStr = date.toISOString().split('T')[0];

    // Aggregate daily statistics for all users
    await this.db.prepare(`
      INSERT OR REPLACE INTO quota_analytics_daily (
        user_id, date, storage_used, file_count, bandwidth_used, total_requests,
        upload_count, download_count, delete_count, quota_exceeded_count, tier_id
      )
      SELECT 
        uq.user_id,
        ? as date,
        uq.storage_used,
        uq.file_count,
        uq.bandwidth_used,
        (uq.requests_this_day) as total_requests,
        COALESCE(upload_stats.upload_count, 0) as upload_count,
        COALESCE(download_stats.download_count, 0) as download_count,
        COALESCE(delete_stats.delete_count, 0) as delete_count,
        COALESCE(exceeded_stats.exceeded_count, 0) as quota_exceeded_count,
        uq.tier_id
      FROM user_quotas uq
      LEFT JOIN (
        SELECT user_id, COUNT(*) as upload_count
        FROM quota_usage_history
        WHERE DATE(created_at) = ? AND operation_type = 'upload'
        GROUP BY user_id
      ) upload_stats ON uq.user_id = upload_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as download_count
        FROM quota_usage_history
        WHERE DATE(created_at) = ? AND operation_type = 'download'
        GROUP BY user_id
      ) download_stats ON uq.user_id = download_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as delete_count
        FROM quota_usage_history
        WHERE DATE(created_at) = ? AND operation_type = 'delete'
        GROUP BY user_id
      ) delete_stats ON uq.user_id = delete_stats.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as exceeded_count
        FROM quota_exceeded_events
        WHERE DATE(created_at) = ?
        GROUP BY user_id
      ) exceeded_stats ON uq.user_id = exceeded_stats.user_id
      WHERE uq.is_active = 1
    `).bind(dateStr, dateStr, dateStr, dateStr, dateStr).run();
  }

  /**
   * Clean up old analytics data based on retention policy
   */
  async cleanupOldData(): Promise<{ deletedRecords: number; errors: string[] }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffStr = cutoffDate.toISOString();

    const errors: string[] = [];
    let deletedRecords = 0;

    try {
      // Clean up old quota usage history
      const usageResult = await this.db.prepare(`
        DELETE FROM quota_usage_history 
        WHERE created_at < ?
      `).bind(cutoffStr).run();
      deletedRecords += usageResult.changes || 0;

      // Clean up old quota exceeded events
      const eventsResult = await this.db.prepare(`
        DELETE FROM quota_exceeded_events 
        WHERE created_at < ?
      `).bind(cutoffStr).run();
      deletedRecords += eventsResult.changes || 0;

      // Clean up old daily analytics (keep longer retention for aggregated data)
      const analyticsResult = await this.db.prepare(`
        DELETE FROM quota_analytics_daily 
        WHERE date < ?
      `).bind(cutoffDate.toISOString().split('T')[0]).run();
      deletedRecords += analyticsResult.changes || 0;

    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown cleanup error');
    }

    return { deletedRecords, errors };
  }

  // Private helper methods

  private async getTimeSeriesData(
    userId: string,
    startDate: Date,
    endDate: Date,
    period: string
  ): Promise<{
    storage: TimeSeriesData[];
    fileCount: TimeSeriesData[];
    bandwidth: TimeSeriesData[];
    requests: TimeSeriesData[];
  }> {
    const results = await this.db.prepare(`
      SELECT date, storage_used, file_count, bandwidth_used, total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]).all();

    return {
      storage: results.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.storage_used as number
      })),
      fileCount: results.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.file_count as number
      })),
      bandwidth: results.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.bandwidth_used as number
      })),
      requests: results.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.total_requests as number
      }))
    };
  }

  private async getTopFilesBySize(userId: string, limit: number): Promise<FileUsageData[]> {
    const results = await this.db.prepare(`
      SELECT 
        f.id as file_id,
        f.filename,
        f.file_size as size,
        f.created_at as upload_date,
        f.updated_at as last_accessed,
        COALESCE(access_count.count, 0) as access_count
      FROM files f
      LEFT JOIN (
        SELECT file_id, COUNT(*) as count
        FROM file_access_logs
        WHERE action = 'download'
        GROUP BY file_id
      ) access_count ON f.id = access_count.file_id
      WHERE f.user_id = ?
      ORDER BY f.file_size DESC
      LIMIT ?
    `).bind(userId, limit).all();

    return results.results.map(row => ({
      fileId: row.file_id as string,
      fileName: row.filename as string,
      size: row.size as number,
      uploadDate: new Date(row.upload_date as string),
      lastAccessed: new Date(row.last_accessed as string),
      accessCount: row.access_count as number
    }));
  }

  private async getQuotaExceededEvents(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<QuotaExceededEvent[]> {
    const results = await this.db.prepare(`
      SELECT *
      FROM quota_exceeded_events
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(userId, startDate.toISOString(), endDate.toISOString()).all();

    return results.results.map(row => ({
      timestamp: new Date(row.created_at as string),
      quotaType: row.quota_type as QuotaType,
      attempted: row.attempted_value as number,
      limit: row.limit_value as number,
      operationType: row.operation_type as QuotaOperationType,
      fileId: row.file_id as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    }));
  }

  private async getUserQuotaInfo(userId: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT 
        uq.*,
        qt.storage_limit,
        qt.file_count_limit,
        qt.bandwidth_limit
      FROM user_quotas uq
      JOIN quota_tiers qt ON uq.tier_id = qt.id
      WHERE uq.user_id = ?
    `).bind(userId).first();

    return result;
  }

  private async calculateSummaryStats(userId: string, period: { start: Date; end: Date }): Promise<any> {
    const result = await this.db.prepare(`
      SELECT 
        SUM(storage_used) as total_storage,
        SUM(file_count) as total_files,
        SUM(bandwidth_used) as total_bandwidth,
        SUM(total_requests) as total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).bind(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]).first();

    const userQuota = await this.getUserQuotaInfo(userId);

    return {
      totalStorage: result?.total_storage || 0,
      totalFiles: result?.total_files || 0,
      totalBandwidth: result?.total_bandwidth || 0,
      totalRequests: result?.total_requests || 0,
      quotaUtilization: {
        [QuotaType.STORAGE]: ((result?.total_storage || 0) / userQuota.storage_limit) * 100,
        [QuotaType.FILE_COUNT]: ((result?.total_files || 0) / userQuota.file_count_limit) * 100,
        [QuotaType.BANDWIDTH]: ((result?.total_bandwidth || 0) / userQuota.bandwidth_limit) * 100,
        [QuotaType.REQUESTS_PER_DAY]: 0, // Calculate separately if needed
        [QuotaType.REQUESTS_PER_HOUR]: 0,
        [QuotaType.REQUESTS_PER_MINUTE]: 0,
        [QuotaType.FILE_SIZE]: 0
      }
    };
  }

  private async calculateTrends(userId: string, period: { start: Date; end: Date }): Promise<any> {
    const data = await this.db.prepare(`
      SELECT date, storage_used, file_count, bandwidth_used, total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]).all();

    if (data.results.length < 2) {
      return { storageGrowth: 0, fileGrowth: 0, bandwidthGrowth: 0, requestGrowth: 0 };
    }

    const first = data.results[0];
    const last = data.results[data.results.length - 1];

    return {
      storageGrowth: this.calculateGrowthRate(first.storage_used as number, last.storage_used as number),
      fileGrowth: this.calculateGrowthRate(first.file_count as number, last.file_count as number),
      bandwidthGrowth: this.calculateGrowthRate(first.bandwidth_used as number, last.bandwidth_used as number),
      requestGrowth: this.calculateGrowthRate(first.total_requests as number, last.total_requests as number)
    };
  }

  private calculateGrowthRate(initial: number, final: number): number {
    if (initial === 0) return final > 0 ? 100 : 0;
    return ((final - initial) / initial) * 100;
  }

  private analyzeGrowthPattern(values: number[], type: string): UsagePattern | null {
    if (values.length < 3) return null;

    const trend = this.calculateLinearTrend(values);
    
    if (trend.slope > 0.1) {
      return {
        type: 'growth',
        severity: trend.slope > 0.5 ? 'high' : trend.slope > 0.2 ? 'medium' : 'low',
        description: `Rapid ${type} growth detected`,
        recommendation: `Monitor ${type} usage and consider upgrading quota`,
        detectedAt: new Date(),
        affectedQuotas: [type as QuotaType]
      };
    }

    return null;
  }

  private analyzeSpikePattern(values: number[], type: string): UsagePattern | null {
    if (values.length < 3) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length);
    
    const spikes = values.filter(v => v > avg + 2 * stdDev);
    
    if (spikes.length > 0) {
      return {
        type: 'spike',
        severity: spikes.length > values.length * 0.3 ? 'high' : 'medium',
        description: `Unusual ${type} spikes detected`,
        recommendation: `Review ${type} usage patterns and optimize if needed`,
        detectedAt: new Date(),
        affectedQuotas: [type as QuotaType]
      };
    }

    return null;
  }

  private calculateLinearTrend(values: number[]): { slope: number; intercept: number; r2: number } {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = values.reduce((acc, yi, i) => acc + Math.pow(yi - (slope * i + intercept), 2), 0);
    const ssTot = values.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);
    
    return { slope, intercept, r2 };
  }

  private calculateLinearForecast(
    historicalValues: number[],
    forecastDays: number,
    quotaLimit: number,
    quotaType: QuotaType
  ): QuotaForecast {
    const trend = this.calculateLinearTrend(historicalValues);
    const currentUsage = historicalValues[historicalValues.length - 1];
    const predictedUsage = currentUsage + (trend.slope * forecastDays);
    
    const willExceedQuota = predictedUsage > quotaLimit;
    let estimatedExceedDate: Date | undefined;
    
    if (willExceedQuota && trend.slope > 0) {
      const daysToExceed = (quotaLimit - currentUsage) / trend.slope;
      estimatedExceedDate = new Date();
      estimatedExceedDate.setDate(estimatedExceedDate.getDate() + Math.ceil(daysToExceed));
    }
    
    return {
      quotaType,
      currentUsage,
      predictedUsage: Math.max(0, predictedUsage),
      timeframe: `${forecastDays} days`,
      confidence: Math.min(trend.r2, 1) * 100,
      willExceedQuota,
      estimatedExceedDate
    };
  }

  private async generateRecommendations(
    userId: string,
    userQuota: any,
    trends: any,
    summary: any
  ): Promise<QuotaRecommendation[]> {
    const recommendations: QuotaRecommendation[] = [];

    // Storage recommendations
    const storageUsage = (summary.totalStorage / userQuota.storage_limit) * 100;
    if (storageUsage > 85) {
      recommendations.push({
        type: 'cleanup',
        priority: 'high',
        title: 'Storage nearly full',
        description: 'Your storage is over 85% full. Consider deleting unused files.',
        actionRequired: true
      });
    }

    // Growth trend recommendations
    if (trends.storageGrowth > 50) {
      recommendations.push({
        type: 'upgrade',
        priority: 'medium',
        title: 'Rapid storage growth',
        description: 'Your storage usage is growing rapidly. Consider upgrading your plan.',
        actionRequired: false
      });
    }

    return recommendations;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion for daily stats
    const headers = ['date', 'storage_used', 'file_count', 'bandwidth_used', 'total_requests'];
    const rows = [headers.join(',')];
    
    if (data.dailyStats && data.dailyStats.results) {
      data.dailyStats.results.forEach((row: any) => {
        const values = headers.map(header => row[header] || '');
        rows.push(values.join(','));
      });
    }
    
    return rows.join('\n');
  }
}