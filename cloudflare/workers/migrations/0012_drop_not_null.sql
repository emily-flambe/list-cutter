-- Use PRAGMA to rebuild table without NOT NULL constraint on password_hash
-- This is the safest way to modify the constraint in SQLite

-- Backup current table structure
CREATE TABLE users_backup AS SELECT * FROM users;

-- Drop the current table
DROP TABLE users;

-- Recreate with nullable password_hash
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    google_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Restore data
INSERT INTO users (id, username, email, password_hash, role, google_id, created_at, updated_at)
SELECT id, username, email, password_hash, role, google_id, created_at, updated_at FROM users_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Clean up backup
DROP TABLE users_backup;