-- Security Audit System Migration
-- Comprehensive security event logging, monitoring, and compliance features

-- Security Events Table - Core event storage
CREATE TABLE security_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    category TEXT NOT NULL CHECK (category IN ('authentication', 'authorization', 'file_access', 'security_violation', 'system', 'compliance', 'administration', 'monitoring')),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
    
    -- Event metadata
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    correlation_id TEXT,
    session_id TEXT,
    trace_id TEXT,
    
    -- Actor information
    user_id TEXT,
    user_email TEXT,
    user_role TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Resource information
    resource_type TEXT,
    resource_id TEXT,
    resource_name TEXT,
    
    -- Event details
    message TEXT NOT NULL,
    details TEXT, -- JSON with event-specific data
    
    -- Context information
    request_id TEXT,
    operation_id TEXT,
    source TEXT NOT NULL,
    source_version TEXT,
    
    -- Compliance tracking
    compliance_frameworks TEXT, -- JSON array of frameworks
    retention_period INTEGER DEFAULT 2555, -- Default 7 years in days
    
    -- Incident response
    requires_response BOOLEAN DEFAULT 0,
    response_actions TEXT, -- JSON array of actions
    response_status TEXT CHECK (response_status IN ('pending', 'in_progress', 'completed', 'failed')),
    
    -- Enrichment data
    geo_location TEXT, -- JSON with location data
    device_fingerprint TEXT,
    threat_intelligence TEXT, -- JSON with threat data
    
    -- Indexing and partitioning
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for security_events table
CREATE INDEX idx_security_events_type ON security_events(type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_category ON security_events(category);
CREATE INDEX idx_security_events_risk_level ON security_events(risk_level);
CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX idx_security_events_resource_type ON security_events(resource_type);
CREATE INDEX idx_security_events_resource_id ON security_events(resource_id);
CREATE INDEX idx_security_events_correlation_id ON security_events(correlation_id);
CREATE INDEX idx_security_events_session_id ON security_events(session_id);
CREATE INDEX idx_security_events_requires_response ON security_events(requires_response);
CREATE INDEX idx_security_events_response_status ON security_events(response_status);

-- Composite indexes for common queries
CREATE INDEX idx_security_events_type_severity_timestamp ON security_events(type, severity, timestamp);
CREATE INDEX idx_security_events_user_timestamp ON security_events(user_id, timestamp);
CREATE INDEX idx_security_events_category_timestamp ON security_events(category, timestamp);

-- Audit Trail Table - Detailed compliance tracking
CREATE TABLE audit_trail (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    old_value TEXT, -- JSON or serialized data
    new_value TEXT, -- JSON or serialized data
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'partial')),
    compliance_frameworks TEXT NOT NULL, -- JSON array
    retention_period INTEGER NOT NULL DEFAULT 2555, -- 7 years
    checksum TEXT NOT NULL, -- For integrity verification
    
    -- Additional context
    request_id TEXT,
    session_id TEXT,
    business_justification TEXT,
    approval_required BOOLEAN DEFAULT 0,
    approver_id TEXT,
    approved_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES security_events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for audit_trail table
CREATE INDEX idx_audit_trail_event_id ON audit_trail(event_id);
CREATE INDEX idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp);
CREATE INDEX idx_audit_trail_resource_type ON audit_trail(resource_type);
CREATE INDEX idx_audit_trail_resource_id ON audit_trail(resource_id);
CREATE INDEX idx_audit_trail_outcome ON audit_trail(outcome);
CREATE INDEX idx_audit_trail_checksum ON audit_trail(checksum);

