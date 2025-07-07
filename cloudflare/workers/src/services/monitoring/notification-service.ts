/**
 * Notification Service
 * Handles delivery of alert notifications through multiple channels
 */

import {
  NotificationChannel,
  NotificationDelivery,
  AlertNotificationContext,
  AlertWebhookPayload,
  AlertSlackPayload,
  AlertEmailPayload,
  AlertSMSPayload,
  NotificationChannelType,
  DeliveryStatus
} from '../../types/alerts';

export class NotificationService {
  constructor(private db: D1Database) {}

  /**
   * Send notification for an alert
   */
  async sendAlertNotification(
    alertInstanceId: string,
    context: AlertNotificationContext
  ): Promise<NotificationDelivery[]> {
    const channels = await this.getNotificationChannels(context.alertRule.id);
    const deliveries: NotificationDelivery[] = [];

    for (const channel of channels) {
      try {
        const delivery = await this.sendToChannel(alertInstanceId, channel, context);
        deliveries.push(delivery);
      } catch (error) {
        console.error(`Failed to send notification to channel ${channel.id}:`, error);
        // Create failed delivery record
        const failedDelivery = await this.createFailedDelivery(
          alertInstanceId,
          channel.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
        deliveries.push(failedDelivery);
      }
    }

    return deliveries;
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    alertInstanceId: string,
    channel: NotificationChannel,
    context: AlertNotificationContext
  ): Promise<NotificationDelivery> {
    // Check rate limiting
    if (await this.isRateLimited(channel.id)) {
      throw new Error('Channel rate limit exceeded');
    }

    const delivery = await this.createDelivery(alertInstanceId, channel.id);

    try {
      const message = await this.prepareMessage(channel, context);
      await this.deliverMessage(channel, message);
      
      await this.updateDeliveryStatus(delivery.id, 'sent');
      return { ...delivery, deliveryStatus: 'sent', sentAt: new Date().toISOString() };
    } catch (error) {
      await this.updateDeliveryStatus(delivery.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Prepare message for specific channel type
   */
  private async prepareMessage(
    channel: NotificationChannel,
    context: AlertNotificationContext
  ): Promise<any> {
    switch (channel.channelType) {
      case 'email':
        return this.prepareEmailMessage(channel, context);
      case 'webhook':
        return this.prepareWebhookMessage(channel, context);
      case 'slack':
        return this.prepareSlackMessage(channel, context);
      case 'sms':
        return this.prepareSMSMessage(channel, context);
      default:
        throw new Error(`Unsupported channel type: ${channel.channelType}`);
    }
  }

  /**
   * Prepare email message
   */
  private prepareEmailMessage(
    channel: NotificationChannel,
    context: AlertNotificationContext
  ): AlertEmailPayload {
    const template = this.renderTemplate(channel.subjectTemplate || 'Alert: {{alert_name}}', context);
    const body = this.renderTemplate(channel.bodyTemplate || this.getDefaultEmailTemplate(), context);
    
    const config = channel.configuration as any;
    
    return {
      to: config.to || [config.email],
      subject: template,
      body: body,
      isHtml: true
    };
  }

  /**
   * Prepare webhook message
   */
  private prepareWebhookMessage(
    channel: NotificationChannel,
    context: AlertNotificationContext
  ): AlertWebhookPayload {
    return {
      alertId: context.alert.id,
      alertRuleId: context.alertRule.id,
      alertRuleName: context.alertRule.name,
      alertType: context.alertRule.alertType,
      severity: context.severity,
      state: context.alert.state,
      currentValue: context.currentValue,
      thresholdValue: context.thresholdValue,
      startedAt: context.alert.startedAt,
      acknowledgedAt: context.alert.acknowledgedAt,
      resolvedAt: context.alert.resolvedAt,
      userId: context.user?.id,
      context: context.context,
      affectedResources: context.affectedResources
    };
  }

  /**
   * Prepare Slack message
   */
  private prepareSlackMessage(
    channel: NotificationChannel,
    context: AlertNotificationContext
  ): AlertSlackPayload {
    const color = this.getSeverityColor(context.severity);
    const timestamp = Math.floor(new Date(context.timestamp).getTime() / 1000);
    
    return {
      text: `Alert: ${context.alertRule.name}`,
      attachments: [{
        color,
        title: `${context.alertRule.name} - ${context.severity.toUpperCase()}`,
        text: context.alertRule.description || 'No description provided',
        fields: [
          {
            title: 'Current Value',
            value: this.formatValue(context.currentValue, context.alertRule.thresholdUnit),
            short: true
          },
          {
            title: 'Threshold',
            value: this.formatValue(context.thresholdValue, context.alertRule.thresholdUnit),
            short: true
          },
          {
            title: 'Alert Type',
            value: context.alertRule.alertType.replace('_', ' ').toUpperCase(),
            short: true
          },
          {
            title: 'State',
            value: context.alert.state.toUpperCase(),
            short: true
          }
        ],
        ts: timestamp
      }]
    };
  }

  /**
   * Prepare SMS message
   */
  private prepareSMSMessage(
    channel: NotificationChannel,
    context: AlertNotificationContext
  ): AlertSMSPayload {
    const config = channel.configuration as any;
    const message = `ALERT: ${context.alertRule.name} - ${context.severity.toUpperCase()}. Current: ${this.formatValue(context.currentValue, context.alertRule.thresholdUnit)}, Threshold: ${this.formatValue(context.thresholdValue, context.alertRule.thresholdUnit)}`;
    
    return {
      to: config.phoneNumber,
      message: message.substring(0, 160) // SMS character limit
    };
  }

  /**
   * Deliver message through appropriate channel
   */
  private async deliverMessage(channel: NotificationChannel, message: any): Promise<void> {
    const config = channel.configuration as any;
    
    switch (channel.channelType) {
      case 'email':
        await this.sendEmail(config, message);
        break;
      case 'webhook':
        await this.sendWebhook(config, message);
        break;
      case 'slack':
        await this.sendSlack(config, message);
        break;
      case 'sms':
        await this.sendSMS(config, message);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.channelType}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(config: any, message: AlertEmailPayload): Promise<void> {
    // This would integrate with an email service like SendGrid, Mailgun, etc.
    // For now, we'll use a simple fetch to a webhook endpoint
    const response = await fetch(config.webhook_url || 'https://api.example.com/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        from: config.from_email,
        to: message.to,
        subject: message.subject,
        html: message.body
      })
    });

    if (!response.ok) {
      throw new Error(`Email delivery failed: ${response.statusText}`);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(config: any, message: AlertWebhookPayload): Promise<void> {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.statusText}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(config: any, message: AlertSlackPayload): Promise<void> {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack delivery failed: ${response.statusText}`);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(config: any, message: AlertSMSPayload): Promise<void> {
    // This would integrate with an SMS service like Twilio, AWS SNS, etc.
    const response = await fetch(config.api_url || 'https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${config.account_sid}:${config.auth_token}`)}`
      },
      body: new URLSearchParams({
        From: config.from_number,
        To: message.to,
        Body: message.message
      })
    });

    if (!response.ok) {
      throw new Error(`SMS delivery failed: ${response.statusText}`);
    }
  }

  /**
   * Check if channel is rate limited
   */
  private async isRateLimited(channelId: string): Promise<boolean> {
    const channel = await this.db.prepare(`
      SELECT rate_limit_per_hour FROM notification_channels WHERE id = ?
    `).bind(channelId).first();

    if (!channel) return false;

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentDeliveries = await this.db.prepare(`
      SELECT COUNT(*) as count FROM notification_deliveries 
      WHERE notification_channel_id = ? AND created_at >= ?
    `).bind(channelId, hourAgo).first();

    return (recentDeliveries?.count || 0) >= channel.rate_limit_per_hour;
  }

  /**
   * Get notification channels for an alert rule
   */
  private async getNotificationChannels(alertRuleId: string): Promise<NotificationChannel[]> {
    const results = await this.db.prepare(`
      SELECT nc.* FROM notification_channels nc
      JOIN alert_rule_channels arc ON nc.id = arc.notification_channel_id
      WHERE arc.alert_rule_id = ? AND nc.enabled = 1 AND arc.enabled = 1
    `).bind(alertRuleId).all();

    return results.results.map(this.mapDatabaseRowToNotificationChannel);
  }

  /**
   * Create delivery record
   */
  private async createDelivery(alertInstanceId: string, channelId: string): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: crypto.randomUUID(),
      alertInstanceId,
      notificationChannelId: channelId,
      deliveryStatus: 'pending',
      deliveryAttempt: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.db.prepare(`
      INSERT INTO notification_deliveries (
        id, alert_instance_id, notification_channel_id, delivery_status,
        delivery_attempt, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      delivery.id,
      delivery.alertInstanceId,
      delivery.notificationChannelId,
      delivery.deliveryStatus,
      delivery.deliveryAttempt,
      delivery.createdAt,
      delivery.updatedAt
    ).run();

    return delivery;
  }

  /**
   * Create failed delivery record
   */
  private async createFailedDelivery(
    alertInstanceId: string,
    channelId: string,
    errorMessage: string
  ): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: crypto.randomUUID(),
      alertInstanceId,
      notificationChannelId: channelId,
      deliveryStatus: 'failed',
      deliveryAttempt: 1,
      errorMessage,
      failedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.db.prepare(`
      INSERT INTO notification_deliveries (
        id, alert_instance_id, notification_channel_id, delivery_status,
        delivery_attempt, error_message, failed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      delivery.id,
      delivery.alertInstanceId,
      delivery.notificationChannelId,
      delivery.deliveryStatus,
      delivery.deliveryAttempt,
      delivery.errorMessage,
      delivery.failedAt,
      delivery.createdAt,
      delivery.updatedAt
    ).run();

    return delivery;
  }

  /**
   * Update delivery status
   */
  private async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateTime = new Date().toISOString();
    let statusField = '';
    
    switch (status) {
      case 'sent':
        statusField = 'sent_at';
        break;
      case 'delivered':
        statusField = 'delivered_at';
        break;
      case 'failed':
        statusField = 'failed_at';
        break;
    }

    await this.db.prepare(`
      UPDATE notification_deliveries 
      SET delivery_status = ?, ${statusField} = ?, error_message = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, updateTime, errorMessage, updateTime, deliveryId).run();
  }

  /**
   * Render template with context
   */
  private renderTemplate(template: string, context: AlertNotificationContext): string {
    return template
      .replace(/\{\{alert_name\}\}/g, context.alertRule.name)
      .replace(/\{\{description\}\}/g, context.alertRule.description || '')
      .replace(/\{\{severity\}\}/g, context.severity)
      .replace(/\{\{current_value\}\}/g, this.formatValue(context.currentValue, context.alertRule.thresholdUnit))
      .replace(/\{\{threshold_value\}\}/g, this.formatValue(context.thresholdValue, context.alertRule.thresholdUnit))
      .replace(/\{\{timestamp\}\}/g, context.timestamp)
      .replace(/\{\{alert_type\}\}/g, context.alertRule.alertType)
      .replace(/\{\{user_email\}\}/g, context.user?.email || '')
      .replace(/\{\{user_name\}\}/g, context.user?.username || '');
  }

  /**
   * Get default email template
   */
  private getDefaultEmailTemplate(): string {
    return `
      <html>
        <body>
          <h2>R2 Storage Alert: {{alert_name}}</h2>
          <p><strong>Severity:</strong> {{severity}}</p>
          <p><strong>Alert Type:</strong> {{alert_type}}</p>
          <p><strong>Current Value:</strong> {{current_value}}</p>
          <p><strong>Threshold:</strong> {{threshold_value}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
          <p><strong>Description:</strong> {{description}}</p>
          <p><strong>User:</strong> {{user_email}}</p>
          <hr>
          <p><small>This is an automated alert from R2 Storage Monitoring System</small></p>
        </body>
      </html>
    `;
  }

  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'warning';
      case 'low':
        return 'good';
      default:
        return '#000000';
    }
  }

  /**
   * Format value with unit
   */
  private formatValue(value: number, unit: string): string {
    switch (unit) {
      case 'bytes':
        return this.formatBytes(value);
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'milliseconds':
        return `${value.toFixed(0)}ms`;
      case 'dollars':
        return `$${value.toFixed(2)}`;
      default:
        return value.toString();
    }
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Retry failed deliveries
   */
  async retryFailedDeliveries(): Promise<void> {
    const failedDeliveries = await this.db.prepare(`
      SELECT nd.*, nc.* FROM notification_deliveries nd
      JOIN notification_channels nc ON nd.notification_channel_id = nc.id
      WHERE nd.delivery_status = 'failed' 
      AND nd.delivery_attempt < nc.max_retries
      AND (nd.next_retry_at IS NULL OR nd.next_retry_at <= datetime('now'))
    `).all();

    for (const delivery of failedDeliveries.results) {
      try {
        await this.retryDelivery(delivery);
      } catch (error) {
        console.error(`Failed to retry delivery ${delivery.id}:`, error);
      }
    }
  }

  /**
   * Retry a specific delivery
   */
  private async retryDelivery(delivery: any): Promise<void> {
    const channel = this.mapDatabaseRowToNotificationChannel(delivery);
    
    // Get alert context for retry
    const alertInstance = await this.db.prepare(`
      SELECT ai.*, ar.* FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.id = ?
    `).bind(delivery.alert_instance_id).first();

    if (!alertInstance) {
      throw new Error('Alert instance not found for retry');
    }

    // Build notification context
    const context: AlertNotificationContext = {
      alert: this.mapDatabaseRowToAlertInstance(alertInstance),
      alertRule: this.mapDatabaseRowToAlertRule(alertInstance),
      currentValue: alertInstance.current_value,
      thresholdValue: alertInstance.threshold_value,
      severity: alertInstance.severity,
      timestamp: new Date().toISOString()
    };

    // Attempt retry
    await this.db.prepare(`
      UPDATE notification_deliveries 
      SET delivery_attempt = delivery_attempt + 1, 
          next_retry_at = datetime('now', '+' || ? || ' minutes'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(channel.retryDelayMinutes, delivery.id).run();

    try {
      const message = await this.prepareMessage(channel, context);
      await this.deliverMessage(channel, message);
      await this.updateDeliveryStatus(delivery.id, 'sent');
    } catch (error) {
      await this.updateDeliveryStatus(delivery.id, 'failed', error instanceof Error ? error.message : 'Retry failed');
      throw error;
    }
  }

  /**
   * Map database row to NotificationChannel
   */
  private mapDatabaseRowToNotificationChannel(row: any): NotificationChannel {
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

  /**
   * Map database row to AlertInstance
   */
  private mapDatabaseRowToAlertInstance(row: any): any {
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
   * Map database row to AlertRule
   */
  private mapDatabaseRowToAlertRule(row: any): any {
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
}