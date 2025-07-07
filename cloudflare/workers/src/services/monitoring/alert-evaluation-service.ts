/**
 * Alert Evaluation Service
 * Handles real-time evaluation of alert rules against metrics data
 */

import { 
  AlertRule, 
  AlertInstance, 
  AlertEvaluation, 
  AlertEvaluationContext,
  AlertType,
  MetricType,
  ComparisonType,
  ThresholdOperator,
  AlertLevel,
  AlertInstanceState
} from '../../types/alerts.js';
import { MetricsQueryService } from './query-service.js';
import { CostCalculator } from './cost-calculator.js';

export class AlertEvaluationService {
  private queryService: MetricsQueryService;
  private costCalculator: CostCalculator;

  constructor(
    private db: D1Database,
    private analytics: AnalyticsEngineDataset,
    queryService?: MetricsQueryService,
    costCalculator?: CostCalculator
  ) {
    this.queryService = queryService || new MetricsQueryService(db);
    this.costCalculator = costCalculator || new CostCalculator(db);
  }

  /**
   * Evaluate all enabled alert rules
   */
  async evaluateAllAlerts(): Promise<AlertEvaluation[]> {
    const enabledRules = await this.getEnabledAlertRules();
    const evaluations: AlertEvaluation[] = [];

    for (const rule of enabledRules) {
      try {
        const evaluation = await this.evaluateAlertRule(rule);
        evaluations.push(evaluation);
      } catch (error) {
        console.error(`Error evaluating alert rule ${rule.id}:`, error);
        // Continue with other rules even if one fails
      }
    }

    return evaluations;
  }

  /**
   * Evaluate a specific alert rule
   */
  async evaluateAlertRule(rule: AlertRule): Promise<AlertEvaluation> {
    const context = await this.buildEvaluationContext(rule);
    const currentValue = await this.getCurrentValue(rule, context);
    const thresholdValue = await this.getThresholdValue(rule, context);
    
    const thresholdBreached = this.evaluateThreshold(
      currentValue,
      thresholdValue,
      rule.thresholdOperator
    );

    // Check if alert should be triggered (considering duration and existing alerts)
    const shouldTrigger = await this.shouldTriggerAlert(rule, thresholdBreached, context);
    
    let alertInstanceId: string | undefined;
    
    if (shouldTrigger) {
      alertInstanceId = await this.createAlertInstance(rule, currentValue, thresholdValue);
    } else if (!thresholdBreached) {
      // Check if we should resolve any existing alerts
      await this.resolveExistingAlerts(rule);
    }

    // Record the evaluation
    const evaluation: AlertEvaluation = {
      id: this.generateId(),
      alertRuleId: rule.id,
      evaluationTime: new Date().toISOString(),
      currentValue,
      thresholdValue,
      thresholdBreached,
      alertTriggered: shouldTrigger,
      alertInstanceId,
      evaluationData: context.metrics,
      evaluationDurationMs: 0,
      createdAt: new Date().toISOString()
    };

    await this.saveEvaluation(evaluation);
    
    // Update rule's last evaluated timestamp
    await this.updateRuleLastEvaluated(rule.id);

    return evaluation;
  }

  /**
   * Get current value for the alert rule
   */
  private async getCurrentValue(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    const { alertType, metricType, comparisonType, comparisonWindow, aggregationMethod } = rule;

    switch (alertType) {
      case 'cost_spike':
        return this.evaluateCostSpike(rule, context);
      
      case 'error_rate':
        return this.evaluateErrorRate(rule, context);
      
      case 'performance':
        return this.evaluatePerformance(rule, context);
      
      case 'storage_growth':
        return this.evaluateStorageGrowth(rule, context);
      
      case 'quota_violation':
        return this.evaluateQuotaViolation(rule, context);
      
      case 'custom':
        return this.evaluateCustomMetric(rule, context);
      
      default:
        throw new Error(`Unknown alert type: ${alertType}`);
    }
  }

  /**
   * Evaluate cost spike alerts
   */
  private async evaluateCostSpike(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    const userId = rule.userId;
    if (!userId) {
      throw new Error('Cost spike alerts require a user ID');
    }

    const { comparisonType, comparisonWindow } = rule;
    
    if (comparisonType === 'month_over_month') {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      const previousMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7) + '-01';
      
      const currentCost = await this.costCalculator.calculateMonthlyCost(userId, currentMonth);
      const previousCost = await this.costCalculator.calculateMonthlyCost(userId, previousMonth);
      
      if (previousCost === 0) return 0;
      
      return ((currentCost - previousCost) / previousCost) * 100;
    }
    
