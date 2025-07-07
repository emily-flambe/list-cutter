/**
 * Alert Template Service
 * Provides pre-configured alert templates and customization options
 */

import {
  AlertTemplate,
  AlertCreateRequest,
  AlertType,
  AlertThreshold,
  NotificationChannelCreateRequest
} from '../../types/alerts.js';

export class AlertTemplateService {
  constructor(private db: D1Database) {}

  /**
   * Get all available alert templates
   */
  async getAlertTemplates(): Promise<AlertTemplate[]> {
    const results = await this.db.prepare(`
      SELECT * FROM alert_templates ORDER BY name
    `).all();

    if (results.results.length === 0) {
      // Return built-in templates if none exist in database
      return this.getBuiltInTemplates();
    }

    return results.results.map(this.mapDatabaseRowToTemplate);
  }

  /**
   * Get alert template by ID
   */
  async getAlertTemplate(templateId: string): Promise<AlertTemplate | null> {
    const result = await this.db.prepare(`
      SELECT * FROM alert_templates WHERE id = ?
    `).bind(templateId).first();

    if (!result) {
      // Check built-in templates
      const builtInTemplates = this.getBuiltInTemplates();
      return builtInTemplates.find(t => t.id === templateId) || null;
    }

    return this.mapDatabaseRowToTemplate(result);
  }

  /**
   * Create alert rule from template
   */
  async createAlertFromTemplate(
    templateId: string,
    userId: string,
    customizations?: Partial<AlertCreateRequest>
  ): Promise<AlertCreateRequest> {
    const template = await this.getAlertTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const baseRequest: AlertCreateRequest = {
      name: customizations?.name || template.name,
      description: customizations?.description || template.description,
      alertType: template.alertType,
      metricType: template.defaultThreshold.thresholdOperator === '>' ? 'storage_bytes' : 'error_rate',
      thresholdValue: template.defaultThreshold.thresholdValue,
      thresholdOperator: template.defaultThreshold.thresholdOperator,
      thresholdUnit: template.defaultThreshold.thresholdUnit,
      comparisonType: template.defaultThreshold.comparisonType,
      comparisonWindow: template.defaultThreshold.comparisonWindow,
      severity: template.defaultThreshold.severity,
      notificationChannelIds: template.defaultNotificationChannels,
      ...customizations
    };

    return baseRequest;
  }

  /**
   * Get recommended templates for a user based on their storage patterns
   */
  async getRecommendedTemplates(userId: string): Promise<AlertTemplate[]> {
    // Analyze user's storage patterns
    const userMetrics = await this.db.prepare(`
      SELECT 
        AVG(total_bytes) as avg_storage,
        MAX(total_bytes) as max_storage,
        COUNT(*) as operation_count,
        AVG(total_cost_usd) as avg_cost
      FROM storage_metrics
      WHERE user_id = ? AND metric_date >= date('now', '-30 days')
    `).bind(userId).first();

    const recommendations: AlertTemplate[] = [];
    const allTemplates = await this.getAlertTemplates();

    // Always recommend basic monitoring
    recommendations.push(
      ...allTemplates.filter(t => 
        ['basic-error-monitoring', 'storage-quota-warning'].includes(t.id)
      )
    );

    // Recommend cost monitoring for users with spend
    if (userMetrics?.avg_cost > 0) {
      recommendations.push(
        ...allTemplates.filter(t => t.alertType === 'cost_spike')
      );
    }

    // Recommend performance monitoring for active users
    if (userMetrics?.operation_count > 100) {
      recommendations.push(
        ...allTemplates.filter(t => t.alertType === 'performance')
      );
    }

    // Recommend storage growth monitoring for growing storage
    if (userMetrics?.max_storage > 1073741824) { // > 1GB
      recommendations.push(
        ...allTemplates.filter(t => t.alertType === 'storage_growth')
      );
    }

    return recommendations;
  }

