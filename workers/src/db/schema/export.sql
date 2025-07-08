-- Data Export System Database Schema
-- This schema provides comprehensive data export management for disaster recovery

-- Main data exports table
CREATE TABLE IF NOT EXISTS data_exports (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    export_type TEXT NOT NULL CHECK (export_type IN ('user_data', 'bulk_data', 'system_data')),
    format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'xml')),
    scope TEXT NOT NULL CHECK (scope IN ('user', 'admin', 'system')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    record_count INTEGER NOT NULL DEFAULT 0,
    compression_ratio REAL,
    checksum TEXT NOT NULL DEFAULT '',
    parameters TEXT NOT NULL DEFAULT '{}', -- JSON string of export parameters
    created_at TEXT NOT NULL,
    completed_at TEXT,
    expires_at TEXT NOT NULL,
    error_message TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at TEXT,
    FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

-- Export requests queue table
CREATE TABLE IF NOT EXISTS export_requests (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('user_data', 'bulk_data', 'system_data')),
    format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'xml')),
    scope TEXT NOT NULL CHECK (scope IN ('user', 'admin', 'system')),
    parameters TEXT NOT NULL DEFAULT '{}', -- JSON string
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 1,
    scheduled_at TEXT,
    created_at TEXT NOT NULL,
    processed_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE
);

-- Export operation logs table
CREATE TABLE IF NOT EXISTS export_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    export_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('start', 'progress', 'complete', 'error', 'download', 'expire')),
    message TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    details TEXT, -- JSON string with additional details
    FOREIGN KEY (export_id) REFERENCES data_exports(id) ON DELETE CASCADE
);

-- Export configuration table
CREATE TABLE IF NOT EXISTS export_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type TEXT NOT NULL CHECK (config_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Export templates table for predefined export configurations
CREATE TABLE IF NOT EXISTS export_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    export_type TEXT NOT NULL CHECK (export_type IN ('user_data', 'bulk_data', 'system_data')),
    format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'xml')),
    scope TEXT NOT NULL CHECK (scope IN ('user', 'admin', 'system')),
    parameters TEXT NOT NULL DEFAULT '{}', -- JSON string
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES auth_user(id) ON DELETE SET NULL
);

-- Export access control table
CREATE TABLE IF NOT EXISTS export_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    export_type TEXT NOT NULL CHECK (export_type IN ('user_data', 'bulk_data', 'system_data')),
    scope TEXT NOT NULL CHECK (scope IN ('user', 'admin', 'system')),
    can_create BOOLEAN NOT NULL DEFAULT 0,
    can_download BOOLEAN NOT NULL DEFAULT 0,
    can_view_logs BOOLEAN NOT NULL DEFAULT 0,
    can_manage BOOLEAN NOT NULL DEFAULT 0,
    granted_by INTEGER,
    granted_at TEXT NOT NULL,
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES auth_user(id) ON DELETE SET NULL,
    UNIQUE(user_id, export_type, scope)
);

-- Export scheduling table
CREATE TABLE IF NOT EXISTS export_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    user_id INTEGER NOT NULL,
    export_type TEXT NOT NULL CHECK (export_type IN ('user_data', 'bulk_data', 'system_data')),
    format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'xml')),
    scope TEXT NOT NULL CHECK (scope IN ('user', 'admin', 'system')),
    parameters TEXT NOT NULL DEFAULT '{}', -- JSON string
    schedule_pattern TEXT NOT NULL, -- Cron-like pattern or 'daily', 'weekly', 'monthly'
    next_run_time TEXT,
    last_run_time TEXT,
    last_export_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'disabled', 'error')) DEFAULT 'active',
    failure_count INTEGER NOT NULL DEFAULT 0,
    max_failures INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    retention_days INTEGER NOT NULL DEFAULT 7,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES auth_user(id) ON DELETE CASCADE,
    FOREIGN KEY (last_export_id) REFERENCES data_exports(id) ON DELETE SET NULL
);

-- Export analytics table for tracking usage and performance
CREATE TABLE IF NOT EXISTS export_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL, -- YYYY-MM-DD format
    export_type TEXT NOT NULL,
    format TEXT NOT NULL,
    scope TEXT NOT NULL,
    total_exports INTEGER NOT NULL DEFAULT 0,
    successful_exports INTEGER NOT NULL DEFAULT 0,
    failed_exports INTEGER NOT NULL DEFAULT 0,
    total_size_bytes INTEGER NOT NULL DEFAULT 0,
    total_records INTEGER NOT NULL DEFAULT 0,
    average_processing_time_ms INTEGER NOT NULL DEFAULT 0,
    total_downloads INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, export_type, format, scope)
);

