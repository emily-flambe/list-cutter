-- Fix migration issues by dropping problematic views first
DROP VIEW IF EXISTS active_files;
DROP VIEW IF EXISTS user_storage_summary;
DROP VIEW IF EXISTS recent_user_activity;