# R2 Storage Alerting System

A comprehensive alerting system for monitoring R2 storage costs, performance, and operational health. This system provides real-time alert evaluation, multi-channel notifications, escalation policies, and detailed analytics.

## Features

### Core Alerting Capabilities
- **Real-time Alert Evaluation**: Configurable evaluation frequency (1-60 minutes)
- **Multiple Alert Types**: Cost spikes, error rates, performance issues, storage growth, quota violations
- **Flexible Thresholds**: Absolute values, percentage changes, moving averages, period-over-period comparisons
- **Alert Suppression**: Time-based and condition-based suppression rules
- **Escalation Policies**: Multi-level escalation with customizable delays and channels

### Notification Channels
- **Email**: SMTP integration with customizable templates
- **Webhooks**: HTTP/HTTPS endpoints with custom headers and payload formatting
- **Slack**: Native Slack integration with rich message formatting
- **Discord**: Discord webhook support
- **SMS**: Twilio integration for critical alerts
- **Custom Channels**: Extensible architecture for additional integrations

### Alert Types

#### 1. Cost Spike Alerts
Monitor R2 storage costs for unexpected increases:
- **Month-over-Month**: Alert on monthly cost increases (e.g., >50% MoM)
- **Week-over-Week**: Weekly cost monitoring (e.g., >100% WoW) 
- **Day-over-Day**: Daily cost monitoring for rapid changes

#### 2. Error Rate Alerts
Monitor storage operation success rates:
- **Configurable Thresholds**: 1-50% error rate thresholds
- **Time Windows**: 1h, 1d, 1w evaluation periods
- **Operation-Specific**: Monitor specific operations (upload, download, delete)

#### 3. Performance Alerts
Monitor storage operation performance:
- **Response Time**: Average, p95, p99 response time monitoring
- **Throughput**: Upload/download speed monitoring
- **Latency**: End-to-end operation latency

#### 4. Storage Growth Alerts
Monitor storage usage growth patterns:
- **Growth Rate**: Week-over-week or month-over-month growth
- **Absolute Limits**: Storage size thresholds
- **User-Specific**: Per-user growth monitoring

#### 5. Quota Violation Alerts
Monitor quota usage and limits:
- **Storage Quotas**: File size and count limits
- **Cost Quotas**: Monthly spending limits
- **Operation Quotas**: Request rate limits

## Architecture

### Core Services

#### AlertEvaluationService
- Evaluates alert rules against current metrics
- Supports complex threshold conditions
- Handles time-based comparisons and aggregations
- Implements minimum duration requirements

#### NotificationService
- Multi-channel notification delivery
- Rate limiting and retry logic
- Template-based message formatting
- Delivery tracking and analytics

#### AlertManagementService
- CRUD operations for alert rules and instances
- Alert state management (active, acknowledged, resolved)
- Bulk operations for managing multiple alerts
- Alert testing and validation

#### AlertSchedulerService
- Scheduled alert evaluation via cron triggers
- Escalation processing
- Suppression rule enforcement
- System health monitoring

#### AlertAnalyticsService
- Alert performance analytics
- Trend analysis and reporting
- False positive rate tracking
- Health scoring and recommendations

#### AlertTemplateService
- Pre-configured alert templates
- Template-based alert creation
- Customizable alert configurations
- Best practice recommendations

### Database Schema

The alerting system uses 8 main tables:

1. **alert_rules**: Alert rule definitions and configurations
2. **alert_instances**: Individual alert occurrences and state
3. **notification_channels**: Notification delivery configurations
4. **alert_rule_channels**: Many-to-many mapping of rules to channels
5. **notification_deliveries**: Delivery tracking and status
6. **alert_evaluations**: Historical evaluation results
7. **alert_escalation_policies**: Escalation configurations
8. **alert_suppression_rules**: Suppression rule definitions

## API Endpoints

### Alert Rule Management
```
POST   /api/alerts/rules              # Create alert rule
GET    /api/alerts/rules              # List alert rules
GET    /api/alerts/rules/:id          # Get alert rule
PUT    /api/alerts/rules/:id          # Update alert rule
DELETE /api/alerts/rules/:id          # Delete alert rule
POST   /api/alerts/rules/:id/test     # Test alert rule
```

### Alert Instance Management
```
GET    /api/alerts/instances          # List alert instances
GET    /api/alerts/instances/:id      # Get alert instance
POST   /api/alerts/instances/:id/acknowledge  # Acknowledge alert
POST   /api/alerts/instances/:id/resolve      # Resolve alert
POST   /api/alerts/instances/bulk     # Bulk operations
```

### Notification Channels
```
POST   /api/alerts/channels           # Create notification channel
GET    /api/alerts/channels           # List notification channels
GET    /api/alerts/channels/:id       # Get notification channel
PUT    /api/alerts/channels/:id       # Update notification channel
DELETE /api/alerts/channels/:id       # Delete notification channel
```

