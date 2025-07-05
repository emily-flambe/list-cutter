-- D1 Database Schema for List Cutter Workers

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Saved files table
CREATE TABLE IF NOT EXISTS saved_files (
    file_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    system_tags TEXT NOT NULL DEFAULT '[]', -- JSON array as TEXT
    user_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array as TEXT
    metadata TEXT DEFAULT '{}',             -- JSON object as TEXT
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_file_name ON saved_files(file_name);
CREATE INDEX IF NOT EXISTS idx_saved_files_uploaded_at ON saved_files(uploaded_at);