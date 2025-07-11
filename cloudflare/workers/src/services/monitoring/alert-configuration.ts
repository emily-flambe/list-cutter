import { AlertCreateRequest } from '../../types/alerts.js';

/**
 * Alert Configuration Service
 * Handles setup of default alert rules and configuration management
 */
export class AlertConfiguration {
  constructor(private db: D1Database) {}

  /**
   * Set up default alert rules for the system
   */
  async setupDefaultAlerts(): Promise<void> {
    const defaultAlerts: AlertCreateRequest[] = [
      // Cost monitoring alerts
      {
        name: 'High Monthly Cost',
        description: 'Alert when monthly cost exceeds threshold',
        alertType: 'cost_threshold',
        metricType: 'monthly_cost',
        thresholdValue: 100,
        thresholdOperator: '>',
        thresholdUnit: 'USD',
        severity: 'high',
        priority: 1,
        comparisonType: 'absolute',
        comparisonWindow: 'current_month',
        minDurationMinutes: 5,
        evaluationFrequencyMinutes: 360, // 6 hours
        suppressionDurationMinutes: 1440 // 24 hours
      },
      {
        name: 'Daily Cost Spike',
        description: 'Alert when daily cost increases significantly',
        alertType: 'cost_anomaly',
        metricType: 'daily_cost',
        thresholdValue: 50,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'medium',
        priority: 2,
        comparisonType: 'percentage_change',
        comparisonWindow: 'previous_day',
        minDurationMinutes: 30,
        evaluationFrequencyMinutes: 60,
        suppressionDurationMinutes: 360
      },
      
      // Performance alerts
      {
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds acceptable threshold',
        alertType: 'error_rate',
        metricType: 'error_rate',
        thresholdValue: 5,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'high',
        priority: 1,
        comparisonType: 'absolute',
        comparisonWindow: 'last_hour',
        minDurationMinutes: 10,
        evaluationFrequencyMinutes: 5,
        suppressionDurationMinutes: 60
      },
      {
        name: 'Slow Response Time',
        description: 'Alert when average response time is too high',
        alertType: 'performance',
        metricType: 'response_time',
        thresholdValue: 2000,
        thresholdOperator: '>',
        thresholdUnit: 'milliseconds',
        severity: 'medium',
        priority: 2,
        comparisonType: 'absolute',
        comparisonWindow: 'last_15_minutes',
        minDurationMinutes: 5,
        evaluationFrequencyMinutes: 5,
        suppressionDurationMinutes: 30
      },
      
      // Storage alerts
      {
        name: 'Storage Quota Warning',
        description: 'Alert when storage usage approaches quota limit',
        alertType: 'quota_usage',
        metricType: 'storage_usage',
        thresholdValue: 80,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'medium',
        priority: 2,
        comparisonType: 'absolute',
        comparisonWindow: 'current',
        minDurationMinutes: 15,
        evaluationFrequencyMinutes: 60,
        suppressionDurationMinutes: 360
      },
      {
        name: 'Storage Quota Critical',
        description: 'Critical alert when storage usage exceeds 95% of quota',
        alertType: 'quota_usage',
        metricType: 'storage_usage',
        thresholdValue: 95,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'critical',
        priority: 1,
        comparisonType: 'absolute',
        comparisonWindow: 'current',
        minDurationMinutes: 5,
        evaluationFrequencyMinutes: 15,
        suppressionDurationMinutes: 60
      },
      {
        name: 'Large File Upload',
        description: 'Alert when files larger than threshold are uploaded',
        alertType: 'file_size',
        metricType: 'file_size',
        thresholdValue: 1000000000, // 1GB
        thresholdOperator: '>',
        thresholdUnit: 'bytes',
        severity: 'low',
        priority: 3,
        comparisonType: 'absolute',
        comparisonWindow: 'current',
        minDurationMinutes: 1,
        evaluationFrequencyMinutes: 5,
        suppressionDurationMinutes: 60
      },
      
      // Security alerts
      {
        name: 'Multiple Failed Access',
        description: 'Alert when multiple failed access attempts detected',
        alertType: 'security_event',
        metricType: 'failed_access_count',
        thresholdValue: 10,
        thresholdOperator: '>',
        thresholdUnit: 'count',
        severity: 'high',
        priority: 1,
        comparisonType: 'absolute',
        comparisonWindow: 'last_hour',
        minDurationMinutes: 5,
        evaluationFrequencyMinutes: 5,
        suppressionDurationMinutes: 60
      },
      {
        name: 'Unusual Upload Pattern',
        description: 'Alert when unusual upload patterns are detected',
        alertType: 'anomaly',
        metricType: 'upload_rate',
        thresholdValue: 200,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'medium',
        priority: 2,
        comparisonType: 'percentage_change',
        comparisonWindow: 'previous_hour',
        minDurationMinutes: 15,
        evaluationFrequencyMinutes: 15,
        suppressionDurationMinutes: 120
      }
    ];

    for (const alert of defaultAlerts) {
      await this.createGlobalAlert(alert);
    }
  }

