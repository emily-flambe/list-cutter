-- D1 Database Schema for Cutty Workers

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Saved files table
CREATE TABLE IF NOT EXISTS saved_files (
    file_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    system_tags TEXT NOT NULL DEFAULT '[]', -- JSON array as TEXT
    user_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array as TEXT
    metadata TEXT DEFAULT '{}',             -- JSON object as TEXT
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File relationships table for lineage tracking
CREATE TABLE IF NOT EXISTS file_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_id TEXT NOT NULL,
    target_file_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- 'CUT_FROM', 'DERIVED_FROM', etc.
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE,
    FOREIGN KEY (target_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_file_name ON saved_files(file_name);
CREATE INDEX IF NOT EXISTS idx_saved_files_uploaded_at ON saved_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_file_relationships_source ON file_relationships(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relationships_target ON file_relationships(target_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relationships_type ON file_relationships(relationship_type);

-- ==============================
-- FAILOVER AND DISASTER RECOVERY
-- ==============================

-- Operation queue table for failed operations
CREATE TABLE IF NOT EXISTS operation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL, -- 'UPLOAD', 'DELETE', 'GET', 'METADATA_UPDATE'
    operation_id TEXT NOT NULL UNIQUE, -- Unique identifier for each operation
    payload TEXT NOT NULL, -- JSON payload containing operation details
    priority INTEGER NOT NULL DEFAULT 5, -- 1=highest, 10=lowest
    user_id INTEGER, -- Optional user context
    file_id TEXT, -- Optional file context
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'
    error_message TEXT, -- Last error message if failed
    scheduled_at TEXT, -- When to retry (for exponential backoff)
    completed_at TEXT, -- When operation was completed
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE
);

-- Service status table for monitoring service health
CREATE TABLE IF NOT EXISTS service_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE, -- 'R2_STORAGE', 'D1_DATABASE', 'AUTH_KV'
    status TEXT NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'DEGRADED', 'OFFLINE'
    last_check TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_success TEXT, -- Last successful operation
    last_failure TEXT, -- Last failed operation
    failure_count INTEGER NOT NULL DEFAULT 0,
    degradation_reason TEXT, -- Why service is degraded
    recovery_actions TEXT, -- JSON array of recovery actions taken
    circuit_breaker_state TEXT NOT NULL DEFAULT 'CLOSED', -- 'CLOSED', 'OPEN', 'HALF_OPEN'
    circuit_breaker_opened_at TEXT, -- When circuit breaker opened
    health_metrics TEXT DEFAULT '{}' -- JSON object with health metrics
);

-- User notifications table for system status notifications
CREATE TABLE IF NOT EXISTS user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL, -- 'SERVICE_DEGRADED', 'OPERATION_QUEUED', 'OPERATION_COMPLETED', 'OPERATION_FAILED'
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    read_status INTEGER NOT NULL DEFAULT 0, -- 0=unread, 1=read
    metadata TEXT DEFAULT '{}', -- JSON object with additional data
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TEXT, -- When notification was delivered
    acknowledged_at TEXT, -- When user acknowledged notification
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System events table for audit and monitoring
CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'SERVICE_STATUS_CHANGE', 'DEGRADATION_ACTIVATED', 'RECOVERY_INITIATED'
    event_category TEXT NOT NULL, -- 'FAILOVER', 'HEALTH', 'SECURITY', 'PERFORMANCE'
    service_name TEXT, -- Related service if applicable
    user_id INTEGER, -- Related user if applicable
    event_data TEXT NOT NULL DEFAULT '{}', -- JSON object with event details
    severity TEXT NOT NULL DEFAULT 'INFO',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Failover configurations table
CREATE TABLE IF NOT EXISTS failover_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE,
    config_key TEXT NOT NULL,
    config_value TEXT NOT NULL,
    config_type TEXT NOT NULL DEFAULT 'STRING', -- 'STRING', 'NUMBER', 'BOOLEAN', 'JSON'
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Failover indexes for performance
CREATE INDEX IF NOT EXISTS idx_operation_queue_status ON operation_queue(status);
CREATE INDEX IF NOT EXISTS idx_operation_queue_priority ON operation_queue(priority);
CREATE INDEX IF NOT EXISTS idx_operation_queue_scheduled_at ON operation_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_operation_queue_user_id ON operation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_queue_operation_type ON operation_queue(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_queue_created_at ON operation_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_service_status_service_name ON service_status(service_name);
CREATE INDEX IF NOT EXISTS idx_service_status_status ON service_status(status);
CREATE INDEX IF NOT EXISTS idx_service_status_last_check ON service_status(last_check);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read_status ON user_notifications(read_status);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at);
CREATE INDEX IF NOT EXISTS idx_system_events_service_name ON system_events(service_name);

CREATE INDEX IF NOT EXISTS idx_failover_config_service_name ON failover_config(service_name);
CREATE INDEX IF NOT EXISTS idx_failover_config_key ON failover_config(config_key);

-- Initialize default service status entries
INSERT OR IGNORE INTO service_status (service_name, status, last_check) VALUES
    ('R2_STORAGE', 'HEALTHY', CURRENT_TIMESTAMP),
    ('D1_DATABASE', 'HEALTHY', CURRENT_TIMESTAMP),
    ('AUTH_KV', 'HEALTHY', CURRENT_TIMESTAMP);

-- Initialize default failover configurations
INSERT OR IGNORE INTO failover_config (service_name, config_key, config_value, config_type, description) VALUES
    ('R2_STORAGE', 'max_retries', '3', 'NUMBER', 'Maximum number of retries for R2 operations'),
    ('R2_STORAGE', 'retry_delay_ms', '1000', 'NUMBER', 'Initial retry delay in milliseconds'),
    ('R2_STORAGE', 'circuit_breaker_threshold', '5', 'NUMBER', 'Number of failures before opening circuit breaker'),
    ('R2_STORAGE', 'circuit_breaker_timeout', '60000', 'NUMBER', 'Circuit breaker timeout in milliseconds'),
    ('R2_STORAGE', 'health_check_interval', '30000', 'NUMBER', 'Health check interval in milliseconds'),
    ('OPERATION_QUEUE', 'max_queue_size', '1000', 'NUMBER', 'Maximum number of operations in queue'),
    ('OPERATION_QUEUE', 'batch_size', '10', 'NUMBER', 'Number of operations to process in batch'),
    ('OPERATION_QUEUE', 'processing_interval', '5000', 'NUMBER', 'Queue processing interval in milliseconds'),
    ('NOTIFICATIONS', 'max_notifications_per_user', '100', 'NUMBER', 'Maximum notifications per user'),
    ('NOTIFICATIONS', 'notification_retention_days', '30', 'NUMBER', 'Days to retain notifications');

-- R2 Backup System Tables
-- Main backup metadata table
CREATE TABLE IF NOT EXISTS r2_backups (
    id TEXT PRIMARY KEY,
    bucket_name TEXT NOT NULL,
    backup_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    file_count INTEGER NOT NULL DEFAULT 0,
    total_size INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL DEFAULT '',
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental')),
    created_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT
);

-- Individual backup files tracking table
CREATE TABLE IF NOT EXISTS backup_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'backed_up', 'failed')),
    backup_path TEXT NOT NULL, -- Path in backup bucket
    created_at TEXT NOT NULL,
    FOREIGN KEY (backup_id) REFERENCES r2_backups(id) ON DELETE CASCADE
);

