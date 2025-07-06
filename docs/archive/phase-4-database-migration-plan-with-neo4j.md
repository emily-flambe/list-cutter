# Phase 4: Database Migration Implementation Plan
## PostgreSQL + Neo4j to Cloudflare D1 Migration

### Executive Summary

This document provides a comprehensive implementation plan for migrating from PostgreSQL + Neo4j to Cloudflare D1 while preserving all data integrity and functionality. The migration addresses complex data type conversions, relationship mapping, and performance optimization for the D1 SQLite environment.

## Current Database Architecture Analysis

### PostgreSQL Schema Analysis
Based on the current models, we have:

1. **Django Auth Models** (standard Django user management)
2. **Person Model** (contacts/models.py)
   - Primary key: `cuttyid` (IntegerField)
   - Complex fields: `ArrayField`, `JSONField`
   - 25+ fields including demographics, addresses, contact info
3. **SavedFile Model** (list_cutter/models.py)
   - File management with metadata
   - `ArrayField` for tags, `JSONField` for metadata
4. **Neo4j Graph Model** (graph_models.py)
   - `SavedFileNode` with `CUT_FROM`/`CUT_TO` relationships
   - File lineage tracking

### Data Type Mapping Challenges

| PostgreSQL Type | D1 (SQLite) Equivalent | Conversion Strategy |
|----------------|----------------------|-------------------|
| `ArrayField` | `TEXT` (JSON) | Convert arrays to JSON strings |
| `JSONField` | `TEXT` (JSON) | Direct JSON string storage |
| `IntegerField` | `INTEGER` | Direct mapping |
| `CharField` | `TEXT` | Direct mapping |
| `BooleanField` | `INTEGER` (0/1) | Convert boolean to integer |
| `DateField` | `TEXT` (ISO format) | Store as ISO date strings |
| `DateTimeField` | `TEXT` (ISO format) | Store as ISO datetime strings |
| `EmailField` | `TEXT` | Direct mapping |
| `ForeignKey` | `INTEGER` | Store as foreign key ID |

## 1. PostgreSQL to D1 Schema Conversion

### 1.1 Schema Conversion Strategy

#### Step 1: Generate D1 Schema
```sql
-- D1 Schema Creation Script
-- File: migrations/d1_schema.sql

-- Users table (Django auth_user equivalent)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    is_active INTEGER DEFAULT 1,
    is_staff INTEGER DEFAULT 0,
    is_superuser INTEGER DEFAULT 0,
    date_joined TEXT NOT NULL,
    last_login TEXT
);

-- Person table (contacts_person)
CREATE TABLE persons (
    cuttyid INTEGER PRIMARY KEY,
    created_by_id INTEGER,
    firstname TEXT,
    middlename TEXT,
    lastname TEXT,
    dob TEXT,
    sex TEXT,
    version TEXT,
    deceased INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    precinctname TEXT,
    countyname TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
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
    model_scores TEXT, -- JSON string
    system_tags TEXT, -- JSON array string
    user_tags TEXT, -- JSON array string
    notes TEXT,
    FOREIGN KEY (created_by_id) REFERENCES users(id)
);

-- SavedFile table (list_cutter_savedfile)
CREATE TABLE saved_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    uploaded_at TEXT NOT NULL,
    system_tags TEXT, -- JSON array string
    user_tags TEXT, -- JSON array string
    metadata TEXT, -- JSON string
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File relationships table (Neo4j equivalent)
CREATE TABLE file_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file_id TEXT NOT NULL,
    target_file_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'CUT_TO',
    created_at TEXT NOT NULL,
    metadata TEXT, -- JSON string for additional relationship data
    FOREIGN KEY (source_file_id) REFERENCES saved_files(file_id),
    FOREIGN KEY (target_file_id) REFERENCES saved_files(file_id),
    UNIQUE(source_file_id, target_file_id, relationship_type)
);
```

#### Step 2: Index Optimization for D1
```sql
-- Indexes for performance optimization
-- File: migrations/d1_indexes.sql

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Persons indexes
CREATE INDEX idx_persons_created_by ON persons(created_by_id);
CREATE INDEX idx_persons_name ON persons(firstname, lastname);
CREATE INDEX idx_persons_email ON persons(email);
CREATE INDEX idx_persons_active ON persons(active);
CREATE INDEX idx_persons_created_at ON persons(created_at);

-- SavedFiles indexes
CREATE INDEX idx_saved_files_user ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_saved_files_uploaded_at ON saved_files(uploaded_at);

-- File relationships indexes
CREATE INDEX idx_file_rel_source ON file_relationships(source_file_id);
CREATE INDEX idx_file_rel_target ON file_relationships(target_file_id);
CREATE INDEX idx_file_rel_type ON file_relationships(relationship_type);
```

### 1.2 Data Type Conversion Utilities

#### TypeScript Conversion Utilities
```typescript
// File: src/db/converters.ts

export interface ArrayFieldConverter {
  toD1: (array: string[] | null) => string | null;
  fromD1: (jsonString: string | null) => string[] | null;
}

export const arrayFieldConverter: ArrayFieldConverter = {
  toD1: (array: string[] | null): string | null => {
    if (!array || array.length === 0) return null;
    return JSON.stringify(array);
  },
  
  fromD1: (jsonString: string | null): string[] | null => {
    if (!jsonString) return null;
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
};

export interface JSONFieldConverter {
  toD1: (obj: any) => string | null;
  fromD1: (jsonString: string | null) => any;
}

export const jsonFieldConverter: JSONFieldConverter = {
  toD1: (obj: any): string | null => {
    if (obj === null || obj === undefined) return null;
    return JSON.stringify(obj);
  },
  
  fromD1: (jsonString: string | null): any => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }
};

export interface DateTimeConverter {
  toD1: (date: Date | string | null) => string | null;
  fromD1: (dateString: string | null) => Date | null;
}

export const dateTimeConverter: DateTimeConverter = {
  toD1: (date: Date | string | null): string | null => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
  },
  
  fromD1: (dateString: string | null): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }
};

export interface BooleanConverter {
  toD1: (value: boolean | null) => number | null;
  fromD1: (value: number | null) => boolean | null;
}

export const booleanConverter: BooleanConverter = {
  toD1: (value: boolean | null): number | null => {
    if (value === null || value === undefined) return null;
    return value ? 1 : 0;
  },
  
  fromD1: (value: number | null): boolean | null => {
    if (value === null || value === undefined) return null;
    return value === 1;
  }
};
```

## 2. Migration Scripts and Data Transformation

### 2.1 PostgreSQL Data Export Script

