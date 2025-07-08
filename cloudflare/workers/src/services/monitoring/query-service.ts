/**
 * Query service for efficient historical storage metrics and cost data retrieval
 * Optimized for dashboard endpoints with proper caching and aggregation
 */
export class MetricsQueryService {
  private db: D1Database;
  private cache: Map<string, CachedQuery> = new Map();
  private readonly CACHE_DURATION_MS = 1000 * 60 * 5; // 5 minutes

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Get user storage usage overview
   */
  async getUserStorageOverview(userId: string): Promise<UserStorageOverview> {
    const cacheKey = `storage_overview_${userId}`;
    
    // Check cache
    if (this.isValidCache(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    const overview = await this.db
      .prepare(`
        SELECT 
          u.id,
          u.email,
          u.username,
          COALESCE(ucu.total_files, 0) as total_files,
          COALESCE(ucu.total_bytes, 0) as total_bytes,
          COALESCE(ucu.standard_bytes, 0) as standard_bytes,
          COALESCE(ucu.ia_bytes, 0) as ia_bytes,
          COALESCE(ucu.storage_usage_percentage, 0) as storage_usage_percentage,
          q.max_storage_bytes,
          q.max_objects,
          q.quota_type,
          q.billing_enabled,
          COALESCE(mbs.total_monthly_cost_usd, 0) as current_month_cost,
          COALESCE(dss.total_daily_cost_usd, 0) as today_cost
        FROM users u
        LEFT JOIN user_current_usage ucu ON u.id = ucu.user_id
        LEFT JOIN user_storage_quotas q ON u.id = q.user_id
        LEFT JOIN monthly_billing_summary mbs ON u.id = mbs.user_id 
          AND mbs.billing_month = DATE('now', 'start of month')
        LEFT JOIN daily_storage_snapshots dss ON u.id = dss.user_id 
          AND dss.snapshot_date = DATE('now')
        WHERE u.id = ?
      `)
      .bind(userId)
      .first();

    if (!overview) {
      throw new Error('User not found');
    }

    // Get recent activity
    const recentActivity = await this.db
      .prepare(`
        SELECT 
          action,
          COUNT(*) as count,
          SUM(bytes_transferred) as total_bytes
        FROM file_access_logs
        WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
        GROUP BY action
        ORDER BY count DESC
      `)
      .bind(userId)
      .all();

    const result: UserStorageOverview = {
      userId: overview.id,
      email: overview.email,
      username: overview.username,
      storage: {
        totalFiles: overview.total_files,
        totalBytes: overview.total_bytes,
        standardBytes: overview.standard_bytes,
        iaBytes: overview.ia_bytes,
        usagePercentage: overview.storage_usage_percentage
      },
      quota: {
        maxStorageBytes: overview.max_storage_bytes,
        maxObjects: overview.max_objects,
        quotaType: overview.quota_type,
        billingEnabled: overview.billing_enabled === 1
      },
      costs: {
        currentMonthCost: overview.current_month_cost,
        todayCost: overview.today_cost
      },
      recentActivity: recentActivity.results.map((activity: Record<string, unknown>) => ({
        action: activity.action as string,
        count: activity.count as number,
        totalBytes: (activity.total_bytes as number) ?? 0
      }))
    };

    // Cache the result
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get historical storage metrics for a user
   */
  async getUserStorageHistory(
    userId: string,
    timeRange: TimeRange,
    aggregationLevel: AggregationLevel = 'daily'
  ): Promise<StorageHistoryData> {
    const { startDate, endDate } = this.getDateRange(timeRange);
    const cacheKey = `storage_history_${userId}_${timeRange}_${aggregationLevel}`;
    
    if (this.isValidCache(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Get storage metrics
    const metrics = await this.db
      .prepare(`
        SELECT 
          metric_date,
          metric_type,
          storage_class,
          SUM(total_bytes) as total_bytes,
          SUM(total_operations) as total_operations,
          SUM(total_cost_usd) as total_cost_usd
        FROM storage_metrics
        WHERE user_id = ? 
        AND metric_date >= ? 
        AND metric_date <= ?
        AND aggregation_level = ?
        GROUP BY metric_date, metric_type, storage_class
        ORDER BY metric_date
      `)
      .bind(userId, startDate, endDate, aggregationLevel)
      .all();

    // Get daily snapshots for storage usage trend
    const snapshots = await this.db
      .prepare(`
        SELECT 
          snapshot_date,
          total_bytes,
          standard_bytes,
          ia_bytes,
          total_daily_cost_usd
        FROM daily_storage_snapshots
        WHERE user_id = ? 
        AND snapshot_date >= ? 
        AND snapshot_date <= ?
        ORDER BY snapshot_date
      `)
      .bind(userId, startDate, endDate)
      .all();

    const result = this.processStorageHistoryData(metrics.results, snapshots.results, timeRange);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get cost breakdown for a user
   */
  async getUserCostBreakdown(
    userId: string,
    timeRange: TimeRange
  ): Promise<CostBreakdownData> {
    const { startDate, endDate } = this.getDateRange(timeRange);
    const cacheKey = `cost_breakdown_${userId}_${timeRange}`;
    
    if (this.isValidCache(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Get cost breakdown by metric type
    const costBreakdown = await this.db
      .prepare(`
        SELECT 
          metric_type,
          storage_class,
          SUM(total_cost_usd) as total_cost,
          SUM(total_operations) as total_operations,
          SUM(total_bytes) as total_bytes
        FROM storage_metrics
        WHERE user_id = ? 
        AND metric_date >= ? 
        AND metric_date <= ?
        GROUP BY metric_type, storage_class
        ORDER BY total_cost DESC
      `)
      .bind(userId, startDate, endDate)
      .all();

    // Get monthly billing summaries
    const monthlyBilling = await this.db
      .prepare(`
        SELECT *
        FROM monthly_billing_summary
        WHERE user_id = ? 
        AND billing_month >= ? 
        AND billing_month <= ?
        ORDER BY billing_month DESC
      `)
      .bind(userId, startDate.substring(0, 7) + '-01', endDate.substring(0, 7) + '-01')
      .all();

    // Get free tier usage
    const freeTierUsage = await this.db
      .prepare(`
        SELECT 
          AVG(free_storage_used_bytes) as avg_storage_used,
          AVG(free_class_a_used) as avg_class_a_used,
          AVG(free_class_b_used) as avg_class_b_used,
          AVG(free_transfer_out_used_bytes) as avg_transfer_used
        FROM monthly_billing_summary
        WHERE user_id = ? 
        AND billing_month >= ? 
        AND billing_month <= ?
      `)
      .bind(userId, startDate.substring(0, 7) + '-01', endDate.substring(0, 7) + '-01')
      .first();

    const result: CostBreakdownData = {
      userId,
      timeRange,
      totalCost: costBreakdown.results.reduce((sum: number, item: Record<string, unknown>) => sum + (item.total_cost as number), 0),
      breakdown: costBreakdown.results.map((item: Record<string, unknown>) => ({
        metricType: item.metric_type as string,
        storageClass: item.storage_class as string,
        cost: item.total_cost as number,
        operations: item.total_operations as number,
        bytes: item.total_bytes as number
      })),
      monthlyTrend: monthlyBilling.results.map((month: Record<string, unknown>) => ({
        month: month.billing_month as string,
        totalCost: month.total_monthly_cost_usd as number,
        storageCost: month.storage_cost_usd as number,
        requestCost: (month.class_a_cost_usd as number) + (month.class_b_cost_usd as number),
        transferCost: (month.transfer_out_cost_usd as number) + (month.transfer_in_cost_usd as number)
      })),
      freeTierUsage: {
        storageUsedBytes: freeTierUsage?.avg_storage_used || 0,
        classAUsed: freeTierUsage?.avg_class_a_used || 0,
        classBUsed: freeTierUsage?.avg_class_b_used || 0,
        transferUsedBytes: freeTierUsage?.avg_transfer_used || 0
      }
    };

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get system-wide metrics overview
   */
  async getSystemMetricsOverview(): Promise<SystemMetricsOverview> {
    const cacheKey = 'system_overview';
    
    if (this.isValidCache(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Get overall system stats
    const systemStats = await this.db
      .prepare(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN u.id END) as active_users,
          COUNT(f.id) as total_files,
          SUM(f.file_size) as total_storage_bytes,
          COUNT(CASE WHEN f.upload_status = 'completed' THEN 1 END) as completed_uploads,
          COUNT(CASE WHEN f.upload_status = 'failed' THEN 1 END) as failed_uploads
        FROM users u
        LEFT JOIN files f ON u.id = f.user_id
      `)
      .first();

    // Get today's activity
    const todayActivity = await this.db
      .prepare(`
        SELECT 
          action,
          COUNT(*) as count,
          SUM(bytes_transferred) as total_bytes,
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful_count
        FROM file_access_logs
        WHERE DATE(created_at) = DATE('now')
        GROUP BY action
      `)
      .all();

    // Get cost summary
    const costSummary = await this.db
      .prepare(`
        SELECT 
          SUM(total_monthly_cost_usd) as total_monthly_cost,
          AVG(total_monthly_cost_usd) as avg_user_cost,
          COUNT(*) as billing_users
        FROM monthly_billing_summary
        WHERE billing_month = DATE('now', 'start of month')
      `)
      .first();

    // Get top users by usage
    const topUsers = await this.db
      .prepare(`
        SELECT 
          u.username,
          u.email,
          ucu.total_bytes,
          ucu.total_files,
          mbs.total_monthly_cost_usd
        FROM user_current_usage ucu
        JOIN users u ON ucu.user_id = u.id
        LEFT JOIN monthly_billing_summary mbs ON u.id = mbs.user_id 
          AND mbs.billing_month = DATE('now', 'start of month')
        ORDER BY ucu.total_bytes DESC
        LIMIT 10
      `)
      .all();

    const result: SystemMetricsOverview = {
      users: {
        total: systemStats?.total_users || 0,
        active: systemStats?.active_users || 0
      },
      storage: {
        totalFiles: systemStats?.total_files || 0,
        totalBytes: systemStats?.total_storage_bytes || 0,
        completedUploads: systemStats?.completed_uploads || 0,
        failedUploads: systemStats?.failed_uploads || 0
      },
      activity: todayActivity.results.map((activity: Record<string, unknown>) => ({
        action: activity.action as string,
        count: activity.count as number,
        totalBytes: (activity.total_bytes as number) ?? 0,
        successRate: (activity.count as number) > 0 ? (activity.successful_count as number) / (activity.count as number) : 0
      })),
      costs: {
        totalMonthlyCost: costSummary?.total_monthly_cost || 0,
        averageUserCost: costSummary?.avg_user_cost || 0,
        billingUsers: costSummary?.billing_users || 0
      },
      topUsers: topUsers.results.map((user: Record<string, unknown>) => ({
        username: user.username as string,
        email: user.email as string,
        totalBytes: (user.total_bytes as number) || 0,
        totalFiles: (user.total_files as number) || 0,
        monthlyCost: (user.total_monthly_cost_usd as number) || 0
      }))
    };

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get error analytics
   */
  async getErrorAnalytics(
    userId?: string,
    timeRange: TimeRange = '7days'
  ): Promise<ErrorAnalyticsData> {
    const { startDate, endDate } = this.getDateRange(timeRange);
    const cacheKey = `error_analytics_${userId || 'all'}_${timeRange}`;
    
    if (this.isValidCache(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    const userFilter = userId ? 'AND user_id = ?' : '';
    const params = userId ? [startDate, endDate, userId] : [startDate, endDate];

    // Get error distribution
    const errorDistribution = await this.db
      .prepare(`
        SELECT 
          sm.error_types,
          COUNT(*) as occurrence_count,
          SUM(sm.error_count) as total_errors
        FROM storage_metrics sm
        WHERE sm.metric_date >= ? 
        AND sm.metric_date <= ?
        AND sm.error_count > 0
        ${userFilter}
        GROUP BY sm.error_types
        ORDER BY total_errors DESC
      `)
      .bind(...params)
      .all();

    // Get error trends
    const errorTrends = await this.db
      .prepare(`
        SELECT 
          metric_date,
          SUM(error_count) as total_errors,
          SUM(total_operations) as total_operations
        FROM storage_metrics
        WHERE metric_date >= ? 
        AND metric_date <= ?
        ${userFilter}
        GROUP BY metric_date
        ORDER BY metric_date
      `)
      .bind(...params)
      .all();

    // Get recent error details
    const recentErrors = await this.db
      .prepare(`
        SELECT 
          fal.action,
          fal.error_message,
          fal.user_id,
          fal.file_id,
          fal.created_at,
          u.username
        FROM file_access_logs fal
        JOIN users u ON fal.user_id = u.id
        WHERE fal.success = 0 
        AND fal.created_at >= ?
        AND fal.created_at <= ?
        ${userFilter.replace('user_id', 'fal.user_id')}
        ORDER BY fal.created_at DESC
        LIMIT 100
      `)
      .bind(...params)
      .all();

    const result: ErrorAnalyticsData = {
      timeRange,
      userId,
      distribution: errorDistribution.results.map((item: Record<string, unknown>) => ({
        errorTypes: JSON.parse(item.error_types || '[]'),
        occurrenceCount: item.occurrence_count,
        totalErrors: item.total_errors
      })),
      trends: errorTrends.results.map((item: Record<string, unknown>) => ({
        date: item.metric_date,
        totalErrors: item.total_errors,
        totalOperations: item.total_operations,
        errorRate: item.total_operations > 0 ? item.total_errors / item.total_operations : 0
      })),
      recentErrors: recentErrors.results.map((item: Record<string, unknown>) => ({
        action: item.action,
        errorMessage: item.error_message,
        userId: item.user_id,
        username: item.username,
        fileId: item.file_id,
        timestamp: item.created_at
      }))
    };

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    userId?: string,
    timeRange: TimeRange = '7days'
  ): Promise<PerformanceMetricsData> {
    const { startDate, endDate } = this.getDateRange(timeRange);
    const cacheKey = `performance_metrics_${userId || 'all'}_${timeRange}`;
    
    if (this.isValidCache(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    const userFilter = userId ? 'AND user_id = ?' : '';
    const params = userId ? [startDate, endDate, userId] : [startDate, endDate];

    // Get operation performance
    const operationPerformance = await this.db
      .prepare(`
        SELECT 
          action,
          COUNT(*) as total_operations,
          AVG(duration_ms) as avg_duration,
          PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
          AVG(bytes_transferred) as avg_throughput,
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful_operations
        FROM file_access_logs
        WHERE created_at >= ?
        AND created_at <= ?
        ${userFilter}
        GROUP BY action
        ORDER BY total_operations DESC
      `)
      .bind(...params)
      .all();

    // Get throughput trends
    const throughputTrends = await this.db
      .prepare(`
        SELECT 
          DATE(created_at) as date,
          AVG(bytes_transferred / NULLIF(duration_ms, 0) * 1000) as avg_throughput_bps,
          COUNT(*) as operations
        FROM file_access_logs
        WHERE created_at >= ?
        AND created_at <= ?
        AND duration_ms > 0
        ${userFilter}
        GROUP BY DATE(created_at)
        ORDER BY date
      `)
      .bind(...params)
      .all();

    const result: PerformanceMetricsData = {
      timeRange,
      userId,
      operationPerformance: operationPerformance.results.map((item: Record<string, unknown>) => ({
        action: item.action,
        totalOperations: item.total_operations,
        avgDuration: item.avg_duration || 0,
        p95Duration: item.p95_duration || 0,
        avgThroughput: item.avg_throughput || 0,
        successRate: item.total_operations > 0 ? item.successful_operations / item.total_operations : 0
      })),
      throughputTrends: throughputTrends.results.map((item: Record<string, unknown>) => ({
        date: item.date,
        avgThroughputBps: item.avg_throughput_bps || 0,
        operations: item.operations
      }))
    };

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Clear cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Check if cache entry is valid
   */
  private isValidCache(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    return Date.now() - entry.timestamp < this.CACHE_DURATION_MS;
  }

  /**
   * Get date range from time range string
   */
  private getDateRange(timeRange: TimeRange): { startDate: string; endDate: string } {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate: string;

    switch (timeRange) {
      case '1day':
        startDate = endDate;
        break;
      case '7days': {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        startDate = sevenDaysAgo.toISOString().split('T')[0];
        break;
      }
      case '30days': {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      }
      case '90days': {
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        startDate = ninetyDaysAgo.toISOString().split('T')[0];
        break;
      }
      case '1year': {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        startDate = oneYearAgo.toISOString().split('T')[0];
        break;
      }
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return { startDate, endDate };
  }

  /**
   * Process storage history data
   */
  private processStorageHistoryData(
    metrics: DatabaseRow[],
    snapshots: DatabaseRow[],
    timeRange: TimeRange
  ): StorageHistoryData {
    // Group metrics by date and type
    const metricsByDate = new Map<string, Map<string, Record<string, unknown>>>();
    for (const metric of metrics) {
      const metricDate = metric.metric_date as string;
      if (!metricsByDate.has(metricDate)) {
        metricsByDate.set(metricDate, new Map());
      }
      const key = `${metric.metric_type}_${metric.storage_class}`;
      const dateMap = metricsByDate.get(metricDate);
      if (dateMap) {
        dateMap.set(key, metric);
      }
    }

    // Process snapshots
    const storageUsage = snapshots.map((snapshot: DatabaseRow) => ({
      date: snapshot.snapshot_date as string,
      totalBytes: snapshot.total_bytes as number,
      standardBytes: snapshot.standard_bytes as number,
      iaBytes: snapshot.ia_bytes as number,
      dailyCost: snapshot.total_daily_cost_usd as number
    }));

    // Process operations by date
    const operations = Array.from(metricsByDate.entries()).map(([date, metrics]) => {
      let classAOps = 0;
      let classBOps = 0;
      let transferOut = 0;
      let transferIn = 0;
      let totalCost = 0;

      for (const [key, metric] of metrics) {
        totalCost += (metric.total_cost_usd as number);
        
        if (key.includes('requests_class_a')) {
          classAOps += (metric.total_operations as number);
        } else if (key.includes('requests_class_b')) {
          classBOps += (metric.total_operations as number);
        } else if (key.includes('data_transfer_out')) {
          transferOut += (metric.total_bytes as number);
        } else if (key.includes('data_transfer_in')) {
          transferIn += (metric.total_bytes as number);
        }
      }

      return {
        date,
        classAOperations: classAOps,
        classBOperations: classBOps,
        dataTransferOut: transferOut,
        dataTransferIn: transferIn,
        totalCost
      };
    });

    return {
      timeRange,
      storageUsage,
      operations
    };
  }
}

// Type definitions
type TimeRange = '1day' | '7days' | '30days' | '90days' | '1year';
type AggregationLevel = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface CachedQuery {
  data: Record<string, unknown>;
  timestamp: number;
}

interface UserStorageOverview {
  userId: string;
  email: string;
  username: string;
  storage: {
    totalFiles: number;
    totalBytes: number;
    standardBytes: number;
    iaBytes: number;
    usagePercentage: number;
  };
  quota: {
    maxStorageBytes: number;
    maxObjects: number;
    quotaType: string;
    billingEnabled: boolean;
  };
  costs: {
    currentMonthCost: number;
    todayCost: number;
  };
  recentActivity: Array<{
    action: string;
    count: number;
    totalBytes: number;
  }>;
}

interface StorageHistoryData {
  timeRange: TimeRange;
  storageUsage: Array<{
    date: string;
    totalBytes: number;
    standardBytes: number;
    iaBytes: number;
    dailyCost: number;
  }>;
  operations: Array<{
    date: string;
    classAOperations: number;
    classBOperations: number;
    dataTransferOut: number;
    dataTransferIn: number;
    totalCost: number;
  }>;
}

interface CostBreakdownData {
  userId: string;
  timeRange: TimeRange;
  totalCost: number;
  breakdown: Array<{
    metricType: string;
    storageClass: string;
    cost: number;
    operations: number;
    bytes: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    totalCost: number;
    storageCost: number;
    requestCost: number;
    transferCost: number;
  }>;
  freeTierUsage: {
    storageUsedBytes: number;
    classAUsed: number;
    classBUsed: number;
    transferUsedBytes: number;
  };
}

interface SystemMetricsOverview {
  users: {
    total: number;
    active: number;
  };
  storage: {
    totalFiles: number;
    totalBytes: number;
    completedUploads: number;
    failedUploads: number;
  };
  activity: Array<{
    action: string;
    count: number;
    totalBytes: number;
    successRate: number;
  }>;
  costs: {
    totalMonthlyCost: number;
    averageUserCost: number;
    billingUsers: number;
  };
  topUsers: Array<{
    username: string;
    email: string;
    totalBytes: number;
    totalFiles: number;
    monthlyCost: number;
  }>;
}

interface ErrorAnalyticsData {
  timeRange: TimeRange;
  userId?: string;
  distribution: Array<{
    errorTypes: string[];
    occurrenceCount: number;
    totalErrors: number;
  }>;
  trends: Array<{
    date: string;
    totalErrors: number;
    totalOperations: number;
    errorRate: number;
  }>;
  recentErrors: Array<{
    action: string;
    errorMessage: string;
    userId: string;
    username: string;
    fileId: string;
    timestamp: string;
  }>;
}

interface PerformanceMetricsData {
  timeRange: TimeRange;
  userId?: string;
  operationPerformance: Array<{
    action: string;
    totalOperations: number;
    avgDuration: number;
    p95Duration: number;
    avgThroughput: number;
    successRate: number;
  }>;
  throughputTrends: Array<{
    date: string;
    avgThroughputBps: number;
    operations: number;
  }>;
}

// Additional type definitions
interface DatabaseRow {
  [key: string]: unknown;
}