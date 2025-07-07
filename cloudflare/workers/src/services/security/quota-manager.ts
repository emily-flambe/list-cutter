/**
 * Quota Management Service
 * Provides comprehensive user quota management with real-time tracking and enforcement
 */

import {
  QuotaTier,
  UserQuota,
  QuotaUsage,
  QuotaCheck,
  QuotaCheckOptions,
  QuotaUpdate,
  QuotaAnalytics,
  QuotaAlert,
  QuotaReport,
  QuotaConfiguration,
  QuotaType,
  QuotaOperationType,
  QuotaAlertType,
  QuotaTierName,
  DEFAULT_QUOTA_TIERS,
  QuotaExceededError,
  QuotaNotFoundError,
  InvalidQuotaOperationError,
  TimeSeriesData,
  FileUsageData,
  QuotaExceededEvent
} from '../../types/quota.js';

export interface QuotaManagerOptions {
  db: D1Database;
  gracePeriodMinutes?: number;
  enableAnalytics?: boolean;
  enableAlerting?: boolean;
  warningThresholds?: {
    storage: number;
    files: number;
    bandwidth: number;
    requests: number;
  };
}

export class QuotaManager {
  private db: D1Database;
  private config: QuotaConfiguration;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private quotaCache = new Map<string, { quota: UserQuota; timestamp: number }>();

  constructor(options: QuotaManagerOptions) {
    this.db = options.db;
    this.config = {
      quotaCheckEnabled: true,
      quotaEnforcementEnabled: true,
      gracePeriodMinutes: options.gracePeriodMinutes || 5,
      warningThresholds: {
        storage: options.warningThresholds?.storage || 80,
        files: options.warningThresholds?.files || 80,
        bandwidth: options.warningThresholds?.bandwidth || 80,
        requests: options.warningThresholds?.requests || 80
      },
      alertThresholds: {
        storage: options.warningThresholds?.storage || 95,
        files: options.warningThresholds?.files || 95,
        bandwidth: options.warningThresholds?.bandwidth || 95,
        requests: options.warningThresholds?.requests || 95
      },
      autoCleanupEnabled: false,
      autoCleanupThresholds: {
        unusedFilesAfterDays: 30,
        largeFilesAfterDays: 90,
        duplicateFilesAfterDays: 7
      }
    };
  }

  /**
   * Check if a user operation is allowed based on quota limits
   */
  async checkQuota(options: QuotaCheckOptions): Promise<QuotaCheck> {
    const { userId, operationType, resourceSize = 0, ignoreOverage = false } = options;

    if (!this.config.quotaCheckEnabled) {
      return this.createAllowedQuotaCheck();
    }

    const userQuota = await this.getUserQuota(userId);
    
    // Determine quota type based on operation
    const quotaType = this.getQuotaTypeForOperation(operationType, resourceSize);
    
    const check = await this.performQuotaCheck(userQuota, quotaType, resourceSize, ignoreOverage);

    // Log quota check if it's denied
    if (!check.isAllowed) {
      await this.logQuotaExceededEvent(userId, quotaType, operationType, resourceSize, check.limit);
    }

    return check;
  }

  /**
   * Update user quota usage after an operation
   */
  async updateQuotaUsage(update: QuotaUpdate): Promise<void> {
    const { userId, operationType, resourceSize, metadata = {} } = update;

    const userQuota = await this.getUserQuota(userId);
    
    // Update usage based on operation type
    await this.updateUsageCounters(userQuota, operationType, resourceSize);

    // Log usage history
    await this.logQuotaUsage(userId, operationType, resourceSize, metadata);

    // Clear cache for this user
    this.quotaCache.delete(userId);

    // Check for threshold alerts
    await this.checkThresholdAlerts(userQuota);
  }

  /**
   * Get user quota with current usage
   */
  async getUserQuota(userId: string): Promise<UserQuota> {
    // Check cache first
    const cached = this.quotaCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.quota;
    }

