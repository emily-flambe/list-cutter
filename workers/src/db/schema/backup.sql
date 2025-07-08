-- R2 Backup System Database Schema
-- This schema provides comprehensive backup management for R2 storage

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

-- Performance indexes for efficient queries
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

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_backup_config_timestamp
    AFTER UPDATE ON backup_config
    FOR EACH ROW
    BEGIN
        UPDATE backup_config 
        SET updated_at = datetime('now') 
        WHERE id = NEW.id;
    END;

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

-- Performance indexes for backup schedules
CREATE INDEX IF NOT EXISTS idx_backup_schedules_bucket_name ON backup_schedules(bucket_name);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run_time ON backup_schedules(next_run_time);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_status ON backup_schedules(status);

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

-- Stored procedures (SQLite doesn't have them, but we can define common queries)
-- Common query patterns as comments for reference:

-- Get recent backups for a bucket:
-- SELECT * FROM backup_summary WHERE bucket_name = ? ORDER BY backup_date DESC LIMIT 10;

-- Get backup verification status:
-- SELECT b.id, b.backup_date, b.status, v.status as verification_status, 
--        v.verified_files, v.total_files, v.verification_date
-- FROM r2_backups b
-- LEFT JOIN backup_verifications v ON b.id = v.backup_id
-- WHERE b.bucket_name = ?
-- ORDER BY b.backup_date DESC;

-- Find backups that need verification:
-- SELECT b.* FROM r2_backups b
-- LEFT JOIN backup_verifications v ON b.id = v.backup_id
-- WHERE b.status = 'completed' AND v.id IS NULL;

-- Get backup logs for debugging:
-- SELECT * FROM backup_logs 
-- WHERE backup_id = ? 
-- ORDER BY timestamp DESC;

-- Calculate storage usage by backup:
-- SELECT backup_date, SUM(total_size) as total_size, COUNT(*) as backup_count
-- FROM r2_backups 
-- WHERE bucket_name = ? AND status = 'completed'
-- GROUP BY DATE(backup_date) 
-- ORDER BY backup_date DESC;

-- Find oldest backups for cleanup:
-- SELECT id, backup_date, total_size 
-- FROM r2_backups 
-- WHERE backup_date < datetime('now', '-' || ? || ' days')
-- ORDER BY backup_date ASC;