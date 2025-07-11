-- Phase 6: Alerting System Implementation
-- Adds comprehensive alerting system for R2 storage monitoring

-- Alert rule definitions
CREATE TABLE alert_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Basic information
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT, -- NULL for system-wide alerts
    
    -- Alert type and configuration
    alert_type TEXT NOT NULL CHECK (alert_type IN ('cost_spike', 'error_rate', 'performance', 'storage_growth', 'quota_violation', 'custom')),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('storage_bytes', 'requests_class_a', 'requests_class_b', 'data_transfer_out', 'data_transfer_in', 'error_rate', 'response_time', 'throughput')),
    
    -- Threshold configuration
    threshold_value REAL NOT NULL,
    threshold_operator TEXT NOT NULL CHECK (threshold_operator IN ('>', '<', '>=', '<=', '=', '!=')),
    threshold_unit TEXT NOT NULL CHECK (threshold_unit IN ('bytes', 'percentage', 'count', 'rate', 'milliseconds', 'dollars')),
    
    -- Comparison configuration
    comparison_type TEXT NOT NULL CHECK (comparison_type IN ('absolute', 'percentage_change', 'moving_average', 'month_over_month', 'week_over_week')),
    comparison_window TEXT NOT NULL CHECK (comparison_window IN ('1h', '1d', '1w', '1m', '3m')),
    
    -- Alert conditions
    min_duration_minutes INTEGER DEFAULT 5, -- Alert must persist for this duration
    evaluation_frequency_minutes INTEGER DEFAULT 5, -- How often to evaluate
    aggregation_method TEXT DEFAULT 'avg' CHECK (aggregation_method IN ('avg', 'max', 'min', 'sum', 'count')),
    
    -- Alert severity and priority
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    
    -- State management
    enabled BOOLEAN DEFAULT 1,
    state TEXT DEFAULT 'inactive' CHECK (state IN ('inactive', 'active', 'acknowledged', 'suppressed')),
    
    -- Suppression rules
    suppression_duration_minutes INTEGER DEFAULT 60, -- Cool-down period after alert
    max_alerts_per_day INTEGER DEFAULT 10,
    
    -- Additional filters
    filters TEXT, -- JSON object for additional filtering conditions
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_evaluated_at DATETIME,
    last_triggered_at DATETIME,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for alert rules
CREATE INDEX idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX idx_alert_rules_type ON alert_rules(alert_type);
CREATE INDEX idx_alert_rules_metric_type ON alert_rules(metric_type);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_state ON alert_rules(state);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);
CREATE INDEX idx_alert_rules_evaluation ON alert_rules(enabled, last_evaluated_at);

-- Notification channels
CREATE TABLE notification_channels (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Channel identification
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'webhook', 'slack', 'discord', 'teams', 'sms')),
    user_id TEXT, -- NULL for system channels
    
    -- Channel configuration
    configuration TEXT NOT NULL, -- JSON configuration for channel
    
    -- Delivery settings
    enabled BOOLEAN DEFAULT 1,
    rate_limit_per_hour INTEGER DEFAULT 10,
    
    -- Retry configuration
    max_retries INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    
    -- Templates
    subject_template TEXT,
    body_template TEXT,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for notification channels
CREATE INDEX idx_notification_channels_user_id ON notification_channels(user_id);
CREATE INDEX idx_notification_channels_type ON notification_channels(channel_type);
CREATE INDEX idx_notification_channels_enabled ON notification_channels(enabled);

-- Alert rule to notification channel mapping
CREATE TABLE alert_rule_channels (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    alert_rule_id TEXT NOT NULL,
    notification_channel_id TEXT NOT NULL,
    
    -- Channel-specific overrides
    severity_filter TEXT CHECK (severity_filter IN ('low', 'medium', 'high', 'critical')),
    enabled BOOLEAN DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE,
    
    -- Unique constraint
    UNIQUE(alert_rule_id, notification_channel_id)
);

-- Indexes for alert rule channels
CREATE INDEX idx_alert_rule_channels_rule_id ON alert_rule_channels(alert_rule_id);
CREATE INDEX idx_alert_rule_channels_channel_id ON alert_rule_channels(notification_channel_id);
CREATE INDEX idx_alert_rule_channels_enabled ON alert_rule_channels(enabled);

