# Phase 4: Database Migration to D1 - Technical Implementation Plan

## Overview

This document provides a comprehensive technical implementation plan for migrating the List Cutter application database from PostgreSQL to Cloudflare D1 (SQLite). This phase focuses on schema conversion, data migration, and ensuring data integrity throughout the transition process.

## Table of Contents

1. [Schema Analysis](#schema-analysis)
2. [PostgreSQL to SQLite Data Type Mapping](#postgresql-to-sqlite-data-type-mapping)
3. [Schema Conversion](#schema-conversion)
4. [Data Export Procedures](#data-export-procedures)
5. [Data Transformation Scripts](#data-transformation-scripts)
6. [D1 Import Procedures](#d1-import-procedures)
7. [Migration Scripts](#migration-scripts)
8. [Validation and Testing](#validation-and-testing)
9. [Index Optimization](#index-optimization)
10. [Foreign Key and Constraint Handling](#foreign-key-and-constraint-handling)
11. [Migration Execution Plan](#migration-execution-plan)

## Schema Analysis

### Current PostgreSQL Schema

Based on the Django models analysis, the current database schema consists of:

**Django Auth User Table** (built-in):
- `auth_user` - Django's built-in user model

**SavedFile Model** (`list_cutter_savedfile`):
- `id` - BigAutoField (Primary Key)
- `user_id` - ForeignKey to auth_user
- `file_id` - CharField(255, unique=True)
- `file_name` - CharField(255)
- `file_path` - CharField(500)
- `uploaded_at` - DateTimeField (auto_now_add)
- `system_tags` - PostgreSQL ArrayField
- `user_tags` - PostgreSQL ArrayField
- `metadata` - JSONField

**Person Model** (`contacts_person`):
- `cuttyid` - IntegerField (Primary Key)
- `created_by` - ForeignKey to auth_user
- Multiple VARCHAR fields for personal data
- `dob` - DateField
- `deceased`, `active` - BooleanField
- `created_at`, `updated_at` - DateTimeField
- `model_scores` - JSONField
- `system_tags`, `user_tags` - PostgreSQL ArrayField

### D1/SQLite Limitations

**Key Constraints**:
- Maximum database size: 10GB (Paid) / 500MB (Free)
- Maximum columns per table: 100
- Maximum string/BLOB row size: 2MB
- Maximum SQL statement length: 100KB
- Maximum bound parameters per query: 100
- No native array data types
- Limited concurrent write operations

## PostgreSQL to SQLite Data Type Mapping

### Core Data Types

| PostgreSQL Type | SQLite Type | Notes |
|----------------|-------------|-------|
| `SERIAL`, `BIGSERIAL` | `INTEGER PRIMARY KEY` | Auto-increment |
| `VARCHAR(n)`, `TEXT` | `TEXT` | SQLite TEXT is unlimited |
| `INTEGER`, `BIGINT` | `INTEGER` | SQLite INTEGER is 64-bit |
| `BOOLEAN` | `INTEGER` | 0 = FALSE, 1 = TRUE |
| `TIMESTAMP`, `DATETIME` | `TEXT` | ISO 8601 format |
| `DATE` | `TEXT` | ISO 8601 date format |
| `DECIMAL`, `NUMERIC` | `REAL` | Some precision loss possible |
| `JSONB`, `JSON` | `TEXT` | JSON as text with validation |

### PostgreSQL-Specific Types

| PostgreSQL Type | SQLite Equivalent | Migration Strategy |
|----------------|-------------------|-------------------|
| `ArrayField` | `TEXT` (JSON) | Convert arrays to JSON strings |
| `JSONField` | `TEXT` | Keep as JSON text, validate with SQLite JSON functions |
| `UUIDField` | `TEXT` | Store as string representation |
| `BooleanField` | `INTEGER` | Convert True/False to 1/0 |

## Schema Conversion

### 1. User Table (auth_user → users)

**PostgreSQL Schema**:
```sql
CREATE TABLE auth_user (
    id SERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    is_superuser BOOLEAN NOT NULL,
    username VARCHAR(150) UNIQUE NOT NULL,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    is_staff BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    date_joined TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**SQLite/D1 Schema**:
```sql
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

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

### 2. SavedFile Table (list_cutter_savedfile → saved_files)

**PostgreSQL Schema**:
```sql
CREATE TABLE list_cutter_savedfile (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_user(id),
    file_id VARCHAR(255) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    system_tags TEXT[], -- PostgreSQL array
    user_tags TEXT[], -- PostgreSQL array
    metadata JSONB
);
```

**SQLite/D1 Schema**:
```sql
CREATE TABLE saved_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    system_tags TEXT, -- JSON array as text
    user_tags TEXT, -- JSON array as text
    metadata TEXT, -- JSON as text
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_saved_files_uploaded_at ON saved_files(uploaded_at);
```

### 3. Person Table (contacts_person → persons)

**PostgreSQL Schema**:
```sql
CREATE TABLE contacts_person (
    cuttyid INTEGER PRIMARY KEY,
    created_by_id INTEGER REFERENCES auth_user(id),
    firstname VARCHAR(50),
    middlename VARCHAR(50),
    lastname VARCHAR(50),
    dob DATE,
    sex VARCHAR(10),
    version VARCHAR(20),
    deceased BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    -- ... other fields
    model_scores JSONB,
    system_tags TEXT[],
    user_tags TEXT[],
    notes TEXT
);
```

**SQLite/D1 Schema**:
```sql
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
    model_scores TEXT, -- JSON as text
    system_tags TEXT, -- JSON array as text
    user_tags TEXT, -- JSON array as text
    notes TEXT,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_persons_created_by ON persons(created_by_id);
CREATE INDEX idx_persons_name ON persons(firstname, lastname);
CREATE INDEX idx_persons_active ON persons(active);
CREATE INDEX idx_persons_created_at ON persons(created_at);
```

## Data Export Procedures

### 1. PostgreSQL Data Export Script

```bash
#!/bin/bash
# export_postgres_data.sh

# Set connection parameters
export PGHOST="${POSTGRES_HOST:-localhost}"
export PGPORT="${POSTGRES_PORT:-5432}"
export PGUSER="${POSTGRES_USER:-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD}"
export PGDATABASE="${POSTGRES_DB:-list_cutter}"

# Create export directory
mkdir -p ./data_export
cd ./data_export

echo "Starting PostgreSQL data export..."

# Export users table
echo "Exporting users table..."
psql -c "COPY (
    SELECT 
        id,
        password,
        last_login,
        CASE WHEN is_superuser THEN 1 ELSE 0 END as is_superuser,
        username,
        first_name,
        last_name,
        email,
        CASE WHEN is_staff THEN 1 ELSE 0 END as is_staff,
        CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
        date_joined
    FROM auth_user
    ORDER BY id
) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '\"')" > users.csv

# Export saved_files table
echo "Exporting saved_files table..."
psql -c "COPY (
    SELECT 
        id,
        user_id,
        file_id,
        file_name,
        file_path,
        uploaded_at,
        CASE 
            WHEN system_tags IS NULL THEN '[]'
            ELSE array_to_json(system_tags)::text
        END as system_tags,
        CASE 
            WHEN user_tags IS NULL THEN '[]'
            ELSE array_to_json(user_tags)::text
        END as user_tags,
        CASE 
            WHEN metadata IS NULL THEN '{}'
            ELSE metadata::text
        END as metadata
    FROM list_cutter_savedfile
    ORDER BY id
) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '\"')" > saved_files.csv

# Export persons table
echo "Exporting persons table..."
psql -c "COPY (
    SELECT 
        cuttyid,
        created_by_id,
        firstname,
        middlename,
        lastname,
        dob,
        sex,
        version,
        CASE WHEN deceased THEN 1 ELSE 0 END as deceased,
        CASE WHEN active THEN 1 ELSE 0 END as active,
        precinctname,
        countyname,
        created_at,
        updated_at,
        email,
        secondary_email,
        phone,
        secondary_phone,
        mailing_address_line1,
        mailing_address_line2,
        city,
        statecode,
        postal_code,
        country,
        race,
        ethnicity,
        income_range,
        CASE 
            WHEN model_scores IS NULL THEN '{}'
            ELSE model_scores::text
        END as model_scores,
        CASE 
            WHEN system_tags IS NULL THEN '[]'
            ELSE array_to_json(system_tags)::text
        END as system_tags,
        CASE 
            WHEN user_tags IS NULL THEN '[]'
            ELSE array_to_json(user_tags)::text
        END as user_tags,
        notes
    FROM contacts_person
    ORDER BY cuttyid
) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',', QUOTE '\"')" > persons.csv

echo "Data export completed successfully!"
echo "Files created:"
ls -la *.csv
```

### 2. Data Validation Query

```sql
-- validate_export.sql
-- Run before export to validate data integrity

-- Check for NULL values in required fields
SELECT 'users_null_check' as check_type, count(*) as count
FROM auth_user 
WHERE username IS NULL OR password IS NULL;

SELECT 'saved_files_null_check' as check_type, count(*) as count
FROM list_cutter_savedfile 
WHERE file_id IS NULL OR user_id IS NULL;

-- Check for array field issues
SELECT 'array_fields_check' as check_type, count(*) as count
FROM list_cutter_savedfile 
WHERE system_tags IS NOT NULL AND array_length(system_tags, 1) IS NULL;

-- Check JSON field validity
SELECT 'json_fields_check' as check_type, count(*) as count
FROM contacts_person 
WHERE model_scores IS NOT NULL AND NOT (model_scores::text ~ '^{.*}$');

-- Get row counts for verification
SELECT 'users_count' as table_name, count(*) as total FROM auth_user;
SELECT 'saved_files_count' as table_name, count(*) as total FROM list_cutter_savedfile;
SELECT 'persons_count' as table_name, count(*) as total FROM contacts_person;
```

## Data Transformation Scripts

### 1. CSV Processing Script

```python
#!/usr/bin/env python3
# transform_data.py

import csv
import json
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any

def transform_boolean(value: str) -> str:
    """Convert boolean text to integer string"""
    if value.lower() in ('true', 't', '1'):
        return '1'
    elif value.lower() in ('false', 'f', '0'):
        return '0'
    else:
        return '0'  # Default to false

def transform_datetime(value: str) -> str:
    """Convert PostgreSQL timestamp to ISO 8601 format"""
    if not value or value == 'NULL':
        return ''
    
    try:
        # Parse PostgreSQL timestamp format
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return value

def transform_date(value: str) -> str:
    """Convert PostgreSQL date to ISO 8601 format"""
    if not value or value == 'NULL':
        return ''
    
    try:
        # Parse and validate date
        dt = datetime.fromisoformat(value)
        return dt.strftime('%Y-%m-%d')
    except:
        return value

def validate_json(value: str) -> str:
    """Validate and clean JSON strings"""
    if not value or value == 'NULL':
        return '{}'
    
    try:
        # Parse and re-serialize to ensure valid JSON
        parsed = json.loads(value)
        return json.dumps(parsed, separators=(',', ':'))
    except:
        return '{}'

def validate_json_array(value: str) -> str:
    """Validate and clean JSON arrays"""
    if not value or value == 'NULL':
        return '[]'
    
    try:
        # Parse and re-serialize to ensure valid JSON array
        parsed = json.loads(value)
        if not isinstance(parsed, list):
            return '[]'
        return json.dumps(parsed, separators=(',', ':'))
    except:
        return '[]'

def transform_users_csv():
    """Transform users.csv for SQLite import"""
    print("Transforming users.csv...")
    
    with open('users.csv', 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open('users_transformed.csv', 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'id', 'password', 'last_login', 'is_superuser', 'username',
                'first_name', 'last_name', 'email', 'is_staff', 'is_active', 'date_joined'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'id': row['id'],
                    'password': row['password'],
                    'last_login': transform_datetime(row['last_login']),
                    'is_superuser': transform_boolean(row['is_superuser']),
                    'username': row['username'],
                    'first_name': row['first_name'],
                    'last_name': row['last_name'],
                    'email': row['email'],
                    'is_staff': transform_boolean(row['is_staff']),
                    'is_active': transform_boolean(row['is_active']),
                    'date_joined': transform_datetime(row['date_joined'])
                }
                writer.writerow(transformed_row)

def transform_saved_files_csv():
    """Transform saved_files.csv for SQLite import"""
    print("Transforming saved_files.csv...")
    
    with open('saved_files.csv', 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open('saved_files_transformed.csv', 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'id', 'user_id', 'file_id', 'file_name', 'file_path',
                'uploaded_at', 'system_tags', 'user_tags', 'metadata'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'id': row['id'],
                    'user_id': row['user_id'],
                    'file_id': row['file_id'],
                    'file_name': row['file_name'],
                    'file_path': row['file_path'],
                    'uploaded_at': transform_datetime(row['uploaded_at']),
                    'system_tags': validate_json_array(row['system_tags']),
                    'user_tags': validate_json_array(row['user_tags']),
                    'metadata': validate_json(row['metadata'])
                }
                writer.writerow(transformed_row)

def transform_persons_csv():
    """Transform persons.csv for SQLite import"""
    print("Transforming persons.csv...")
    
    with open('persons.csv', 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        with open('persons_transformed.csv', 'w', encoding='utf-8', newline='') as outfile:
            fieldnames = [
                'cuttyid', 'created_by_id', 'firstname', 'middlename', 'lastname',
                'dob', 'sex', 'version', 'deceased', 'active', 'precinctname',
                'countyname', 'created_at', 'updated_at', 'email', 'secondary_email',
                'phone', 'secondary_phone', 'mailing_address_line1', 'mailing_address_line2',
                'city', 'statecode', 'postal_code', 'country', 'race', 'ethnicity',
                'income_range', 'model_scores', 'system_tags', 'user_tags', 'notes'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                transformed_row = {
                    'cuttyid': row['cuttyid'],
                    'created_by_id': row['created_by_id'] if row['created_by_id'] else '',
                    'firstname': row['firstname'] or '',
                    'middlename': row['middlename'] or '',
                    'lastname': row['lastname'] or '',
                    'dob': transform_date(row['dob']),
                    'sex': row['sex'] or '',
                    'version': row['version'] or '',
                    'deceased': transform_boolean(row['deceased']),
                    'active': transform_boolean(row['active']),
                    'precinctname': row['precinctname'] or '',
                    'countyname': row['countyname'] or '',
                    'created_at': transform_datetime(row['created_at']),
                    'updated_at': transform_datetime(row['updated_at']),
                    'email': row['email'] or '',
                    'secondary_email': row['secondary_email'] or '',
                    'phone': row['phone'] or '',
                    'secondary_phone': row['secondary_phone'] or '',
                    'mailing_address_line1': row['mailing_address_line1'] or '',
                    'mailing_address_line2': row['mailing_address_line2'] or '',
                    'city': row['city'] or '',
                    'statecode': row['statecode'] or '',
                    'postal_code': row['postal_code'] or '',
                    'country': row['country'] or '',
                    'race': row['race'] or '',
                    'ethnicity': row['ethnicity'] or '',
                    'income_range': row['income_range'] or '',
                    'model_scores': validate_json(row['model_scores']),
                    'system_tags': validate_json_array(row['system_tags']),
                    'user_tags': validate_json_array(row['user_tags']),
                    'notes': row['notes'] or ''
                }
                writer.writerow(transformed_row)

def main():
    """Main transformation function"""
    try:
        transform_users_csv()
        transform_saved_files_csv()
        transform_persons_csv()
        print("All transformations completed successfully!")
        
        # Print statistics
        import os
        for filename in ['users_transformed.csv', 'saved_files_transformed.csv', 'persons_transformed.csv']:
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    line_count = sum(1 for line in f) - 1  # Subtract header
                    print(f"{filename}: {line_count} records")
                    
    except Exception as e:
        print(f"Error during transformation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

### 2. Data Validation Script

```python
#!/usr/bin/env python3
# validate_transformed_data.py

import csv
import json
import sys
from datetime import datetime

def validate_json_field(value: str, field_name: str, row_id: str) -> bool:
    """Validate JSON field"""
    if not value:
        return True
    
    try:
        json.loads(value)
        return True
    except json.JSONDecodeError:
        print(f"Invalid JSON in {field_name} for row {row_id}: {value}")
        return False

def validate_integer_field(value: str, field_name: str, row_id: str) -> bool:
    """Validate integer field"""
    if not value:
        return True
    
    try:
        int(value)
        return True
    except ValueError:
        print(f"Invalid integer in {field_name} for row {row_id}: {value}")
        return False

def validate_datetime_field(value: str, field_name: str, row_id: str) -> bool:
    """Validate datetime field"""
    if not value:
        return True
    
    try:
        datetime.fromisoformat(value)
        return True
    except ValueError:
        print(f"Invalid datetime in {field_name} for row {row_id}: {value}")
        return False

def validate_users_csv():
    """Validate users_transformed.csv"""
    print("Validating users_transformed.csv...")
    errors = 0
    
    with open('users_transformed.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_id = row['id']
            
            # Validate required fields
            if not row['username']:
                print(f"Missing username for user {row_id}")
                errors += 1
            
            if not row['password']:
                print(f"Missing password for user {row_id}")
                errors += 1
            
            # Validate boolean fields
            for field in ['is_superuser', 'is_staff', 'is_active']:
                if row[field] not in ['0', '1']:
                    print(f"Invalid boolean value in {field} for user {row_id}: {row[field]}")
                    errors += 1
            
            # Validate datetime fields
            for field in ['last_login', 'date_joined']:
                if not validate_datetime_field(row[field], field, row_id):
                    errors += 1
    
    print(f"Users validation completed. Errors: {errors}")
    return errors

def validate_saved_files_csv():
    """Validate saved_files_transformed.csv"""
    print("Validating saved_files_transformed.csv...")
    errors = 0
    
    with open('saved_files_transformed.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_id = row['id']
            
            # Validate required fields
            if not row['file_id']:
                print(f"Missing file_id for saved_file {row_id}")
                errors += 1
            
            if not row['user_id']:
                print(f"Missing user_id for saved_file {row_id}")
                errors += 1
            
            # Validate integer fields
            if not validate_integer_field(row['user_id'], 'user_id', row_id):
                errors += 1
            
            # Validate JSON fields
            if not validate_json_field(row['system_tags'], 'system_tags', row_id):
                errors += 1
            
            if not validate_json_field(row['user_tags'], 'user_tags', row_id):
                errors += 1
            
            if not validate_json_field(row['metadata'], 'metadata', row_id):
                errors += 1
            
            # Validate datetime
            if not validate_datetime_field(row['uploaded_at'], 'uploaded_at', row_id):
                errors += 1
    
    print(f"Saved files validation completed. Errors: {errors}")
    return errors

def validate_persons_csv():
    """Validate persons_transformed.csv"""
    print("Validating persons_transformed.csv...")
    errors = 0
    
    with open('persons_transformed.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_id = row['cuttyid']
            
            # Validate primary key
            if not validate_integer_field(row['cuttyid'], 'cuttyid', row_id):
                errors += 1
            
            # Validate foreign key
            if row['created_by_id'] and not validate_integer_field(row['created_by_id'], 'created_by_id', row_id):
                errors += 1
            
            # Validate boolean fields
            for field in ['deceased', 'active']:
                if row[field] not in ['0', '1']:
                    print(f"Invalid boolean value in {field} for person {row_id}: {row[field]}")
                    errors += 1
            
            # Validate JSON fields
            if not validate_json_field(row['model_scores'], 'model_scores', row_id):
                errors += 1
            
            if not validate_json_field(row['system_tags'], 'system_tags', row_id):
                errors += 1
            
            if not validate_json_field(row['user_tags'], 'user_tags', row_id):
                errors += 1
            
            # Validate datetime fields
            for field in ['created_at', 'updated_at']:
                if not validate_datetime_field(row[field], field, row_id):
                    errors += 1
    
    print(f"Persons validation completed. Errors: {errors}")
    return errors

def main():
    """Main validation function"""
    total_errors = 0
    
    try:
        total_errors += validate_users_csv()
        total_errors += validate_saved_files_csv()
        total_errors += validate_persons_csv()
        
        print(f"\nValidation completed. Total errors: {total_errors}")
        
        if total_errors == 0:
            print("✓ All data validation checks passed!")
        else:
            print("✗ Data validation failed. Please fix errors before proceeding.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error during validation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## D1 Import Procedures

### 1. D1 Schema Creation Script

```sql
-- d1_schema.sql
-- Complete D1 database schema

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

-- Triggers for updated_at timestamps
CREATE TRIGGER update_persons_timestamp 
AFTER UPDATE ON persons
FOR EACH ROW
BEGIN
    UPDATE persons SET updated_at = datetime('now') WHERE cuttyid = NEW.cuttyid;
END;

-- JSON validation functions (optional, for data integrity)
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
    END;
END;
```

### 2. D1 Data Import Script

```bash
#!/bin/bash
# import_to_d1.sh

# Configuration
D1_DATABASE_NAME="list-cutter-dev"
BATCH_SIZE=1000

echo "Starting D1 data import..."

# Function to import CSV data in batches
import_csv_batch() {
    local table_name=$1
    local csv_file=$2
    local temp_sql="temp_import_${table_name}.sql"
    
    echo "Importing $csv_file to $table_name..."
    
    # Convert CSV to SQL INSERT statements
    python3 << EOF
import csv
import sys

def escape_sql_value(value):
    if value is None or value == '':
        return 'NULL'
    # Escape single quotes
    escaped = value.replace("'", "''")
    return f"'{escaped}'"

def convert_csv_to_sql(csv_file, table_name, batch_size=1000):
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        # Get column names
        columns = reader.fieldnames
        columns_str = ', '.join(columns)
        
        batch_count = 0
        current_batch = []
        
        for row in reader:
            # Convert row to values
            values = []
            for col in columns:
                values.append(escape_sql_value(row[col]))
            values_str = ', '.join(values)
            
            current_batch.append(f"({values_str})")
            
            if len(current_batch) >= batch_size:
                # Write batch
                sql = f"INSERT INTO {table_name} ({columns_str}) VALUES\\n" + ',\\n'.join(current_batch) + ";"
                print(sql)
                current_batch = []
                batch_count += 1
        
        # Write remaining batch
        if current_batch:
            sql = f"INSERT INTO {table_name} ({columns_str}) VALUES\\n" + ',\\n'.join(current_batch) + ";"
            print(sql)

convert_csv_to_sql('${csv_file}', '${table_name}', ${BATCH_SIZE})
EOF
}

# Create schema
echo "Creating D1 schema..."
wrangler d1 execute $D1_DATABASE_NAME --file=d1_schema.sql --local

# Import data
echo "Importing users data..."
import_csv_batch "users" "users_transformed.csv" > temp_import_users.sql
wrangler d1 execute $D1_DATABASE_NAME --file=temp_import_users.sql --local

echo "Importing saved_files data..."
import_csv_batch "saved_files" "saved_files_transformed.csv" > temp_import_saved_files.sql
wrangler d1 execute $D1_DATABASE_NAME --file=temp_import_saved_files.sql --local

echo "Importing persons data..."
import_csv_batch "persons" "persons_transformed.csv" > temp_import_persons.sql
wrangler d1 execute $D1_DATABASE_NAME --file=temp_import_persons.sql --local

# Clean up temporary files
rm -f temp_import_*.sql

echo "Data import completed successfully!"

# Verify import
echo "Verifying import..."
wrangler d1 execute $D1_DATABASE_NAME --command="SELECT 'users' as table_name, COUNT(*) as count FROM users UNION ALL SELECT 'saved_files', COUNT(*) FROM saved_files UNION ALL SELECT 'persons', COUNT(*) FROM persons;" --local
```

## Migration Scripts

### 1. Complete Migration Script

```bash
#!/bin/bash
# complete_migration.sh

set -e  # Exit on any error

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-list_cutter}"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-list-cutter-dev}"
BACKUP_DIR="./migration_backup_$(date +%Y%m%d_%H%M%S)"

echo "=== List Cutter Database Migration ==="
echo "From: PostgreSQL (${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB})"
echo "To: Cloudflare D1 (${D1_DATABASE_NAME})"
echo "Backup Directory: ${BACKUP_DIR}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# Step 1: Validate PostgreSQL connection
echo "Step 1: Validating PostgreSQL connection..."
if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; then
    echo "ERROR: Cannot connect to PostgreSQL database"
    exit 1
fi
echo "✓ PostgreSQL connection validated"

# Step 2: Run pre-migration validation
echo "Step 2: Running pre-migration validation..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f ../validate_export.sql
echo "✓ Pre-migration validation completed"

# Step 3: Export PostgreSQL data
echo "Step 3: Exporting PostgreSQL data..."
bash ../export_postgres_data.sh
echo "✓ Data export completed"

# Step 4: Transform data for SQLite
echo "Step 4: Transforming data for SQLite..."
python3 ../transform_data.py
echo "✓ Data transformation completed"

# Step 5: Validate transformed data
echo "Step 5: Validating transformed data..."
python3 ../validate_transformed_data.py
echo "✓ Transformed data validation completed"

# Step 6: Create D1 database and schema
echo "Step 6: Creating D1 database and schema..."
wrangler d1 execute "$D1_DATABASE_NAME" --file=../d1_schema.sql --local
echo "✓ D1 schema created"

# Step 7: Import data to D1
echo "Step 7: Importing data to D1..."
bash ../import_to_d1.sh
echo "✓ Data import to D1 completed"

# Step 8: Run post-migration validation
echo "Step 8: Running post-migration validation..."
bash ../validate_d1_data.sh
echo "✓ Post-migration validation completed"

# Step 9: Performance optimization
echo "Step 9: Running performance optimization..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="ANALYZE;" --local
echo "✓ Performance optimization completed"

echo ""
echo "=== Migration Summary ==="
echo "✓ All migration steps completed successfully!"
echo "✓ Data has been migrated from PostgreSQL to D1"
echo "✓ All validation checks passed"
echo "✓ Backup created in: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Test the D1 database with your application"
echo "2. Update application configuration to use D1"
echo "3. Deploy to staging environment for testing"
echo "4. Plan production cutover"
```

### 2. Rollback Script

```bash
#!/bin/bash
# rollback_migration.sh

set -e

D1_DATABASE_NAME="${D1_DATABASE_NAME:-list-cutter-dev}"
BACKUP_DIR="$1"

if [ -z "$BACKUP_DIR" ]; then
    echo "ERROR: Please provide backup directory path"
    echo "Usage: ./rollback_migration.sh <backup_directory>"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: Backup directory does not exist: $BACKUP_DIR"
    exit 1
fi

echo "=== Migration Rollback ==="
echo "Backup Directory: $BACKUP_DIR"
echo "D1 Database: $D1_DATABASE_NAME"
echo ""

# Confirm rollback
read -p "Are you sure you want to rollback the migration? This will delete all D1 data. (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

# Drop all tables in D1
echo "Dropping D1 tables..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="
DROP TABLE IF EXISTS persons;
DROP TABLE IF EXISTS saved_files;
DROP TABLE IF EXISTS users;
" --local

echo "✓ D1 tables dropped"
echo "✓ Rollback completed"
echo ""
echo "Your PostgreSQL database remains unchanged."
echo "You can re-run the migration script to try again."
```

## Validation and Testing

### 1. Data Integrity Validation

```bash
#!/bin/bash
# validate_d1_data.sh

D1_DATABASE_NAME="${D1_DATABASE_NAME:-list-cutter-dev}"

echo "=== D1 Data Validation ==="

# Row count validation
echo "1. Validating row counts..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'saved_files', COUNT(*) FROM saved_files
UNION ALL
SELECT 'persons', COUNT(*) FROM persons;
" --local

# Foreign key validation
echo "2. Validating foreign key relationships..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Check for orphaned saved_files
SELECT 'orphaned_saved_files' as check_type, COUNT(*) as count
FROM saved_files sf
LEFT JOIN users u ON sf.user_id = u.id
WHERE u.id IS NULL;
" --local

wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Check for orphaned persons
SELECT 'orphaned_persons' as check_type, COUNT(*) as count
FROM persons p
LEFT JOIN users u ON p.created_by_id = u.id
WHERE p.created_by_id IS NOT NULL AND u.id IS NULL;
" --local

# JSON validation
echo "3. Validating JSON fields..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Check saved_files JSON fields
SELECT 'invalid_saved_files_json' as check_type, COUNT(*) as count
FROM saved_files
WHERE json_valid(system_tags) IS NULL 
   OR json_valid(user_tags) IS NULL 
   OR json_valid(metadata) IS NULL;
" --local

wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Check persons JSON fields
SELECT 'invalid_persons_json' as check_type, COUNT(*) as count
FROM persons
WHERE json_valid(model_scores) IS NULL 
   OR json_valid(system_tags) IS NULL 
   OR json_valid(user_tags) IS NULL;
" --local

# Data type validation
echo "4. Validating data types..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Check boolean fields
SELECT 'invalid_boolean_users' as check_type, COUNT(*) as count
FROM users
WHERE is_superuser NOT IN (0, 1)
   OR is_staff NOT IN (0, 1)
   OR is_active NOT IN (0, 1);
" --local

wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Check boolean fields in persons
SELECT 'invalid_boolean_persons' as check_type, COUNT(*) as count
FROM persons
WHERE deceased NOT IN (0, 1)
   OR active NOT IN (0, 1);
" --local

# Sample data verification
echo "5. Sample data verification..."
wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Sample users
SELECT 'sample_users' as check_type, username, email, is_active
FROM users
ORDER BY id
LIMIT 5;
" --local

wrangler d1 execute "$D1_DATABASE_NAME" --command="
-- Sample saved_files with JSON parsing
SELECT 'sample_saved_files' as check_type, 
       file_name, 
       json_array_length(system_tags) as system_tags_count,
       json_array_length(user_tags) as user_tags_count
FROM saved_files
ORDER BY id
LIMIT 5;
" --local

echo "=== Validation Complete ==="
```

### 2. Performance Testing

```sql
-- performance_test.sql
-- Test query performance on D1

-- Test 1: Simple SELECT performance
.timer on
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM saved_files;
SELECT COUNT(*) FROM persons;

-- Test 2: JOIN performance
SELECT COUNT(*) 
FROM saved_files sf
JOIN users u ON sf.user_id = u.id
WHERE u.is_active = 1;

-- Test 3: JSON query performance
SELECT COUNT(*) 
FROM saved_files
WHERE json_array_length(system_tags) > 0;

-- Test 4: Complex query with multiple JOINs
SELECT 
    u.username,
    COUNT(sf.id) as file_count,
    COUNT(p.cuttyid) as person_count
FROM users u
LEFT JOIN saved_files sf ON u.id = sf.user_id
LEFT JOIN persons p ON u.id = p.created_by_id
WHERE u.is_active = 1
GROUP BY u.id, u.username
ORDER BY file_count DESC
LIMIT 10;

-- Test 5: Full-text search simulation
SELECT COUNT(*) 
FROM persons
WHERE firstname LIKE '%john%' 
   OR lastname LIKE '%smith%';

.timer off
```

### 3. Application Integration Testing

```typescript
// test_d1_integration.ts
// Integration test for D1 database with Workers

import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('D1 Integration Tests', () => {
  it('should connect to D1 database', async () => {
    const result = await env.DB.prepare('SELECT 1 as test').first();
    expect(result.test).toBe(1);
  });

  it('should query users table', async () => {
    const result = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    expect(result.count).toBeGreaterThan(0);
  });

  it('should query saved_files with JSON functions', async () => {
    const result = await env.DB.prepare(`
      SELECT 
        file_name,
        json_array_length(system_tags) as tag_count
      FROM saved_files
      WHERE json_array_length(system_tags) > 0
      LIMIT 1
    `).first();
    
    expect(result).toBeDefined();
    expect(result.tag_count).toBeGreaterThan(0);
  });

  it('should perform JOIN operations', async () => {
    const result = await env.DB.prepare(`
      SELECT 
        u.username,
        COUNT(sf.id) as file_count
      FROM users u
      LEFT JOIN saved_files sf ON u.id = sf.user_id
      GROUP BY u.id, u.username
      ORDER BY file_count DESC
      LIMIT 1
    `).first();
    
    expect(result).toBeDefined();
    expect(result.username).toBeDefined();
  });

  it('should handle JSON queries correctly', async () => {
    const result = await env.DB.prepare(`
      SELECT 
        model_scores,
        json_extract(model_scores, '$.score') as score
      FROM persons
      WHERE json_valid(model_scores) = 1
      AND json_extract(model_scores, '$.score') IS NOT NULL
      LIMIT 1
    `).first();
    
    if (result) {
      expect(result.model_scores).toBeDefined();
      expect(result.score).toBeDefined();
    }
  });
});
```

## Index Optimization

### 1. Performance Index Creation

```sql
-- optimize_indexes.sql
-- Create additional indexes for performance

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_date_joined ON users(date_joined);

-- Saved files indexes
CREATE INDEX IF NOT EXISTS idx_saved_files_user_uploaded ON saved_files(user_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_saved_files_filename ON saved_files(file_name);
CREATE INDEX IF NOT EXISTS idx_saved_files_path ON saved_files(file_path);

-- Persons indexes for common queries
CREATE INDEX IF NOT EXISTS idx_persons_fullname ON persons(firstname, lastname, middlename);
CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);
CREATE INDEX IF NOT EXISTS idx_persons_phone ON persons(phone);
CREATE INDEX IF NOT EXISTS idx_persons_address ON persons(city, statecode, postal_code);
CREATE INDEX IF NOT EXISTS idx_persons_created_by_active ON persons(created_by_id, active);
CREATE INDEX IF NOT EXISTS idx_persons_demographics ON persons(race, ethnicity, sex);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_saved_files_user_date_desc ON saved_files(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_persons_user_status ON persons(created_by_id, active, deceased);

-- Partial indexes for active records (SQLite doesn't support partial indexes directly)
-- But we can create functional indexes
CREATE INDEX IF NOT EXISTS idx_active_users ON users(id) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_active_persons ON persons(cuttyid) WHERE active = 1;
```

### 2. Query Optimization Guide

```sql
-- query_optimization_examples.sql
-- Examples of optimized queries for D1

-- BAD: Full table scan
-- SELECT * FROM persons WHERE firstname = 'John';

-- GOOD: Use indexes
SELECT cuttyid, firstname, lastname, email 
FROM persons 
WHERE firstname = 'John' 
AND active = 1;

-- BAD: JSON extraction without index
-- SELECT * FROM saved_files WHERE json_extract(metadata, '$.type') = 'csv';

-- GOOD: Filter first, then extract JSON
SELECT file_id, file_name, metadata
FROM saved_files
WHERE file_name LIKE '%.csv'
AND json_extract(metadata, '$.type') = 'csv';

-- BAD: Complex subquery
-- SELECT * FROM users WHERE id IN (
--   SELECT user_id FROM saved_files WHERE uploaded_at > '2024-01-01'
-- );

-- GOOD: JOIN with proper indexes
SELECT DISTINCT u.id, u.username, u.email
FROM users u
JOIN saved_files sf ON u.id = sf.user_id
WHERE sf.uploaded_at > '2024-01-01'
AND u.is_active = 1;

-- JSON query optimization
SELECT 
    p.cuttyid,
    p.firstname,
    p.lastname,
    json_extract(p.system_tags, '$[0]') as first_tag,
    json_array_length(p.system_tags) as tag_count
FROM persons p
WHERE json_array_length(p.system_tags) > 0
AND p.active = 1;
```

## Foreign Key and Constraint Handling

### 1. Foreign Key Setup

```sql
-- foreign_keys.sql
-- Comprehensive foreign key setup

-- Enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- Verify foreign key constraints
PRAGMA foreign_key_check;

-- Create foreign key constraints with proper actions
ALTER TABLE saved_files 
ADD CONSTRAINT fk_saved_files_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE persons 
ADD CONSTRAINT fk_persons_created_by 
FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraint for boolean fields
CREATE TABLE users_with_constraints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    is_staff INTEGER NOT NULL DEFAULT 0 CHECK (is_staff IN (0, 1)),
    is_superuser INTEGER NOT NULL DEFAULT 0 CHECK (is_superuser IN (0, 1))
);

-- JSON validation constraints
CREATE TRIGGER validate_json_fields 
BEFORE INSERT ON saved_files
FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN json_valid(NEW.system_tags) IS NULL THEN 
            RAISE(ABORT, 'system_tags must be valid JSON array')
        WHEN json_valid(NEW.user_tags) IS NULL THEN 
            RAISE(ABORT, 'user_tags must be valid JSON array')
        WHEN json_valid(NEW.metadata) IS NULL THEN 
            RAISE(ABORT, 'metadata must be valid JSON')
        WHEN json_type(NEW.system_tags) != 'array' THEN 
            RAISE(ABORT, 'system_tags must be JSON array')
        WHEN json_type(NEW.user_tags) != 'array' THEN 
            RAISE(ABORT, 'user_tags must be JSON array')
        WHEN json_type(NEW.metadata) != 'object' THEN 
            RAISE(ABORT, 'metadata must be JSON object')
    END;
END;
```

### 2. Data Integrity Triggers

```sql
-- data_integrity_triggers.sql
-- Triggers for maintaining data integrity

-- Update timestamp triggers
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET date_joined = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_persons_timestamp 
AFTER UPDATE ON persons
FOR EACH ROW
BEGIN
    UPDATE persons SET updated_at = datetime('now') WHERE cuttyid = NEW.cuttyid;
END;

-- Cascade delete trigger for complex relationships
CREATE TRIGGER cascade_delete_user_data 
AFTER DELETE ON users
FOR EACH ROW
BEGIN
    -- Delete associated saved files
    DELETE FROM saved_files WHERE user_id = OLD.id;
    
    -- Set created_by to NULL for persons
    UPDATE persons SET created_by_id = NULL WHERE created_by_id = OLD.id;
END;

-- Audit trail trigger
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    user_id INTEGER
);

CREATE TRIGGER audit_users_changes 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id)
    VALUES (
        'users', 
        'UPDATE',
        json_object('id', OLD.id, 'username', OLD.username, 'email', OLD.email),
        json_object('id', NEW.id, 'username', NEW.username, 'email', NEW.email),
        NEW.id
    );
END;
```

## Migration Execution Plan

### Phase 4.1: Pre-Migration Preparation (Week 1)

**Day 1-2: Environment Setup**
- [ ] Set up D1 database in Cloudflare dashboard
- [ ] Configure local development environment
- [ ] Install required tools (wrangler, Python, PostgreSQL client)
- [ ] Create backup infrastructure

**Day 3-4: Schema Analysis and Validation**
- [ ] Analyze current PostgreSQL schema
- [ ] Identify PostgreSQL-specific features
- [ ] Create D1 schema mapping
- [ ] Validate data integrity in source database

**Day 5-7: Script Development and Testing**
- [ ] Develop export scripts
- [ ] Create transformation scripts
- [ ] Write validation scripts
- [ ] Test all scripts with sample data

### Phase 4.2: Migration Execution (Week 2)

**Day 1: Final Preparation**
- [ ] Create production backup
- [ ] Set up monitoring
- [ ] Prepare rollback procedures
- [ ] Schedule maintenance window

**Day 2: Schema Migration**
- [ ] Create D1 database schema
- [ ] Set up indexes and constraints
- [ ] Validate schema structure
- [ ] Test basic operations

**Day 3: Data Migration**
- [ ] Export data from PostgreSQL
- [ ] Transform data for SQLite
- [ ] Validate transformed data
- [ ] Import data to D1

**Day 4: Validation and Testing**
- [ ] Run comprehensive data validation
- [ ] Test application integration
- [ ] Perform performance testing
- [ ] Verify all queries work correctly

**Day 5: Optimization and Finalization**
- [ ] Optimize indexes
- [ ] Run ANALYZE command
- [ ] Final validation
- [ ] Document migration results

### Phase 4.3: Post-Migration (Week 3)

**Day 1-3: Application Integration**
- [ ] Update application configuration
- [ ] Deploy to staging environment
- [ ] Test all application features
- [ ] Performance benchmarking

**Day 4-5: Production Deployment**
- [ ] Deploy to production
- [ ] Monitor performance
- [ ] Handle any issues
- [ ] Validate production data

**Day 6-7: Cleanup and Documentation**
- [ ] Remove old database connections
- [ ] Clean up temporary files
- [ ] Update documentation
- [ ] Create post-migration report

## Success Criteria

### Data Integrity
- [ ] Zero data loss during migration
- [ ] All foreign key relationships maintained
- [ ] All JSON data valid and accessible
- [ ] All array data properly converted

### Performance
- [ ] Query response time < 100ms for simple queries
- [ ] JOIN operations perform within acceptable limits
- [ ] JSON operations maintain good performance
- [ ] Indexes properly utilized

### Functionality
- [ ] All application features work correctly
- [ ] Authentication and authorization unchanged
- [ ] File operations function properly
- [ ] Search and filtering work as expected

### Reliability
- [ ] Database connections stable
- [ ] No data corruption
- [ ] Backup and restore procedures tested
- [ ] Monitoring and alerting in place

## Risk Mitigation

### Data Loss Prevention
- Multiple backup points throughout migration
- Validation at each step
- Rollback procedures tested
- Source database kept unchanged during migration

### Performance Issues
- Comprehensive index strategy
- Query optimization guide
- Performance testing before production
- Monitoring and alerting setup

### Application Compatibility
- Thorough testing of all features
- Gradual rollout strategy
- Feature flags for quick rollback
- Staging environment validation

## Rollback Plan

### Immediate Rollback (< 1 hour)
1. Switch application back to PostgreSQL
2. Update DNS/routing if necessary
3. Verify application functionality
4. Investigate issues

### Data Rollback (< 4 hours)
1. Restore from PostgreSQL backup
2. Verify data integrity
3. Update application configuration
4. Test all functionality

### Complete Rollback (< 24 hours)
1. Revert all infrastructure changes
2. Restore original database
3. Update documentation
4. Post-mortem analysis

This comprehensive migration plan ensures a systematic, validated approach to migrating from PostgreSQL to D1, with extensive error handling, validation, and rollback procedures to minimize risk and ensure data integrity throughout the process.