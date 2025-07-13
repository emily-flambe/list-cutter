-- D1-COMPATIBLE CLEAN MIGRATION
-- This migration contains the complete, final database schema optimized for Cloudflare D1
-- This replaces all previous migrations and should be run on clean databases
-- 
-- Run this migration with: make migrations ENV=clean
-- This will clear all existing data and apply the final schema

-- D1 doesn't support most PRAGMA statements, so they are removed
-- Only enable foreign key constraints (supported by D1)
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Users table (email is OPTIONAL)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE, -- OPTIONAL - removed NOT NULL constraint
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    email_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Files table (enhanced with R2 compatibility)
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    r2_key TEXT UNIQUE NOT NULL,
    checksum TEXT,
    upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    row_count INTEGER,
    column_count INTEGER,
    columns_metadata TEXT, -- JSON
    tags TEXT, -- JSON array
    storage_class TEXT DEFAULT 'Standard' CHECK (storage_class IN ('Standard', 'InfrequentAccess')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved filters table
CREATE TABLE IF NOT EXISTS saved_filters (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    filter_config TEXT NOT NULL, -- JSON
    result_count INTEGER,
    is_public BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- =============================================================================
-- AUTHENTICATION & API TABLES
-- =============================================================================

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    key_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON array of permissions
    created_at INTEGER NOT NULL,
    last_used INTEGER,
    expires_at INTEGER,
    is_active INTEGER DEFAULT 1,
    rate_limit_override INTEGER, -- Custom rate limit for this key
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Key usage tracking
CREATE TABLE IF NOT EXISTS api_key_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    response_status INTEGER,
    response_time INTEGER,
    FOREIGN KEY (key_id) REFERENCES api_keys(key_id) ON DELETE CASCADE
);

-- =============================================================================
-- AUDIT & SECURITY TABLES
-- =============================================================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    method TEXT,
    success INTEGER NOT NULL,
    error_code TEXT,
    error_message TEXT,
    metadata TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Security analytics aggregation table
CREATE TABLE IF NOT EXISTS security_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    failure_count INTEGER NOT NULL,
    unique_users INTEGER,
    unique_ips INTEGER,
    avg_response_time REAL,
    created_at TEXT NOT NULL,
    UNIQUE(date, event_type)
);

-- =============================================================================
-- FILE PROCESSING & STORAGE TABLES
-- =============================================================================

-- Multipart uploads table
CREATE TABLE multipart_uploads (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    upload_id TEXT UNIQUE NOT NULL, -- R2 multipart upload ID
    file_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    total_size INTEGER,
    parts_uploaded INTEGER DEFAULT 0,
    total_parts INTEGER,
    session_data TEXT NOT NULL, -- JSON with upload metadata
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- File access logs table
CREATE TABLE file_access_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL CHECK (action IN ('upload', 'download', 'delete', 'process', 'migrate')),
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    bytes_transferred INTEGER,
    duration_ms INTEGER,
    metadata TEXT, -- JSON with additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- File processing queue table
CREATE TABLE file_processing_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('process_csv', 'generate_preview', 'validate_integrity', 'migrate')),
    priority INTEGER DEFAULT 1,
    parameters TEXT, -- JSON with operation parameters
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    result_data TEXT, -- JSON with operation results
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- MONITORING & ALERTING TABLES
-- =============================================================================

-- Storage metrics table
CREATE TABLE storage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    metric_type TEXT NOT NULL, -- 'storage_used', 'file_count', 'bandwidth_used'
    metric_value INTEGER NOT NULL,
    measurement_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Alert configurations table
