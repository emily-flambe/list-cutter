-- List Cutter Database Schema
-- Migration: 0001_initial_schema.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    is_active INTEGER DEFAULT 1,
    is_admin INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Files table
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'text/csv',
    r2_key TEXT UNIQUE NOT NULL,
    upload_status TEXT DEFAULT 'completed' CHECK(upload_status IN ('uploading', 'completed', 'error')),
    processing_error TEXT,
    row_count INTEGER,
    column_count INTEGER,
    columns_metadata TEXT, -- JSON string containing column information
    tags TEXT, -- JSON array of tags
    checksum TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for files table
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_file_id ON files(file_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_upload_status ON files(upload_status);
CREATE INDEX IF NOT EXISTS idx_files_r2_key ON files(r2_key);

-- Saved filters table
CREATE TABLE IF NOT EXISTS saved_filters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    filter_config TEXT NOT NULL, -- JSON string containing filter configuration
    result_count INTEGER,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
);

-- Create indexes for saved_filters table
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_file_id ON saved_filters(file_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_created_at ON saved_filters(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_filters_public ON saved_filters(is_public);

-- File lineage table (for tracking file relationships)
CREATE TABLE IF NOT EXISTS file_lineage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_id TEXT NOT NULL,
    derived_file_id TEXT NOT NULL,
    operation_type TEXT NOT NULL, -- 'filter', 'cut', 'export', etc.
    operation_config TEXT, -- JSON string containing operation details
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_file_id) REFERENCES files(file_id) ON DELETE CASCADE,
    FOREIGN KEY (derived_file_id) REFERENCES files(file_id) ON DELETE CASCADE
);

-- Create indexes for file_lineage table
CREATE INDEX IF NOT EXISTS idx_file_lineage_source ON file_lineage(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_lineage_derived ON file_lineage(derived_file_id);
CREATE INDEX IF NOT EXISTS idx_file_lineage_created_at ON file_lineage(created_at);

-- Audit log table for security and debugging
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata TEXT, -- JSON string containing additional information
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Application settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for app_settings table
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Insert default application settings
INSERT OR IGNORE INTO app_settings (key, value, description) VALUES
('max_file_size', '52428800', 'Maximum file size in bytes (50MB)'),
('max_files_per_user', '100', 'Maximum number of files per user'),
('app_version', '1.0.0', 'Current application version'),
('maintenance_mode', 'false', 'Whether the application is in maintenance mode');

-- Performance optimization settings
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;