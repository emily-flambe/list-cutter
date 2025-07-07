/**
 * Alert Scheduler Service
 * Handles scheduled evaluation of alerts, escalations, and cleanup tasks
 */

import {
  AlertEscalationPolicy,
  AlertSuppressionRule,
  AlertSuppressionContext,
  AlertNotificationContext,
  AlertInstance,
  AlertRule
} from '../../types/alerts';
import { AlertEvaluationService } from './alert-evaluation-service';
import { AlertManagementService } from './alert-management-service';
import { NotificationService } from './notification-service';

export class AlertSchedulerService {
  private evaluationService: AlertEvaluationService;
  private managementService: AlertManagementService;
  private notificationService: NotificationService;

  constructor(
    private db: D1Database,
    private analytics: AnalyticsEngineDataset,
    evaluationService?: AlertEvaluationService,
    managementService?: AlertManagementService,
    notificationService?: NotificationService
  ) {
    this.evaluationService = evaluationService || new AlertEvaluationService(db, analytics);
    this.managementService = managementService || new AlertManagementService(db, analytics);
    this.notificationService = notificationService || new NotificationService(db);
  }

  /**
   * Main scheduled alert evaluation job
   * Should be called every 1-5 minutes via cron
   */
  async runAlertEvaluation(): Promise<{ 
    evaluatedRules: number; 
    triggeredAlerts: number; 
    sentNotifications: number;
    errors: string[];
  }> {
    const result = {
      evaluatedRules: 0,
      triggeredAlerts: 0,
      sentNotifications: 0,
      errors: [] as string[]
    };

    try {
      console.log('Starting scheduled alert evaluation...');

      // Evaluate all enabled alert rules
      const evaluations = await this.evaluationService.evaluateAllAlerts();
      result.evaluatedRules = evaluations.length;

      // Process triggered alerts
      for (const evaluation of evaluations) {
        if (evaluation.alertTriggered && evaluation.alertInstanceId) {
          try {
            result.triggeredAlerts++;

            // Send notifications for the triggered alert
            const notificationCount = await this.processAlertNotifications(evaluation.alertInstanceId);
            result.sentNotifications += notificationCount;

          } catch (error) {
            const errorMsg = `Failed to process alert ${evaluation.alertInstanceId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }
      }

      // Check for escalations
      await this.processAlertEscalations();

      // Clean up suppressed alerts
      await this.processSuppressionCleanup();

      console.log(`Alert evaluation completed: ${result.evaluatedRules} rules evaluated, ${result.triggeredAlerts} alerts triggered, ${result.sentNotifications} notifications sent`);

    } catch (error) {
      const errorMsg = `Alert evaluation job failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * Process alert notifications for a triggered alert
   */
  private async processAlertNotifications(alertInstanceId: string): Promise<number> {
    const alertInstance = await this.managementService.getAlertInstance(alertInstanceId);
    if (!alertInstance) {
      throw new Error('Alert instance not found');
    }

    const alertRule = await this.managementService.getAlertRule(alertInstance.alertRuleId);
    if (!alertRule) {
      throw new Error('Alert rule not found');
    }

    // Check if alert is suppressed
    if (await this.isAlertSuppressed(alertRule, alertInstance)) {
      console.log(`Alert ${alertInstanceId} is suppressed, skipping notifications`);
      return 0;
    }

    // Get user information if needed
    let user;
    if (alertRule.userId) {
      const userResult = await this.db.prepare('SELECT id, email, username FROM users WHERE id = ?')
        .bind(alertRule.userId).first();
      if (userResult) {
        user = {
          id: userResult.id,
          email: userResult.email,
          username: userResult.username
        };
      }
    }

    // Build notification context
    const context: AlertNotificationContext = {
      alert: alertInstance,
      alertRule,
      user,
      currentValue: alertInstance.currentValue,
      thresholdValue: alertInstance.thresholdValue,
      severity: alertRule.severity,
      timestamp: new Date().toISOString(),
      context: alertInstance.context,
      affectedResources: alertInstance.affectedResources
    };

    // Send notifications
    const deliveries = await this.notificationService.sendAlertNotification(alertInstanceId, context);
    
    return deliveries.length;
  }

  /**
   * Process alert escalations
   */
  async processAlertEscalations(): Promise<void> {
    const activeAlerts = await this.db.prepare(`
      SELECT ai.*, ar.severity, ar.alert_type
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.state = 'active'
      AND ai.escalation_level = 0
      AND ai.started_at <= datetime('now', '-15 minutes')
    `).all();

    for (const alert of activeAlerts.results) {
      try {
        await this.escalateAlert(alert);
      } catch (error) {
        console.error(`Failed to escalate alert ${alert.id}:`, error);
      }
    }
  }

  /**
   * Escalate a specific alert
   */
  private async escalateAlert(alert: any): Promise<void> {
    const escalationPolicies = await this.getApplicableEscalationPolicies(alert);
    
    if (escalationPolicies.length === 0) {
      return;
    }

    const policy = escalationPolicies[0]; // Use first applicable policy
    const currentLevel = alert.escalation_level || 0;
    const nextLevel = currentLevel + 1;

    if (nextLevel > policy.maxEscalationLevel) {
      return; // Already at maximum escalation
    }

    const escalationSteps = JSON.parse(policy.escalationSteps);
    const step = escalationSteps.find((s: any) => s.level === nextLevel);
    
    if (!step) {
      return;
    }

    // Update alert escalation level
    await this.db.prepare(`
      UPDATE alert_instances 
      SET escalation_level = ?, escalated_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(nextLevel, new Date().toISOString(), new Date().toISOString(), alert.id).run();

    // Send escalation notifications
    if (step.channels && step.channels.length > 0) {
      const alertInstance = await this.managementService.getAlertInstance(alert.id);
      const alertRule = await this.managementService.getAlertRule(alert.alert_rule_id);
      
      if (alertInstance && alertRule) {
        const context: AlertNotificationContext = {
          alert: alertInstance,
          alertRule,
          currentValue: alertInstance.currentValue,
          thresholdValue: alertInstance.thresholdValue,
          severity: alertRule.severity,
          timestamp: new Date().toISOString()
        };

        await this.notificationService.sendAlertNotification(alert.id, context);
      }
    }

    console.log(`Escalated alert ${alert.id} to level ${nextLevel}`);
  }

  /**
   * Get applicable escalation policies for an alert
   */
  private async getApplicableEscalationPolicies(alert: any): Promise<AlertEscalationPolicy[]> {
    const policies = await this.db.prepare(`
      SELECT * FROM alert_escalation_policies 
      WHERE enabled = 1
      AND (user_id IS NULL OR user_id = ?)
      ORDER BY user_id DESC -- User-specific policies take precedence
    `).bind(alert.user_id).all();

    return policies.results
      .map(this.mapDatabaseRowToEscalationPolicy)
      .filter(policy => {
        // Check if policy applies to this alert's severity
        if (policy.appliesToSeverity && policy.appliesToSeverity.length > 0) {
          if (!policy.appliesToSeverity.includes(alert.severity)) {
            return false;
          }
        }

        // Check if policy applies to this alert's type
        if (policy.appliesToAlertTypes && policy.appliesToAlertTypes.length > 0) {
          if (!policy.appliesToAlertTypes.includes(alert.alert_type)) {
            return false;
          }
        }

        return true;
      });
  }

  /**
   * Process suppression cleanup (remove expired suppressions)
   */
  async processSuppressionCleanup(): Promise<void> {
    const suppressedAlerts = await this.db.prepare(`
      SELECT ai.*, ar.suppression_duration_minutes
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.state = 'suppressed'
      AND ai.updated_at <= datetime('now', '-' || ar.suppression_duration_minutes || ' minutes')
    `).all();

    for (const alert of suppressedAlerts.results) {
      // Check if the underlying condition still exists
      const alertRule = await this.managementService.getAlertRule(alert.alert_rule_id);
      if (alertRule) {
        const evaluation = await this.evaluationService.evaluateAlertRule(alertRule);
        
        if (evaluation.thresholdBreached) {
          // Condition still exists, reactivate alert
          await this.db.prepare(`
            UPDATE alert_instances 
            SET state = 'active', updated_at = ?
            WHERE id = ?
          `).bind(new Date().toISOString(), alert.id).run();
          
          console.log(`Reactivated suppressed alert ${alert.id}`);
        } else {
          // Condition resolved, mark as resolved
          await this.db.prepare(`
            UPDATE alert_instances 
            SET state = 'resolved', resolved_at = ?, updated_at = ?
            WHERE id = ?
          `).bind(new Date().toISOString(), new Date().toISOString(), alert.id).run();
          
          console.log(`Resolved suppressed alert ${alert.id}`);
        }
      }
    }
  }

  /**
   * Check if an alert is suppressed
   */
  private async isAlertSuppressed(alertRule: AlertRule, alertInstance?: AlertInstance): Promise<boolean> {
    const suppressionRules = await this.getApplicableSuppressionRules(alertRule.userId);
    const currentTime = new Date();
    
    const context: AlertSuppressionContext = {
      alertRule,
      alertInstance,
      currentTimestamp: currentTime.toISOString(),
      suppressionRules,
      userTimezone: 'UTC' // Would get from user preferences
    };

    for (const rule of suppressionRules) {
      if (this.isSuppressionRuleActive(rule, context)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get applicable suppression rules
   */
  private async getApplicableSuppressionRules(userId?: string): Promise<AlertSuppressionRule[]> {
    const rules = await this.db.prepare(`
      SELECT * FROM alert_suppression_rules 
      WHERE enabled = 1
      AND (user_id IS NULL OR user_id = ?)
      AND (start_date IS NULL OR start_date <= date('now'))
      AND (end_date IS NULL OR end_date >= date('now'))
    `).bind(userId).all();

    return rules.results.map(this.mapDatabaseRowToSuppressionRule);
  }

  /**
   * Check if a suppression rule is currently active
   */
  private isSuppressionRuleActive(rule: AlertSuppressionRule, context: AlertSuppressionContext): boolean {
    const currentTime = new Date(context.currentTimestamp);
    
    // Check alert rule IDs
    if (rule.alertRuleIds && rule.alertRuleIds.length > 0) {
      if (!rule.alertRuleIds.includes(context.alertRule.id)) {
        return false;
      }
    }

    // Check alert types
    if (rule.alertTypes && rule.alertTypes.length > 0) {
      if (!rule.alertTypes.includes(context.alertRule.alertType)) {
        return false;
      }
    }

    // Check severities
    if (rule.severities && rule.severities.length > 0) {
      if (!rule.severities.includes(context.alertRule.severity)) {
        return false;
      }
    }

    // Check time-based suppression
    if (rule.startTime && rule.endTime) {
      const currentHourMinute = currentTime.getHours() * 60 + currentTime.getMinutes();
      const [startHour, startMinute] = rule.startTime.split(':').map(Number);
      const [endHour, endMinute] = rule.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (startMinutes <= endMinutes) {
        // Same day range
        if (currentHourMinute < startMinutes || currentHourMinute > endMinutes) {
          return false;
        }
      } else {
        // Overnight range
        if (currentHourMinute < startMinutes && currentHourMinute > endMinutes) {
          return false;
        }
      }
    }

    // Check days of week
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      const currentDay = currentTime.getDay();
      if (!rule.daysOfWeek.includes(currentDay)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Retry failed notification deliveries
   */
  async retryFailedNotifications(): Promise<{ retriedCount: number; errors: string[] }> {
    const result = { retriedCount: 0, errors: [] as string[] };

    try {
      await this.notificationService.retryFailedDeliveries();
      // Count would be tracked in the notification service
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Clean up old alert data
   */
  async cleanupOldAlertData(): Promise<{ deletedEvaluations: number; deletedDeliveries: number }> {
    const result = { deletedEvaluations: 0, deletedDeliveries: 0 };

    // Clean up old evaluations (keep last 30 days)
    const evaluationResult = await this.db.prepare(`
      DELETE FROM alert_evaluations 
      WHERE created_at < date('now', '-30 days')
    `).run();
    result.deletedEvaluations = evaluationResult.meta.changes;

    // Clean up old notification deliveries (keep last 90 days)
    const deliveryResult = await this.db.prepare(`
      DELETE FROM notification_deliveries 
      WHERE created_at < date('now', '-90 days')
    `).run();
    result.deletedDeliveries = deliveryResult.meta.changes;

    console.log(`Cleaned up ${result.deletedEvaluations} old evaluations and ${result.deletedDeliveries} old deliveries`);

    return result;
  }

  /**
   * Update alert rule last used timestamp when notifications are sent
   */
  async updateChannelLastUsed(channelId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE notification_channels 
      SET last_used_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), channelId).run();
  }

  /**
   * Get alert scheduler statistics
   */
  async getSchedulerStatistics(): Promise<{
    activeAlertRules: number;
    activeAlerts: number;
    pendingEscalations: number;
    failedNotifications: number;
    lastEvaluationTime: string | null;
  }> {
    const activeRulesResult = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_rules WHERE enabled = 1
    `).first();

    const activeAlertsResult = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_instances WHERE state = 'active'
    `).first();

    const pendingEscalationsResult = await this.db.prepare(`
      SELECT COUNT(*) as count FROM alert_instances 
      WHERE state = 'active' 
      AND escalation_level = 0 
      AND started_at <= datetime('now', '-15 minutes')
    `).first();

    const failedNotificationsResult = await this.db.prepare(`
      SELECT COUNT(*) as count FROM notification_deliveries 
      WHERE delivery_status = 'failed' 
      AND created_at >= date('now', '-1 day')
    `).first();

    const lastEvaluationResult = await this.db.prepare(`
      SELECT MAX(evaluation_time) as last_time FROM alert_evaluations
    `).first();

    return {
      activeAlertRules: activeRulesResult?.count || 0,
      activeAlerts: activeAlertsResult?.count || 0,
      pendingEscalations: pendingEscalationsResult?.count || 0,
      failedNotifications: failedNotificationsResult?.count || 0,
      lastEvaluationTime: lastEvaluationResult?.last_time || null
    };
  }

  // ============================================================================
  // Database Mapping Helpers
  // ============================================================================

  private mapDatabaseRowToEscalationPolicy(row: any): AlertEscalationPolicy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      escalationSteps: JSON.parse(row.escalation_steps),
      initialDelayMinutes: row.initial_delay_minutes,
      escalationIntervalMinutes: row.escalation_interval_minutes,
      maxEscalationLevel: row.max_escalation_level,
      appliesToSeverity: row.applies_to_severity ? JSON.parse(row.applies_to_severity) : undefined,
      appliesToAlertTypes: row.applies_to_alert_types ? JSON.parse(row.applies_to_alert_types) : undefined,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDatabaseRowToSuppressionRule(row: any): AlertSuppressionRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      userId: row.user_id,
      alertRuleIds: row.alert_rule_ids ? JSON.parse(row.alert_rule_ids) : undefined,
      alertTypes: row.alert_types ? JSON.parse(row.alert_types) : undefined,
      severities: row.severities ? JSON.parse(row.severities) : undefined,
      startTime: row.start_time,
      endTime: row.end_time,
      daysOfWeek: row.days_of_week ? JSON.parse(row.days_of_week) : undefined,
      timezone: row.timezone,
      startDate: row.start_date,
      endDate: row.end_date,
      conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}