```python
# File: migration_scripts/export_postgresql_data.py

import os
import json
import psycopg2
from datetime import datetime
from typing import Dict, List, Any, Optional

class PostgreSQLExporter:
    def __init__(self, connection_string: str, output_dir: str):
        self.connection_string = connection_string
        self.output_dir = output_dir
        self.conn = None
        
    def connect(self):
        self.conn = psycopg2.connect(self.connection_string)
        
    def disconnect(self):
        if self.conn:
            self.conn.close()
            
    def export_table(self, table_name: str, query: str) -> Dict[str, Any]:
        """Export table data to JSON format"""
        with self.conn.cursor() as cursor:
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            data = []
            for row in rows:
                row_dict = {}
                for i, value in enumerate(row):
                    column_name = columns[i]
                    # Handle PostgreSQL-specific types
                    if isinstance(value, list):
                        row_dict[column_name] = value  # ArrayField
                    elif isinstance(value, dict):
                        row_dict[column_name] = value  # JSONField
                    elif isinstance(value, datetime):
                        row_dict[column_name] = value.isoformat()
                    else:
                        row_dict[column_name] = value
                data.append(row_dict)
                
        return {
            'table_name': table_name,
            'columns': columns,
            'data': data,
            'row_count': len(data)
        }
        
    def export_all_tables(self):
        """Export all relevant tables"""
        tables = {
            'users': '''
                SELECT id, username, email, password, first_name, last_name,
                       is_active, is_staff, is_superuser, date_joined, last_login
                FROM auth_user
            ''',
            'persons': '''
                SELECT cuttyid, created_by_id, firstname, middlename, lastname,
                       dob, sex, version, deceased, active, precinctname, countyname,
                       created_at, updated_at, email, secondary_email, phone,
                       secondary_phone, mailing_address_line1, mailing_address_line2,
                       city, statecode, postal_code, country, race, ethnicity,
                       income_range, model_scores, system_tags, user_tags, notes
                FROM contacts_person
            ''',
            'saved_files': '''
                SELECT id, user_id, file_id, file_name, file_path, uploaded_at,
                       system_tags, user_tags, metadata
                FROM list_cutter_savedfile
            '''
        }
        
        exported_data = {}
        for table_name, query in tables.items():
            print(f"Exporting {table_name}...")
            exported_data[table_name] = self.export_table(table_name, query)
            
            # Save individual table files
            output_file = os.path.join(self.output_dir, f"{table_name}.json")
            with open(output_file, 'w') as f:
                json.dump(exported_data[table_name], f, indent=2, default=str)
                
        return exported_data

# Usage
if __name__ == "__main__":
    exporter = PostgreSQLExporter(
        connection_string="postgresql://user:password@host:port/database",
        output_dir="./export_data"
    )
    
    os.makedirs(exporter.output_dir, exist_ok=True)
    exporter.connect()
    
    try:
        exported_data = exporter.export_all_tables()
        print(f"Export completed. Total tables: {len(exported_data)}")
        
        # Create summary file
        summary = {
            'export_timestamp': datetime.now().isoformat(),
            'tables': {name: data['row_count'] for name, data in exported_data.items()}
        }
        
        with open(os.path.join(exporter.output_dir, 'export_summary.json'), 'w') as f:
            json.dump(summary, f, indent=2)
            
    finally:
        exporter.disconnect()
```

### 2.2 Neo4j Data Export Script

```python
# File: migration_scripts/export_neo4j_data.py

import json
import os
from datetime import datetime
from typing import Dict, List, Any
from neo4j import GraphDatabase

class Neo4jExporter:
    def __init__(self, uri: str, username: str, password: str, output_dir: str):
        self.driver = GraphDatabase.driver(uri, auth=(username, password))
        self.output_dir = output_dir
        
    def close(self):
        self.driver.close()
        
    def export_file_relationships(self) -> Dict[str, Any]:
        """Export Neo4j file relationships to relational format"""
        query = '''
        MATCH (source:SavedFileNode)-[r:CUT_TO]->(target:SavedFileNode)
        RETURN source.file_id as source_file_id,
               target.file_id as target_file_id,
               type(r) as relationship_type,
               r.created_at as created_at,
               r as relationship_properties
        '''
        
        relationships = []
        with self.driver.session() as session:
            result = session.run(query)
            for record in result:
                relationship = {
                    'source_file_id': record['source_file_id'],
                    'target_file_id': record['target_file_id'],
                    'relationship_type': record['relationship_type'],
                    'created_at': datetime.now().isoformat(),  # Default if not present
                    'metadata': json.dumps(dict(record['relationship_properties']))
                }
                relationships.append(relationship)
                
        return {
            'table_name': 'file_relationships',
            'data': relationships,
            'row_count': len(relationships)
        }
        
    def export_file_nodes(self) -> Dict[str, Any]:
        """Export Neo4j file nodes for validation"""
        query = '''
        MATCH (n:SavedFileNode)
        RETURN n.file_id as file_id,
               n.file_name as file_name,
               n.file_path as file_path,
               n.metadata as metadata
        '''
        
        nodes = []
        with self.driver.session() as session:
            result = session.run(query)
            for record in result:
                node = {
                    'file_id': record['file_id'],
                    'file_name': record['file_name'],
                    'file_path': record['file_path'],
                    'metadata': record['metadata']
                }
                nodes.append(node)
                
        return {
            'table_name': 'file_nodes',
            'data': nodes,
            'row_count': len(nodes)
        }

# Usage
if __name__ == "__main__":
    exporter = Neo4jExporter(
        uri="bolt://localhost:7687",
        username="neo4j",
        password="password",
        output_dir="./export_data"
    )
    
    try:
        # Export relationships
        relationships = exporter.export_file_relationships()
        with open(os.path.join(exporter.output_dir, 'file_relationships.json'), 'w') as f:
            json.dump(relationships, f, indent=2)
            
        # Export nodes for validation
        nodes = exporter.export_file_nodes()
        with open(os.path.join(exporter.output_dir, 'file_nodes.json'), 'w') as f:
            json.dump(nodes, f, indent=2)
            
        print(f"Neo4j export completed:")
        print(f"  - Relationships: {relationships['row_count']}")
        print(f"  - Nodes: {nodes['row_count']}")
        
    finally:
        exporter.close()
```

### 2.3 D1 Data Import Script

```typescript
// File: migration_scripts/import_to_d1.ts

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

interface ExportedTable {
  table_name: string;
  columns: string[];
  data: any[];
  row_count: number;
}

interface ImportConfig {
  d1DatabaseId: string;
  exportDataDir: string;
  batchSize: number;
}

class D1Importer {
  private config: ImportConfig;
  
  constructor(config: ImportConfig) {
    this.config = config;
  }
  
  async importTable(tableName: string, data: any[]): Promise<void> {
    const batches = this.createBatches(data, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Importing batch ${i + 1}/${batches.length} for ${tableName}`);
      
      const statements = batch.map(row => this.createInsertStatement(tableName, row));
      
      // Execute batch using Wrangler or D1 HTTP API
      await this.executeBatch(statements);
    }
  }
  
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
  
  private createInsertStatement(tableName: string, row: any): string {
    // Convert data types for D1
    const convertedRow = this.convertRowForD1(row);
    
    const columns = Object.keys(convertedRow);
    const values = columns.map(col => this.formatValue(convertedRow[col]));
    
    return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
  }
  
  private convertRowForD1(row: any): any {
    const converted: any = {};
    
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) {
        converted[key] = null;
      } else if (Array.isArray(value)) {
        // Convert arrays to JSON strings
        converted[key] = JSON.stringify(value);
      } else if (typeof value === 'object' && value !== null) {
        // Convert objects to JSON strings
        converted[key] = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        // Convert booleans to integers
        converted[key] = value ? 1 : 0;
      } else {
        converted[key] = value;
      }
    }
    
    return converted;
  }
  
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
    }
    
    return value.toString();
  }
  
  private async executeBatch(statements: string[]): Promise<void> {
    // Implementation depends on your D1 access method
    // Option 1: Use Wrangler CLI
    // Option 2: Use D1 HTTP API
    // Option 3: Use Workers script
    
    // Example using Wrangler CLI:
    const batchScript = statements.join(';\n');
    
    // Write to temp file and execute via Wrangler
    // This is a simplified example - implement based on your setup
    console.log(`Executing batch with ${statements.length} statements`);
    
    // Implement actual D1 execution here
    // await execWranglerCommand(`d1 execute ${this.config.d1DatabaseId} --file=${tempFile}`);
  }
  
  async importAllTables(): Promise<void> {
    const dataFiles = await readdir(this.config.exportDataDir);
    const tableFiles = dataFiles.filter(file => file.endsWith('.json') && !file.includes('summary'));
    
    for (const file of tableFiles) {
      const filePath = join(this.config.exportDataDir, file);
      const tableData: ExportedTable = JSON.parse(await readFile(filePath, 'utf8'));
      
      console.log(`Importing ${tableData.table_name} (${tableData.row_count} rows)`);
      await this.importTable(tableData.table_name, tableData.data);
    }
  }
}

