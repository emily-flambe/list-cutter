-- Migration: Drop unused tables after massive simplification (PR #116)
-- Date: 2025-01-19
-- Description: Remove tables that are no longer used after removing complex features
--              like monitoring, alerts, API keys, and database-based file storage

-- Drop indexes first to avoid conflicts
DROP INDEX IF EXISTS idx_saved_files_user_id;
DROP INDEX IF EXISTS idx_saved_files_file_name;
DROP INDEX IF EXISTS idx_saved_files_uploaded_at;
DROP INDEX IF EXISTS idx_file_relationships_source;
DROP INDEX IF EXISTS idx_file_relationships_target;
DROP INDEX IF EXISTS idx_file_relationships_type;
DROP INDEX IF EXISTS idx_security_events_timestamp;
DROP INDEX IF EXISTS idx_security_events_type;
DROP INDEX IF EXISTS idx_security_events_user_id;
DROP INDEX IF EXISTS idx_security_events_ip;
DROP INDEX IF EXISTS idx_security_events_success;
DROP INDEX IF EXISTS idx_security_analytics_date;
DROP INDEX IF EXISTS idx_security_analytics_type;
DROP INDEX IF EXISTS idx_api_keys_user_id;
DROP INDEX IF EXISTS idx_api_keys_hash;
DROP INDEX IF EXISTS idx_api_keys_prefix;
DROP INDEX IF EXISTS idx_api_keys_active;
DROP INDEX IF EXISTS idx_api_keys_expires;
DROP INDEX IF EXISTS idx_api_key_usage_key_id;
DROP INDEX IF EXISTS idx_api_key_usage_timestamp;
DROP INDEX IF EXISTS idx_api_key_usage_endpoint;

-- Drop tables that are no longer used
-- Files are now stored in R2 bucket, not in database
DROP TABLE IF EXISTS file_relationships;
DROP TABLE IF EXISTS saved_files;

-- Security monitoring features have been removed
DROP TABLE IF EXISTS security_analytics;
DROP TABLE IF EXISTS security_events;

-- API key management features have been removed
DROP TABLE IF EXISTS api_key_usage;
DROP TABLE IF EXISTS api_keys;

-- Note: Keeping only the 'users' table which is still actively used for authentication