-- Alert instances (fired alerts)
CREATE TABLE alert_instances (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Alert rule reference
    alert_rule_id TEXT NOT NULL,
    
    -- Alert details
    alert_level TEXT NOT NULL CHECK (alert_level IN ('warning', 'critical')),
    current_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    
    -- Alert lifecycle
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'acknowledged', 'resolved', 'suppressed')),
    started_at DATETIME NOT NULL,
    acknowledged_at DATETIME,
    resolved_at DATETIME,
    
    -- User actions
    acknowledged_by TEXT,
    resolved_by TEXT,
    notes TEXT,
    
    -- Alert context
    context TEXT, -- JSON object with additional context
    affected_resources TEXT, -- JSON array of affected resources
    
    -- Escalation tracking
    escalation_level INTEGER DEFAULT 0,
    escalated_at DATETIME,
    escalated_to TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for alert instances
CREATE INDEX idx_alert_instances_rule_id ON alert_instances(alert_rule_id);
CREATE INDEX idx_alert_instances_state ON alert_instances(state);
CREATE INDEX idx_alert_instances_level ON alert_instances(alert_level);
CREATE INDEX idx_alert_instances_started_at ON alert_instances(started_at);
CREATE INDEX idx_alert_instances_active ON alert_instances(state, started_at) WHERE state = 'active';
CREATE INDEX idx_alert_instances_acknowledged_by ON alert_instances(acknowledged_by);
CREATE INDEX idx_alert_instances_resolved_by ON alert_instances(resolved_by);

-- Notification delivery tracking
CREATE TABLE notification_deliveries (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- References
    alert_instance_id TEXT NOT NULL,
    notification_channel_id TEXT NOT NULL,
    
    -- Delivery details
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    delivery_attempt INTEGER DEFAULT 1,
    
    -- Message details
    subject TEXT,
    message_body TEXT,
    
    -- Delivery tracking
    sent_at DATETIME,
    delivered_at DATETIME,
    failed_at DATETIME,
    
    -- Error tracking
    error_message TEXT,
    error_code TEXT,
    
    -- Retry information
    next_retry_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (alert_instance_id) REFERENCES alert_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- Indexes for notification deliveries
CREATE INDEX idx_notification_deliveries_alert_id ON notification_deliveries(alert_instance_id);
CREATE INDEX idx_notification_deliveries_channel_id ON notification_deliveries(notification_channel_id);
CREATE INDEX idx_notification_deliveries_status ON notification_deliveries(delivery_status);
CREATE INDEX idx_notification_deliveries_sent_at ON notification_deliveries(sent_at);
CREATE INDEX idx_notification_deliveries_retry ON notification_deliveries(delivery_status, next_retry_at) WHERE delivery_status = 'failed';

-- Alert evaluation history
CREATE TABLE alert_evaluations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Alert rule reference
    alert_rule_id TEXT NOT NULL,
    
    -- Evaluation details
    evaluation_time DATETIME NOT NULL,
    current_value REAL NOT NULL,
    threshold_value REAL NOT NULL,
    
    -- Evaluation result
    threshold_breached BOOLEAN NOT NULL,
    alert_triggered BOOLEAN NOT NULL,
    alert_instance_id TEXT, -- NULL if no alert was triggered
    
    -- Evaluation context
    evaluation_data TEXT, -- JSON object with raw evaluation data
    
    -- Performance metrics
    evaluation_duration_ms INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (alert_instance_id) REFERENCES alert_instances(id) ON DELETE SET NULL
);

-- Indexes for alert evaluations
CREATE INDEX idx_alert_evaluations_rule_id ON alert_evaluations(alert_rule_id);
CREATE INDEX idx_alert_evaluations_time ON alert_evaluations(evaluation_time);
CREATE INDEX idx_alert_evaluations_triggered ON alert_evaluations(alert_triggered);
CREATE INDEX idx_alert_evaluations_breached ON alert_evaluations(threshold_breached);
CREATE INDEX idx_alert_evaluations_instance_id ON alert_evaluations(alert_instance_id);

-- Alert escalation policies
CREATE TABLE alert_escalation_policies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Policy identification
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT, -- NULL for system policies
    
    -- Escalation configuration
    escalation_steps TEXT NOT NULL, -- JSON array of escalation steps
    
    -- Timing
    initial_delay_minutes INTEGER DEFAULT 15,
    escalation_interval_minutes INTEGER DEFAULT 30,
    max_escalation_level INTEGER DEFAULT 3,
    
    -- Conditions
    applies_to_severity TEXT, -- JSON array of severities
    applies_to_alert_types TEXT, -- JSON array of alert types
    
    -- State
    enabled BOOLEAN DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for escalation policies