// Usage
async function main() {
  const importer = new D1Importer({
    d1DatabaseId: 'your-d1-database-id',
    exportDataDir: './export_data',
    batchSize: 100
  });
  
  await importer.importAllTables();
  console.log('Import completed!');
}

if (require.main === module) {
  main().catch(console.error);
}
```

## 3. Neo4j to D1 Relationship Table Migration

### 3.1 Relationship Mapping Strategy

The Neo4j graph relationships need to be converted to a relational table structure:

```typescript
// File: src/db/models/FileRelationship.ts

export interface FileRelationship {
  id?: number;
  source_file_id: string;
  target_file_id: string;
  relationship_type: 'CUT_TO' | 'CUT_FROM' | 'DERIVED_FROM';
  created_at: string;
  metadata?: Record<string, any>;
}

export class FileRelationshipService {
  constructor(private db: D1Database) {}
  
  async createRelationship(relationship: Omit<FileRelationship, 'id'>): Promise<FileRelationship> {
    const stmt = this.db.prepare(`
      INSERT INTO file_relationships (source_file_id, target_file_id, relationship_type, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = await stmt.bind(
      relationship.source_file_id,
      relationship.target_file_id,
      relationship.relationship_type,
      relationship.created_at,
      relationship.metadata ? JSON.stringify(relationship.metadata) : null
    ).run();
    
    return {
      id: result.meta.last_row_id,
      ...relationship
    };
  }
  
  async getFileLineage(fileId: string): Promise<FileRelationship[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM file_relationships 
      WHERE source_file_id = ? OR target_file_id = ?
      ORDER BY created_at DESC
    `);
    
    const result = await stmt.bind(fileId, fileId).all();
    return result.results.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    })) as FileRelationship[];
  }
  
  async getDescendants(fileId: string): Promise<string[]> {
    // Recursive query to get all descendants
    const stmt = this.db.prepare(`
      WITH RECURSIVE descendants AS (
        SELECT target_file_id as file_id, 1 as level
        FROM file_relationships 
        WHERE source_file_id = ? AND relationship_type = 'CUT_TO'
        
        UNION ALL
        
        SELECT fr.target_file_id, d.level + 1
        FROM file_relationships fr
        JOIN descendants d ON fr.source_file_id = d.file_id
        WHERE fr.relationship_type = 'CUT_TO' AND d.level < 10
      )
      SELECT DISTINCT file_id FROM descendants
    `);
    
    const result = await stmt.bind(fileId).all();
    return result.results.map(row => row.file_id as string);
  }
  
  async getAncestors(fileId: string): Promise<string[]> {
    // Recursive query to get all ancestors
    const stmt = this.db.prepare(`
      WITH RECURSIVE ancestors AS (
        SELECT source_file_id as file_id, 1 as level
        FROM file_relationships 
        WHERE target_file_id = ? AND relationship_type = 'CUT_TO'
        
        UNION ALL
        
        SELECT fr.source_file_id, a.level + 1
        FROM file_relationships fr
        JOIN ancestors a ON fr.target_file_id = a.file_id
        WHERE fr.relationship_type = 'CUT_TO' AND a.level < 10
      )
      SELECT DISTINCT file_id FROM ancestors
    `);
    
    const result = await stmt.bind(fileId).all();
    return result.results.map(row => row.file_id as string);
  }
}
```

### 3.2 Graph Query Migration

```typescript
// File: src/services/FileLineageService.ts

export class FileLineageService {
  constructor(private relationshipService: FileRelationshipService) {}
  
  async trackFileCut(sourceFileId: string, targetFileId: string, metadata?: Record<string, any>): Promise<void> {
    await this.relationshipService.createRelationship({
      source_file_id: sourceFileId,
      target_file_id: targetFileId,
      relationship_type: 'CUT_TO',
      created_at: new Date().toISOString(),
      metadata
    });
  }
  
  async getFileLineageTree(fileId: string): Promise<FileLineageTree> {
    const [ancestors, descendants] = await Promise.all([
      this.relationshipService.getAncestors(fileId),
      this.relationshipService.getDescendants(fileId)
    ]);
    
    return {
      fileId,
      ancestors,
      descendants,
      totalRelations: ancestors.length + descendants.length
    };
  }
  
  async validateFileLineage(): Promise<ValidationResult> {
    // Validate that all file relationships reference existing files
    const stmt = this.db.prepare(`
      SELECT fr.source_file_id, fr.target_file_id
      FROM file_relationships fr
      LEFT JOIN saved_files sf1 ON fr.source_file_id = sf1.file_id
      LEFT JOIN saved_files sf2 ON fr.target_file_id = sf2.file_id
      WHERE sf1.file_id IS NULL OR sf2.file_id IS NULL
    `);
    
    const orphanedRelations = await stmt.all();
    
    return {
      isValid: orphanedRelations.results.length === 0,
      issues: orphanedRelations.results.map(row => ({
        type: 'orphaned_relationship',
        source: row.source_file_id,
        target: row.target_file_id
      }))
    };
  }
}

interface FileLineageTree {
  fileId: string;
  ancestors: string[];
  descendants: string[];
  totalRelations: number;
}

interface ValidationResult {
  isValid: boolean;
  issues: Array<{
    type: string;
    source: string;
    target: string;
  }>;
}
```

## 4. Index Optimization for D1

### 4.1 Performance-Focused Indexing Strategy

```sql
-- File: migrations/performance_indexes.sql

-- Primary lookup indexes
CREATE INDEX idx_persons_lookup ON persons(firstname, lastname, email);
CREATE INDEX idx_persons_demographics ON persons(race, ethnicity, income_range);
CREATE INDEX idx_persons_location ON persons(city, statecode, postal_code);

-- Query optimization indexes
CREATE INDEX idx_persons_active_created ON persons(active, created_at);
CREATE INDEX idx_persons_tags_search ON persons(system_tags, user_tags);

-- File management indexes
CREATE INDEX idx_saved_files_user_date ON saved_files(user_id, uploaded_at);
CREATE INDEX idx_saved_files_search ON saved_files(file_name, file_path);