### Channel-Rule Associations
```
POST   /api/alerts/rules/:ruleId/channels/:channelId     # Associate
DELETE /api/alerts/rules/:ruleId/channels/:channelId     # Dissociate
```

### Dashboard and Analytics
```
GET    /api/alerts/dashboard          # Alert dashboard data
GET    /api/alerts/history            # Alert history
GET    /api/dashboard/enhanced        # Enhanced dashboard with alerts
GET    /api/dashboard/alerts/widget   # Alert widget data
GET    /api/dashboard/alerts/metrics  # Alert metrics for charts
```

### System Operations (Admin)
```
POST   /api/alerts/evaluate           # Manual alert evaluation
POST   /api/alerts/notifications/retry  # Retry failed notifications
GET    /api/alerts/jobs/stats         # Job execution statistics
GET    /api/alerts/jobs/history       # Job execution history
```

## Configuration

### Environment Variables
```bash
# Alert evaluation frequency (minutes)
ALERT_EVALUATION_FREQUENCY=5

# Notification settings
ENABLE_NOTIFICATIONS=true
MAX_NOTIFICATIONS_PER_HOUR=60

# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=alerts@example.com

# Webhook timeouts
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_RETRY_COUNT=3

# Alert data retention
ALERT_EVALUATION_RETENTION_DAYS=30
NOTIFICATION_DELIVERY_RETENTION_DAYS=90
```

### Cron Triggers
The system uses the following cron triggers:

```toml
# Alert evaluation every 5 minutes
[[triggers.crons]]
cron = "*/5 * * * *"
endpoint = "/api/alerts/jobs/evaluate"

# Retry failed notifications every 15 minutes
[[triggers.crons]]
cron = "*/15 * * * *"
endpoint = "/api/alerts/jobs/retry-notifications"

# Daily cleanup at 3 AM UTC
[[triggers.crons]]
cron = "0 3 * * *"
endpoint = "/api/alerts/jobs/cleanup"

# Health check every 5 minutes
[[triggers.crons]]
cron = "*/5 * * * *"
endpoint = "/api/alerts/jobs/health-check"
```

## Usage Examples

### Creating a Cost Spike Alert
```typescript
const costAlert: AlertCreateRequest = {
  name: "Monthly Cost Spike Alert",
  description: "Alert when monthly costs increase by more than 50%",
  alertType: "cost_spike",
  metricType: "storage_bytes",
  thresholdValue: 50,
  thresholdOperator: ">",
  thresholdUnit: "percentage",
  comparisonType: "month_over_month",
  comparisonWindow: "1m",
  severity: "high",
  notificationChannelIds: ["email-channel-id"]
};

const response = await fetch('/api/alerts/rules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': userId
  },
  body: JSON.stringify(costAlert)
});
```

### Creating an Email Notification Channel
```typescript
const emailChannel: NotificationChannelCreateRequest = {
  name: "Operations Email",
  channelType: "email",
  configuration: {
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    from_email: "alerts@company.com",
    to: ["ops@company.com", "admin@company.com"]
  },
  subjectTemplate: "R2 Alert: {{alert_name}}",
  bodyTemplate: `
    Alert: {{alert_name}}
    Severity: {{severity}}
    Current Value: {{current_value}}
    Threshold: {{threshold_value}}
    Time: {{timestamp}}
    
    {{description}}
  `
};
```

### Creating a Slack Notification Channel
```typescript
const slackChannel: NotificationChannelCreateRequest = {
  name: "Engineering Slack",
  channelType: "slack",
  configuration: {
    webhook_url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  }
};
```

### Acknowledging Alerts
```typescript
await fetch(`/api/alerts/instances/${alertId}/acknowledge`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': userId
  },
  body: JSON.stringify({
    notes: "Investigating the cost spike. Will update in 30 minutes."
  })
});
```

### Bulk Alert Operations
```typescript
const bulkOperation: AlertBulkOperationRequest = {
  alertInstanceIds: ["alert1", "alert2", "alert3"],
  operation: "acknowledge",
  notes: "Mass acknowledgment during maintenance window"
};

await fetch('/api/alerts/instances/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': userId
  },
  body: JSON.stringify(bulkOperation)
});
```

## Alert Templates

The system includes pre-configured templates for common scenarios:

### Built-in Templates
- **Monthly Cost Spike (50%)**: Monitor for significant monthly cost increases
- **Daily Cost Spike (100%)**: Detect rapid daily cost changes
- **Basic Error Monitoring (5%)**: Standard error rate monitoring
- **Critical Error Monitoring (10%)**: High-priority error detection
- **Slow Response Monitoring (5s)**: Performance degradation alerts
- **Weekly Storage Growth (100%)**: Storage growth monitoring
- **Storage Quota Warning (80%)**: Quota usage warnings
- **Storage Quota Critical (95%)**: Critical quota violations

