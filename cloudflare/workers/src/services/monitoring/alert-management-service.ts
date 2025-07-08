/**
 * Alert Management Service
 * Handles CRUD operations and state management for alerts
 */

import {
  AlertRule,
  AlertInstance,
  AlertCreateRequest,
  AlertUpdateRequest,
  AlertAcknowledgeRequest,
  AlertResolveRequest,
  AlertMetricsQuery,
  AlertHistoryItem,
  NotificationChannel,
  NotificationChannelCreateRequest,
  NotificationChannelUpdateRequest,
  AlertBulkOperationRequest,
  AlertBulkOperationResponse,
  AlertTestRequest,
  AlertTestResponse,
  AlertDashboardData
} from '../../types/alerts.js';
import { AlertEvaluationService } from './alert-evaluation-service.js';
import { NotificationService } from './notification-service.js';

export class AlertManagementService {
  private evaluationService: AlertEvaluationService;
  private notificationService: NotificationService;

  constructor(
    private db: D1Database,
    private analytics: AnalyticsEngineDataset,
    evaluationService?: AlertEvaluationService,
    notificationService?: NotificationService
  ) {
    this.evaluationService = evaluationService || new AlertEvaluationService(db, analytics);
    this.notificationService = notificationService || new NotificationService(db);
  }

  // ============================================================================
  // Alert Rule Management
  // ============================================================================

  /**
   * Create a new alert rule
   */
  async createAlertRule(userId: string, request: AlertCreateRequest): Promise<AlertRule> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const alertRule: AlertRule = {
      id,
      name: request.name,
      description: request.description,
      userId,
      alertType: request.alertType,
      metricType: request.metricType,
      thresholdValue: request.thresholdValue,
      thresholdOperator: request.thresholdOperator,
      thresholdUnit: request.thresholdUnit,
      comparisonType: request.comparisonType,
      comparisonWindow: request.comparisonWindow,
      severity: request.severity,
      priority: request.priority || 3,
      minDurationMinutes: request.minDurationMinutes || 5,
      evaluationFrequencyMinutes: request.evaluationFrequencyMinutes || 5,
      aggregationMethod: request.aggregationMethod || 'avg',
      enabled: true,
      state: 'inactive',
      suppressionDurationMinutes: request.suppressionDurationMinutes || 60,
      maxAlertsPerDay: request.maxAlertsPerDay || 10,
      filters: request.filters,
      createdAt: now,
      updatedAt: now
    };