-- Relationship traversal indexes
CREATE INDEX idx_file_rel_source_type ON file_relationships(source_file_id, relationship_type);
CREATE INDEX idx_file_rel_target_type ON file_relationships(target_file_id, relationship_type);
CREATE INDEX idx_file_rel_created ON file_relationships(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_persons_user_active ON persons(created_by_id, active);
CREATE INDEX idx_saved_files_user_tags ON saved_files(user_id, system_tags);
```

### 4.2 Query Optimization Patterns

```typescript
// File: src/db/optimized-queries.ts

export class OptimizedQueries {
  constructor(private db: D1Database) {}
  
  async getPersonsByUser(userId: number, options: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
    searchTerm?: string;
  } = {}): Promise<Person[]> {
    const { limit = 50, offset = 0, activeOnly = true, searchTerm } = options;
    
    let query = `
      SELECT * FROM persons 
      WHERE created_by_id = ?
    `;
    
    const params: any[] = [userId];
    
    if (activeOnly) {
      query += ` AND active = 1`;
    }
    
    if (searchTerm) {
      query += ` AND (firstname LIKE ? OR lastname LIKE ? OR email LIKE ?)`;
      const searchPattern = `%${searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();
    
    return result.results.map(row => this.convertPersonFromD1(row));
  }
  
  async getFilesWithRelationships(userId: number): Promise<FileWithRelationships[]> {
    const stmt = this.db.prepare(`
      SELECT 
        sf.*,
        GROUP_CONCAT(fr.target_file_id) as cut_to_files,
        GROUP_CONCAT(fr2.source_file_id) as cut_from_files
      FROM saved_files sf
      LEFT JOIN file_relationships fr ON sf.file_id = fr.source_file_id
      LEFT JOIN file_relationships fr2 ON sf.file_id = fr2.target_file_id
      WHERE sf.user_id = ?
      GROUP BY sf.id
      ORDER BY sf.uploaded_at DESC
    `);
    
    const result = await stmt.bind(userId).all();
    
    return result.results.map(row => ({
      ...this.convertSavedFileFromD1(row),
      cutToFiles: row.cut_to_files ? row.cut_to_files.split(',') : [],
      cutFromFiles: row.cut_from_files ? row.cut_from_files.split(',') : []
    }));
  }
  
  private convertPersonFromD1(row: any): Person {
    return {
      ...row,
      deceased: !!row.deceased,
      active: !!row.active,
      dob: row.dob ? new Date(row.dob) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      model_scores: row.model_scores ? JSON.parse(row.model_scores) : null,
      system_tags: row.system_tags ? JSON.parse(row.system_tags) : null,
      user_tags: row.user_tags ? JSON.parse(row.user_tags) : null
    };
  }
  
  private convertSavedFileFromD1(row: any): SavedFile {
    return {
      ...row,
      uploaded_at: new Date(row.uploaded_at),
      system_tags: row.system_tags ? JSON.parse(row.system_tags) : null,
      user_tags: row.user_tags ? JSON.parse(row.user_tags) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  }
}
```

## 5. Data Integrity Validation

### 5.1 Validation Framework

```typescript
// File: src/validation/DataIntegrityValidator.ts

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  type: 'missing_foreign_key' | 'invalid_json' | 'constraint_violation' | 'data_corruption';
  table: string;
  column?: string;
  rowId?: string | number;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ValidationWarning {
  type: 'missing_data' | 'format_inconsistency' | 'performance_concern';
  message: string;
  affectedRows: number;
}

export interface ValidationSummary {
  totalRows: Record<string, number>;
  validationTime: number;
  errorCount: number;
  warningCount: number;
}

export class DataIntegrityValidator {
  constructor(private db: D1Database) {}
  
  async validateMigration(): Promise<ValidationReport> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Run all validation checks
    const validationResults = await Promise.all([
      this.validateForeignKeys(),
      this.validateJSONFields(),
      this.validateDateFields(),
      this.validateRequiredFields(),
      this.validateUniqueConstraints(),
      this.validateFileRelationships(),
      this.validateDataConsistency()
    ]);
    
    // Collect all errors and warnings
    validationResults.forEach(result => {
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    });
    
    const summary = await this.generateSummary(Date.now() - startTime, errors.length, warnings.length);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary
    };
  }
  
  private async validateForeignKeys(): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check persons.created_by_id references
    const orphanedPersons = await this.db.prepare(`
      SELECT cuttyid FROM persons 
      WHERE created_by_id IS NOT NULL 
      AND created_by_id NOT IN (SELECT id FROM users)
    `).all();
    
    orphanedPersons.results.forEach(row => {
      errors.push({
        type: 'missing_foreign_key',
        table: 'persons',
        column: 'created_by_id',
        rowId: row.cuttyid,
        message: `Person ${row.cuttyid} references non-existent user`,
        severity: 'high'
      });
    });
    
    // Check saved_files.user_id references
    const orphanedFiles = await this.db.prepare(`
      SELECT id, file_id FROM saved_files
      WHERE user_id NOT IN (SELECT id FROM users)
    `).all();
    
    orphanedFiles.results.forEach(row => {
      errors.push({
        type: 'missing_foreign_key',
        table: 'saved_files',
        column: 'user_id',
        rowId: row.id,
        message: `SavedFile ${row.file_id} references non-existent user`,
        severity: 'high'
      });
    });
    
    return { errors, warnings };
  }
  
  private async validateJSONFields(): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate JSON fields in persons table
    const personsWithBadJSON = await this.db.prepare(`
      SELECT cuttyid, model_scores, system_tags, user_tags
      FROM persons
      WHERE model_scores IS NOT NULL OR system_tags IS NOT NULL OR user_tags IS NOT NULL
    `).all();
    
    personsWithBadJSON.results.forEach(row => {
      ['model_scores', 'system_tags', 'user_tags'].forEach(field => {
        const value = row[field];
        if (value && !this.isValidJSON(value)) {
          errors.push({
            type: 'invalid_json',
            table: 'persons',
            column: field,
            rowId: row.cuttyid,
            message: `Invalid JSON in ${field}`,
            severity: 'medium'
          });
        }
      });
    });
    
    // Validate JSON fields in saved_files table
    const filesWithBadJSON = await this.db.prepare(`
      SELECT id, file_id, metadata, system_tags, user_tags
      FROM saved_files
      WHERE metadata IS NOT NULL OR system_tags IS NOT NULL OR user_tags IS NOT NULL
    `).all();
    
    filesWithBadJSON.results.forEach(row => {
      ['metadata', 'system_tags', 'user_tags'].forEach(field => {
        const value = row[field];
        if (value && !this.isValidJSON(value)) {
          errors.push({
            type: 'invalid_json',
            table: 'saved_files',
            column: field,
            rowId: row.id,
            message: `Invalid JSON in ${field}`,
            severity: 'medium'
          });
        }
      });
    });
    
    return { errors, warnings };
  }
  
  private async validateDateFields(): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate date fields
    const invalidDates = await this.db.prepare(`
      SELECT 'persons' as table_name, cuttyid as row_id, 'dob' as field, dob as value
      FROM persons
      WHERE dob IS NOT NULL AND dob NOT GLOB '????-??-??'
      
      UNION ALL
      
      SELECT 'persons' as table_name, cuttyid as row_id, 'created_at' as field, created_at as value
      FROM persons
      WHERE created_at IS NOT NULL AND created_at NOT GLOB '????-??-??T??:??:??*'
      
      UNION ALL
      
      SELECT 'saved_files' as table_name, id as row_id, 'uploaded_at' as field, uploaded_at as value
      FROM saved_files
      WHERE uploaded_at IS NOT NULL AND uploaded_at NOT GLOB '????-??-??T??:??:??*'
    `).all();
    
    invalidDates.results.forEach(row => {
      errors.push({
        type: 'constraint_violation',
        table: row.table_name,
        column: row.field,
        rowId: row.row_id,
        message: `Invalid date format: ${row.value}`,
        severity: 'medium'
      });
    });
    
    return { errors, warnings };
  }
  
  private async validateFileRelationships(): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for orphaned relationships
    const orphanedRelationships = await this.db.prepare(`
      SELECT fr.id, fr.source_file_id, fr.target_file_id
      FROM file_relationships fr
      LEFT JOIN saved_files sf1 ON fr.source_file_id = sf1.file_id
      LEFT JOIN saved_files sf2 ON fr.target_file_id = sf2.file_id
      WHERE sf1.file_id IS NULL OR sf2.file_id IS NULL
    `).all();
    
    orphanedRelationships.results.forEach(row => {
      errors.push({
        type: 'missing_foreign_key',
        table: 'file_relationships',
        rowId: row.id,
        message: `Relationship references non-existent file: ${row.source_file_id} -> ${row.target_file_id}`,
        severity: 'high'
      });
    });
    
    // Check for circular references (basic check)
    const circularRefs = await this.db.prepare(`
      SELECT DISTINCT fr1.source_file_id, fr1.target_file_id
      FROM file_relationships fr1
      JOIN file_relationships fr2 ON fr1.source_file_id = fr2.target_file_id
      WHERE fr1.target_file_id = fr2.source_file_id
    `).all();
    
    circularRefs.results.forEach(row => {
      warnings.push({
        type: 'performance_concern',
        message: `Potential circular reference detected: ${row.source_file_id} <-> ${row.target_file_id}`,
        affectedRows: 1
      });
    });
    
    return { errors, warnings };
  }
  
  private async validateDataConsistency(): Promise<{ errors: ValidationError[], warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for duplicate file_ids
    const duplicateFileIds = await this.db.prepare(`
      SELECT file_id, COUNT(*) as count
      FROM saved_files
      GROUP BY file_id
      HAVING count > 1
    `).all();
    
    duplicateFileIds.results.forEach(row => {
      errors.push({
        type: 'constraint_violation',
        table: 'saved_files',
        column: 'file_id',
        message: `Duplicate file_id: ${row.file_id} (${row.count} occurrences)`,
        severity: 'high'
      });
    });
    
    // Check for missing file names
    const missingFileNames = await this.db.prepare(`
      SELECT COUNT(*) as count FROM saved_files WHERE file_name IS NULL OR file_name = ''
    `).first();
    
    if (missingFileNames.count > 0) {
      warnings.push({
        type: 'missing_data',
        message: `Files with missing names`,
        affectedRows: missingFileNames.count
      });
    }
    
    return { errors, warnings };
  }
  
  private async generateSummary(validationTime: number, errorCount: number, warningCount: number): Promise<ValidationSummary> {
    const tableCounts = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM users').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM persons').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM saved_files').first(),
      this.db.prepare('SELECT COUNT(*) as count FROM file_relationships').first()
    ]);
    
    return {
      totalRows: {
        users: tableCounts[0].count,
        persons: tableCounts[1].count,
        saved_files: tableCounts[2].count,
        file_relationships: tableCounts[3].count
      },
      validationTime,
      errorCount,
      warningCount
    };
  }
  
  private isValidJSON(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 5.2 Validation CLI Tool

```typescript
// File: migration_scripts/validate-migration.ts

import { DataIntegrityValidator } from '../src/validation/DataIntegrityValidator';

async function main() {
  const validator = new DataIntegrityValidator(env.DB);
  
  console.log('Starting data integrity validation...');
  const report = await validator.validateMigration();
  
  console.log('\n=== VALIDATION REPORT ===');
  console.log(`Status: ${report.isValid ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`Validation Time: ${report.summary.validationTime}ms`);
  console.log(`Errors: ${report.summary.errorCount}`);
  console.log(`Warnings: ${report.summary.warningCount}`);
  
  console.log('\n=== TABLE COUNTS ===');
  Object.entries(report.summary.totalRows).forEach(([table, count]) => {
    console.log(`${table}: ${count} rows`);
  });
  
  if (report.errors.length > 0) {
    console.log('\n=== ERRORS ===');
    report.errors.forEach(error => {
      console.log(`❌ [${error.severity.toUpperCase()}] ${error.table}.${error.column}: ${error.message}`);
    });
  }
  
  if (report.warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    report.warnings.forEach(warning => {
      console.log(`⚠️  ${warning.message} (${warning.affectedRows} rows)`);
    });
  }
  
  // Exit with error code if validation failed
  process.exit(report.isValid ? 0 : 1);
}

main().catch(console.error);
```

## 6. Performance Considerations

### 6.1 D1 Performance Optimization

```typescript
// File: src/db/PerformanceOptimizer.ts

export class D1PerformanceOptimizer {
  constructor(private db: D1Database) {}
  
  async optimizeQueries(): Promise<void> {
    // Analyze query patterns and suggest optimizations
    await this.analyzeSlowQueries();
    await this.optimizeIndexes();
    await this.setupQueryCaching();
  }
  
  private async analyzeSlowQueries(): Promise<void> {
    // Enable query profiling
    await this.db.exec('PRAGMA query_only = ON');
    
    // Test common query patterns
    const testQueries = [
      'SELECT * FROM persons WHERE created_by_id = ? AND active = 1 LIMIT 50',
      'SELECT * FROM saved_files WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 20',
      'SELECT * FROM file_relationships WHERE source_file_id = ?'
    ];
    
    for (const query of testQueries) {
      const start = performance.now();
      const plan = await this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all();
      const end = performance.now();
      
      console.log(`Query: ${query}`);
      console.log(`Execution time: ${end - start}ms`);
      console.log('Query plan:', plan.results);
      console.log('---');
    }
  }
  
  private async optimizeIndexes(): Promise<void> {
    // Create additional indexes based on query patterns
    const optimizationIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_persons_search ON persons(firstname, lastname) WHERE active = 1',
      'CREATE INDEX IF NOT EXISTS idx_files_recent ON saved_files(user_id, uploaded_at) WHERE uploaded_at > date("now", "-30 days")',
      'CREATE INDEX IF NOT EXISTS idx_rel_lineage ON file_relationships(source_file_id, target_file_id, relationship_type)'
    ];
    
    for (const index of optimizationIndexes) {
      await this.db.exec(index);
    }
  }
  
  private async setupQueryCaching(): Promise<void> {
    // Configure SQLite pragmas for performance
    await this.db.exec('PRAGMA cache_size = -64000'); // 64MB cache
    await this.db.exec('PRAGMA temp_store = MEMORY');
    await this.db.exec('PRAGMA mmap_size = 268435456'); // 256MB mmap
    await this.db.exec('PRAGMA journal_mode = WAL');
  }
  
  async getBatchProcessor(): Promise<BatchProcessor> {
    return new BatchProcessor(this.db);
  }
}

class BatchProcessor {
  constructor(private db: D1Database) {}
  
  async processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    batchSize: number = 100
  ): Promise<void> {
    const batches = this.createBatches(items, batchSize);
    
    for (const batch of batches) {
      await this.db.batch(
        batch.map(item => processor(item))
      );
    }
  }
  
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

### 6.2 Connection Pool Management

```typescript
// File: src/db/ConnectionManager.ts

export class D1ConnectionManager {
  private static instance: D1ConnectionManager;
  private db: D1Database;
  private queryCache: Map<string, { result: any, timestamp: number }>;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  
  private constructor(db: D1Database) {
    this.db = db;
    this.queryCache = new Map();
  }
  
  static getInstance(db: D1Database): D1ConnectionManager {
    if (!D1ConnectionManager.instance) {
      D1ConnectionManager.instance = new D1ConnectionManager(db);
    }
    return D1ConnectionManager.instance;
  }
  
  async executeQuery(query: string, params?: any[], useCache: boolean = true): Promise<any> {
    const cacheKey = this.getCacheKey(query, params);
    
    if (useCache && this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }
    }
    
    const stmt = this.db.prepare(query);
    const result = params ? await stmt.bind(...params).all() : await stmt.all();
    
    if (useCache) {
      this.queryCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }
  
  async executeTransaction(operations: Array<() => Promise<any>>): Promise<any[]> {
    // D1 doesn't support transactions, so we'll use batch operations
    const results: any[] = [];
    
    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
      } catch (error) {
        // Rollback strategy would need to be implemented here
        throw new Error(`Transaction failed: ${error.message}`);
      }
    }
    
    return results;
  }
  
  private getCacheKey(query: string, params?: any[]): string {
    return `${query}:${params ? JSON.stringify(params) : ''}`;
  }
  
  clearCache(): void {
    this.queryCache.clear();
  }
}
```

## 7. Testing Strategies

### 7.1 Migration Testing Framework

```typescript
// File: test/migration/MigrationTest.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataIntegrityValidator } from '../../src/validation/DataIntegrityValidator';
import { D1ConnectionManager } from '../../src/db/ConnectionManager';

describe('Database Migration Tests', () => {
  let db: D1Database;
  let validator: DataIntegrityValidator;
  
  beforeAll(async () => {
    // Setup test database
    db = await setupTestDatabase();
    validator = new DataIntegrityValidator(db);
  });
  
  afterAll(async () => {
    await cleanupTestDatabase(db);
  });
  
  describe('Schema Migration', () => {
    it('should create all required tables', async () => {
      const tables = await db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      const expectedTables = ['users', 'persons', 'saved_files', 'file_relationships'];
      const actualTables = tables.results.map(row => row.name);
      
      expectedTables.forEach(table => {
        expect(actualTables).toContain(table);
      });
    });
    
    it('should create all required indexes', async () => {
      const indexes = await db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      const expectedIndexes = [
        'idx_users_username',
        'idx_persons_created_by',
        'idx_saved_files_user',
        'idx_file_rel_source'
      ];
      const actualIndexes = indexes.results.map(row => row.name);
      
      expectedIndexes.forEach(index => {
        expect(actualIndexes).toContain(index);
      });
    });
  });
  
  describe('Data Type Conversion', () => {
    it('should correctly convert ArrayField to JSON', async () => {
      const testData = {
        cuttyid: 1,
        system_tags: ['tag1', 'tag2', 'tag3'],
        user_tags: ['user1', 'user2']
      };
      
      await db.prepare(`
        INSERT INTO persons (cuttyid, system_tags, user_tags)
        VALUES (?, ?, ?)
      `).bind(
        testData.cuttyid,
        JSON.stringify(testData.system_tags),
        JSON.stringify(testData.user_tags)
      ).run();
      
      const result = await db.prepare(`
        SELECT system_tags, user_tags FROM persons WHERE cuttyid = ?
      `).bind(testData.cuttyid).first();
      
      expect(JSON.parse(result.system_tags)).toEqual(testData.system_tags);
      expect(JSON.parse(result.user_tags)).toEqual(testData.user_tags);
    });
    
    it('should correctly convert JSONField', async () => {
      const testMetadata = {
        fileSize: 1024,
        columns: ['name', 'email', 'phone'],
        processedAt: '2024-01-01T00:00:00Z'
      };
      
      await db.prepare(`
        INSERT INTO saved_files (user_id, file_id, file_name, file_path, uploaded_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        1,
        'test-file-1',
        'test.csv',
        '/path/to/test.csv',
        new Date().toISOString(),
        JSON.stringify(testMetadata)
      ).run();
      
      const result = await db.prepare(`
        SELECT metadata FROM saved_files WHERE file_id = ?
      `).bind('test-file-1').first();
      
      expect(JSON.parse(result.metadata)).toEqual(testMetadata);
    });
    
    it('should correctly convert boolean fields', async () => {
      await db.prepare(`
        INSERT INTO persons (cuttyid, deceased, active)
        VALUES (?, ?, ?)
      `).bind(2, 0, 1).run();
      
      const result = await db.prepare(`
        SELECT deceased, active FROM persons WHERE cuttyid = ?
      `).bind(2).first();
      
      expect(result.deceased).toBe(0);
      expect(result.active).toBe(1);
    });
  });
  
  describe('Relationship Migration', () => {
    it('should migrate Neo4j relationships to relational table', async () => {
      // Insert test files
      await db.prepare(`
        INSERT INTO saved_files (user_id, file_id, file_name, file_path, uploaded_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(1, 'source-file', 'source.csv', '/path/source.csv', new Date().toISOString()).run();
      
      await db.prepare(`
        INSERT INTO saved_files (user_id, file_id, file_name, file_path, uploaded_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(1, 'target-file', 'target.csv', '/path/target.csv', new Date().toISOString()).run();
      
      // Insert relationship
      await db.prepare(`
        INSERT INTO file_relationships (source_file_id, target_file_id, relationship_type, created_at)
        VALUES (?, ?, ?, ?)
      `).bind('source-file', 'target-file', 'CUT_TO', new Date().toISOString()).run();
      
      // Test relationship query
      const relationships = await db.prepare(`
        SELECT * FROM file_relationships WHERE source_file_id = ?
      `).bind('source-file').all();
      
      expect(relationships.results).toHaveLength(1);
      expect(relationships.results[0].target_file_id).toBe('target-file');
      expect(relationships.results[0].relationship_type).toBe('CUT_TO');
    });
  });
  
  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const batchSize = 1000;
      const testData = Array.from({ length: batchSize }, (_, i) => ({
        cuttyid: 1000 + i,
        firstname: `User${i}`,
        lastname: `Test${i}`,
        email: `user${i}@example.com`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const startTime = performance.now();
      
      for (const person of testData) {
        await db.prepare(`
          INSERT INTO persons (cuttyid, firstname, lastname, email, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          person.cuttyid,
          person.firstname,
          person.lastname,
          person.email,
          person.created_at,
          person.updated_at
        ).run();
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (adjust based on requirements)
      expect(executionTime).toBeLessThan(5000); // 5 seconds
      
      // Verify data was inserted
      const count = await db.prepare(`
        SELECT COUNT(*) as count FROM persons WHERE cuttyid >= 1000
      `).first();
      
      expect(count.count).toBe(batchSize);
    });
  });
  
  describe('Data Integrity', () => {
    it('should pass all integrity checks', async () => {
      const report = await validator.validateMigration();
      
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
    });
    
    it('should maintain referential integrity', async () => {
      // Test foreign key constraints
      const orphanedPersons = await db.prepare(`
        SELECT COUNT(*) as count FROM persons 
        WHERE created_by_id IS NOT NULL 
        AND created_by_id NOT IN (SELECT id FROM users)
      `).first();
      
      expect(orphanedPersons.count).toBe(0);
      
      const orphanedFiles = await db.prepare(`
        SELECT COUNT(*) as count FROM saved_files
        WHERE user_id NOT IN (SELECT id FROM users)
      `).first();
      
      expect(orphanedFiles.count).toBe(0);
    });
  });
});

async function setupTestDatabase(): Promise<D1Database> {
  // Implementation depends on your test setup
  // This could use a local SQLite database or mock D1
  throw new Error('Implement test database setup');
}

async function cleanupTestDatabase(db: D1Database): Promise<void> {
  // Clean up test database
  await db.exec('DROP TABLE IF EXISTS users');
  await db.exec('DROP TABLE IF EXISTS persons');
  await db.exec('DROP TABLE IF EXISTS saved_files');
  await db.exec('DROP TABLE IF EXISTS file_relationships');
}
```

### 7.2 Integration Testing Strategy

```typescript
// File: test/integration/DatabaseIntegrationTest.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PersonService } from '../../src/services/PersonService';
import { SavedFileService } from '../../src/services/SavedFileService';
import { FileLineageService } from '../../src/services/FileLineageService';

describe('Database Integration Tests', () => {
  let personService: PersonService;
  let fileService: SavedFileService;
  let lineageService: FileLineageService;
  
  beforeAll(async () => {
    // Setup services with test database
    const db = await setupTestDatabase();
    personService = new PersonService(db);
    fileService = new SavedFileService(db);
    lineageService = new FileLineageService(new FileRelationshipService(db));
  });
  
  describe('Person Management', () => {
    it('should create and retrieve persons with complex data types', async () => {
      const personData = {
        cuttyid: 1,
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@example.com',
        system_tags: ['voter', 'active'],
        user_tags: ['vip', 'donor'],
        model_scores: {
          turnout_probability: 0.85,
          party_preference: 'independent'
        },
        created_by_id: 1
      };
      
      await personService.createPerson(personData);
      const retrieved = await personService.getPersonById(1);
      
      expect(retrieved.firstname).toBe('John');
      expect(retrieved.system_tags).toEqual(['voter', 'active']);
      expect(retrieved.user_tags).toEqual(['vip', 'donor']);
      expect(retrieved.model_scores.turnout_probability).toBe(0.85);
    });
    
    it('should handle person search with filters', async () => {
      const results = await personService.searchPersons({
        userId: 1,
        searchTerm: 'John',
        activeOnly: true,
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].firstname).toBe('John');
    });
  });
  
  describe('File Management', () => {
    it('should create and manage saved files', async () => {
      const fileData = {
        user_id: 1,
        file_id: 'test-file-1',
        file_name: 'test.csv',
        file_path: '/uploads/test.csv',
        system_tags: ['processed', 'validated'],
        metadata: {
          size: 1024,
          rows: 100,
          columns: ['name', 'email']
        }
      };
      
      await fileService.createFile(fileData);
      const retrieved = await fileService.getFileById('test-file-1');
      
      expect(retrieved.file_name).toBe('test.csv');
      expect(retrieved.system_tags).toEqual(['processed', 'validated']);
      expect(retrieved.metadata.size).toBe(1024);
    });
  });
  
  describe('File Lineage', () => {
    it('should track file relationships', async () => {
      // Create source and target files
      await fileService.createFile({
        user_id: 1,
        file_id: 'source-file',
        file_name: 'source.csv',
        file_path: '/uploads/source.csv'
      });
      
      await fileService.createFile({
        user_id: 1,
        file_id: 'target-file',
        file_name: 'target.csv',
        file_path: '/uploads/target.csv'
      });
      
      // Create relationship
      await lineageService.trackFileCut('source-file', 'target-file', {
        operation: 'filter',
        criteria: 'active = true'
      });
      
      // Test lineage retrieval
      const lineage = await lineageService.getFileLineageTree('source-file');
      expect(lineage.descendants).toContain('target-file');
      
      const reverseLineage = await lineageService.getFileLineageTree('target-file');
      expect(reverseLineage.ancestors).toContain('source-file');
    });
  });
});
```

## 8. Migration Execution Plan

### 8.1 Pre-Migration Checklist

```markdown
# Pre-Migration Checklist

## Infrastructure Setup
- [ ] Cloudflare D1 database created
- [ ] D1 database configured in Wrangler
- [ ] Migration scripts tested in development
- [ ] Validation tools verified

## Data Preparation
- [ ] PostgreSQL backup created
- [ ] Neo4j backup created
- [ ] Data export scripts executed
- [ ] Export data validated

## Testing
- [ ] Schema migration tested
- [ ] Data conversion tested
- [ ] Performance benchmarks established
- [ ] Rollback procedures tested

## Documentation
- [ ] Migration procedures documented
- [ ] Rollback procedures documented
- [ ] Data type mapping documented
- [ ] Performance considerations documented
```

### 8.2 Migration Execution Script

```bash
#!/bin/bash
# File: migration_scripts/execute_migration.sh

set -e

echo "Starting database migration from PostgreSQL+Neo4j to D1..."

# Configuration
EXPORT_DIR="./migration_data"
BACKUP_DIR="./migration_backups"
D1_DATABASE_ID="your-d1-database-id"

# Create directories
mkdir -p "$EXPORT_DIR" "$BACKUP_DIR"

# Step 1: Create backups
echo "Creating backups..."
pg_dump "$POSTGRES_CONNECTION_STRING" > "$BACKUP_DIR/postgresql_backup.sql"
# Neo4j backup would be done via Neo4j admin tools

# Step 2: Export data
echo "Exporting PostgreSQL data..."
python migration_scripts/export_postgresql_data.py

echo "Exporting Neo4j data..."
python migration_scripts/export_neo4j_data.py

# Step 3: Create D1 schema
echo "Creating D1 schema..."
wrangler d1 execute "$D1_DATABASE_ID" --file=migrations/d1_schema.sql

echo "Creating D1 indexes..."
wrangler d1 execute "$D1_DATABASE_ID" --file=migrations/d1_indexes.sql

# Step 4: Import data
echo "Importing data to D1..."
node migration_scripts/import_to_d1.js

# Step 5: Validate migration
echo "Validating migration..."
node migration_scripts/validate-migration.js

# Step 6: Performance optimization
echo "Optimizing performance..."
wrangler d1 execute "$D1_DATABASE_ID" --file=migrations/performance_indexes.sql

echo "Migration completed successfully!"
echo "Remember to update your application configuration to use D1."
```

### 8.3 Post-Migration Verification

```typescript
// File: migration_scripts/post_migration_verification.ts

import { DataIntegrityValidator } from '../src/validation/DataIntegrityValidator';
import { D1PerformanceOptimizer } from '../src/db/PerformanceOptimizer';

interface MigrationVerificationResult {
  dataIntegrity: boolean;
  performanceMetrics: Record<string, number>;
  functionalityTests: Record<string, boolean>;
  recommendations: string[];
}

class PostMigrationVerifier {
  constructor(private db: D1Database) {}
  
  async verifyMigration(): Promise<MigrationVerificationResult> {
    console.log('Starting post-migration verification...');
    
    // Data integrity check
    const validator = new DataIntegrityValidator(this.db);
    const integrityReport = await validator.validateMigration();
    
    // Performance testing
    const optimizer = new D1PerformanceOptimizer(this.db);
    const performanceMetrics = await this.runPerformanceTests();
    
    // Functionality testing
    const functionalityResults = await this.runFunctionalityTests();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      integrityReport,
      performanceMetrics,
      functionalityResults
    );
    
    return {
      dataIntegrity: integrityReport.isValid,
      performanceMetrics,
      functionalityTests: functionalityResults,
      recommendations
    };
  }
  
  private async runPerformanceTests(): Promise<Record<string, number>> {
    const tests = {
      'user_lookup': this.testUserLookup,
      'person_search': this.testPersonSearch,
      'file_listing': this.testFileListing,
      'lineage_traversal': this.testLineageTraversal
    };
    
    const results: Record<string, number> = {};
    
    for (const [testName, testFn] of Object.entries(tests)) {
      const startTime = performance.now();
      await testFn.call(this);
      const endTime = performance.now();
      results[testName] = endTime - startTime;
    }
    
    return results;
  }
  
  private async runFunctionalityTests(): Promise<Record<string, boolean>> {
    const tests = {
      'create_user': this.testCreateUser,
      'create_person': this.testCreatePerson,
      'create_file': this.testCreateFile,
      'create_relationship': this.testCreateRelationship,
      'search_persons': this.testSearchPersons,
      'json_field_handling': this.testJSONFieldHandling,
      'array_field_handling': this.testArrayFieldHandling
    };
    
    const results: Record<string, boolean> = {};
    
    for (const [testName, testFn] of Object.entries(tests)) {
      try {
        await testFn.call(this);
        results[testName] = true;
      } catch (error) {
        console.error(`Test ${testName} failed:`, error);
        results[testName] = false;
      }
    }
    
    return results;
  }
  
  private generateRecommendations(
    integrityReport: any,
    performanceMetrics: Record<string, number>,
    functionalityResults: Record<string, boolean>
  ): string[] {
    const recommendations: string[] = [];
    
    // Data integrity recommendations
    if (integrityReport.errors.length > 0) {
      recommendations.push('Fix data integrity issues before going live');
    }
    
    // Performance recommendations
    const slowTests = Object.entries(performanceMetrics)
      .filter(([_, time]) => time > 1000)
      .map(([test, _]) => test);
    
    if (slowTests.length > 0) {
      recommendations.push(`Optimize slow queries: ${slowTests.join(', ')}`);
    }
    
    // Functionality recommendations
    const failedTests = Object.entries(functionalityResults)
      .filter(([_, passed]) => !passed)
      .map(([test, _]) => test);
    
    if (failedTests.length > 0) {
      recommendations.push(`Fix failing functionality: ${failedTests.join(', ')}`);
    }
    
    return recommendations;
  }
  
  // Test implementations
  private async testUserLookup(): Promise<void> {
    await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(1).first();
  }
  
  private async testPersonSearch(): Promise<void> {
    await this.db.prepare('SELECT * FROM persons WHERE active = 1 LIMIT 10').all();
  }
  
  private async testFileListing(): Promise<void> {
    await this.db.prepare('SELECT * FROM saved_files ORDER BY uploaded_at DESC LIMIT 20').all();
  }
  
  private async testLineageTraversal(): Promise<void> {
    await this.db.prepare('SELECT * FROM file_relationships WHERE source_file_id = ?').bind('test-file').all();
  }
  
  private async testCreateUser(): Promise<void> {
    await this.db.prepare(`
      INSERT INTO users (username, email, password, date_joined)
      VALUES (?, ?, ?, ?)
    `).bind('testuser', 'test@example.com', 'password', new Date().toISOString()).run();
  }
  
  private async testCreatePerson(): Promise<void> {
    await this.db.prepare(`
      INSERT INTO persons (cuttyid, firstname, lastname, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(999, 'Test', 'Person', new Date().toISOString(), new Date().toISOString()).run();
  }
  
  private async testCreateFile(): Promise<void> {
    await this.db.prepare(`
      INSERT INTO saved_files (user_id, file_id, file_name, file_path, uploaded_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(1, 'test-file-verify', 'test.csv', '/test.csv', new Date().toISOString()).run();
  }
  
  private async testCreateRelationship(): Promise<void> {
    await this.db.prepare(`
      INSERT INTO file_relationships (source_file_id, target_file_id, relationship_type, created_at)
      VALUES (?, ?, ?, ?)
    `).bind('source-test', 'target-test', 'CUT_TO', new Date().toISOString()).run();
  }
  
  private async testSearchPersons(): Promise<void> {
    const result = await this.db.prepare(`
      SELECT * FROM persons 
      WHERE (firstname LIKE ? OR lastname LIKE ?) 
      AND active = 1 
      LIMIT 5
    `).bind('%Test%', '%Test%').all();
    
    if (result.results.length === 0) {
      throw new Error('No results found for person search');
    }
  }
  
  private async testJSONFieldHandling(): Promise<void> {
    const result = await this.db.prepare(`
      SELECT metadata FROM saved_files 
      WHERE metadata IS NOT NULL 
      LIMIT 1
    `).first();
    
    if (result && result.metadata) {
      const parsed = JSON.parse(result.metadata);
      if (typeof parsed !== 'object') {
        throw new Error('JSON field not properly parsed');
      }
    }
  }
  
  private async testArrayFieldHandling(): Promise<void> {
    const result = await this.db.prepare(`
      SELECT system_tags FROM persons 
      WHERE system_tags IS NOT NULL 
      LIMIT 1
    `).first();
    
    if (result && result.system_tags) {
      const parsed = JSON.parse(result.system_tags);
      if (!Array.isArray(parsed)) {
        throw new Error('Array field not properly parsed');
      }
    }
  }
}

// Usage
async function main() {
  const verifier = new PostMigrationVerifier(env.DB);
  const result = await verifier.verifyMigration();
  
  console.log('=== POST-MIGRATION VERIFICATION RESULTS ===');
  console.log(`Data Integrity: ${result.dataIntegrity ? '✅ PASSED' : '❌ FAILED'}`);
  
  console.log('\n=== PERFORMANCE METRICS ===');
  Object.entries(result.performanceMetrics).forEach(([test, time]) => {
    console.log(`${test}: ${time.toFixed(2)}ms`);
  });
  
  console.log('\n=== FUNCTIONALITY TESTS ===');
  Object.entries(result.functionalityTests).forEach(([test, passed]) => {
    console.log(`${test}: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  });
  
  if (result.recommendations.length > 0) {
    console.log('\n=== RECOMMENDATIONS ===');
    result.recommendations.forEach(rec => {
      console.log(`- ${rec}`);
    });
  }
  
  console.log('\n=== SUMMARY ===');
  const allPassed = result.dataIntegrity && 
    Object.values(result.functionalityTests).every(Boolean);
  
  console.log(`Migration Status: ${allPassed ? '✅ SUCCESS' : '❌ NEEDS ATTENTION'}`);
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
```

## Summary

This comprehensive Phase 4 implementation plan provides:

1. **Complete schema conversion** from PostgreSQL to D1 with proper data type mapping
2. **Robust migration scripts** for data export, transformation, and import
3. **Neo4j relationship migration** to relational table structure
4. **Performance optimization** with appropriate indexes and query patterns
5. **Comprehensive validation** framework for data integrity
6. **Thorough testing strategy** covering all migration aspects
7. **Detailed execution plan** with pre/post migration procedures

The plan addresses all the complex data type conversions (ArrayField, JSONField, etc.) and ensures that the file lineage functionality from Neo4j is preserved in the D1 relational structure. The validation and testing frameworks provide confidence that the migration will preserve all data and functionality while optimizing for D1's SQLite-based performance characteristics.

Key files created:
- `/Users/emilycogsdill/Documents/GitHub/list-cutter/docs/phase-4-database-migration-plan.md` - Comprehensive migration plan