  /**
   * Create a global alert rule (not tied to specific user)
   */
  private async createGlobalAlert(alertConfig: AlertCreateRequest): Promise<void> {
    // Check if alert already exists
    const existing = await this.db.prepare(`
      SELECT id FROM alert_rules 
      WHERE name = ? AND user_id IS NULL
    `).bind(alertConfig.name).first();

    if (existing) {
      console.log(`Alert rule '${alertConfig.name}' already exists, skipping...`);
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

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
      id,
      alertConfig.name,
      alertConfig.description,
      null, // Global alert (no specific user)
      alertConfig.alertType,
      alertConfig.metricType,
      alertConfig.thresholdValue,
      alertConfig.thresholdOperator,
      alertConfig.thresholdUnit,
      alertConfig.comparisonType,
      alertConfig.comparisonWindow,
      alertConfig.minDurationMinutes,
      alertConfig.evaluationFrequencyMinutes,
      alertConfig.aggregationMethod || 'avg',
      alertConfig.severity,
      alertConfig.priority,
      1, // enabled
      'inactive',
      alertConfig.suppressionDurationMinutes,
      alertConfig.maxAlertsPerDay || 10,
      JSON.stringify(alertConfig.filters || {}),
      now,
      now
    ).run();

    console.log(`Created global alert rule: ${alertConfig.name}`);
  }

  /**
   * Create user-specific alert rules
   */
  async createUserAlerts(userId: string): Promise<void> {
    const userAlerts: AlertCreateRequest[] = [
      {
        name: 'Personal Storage Quota Warning',
        description: 'Alert when your storage usage approaches 80% of quota',
        alertType: 'quota_usage',
        metricType: 'storage_usage',
        thresholdValue: 80,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'medium',
        priority: 2,
        comparisonType: 'absolute',
        comparisonWindow: 'current',
        minDurationMinutes: 15,
        evaluationFrequencyMinutes: 60,
        suppressionDurationMinutes: 360,
        filters: { userId }
      },
      {
        name: 'Personal High Upload Activity',
        description: 'Alert when your upload activity is unusually high',
        alertType: 'anomaly',
        metricType: 'upload_count',
        thresholdValue: 300,
        thresholdOperator: '>',
        thresholdUnit: 'percent',
        severity: 'low',
        priority: 3,
        comparisonType: 'percentage_change',
        comparisonWindow: 'previous_day',
        minDurationMinutes: 30,
        evaluationFrequencyMinutes: 60,
        suppressionDurationMinutes: 360,
        filters: { userId }
      }
    ];

    for (const alert of userAlerts) {
      await this.createUserAlert(userId, alert);
    }
  }

  /**
   * Create a user-specific alert rule
   */
  private async createUserAlert(userId: string, alertConfig: AlertCreateRequest): Promise<void> {
    // Check if alert already exists for this user
    const existing = await this.db.prepare(`
      SELECT id FROM alert_rules 
      WHERE name = ? AND user_id = ?
    `).bind(alertConfig.name, userId).first();

    if (existing) {
      console.log(`Alert rule '${alertConfig.name}' already exists for user ${userId}, skipping...`);
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

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
      id,
      alertConfig.name,
      alertConfig.description,
      userId,
      alertConfig.alertType,
      alertConfig.metricType,
      alertConfig.thresholdValue,
      alertConfig.thresholdOperator,
      alertConfig.thresholdUnit,
      alertConfig.comparisonType,
      alertConfig.comparisonWindow,
      alertConfig.minDurationMinutes,
      alertConfig.evaluationFrequencyMinutes,
      alertConfig.aggregationMethod || 'avg',
      alertConfig.severity,
      alertConfig.priority,
      1, // enabled
      'inactive',
      alertConfig.suppressionDurationMinutes,
      alertConfig.maxAlertsPerDay || 10,
      JSON.stringify(alertConfig.filters || {}),
      now,
      now
    ).run();

    console.log(`Created user alert rule: ${alertConfig.name} for user ${userId}`);
  }