    // Insert alert rule
    await this.db.prepare(`
      INSERT INTO alert_rules (
        id, name, description, user_id, alert_type, metric_type,
        threshold_value, threshold_operator, threshold_unit,
        comparison_type, comparison_window, min_duration_minutes,
        evaluation_frequency_minutes, aggregation_method, severity,
        priority, enabled, state, suppression_duration_minutes,
        max_alerts_per_day, filters, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, alertRule.name, alertRule.description, userId,
      alertRule.alertType, alertRule.metricType, alertRule.thresholdValue,
      alertRule.thresholdOperator, alertRule.thresholdUnit,
      alertRule.comparisonType, alertRule.comparisonWindow,
      alertRule.minDurationMinutes, alertRule.evaluationFrequencyMinutes,
      alertRule.aggregationMethod, alertRule.severity, alertRule.priority,
      1, alertRule.state, alertRule.suppressionDurationMinutes,
      alertRule.maxAlertsPerDay, JSON.stringify(alertRule.filters),
      alertRule.createdAt, alertRule.updatedAt
    ).run();

    // Associate with notification channels if provided
    if (request.notificationChannelIds?.length) {
      for (const channelId of request.notificationChannelIds) {
        await this.associateChannelWithRule(id, channelId);
      }
    }

    return alertRule;
  }

  /**
   * Update an alert rule
   */
  async updateAlertRule(ruleId: string, userId: string, request: AlertUpdateRequest): Promise<AlertRule> {
    const existing = await this.getAlertRule(ruleId, userId);
    if (!existing) {
      throw new Error('Alert rule not found');
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (request.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(request.name);
    }
    if (request.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(request.description);
    }
    if (request.thresholdValue !== undefined) {
      updateFields.push('threshold_value = ?');
      updateValues.push(request.thresholdValue);
    }
    if (request.thresholdOperator !== undefined) {
      updateFields.push('threshold_operator = ?');
      updateValues.push(request.thresholdOperator);
    }
    if (request.severity !== undefined) {
      updateFields.push('severity = ?');
      updateValues.push(request.severity);
    }
    if (request.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(request.priority);
    }
    if (request.enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(request.enabled ? 1 : 0);
    }
    if (request.minDurationMinutes !== undefined) {
      updateFields.push('min_duration_minutes = ?');
      updateValues.push(request.minDurationMinutes);
    }
    if (request.evaluationFrequencyMinutes !== undefined) {
      updateFields.push('evaluation_frequency_minutes = ?');
      updateValues.push(request.evaluationFrequencyMinutes);
    }
    if (request.suppressionDurationMinutes !== undefined) {
      updateFields.push('suppression_duration_minutes = ?');
      updateValues.push(request.suppressionDurationMinutes);
    }
    if (request.maxAlertsPerDay !== undefined) {
      updateFields.push('max_alerts_per_day = ?');
      updateValues.push(request.maxAlertsPerDay);
    }
    if (request.filters !== undefined) {
      updateFields.push('filters = ?');
      updateValues.push(JSON.stringify(request.filters));
    }

    if (updateFields.length === 0) {
      return existing;
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(ruleId);

    await this.db.prepare(`
      UPDATE alert_rules SET ${updateFields.join(', ')} WHERE id = ?
    `).bind(...updateValues).run();

    const updated = await this.getAlertRule(ruleId, userId);
    if (!updated) {
      throw new Error('Failed to retrieve updated alert rule');
    }
    return updated;
  }

  /**
   * Delete an alert rule
   */
  async deleteAlertRule(ruleId: string, userId: string): Promise<void> {
    const existing = await this.getAlertRule(ruleId, userId);
    if (!existing) {
      throw new Error('Alert rule not found');
    }

    // Delete associated data (cascade should handle this, but being explicit)
    await this.db.prepare('DELETE FROM alert_rule_channels WHERE alert_rule_id = ?').bind(ruleId).run();
    await this.db.prepare('DELETE FROM alert_instances WHERE alert_rule_id = ?').bind(ruleId).run();
    await this.db.prepare('DELETE FROM alert_evaluations WHERE alert_rule_id = ?').bind(ruleId).run();
    await this.db.prepare('DELETE FROM alert_rules WHERE id = ?').bind(ruleId).run();
  }

  /**
   * Get alert rule by ID
   */
  async getAlertRule(ruleId: string, userId?: string): Promise<AlertRule | null> {
    const query = userId 
      ? 'SELECT * FROM alert_rules WHERE id = ? AND user_id = ?'
      : 'SELECT * FROM alert_rules WHERE id = ?';
    
    const params = userId ? [ruleId, userId] : [ruleId];
    const result = await this.db.prepare(query).bind(...params).first();
    
    return result ? this.mapDatabaseRowToAlertRule(result) : null;
  }

  /**
   * List alert rules for a user
   */
  async listAlertRules(userId?: string, query?: AlertMetricsQuery): Promise<AlertRule[]> {
    let sql = 'SELECT * FROM alert_rules';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }

    if (query?.alertType) {
      conditions.push('alert_type = ?');
      params.push(query.alertType);
    }

    if (query?.severity) {
      conditions.push('severity = ?');
      params.push(query.severity);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY priority DESC, created_at DESC';

    if (query?.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query?.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const results = await this.db.prepare(sql).bind(...params).all();
    return results.results.map(this.mapDatabaseRowToAlertRule);
  }

  // ============================================================================
  // Alert Instance Management
  // ============================================================================

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string, request: AlertAcknowledgeRequest): Promise<AlertInstance> {
    const alert = await this.getAlertInstance(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.state !== 'active') {
      throw new Error('Only active alerts can be acknowledged');
    }

    const now = new Date().toISOString();
    await this.db.prepare(`
      UPDATE alert_instances 
      SET state = 'acknowledged', acknowledged_at = ?, acknowledged_by = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, userId, request.notes, now, alertId).run();