-- Security Incidents Table - Track security incidents
CREATE TABLE security_incidents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    
    -- Incident details
    event_ids TEXT NOT NULL, -- JSON array of related event IDs
    affected_users TEXT, -- JSON array of user IDs
    affected_resources TEXT, -- JSON array of resource IDs
    root_cause TEXT,
    impact_assessment TEXT,
    
    -- Timeline
    detected_at DATETIME NOT NULL,
    acknowledged_at DATETIME,
    resolved_at DATETIME,
    closed_at DATETIME,
    
    -- Response
    assigned_to TEXT,
    response_team TEXT, -- JSON array of user IDs
    actions_taken TEXT NOT NULL, -- JSON array of actions
    preventive_measures TEXT, -- JSON array of measures
    
    -- Compliance
    reporting_required BOOLEAN DEFAULT 0,
    reported_to_authorities DATETIME,
    compliance_frameworks TEXT NOT NULL, -- JSON array
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    tags TEXT, -- JSON array
    external_ticket_id TEXT,
    
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for security_incidents table
CREATE INDEX idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX idx_security_incidents_status ON security_incidents(status);
CREATE INDEX idx_security_incidents_detected_at ON security_incidents(detected_at);
CREATE INDEX idx_security_incidents_assigned_to ON security_incidents(assigned_to);
CREATE INDEX idx_security_incidents_reporting_required ON security_incidents(reporting_required);

-- Security Alert Rules Table - Define alerting rules
CREATE TABLE security_alert_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    
    -- Trigger conditions
    event_types TEXT NOT NULL, -- JSON array of event types
    severity_threshold TEXT NOT NULL CHECK (severity_threshold IN ('critical', 'high', 'medium', 'low', 'info')),
    conditions TEXT NOT NULL, -- JSON array of condition objects
    
    -- Time-based conditions
    time_window INTEGER, -- in minutes
    event_count_threshold INTEGER,
    
    -- Response actions
    actions TEXT NOT NULL, -- JSON array of response actions
    escalation_rules TEXT, -- JSON array of escalation rules
    
    -- Notification settings
    notification_channels TEXT NOT NULL, -- JSON array
    suppression_rules TEXT, -- JSON array
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for security_alert_rules table
CREATE INDEX idx_security_alert_rules_enabled ON security_alert_rules(enabled);
CREATE INDEX idx_security_alert_rules_severity ON security_alert_rules(severity_threshold);
CREATE INDEX idx_security_alert_rules_created_by ON security_alert_rules(created_by);

-- Security Metrics Table - Aggregated security metrics
CREATE TABLE security_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    timeframe_start DATETIME NOT NULL,
    timeframe_end DATETIME NOT NULL,
    
    -- Event counts by type
    event_counts TEXT NOT NULL, -- JSON object with event type counts
    severity_counts TEXT NOT NULL, -- JSON object with severity counts
    category_counts TEXT NOT NULL, -- JSON object with category counts
    risk_level_counts TEXT NOT NULL, -- JSON object with risk level counts
    
    -- Specific metrics
    authentication_metrics TEXT, -- JSON object
    file_access_metrics TEXT, -- JSON object
    security_violation_metrics TEXT, -- JSON object
    compliance_metrics TEXT, -- JSON object
    performance_metrics TEXT, -- JSON object
    
    -- Aggregation metadata
    aggregation_type TEXT NOT NULL CHECK (aggregation_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(timeframe_start, timeframe_end, aggregation_type)
);

-- Indexes for security_metrics table
CREATE INDEX idx_security_metrics_timeframe ON security_metrics(timeframe_start, timeframe_end);
CREATE INDEX idx_security_metrics_aggregation_type ON security_metrics(aggregation_type);
CREATE INDEX idx_security_metrics_created_at ON security_metrics(created_at);

