-- Google OAuth Support Migration
-- Extends existing users table for OAuth authentication
-- Maintains backward compatibility with existing email/password auth

-- Add OAuth-specific fields to existing users table
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN provider TEXT DEFAULT 'email';
ALTER TABLE users ADD COLUMN provider_email TEXT;
ALTER TABLE users ADD COLUMN profile_picture_url TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN last_google_sync TEXT;

-- Create indexes for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_provider_email ON users(provider_email);

-- Create OAuth state management table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    state_token TEXT NOT NULL UNIQUE,
    return_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    used_at TEXT
);

-- Create index for state token lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- OAuth security events table for comprehensive monitoring
CREATE TABLE IF NOT EXISTS oauth_security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    user_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON string
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for security event queries
CREATE INDEX IF NOT EXISTS idx_oauth_events_type ON oauth_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_oauth_events_severity ON oauth_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_oauth_events_user ON oauth_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_events_created ON oauth_security_events(created_at);

-- OAuth rate limiting table for multi-layered protection
CREATE TABLE IF NOT EXISTS oauth_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    user_id INTEGER,
    event_type TEXT NOT NULL, -- 'attempt', 'failure', 'success'
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_ip ON oauth_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_user ON oauth_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_type ON oauth_rate_limits(event_type);
CREATE INDEX IF NOT EXISTS idx_oauth_rate_limits_created ON oauth_rate_limits(created_at);

-- Add constraints to ensure data integrity
-- Ensure google_id is unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique ON users(google_id) WHERE google_id IS NOT NULL;

-- Ensure provider_email is unique per provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_email_unique ON users(provider, provider_email) WHERE provider_email IS NOT NULL;