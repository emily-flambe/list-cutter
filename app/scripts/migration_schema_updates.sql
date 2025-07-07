-- Migration Schema Updates for List Cutter File Migration Tools
-- Issue #66 - File Migration Tools Database Schema Updates
-- 
-- This script adds migration tracking columns to the existing list_cutter_savedfile table
-- to support the file migration from local storage to Cloudflare R2 storage.
--
-- Run this script against your PostgreSQL database before running migration tools.

-- Begin transaction to ensure atomicity
BEGIN;

-- Add migration tracking columns to list_cutter_savedfile table
ALTER TABLE list_cutter_savedfile 
ADD COLUMN IF NOT EXISTS r2_key TEXT,
ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS migration_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS migration_batch_id TEXT;

-- Add check constraint for migration_status values
ALTER TABLE list_cutter_savedfile 
ADD CONSTRAINT IF NOT EXISTS check_migration_status 
CHECK (migration_status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

-- Add comment to migration_status column for documentation
COMMENT ON COLUMN list_cutter_savedfile.migration_status IS 'File migration status: pending, processing, completed, failed, skipped';

-- Add comment to other migration columns
COMMENT ON COLUMN list_cutter_savedfile.r2_key IS 'Cloudflare R2 object key after successful migration';
COMMENT ON COLUMN list_cutter_savedfile.migrated_at IS 'Timestamp when file migration was completed';
COMMENT ON COLUMN list_cutter_savedfile.migration_batch_id IS 'Batch ID for tracking migration operations';

-- Create indexes for performance on migration-related queries
CREATE INDEX IF NOT EXISTS idx_savedfile_migration_status ON list_cutter_savedfile(migration_status);
CREATE INDEX IF NOT EXISTS idx_savedfile_migration_batch ON list_cutter_savedfile(migration_batch_id);
CREATE INDEX IF NOT EXISTS idx_savedfile_migrated_at ON list_cutter_savedfile(migrated_at);
CREATE INDEX IF NOT EXISTS idx_savedfile_r2_key ON list_cutter_savedfile(r2_key);

-- Create composite index for efficient migration queries
CREATE INDEX IF NOT EXISTS idx_savedfile_migration_composite ON list_cutter_savedfile(migration_status, uploaded_at);

-- Create partial index for unmigrated files (performance optimization)
CREATE INDEX IF NOT EXISTS idx_savedfile_unmigrated ON list_cutter_savedfile(uploaded_at) 
WHERE migration_status = 'pending';

-- Create partial index for failed migrations
CREATE INDEX IF NOT EXISTS idx_savedfile_failed_migration ON list_cutter_savedfile(uploaded_at, migration_batch_id) 
WHERE migration_status = 'failed';

-- Create migration batch tracking table
CREATE TABLE IF NOT EXISTS migration_batches (
    id SERIAL PRIMARY KEY,
    batch_id TEXT UNIQUE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    successful_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    skipped_files INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    configuration JSONB,
    created_by TEXT,
    notes TEXT
);

-- Add indexes for migration_batches table
CREATE INDEX IF NOT EXISTS idx_migration_batches_batch_id ON migration_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_batches_status ON migration_batches(status);
CREATE INDEX IF NOT EXISTS idx_migration_batches_started_at ON migration_batches(started_at);

-- Create migration logs table for detailed tracking
CREATE TABLE IF NOT EXISTS migration_logs (
    id SERIAL PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES migration_batches(batch_id),
    file_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    message TEXT,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    file_size_bytes BIGINT,
    r2_key TEXT,
    processing_time_ms INTEGER
);

-- Add indexes for migration_logs table
CREATE INDEX IF NOT EXISTS idx_migration_logs_batch_id ON migration_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_logs_file_id ON migration_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_migration_logs_status ON migration_logs(status);
CREATE INDEX IF NOT EXISTS idx_migration_logs_started_at ON migration_logs(started_at);

-- Create function to update migration batch statistics
CREATE OR REPLACE FUNCTION update_migration_batch_stats(p_batch_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE migration_batches 
    SET 
        processed_files = (
            SELECT COUNT(*) FROM list_cutter_savedfile 
            WHERE migration_batch_id = p_batch_id AND migration_status != 'pending'
        ),
        successful_files = (
            SELECT COUNT(*) FROM list_cutter_savedfile 
            WHERE migration_batch_id = p_batch_id AND migration_status = 'completed'
        ),
        failed_files = (
            SELECT COUNT(*) FROM list_cutter_savedfile 
            WHERE migration_batch_id = p_batch_id AND migration_status = 'failed'
        ),
        skipped_files = (
            SELECT COUNT(*) FROM list_cutter_savedfile 
            WHERE migration_batch_id = p_batch_id AND migration_status = 'skipped'
        )
    WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update batch statistics
CREATE OR REPLACE FUNCTION trigger_update_migration_batch_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.migration_batch_id IS NOT NULL THEN
        PERFORM update_migration_batch_stats(NEW.migration_batch_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on list_cutter_savedfile table
DROP TRIGGER IF EXISTS tr_update_migration_batch_stats ON list_cutter_savedfile;
CREATE TRIGGER tr_update_migration_batch_stats
    AFTER UPDATE OF migration_status ON list_cutter_savedfile
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_migration_batch_stats();

-- Create view for migration progress reporting
CREATE OR REPLACE VIEW migration_progress AS
SELECT 
    mb.batch_id,
    mb.started_at,
    mb.completed_at,
    mb.status as batch_status,
    mb.total_files,
    mb.processed_files,
    mb.successful_files,
    mb.failed_files,
    mb.skipped_files,
    CASE 
        WHEN mb.total_files > 0 THEN 
            ROUND((mb.processed_files::decimal / mb.total_files::decimal) * 100, 2)
        ELSE 0
    END as progress_percent,
    CASE 
        WHEN mb.total_files > 0 THEN 
            ROUND((mb.successful_files::decimal / mb.total_files::decimal) * 100, 2)
        ELSE 0
    END as success_percent,
    mb.created_by,
    mb.notes
FROM migration_batches mb
ORDER BY mb.started_at DESC;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON list_cutter_savedfile TO migration_user;
-- GRANT ALL ON migration_batches TO migration_user;
-- GRANT ALL ON migration_logs TO migration_user;
-- GRANT SELECT ON migration_progress TO migration_user;

-- Commit transaction
COMMIT;

-- Display summary of changes
SELECT 
    'Migration schema updates completed successfully' as message,
    COUNT(*) as total_files,
    COUNT(CASE WHEN migration_status = 'pending' THEN 1 END) as pending_files,
    COUNT(CASE WHEN migration_status = 'completed' THEN 1 END) as completed_files,
    COUNT(CASE WHEN migration_status = 'failed' THEN 1 END) as failed_files
FROM list_cutter_savedfile;