CREATE TABLE alert_configurations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    alert_type TEXT NOT NULL, -- 'threshold', 'anomaly', 'pattern'
    metric_type TEXT NOT NULL,
    conditions TEXT NOT NULL, -- JSON with alert conditions
    threshold_value REAL,
    is_enabled BOOLEAN DEFAULT 1,
    notification_channels TEXT, -- JSON array of notification methods
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Alert instances table
CREATE TABLE alert_instances (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    configuration_id TEXT NOT NULL,
    alert_level TEXT NOT NULL CHECK (alert_level IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metric_value REAL,
    threshold_value REAL,
    triggered_at DATETIME NOT NULL,
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    resolved_at DATETIME,
    resolved_by TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    metadata TEXT, -- JSON with additional context
    FOREIGN KEY (configuration_id) REFERENCES alert_configurations(id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- BACKUP & RECOVERY TABLES
-- =============================================================================

-- Backup configurations table
CREATE TABLE backup_configurations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'differential')),
    schedule_cron TEXT, -- Cron expression for scheduled backups
    retention_days INTEGER DEFAULT 30,
    compression_enabled BOOLEAN DEFAULT 1,
    encryption_enabled BOOLEAN DEFAULT 1,
    destination_config TEXT NOT NULL, -- JSON with backup destination details
    is_enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup instances table
CREATE TABLE backup_instances (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    configuration_id TEXT,
    backup_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at DATETIME,
    completed_at DATETIME,
    backup_size INTEGER,
    files_count INTEGER,
    compression_ratio REAL,
    destination_path TEXT,
    checksum TEXT,
    error_message TEXT,
    metadata TEXT, -- JSON with backup details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (configuration_id) REFERENCES backup_configurations(id) ON DELETE SET NULL
);

-- =============================================================================
-- QUOTA & ACCESS CONTROL TABLES
-- =============================================================================

-- User quotas table
CREATE TABLE user_quotas (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    quota_type TEXT NOT NULL, -- 'storage', 'bandwidth', 'files', 'api_calls'
    quota_limit INTEGER NOT NULL, -- Limit in appropriate units
    current_usage INTEGER DEFAULT 0,
    reset_period TEXT DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly', 'yearly'
    last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, quota_type)
);

-- File access permissions table
CREATE TABLE file_access_permissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write', 'delete', 'share')),
    granted_by TEXT,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(file_id, user_id, permission_type)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Files indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_r2_key ON files(r2_key);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(upload_status);
CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum);
CREATE INDEX IF NOT EXISTS idx_files_storage_class ON files(storage_class);

-- Saved filters indexes
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_file_id ON saved_filters(file_id);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);

-- API key usage indexes
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_success ON security_events(success);
CREATE INDEX IF NOT EXISTS idx_security_analytics_date ON security_analytics(date);
CREATE INDEX IF NOT EXISTS idx_security_analytics_type ON security_analytics(event_type);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- File processing indexes
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_user_id ON multipart_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_upload_id ON multipart_uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_status ON multipart_uploads(status);
CREATE INDEX IF NOT EXISTS idx_multipart_uploads_expires_at ON multipart_uploads(expires_at);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_action ON file_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created_at ON file_access_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_file_processing_queue_status ON file_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_file_processing_queue_priority ON file_processing_queue(priority);
CREATE INDEX IF NOT EXISTS idx_file_processing_queue_scheduled_at ON file_processing_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_file_processing_queue_file_id ON file_processing_queue(file_id);

