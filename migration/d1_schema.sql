-- d1_schema.sql
-- Complete D1 database schema for List Cutter Phase 4 Migration
-- Converts PostgreSQL + Neo4j to SQLite/D1

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table (equivalent to Django's auth_user)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    password TEXT NOT NULL,
    last_login TEXT,
    is_superuser INTEGER NOT NULL DEFAULT 0,
    username TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    is_staff INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    date_joined TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Saved files table
CREATE TABLE saved_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    system_tags TEXT DEFAULT '[]', -- JSON array
    user_tags TEXT DEFAULT '[]', -- JSON array
    metadata TEXT DEFAULT '{}', -- JSON object
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Persons table
CREATE TABLE persons (
    cuttyid INTEGER PRIMARY KEY,
    created_by_id INTEGER,
    firstname TEXT,
    middlename TEXT,
    lastname TEXT,
    dob TEXT, -- ISO 8601 date format
    sex TEXT,
    version TEXT,
    deceased INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    precinctname TEXT,
    countyname TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    email TEXT,
    secondary_email TEXT,
    phone TEXT,
    secondary_phone TEXT,
    mailing_address_line1 TEXT,
    mailing_address_line2 TEXT,
    city TEXT,
    statecode TEXT,
    postal_code TEXT,
    country TEXT,
    race TEXT,
    ethnicity TEXT,
    income_range TEXT,
    model_scores TEXT DEFAULT '{}', -- JSON object
    system_tags TEXT DEFAULT '[]', -- JSON array
    user_tags TEXT DEFAULT '[]', -- JSON array
    notes TEXT,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- File relationships table (replaces Neo4j graph)
-- This table stores the CUT_FROM/CUT_TO relationships from Neo4j
CREATE TABLE file_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_id TEXT NOT NULL,
    target_file_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'CUT_FROM',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT DEFAULT '{}', -- JSON for additional relationship data
    FOREIGN KEY (source_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE,
    FOREIGN KEY (target_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE,
    UNIQUE(source_file_id, target_file_id, relationship_type)
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_saved_files_uploaded_at ON saved_files(uploaded_at);

CREATE INDEX idx_persons_created_by ON persons(created_by_id);
CREATE INDEX idx_persons_name ON persons(firstname, lastname);
CREATE INDEX idx_persons_active ON persons(active);
CREATE INDEX idx_persons_created_at ON persons(created_at);
CREATE INDEX idx_persons_location ON persons(city, statecode);

CREATE INDEX idx_file_relationships_source ON file_relationships(source_file_id);
CREATE INDEX idx_file_relationships_target ON file_relationships(target_file_id);
CREATE INDEX idx_file_relationships_type ON file_relationships(relationship_type);

-- Composite indexes for common queries
CREATE INDEX idx_saved_files_user_date ON saved_files(user_id, uploaded_at);
CREATE INDEX idx_persons_user_status ON persons(created_by_id, active, deceased);
CREATE INDEX idx_file_relationships_lineage ON file_relationships(source_file_id, target_file_id);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_persons_timestamp 
AFTER UPDATE ON persons
FOR EACH ROW
BEGIN
    UPDATE persons SET updated_at = datetime('now') WHERE cuttyid = NEW.cuttyid;
END;

-- JSON validation triggers
CREATE TRIGGER validate_saved_files_json 
BEFORE INSERT ON saved_files
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN json_valid(NEW.system_tags) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in system_tags')
        WHEN json_valid(NEW.user_tags) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in user_tags')
        WHEN json_valid(NEW.metadata) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in metadata')
        WHEN json_type(NEW.system_tags) != 'array' THEN 
            RAISE(ABORT, 'system_tags must be JSON array')
        WHEN json_type(NEW.user_tags) != 'array' THEN 
            RAISE(ABORT, 'user_tags must be JSON array')
        WHEN json_type(NEW.metadata) != 'object' THEN 
            RAISE(ABORT, 'metadata must be JSON object')
    END;
END;

CREATE TRIGGER validate_persons_json 
BEFORE INSERT ON persons
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN json_valid(NEW.model_scores) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in model_scores')
        WHEN json_valid(NEW.system_tags) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in system_tags')
        WHEN json_valid(NEW.user_tags) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in user_tags')
        WHEN json_type(NEW.model_scores) != 'object' THEN 
            RAISE(ABORT, 'model_scores must be JSON object')
        WHEN json_type(NEW.system_tags) != 'array' THEN 
            RAISE(ABORT, 'system_tags must be JSON array')
        WHEN json_type(NEW.user_tags) != 'array' THEN 
            RAISE(ABORT, 'user_tags must be JSON array')
    END;
END;

CREATE TRIGGER validate_file_relationships_json 
BEFORE INSERT ON file_relationships
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN json_valid(NEW.metadata) IS NULL THEN 
            RAISE(ABORT, 'Invalid JSON in metadata')
        WHEN json_type(NEW.metadata) != 'object' THEN 
            RAISE(ABORT, 'metadata must be JSON object')
    END;
END;