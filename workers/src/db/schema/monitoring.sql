-- R2 Health Monitoring Database Schema
-- This schema provides comprehensive health monitoring for R2 storage operations

-- R2 Health Check Results Table
CREATE TABLE IF NOT EXISTS r2_health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'degraded')),
    response_time_ms INTEGER NOT NULL,
    error_message TEXT,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('put', 'get', 'delete', 'list', 'head')),
    bucket_name TEXT NOT NULL,
    test_file_key TEXT,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}' -- JSON object as TEXT
);

-- Circuit Breaker State Events Table
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
    previous_state TEXT CHECK (previous_state IN ('closed', 'open', 'half_open')),
    reason TEXT NOT NULL,
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_threshold INTEGER NOT NULL,
    recovery_timeout_ms INTEGER NOT NULL,
    service_name TEXT NOT NULL DEFAULT 'r2',
    metrics TEXT DEFAULT '{}' -- JSON object as TEXT
);

-- Service Alerts Table
CREATE TABLE IF NOT EXISTS service_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('circuit_breaker_open', 'high_error_rate', 'slow_response', 'service_degraded', 'service_recovered')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    service_name TEXT NOT NULL DEFAULT 'r2',
    message TEXT NOT NULL,
    details TEXT DEFAULT '{}', -- JSON object as TEXT
    resolved_at TEXT,
    resolution_notes TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_by TEXT DEFAULT 'system'
);

-- R2 Operation Metrics Table (for aggregated statistics)
CREATE TABLE IF NOT EXISTS r2_operation_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('put', 'get', 'delete', 'list', 'head')),
    bucket_name TEXT NOT NULL,
    total_operations INTEGER DEFAULT 0,
    successful_operations INTEGER DEFAULT 0,
    failed_operations INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    min_response_time_ms INTEGER DEFAULT 0,
    max_response_time_ms INTEGER DEFAULT 0,
    error_rate REAL DEFAULT 0, -- Percentage
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    period_duration_ms INTEGER NOT NULL
);

-- Health Check Configuration Table
CREATE TABLE IF NOT EXISTS health_check_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE DEFAULT 'r2',
    check_interval_ms INTEGER NOT NULL DEFAULT 30000, -- 30 seconds
    timeout_ms INTEGER NOT NULL DEFAULT 5000, -- 5 seconds
    failure_threshold INTEGER NOT NULL DEFAULT 3,
    recovery_timeout_ms INTEGER NOT NULL DEFAULT 60000, -- 1 minute
    slow_response_threshold_ms INTEGER NOT NULL DEFAULT 2000, -- 2 seconds
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    test_operations TEXT DEFAULT '["get", "put", "delete"]', -- JSON array as TEXT
    alert_on_failure BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_recovery BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_r2_health_checks_timestamp ON r2_health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_r2_health_checks_status ON r2_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_r2_health_checks_operation_type ON r2_health_checks(operation_type);
CREATE INDEX IF NOT EXISTS idx_r2_health_checks_bucket_name ON r2_health_checks(bucket_name);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_timestamp ON circuit_breaker_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_state ON circuit_breaker_events(state);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_service_name ON circuit_breaker_events(service_name);

CREATE INDEX IF NOT EXISTS idx_service_alerts_timestamp ON service_alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_service_alerts_type ON service_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_service_alerts_severity ON service_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_service_alerts_resolved ON service_alerts(resolved_at);
CREATE INDEX IF NOT EXISTS idx_service_alerts_service_name ON service_alerts(service_name);

CREATE INDEX IF NOT EXISTS idx_r2_operation_metrics_timestamp ON r2_operation_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_r2_operation_metrics_operation_type ON r2_operation_metrics(operation_type);
CREATE INDEX IF NOT EXISTS idx_r2_operation_metrics_bucket_name ON r2_operation_metrics(bucket_name);
CREATE INDEX IF NOT EXISTS idx_r2_operation_metrics_period_start ON r2_operation_metrics(period_start);

CREATE INDEX IF NOT EXISTS idx_health_check_config_service_name ON health_check_config(service_name);
CREATE INDEX IF NOT EXISTS idx_health_check_config_enabled ON health_check_config(enabled);

-- Insert default configuration
INSERT OR IGNORE INTO health_check_config (
    service_name,
    check_interval_ms,
    timeout_ms,
    failure_threshold,
    recovery_timeout_ms,
    slow_response_threshold_ms,
    enabled,
    test_operations,
    alert_on_failure,
    alert_on_recovery
) VALUES (
    'r2',
    30000,  -- 30 seconds
    5000,   -- 5 seconds
    3,      -- 3 failures
    60000,  -- 1 minute recovery
    2000,   -- 2 seconds slow threshold
    TRUE,
    '["get", "put", "delete"]',
    TRUE,
    TRUE
);

-- Create views for common queries
CREATE VIEW IF NOT EXISTS v_current_health_status AS
SELECT 
    operation_type,
    bucket_name,
    status,
    response_time_ms,
    error_message,
    timestamp
FROM r2_health_checks 
WHERE id IN (
    SELECT MAX(id) 
    FROM r2_health_checks 
    GROUP BY operation_type, bucket_name
);

CREATE VIEW IF NOT EXISTS v_circuit_breaker_current_state AS
SELECT 
    service_name,
    state,
    reason,
    failure_count,
    success_count,
    timestamp
FROM circuit_breaker_events 
WHERE id IN (
    SELECT MAX(id) 
    FROM circuit_breaker_events 
    GROUP BY service_name
);

CREATE VIEW IF NOT EXISTS v_active_alerts AS
SELECT 
    id,
    timestamp,
    alert_type,
    severity,
    service_name,
    message,
    details,
    created_by
FROM service_alerts 
WHERE resolved_at IS NULL
ORDER BY severity DESC, timestamp DESC;

-- Create triggers for automatic cleanup (optional - keeps recent data)
CREATE TRIGGER IF NOT EXISTS cleanup_old_health_checks
AFTER INSERT ON r2_health_checks
BEGIN
    DELETE FROM r2_health_checks 
    WHERE timestamp < datetime('now', '-7 days')
    AND id NOT IN (
        SELECT id FROM r2_health_checks 
        ORDER BY timestamp DESC 
        LIMIT 10000
    );
END;

CREATE TRIGGER IF NOT EXISTS cleanup_old_circuit_breaker_events
AFTER INSERT ON circuit_breaker_events
BEGIN
    DELETE FROM circuit_breaker_events 
    WHERE timestamp < datetime('now', '-30 days')
    AND id NOT IN (
        SELECT id FROM circuit_breaker_events 
        ORDER BY timestamp DESC 
        LIMIT 5000
    );
END;