CREATE INDEX idx_escalation_policies_user_id ON alert_escalation_policies(user_id);
CREATE INDEX idx_escalation_policies_enabled ON alert_escalation_policies(enabled);

-- Alert suppression rules
CREATE TABLE alert_suppression_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    
    -- Rule identification
    name TEXT NOT NULL,
    description TEXT,
    user_id TEXT, -- NULL for system rules
    
    -- Suppression conditions
    alert_rule_ids TEXT, -- JSON array of alert rule IDs to suppress
    alert_types TEXT, -- JSON array of alert types to suppress
    severities TEXT, -- JSON array of severities to suppress
    
    -- Time-based suppression
    start_time TIME, -- Time of day to start suppression
    end_time TIME, -- Time of day to end suppression
    days_of_week TEXT, -- JSON array of days (0-6, 0=Sunday)
    timezone TEXT DEFAULT 'UTC',
    
    -- Date-based suppression
    start_date DATE,
    end_date DATE,
    
    -- Conditional suppression
    conditions TEXT, -- JSON object with conditions
    
    -- State
    enabled BOOLEAN DEFAULT 1,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for suppression rules
CREATE INDEX idx_suppression_rules_user_id ON alert_suppression_rules(user_id);
CREATE INDEX idx_suppression_rules_enabled ON alert_suppression_rules(enabled);
CREATE INDEX idx_suppression_rules_dates ON alert_suppression_rules(start_date, end_date);

-- Insert default alert rules for common scenarios
INSERT INTO alert_rules (name, description, alert_type, metric_type, threshold_value, threshold_operator, threshold_unit, comparison_type, comparison_window, severity) VALUES
-- Cost spike alerts
('Monthly Cost Spike (50%)', 'Alert when monthly costs increase by more than 50%', 'cost_spike', 'storage_bytes', 50, '>', 'percentage', 'month_over_month', '1m', 'high'),
('Daily Cost Spike (100%)', 'Alert when daily costs double compared to previous day', 'cost_spike', 'storage_bytes', 100, '>', 'percentage', 'percentage_change', '1d', 'medium'),

-- Error rate alerts
('High Error Rate (5%)', 'Alert when error rate exceeds 5%', 'error_rate', 'error_rate', 5, '>', 'percentage', 'moving_average', '1h', 'high'),
('Critical Error Rate (10%)', 'Alert when error rate exceeds 10%', 'error_rate', 'error_rate', 10, '>', 'percentage', 'moving_average', '1h', 'critical'),

-- Performance alerts
('Slow Response Time (5s)', 'Alert when average response time exceeds 5 seconds', 'performance', 'response_time', 5000, '>', 'milliseconds', 'moving_average', '1h', 'medium'),
('Very Slow Response Time (10s)', 'Alert when average response time exceeds 10 seconds', 'performance', 'response_time', 10000, '>', 'milliseconds', 'moving_average', '1h', 'high'),

-- Storage growth alerts
('Storage Growth (100% WoW)', 'Alert when storage grows by more than 100% week over week', 'storage_growth', 'storage_bytes', 100, '>', 'percentage', 'week_over_week', '1w', 'medium'),
('Rapid Storage Growth (200% WoW)', 'Alert when storage grows by more than 200% week over week', 'storage_growth', 'storage_bytes', 200, '>', 'percentage', 'week_over_week', '1w', 'high');

-- Insert default notification channels
INSERT INTO notification_channels (name, channel_type, configuration, subject_template, body_template) VALUES
('Default Email', 'email', '{"smtp_host": "smtp.example.com", "smtp_port": 587, "from_email": "alerts@example.com"}', 
 'R2 Storage Alert: {{alert_name}}', 
 'Alert: {{alert_name}}\nSeverity: {{severity}}\nCurrent Value: {{current_value}}\nThreshold: {{threshold_value}}\nTime: {{timestamp}}\n\nDescription: {{description}}'),