    const result = await this.db.prepare(`
      SELECT 
        uq.*,
        qt.name as tier_name,
        qt.storage_limit,
        qt.file_count_limit,
        qt.max_file_size,
        qt.bandwidth_limit,
        qt.requests_per_minute,
        qt.requests_per_hour,
        qt.requests_per_day,
        qt.features,
        qt.price,
        qo.storage_limit as override_storage_limit,
        qo.file_count_limit as override_file_count_limit,
        qo.max_file_size as override_max_file_size,
        qo.bandwidth_limit as override_bandwidth_limit,
        qo.requests_per_minute as override_requests_per_minute,
        qo.requests_per_hour as override_requests_per_hour,
        qo.requests_per_day as override_requests_per_day,
        qo.reason as override_reason,
        qo.created_by as override_created_by,
        qo.expires_at as override_expires_at
      FROM user_quotas uq
      JOIN quota_tiers qt ON uq.tier_id = qt.id
      LEFT JOIN quota_overrides qo ON uq.user_id = qo.user_id AND qo.is_active = 1
      WHERE uq.user_id = ? AND uq.is_active = 1
    `).bind(userId).first();

    if (!result) {
      throw new QuotaNotFoundError(userId);
    }

    const userQuota = this.mapDatabaseResultToUserQuota(result);
    
    // Cache the result
    this.quotaCache.set(userId, {
      quota: userQuota,
      timestamp: Date.now()
    });