    const updated = await this.getAlertInstance(alertId);
    if (!updated) {
      throw new Error('Failed to retrieve updated alert instance');
    }
    return updated;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, userId: string, request: AlertResolveRequest): Promise<AlertInstance> {
    const alert = await this.getAlertInstance(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.state === 'resolved') {
      throw new Error('Alert is already resolved');
    }

    const now = new Date().toISOString();
    await this.db.prepare(`
      UPDATE alert_instances 
      SET state = 'resolved', resolved_at = ?, resolved_by = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, userId, request.notes, now, alertId).run();

    // Update alert rule state if no other active alerts
    const activeCount = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_instances 
      WHERE alert_rule_id = ? AND state = 'active'
    `).bind(alert.alertRuleId).first();

    if (activeCount?.count === 0) {
      await this.db.prepare(`
        UPDATE alert_rules SET state = 'inactive' WHERE id = ?
      `).bind(alert.alertRuleId).run();
    }

    const updated = await this.getAlertInstance(alertId);
    if (!updated) {
      throw new Error('Failed to retrieve updated alert instance');
    }
    return updated;
  }

  /**
   * Get alert instance by ID
   */
  async getAlertInstance(alertId: string): Promise<AlertInstance | null> {
    const result = await this.db.prepare('SELECT * FROM alert_instances WHERE id = ?').bind(alertId).first();
    return result ? this.mapDatabaseRowToAlertInstance(result) : null;
  }

  /**
   * List alert instances
   */
  async listAlertInstances(userId?: string, query?: AlertMetricsQuery): Promise<AlertInstance[]> {
    let sql = `
      SELECT ai.* FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (userId) {
      conditions.push('ar.user_id = ?');
      params.push(userId);
    }

    if (query?.state) {
      conditions.push('ai.state = ?');
      params.push(query.state);
    }

    if (query?.severity) {
      conditions.push('ar.severity = ?');
      params.push(query.severity);
    }

    if (query?.timeRange) {
      conditions.push('ai.started_at >= ? AND ai.started_at <= ?');
      params.push(query.timeRange.startTime, query.timeRange.endTime);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY ai.started_at DESC';

    if (query?.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query?.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const results = await this.db.prepare(sql).bind(...params).all();
    return results.results.map(this.mapDatabaseRowToAlertInstance);
  }

  /**
   * Bulk operations on alerts
   */
  async bulkOperateAlerts(userId: string, request: AlertBulkOperationRequest): Promise<AlertBulkOperationResponse> {
    const response: AlertBulkOperationResponse = {
      success: true,
      processedCount: 0,
      errors: []
    };

    for (const alertId of request.alertInstanceIds) {
      try {
        switch (request.operation) {
          case 'acknowledge':
            await this.acknowledgeAlert(alertId, userId, { notes: request.notes });
            break;
          case 'resolve':
            await this.resolveAlert(alertId, userId, { notes: request.notes });
            break;
          case 'suppress':
            await this.suppressAlert(alertId, userId, request.notes);
            break;
          default:
            throw new Error(`Unknown operation: ${request.operation}`);
        }
        response.processedCount++;
      } catch (error) {
        response.errors.push({
          alertInstanceId: alertId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (response.errors.length > 0) {
      response.success = false;
    }

    return response;
  }

  /**
   * Test alert rule
   */
  async testAlertRule(ruleId: string, userId: string, request: AlertTestRequest): Promise<AlertTestResponse> {
    const rule = await this.getAlertRule(ruleId, userId);
    if (!rule) {
      throw new Error('Alert rule not found');
    }

    // Simulate evaluation with test value
    const thresholdBreached = this.evaluateThreshold(
      request.testValue,
      rule.thresholdValue,
      rule.thresholdOperator
    );

    // Count estimated notifications
    const channels = await this.db.prepare(`
      SELECT COUNT(*) as count FROM notification_channels nc
      JOIN alert_rule_channels arc ON nc.id = arc.notification_channel_id
      WHERE arc.alert_rule_id = ? AND nc.enabled = 1 AND arc.enabled = 1
    `).bind(ruleId).first();

    return {
      wouldTrigger: thresholdBreached,
      currentValue: request.testValue,
      thresholdValue: rule.thresholdValue,
      thresholdBreached,
      evaluationData: request.testContext || {},
      estimatedNotifications: channels?.count || 0
    };
  }

  // ============================================================================
  // Notification Channel Management
  // ============================================================================

  /**
   * Create notification channel
   */
  async createNotificationChannel(userId: string, request: NotificationChannelCreateRequest): Promise<NotificationChannel> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const channel: NotificationChannel = {
      id,
      name: request.name,
      channelType: request.channelType,
      userId,
      configuration: request.configuration,
      enabled: true,
      rateLimitPerHour: request.rateLimitPerHour || 10,
      maxRetries: request.maxRetries || 3,
      retryDelayMinutes: request.retryDelayMinutes || 5,
      subjectTemplate: request.subjectTemplate,
      bodyTemplate: request.bodyTemplate,
      createdAt: now,
      updatedAt: now
    };

    await this.db.prepare(`
      INSERT INTO notification_channels (
        id, name, channel_type, user_id, configuration, enabled,
        rate_limit_per_hour, max_retries, retry_delay_minutes,
        subject_template, body_template, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, channel.name, channel.channelType, userId,
      JSON.stringify(channel.configuration), 1,
      channel.rateLimitPerHour, channel.maxRetries, channel.retryDelayMinutes,
      channel.subjectTemplate, channel.bodyTemplate, channel.createdAt, channel.updatedAt
    ).run();

    return channel;
  }

  /**
   * Update notification channel
   */
  async updateNotificationChannel(channelId: string, userId: string, request: NotificationChannelUpdateRequest): Promise<NotificationChannel> {
    const existing = await this.getNotificationChannel(channelId, userId);
    if (!existing) {
      throw new Error('Notification channel not found');
    }

    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (request.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(request.name);
    }
    if (request.configuration !== undefined) {
      updateFields.push('configuration = ?');
      updateValues.push(JSON.stringify(request.configuration));
    }
    if (request.enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(request.enabled ? 1 : 0);
    }
    if (request.rateLimitPerHour !== undefined) {
      updateFields.push('rate_limit_per_hour = ?');
      updateValues.push(request.rateLimitPerHour);
    }
    if (request.maxRetries !== undefined) {
      updateFields.push('max_retries = ?');
      updateValues.push(request.maxRetries);
    }
    if (request.retryDelayMinutes !== undefined) {
      updateFields.push('retry_delay_minutes = ?');
      updateValues.push(request.retryDelayMinutes);
    }
    if (request.subjectTemplate !== undefined) {
      updateFields.push('subject_template = ?');
      updateValues.push(request.subjectTemplate);
    }
    if (request.bodyTemplate !== undefined) {
      updateFields.push('body_template = ?');
      updateValues.push(request.bodyTemplate);
    }

    if (updateFields.length === 0) {
      return existing;
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(channelId);

    await this.db.prepare(`
      UPDATE notification_channels SET ${updateFields.join(', ')} WHERE id = ?
    `).bind(...updateValues).run();

    const updated = await this.getNotificationChannel(channelId, userId);
    if (!updated) {
      throw new Error('Failed to retrieve updated notification channel');
    }
    return updated;
  }

  /**
   * Delete notification channel
   */
  async deleteNotificationChannel(channelId: string, userId: string): Promise<void> {
    const existing = await this.getNotificationChannel(channelId, userId);
    if (!existing) {
      throw new Error('Notification channel not found');
    }

    await this.db.prepare('DELETE FROM alert_rule_channels WHERE notification_channel_id = ?').bind(channelId).run();
    await this.db.prepare('DELETE FROM notification_channels WHERE id = ?').bind(channelId).run();
  }

  /**
   * Get notification channel by ID
   */
  async getNotificationChannel(channelId: string, userId?: string): Promise<NotificationChannel | null> {
    const query = userId 
      ? 'SELECT * FROM notification_channels WHERE id = ? AND user_id = ?'
      : 'SELECT * FROM notification_channels WHERE id = ?';
    
    const params = userId ? [channelId, userId] : [channelId];
    const result = await this.db.prepare(query).bind(...params).first();
    
    return result ? this.mapDatabaseRowToNotificationChannel(result) : null;
  }

  /**
   * List notification channels
   */
  async listNotificationChannels(userId?: string): Promise<NotificationChannel[]> {
    const query = userId 
      ? 'SELECT * FROM notification_channels WHERE user_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM notification_channels ORDER BY created_at DESC';
    
    const params = userId ? [userId] : [];
    const results = await this.db.prepare(query).bind(...params).all();
    
    return results.results.map(this.mapDatabaseRowToNotificationChannel);
  }

  /**
   * Associate channel with alert rule
   */
  async associateChannelWithRule(ruleId: string, channelId: string): Promise<void> {
    await this.db.prepare(`
      INSERT OR IGNORE INTO alert_rule_channels (
        id, alert_rule_id, notification_channel_id, enabled, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), ruleId, channelId, 1, new Date().toISOString()
    ).run();
  }

  /**
   * Dissociate channel from alert rule
   */
  async dissociateChannelFromRule(ruleId: string, channelId: string): Promise<void> {
    await this.db.prepare(`
      DELETE FROM alert_rule_channels 
      WHERE alert_rule_id = ? AND notification_channel_id = ?
    `).bind(ruleId, channelId).run();
  }

  // ============================================================================
  // Dashboard and Analytics
  // ============================================================================

  /**
   * Get alert dashboard data
   */
  async getAlertDashboard(userId?: string): Promise<AlertDashboardData> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];

    // Get overview statistics
    const overview = await this.db.prepare(`
      SELECT 
        COUNT(ai.id) as total_alerts,
        COUNT(CASE WHEN ai.state = 'active' THEN 1 END) as active_alerts,
        COUNT(CASE WHEN ai.state = 'acknowledged' THEN 1 END) as acknowledged_alerts,
        COUNT(CASE WHEN ai.state = 'resolved' THEN 1 END) as resolved_alerts
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.created_at >= date('now', '-30 days') ${userFilter}
    `).bind(...params).first();

    // Get alerts by type
    const alertsByType = await this.db.prepare(`
      SELECT ar.alert_type, COUNT(ai.id) as count
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.created_at >= date('now', '-30 days') ${userFilter}
      GROUP BY ar.alert_type
    `).bind(...params).all();

    // Get alerts by severity
    const alertsBySeverity = await this.db.prepare(`
      SELECT ar.severity, COUNT(ai.id) as count
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.created_at >= date('now', '-30 days') ${userFilter}
      GROUP BY ar.severity
    `).bind(...params).all();

    // Get alerts by state
    const alertsByState = await this.db.prepare(`
      SELECT ai.state, COUNT(ai.id) as count
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.created_at >= date('now', '-30 days') ${userFilter}
      GROUP BY ai.state
    `).bind(...params).all();

    // Get recent alerts
    const recentAlerts = await this.db.prepare(`
      SELECT ai.* FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE 1=1 ${userFilter}
      ORDER BY ai.started_at DESC
      LIMIT 10
    `).bind(...params).all();

    return {
      totalAlerts: overview?.total_alerts || 0,
      activeAlerts: overview?.active_alerts || 0,
      acknowledgedAlerts: overview?.acknowledged_alerts || 0,
      resolvedAlerts: overview?.resolved_alerts || 0,
      alertsByType: this.arrayToRecord(alertsByType.results, 'alert_type', 'count'),
      alertsBySeverity: this.arrayToRecord(alertsBySeverity.results, 'severity', 'count'),
      alertsByState: this.arrayToRecord(alertsByState.results, 'state', 'count'),
      recentAlerts: recentAlerts.results.map(this.mapDatabaseRowToAlertInstance),
      notificationStats: await this.getNotificationStats(userId),
      evaluationMetrics: await this.getEvaluationMetrics(userId)
    };
  }

  /**
   * Get alert history
   */
  async getAlertHistory(userId?: string, query?: AlertMetricsQuery): Promise<AlertHistoryItem[]> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];

    let sql = `
      SELECT 
        ai.id,
        ai.alert_rule_id,
        ar.name as alert_rule_name,
        ar.alert_type,
        ar.severity,
        ai.state,
        ai.current_value,
        ai.threshold_value,
        ai.started_at,
        ai.resolved_at,
        ai.acknowledged_by,
        ai.resolved_by,
        ai.notes,
        (julianday(COALESCE(ai.resolved_at, datetime('now'))) - julianday(ai.started_at)) * 24 * 60 as duration_minutes
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE 1=1 ${userFilter}
    `;

    if (query?.timeRange) {
      sql += ' AND ai.started_at >= ? AND ai.started_at <= ?';
      params.push(query.timeRange.startTime, query.timeRange.endTime);
    }

    if (query?.alertType) {
      sql += ' AND ar.alert_type = ?';
      params.push(query.alertType);
    }

    if (query?.severity) {
      sql += ' AND ar.severity = ?';
      params.push(query.severity);
    }

    if (query?.state) {
      sql += ' AND ai.state = ?';
      params.push(query.state);
    }

    sql += ' ORDER BY ai.started_at DESC';

    if (query?.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query?.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const results = await this.db.prepare(sql).bind(...params).all();

    return results.results.map((row: DatabaseRow): AlertHistoryItem => ({
      id: row.id,
      alertRuleId: row.alert_rule_id,
      alertRuleName: row.alert_rule_name,
      alertType: row.alert_type,
      severity: row.severity,
      state: row.state,
      currentValue: row.current_value,
      thresholdValue: row.threshold_value,
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      duration: row.duration_minutes,
      acknowledgedBy: row.acknowledged_by,
      resolvedBy: row.resolved_by,
      notes: row.notes
    }));
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async suppressAlert(alertId: string, userId: string, notes?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      UPDATE alert_instances 
      SET state = 'suppressed', notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(notes, now, alertId).run();
  }

  private evaluateThreshold(currentValue: number, thresholdValue: number, operator: string): boolean {
    switch (operator) {
      case '>': return currentValue > thresholdValue;
      case '<': return currentValue < thresholdValue;
      case '>=': return currentValue >= thresholdValue;
      case '<=': return currentValue <= thresholdValue;
      case '=': return currentValue === thresholdValue;
      case '!=': return currentValue !== thresholdValue;
      default: return false;
    }
  }

  private async getNotificationStats(userId?: string): Promise<NotificationStats> {
    const userFilter = userId ? 'AND nc.user_id = ?' : '';
    const params = userId ? [userId] : [];

    const stats = await this.db.prepare(`
      SELECT 
        COUNT(nd.id) as total_deliveries,
        COUNT(CASE WHEN nd.delivery_status = 'sent' OR nd.delivery_status = 'delivered' THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN nd.delivery_status = 'failed' THEN 1 END) as failed_deliveries
      FROM notification_deliveries nd
      JOIN notification_channels nc ON nd.notification_channel_id = nc.id
      WHERE nd.created_at >= date('now', '-30 days') ${userFilter}
    `).bind(...params).first();

    return {
      totalDeliveries: stats?.total_deliveries || 0,
      successfulDeliveries: stats?.successful_deliveries || 0,
      failedDeliveries: stats?.failed_deliveries || 0,
      deliveryRate: stats?.total_deliveries > 0 ? (stats.successful_deliveries / stats.total_deliveries) * 100 : 0,
      averageDeliveryTime: 0, // Would calculate from delivery timestamps
      deliveriesByChannel: {}
    };
  }

  private async getEvaluationMetrics(userId?: string): Promise<EvaluationMetrics> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];

    const metrics = await this.db.prepare(`
      SELECT 
        COUNT(ae.id) as total_evaluations,
        COUNT(CASE WHEN ae.threshold_breached = 1 THEN 1 END) as threshold_breaches,
        COUNT(CASE WHEN ae.alert_triggered = 1 THEN 1 END) as alerts_triggered,
        AVG(ae.evaluation_duration_ms) as avg_evaluation_time
      FROM alert_evaluations ae
      JOIN alert_rules ar ON ae.alert_rule_id = ar.id
      WHERE ae.created_at >= date('now', '-30 days') ${userFilter}
    `).bind(...params).first();

    return {
      totalEvaluations: metrics?.total_evaluations || 0,
      evaluationsPerMinute: 0, // Would calculate based on time range
      averageEvaluationTime: metrics?.avg_evaluation_time || 0,
      thresholdBreaches: metrics?.threshold_breaches || 0,
      alertsTrigger: metrics?.alerts_triggered || 0,
      alertTriggerRate: metrics?.total_evaluations > 0 ? (metrics.alerts_triggered / metrics.total_evaluations) * 100 : 0
    };
  }

  private arrayToRecord(array: DatabaseRow[], keyField: string, valueField: string): Record<string, number> {
    const record: Record<string, number> = {};
    array.forEach(item => {
      record[item[keyField]] = item[valueField];
    });
    return record;
  }

  private mapDatabaseRowToAlertRule(row: DatabaseRow): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      alertType: row.alert_type,
      metricType: row.metric_type,
      thresholdValue: row.threshold_value,
      thresholdOperator: row.threshold_operator,
      thresholdUnit: row.threshold_unit,
      comparisonType: row.comparison_type,
      comparisonWindow: row.comparison_window,
      minDurationMinutes: row.min_duration_minutes,
      evaluationFrequencyMinutes: row.evaluation_frequency_minutes,
      aggregationMethod: row.aggregation_method,
      severity: row.severity,
      priority: row.priority,
      enabled: row.enabled === 1,
      state: row.state,
      suppressionDurationMinutes: row.suppression_duration_minutes,
      maxAlertsPerDay: row.max_alerts_per_day,
      filters: row.filters ? JSON.parse(row.filters) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastEvaluatedAt: row.last_evaluated_at,
      lastTriggeredAt: row.last_triggered_at
    };
  }

  private mapDatabaseRowToAlertInstance(row: DatabaseRow): AlertInstance {
    return {
      id: row.id,
      alertRuleId: row.alert_rule_id,
      alertLevel: row.alert_level,
      currentValue: row.current_value,
      thresholdValue: row.threshold_value,
      state: row.state,
      startedAt: row.started_at,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      acknowledgedBy: row.acknowledged_by,
      resolvedBy: row.resolved_by,
      notes: row.notes,
      context: row.context ? JSON.parse(row.context) : undefined,
      affectedResources: row.affected_resources ? JSON.parse(row.affected_resources) : undefined,
      escalationLevel: row.escalation_level,
      escalatedAt: row.escalated_at,
      escalatedTo: row.escalated_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDatabaseRowToNotificationChannel(row: DatabaseRow): NotificationChannel {
    return {
      id: row.id,
      name: row.name,
      channelType: row.channel_type,
      userId: row.user_id,
      configuration: JSON.parse(row.configuration),
      enabled: row.enabled === 1,
      rateLimitPerHour: row.rate_limit_per_hour,
      maxRetries: row.max_retries,
      retryDelayMinutes: row.retry_delay_minutes,
      subjectTemplate: row.subject_template,
      bodyTemplate: row.body_template,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at
    };
  }
}

// Type definitions
interface DatabaseRow {
  [key: string]: unknown;
}

interface NotificationStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  deliveriesByChannel: Record<string, unknown>;
}

interface EvaluationMetrics {
  totalEvaluations: number;
  evaluationsPerMinute: number;
  averageEvaluationTime: number;
  thresholdBreaches: number;
  alertsTrigger: number;
  alertTriggerRate: number;
}