-- Backup operation logs table
CREATE TABLE IF NOT EXISTS backup_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('start', 'progress', 'complete', 'error', 'verify')),
    message TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    FOREIGN KEY (backup_id) REFERENCES r2_backups(id) ON DELETE CASCADE
);

-- Backup configuration table for storing backup policies
CREATE TABLE IF NOT EXISTS backup_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket_name TEXT NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL DEFAULT 30,
    incremental_enabled BOOLEAN NOT NULL DEFAULT 1,
    compression_enabled BOOLEAN NOT NULL DEFAULT 0,
    encryption_enabled BOOLEAN NOT NULL DEFAULT 0,
    schedule_pattern TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    last_backup_date TEXT,
    next_backup_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Backup verification results table
CREATE TABLE IF NOT EXISTS backup_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT NOT NULL,
    verification_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'partial')),
    verified_files INTEGER NOT NULL DEFAULT 0,
    total_files INTEGER NOT NULL DEFAULT 0,
    corrupted_files INTEGER NOT NULL DEFAULT 0,
    missing_files INTEGER NOT NULL DEFAULT 0,
    checksum_mismatches INTEGER NOT NULL DEFAULT 0,
    verification_time_ms INTEGER NOT NULL DEFAULT 0,
    details TEXT, -- JSON string with detailed results
    FOREIGN KEY (backup_id) REFERENCES r2_backups(id) ON DELETE CASCADE
);

-- Backup restore operations table
CREATE TABLE IF NOT EXISTS backup_restores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT NOT NULL,
    restore_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    target_bucket TEXT NOT NULL,
    restored_files INTEGER NOT NULL DEFAULT 0,
    total_files INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    overwrite_existing BOOLEAN NOT NULL DEFAULT 0,
    verify_after_restore BOOLEAN NOT NULL DEFAULT 0,
    filters TEXT, -- JSON string with restore filters
    created_at TEXT NOT NULL,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (backup_id) REFERENCES r2_backups(id) ON DELETE CASCADE
);