  /**
   * Update alert rule configuration
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertCreateRequest>): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: unknown[] = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updates.description);
    }
    if (updates.thresholdValue !== undefined) {
      updateFields.push('threshold_value = ?');
      updateValues.push(updates.thresholdValue);
    }
    if (updates.thresholdOperator !== undefined) {
      updateFields.push('threshold_operator = ?');
      updateValues.push(updates.thresholdOperator);
    }
    if (updates.severity !== undefined) {
      updateFields.push('severity = ?');
      updateValues.push(updates.severity);
    }
    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(updates.priority);
    }
    if (updates.evaluationFrequencyMinutes !== undefined) {
      updateFields.push('evaluation_frequency_minutes = ?');
      updateValues.push(updates.evaluationFrequencyMinutes);
    }
    if (updates.suppressionDurationMinutes !== undefined) {
      updateFields.push('suppression_duration_minutes = ?');
      updateValues.push(updates.suppressionDurationMinutes);
    }
    if (updates.filters !== undefined) {
      updateFields.push('filters = ?');
      updateValues.push(JSON.stringify(updates.filters));
    }

    if (updateFields.length === 0) {
      return;
    }

    updateFields.push('updated_at = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(ruleId);

    await this.db.prepare(`
      UPDATE alert_rules SET ${updateFields.join(', ')} WHERE id = ?
    `).bind(...updateValues).run();
  }

  /**
   * Enable/disable alert rule
   */
  async toggleAlertRule(ruleId: string, enabled: boolean): Promise<void> {
    await this.db.prepare(`
      UPDATE alert_rules SET enabled = ?, updated_at = ? WHERE id = ?
    `).bind(enabled ? 1 : 0, new Date().toISOString(), ruleId).run();
  }

  /**
   * Get all alert rules (for management purposes)
   */
  async getAllAlertRules(): Promise<AlertRuleInfo[]> {
    const result = await this.db.prepare(`
      SELECT 
        id, name, description, user_id, alert_type, metric_type,
        threshold_value, threshold_operator, threshold_unit,
        severity, priority, enabled, state, created_at, updated_at
      FROM alert_rules
      ORDER BY priority ASC, created_at DESC
    `).all();

    return result.results.map((row: DatabaseRow) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      userId: row.user_id ? String(row.user_id) : null,
      alertType: String(row.alert_type),
      metricType: String(row.metric_type),
      thresholdValue: Number(row.threshold_value),
      thresholdOperator: String(row.threshold_operator),
      thresholdUnit: String(row.threshold_unit),
      severity: String(row.severity),
      priority: Number(row.priority),
      enabled: Boolean(row.enabled),
      state: String(row.state),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }));
  }

  /**
   * Get alert rules for a specific user
   */
  async getUserAlertRules(userId: string): Promise<AlertRuleInfo[]> {
    const result = await this.db.prepare(`
      SELECT 
        id, name, description, user_id, alert_type, metric_type,
        threshold_value, threshold_operator, threshold_unit,
        severity, priority, enabled, state, created_at, updated_at
      FROM alert_rules
      WHERE user_id = ? OR user_id IS NULL
      ORDER BY priority ASC, created_at DESC
    `).bind(userId).all();

    return result.results.map((row: DatabaseRow) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      userId: row.user_id ? String(row.user_id) : null,
      alertType: String(row.alert_type),
      metricType: String(row.metric_type),
      thresholdValue: Number(row.threshold_value),
      thresholdOperator: String(row.threshold_operator),
      thresholdUnit: String(row.threshold_unit),
      severity: String(row.severity),
      priority: Number(row.priority),
      enabled: Boolean(row.enabled),
      state: String(row.state),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }));
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    // Delete associated data first
    await this.db.prepare('DELETE FROM alert_instances WHERE alert_rule_id = ?').bind(ruleId).run();
    await this.db.prepare('DELETE FROM alert_evaluations WHERE alert_rule_id = ?').bind(ruleId).run();
    await this.db.prepare('DELETE FROM alert_rule_channels WHERE alert_rule_id = ?').bind(ruleId).run();
    
    // Delete the rule itself
    await this.db.prepare('DELETE FROM alert_rules WHERE id = ?').bind(ruleId).run();
  }
}

// Type definitions
interface AlertRuleInfo {
  id: string;
  name: string;
  description: string;
  userId: string | null;
  alertType: string;
  metricType: string;
  thresholdValue: number;
  thresholdOperator: string;
  thresholdUnit: string;
  severity: string;
  priority: number;
  enabled: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseRow {
  [key: string]: unknown;
}