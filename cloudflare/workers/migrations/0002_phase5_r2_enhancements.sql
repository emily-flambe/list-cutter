-- Phase 5 R2 Migration Enhancements
-- Adds tables for multipart uploads, migration tracking, and enhanced file integrity

-- Add checksum field to files table for integrity verification
ALTER TABLE files ADD COLUMN checksum TEXT;
ALTER TABLE files ADD COLUMN storage_class TEXT DEFAULT 'Standard' CHECK (storage_class IN ('Standard', 'InfrequentAccess'));

-- Multipart upload sessions table
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

CREATE INDEX idx_multipart_uploads_user_id ON multipart_uploads(user_id);
CREATE INDEX idx_multipart_uploads_upload_id ON multipart_uploads(upload_id);
CREATE INDEX idx_multipart_uploads_status ON multipart_uploads(status);
CREATE INDEX idx_multipart_uploads_expires_at ON multipart_uploads(expires_at);

-- File migration tracking table
CREATE TABLE file_migrations (
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

CREATE INDEX idx_file_migrations_batch_id ON file_migrations(batch_id);
CREATE INDEX idx_file_migrations_status ON file_migrations(status);
CREATE INDEX idx_file_migrations_file_id ON file_migrations(file_id);

-- Migration batches table
CREATE TABLE migration_batches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    batch_id TEXT UNIQUE NOT NULL,
    total_files INTEGER NOT NULL DEFAULT 0,
    completed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    verified_files INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    migration_type TEXT DEFAULT 'filesystem_to_r2',
    started_at DATETIME,
    completed_at DATETIME,
    metadata TEXT, -- JSON with batch configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_migration_batches_batch_id ON migration_batches(batch_id);
CREATE INDEX idx_migration_batches_status ON migration_batches(status);
CREATE INDEX idx_migration_batches_created_at ON migration_batches(created_at);

-- File access logs for security and monitoring
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

CREATE INDEX idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX idx_file_access_logs_action ON file_access_logs(action);
CREATE INDEX idx_file_access_logs_created_at ON file_access_logs(created_at);

-- File processing queue for async operations
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

CREATE INDEX idx_file_processing_queue_status ON file_processing_queue(status);
CREATE INDEX idx_file_processing_queue_priority ON file_processing_queue(priority);
CREATE INDEX idx_file_processing_queue_scheduled_at ON file_processing_queue(scheduled_at);
CREATE INDEX idx_file_processing_queue_file_id ON file_processing_queue(file_id);

-- File relationship tracking for lineage (enhanced)
CREATE TABLE file_relationships (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    source_file_id TEXT NOT NULL,
    target_file_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('derived_from', 'filtered_from', 'merged_with', 'split_from', 'migrated_from')),
    transformation_metadata TEXT, -- JSON with transformation details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id TEXT,
    FOREIGN KEY (source_file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (target_file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_file_relationships_source ON file_relationships(source_file_id);
CREATE INDEX idx_file_relationships_target ON file_relationships(target_file_id);
CREATE INDEX idx_file_relationships_type ON file_relationships(relationship_type);

-- Storage usage analytics
CREATE TABLE storage_analytics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_files INTEGER DEFAULT 0,
    total_size_bytes INTEGER DEFAULT 0,
    uploaded_files INTEGER DEFAULT 0,
    uploaded_size_bytes INTEGER DEFAULT 0,
    deleted_files INTEGER DEFAULT 0,
    deleted_size_bytes INTEGER DEFAULT 0,
    bandwidth_used_bytes INTEGER DEFAULT 0,
    operations_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON with additional metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_storage_analytics_user_id ON storage_analytics(user_id);
CREATE INDEX idx_storage_analytics_date ON storage_analytics(date);

-- Create triggers for updated_at on new tables
CREATE TRIGGER update_multipart_uploads_timestamp 
AFTER UPDATE ON multipart_uploads
BEGIN
    UPDATE multipart_uploads SET expires_at = NEW.expires_at WHERE id = NEW.id;
END;

-- Auto-cleanup trigger for expired multipart uploads
CREATE TRIGGER cleanup_expired_multipart_uploads
AFTER INSERT ON multipart_uploads
WHEN NEW.expires_at < datetime('now')
BEGIN
    UPDATE multipart_uploads SET status = 'expired' WHERE id = NEW.id;
END;