-- Event Processing Pipeline Table - Define processing pipelines
CREATE TABLE event_processing_pipelines (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    
    -- Processing stages
    stages TEXT NOT NULL, -- JSON array of processing stages
    
    -- Input/output
    input_sources TEXT NOT NULL, -- JSON array
    output_destinations TEXT NOT NULL, -- JSON array
    
    -- Error handling
    error_handling TEXT NOT NULL, -- JSON object
    
    -- Monitoring
    metrics_enabled BOOLEAN DEFAULT 1,
    logging_level TEXT DEFAULT 'info' CHECK (logging_level IN ('debug', 'info', 'warn', 'error')),
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

-- Indexes for event_processing_pipelines table
CREATE INDEX idx_event_processing_pipelines_enabled ON event_processing_pipelines(enabled);
CREATE INDEX idx_event_processing_pipelines_name ON event_processing_pipelines(name);

-- Security Dashboard Widgets Table - Dashboard configuration
CREATE TABLE security_dashboard_widgets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    type TEXT NOT NULL CHECK (type IN ('metric', 'chart', 'table', 'alert', 'map')),
    title TEXT NOT NULL,
    description TEXT,
    
    -- Data configuration
    data_source TEXT NOT NULL CHECK (data_source IN ('security_events', 'audit_trail', 'metrics', 'incidents')),
    query TEXT NOT NULL, -- JSON query configuration
    
    -- Display configuration
    refresh_interval INTEGER DEFAULT 300, -- in seconds
    chart_type TEXT CHECK (chart_type IN ('line', 'bar', 'pie', 'area', 'scatter')),
    display_options TEXT, -- JSON object
    
    -- Position and size
    position TEXT NOT NULL, -- JSON object {x, y}
    size TEXT NOT NULL, -- JSON object {width, height}
    
    -- Permissions
    visible_to_roles TEXT NOT NULL, -- JSON array of roles
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for security_dashboard_widgets table
CREATE INDEX idx_security_dashboard_widgets_type ON security_dashboard_widgets(type);
CREATE INDEX idx_security_dashboard_widgets_created_by ON security_dashboard_widgets(created_by);

-- Threat Intelligence Table - Store threat intelligence data
CREATE TABLE threat_intelligence (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    indicator_type TEXT NOT NULL CHECK (indicator_type IN ('ip', 'domain', 'url', 'hash', 'email')),
    indicator_value TEXT NOT NULL,
    threat_type TEXT NOT NULL,
    confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Threat details
    description TEXT,
    first_seen DATETIME,
    last_seen DATETIME,
    source TEXT NOT NULL,
    ttl INTEGER, -- Time to live in seconds
    
    -- Tags and classification
    tags TEXT, -- JSON array
    classification TEXT, -- JSON object
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(indicator_type, indicator_value, source)
);

-- Indexes for threat_intelligence table
CREATE INDEX idx_threat_intelligence_indicator ON threat_intelligence(indicator_type, indicator_value);
CREATE INDEX idx_threat_intelligence_threat_type ON threat_intelligence(threat_type);
CREATE INDEX idx_threat_intelligence_confidence ON threat_intelligence(confidence_score);
CREATE INDEX idx_threat_intelligence_last_seen ON threat_intelligence(last_seen);

-- User Security Profiles Table - Track user security behavior
CREATE TABLE user_security_profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    
    -- Authentication patterns
    typical_login_hours TEXT, -- JSON array of hours
    typical_ip_ranges TEXT, -- JSON array of IP ranges
    typical_locations TEXT, -- JSON array of locations
    typical_devices TEXT, -- JSON array of device fingerprints
    
    -- Risk assessment
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_factors TEXT, -- JSON array of risk factors
    last_assessment DATETIME,
    
    -- Behavioral baselines
    average_session_duration INTEGER, -- in seconds
    typical_file_operations TEXT, -- JSON object
    unusual_activity_threshold INTEGER DEFAULT 5,
    
    -- Security flags
    requires_additional_verification BOOLEAN DEFAULT 0,
    suspicious_activity_detected BOOLEAN DEFAULT 0,
    account_compromised BOOLEAN DEFAULT 0,
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- Indexes for user_security_profiles table
CREATE INDEX idx_user_security_profiles_user_id ON user_security_profiles(user_id);
CREATE INDEX idx_user_security_profiles_risk_score ON user_security_profiles(risk_score);
CREATE INDEX idx_user_security_profiles_suspicious ON user_security_profiles(suspicious_activity_detected);
CREATE INDEX idx_user_security_profiles_compromised ON user_security_profiles(account_compromised);

-- Security Configuration Table - Store security settings
CREATE TABLE security_configuration (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    
    -- Configuration metadata
    category TEXT NOT NULL,
    is_sensitive BOOLEAN DEFAULT 0,
    requires_restart BOOLEAN DEFAULT 0,
    
    -- Validation
    validation_rules TEXT, -- JSON object with validation rules
    default_value TEXT,
    
    -- Audit trail
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for security_configuration table
CREATE INDEX idx_security_configuration_key ON security_configuration(key);
CREATE INDEX idx_security_configuration_category ON security_configuration(category);
CREATE INDEX idx_security_configuration_sensitive ON security_configuration(is_sensitive);

-- Insert default security configuration
INSERT INTO security_configuration (key, value, value_type, description, category, default_value) VALUES
('max_login_attempts', '5', 'number', 'Maximum failed login attempts before account lockout', 'authentication', '5'),
('account_lockout_duration', '1800', 'number', 'Account lockout duration in seconds', 'authentication', '1800'),
('session_timeout', '3600', 'number', 'Session timeout in seconds', 'session', '3600'),
('max_file_size', '52428800', 'number', 'Maximum file size in bytes (50MB)', 'file_upload', '52428800'),
('threat_intel_enabled', 'true', 'boolean', 'Enable threat intelligence checking', 'security', 'true'),
('audit_retention_days', '2555', 'number', 'Audit log retention period in days (7 years)', 'compliance', '2555'),
('rate_limit_requests_per_minute', '60', 'number', 'Rate limit requests per minute per user', 'rate_limiting', '60'),
('suspicious_activity_threshold', '10', 'number', 'Threshold for suspicious activity detection', 'monitoring', '10'),
('auto_incident_response_enabled', 'true', 'boolean', 'Enable automatic incident response', 'incident_response', 'true'),
('gdpr_compliance_enabled', 'true', 'boolean', 'Enable GDPR compliance features', 'compliance', 'true'),
('soc2_compliance_enabled', 'true', 'boolean', 'Enable SOC2 compliance features', 'compliance', 'true');

-- Create triggers for timestamp updates
CREATE TRIGGER update_security_incidents_timestamp 
AFTER UPDATE ON security_incidents
BEGIN
    UPDATE security_incidents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_security_alert_rules_timestamp 
AFTER UPDATE ON security_alert_rules
BEGIN
    UPDATE security_alert_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_event_processing_pipelines_timestamp 
AFTER UPDATE ON event_processing_pipelines
BEGIN
    UPDATE event_processing_pipelines SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_threat_intelligence_timestamp 
AFTER UPDATE ON threat_intelligence
BEGIN
    UPDATE threat_intelligence SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_security_profiles_timestamp 
AFTER UPDATE ON user_security_profiles
BEGIN
    UPDATE user_security_profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_security_configuration_timestamp 
AFTER UPDATE ON security_configuration
BEGIN
    UPDATE security_configuration SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Create views for common security queries
CREATE VIEW security_events_summary AS
SELECT 
    date(timestamp) as event_date,
    category,
    severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN requires_response = 1 THEN 1 END) as events_requiring_response
FROM security_events
GROUP BY date(timestamp), category, severity;

CREATE VIEW high_risk_events AS
SELECT 
    id,
    type,
    severity,
    risk_level,
    timestamp,
    user_id,
    message,
    resource_type,
    resource_id,
    requires_response,
    response_status
FROM security_events
WHERE risk_level IN ('high', 'critical')
    OR severity IN ('high', 'critical')
    OR requires_response = 1
ORDER BY timestamp DESC;

CREATE VIEW compliance_audit_view AS
SELECT 
    se.id as event_id,
    se.type as event_type,
    se.timestamp,
    se.user_id,
    se.resource_type,
    se.resource_id,
    at.action,
    at.outcome,
    at.checksum,
    at.compliance_frameworks,
    at.retention_period
FROM security_events se
JOIN audit_trail at ON se.id = at.event_id
WHERE at.compliance_frameworks IS NOT NULL
ORDER BY se.timestamp DESC;

-- Create indexes on views for better performance
CREATE INDEX idx_security_events_date ON security_events(date(timestamp));
CREATE INDEX idx_security_events_high_risk ON security_events(risk_level, severity, timestamp) WHERE risk_level IN ('high', 'critical') OR severity IN ('high', 'critical');