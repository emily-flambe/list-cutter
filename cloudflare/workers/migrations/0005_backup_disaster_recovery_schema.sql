-- Migration: Backup and Disaster Recovery Schema
-- This migration adds tables for backup, disaster recovery, and business continuity operations

-- Backups table - stores backup operation records
CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('full', 'incremental', 'differential')),
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'in_progress')),
    duration INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
    verification TEXT NOT NULL DEFAULT '{}', -- JSON verification results
    error TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Restore operations table - stores restore operation records
CREATE TABLE IF NOT EXISTS restore_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restore_id TEXT UNIQUE NOT NULL DEFAULT ('restore-' || datetime('now', 'unixepoch') || '-' || hex(randomblob(4))),
    backup_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'in_progress')),
    duration INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    verification TEXT NOT NULL DEFAULT '{}', -- JSON verification results
    error TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (backup_id) REFERENCES backups(backup_id)
);

-- Disaster recovery operations table - stores disaster recovery records
CREATE TABLE IF NOT EXISTS disaster_recovery_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recovery_id TEXT UNIQUE NOT NULL,
    scenario_type TEXT NOT NULL CHECK (scenario_type IN ('database_corruption', 'file_storage_failure', 'complete_system_failure', 'partial_outage')),
    strategy_type TEXT NOT NULL CHECK (strategy_type IN ('database_restore', 'file_restore', 'full_system_restore', 'partial_restore')),
    status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'in_progress')),
    duration INTEGER NOT NULL DEFAULT 0,
    data_recovered INTEGER NOT NULL DEFAULT 0,
    services_restored TEXT NOT NULL DEFAULT '[]', -- JSON array of restored services
    degraded_services TEXT NOT NULL DEFAULT '[]', -- JSON array of degraded services
    verification TEXT NOT NULL DEFAULT '{}', -- JSON verification results
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
    error TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- System status table - tracks system operational status
CREATE TABLE IF NOT EXISTS system_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'maintenance', 'failed')),
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- System configuration table - stores system configuration key-value pairs
CREATE TABLE IF NOT EXISTS system_configuration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Feature flags table - tracks enabled/disabled features
CREATE TABLE IF NOT EXISTS feature_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    description TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Admin notifications table - stores administrator notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT NULL
);

-- Data exports table - stores data export records
CREATE TABLE IF NOT EXISTS data_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    export_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    record_count INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    download_url TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT '{}', -- JSON export format
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- System exports table - stores system-wide export records
CREATE TABLE IF NOT EXISTS system_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    export_id TEXT UNIQUE NOT NULL,
    formats TEXT NOT NULL DEFAULT '[]', -- JSON array of format results
    total_size INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Business continuity plans table - stores business continuity plans
CREATE TABLE IF NOT EXISTS business_continuity_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_version TEXT NOT NULL DEFAULT ('v' || datetime('now', 'unixepoch')),
    plan_data TEXT NOT NULL, -- JSON plan data
    active BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Business continuity test results table - stores test results
CREATE TABLE IF NOT EXISTS bc_test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id TEXT UNIQUE NOT NULL,
    test_type TEXT NOT NULL DEFAULT 'full',
    timestamp TEXT NOT NULL,
    results TEXT NOT NULL DEFAULT '[]', -- JSON array of test component results
    overall_status TEXT NOT NULL CHECK (overall_status IN ('passed', 'failed', 'pending')),
    error TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled tests table - tracks scheduled business continuity tests
CREATE TABLE IF NOT EXISTS scheduled_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_type TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    last_run_at TEXT NULL,
    next_run_at TEXT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backup metrics table - stores backup operation metrics
CREATE TABLE IF NOT EXISTS backup_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL DEFAULT '',
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (backup_id) REFERENCES backups(backup_id)
);