('Default Webhook', 'webhook', '{"url": "https://example.com/webhook", "method": "POST", "headers": {"Content-Type": "application/json"}}',
 'R2 Storage Alert',
 '{"alert_name": "{{alert_name}}", "severity": "{{severity}}", "current_value": {{current_value}}, "threshold_value": {{threshold_value}}, "timestamp": "{{timestamp}}"}');

-- Insert default escalation policy
INSERT INTO alert_escalation_policies (name, description, escalation_steps, applies_to_severity, applies_to_alert_types) VALUES
('Default Escalation', 'Default escalation policy for high and critical alerts',
 '[{"level": 1, "delay_minutes": 15, "channels": ["email"]}, {"level": 2, "delay_minutes": 30, "channels": ["email", "webhook"]}, {"level": 3, "delay_minutes": 60, "channels": ["email", "webhook", "slack"]}]',
 '["high", "critical"]',
 '["cost_spike", "error_rate", "performance", "storage_growth"]');

-- Triggers for updated_at timestamps
CREATE TRIGGER update_alert_rules_timestamp 
AFTER UPDATE ON alert_rules
BEGIN
    UPDATE alert_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_notification_channels_timestamp 
AFTER UPDATE ON notification_channels
BEGIN
    UPDATE notification_channels SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_alert_instances_timestamp 
AFTER UPDATE ON alert_instances
BEGIN
    UPDATE alert_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_notification_deliveries_timestamp 
AFTER UPDATE ON notification_deliveries
BEGIN
    UPDATE notification_deliveries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_escalation_policies_timestamp 
AFTER UPDATE ON alert_escalation_policies
BEGIN
    UPDATE alert_escalation_policies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_suppression_rules_timestamp 
AFTER UPDATE ON alert_suppression_rules
BEGIN
    UPDATE alert_suppression_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Views for common alert queries
CREATE VIEW active_alerts AS
SELECT 
    ai.id as alert_instance_id,
    ai.alert_level,
    ai.current_value,
    ai.threshold_value,
    ai.started_at,
    ai.state,
    ar.name as alert_rule_name,
    ar.description as alert_rule_description,
    ar.alert_type,
    ar.metric_type,
    ar.severity,
    ar.user_id,
    u.email as user_email,
    u.username as user_username
FROM alert_instances ai
JOIN alert_rules ar ON ai.alert_rule_id = ar.id
LEFT JOIN users u ON ar.user_id = u.id
WHERE ai.state = 'active'
ORDER BY ai.started_at DESC;

CREATE VIEW alert_summary AS
SELECT 
    ar.id as alert_rule_id,
    ar.name as alert_rule_name,
    ar.alert_type,
    ar.severity,
    ar.enabled,
    ar.state,
    ar.user_id,
    COUNT(ai.id) as total_alerts,
    COUNT(CASE WHEN ai.state = 'active' THEN 1 END) as active_alerts,
    COUNT(CASE WHEN ai.state = 'acknowledged' THEN 1 END) as acknowledged_alerts,
    COUNT(CASE WHEN ai.state = 'resolved' THEN 1 END) as resolved_alerts,
    MAX(ai.started_at) as last_alert_time,
    ar.last_evaluated_at
FROM alert_rules ar
LEFT JOIN alert_instances ai ON ar.id = ai.alert_rule_id
GROUP BY ar.id, ar.name, ar.alert_type, ar.severity, ar.enabled, ar.state, ar.user_id, ar.last_evaluated_at;

CREATE VIEW notification_delivery_stats AS
SELECT 
    nc.id as channel_id,
    nc.name as channel_name,
    nc.channel_type,
    COUNT(nd.id) as total_deliveries,
    COUNT(CASE WHEN nd.delivery_status = 'sent' THEN 1 END) as sent_count,
    COUNT(CASE WHEN nd.delivery_status = 'delivered' THEN 1 END) as delivered_count,
    COUNT(CASE WHEN nd.delivery_status = 'failed' THEN 1 END) as failed_count,
    AVG(CASE WHEN nd.delivery_status = 'delivered' THEN 
        (julianday(nd.delivered_at) - julianday(nd.sent_at)) * 24 * 60 * 60 
    END) as avg_delivery_time_seconds,
    MAX(nd.sent_at) as last_used_at
FROM notification_channels nc
LEFT JOIN notification_deliveries nd ON nc.id = nd.notification_channel_id
GROUP BY nc.id, nc.name, nc.channel_type;