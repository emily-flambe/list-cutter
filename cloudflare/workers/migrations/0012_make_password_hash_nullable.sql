-- Migration: Make password_hash nullable for OAuth users
-- Date: 2025-07-19
-- Description: OAuth users don't have passwords, so password_hash should be nullable

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table

-- Create new table with nullable password_hash
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,  -- Now nullable
    role TEXT DEFAULT 'user',
    google_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Copy existing data
INSERT INTO users_new (id, username, email, password_hash, role, google_id, created_at, updated_at)
SELECT id, username, email, password_hash, role, google_id, created_at, updated_at FROM users;

-- Drop old table and rename new one
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);