  /**
   * Create custom template
   */
  async createCustomTemplate(
    userId: string,
    template: Omit<AlertTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AlertTemplate> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newTemplate: AlertTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.db.prepare(`
      INSERT INTO alert_templates (
        id, name, description, alert_type, default_threshold,
        default_notification_channels, customizable_fields,
        created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      template.name,
      template.description,
      template.alertType,
      JSON.stringify(template.defaultThreshold),
      JSON.stringify(template.defaultNotificationChannels),
      JSON.stringify(template.customizableFields),
      now,
      now,
      userId
    ).run();

    return newTemplate;
  }

  /**
   * Get template recommendations for notification channels
   */
  getNotificationChannelTemplates(): NotificationChannelCreateRequest[] {
    return [
      // Email templates
      {
        name: 'Email Notifications',
        channelType: 'email',
        configuration: {
          smtp_host: 'smtp.gmail.com',
          smtp_port: 587,
          from_email: 'alerts@example.com',
          to: ['user@example.com']
        },
        subjectTemplate: 'R2 Storage Alert: {{alert_name}}',
        bodyTemplate: `
          <h2>{{alert_name}}</h2>
          <p><strong>Severity:</strong> {{severity}}</p>
          <p><strong>Current Value:</strong> {{current_value}}</p>
          <p><strong>Threshold:</strong> {{threshold_value}}</p>
          <p><strong>Time:</strong> {{timestamp}}</p>
          <p>{{description}}</p>
        `
      },
      
      // Slack templates
      {
        name: 'Slack Notifications',
        channelType: 'slack',
        configuration: {
          webhook_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        }
      },

      // Webhook templates
      {
        name: 'Generic Webhook',
        channelType: 'webhook',
        configuration: {
          url: 'https://your-webhook-endpoint.com/alerts',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_TOKEN'
          }
        }
      },

      // Discord template
      {
        name: 'Discord Notifications',
        channelType: 'discord',
        configuration: {
          webhook_url: 'https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK'
        }
      }
    ];
  }

  /**
   * Get built-in alert templates
   */
  private getBuiltInTemplates(): AlertTemplate[] {
    return [
      // Cost monitoring templates
      {
        id: 'monthly-cost-spike-50',
        name: 'Monthly Cost Spike (50%)',
        description: 'Alert when monthly storage costs increase by more than 50%',
        alertType: 'cost_spike',
        defaultThreshold: {
          thresholdValue: 50,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'month_over_month',
          comparisonWindow: '1m',
          severity: 'high'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue', 'severity', 'comparisonWindow'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      {
        id: 'daily-cost-spike-100',
        name: 'Daily Cost Spike (100%)',
        description: 'Alert when daily costs double compared to previous day',
        alertType: 'cost_spike',
        defaultThreshold: {
          thresholdValue: 100,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'percentage_change',
          comparisonWindow: '1d',
          severity: 'medium'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue', 'severity'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      // Error rate templates
      {
        id: 'basic-error-monitoring',
        name: 'Basic Error Monitoring (5%)',
        description: 'Alert when error rate exceeds 5% over 1 hour',
        alertType: 'error_rate',
        defaultThreshold: {
          thresholdValue: 5,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'moving_average',
          comparisonWindow: '1h',
          severity: 'high'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue', 'comparisonWindow', 'severity'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      {
        id: 'critical-error-monitoring',
        name: 'Critical Error Monitoring (10%)',
        description: 'Alert when error rate exceeds 10% - immediate attention required',
        alertType: 'error_rate',
        defaultThreshold: {
          thresholdValue: 10,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'moving_average',
          comparisonWindow: '1h',
          severity: 'critical'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      // Performance templates
      {
        id: 'slow-response-monitoring',
        name: 'Slow Response Monitoring (5s)',
        description: 'Alert when average response time exceeds 5 seconds',
        alertType: 'performance',
        defaultThreshold: {
          thresholdValue: 5000,
          thresholdOperator: '>',
          thresholdUnit: 'milliseconds',
          comparisonType: 'moving_average',
          comparisonWindow: '1h',
          severity: 'medium'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue', 'severity', 'comparisonWindow'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      {
        id: 'very-slow-response-monitoring',
        name: 'Very Slow Response Monitoring (10s)',
        description: 'Alert when average response time exceeds 10 seconds',
        alertType: 'performance',
        defaultThreshold: {
          thresholdValue: 10000,
          thresholdOperator: '>',
          thresholdUnit: 'milliseconds',
          comparisonType: 'moving_average',
          comparisonWindow: '1h',
          severity: 'high'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      // Storage growth templates
      {
        id: 'storage-growth-weekly-100',
        name: 'Weekly Storage Growth (100%)',
        description: 'Alert when storage grows by more than 100% week over week',
        alertType: 'storage_growth',
        defaultThreshold: {
          thresholdValue: 100,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'week_over_week',
          comparisonWindow: '1w',
          severity: 'medium'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue', 'severity'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      {
        id: 'rapid-storage-growth-200',
        name: 'Rapid Storage Growth (200%)',
        description: 'Alert when storage grows by more than 200% week over week',
        alertType: 'storage_growth',
        defaultThreshold: {
          thresholdValue: 200,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'week_over_week',
          comparisonWindow: '1w',
          severity: 'high'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      // Quota violation templates
      {
        id: 'storage-quota-warning',
        name: 'Storage Quota Warning (80%)',
        description: 'Alert when storage usage exceeds 80% of quota',
        alertType: 'quota_violation',
        defaultThreshold: {
          thresholdValue: 80,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'absolute',
          comparisonWindow: '1h',
          severity: 'medium'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue', 'severity'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },

      {
        id: 'storage-quota-critical',
        name: 'Storage Quota Critical (95%)',
        description: 'Alert when storage usage exceeds 95% of quota',
        alertType: 'quota_violation',
        defaultThreshold: {
          thresholdValue: 95,
          thresholdOperator: '>',
          thresholdUnit: 'percentage',
          comparisonType: 'absolute',
          comparisonWindow: '1h',
          severity: 'critical'
        },
        defaultNotificationChannels: [],
        customizableFields: ['thresholdValue'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }

  /**
   * Install default templates to database
   */
  async installDefaultTemplates(): Promise<void> {
    const templates = this.getBuiltInTemplates();
    
    for (const template of templates) {
      await this.db.prepare(`
        INSERT OR IGNORE INTO alert_templates (
          id, name, description, alert_type, default_threshold,
          default_notification_channels, customizable_fields,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        template.id,
        template.name,
        template.description,
        template.alertType,
        JSON.stringify(template.defaultThreshold),
        JSON.stringify(template.defaultNotificationChannels),
        JSON.stringify(template.customizableFields),
        template.createdAt,
        template.updatedAt
      ).run();
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStats(): Promise<Array<{
    templateId: string;
    templateName: string;
    usageCount: number;
    lastUsed: string | null;
  }>> {
    // This would require tracking template usage in alert rule creation
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Map database row to AlertTemplate
   */
  private mapDatabaseRowToTemplate(row: any): AlertTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      alertType: row.alert_type,
      defaultThreshold: JSON.parse(row.default_threshold),
      defaultNotificationChannels: JSON.parse(row.default_notification_channels),
      customizableFields: JSON.parse(row.customizable_fields),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}