-- Backup scheduling table
CREATE TABLE IF NOT EXISTS backup_schedules (
    id TEXT PRIMARY KEY,
    bucket_name TEXT NOT NULL,
    schedule_pattern TEXT NOT NULL CHECK (schedule_pattern IN ('daily', 'weekly', 'monthly')),
    next_run_time TEXT NOT NULL,
    last_run_time TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error')) DEFAULT 'active',
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Performance indexes for backup tables
CREATE INDEX IF NOT EXISTS idx_r2_backups_bucket_name ON r2_backups(bucket_name);
CREATE INDEX IF NOT EXISTS idx_r2_backups_backup_date ON r2_backups(backup_date);
CREATE INDEX IF NOT EXISTS idx_r2_backups_status ON r2_backups(status);
CREATE INDEX IF NOT EXISTS idx_r2_backups_backup_type ON r2_backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_r2_backups_created_at ON r2_backups(created_at);

CREATE INDEX IF NOT EXISTS idx_backup_files_backup_id ON backup_files(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_files_file_path ON backup_files(file_path);
CREATE INDEX IF NOT EXISTS idx_backup_files_status ON backup_files(status);
CREATE INDEX IF NOT EXISTS idx_backup_files_created_at ON backup_files(created_at);

CREATE INDEX IF NOT EXISTS idx_backup_logs_backup_id ON backup_logs(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_timestamp ON backup_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_backup_logs_event_type ON backup_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_backup_logs_level ON backup_logs(level);

CREATE INDEX IF NOT EXISTS idx_backup_config_bucket_name ON backup_config(bucket_name);
CREATE INDEX IF NOT EXISTS idx_backup_config_last_backup_date ON backup_config(last_backup_date);
CREATE INDEX IF NOT EXISTS idx_backup_config_next_backup_date ON backup_config(next_backup_date);

CREATE INDEX IF NOT EXISTS idx_backup_verifications_backup_id ON backup_verifications(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_verifications_verification_date ON backup_verifications(verification_date);
CREATE INDEX IF NOT EXISTS idx_backup_verifications_status ON backup_verifications(status);

CREATE INDEX IF NOT EXISTS idx_backup_restores_backup_id ON backup_restores(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_restores_restore_date ON backup_restores(restore_date);
CREATE INDEX IF NOT EXISTS idx_backup_restores_status ON backup_restores(status);
CREATE INDEX IF NOT EXISTS idx_backup_restores_target_bucket ON backup_restores(target_bucket);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_bucket_name ON backup_schedules(bucket_name);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run_time ON backup_schedules(next_run_time);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_status ON backup_schedules(status);

-- Views for common backup analytics queries
CREATE VIEW IF NOT EXISTS backup_summary AS
SELECT 
    b.id,
    b.bucket_name,
    b.backup_date,
    b.status,
    b.backup_type,
    b.file_count,
    b.total_size,
    b.created_at,
    b.completed_at,
    CASE 
        WHEN b.completed_at IS NOT NULL AND b.created_at IS NOT NULL 
        THEN (julianday(b.completed_at) - julianday(b.created_at)) * 24 * 60 * 60 
        ELSE NULL 
    END as duration_seconds,
    COUNT(bf.id) as actual_files_backed_up,
    SUM(CASE WHEN bf.status = 'backed_up' THEN 1 ELSE 0 END) as successful_files,
    SUM(CASE WHEN bf.status = 'failed' THEN 1 ELSE 0 END) as failed_files
FROM r2_backups b
LEFT JOIN backup_files bf ON b.id = bf.backup_id
GROUP BY b.id, b.bucket_name, b.backup_date, b.status, b.backup_type, 
         b.file_count, b.total_size, b.created_at, b.completed_at;

CREATE VIEW IF NOT EXISTS backup_health_metrics AS
SELECT 
    bucket_name,
    COUNT(*) as total_backups,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_backups,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_backups,
    ROUND(
        (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
        2
    ) as success_rate_percent,
    MAX(backup_date) as last_backup_date,
    SUM(total_size) as total_backup_size,
    AVG(file_count) as avg_files_per_backup,
    AVG(total_size) as avg_backup_size
FROM r2_backups
GROUP BY bucket_name;

-- Insert default backup configuration
INSERT OR IGNORE INTO backup_config (
    bucket_name,
    retention_days,
    incremental_enabled,
    compression_enabled,
    encryption_enabled,
    schedule_pattern,
    created_at,
    updated_at
) VALUES (
    'list-cutter-files',
    30,
    1,
    0,
    0,
    'daily',
    datetime('now'),
    datetime('now')
);

-- R2 Health Monitoring Tables
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

-- Monitoring indexes for performance optimization
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

-- Insert default monitoring configuration
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

-- Create views for common monitoring queries
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