-- Recovery metrics table - stores disaster recovery metrics
CREATE TABLE IF NOT EXISTS recovery_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recovery_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL DEFAULT '',
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recovery_id) REFERENCES disaster_recovery_operations(recovery_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(type);

CREATE INDEX IF NOT EXISTS idx_restore_operations_backup_id ON restore_operations(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_operations_created_at ON restore_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_restore_operations_status ON restore_operations(status);

CREATE INDEX IF NOT EXISTS idx_disaster_recovery_operations_created_at ON disaster_recovery_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_disaster_recovery_operations_status ON disaster_recovery_operations(status);
CREATE INDEX IF NOT EXISTS idx_disaster_recovery_operations_scenario_type ON disaster_recovery_operations(scenario_type);

CREATE INDEX IF NOT EXISTS idx_system_status_created_at ON system_status(created_at);
CREATE INDEX IF NOT EXISTS idx_system_status_status ON system_status(status);

CREATE INDEX IF NOT EXISTS idx_system_configuration_key ON system_configuration(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_feature_name ON feature_flags(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_event_type ON admin_notifications(event_type);

CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_created_at ON data_exports(created_at);
CREATE INDEX IF NOT EXISTS idx_data_exports_expires_at ON data_exports(expires_at);

CREATE INDEX IF NOT EXISTS idx_system_exports_created_at ON system_exports(created_at);

CREATE INDEX IF NOT EXISTS idx_business_continuity_plans_active ON business_continuity_plans(active);
CREATE INDEX IF NOT EXISTS idx_business_continuity_plans_created_at ON business_continuity_plans(created_at);

CREATE INDEX IF NOT EXISTS idx_bc_test_results_timestamp ON bc_test_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_bc_test_results_overall_status ON bc_test_results(overall_status);
CREATE INDEX IF NOT EXISTS idx_bc_test_results_test_type ON bc_test_results(test_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_tests_active ON scheduled_tests(active);
CREATE INDEX IF NOT EXISTS idx_scheduled_tests_test_type ON scheduled_tests(test_type);

CREATE INDEX IF NOT EXISTS idx_backup_metrics_backup_id ON backup_metrics(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_metrics_recorded_at ON backup_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_backup_metrics_metric_name ON backup_metrics(metric_name);

CREATE INDEX IF NOT EXISTS idx_recovery_metrics_recovery_id ON recovery_metrics(recovery_id);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_recorded_at ON recovery_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_recovery_metrics_metric_name ON recovery_metrics(metric_name);

-- Insert initial system configuration
INSERT OR IGNORE INTO system_configuration (key, value, description) VALUES 
('read_only_mode', 'false', 'System read-only mode status'),
('maintenance_mode', 'false', 'System maintenance mode status'),
('backup_retention_days', '30', 'Number of days to retain daily backups'),
('backup_retention_weeks', '12', 'Number of weeks to retain weekly backups'),
('backup_retention_months', '12', 'Number of months to retain monthly backups'),
('backup_retention_years', '7', 'Number of years to retain yearly backups'),
('rto_target_minutes', '240', 'Recovery Time Objective target in minutes (4 hours)'),
('rpo_target_minutes', '60', 'Recovery Point Objective target in minutes (1 hour)'),
('degraded_mode_threshold', '70', 'Health score threshold for entering degraded mode'),
('auto_recovery_enabled', 'true', 'Enable automatic recovery from degraded mode');

-- Insert initial feature flags
INSERT OR IGNORE INTO feature_flags (feature_name, enabled, description) VALUES 
('file_upload', 1, 'File upload functionality'),
('file_download', 1, 'File download functionality'),
('file_list', 1, 'File listing functionality'),
('basic_authentication', 1, 'Basic authentication functionality'),
('health_checks', 1, 'System health checks'),
('file_compression', 1, 'File compression during upload'),
('thumbnail_generation', 1, 'Thumbnail generation for images'),
('advanced_analytics', 1, 'Advanced analytics and reporting'),
('batch_operations', 1, 'Batch file operations'),
('background_processing', 1, 'Background task processing'),
('file_sharing', 1, 'File sharing functionality'),
('advanced_search', 1, 'Advanced file search'),
('bulk_operations', 1, 'Bulk file operations');

-- Insert initial system status
INSERT OR IGNORE INTO system_status (status, reason) VALUES 
('operational', 'System initialized successfully');

-- Insert initial business continuity plan (placeholder)
INSERT OR IGNORE INTO business_continuity_plans (plan_data, active) VALUES 
('{"rto": 14400000, "rpo": 3600000, "version": "1.0", "created": "' || datetime('now') || '"}', 1);

-- Backup and recovery system is now ready
-- Tables created:
-- - backups: Backup operation records
-- - restore_operations: Restore operation records  
-- - disaster_recovery_operations: Disaster recovery records
-- - system_status: System operational status
-- - system_configuration: System configuration settings
-- - feature_flags: Feature enable/disable flags
-- - admin_notifications: Administrator notifications
-- - data_exports: Data export records
-- - system_exports: System-wide export records
-- - business_continuity_plans: Business continuity plans
-- - bc_test_results: Business continuity test results
-- - scheduled_tests: Scheduled test configuration
-- - backup_metrics: Backup operation metrics
-- - recovery_metrics: Disaster recovery metrics