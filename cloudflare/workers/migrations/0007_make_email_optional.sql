-- Migration: Make email field optional in users table
-- Date: 2025-07-13
-- Description: Remove NOT NULL constraint from email column to allow optional email registration

-- SQLite doesn't support ALTER COLUMN directly to change NOT NULL constraint
-- We need to recreate the table without the NOT NULL constraint on email

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Step 1: Create new users table with optional email
CREATE TABLE users_new (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE, -- Removed NOT NULL constraint
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    email_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Step 2: Copy data from old table to new table
INSERT INTO users_new (
    id, email, username, password_hash, full_name, is_active, is_admin, 
    email_verified, created_at, updated_at, last_login
)
SELECT 
    id, email, username, password_hash, full_name, is_active, is_admin,
    email_verified, created_at, updated_at, last_login
FROM users;

-- Step 3: Drop old table
DROP TABLE users;

-- Step 4: Rename new table to original name
ALTER TABLE users_new RENAME TO users;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Step 6: Recreate triggers
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Verify the change by attempting to insert a user without email (this should succeed)
-- This is a test query that will be rolled back
SAVEPOINT test_email_optional;
INSERT INTO users (username, password_hash) VALUES ('test_user_no_email', 'test_hash');
ROLLBACK TO SAVEPOINT test_email_optional;