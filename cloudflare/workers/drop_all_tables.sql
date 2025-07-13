-- Comprehensive database cleanup script
-- Handles all tables and views that might exist from any migration state

-- Disable foreign key constraints during cleanup
PRAGMA foreign_keys = OFF;

-- Drop all views first (they depend on tables)
DROP VIEW IF EXISTS active_file_permissions;
DROP VIEW IF EXISTS active_alerts;
DROP VIEW IF EXISTS user_storage_summary;
DROP VIEW IF EXISTS active_files;

-- Drop all tables in dependency order (children first, then parents)
-- Using IF EXISTS to handle cases where tables don't exist
DROP TABLE IF EXISTS api_key_usage;
DROP TABLE IF EXISTS file_access_permissions;
DROP TABLE IF EXISTS user_quotas;
DROP TABLE IF EXISTS backup_instances;
DROP TABLE IF EXISTS backup_configurations;
DROP TABLE IF EXISTS alert_instances;
DROP TABLE IF EXISTS alert_configurations;
DROP TABLE IF EXISTS storage_metrics;
DROP TABLE IF EXISTS file_processing_queue;
DROP TABLE IF EXISTS file_access_logs;
DROP TABLE IF EXISTS multipart_uploads;
DROP TABLE IF EXISTS security_analytics;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS saved_filters;
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS schema_version;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;