    if (comparisonType === 'week_over_week') {
      const currentWeek = this.getWeekStartDate(new Date());
      const previousWeek = this.getWeekStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      
      const currentCost = await this.costCalculator.calculateWeeklyCost(userId, currentWeek);
      const previousCost = await this.costCalculator.calculateWeeklyCost(userId, previousWeek);
      
      if (previousCost === 0) return 0;
      
      return ((currentCost - previousCost) / previousCost) * 100;
    }
    
    if (comparisonType === 'percentage_change') {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      
      const todayCost = await this.costCalculator.calculateDailyCost(userId, today);
      const yesterdayCost = await this.costCalculator.calculateDailyCost(userId, yesterday);
      
      if (yesterdayCost === 0) return 0;
      
      return ((todayCost - yesterdayCost) / yesterdayCost) * 100;
    }
    
    throw new Error(`Unsupported comparison type for cost spike: ${comparisonType}`);
  }

  /**
   * Evaluate error rate alerts
   */
  private async evaluateErrorRate(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    const { timeWindow } = context;
    const userId = rule.userId;
    
    const query = `
      SELECT 
        COUNT(*) as total_operations,
        COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations
      FROM storage_metrics_raw
      WHERE 
        timestamp >= ? AND timestamp <= ?
        ${userId ? 'AND user_id = ?' : ''}
    `;
    
    const params = [timeWindow.startTime, timeWindow.endTime];
    if (userId) params.push(userId);
    
    const result = await this.db.prepare(query).bind(...params).first();
    
    if (!result || result.total_operations === 0) return 0;
    
    return (result.failed_operations / result.total_operations) * 100;
  }

  /**
   * Evaluate performance alerts
   */
  private async evaluatePerformance(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    const { timeWindow } = context;
    const userId = rule.userId;
    const { metricType, aggregationMethod } = rule;
    
    let field: string;
    switch (metricType) {
      case 'response_time':
        field = 'total_duration_ms';
        break;
      case 'throughput':
        field = 'avg_throughput_bps';
        break;
      default:
        throw new Error(`Unsupported metric type for performance: ${metricType}`);
    }
    
    const aggregationFunc = aggregationMethod.toUpperCase();
    
    const query = `
      SELECT ${aggregationFunc}(${field}) as value
      FROM storage_metrics_raw
      WHERE 
        timestamp >= ? AND timestamp <= ?
        ${userId ? 'AND user_id = ?' : ''}
        AND ${field} > 0
    `;
    
    const params = [timeWindow.startTime, timeWindow.endTime];
    if (userId) params.push(userId);
    
    const result = await this.db.prepare(query).bind(...params).first();
    
    return result?.value || 0;
  }

  /**
   * Evaluate storage growth alerts
   */
  private async evaluateStorageGrowth(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    const userId = rule.userId;
    if (!userId) {
      throw new Error('Storage growth alerts require a user ID');
    }

    const { comparisonType } = rule;
    
    if (comparisonType === 'week_over_week') {
      const currentWeek = this.getWeekStartDate(new Date());
      const previousWeek = this.getWeekStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      
      const currentStorage = await this.queryService.getUserStorageUsage(userId, currentWeek);
      const previousStorage = await this.queryService.getUserStorageUsage(userId, previousWeek);
      
      if (previousStorage === 0) return 0;
      
      return ((currentStorage - previousStorage) / previousStorage) * 100;
    }
    
    if (comparisonType === 'month_over_month') {
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
      const previousMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7) + '-01';
      
      const currentStorage = await this.queryService.getUserStorageUsage(userId, currentMonth);
      const previousStorage = await this.queryService.getUserStorageUsage(userId, previousMonth);
      
      if (previousStorage === 0) return 0;
      
      return ((currentStorage - previousStorage) / previousStorage) * 100;
    }
    
    throw new Error(`Unsupported comparison type for storage growth: ${comparisonType}`);
  }

  /**
   * Evaluate quota violation alerts
   */
  private async evaluateQuotaViolation(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    const userId = rule.userId;
    if (!userId) {
      throw new Error('Quota violation alerts require a user ID');
    }

    const quota = await this.db.prepare(
      'SELECT * FROM user_storage_quotas WHERE user_id = ?'
    ).bind(userId).first();

    if (!quota) return 0;

    const usage = await this.queryService.getUserStorageUsage(userId);
    
    switch (rule.metricType) {
      case 'storage_bytes':
        return (usage / quota.max_storage_bytes) * 100;
      
      default:
        throw new Error(`Unsupported metric type for quota violation: ${rule.metricType}`);
    }
  }

  /**
   * Evaluate custom metric alerts
   */
  private async evaluateCustomMetric(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    // This would be implemented based on custom metric definitions
    // For now, return 0 as a placeholder
    return 0;
  }

  /**
   * Get threshold value (may be dynamic based on comparison type)
   */
  private async getThresholdValue(rule: AlertRule, context: AlertEvaluationContext): Promise<number> {
    return rule.thresholdValue;
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(currentValue: number, thresholdValue: number, operator: ThresholdOperator): boolean {
    switch (operator) {
      case '>':
        return currentValue > thresholdValue;
      case '<':
        return currentValue < thresholdValue;
      case '>=':
        return currentValue >= thresholdValue;
      case '<=':
        return currentValue <= thresholdValue;
      case '=':
        return currentValue === thresholdValue;
      case '!=':
        return currentValue !== thresholdValue;
      default:
        throw new Error(`Unknown threshold operator: ${operator}`);
    }
  }

  /**
   * Determine if alert should be triggered
   */
  private async shouldTriggerAlert(
    rule: AlertRule,
    thresholdBreached: boolean,
    context: AlertEvaluationContext
  ): Promise<boolean> {
    if (!thresholdBreached) return false;

    // Check if there's already an active alert
    const existingAlert = await this.getActiveAlert(rule.id);
    if (existingAlert) return false;

    // Check minimum duration requirement
    if (rule.minDurationMinutes > 0) {
      const recentBreaches = await this.getRecentThresholdBreaches(rule.id, rule.minDurationMinutes);
      if (recentBreaches < rule.minDurationMinutes / rule.evaluationFrequencyMinutes) {
        return false;
      }
    }

    // Check suppression rules
    if (await this.isAlertSuppressed(rule)) return false;

    // Check daily alert limit
    if (await this.hasExceededDailyLimit(rule)) return false;

    return true;
  }

  /**
   * Create a new alert instance
   */
  private async createAlertInstance(rule: AlertRule, currentValue: number, thresholdValue: number): Promise<string> {
    const alertLevel: AlertLevel = rule.severity === 'critical' ? 'critical' : 'warning';
    
    const alertInstance: Partial<AlertInstance> = {
      id: this.generateId(),
      alertRuleId: rule.id,
      alertLevel,
      currentValue,
      thresholdValue,
      state: 'active',
      startedAt: new Date().toISOString(),
      escalationLevel: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.db.prepare(`
      INSERT INTO alert_instances (
        id, alert_rule_id, alert_level, current_value, threshold_value,
        state, started_at, escalation_level, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      alertInstance.id,
      alertInstance.alertRuleId,
      alertInstance.alertLevel,
      alertInstance.currentValue,
      alertInstance.thresholdValue,
      alertInstance.state,
      alertInstance.startedAt,
      alertInstance.escalationLevel,
      alertInstance.createdAt,
      alertInstance.updatedAt
    ).run();

    // Update alert rule state
    await this.db.prepare(`
      UPDATE alert_rules 
      SET state = 'active', last_triggered_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), rule.id).run();

    return alertInstance.id!;
  }

  /**
   * Resolve existing alerts when threshold is no longer breached
   */
  private async resolveExistingAlerts(rule: AlertRule): Promise<void> {
    const activeAlerts = await this.db.prepare(`
      SELECT id FROM alert_instances 
      WHERE alert_rule_id = ? AND state = 'active'
    `).bind(rule.id).all();

    for (const alert of activeAlerts.results) {
      await this.db.prepare(`
        UPDATE alert_instances 
        SET state = 'resolved', resolved_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        new Date().toISOString(),
        new Date().toISOString(),
        alert.id
      ).run();
    }

    // Update alert rule state if no active alerts remain
    const remainingAlerts = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_instances 
      WHERE alert_rule_id = ? AND state = 'active'
    `).bind(rule.id).first();

    if (remainingAlerts?.count === 0) {
      await this.db.prepare(`
        UPDATE alert_rules SET state = 'inactive' WHERE id = ?
      `).bind(rule.id).run();
    }
  }

  /**
   * Build evaluation context
   */
  private async buildEvaluationContext(rule: AlertRule): Promise<AlertEvaluationContext> {
    const currentTimestamp = new Date().toISOString();
    const timeWindow = this.getTimeWindow(rule.comparisonWindow, currentTimestamp);
    
    const metrics = await this.queryService.getMetricsForTimeWindow(
      timeWindow.startTime,
      timeWindow.endTime,
      rule.userId
    );

    const previousEvaluations = await this.getPreviousEvaluations(rule.id, 10);
    const existingAlert = await this.getActiveAlert(rule.id);

    return {
      alertRule: rule,
      currentTimestamp,
      timeWindow,
      metrics,
      previousEvaluations,
      existingAlert
    };
  }

  /**
   * Get time window for comparison
   */
  private getTimeWindow(window: string, currentTimestamp: string): { startTime: string; endTime: string } {
    const current = new Date(currentTimestamp);
    let startTime: Date;

    switch (window) {
      case '1h':
        startTime = new Date(current.getTime() - 60 * 60 * 1000);
        break;
      case '1d':
        startTime = new Date(current.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1w':
        startTime = new Date(current.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        startTime = new Date(current.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        startTime = new Date(current.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        throw new Error(`Unknown time window: ${window}`);
    }

    return {
      startTime: startTime.toISOString(),
      endTime: current.toISOString()
    };
  }

  /**
   * Get week start date (Sunday)
   */
  private getWeekStartDate(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff)).toISOString().slice(0, 10);
  }

  /**
   * Get enabled alert rules
   */
  private async getEnabledAlertRules(): Promise<AlertRule[]> {
    const rules = await this.db.prepare(`
      SELECT * FROM alert_rules 
      WHERE enabled = 1 
      AND (last_evaluated_at IS NULL OR last_evaluated_at < datetime('now', '-' || evaluation_frequency_minutes || ' minutes'))
      ORDER BY priority DESC, last_evaluated_at ASC
    `).all();

    return rules.results.map(this.mapDatabaseRowToAlertRule);
  }

  /**
   * Get active alert for a rule
   */
  private async getActiveAlert(ruleId: string): Promise<AlertInstance | null> {
    const result = await this.db.prepare(`
      SELECT * FROM alert_instances 
      WHERE alert_rule_id = ? AND state = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `).bind(ruleId).first();

    return result ? this.mapDatabaseRowToAlertInstance(result) : null;
  }

  /**
   * Get recent threshold breaches
   */
  private async getRecentThresholdBreaches(ruleId: string, minutes: number): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_evaluations 
      WHERE alert_rule_id = ? 
      AND threshold_breached = 1 
      AND evaluation_time >= datetime('now', '-' || ? || ' minutes')
    `).bind(ruleId, minutes).first();

    return result?.count || 0;
  }

  /**
   * Check if alert is suppressed
   */
  private async isAlertSuppressed(rule: AlertRule): Promise<boolean> {
    // This would check suppression rules
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Check if daily alert limit is exceeded
   */
  private async hasExceededDailyLimit(rule: AlertRule): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_instances 
      WHERE alert_rule_id = ? 
      AND date(started_at) = ?
    `).bind(rule.id, today).first();

    return (result?.count || 0) >= rule.maxAlertsPerDay;
  }

  /**
   * Get previous evaluations
   */
  private async getPreviousEvaluations(ruleId: string, limit: number): Promise<AlertEvaluation[]> {
    const results = await this.db.prepare(`
      SELECT * FROM alert_evaluations 
      WHERE alert_rule_id = ? 
      ORDER BY evaluation_time DESC 
      LIMIT ?
    `).bind(ruleId, limit).all();

    return results.results.map(this.mapDatabaseRowToAlertEvaluation);
  }

  /**
   * Save evaluation to database
   */
  private async saveEvaluation(evaluation: AlertEvaluation): Promise<void> {
    await this.db.prepare(`
      INSERT INTO alert_evaluations (
        id, alert_rule_id, evaluation_time, current_value, threshold_value,
        threshold_breached, alert_triggered, alert_instance_id, evaluation_data,
        evaluation_duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      evaluation.id,
      evaluation.alertRuleId,
      evaluation.evaluationTime,
      evaluation.currentValue,
      evaluation.thresholdValue,
      evaluation.thresholdBreached ? 1 : 0,
      evaluation.alertTriggered ? 1 : 0,
      evaluation.alertInstanceId,
      JSON.stringify(evaluation.evaluationData),
      evaluation.evaluationDurationMs,
      evaluation.createdAt
    ).run();
  }

  /**
   * Update rule's last evaluated timestamp
   */
  private async updateRuleLastEvaluated(ruleId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE alert_rules 
      SET last_evaluated_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), ruleId).run();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Map database row to AlertRule
   */
  private mapDatabaseRowToAlertRule(row: any): AlertRule {
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

  /**
   * Map database row to AlertInstance
   */
  private mapDatabaseRowToAlertInstance(row: any): AlertInstance {
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

  /**
   * Map database row to AlertEvaluation
   */
  private mapDatabaseRowToAlertEvaluation(row: any): AlertEvaluation {
    return {
      id: row.id,
      alertRuleId: row.alert_rule_id,
      evaluationTime: row.evaluation_time,
      currentValue: row.current_value,
      thresholdValue: row.threshold_value,
      thresholdBreached: row.threshold_breached === 1,
      alertTriggered: row.alert_triggered === 1,
      alertInstanceId: row.alert_instance_id,
      evaluationData: row.evaluation_data ? JSON.parse(row.evaluation_data) : undefined,
      evaluationDurationMs: row.evaluation_duration_ms,
      createdAt: row.created_at
    };
  }
}