    return userQuota;
  }

  /**
   * Get quota analytics for a user
   */
  async getQuotaAnalytics(userId: string, period: 'hourly' | 'daily' | 'weekly' | 'monthly'): Promise<QuotaAnalytics> {
    const dateRange = this.getDateRangeForPeriod(period);
    
    // Get time series data
    const timeSeriesData = await this.db.prepare(`
      SELECT 
        date,
        storage_used,
        file_count,
        bandwidth_used,
        total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(userId, dateRange.start, dateRange.end).all();

    // Get top files by size
    const topFiles = await this.db.prepare(`
      SELECT 
        f.id as file_id,
        f.filename,
        f.file_size as size,
        f.created_at as upload_date,
        f.updated_at as last_accessed,
        COUNT(fal.id) as access_count
      FROM files f
      LEFT JOIN file_access_logs fal ON f.id = fal.file_id
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY f.file_size DESC
      LIMIT 10
    `).bind(userId).all();

    // Get quota exceeded events
    const exceededEvents = await this.db.prepare(`
      SELECT 
        created_at as timestamp,
        quota_type,
        attempted_value as attempted,
        limit_value as limit,
        operation_type,
        file_id,
        metadata
      FROM quota_exceeded_events
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(userId, dateRange.start, dateRange.end).all();

    return {
      userId,
      period,
      storageUsage: timeSeriesData.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.storage_used as number
      })),
      fileCountUsage: timeSeriesData.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.file_count as number
      })),
      bandwidthUsage: timeSeriesData.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.bandwidth_used as number
      })),
      requestsUsage: timeSeriesData.results.map(row => ({
        timestamp: new Date(row.date as string),
        value: row.total_requests as number
      })),
      topFilesBySize: topFiles.results.map(row => ({
        fileId: row.file_id as string,
        fileName: row.filename as string,
        size: row.size as number,
        uploadDate: new Date(row.upload_date as string),
        lastAccessed: new Date(row.last_accessed as string),
        accessCount: row.access_count as number
      })),
      quotaExceededEvents: exceededEvents.results.map(row => ({
        timestamp: new Date(row.timestamp as string),
        quotaType: row.quota_type as QuotaType,
        attempted: row.attempted as number,
        limit: row.limit as number,
        operationType: row.operation_type as QuotaOperationType,
        fileId: row.file_id as string | undefined,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
      }))
    };
  }

  /**
   * Change user's quota tier
   */
  async changeUserTier(userId: string, newTierId: string): Promise<void> {
    const transaction = await this.db.prepare(`
      UPDATE user_quotas 
      SET tier_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(newTierId, userId).run();

    if (transaction.changes === 0) {
      throw new QuotaNotFoundError(userId);
    }

    // Clear cache
    this.quotaCache.delete(userId);

    // Log tier change
    await this.logQuotaUsage(userId, QuotaOperationType.METADATA, 0, {
      action: 'tier_change',
      new_tier_id: newTierId
    });
  }

  /**
   * Get active quota alerts for a user
   */
  async getActiveAlerts(userId: string): Promise<QuotaAlert[]> {
    const results = await this.db.prepare(`
      SELECT * FROM quota_alerts
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `).bind(userId).all();

    return results.results.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      alertType: row.alert_type as QuotaAlertType,
      quotaType: row.quota_type as QuotaType,
      threshold: row.threshold_value as number,
      currentUsage: row.current_usage as number,
      limit: row.limit_value as number,
      message: row.message as string,
      severity: row.severity as 'info' | 'warning' | 'error' | 'critical',
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at as string),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined
    }));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE quota_alerts 
      SET acknowledged_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(alertId).run();
  }

  /**
   * Reset quota counters manually (admin function)
   */
  async resetQuotaCounters(userId: string, quotaTypes: QuotaType[]): Promise<void> {
    const updates: string[] = [];
    const values: (string | number)[] = [];

    quotaTypes.forEach(quotaType => {
      switch (quotaType) {
        case QuotaType.STORAGE:
          updates.push('storage_used = 0');
          break;
        case QuotaType.FILE_COUNT:
          updates.push('file_count = 0');
          break;
        case QuotaType.BANDWIDTH:
          updates.push('bandwidth_used = 0');
          break;
        case QuotaType.REQUESTS_PER_MINUTE:
          updates.push('requests_this_minute = 0');
          break;
        case QuotaType.REQUESTS_PER_HOUR:
          updates.push('requests_this_hour = 0');
          break;
        case QuotaType.REQUESTS_PER_DAY:
          updates.push('requests_this_day = 0');
          break;
      }
    });

    if (updates.length > 0) {
      await this.db.prepare(`
        UPDATE user_quotas 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(userId).run();

      // Clear cache
      this.quotaCache.delete(userId);
    }
  }

  /**
   * Get quota report for a user
   */
  async generateQuotaReport(userId: string, reportType: 'summary' | 'detailed' | 'trends', period: { start: Date; end: Date }): Promise<QuotaReport> {
    const userQuota = await this.getUserQuota(userId);
    
    // Get summary data
    const summary = await this.db.prepare(`
      SELECT 
        SUM(storage_used) as total_storage,
        SUM(file_count) as total_files,
        SUM(bandwidth_used) as total_bandwidth,
        SUM(total_requests) as total_requests
      FROM quota_analytics_daily
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).bind(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]).first();

    // Calculate trends if needed
    let trends = { storageGrowth: 0, fileGrowth: 0, bandwidthGrowth: 0, requestGrowth: 0 };
    
    if (reportType === 'trends' || reportType === 'detailed') {
      const trendData = await this.db.prepare(`
        SELECT 
          date,
          storage_used,
          file_count,
          bandwidth_used,
          total_requests
        FROM quota_analytics_daily
        WHERE user_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
      `).bind(userId, period.start.toISOString().split('T')[0], period.end.toISOString().split('T')[0]).all();

      trends = this.calculateTrends(trendData.results);
    }

    // Generate recommendations
    const recommendations = await this.generateRecommendations(userQuota, trends);

    return {
      userId,
      reportType,
      period,
      summary: {
        totalStorage: summary?.total_storage as number || 0,
        totalFiles: summary?.total_files as number || 0,
        totalBandwidth: summary?.total_bandwidth as number || 0,
        totalRequests: summary?.total_requests as number || 0,
        quotaUtilization: {
          [QuotaType.STORAGE]: (userQuota.currentUsage.storageUsed / userQuota.tier.storageLimit) * 100,
          [QuotaType.FILE_COUNT]: (userQuota.currentUsage.fileCount / userQuota.tier.fileCountLimit) * 100,
          [QuotaType.BANDWIDTH]: (userQuota.currentUsage.bandwidthUsed / userQuota.tier.bandwidthLimit) * 100,
          [QuotaType.REQUESTS_PER_DAY]: (userQuota.currentUsage.requestsThisDay / userQuota.tier.requestsPerDay) * 100,
          [QuotaType.REQUESTS_PER_HOUR]: (userQuota.currentUsage.requestsThisHour / userQuota.tier.requestsPerHour) * 100,
          [QuotaType.REQUESTS_PER_MINUTE]: (userQuota.currentUsage.requestsThisMinute / userQuota.tier.requestsPerMinute) * 100,
          [QuotaType.FILE_SIZE]: 0 // Not applicable for utilization
        }
      },
      trends,
      recommendations,
      generatedAt: new Date()
    };
  }

  // Private helper methods

  private createAllowedQuotaCheck(): QuotaCheck {
    return {
      isAllowed: true,
      quotaType: QuotaType.STORAGE,
      currentUsage: 0,
      limit: Number.MAX_SAFE_INTEGER,
      remainingQuota: Number.MAX_SAFE_INTEGER,
      percentageUsed: 0
    };
  }

  private getQuotaTypeForOperation(operationType: QuotaOperationType, resourceSize: number): QuotaType {
    switch (operationType) {
      case QuotaOperationType.UPLOAD:
        return resourceSize > 0 ? QuotaType.STORAGE : QuotaType.FILE_COUNT;
      case QuotaOperationType.DOWNLOAD:
        return QuotaType.BANDWIDTH;
      case QuotaOperationType.DELETE:
        return QuotaType.STORAGE;
      default:
        return QuotaType.REQUESTS_PER_MINUTE;
    }
  }

  private async performQuotaCheck(userQuota: UserQuota, quotaType: QuotaType, resourceSize: number, ignoreOverage: boolean): Promise<QuotaCheck> {
    const tier = userQuota.tier;
    const usage = userQuota.currentUsage;
    const overrides = userQuota.overrideSettings;

    let currentUsage: number;
    let limit: number;
    let resetTime: Date | undefined;

    switch (quotaType) {
      case QuotaType.STORAGE:
        currentUsage = usage.storageUsed;
        limit = overrides?.storageLimit || tier.storageLimit;
        break;
      case QuotaType.FILE_COUNT:
        currentUsage = usage.fileCount;
        limit = overrides?.fileCountLimit || tier.fileCountLimit;
        break;
      case QuotaType.FILE_SIZE:
        currentUsage = resourceSize;
        limit = overrides?.maxFileSize || tier.maxFileSize;
        break;
      case QuotaType.BANDWIDTH:
        currentUsage = usage.bandwidthUsed;
        limit = overrides?.bandwidthLimit || tier.bandwidthLimit;
        resetTime = usage.lastResetMonth;
        break;
      case QuotaType.REQUESTS_PER_MINUTE:
        currentUsage = usage.requestsThisMinute;
        limit = overrides?.requestsPerMinute || tier.requestsPerMinute;
        resetTime = usage.lastResetMinute;
        break;
      case QuotaType.REQUESTS_PER_HOUR:
        currentUsage = usage.requestsThisHour;
        limit = overrides?.requestsPerHour || tier.requestsPerHour;
        resetTime = usage.lastResetHour;
        break;
      case QuotaType.REQUESTS_PER_DAY:
        currentUsage = usage.requestsThisDay;
        limit = overrides?.requestsPerDay || tier.requestsPerDay;
        resetTime = usage.lastResetDay;
        break;
      default:
        throw new InvalidQuotaOperationError('check', `Unknown quota type: ${quotaType}`);
    }

    const wouldExceed = (currentUsage + resourceSize) > limit;
    const remainingQuota = Math.max(0, limit - currentUsage);
    const percentageUsed = (currentUsage / limit) * 100;

    const isAllowed = !wouldExceed || ignoreOverage || !this.config.quotaEnforcementEnabled;

    return {
      isAllowed,
      quotaType,
      currentUsage,
      limit,
      remainingQuota,
      percentageUsed,
      resetTime,
      errorMessage: wouldExceed ? `Quota exceeded for ${quotaType}` : undefined
    };
  }

  private async updateUsageCounters(userQuota: UserQuota, operationType: QuotaOperationType, resourceSize: number): Promise<void> {
    const updates: string[] = [];
    const values: (string | number)[] = [];

    switch (operationType) {
      case QuotaOperationType.UPLOAD:
        updates.push('storage_used = storage_used + ?', 'file_count = file_count + 1');
        values.push(resourceSize);
        break;
      case QuotaOperationType.DOWNLOAD:
        updates.push('bandwidth_used = bandwidth_used + ?');
        values.push(resourceSize);
        break;
      case QuotaOperationType.DELETE:
        updates.push('storage_used = storage_used - ?', 'file_count = file_count - 1');
        values.push(resourceSize);
        break;
    }

    // Always increment request counters
    updates.push(
      'requests_this_minute = requests_this_minute + 1',
      'requests_this_hour = requests_this_hour + 1',
      'requests_this_day = requests_this_day + 1',
      'requests_this_month = requests_this_month + 1'
    );

    if (updates.length > 0) {
      await this.db.prepare(`
        UPDATE user_quotas 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(...values, userQuota.userId).run();
    }
  }

  private async logQuotaUsage(userId: string, operationType: QuotaOperationType, resourceSize: number, metadata: Record<string, unknown>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO quota_usage_history 
      (user_id, quota_type, usage_value, limit_value, operation_type, resource_size, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      this.getQuotaTypeForOperation(operationType, resourceSize),
      resourceSize,
      0, // We'll need to fetch the actual limit
      operationType,
      resourceSize,
      JSON.stringify(metadata)
    ).run();
  }

  private async logQuotaExceededEvent(userId: string, quotaType: QuotaType, operationType: QuotaOperationType, attemptedValue: number, limitValue: number): Promise<void> {
    await this.db.prepare(`
      INSERT INTO quota_exceeded_events 
      (user_id, quota_type, operation_type, attempted_value, limit_value, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      quotaType,
      operationType,
      attemptedValue,
      limitValue,
      JSON.stringify({ timestamp: new Date().toISOString() })
    ).run();
  }

  private async checkThresholdAlerts(userQuota: UserQuota): Promise<void> {
    const quotaTypes = [QuotaType.STORAGE, QuotaType.FILE_COUNT, QuotaType.BANDWIDTH];
    
    for (const quotaType of quotaTypes) {
      const percentageUsed = this.calculatePercentageUsed(userQuota, quotaType);
      
      if (percentageUsed >= this.config.alertThresholds[quotaType as keyof typeof this.config.alertThresholds]) {
        await this.createAlert(userQuota.userId, QuotaAlertType.THRESHOLD_CRITICAL, quotaType, percentageUsed);
      } else if (percentageUsed >= this.config.warningThresholds[quotaType as keyof typeof this.config.warningThresholds]) {
        await this.createAlert(userQuota.userId, QuotaAlertType.THRESHOLD_WARNING, quotaType, percentageUsed);
      }
    }
  }

  private calculatePercentageUsed(userQuota: UserQuota, quotaType: QuotaType): number {
    const usage = userQuota.currentUsage;
    const tier = userQuota.tier;
    const overrides = userQuota.overrideSettings;

    switch (quotaType) {
      case QuotaType.STORAGE:
        return (usage.storageUsed / (overrides?.storageLimit || tier.storageLimit)) * 100;
      case QuotaType.FILE_COUNT:
        return (usage.fileCount / (overrides?.fileCountLimit || tier.fileCountLimit)) * 100;
      case QuotaType.BANDWIDTH:
        return (usage.bandwidthUsed / (overrides?.bandwidthLimit || tier.bandwidthLimit)) * 100;
      default:
        return 0;
    }
  }

  private async createAlert(userId: string, alertType: QuotaAlertType, quotaType: QuotaType, percentageUsed: number): Promise<void> {
    const severity = percentageUsed >= 95 ? 'critical' : percentageUsed >= 80 ? 'warning' : 'info';
    const message = `${quotaType} usage at ${percentageUsed.toFixed(1)}%`;

    await this.db.prepare(`
      INSERT INTO quota_alerts 
      (user_id, alert_type, quota_type, threshold_value, current_usage, limit_value, message, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      alertType,
      quotaType,
      Math.round(percentageUsed),
      0, // We'll need to calculate actual usage
      0, // We'll need to calculate actual limit
      message,
      severity
    ).run();
  }

  private mapDatabaseResultToUserQuota(result: any): UserQuota {
    const tier: QuotaTier = {
      id: result.tier_id,
      name: result.tier_name,
      storageLimit: result.storage_limit,
      fileCountLimit: result.file_count_limit,
      maxFileSize: result.max_file_size,
      bandwidthLimit: result.bandwidth_limit,
      requestsPerMinute: result.requests_per_minute,
      requestsPerHour: result.requests_per_hour,
      requestsPerDay: result.requests_per_day,
      features: JSON.parse(result.features || '[]'),
      price: result.price,
      isActive: Boolean(result.is_active)
    };

    const usage: QuotaUsage = {
      storageUsed: result.storage_used,
      fileCount: result.file_count,
      bandwidthUsed: result.bandwidth_used,
      requestsThisMinute: result.requests_this_minute,
      requestsThisHour: result.requests_this_hour,
      requestsThisDay: result.requests_this_day,
      requestsThisMonth: result.requests_this_month,
      lastResetMinute: new Date(result.last_reset_minute),
      lastResetHour: new Date(result.last_reset_hour),
      lastResetDay: new Date(result.last_reset_day),
      lastResetMonth: new Date(result.last_reset_month)
    };

    let overrideSettings = undefined;
    if (result.override_storage_limit !== null) {
      overrideSettings = {
        storageLimit: result.override_storage_limit,
        fileCountLimit: result.override_file_count_limit,
        maxFileSize: result.override_max_file_size,
        bandwidthLimit: result.override_bandwidth_limit,
        requestsPerMinute: result.override_requests_per_minute,
        requestsPerHour: result.override_requests_per_hour,
        requestsPerDay: result.override_requests_per_day,
        reason: result.override_reason,
        createdBy: result.override_created_by,
        expiresAt: result.override_expires_at ? new Date(result.override_expires_at) : undefined
      };
    }

    return {
      id: result.id,
      userId: result.user_id,
      tierId: result.tier_id,
      tier,
      currentUsage: usage,
      overrideSettings,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
      expiresAt: result.expires_at ? new Date(result.expires_at) : undefined,
      isActive: Boolean(result.is_active)
    };
  }

  private getDateRangeForPeriod(period: string): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start: string;

    switch (period) {
      case 'hourly':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'daily':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'weekly':
        start = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'monthly':
        start = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return { start, end };
  }

  private calculateTrends(data: any[]): { storageGrowth: number; fileGrowth: number; bandwidthGrowth: number; requestGrowth: number } {
    if (data.length < 2) {
      return { storageGrowth: 0, fileGrowth: 0, bandwidthGrowth: 0, requestGrowth: 0 };
    }

    const first = data[0];
    const last = data[data.length - 1];

    return {
      storageGrowth: ((last.storage_used - first.storage_used) / first.storage_used) * 100,
      fileGrowth: ((last.file_count - first.file_count) / first.file_count) * 100,
      bandwidthGrowth: ((last.bandwidth_used - first.bandwidth_used) / first.bandwidth_used) * 100,
      requestGrowth: ((last.total_requests - first.total_requests) / first.total_requests) * 100
    };
  }

  private async generateRecommendations(userQuota: UserQuota, trends: any): Promise<any[]> {
    const recommendations = [];

    // Storage recommendations
    const storageUsage = (userQuota.currentUsage.storageUsed / userQuota.tier.storageLimit) * 100;
    if (storageUsage > 85) {
      recommendations.push({
        type: 'cleanup',
        priority: 'high',
        title: 'Storage nearly full',
        description: 'Consider deleting unused files or upgrading your plan',
        actionRequired: true
      });
    }

    // Growth trend recommendations
    if (trends.storageGrowth > 50) {
      recommendations.push({
        type: 'upgrade',
        priority: 'medium',
        title: 'Rapid storage growth detected',
        description: 'Your storage usage is growing quickly. Consider upgrading to a higher tier.',
        actionRequired: false
      });
    }

    return recommendations;
  }
}