### Using Templates
```typescript
// Get recommended templates for a user
const recommendations = await fetch('/api/alerts/templates/recommended', {
  headers: { 'X-User-ID': userId }
});

// Create alert from template
const alertRequest = await fetch('/api/alerts/templates/monthly-cost-spike-50/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': userId
  },
  body: JSON.stringify({
    name: "Custom Monthly Cost Alert",
    thresholdValue: 75, // Override default 50%
    notificationChannelIds: ["my-email-channel"]
  })
});
```

## Monitoring and Maintenance

### Health Checks
The system includes comprehensive health monitoring:
- Alert evaluation success rates
- Notification delivery rates
- System response times
- Queue depths and backlogs

### Performance Metrics
Key performance indicators tracked:
- **Alert Volume**: Number of alerts over time
- **False Positive Rate**: Percentage of alerts marked as false positives
- **Resolution Time**: Average time to resolve alerts
- **Escalation Rate**: Percentage of alerts that escalate
- **Notification Delivery Rate**: Success rate of notification delivery

### Maintenance Tasks
Automated maintenance includes:
- **Daily Cleanup**: Remove old evaluation and delivery records
- **Health Monitoring**: Continuous system health assessment
- **Retry Processing**: Automatic retry of failed notifications
- **Cache Management**: Alert data caching for performance

## Security Considerations

### Access Control
- User-based alert rule isolation
- Admin-only system operations
- Secure notification channel configurations

### Data Protection
- Encrypted notification payloads
- Secure webhook endpoints
- Rate limiting on alert creation

### Audit Trail
- Complete alert history tracking
- Notification delivery logging
- User action audit trails

## Troubleshooting

### Common Issues

1. **Alerts Not Triggering**
   - Check alert rule enabled status
   - Verify threshold configurations
   - Review metric data availability
   - Check evaluation frequency settings

2. **Notifications Not Delivered**
   - Verify notification channel configurations
   - Check rate limiting settings
   - Review delivery error logs
   - Test notification channels

3. **High False Positive Rate**
   - Adjust threshold values
   - Increase minimum duration requirements
   - Review comparison windows
   - Implement suppression rules

4. **Performance Issues**
   - Monitor evaluation duration
   - Check database query performance
   - Review alert rule complexity
   - Optimize notification delivery

### Debug Commands

```bash
# Check alert system health
curl -X GET /api/alerts/jobs/stats \
  -H "X-Is-Admin: true"

# Manual alert evaluation
curl -X POST /api/alerts/evaluate \
  -H "X-Is-Admin: true"

# Retry failed notifications
curl -X POST /api/alerts/notifications/retry \
  -H "X-Is-Admin: true"

# Get alert dashboard
curl -X GET /api/alerts/dashboard \
  -H "X-User-ID: user123"
```

## Best Practices

### Alert Design
1. **Start Simple**: Begin with basic templates and customize as needed
2. **Avoid Alert Fatigue**: Use appropriate thresholds and suppression rules
3. **Test Thoroughly**: Use the test endpoint before deploying alerts
4. **Monitor Performance**: Track false positive rates and resolution times

### Notification Strategy
1. **Channel Diversity**: Use multiple notification channels for critical alerts
2. **Escalation Paths**: Implement clear escalation policies
3. **Template Consistency**: Use consistent message templates across channels
4. **Rate Limiting**: Configure appropriate rate limits to avoid spam

### Operational Excellence
1. **Regular Reviews**: Periodically review alert effectiveness
2. **Documentation**: Maintain clear runbooks for alert responses
3. **Automation**: Automate common alert response actions where possible
4. **Analytics**: Use alert analytics to continuously improve the system

## Integration Examples

### Incident Management Integration
```typescript
// Webhook payload for incident management systems
const incidentWebhook = {
  name: "Incident Management",
  channelType: "webhook",
  configuration: {
    url: "https://incident-system.com/api/alerts",
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json"
    }
  },
  bodyTemplate: JSON.stringify({
    title: "{{alert_name}}",
    severity: "{{severity}}",
    description: "{{description}}",
    metrics: {
      current_value: "{{current_value}}",
      threshold: "{{threshold_value}}"
    },
    metadata: {
      user_id: "{{user_id}}",
      alert_type: "{{alert_type}}",
      timestamp: "{{timestamp}}"
    }
  })
};
```

### Monitoring Dashboard Integration
```typescript
// Get enhanced dashboard data with alerts
const dashboardData = await fetch('/api/dashboard/enhanced', {
  headers: { 'X-User-ID': userId }
});

// Use alert widget in dashboard
const alertWidget = await fetch('/api/dashboard/alerts/widget', {
  headers: { 'X-User-ID': userId }
});
```

This alerting system provides comprehensive monitoring capabilities for R2 storage operations, enabling proactive identification and response to issues before they impact users or costs.