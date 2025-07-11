-- R2 Storage Service Compatibility Migration for Production
-- This migration adds the minimum required tables for R2StorageService to work
-- with the existing production schema

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Create the files table (required for R2 operations)
CREATE TABLE files (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id INTEGER NOT NULL,
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

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_r2_key ON files(r2_key);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_status ON files(upload_status);
CREATE INDEX idx_files_checksum ON files(checksum);
CREATE INDEX idx_files_storage_class ON files(storage_class);

-- Create saved_filters table (required for filtering operations)
CREATE TABLE saved_filters (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id INTEGER NOT NULL,
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

CREATE INDEX idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX idx_saved_filters_file_id ON saved_filters(file_id);

-- Create API keys table (required for authentication)
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id INTEGER NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON array
    last_used_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- Create audit_logs table (required for security tracking)
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    metadata TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Create multipart_uploads table (required for large file uploads)
CREATE TABLE multipart_uploads (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    upload_id TEXT UNIQUE NOT NULL, -- R2 multipart upload ID
    file_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
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

CREATE INDEX idx_multipart_uploads_user_id ON multipart_uploads(user_id);
CREATE INDEX idx_multipart_uploads_upload_id ON multipart_uploads(upload_id);
CREATE INDEX idx_multipart_uploads_status ON multipart_uploads(status);
CREATE INDEX idx_multipart_uploads_expires_at ON multipart_uploads(expires_at);

-- Create file_access_logs table (required for security and monitoring)
CREATE TABLE file_access_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id INTEGER,
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

CREATE INDEX idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX idx_file_access_logs_action ON file_access_logs(action);
CREATE INDEX idx_file_access_logs_created_at ON file_access_logs(created_at);

-- Create file_processing_queue table (required for async operations)
CREATE TABLE file_processing_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    file_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
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

CREATE INDEX idx_file_processing_queue_status ON file_processing_queue(status);
CREATE INDEX idx_file_processing_queue_priority ON file_processing_queue(priority);
CREATE INDEX idx_file_processing_queue_scheduled_at ON file_processing_queue(scheduled_at);
CREATE INDEX idx_file_processing_queue_file_id ON file_processing_queue(file_id);

-- Create file_migrations table (already exists but ensuring compatibility)
-- This table might already exist from previous migrations
CREATE TABLE IF NOT EXISTS file_migrations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    batch_id TEXT NOT NULL,
    file_id TEXT,
    source_path TEXT,
    target_r2_key TEXT,
    original_checksum TEXT,
    migrated_checksum TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'verified')),
    error_message TEXT,
    migration_type TEXT DEFAULT 'filesystem_to_r2',
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_file_migrations_batch_id ON file_migrations(batch_id);
CREATE INDEX IF NOT EXISTS idx_file_migrations_status ON file_migrations(status);
CREATE INDEX IF NOT EXISTS idx_file_migrations_file_id ON file_migrations(file_id);

-- Create triggers for updated_at timestamps
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

-- Auto-cleanup trigger for expired multipart uploads
CREATE TRIGGER cleanup_expired_multipart_uploads
AFTER INSERT ON multipart_uploads
WHEN NEW.expires_at < datetime('now')
BEGIN
    UPDATE multipart_uploads SET status = 'expired' WHERE id = NEW.id;
END;