-- Performance indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_export_type ON data_exports(export_type);
CREATE INDEX IF NOT EXISTS idx_data_exports_format ON data_exports(format);
CREATE INDEX IF NOT EXISTS idx_data_exports_scope ON data_exports(scope);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_data_exports_created_at ON data_exports(created_at);
CREATE INDEX IF NOT EXISTS idx_data_exports_expires_at ON data_exports(expires_at);
CREATE INDEX IF NOT EXISTS idx_data_exports_completed_at ON data_exports(completed_at);

CREATE INDEX IF NOT EXISTS idx_export_requests_user_id ON export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_export_requests_request_type ON export_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status);
CREATE INDEX IF NOT EXISTS idx_export_requests_priority ON export_requests(priority);
CREATE INDEX IF NOT EXISTS idx_export_requests_scheduled_at ON export_requests(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_export_requests_created_at ON export_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_export_logs_export_id ON export_logs(export_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_timestamp ON export_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_export_logs_event_type ON export_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_export_logs_level ON export_logs(level);

CREATE INDEX IF NOT EXISTS idx_export_config_config_key ON export_config(config_key);

CREATE INDEX IF NOT EXISTS idx_export_templates_name ON export_templates(name);
CREATE INDEX IF NOT EXISTS idx_export_templates_export_type ON export_templates(export_type);
CREATE INDEX IF NOT EXISTS idx_export_templates_is_active ON export_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_export_templates_created_by ON export_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_export_permissions_user_id ON export_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_export_permissions_export_type ON export_permissions(export_type);
CREATE INDEX IF NOT EXISTS idx_export_permissions_expires_at ON export_permissions(expires_at);

CREATE INDEX IF NOT EXISTS idx_export_schedules_user_id ON export_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_export_schedules_next_run_time ON export_schedules(next_run_time);
CREATE INDEX IF NOT EXISTS idx_export_schedules_status ON export_schedules(status);
CREATE INDEX IF NOT EXISTS idx_export_schedules_export_type ON export_schedules(export_type);

CREATE INDEX IF NOT EXISTS idx_export_analytics_date ON export_analytics(date);
CREATE INDEX IF NOT EXISTS idx_export_analytics_export_type ON export_analytics(export_type);
CREATE INDEX IF NOT EXISTS idx_export_analytics_format ON export_analytics(format);
CREATE INDEX IF NOT EXISTS idx_export_analytics_scope ON export_analytics(scope);

-- Views for common export analytics queries
CREATE VIEW IF NOT EXISTS export_summary AS
SELECT 
    de.id,
    de.user_id,
    de.export_type,
    de.format,
    de.scope,
    de.status,
    de.file_name,
    de.file_size,
    de.record_count,
    de.created_at,
    de.completed_at,
    de.expires_at,
    de.download_count,
    de.last_downloaded_at,
    CASE 
        WHEN de.completed_at IS NOT NULL AND de.created_at IS NOT NULL 
        THEN (julianday(de.completed_at) - julianday(de.created_at)) * 24 * 60 * 60 * 1000
        ELSE NULL 
    END as processing_time_ms,
    CASE 
        WHEN de.expires_at < datetime('now') THEN 1 
        ELSE 0 
    END as is_expired
FROM data_exports de;

CREATE VIEW IF NOT EXISTS export_health_metrics AS
SELECT 
    export_type,
    format,
    scope,
    COUNT(*) as total_exports,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_exports,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_exports,
    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_exports,
    ROUND(
        (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)), 
        2
    ) as success_rate_percent,
    MAX(created_at) as last_export_date,
    SUM(CASE WHEN status = 'completed' THEN file_size ELSE 0 END) as total_export_size,
    AVG(CASE WHEN status = 'completed' THEN record_count ELSE NULL END) as avg_records_per_export,
    AVG(CASE WHEN status = 'completed' THEN file_size ELSE NULL END) as avg_export_size,
    SUM(download_count) as total_downloads
FROM data_exports
WHERE created_at >= datetime('now', '-30 days')
GROUP BY export_type, format, scope;

CREATE VIEW IF NOT EXISTS user_export_summary AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(de.id) as total_exports,
    SUM(CASE WHEN de.status = 'completed' THEN 1 ELSE 0 END) as completed_exports,
    SUM(CASE WHEN de.status = 'failed' THEN 1 ELSE 0 END) as failed_exports,
    SUM(CASE WHEN de.status = 'completed' THEN de.file_size ELSE 0 END) as total_export_size,
    SUM(de.download_count) as total_downloads,
    MAX(de.created_at) as last_export_date,
    MIN(de.created_at) as first_export_date
FROM auth_user u
LEFT JOIN data_exports de ON u.id = de.user_id
GROUP BY u.id, u.username;

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_export_config_timestamp
    AFTER UPDATE ON export_config
    FOR EACH ROW
    BEGIN
        UPDATE export_config 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_export_templates_timestamp
    AFTER UPDATE ON export_templates
    FOR EACH ROW
    BEGIN
        UPDATE export_templates 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_export_schedules_timestamp
    AFTER UPDATE ON export_schedules
    FOR EACH ROW
    BEGIN
        UPDATE export_schedules 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
    END;

-- Trigger to clean up expired exports automatically
CREATE TRIGGER IF NOT EXISTS cleanup_expired_exports
    AFTER UPDATE ON data_exports
    FOR EACH ROW
    WHEN NEW.expires_at < datetime('now') AND OLD.expires_at >= datetime('now')
    BEGIN
        UPDATE data_exports 
        SET status = 'expired' 
        WHERE id = NEW.id AND status NOT IN ('expired', 'failed');
    END;

-- Trigger to update analytics when exports are completed
CREATE TRIGGER IF NOT EXISTS update_export_analytics
    AFTER UPDATE ON data_exports
    FOR EACH ROW
    WHEN NEW.status = 'completed' AND OLD.status != 'completed'
    BEGIN
        INSERT OR REPLACE INTO export_analytics (
            date,
            export_type,
            format,
            scope,
            total_exports,
            successful_exports,
            failed_exports,
            total_size_bytes,
            total_records,
            average_processing_time_ms,
            total_downloads,
            unique_users
        )
        SELECT 
            date(NEW.completed_at) as date,
            NEW.export_type,
            NEW.format,
            NEW.scope,
            COALESCE(ea.total_exports, 0) + 1,
            COALESCE(ea.successful_exports, 0) + 1,
            COALESCE(ea.failed_exports, 0),
            COALESCE(ea.total_size_bytes, 0) + NEW.file_size,
            COALESCE(ea.total_records, 0) + NEW.record_count,
            -- Calculate average processing time
            CASE 
                WHEN ea.total_exports > 0 AND NEW.completed_at IS NOT NULL AND NEW.created_at IS NOT NULL
                THEN (
                    (COALESCE(ea.average_processing_time_ms, 0) * ea.total_exports + 
                     (julianday(NEW.completed_at) - julianday(NEW.created_at)) * 24 * 60 * 60 * 1000) / 
                    (ea.total_exports + 1)
                )
                WHEN NEW.completed_at IS NOT NULL AND NEW.created_at IS NOT NULL
                THEN (julianday(NEW.completed_at) - julianday(NEW.created_at)) * 24 * 60 * 60 * 1000
                ELSE COALESCE(ea.average_processing_time_ms, 0)
            END,
            COALESCE(ea.total_downloads, 0),
            COALESCE(ea.unique_users, 0) + 
            CASE WHEN NEW.user_id NOT IN (
                SELECT user_id FROM data_exports 
                WHERE export_type = NEW.export_type 
                AND format = NEW.format 
                AND scope = NEW.scope 
                AND date(completed_at) = date(NEW.completed_at)
                AND user_id IS NOT NULL
                AND id != NEW.id
            ) THEN 1 ELSE 0 END
        FROM (
            SELECT * FROM export_analytics 
            WHERE date = date(NEW.completed_at)
            AND export_type = NEW.export_type
            AND format = NEW.format
            AND scope = NEW.scope
        ) ea;
    END;

-- Insert default export configuration
INSERT OR IGNORE INTO export_config (config_key, config_value, config_type, description, created_at, updated_at) VALUES
('max_export_size', '104857600', 'NUMBER', 'Maximum export file size in bytes (100MB)', datetime('now'), datetime('now')),
('default_retention_days', '7', 'NUMBER', 'Default retention period for exports in days', datetime('now'), datetime('now')),
('compression_enabled', 'true', 'BOOLEAN', 'Enable compression for export files', datetime('now'), datetime('now')),
('concurrent_exports_limit', '5', 'NUMBER', 'Maximum number of concurrent exports per user', datetime('now'), datetime('now')),
('export_rate_limit', '10', 'NUMBER', 'Maximum exports per user per hour', datetime('now'), datetime('now')),
('allowed_formats', '["json", "csv", "xml"]', 'JSON', 'List of allowed export formats', datetime('now'), datetime('now')),
('default_format', 'json', 'STRING', 'Default export format', datetime('now'), datetime('now')),
('auto_cleanup_enabled', 'true', 'BOOLEAN', 'Enable automatic cleanup of expired exports', datetime('now'), datetime('now')),
('notification_enabled', 'true', 'BOOLEAN', 'Enable notifications for export completion', datetime('now'), datetime('now')),
('analytics_retention_days', '90', 'NUMBER', 'Retention period for export analytics in days', datetime('now'), datetime('now'));

-- Insert default export templates
INSERT OR IGNORE INTO export_templates (name, description, export_type, format, scope, parameters, created_at, updated_at) VALUES
('User Data - JSON', 'Complete user data export in JSON format', 'user_data', 'json', 'user', '{"includeMetadata": true, "compression": true}', datetime('now'), datetime('now')),
('User Data - CSV', 'User data export in CSV format for spreadsheet import', 'user_data', 'csv', 'user', '{"includeHeaders": true, "includeComments": true}', datetime('now'), datetime('now')),
('Bulk Data - JSON', 'Complete system data export for administrators', 'bulk_data', 'json', 'admin', '{"includeMetadata": true, "includeSystemFields": true, "compression": true}', datetime('now'), datetime('now')),
('Bulk Data - CSV', 'System data export in CSV format for analysis', 'bulk_data', 'csv', 'admin', '{"includeHeaders": true, "includeSystemFields": true}', datetime('now'), datetime('now')),
('Recent Files Only', 'Export only files from the last 30 days', 'user_data', 'json', 'user', '{"dateRange": {"start": "30 days ago", "end": "now"}, "sortBy": "uploaded_at", "sortOrder": "desc"}', datetime('now'), datetime('now'));

-- Insert default permissions for admin users (this would typically be done during user creation)
-- INSERT OR IGNORE INTO export_permissions (user_id, export_type, scope, can_create, can_download, can_view_logs, can_manage, granted_by, granted_at) VALUES
-- (1, 'user_data', 'user', 1, 1, 1, 1, 1, datetime('now')),
-- (1, 'bulk_data', 'admin', 1, 1, 1, 1, 1, datetime('now')),
-- (1, 'system_data', 'system', 1, 1, 1, 1, 1, datetime('now'));

-- Stored procedures (SQLite doesn't have them, but we can define common queries)
-- Common query patterns as comments for reference:

-- Get user's recent exports:
-- SELECT * FROM export_summary WHERE user_id = ? ORDER BY created_at DESC LIMIT 10;

-- Get pending export requests:
-- SELECT * FROM export_requests WHERE status = 'pending' ORDER BY priority DESC, created_at ASC;

-- Get export statistics for a user:
-- SELECT * FROM user_export_summary WHERE user_id = ?;

-- Get system-wide export health metrics:
-- SELECT * FROM export_health_metrics ORDER BY total_exports DESC;

-- Find exports ready for cleanup:
-- SELECT * FROM data_exports WHERE expires_at < datetime('now') AND status != 'expired';

-- Get export logs for debugging:
-- SELECT * FROM export_logs WHERE export_id = ? ORDER BY timestamp DESC;

-- Get scheduled exports that need to run:
-- SELECT * FROM export_schedules 
-- WHERE status = 'active' 
-- AND next_run_time <= datetime('now')
-- ORDER BY next_run_time ASC;

-- Calculate storage usage by exports:
-- SELECT date(created_at) as date, 
--        SUM(file_size) as total_size, 
--        COUNT(*) as export_count
-- FROM data_exports 
-- WHERE status = 'completed'
-- GROUP BY date(created_at) 
-- ORDER BY date DESC;

-- Get user permissions for exports:
-- SELECT ep.*, u.username 
-- FROM export_permissions ep
-- JOIN auth_user u ON ep.user_id = u.id
-- WHERE ep.user_id = ? AND (ep.expires_at IS NULL OR ep.expires_at > datetime('now'));