-- Storage metrics indexes
CREATE INDEX IF NOT EXISTS idx_storage_metrics_user_id ON storage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_metrics_date ON storage_metrics(measurement_date);
CREATE INDEX IF NOT EXISTS idx_storage_metrics_type ON storage_metrics(metric_type);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_alert_configurations_enabled ON alert_configurations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_type ON alert_configurations(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_instances_config_id ON alert_instances(configuration_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_status ON alert_instances(status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_triggered_at ON alert_instances(triggered_at);

-- Backup indexes
CREATE INDEX IF NOT EXISTS idx_backup_configurations_enabled ON backup_configurations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_backup_instances_config_id ON backup_instances(configuration_id);
CREATE INDEX IF NOT EXISTS idx_backup_instances_status ON backup_instances(status);
CREATE INDEX IF NOT EXISTS idx_backup_instances_created_at ON backup_instances(created_at);

-- Quota indexes
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_type ON user_quotas(quota_type);
CREATE INDEX IF NOT EXISTS idx_user_quotas_enabled ON user_quotas(is_enabled);

-- Access control indexes
CREATE INDEX IF NOT EXISTS idx_file_access_permissions_file_id ON file_access_permissions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_permissions_user_id ON file_access_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_permissions_active ON file_access_permissions(is_active);

-- =============================================================================
-- TRIGGERS FOR AUTOMATION
-- =============================================================================

-- Update timestamps triggers
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_files_timestamp 
AFTER UPDATE ON files
BEGIN
    UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_saved_filters_timestamp 
AFTER UPDATE ON saved_filters
BEGIN
    UPDATE saved_filters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_alert_configurations_timestamp 
AFTER UPDATE ON alert_configurations
BEGIN
    UPDATE alert_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_backup_configurations_timestamp 
AFTER UPDATE ON backup_configurations
BEGIN
    UPDATE backup_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_user_quotas_timestamp 
AFTER UPDATE ON user_quotas
BEGIN
    UPDATE user_quotas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Auto-cleanup trigger for expired multipart uploads
CREATE TRIGGER cleanup_expired_multipart_uploads
AFTER INSERT ON multipart_uploads
WHEN NEW.expires_at < datetime('now')
BEGIN
    UPDATE multipart_uploads SET status = 'expired' WHERE id = NEW.id;
END;

-- =============================================================================
-- INITIAL DATA (Optional)
-- =============================================================================

-- Insert default alert configurations
INSERT OR IGNORE INTO alert_configurations (id, name, description, alert_type, metric_type, conditions, threshold_value, notification_channels)
VALUES 
    ('default-storage-alert', 'High Storage Usage', 'Alert when user storage exceeds 80%', 'threshold', 'storage_used', '{"operator": ">=", "percentage": 80}', 0.8, '["email", "dashboard"]'),
    ('default-failed-logins', 'Failed Login Attempts', 'Alert on multiple failed login attempts', 'pattern', 'failed_logins', '{"count": 5, "timeframe": "15m"}', 5, '["email"]');

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================

-- Schema version table for migration tracking
CREATE TABLE schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('0008_d1_compatible_clean', 'D1-compatible consolidated schema with all features and email optional');

-- =============================================================================
-- VIEWS FOR COMMON QUERIES (Created after all tables exist)
-- =============================================================================

-- Active files view
CREATE VIEW active_files AS
SELECT 
    f.*,
    u.username,
    u.email
FROM files f
JOIN users u ON f.user_id = u.id
WHERE f.upload_status = 'completed' AND u.is_active = 1;

-- User storage summary view
CREATE VIEW user_storage_summary AS
SELECT 
    u.id as user_id,
    u.username,
    u.email,
    COUNT(f.id) as total_files,
    COALESCE(SUM(f.file_size), 0) as total_storage_bytes,
    MAX(f.created_at) as last_upload
FROM users u
LEFT JOIN files f ON u.id = f.user_id AND f.upload_status = 'completed'
WHERE u.is_active = 1
GROUP BY u.id, u.username, u.email;

-- Active alerts view
CREATE VIEW active_alerts AS
SELECT 
    ai.*,
    ac.name as configuration_name,
    ac.alert_type,
    ac.notification_channels
FROM alert_instances ai
JOIN alert_configurations ac ON ai.configuration_id = ac.id
WHERE ai.status = 'active' AND ac.is_enabled = 1;

-- File access permissions view
CREATE VIEW active_file_permissions AS
SELECT 
    fap.*,
    f.filename,
    f.original_filename,
    u.username,
    u.email
FROM file_access_permissions fap
JOIN files f ON fap.file_id = f.id
JOIN users u ON fap.user_id = u.id
WHERE fap.is_active = 1 
AND (fap.expires_at IS NULL OR fap.expires_at > datetime('now'))
AND u.is_active = 1;