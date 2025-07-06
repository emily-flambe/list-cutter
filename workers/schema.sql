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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_files_file_name ON saved_files(file_name);
CREATE INDEX IF NOT EXISTS idx_saved_files_uploaded_at ON saved_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_file_relationships_source ON file_relationships(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relationships_target ON file_relationships(target_file_id);
CREATE INDEX IF NOT EXISTS idx_file_relationships_type ON file_relationships(relationship_type);