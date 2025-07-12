-- D1 Database Schema for List Cutter Workers

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Saved files table
CREATE TABLE IF NOT EXISTS saved_files (
    file_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    system_tags TEXT NOT NULL DEFAULT '[]', -- JSON array as TEXT
    user_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array as TEXT
    metadata TEXT DEFAULT '{}',             -- JSON object as TEXT
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File relationships table for lineage tracking
CREATE TABLE IF NOT EXISTS file_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_id TEXT NOT NULL,
    target_file_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- 'CUT_FROM', 'DERIVED_FROM', etc.
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE,
    FOREIGN KEY (target_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE
);

-- Security events table for comprehensive audit logging
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  endpoint TEXT,
  method TEXT,
  success INTEGER NOT NULL,
  error_code TEXT,
  error_message TEXT,
  metadata TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Analytics aggregation table for daily security metrics
CREATE TABLE IF NOT EXISTS security_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  unique_users INTEGER,
  unique_ips INTEGER,
  avg_response_time REAL,
  created_at TEXT NOT NULL,
  UNIQUE(date, event_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_file_name ON saved_files(file_name);
CREATE INDEX IF NOT EXISTS idx_saved_files_uploaded_at ON saved_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_file_relationships_source ON file_relationships(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relationships_target ON file_relationships(target_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relationships_type ON file_relationships(relationship_type);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  key_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT NOT NULL, -- JSON array of permissions
  created_at INTEGER NOT NULL,
  last_used INTEGER,
  expires_at INTEGER,
  is_active INTEGER DEFAULT 1,
  rate_limit_override INTEGER, -- Custom rate limit for this key
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- API Key usage tracking
CREATE TABLE IF NOT EXISTS api_key_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  response_status INTEGER,
  response_time INTEGER,
  FOREIGN KEY (key_id) REFERENCES api_keys (key_id) ON DELETE CASCADE
);

-- Indexes for security analysis
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_success ON security_events(success);
CREATE INDEX IF NOT EXISTS idx_security_analytics_date ON security_analytics(date);
CREATE INDEX IF NOT EXISTS idx_security_analytics_type ON security_analytics(event_type);

-- Indexes for API key operations
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_timestamp ON api_key_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);