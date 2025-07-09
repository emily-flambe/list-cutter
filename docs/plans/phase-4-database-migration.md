# Phase 4: Database Migration - PostgreSQL to Cloudflare D1
**Duration**: 3-4 days  
**Status**: Ready for Implementation

## Overview
This phase migrates the application's data layer from PostgreSQL + Neo4j to Cloudflare D1. The migration involves converting PostgreSQL schema to SQLite, transforming PostgreSQL-specific data types, and replacing Neo4j graph relationships with relational tables while preserving all functionality.

## Prerequisites
- Phase 3 completed (backend migration to Workers)
- D1 database created and configured
- Database migration scripts from Phase 3 implemented
- Workers with D1 bindings configured

## Current Database Architecture Analysis

### PostgreSQL Database
**Current Schema:**
- **Users**: Django's built-in User model
- **SavedFile**: File metadata with PostgreSQL-specific features
  - `ArrayField` for `system_tags` and `user_tags`
  - `JSONField` for metadata
  - Traditional relational foreign keys

### Neo4j Graph Database
**Current Structure:**
- **SavedFileNode**: File nodes with properties
- **Relationships**: `CUT_FROM` and `CUT_TO` relationships
- **Graph Queries**: Complex Cypher queries for lineage traversal

### Migration Challenges
1. **ArrayField → JSON strings**: Convert PostgreSQL arrays to JSON format
2. **JSONField**: Ensure compatibility with D1's text storage
3. **Graph → Relational**: Transform Neo4j relationships to SQL table
4. **Index Optimization**: Adapt indexes for SQLite performance
5. **Query Migration**: Convert PostgreSQL-specific queries to SQLite

## Target D1 Architecture

### D1 Schema Design
```sql
-- Users table (from Django User model)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  is_active INTEGER DEFAULT 1,
  is_staff INTEGER DEFAULT 0,
  is_superuser INTEGER DEFAULT 0,
  date_joined TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Saved files table (converted from PostgreSQL)
CREATE TABLE saved_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  r2_key TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  system_tags TEXT, -- JSON array as string
  user_tags TEXT,   -- JSON array as string
  metadata TEXT,    -- JSON object as string
  file_size INTEGER,
  content_type TEXT,
  checksum TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File relationships table (replaces Neo4j)
CREATE TABLE file_relationships (
  id TEXT PRIMARY KEY,
  parent_file_id TEXT NOT NULL,
  child_file_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'CUT_FROM',
  relationship_metadata TEXT, -- JSON object
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE,
  FOREIGN KEY (child_file_id) REFERENCES saved_files(file_id) ON DELETE CASCADE
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_saved_files_uploaded_at ON saved_files(uploaded_at);
CREATE INDEX idx_file_relationships_parent ON file_relationships(parent_file_id);
CREATE INDEX idx_file_relationships_child ON file_relationships(child_file_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

## Tasks Breakdown

### 4.1 Data Type Mapping and Conversion
**Duration**: 1 day

#### 4.1.1 PostgreSQL to D1 Type Mapping
```typescript
// Data type conversion utilities
export class DataTypeConverter {
  // Convert PostgreSQL arrays to JSON strings
  static arrayToJson(pgArray: string[] | null): string | null {
    if (!pgArray || pgArray.length === 0) return null;
    return JSON.stringify(pgArray);
  }

  // Convert JSON strings back to arrays
  static jsonToArray(jsonString: string | null): string[] {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Convert PostgreSQL JSON to D1 text
  static jsonFieldToText(jsonField: object | null): string | null {
    if (!jsonField) return null;
    return JSON.stringify(jsonField);
  }

  // Parse D1 text back to JSON
  static textToJson(textField: string | null): object | null {
    if (!textField) return null;
    try {
      return JSON.parse(textField);
    } catch {
      return null;
    }
  }

  // Convert PostgreSQL boolean to SQLite integer
  static booleanToInteger(value: boolean | null): number | null {
    if (value === null) return null;
    return value ? 1 : 0;
  }

  // Convert SQLite integer back to boolean
  static integerToBoolean(value: number | null): boolean | null {
    if (value === null) return null;
    return value === 1;
  }

  // Convert PostgreSQL timestamp to ISO string
  static timestampToIso(timestamp: Date | string | null): string | null {
    if (!timestamp) return null;
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toISOString();
  }

  // Parse ISO string back to Date
  static isoToDate(isoString: string | null): Date | null {
    if (!isoString) return null;
    return new Date(isoString);
  }
}
```

#### 4.1.2 Schema Migration Types
```typescript
// TypeScript interfaces for migration
export interface PostgreSQLUser {
  id: number;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: Date;
  last_login: Date | null;
}

export interface D1User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_active: number;
  is_staff: number;
  is_superuser: number;
  date_joined: string;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostgreSQLSavedFile {
  id: number;
  user_id: number;
  file_id: string;
  file_name: string;
  file_path: string;
  uploaded_at: Date;
  system_tags: string[];
  user_tags: string[];
  metadata: object;
}

export interface D1SavedFile {
  id: string;
  user_id: string;
  file_id: string;
  file_name: string;
  file_path: string;
  r2_key: string | null;
  uploaded_at: string;
  system_tags: string;
  user_tags: string;
  metadata: string;
  file_size: number | null;
  content_type: string | null;
  checksum: string | null;
}

export interface Neo4jRelationship {
  parent_file_id: string;
  child_file_id: string;
  relationship_type: string;
  metadata: object;
}

export interface D1FileRelationship {
  id: string;
  parent_file_id: string;
  child_file_id: string;
  relationship_type: string;
  relationship_metadata: string;
  created_at: string;
}
```

### 4.2 Migration Scripts Development
**Duration**: 1.5 days

#### 4.2.1 PostgreSQL Export Script
```typescript
// apps/api/scripts/export-postgresql.ts
import { Pool } from 'pg';
import { writeFileSync } from 'fs';

interface ExportConfig {
  host: string;
  database: string;
  username: string;
  password: string;
  outputDir: string;
}

export class PostgreSQLExporter {
  private pool: Pool;
  private outputDir: string;

  constructor(config: ExportConfig) {
    this.pool = new Pool({
      host: config.host,
      database: config.database,
      user: config.username,
      password: config.password,
      port: 5432,
    });
    this.outputDir = config.outputDir;
  }

  async exportAll(): Promise<void> {
    try {
      console.log('Starting PostgreSQL export...');
      
      await this.exportUsers();
      await this.exportSavedFiles();
      
      console.log('PostgreSQL export completed successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  async exportUsers(): Promise<void> {
    console.log('Exporting users...');
    
    const query = `
      SELECT 
        id, username, email, password, first_name, last_name,
        is_active, is_staff, is_superuser, date_joined, last_login
      FROM auth_user
      ORDER BY id
    `;
    
    const result = await this.pool.query(query);
    const users = result.rows.map(row => ({
      ...row,
      // Convert PostgreSQL types to JSON-serializable types
      date_joined: row.date_joined.toISOString(),
      last_login: row.last_login ? row.last_login.toISOString() : null,
    }));
    
    writeFileSync(
      `${this.outputDir}/users.json`,
      JSON.stringify(users, null, 2)
    );
    
    console.log(`Exported ${users.length} users`);
  }

  async exportSavedFiles(): Promise<void> {
    console.log('Exporting saved files...');
    
    const query = `
      SELECT 
        id, user_id, file_id, file_name, file_path, uploaded_at,
        system_tags, user_tags, metadata
      FROM list_cutter_savedfile
      ORDER BY id
    `;
    
    const result = await this.pool.query(query);
    const savedFiles = result.rows.map(row => ({
      ...row,
      uploaded_at: row.uploaded_at.toISOString(),
      // Arrays are already in the correct format from PostgreSQL
    }));
    
    writeFileSync(
      `${this.outputDir}/saved_files.json`,
      JSON.stringify(savedFiles, null, 2)
    );
    
    console.log(`Exported ${savedFiles.length} saved files`);
  }
}

// Usage script
async function main() {
  const exporter = new PostgreSQLExporter({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'list_cutter',
    username: process.env.PG_USERNAME || 'postgres',
    password: process.env.PG_PASSWORD || '',
    outputDir: './migration-data'
  });

  await exporter.exportAll();
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 4.2.2 Neo4j Export Script
```typescript
// apps/api/scripts/export-neo4j.ts
import neo4j from 'neo4j-driver';
import { writeFileSync } from 'fs';

interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  outputDir: string;
}

export class Neo4jExporter {
  private driver: any;
  private outputDir: string;

  constructor(config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    this.outputDir = config.outputDir;
  }

  async exportAll(): Promise<void> {
    const session = this.driver.session();
    
    try {
      console.log('Starting Neo4j export...');
      
      await this.exportFileRelationships(session);
      
      console.log('Neo4j export completed successfully!');
    } catch (error) {
      console.error('Neo4j export failed:', error);
      throw error;
    } finally {
      await session.close();
      await this.driver.close();
    }
  }

  async exportFileRelationships(session: any): Promise<void> {
    console.log('Exporting file relationships...');
    
    const query = `
      MATCH (parent:SavedFileNode)-[r:CUT_FROM|CUT_TO]->(child:SavedFileNode)
      RETURN 
        parent.file_id as parent_file_id,
        child.file_id as child_file_id,
        type(r) as relationship_type,
        r as relationship_metadata
    `;
    
    const result = await session.run(query);
    const relationships = result.records.map((record: any) => ({
      parent_file_id: record.get('parent_file_id'),
      child_file_id: record.get('child_file_id'),
      relationship_type: record.get('relationship_type'),
      relationship_metadata: record.get('relationship_metadata').properties || {}
    }));
    
    writeFileSync(
      `${this.outputDir}/file_relationships.json`,
      JSON.stringify(relationships, null, 2)
    );
    
    console.log(`Exported ${relationships.length} file relationships`);
  }
}

// Usage script
async function main() {
  const exporter = new Neo4jExporter({
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
    outputDir: './migration-data'
  });

  await exporter.exportAll();
}

if (require.main === module) {
  main().catch(console.error);
}
```

#### 4.2.3 D1 Import Script
```typescript
// apps/api/scripts/import-d1.ts
import { readFileSync } from 'fs';
import { DataTypeConverter } from '../src/utils/data-converter';

interface D1Config {
  databaseId: string;
  dataDir: string;
}

export class D1Importer {
  private databaseId: string;
  private dataDir: string;

  constructor(config: D1Config) {
    this.databaseId = config.databaseId;
    this.dataDir = config.dataDir;
  }

  async importAll(): Promise<void> {
    console.log('Starting D1 import...');
    
    await this.importUsers();
    await this.importSavedFiles();
    await this.importFileRelationships();
    
    console.log('D1 import completed successfully!');
  }

  async importUsers(): Promise<void> {
    console.log('Importing users...');
    
    const usersData = JSON.parse(
      readFileSync(`${this.dataDir}/users.json`, 'utf8')
    );
    
    const batchSize = 100;
    for (let i = 0; i < usersData.length; i += batchSize) {
      const batch = usersData.slice(i, i + batchSize);
      const queries = batch.map((user: any) => {
        const d1User = this.convertUser(user);
        return this.buildInsertQuery('users', d1User);
      });
      
      await this.executeBatch(queries);
      console.log(`Imported users ${i + 1}-${Math.min(i + batchSize, usersData.length)}`);
    }
  }

  async importSavedFiles(): Promise<void> {
    console.log('Importing saved files...');
    
    const filesData = JSON.parse(
      readFileSync(`${this.dataDir}/saved_files.json`, 'utf8')
    );
    
    const batchSize = 50;
    for (let i = 0; i < filesData.length; i += batchSize) {
      const batch = filesData.slice(i, i + batchSize);
      const queries = batch.map((file: any) => {
        const d1File = this.convertSavedFile(file);
        return this.buildInsertQuery('saved_files', d1File);
      });
      
      await this.executeBatch(queries);
      console.log(`Imported files ${i + 1}-${Math.min(i + batchSize, filesData.length)}`);
    }
  }

  async importFileRelationships(): Promise<void> {
    console.log('Importing file relationships...');
    
    const relationshipsData = JSON.parse(
      readFileSync(`${this.dataDir}/file_relationships.json`, 'utf8')
    );
    
    const batchSize = 100;
    for (let i = 0; i < relationshipsData.length; i += batchSize) {
      const batch = relationshipsData.slice(i, i + batchSize);
      const queries = batch.map((relationship: any) => {
        const d1Relationship = this.convertFileRelationship(relationship);
        return this.buildInsertQuery('file_relationships', d1Relationship);
      });
      
      await this.executeBatch(queries);
      console.log(`Imported relationships ${i + 1}-${Math.min(i + batchSize, relationshipsData.length)}`);
    }
  }

  private convertUser(pgUser: any): D1User {
    return {
      id: crypto.randomUUID(),
      username: pgUser.username,
      email: pgUser.email,
      password_hash: pgUser.password, // Django password hash format
      first_name: pgUser.first_name || '',
      last_name: pgUser.last_name || '',
      is_active: DataTypeConverter.booleanToInteger(pgUser.is_active) || 1,
      is_staff: DataTypeConverter.booleanToInteger(pgUser.is_staff) || 0,
      is_superuser: DataTypeConverter.booleanToInteger(pgUser.is_superuser) || 0,
      date_joined: pgUser.date_joined,
      last_login: pgUser.last_login,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private convertSavedFile(pgFile: any): D1SavedFile {
    return {
      id: crypto.randomUUID(),
      user_id: pgFile.user_id.toString(), // Convert from integer
      file_id: pgFile.file_id,
      file_name: pgFile.file_name,
      file_path: pgFile.file_path,
      r2_key: null, // Will be set during file migration
      uploaded_at: pgFile.uploaded_at,
      system_tags: DataTypeConverter.arrayToJson(pgFile.system_tags) || '[]',
      user_tags: DataTypeConverter.arrayToJson(pgFile.user_tags) || '[]',
      metadata: DataTypeConverter.jsonFieldToText(pgFile.metadata) || '{}',
      file_size: null,
      content_type: null,
      checksum: null
    };
  }

  private convertFileRelationship(neoRelationship: any): D1FileRelationship {
    return {
      id: crypto.randomUUID(),
      parent_file_id: neoRelationship.parent_file_id,
      child_file_id: neoRelationship.child_file_id,
      relationship_type: neoRelationship.relationship_type,
      relationship_metadata: JSON.stringify(neoRelationship.relationship_metadata),
      created_at: new Date().toISOString()
    };
  }

  private buildInsertQuery(table: string, data: any): string {
    const columns = Object.keys(data);
    const values = Object.values(data).map(value => 
      value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`
    );
    
    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
  }

  private async executeBatch(queries: string[]): Promise<void> {
    const sql = queries.join('\n');
    
    // Execute using Wrangler CLI
    const { execSync } = require('child_process');
    try {
      execSync(`wrangler d1 execute ${this.databaseId} --command="${sql}"`, {
        stdio: 'pipe'
      });
    } catch (error) {
      console.error('Batch execution failed:', error.message);
      throw error;
    }
  }
}

// Usage script
async function main() {
  const importer = new D1Importer({
    databaseId: process.env.D1_DATABASE_ID || 'list-cutter-db',
    dataDir: './migration-data'
  });

  await importer.importAll();
}

if (require.main === module) {
  main().catch(console.error);
}
```

### 4.3 Neo4j to D1 Relationship Migration
**Duration**: 1 day

#### 4.3.1 File Lineage Service
```typescript
// apps/api/src/services/fileLineage.ts
import { D1Database } from '@cloudflare/workers-types';
import { D1FileRelationship } from '../db/schema';

export interface FileLineageNode {
  file_id: string;
  file_name: string;
  relationship_type?: string;
  metadata?: object;
  children?: FileLineageNode[];
  parents?: FileLineageNode[];
}

export class FileLineageService {
  constructor(private db: D1Database) {}

  async createRelationship(
    parentFileId: string,
    childFileId: string,
    relationshipType: string = 'CUT_FROM',
    metadata: object = {}
  ): Promise<D1FileRelationship> {
    const relationship: D1FileRelationship = {
      id: crypto.randomUUID(),
      parent_file_id: parentFileId,
      child_file_id: childFileId,
      relationship_type: relationshipType,
      relationship_metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString()
    };

    await this.db.prepare(`
      INSERT INTO file_relationships (
        id, parent_file_id, child_file_id, relationship_type, 
        relationship_metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      relationship.id,
      relationship.parent_file_id,
      relationship.child_file_id,
      relationship.relationship_type,
      relationship.relationship_metadata,
      relationship.created_at
    ).run();

    return relationship;
  }

  async getFileLineage(fileId: string): Promise<FileLineageNode> {
    // Get the root file information
    const file = await this.db.prepare(`
      SELECT file_id, file_name FROM saved_files WHERE file_id = ?
    `).bind(fileId).first();

    if (!file) {
      throw new Error('File not found');
    }

    const lineageNode: FileLineageNode = {
      file_id: file.file_id,
      file_name: file.file_name,
      children: await this.getChildren(fileId),
      parents: await this.getParents(fileId)
    };

    return lineageNode;
  }

  private async getChildren(fileId: string): Promise<FileLineageNode[]> {
    const children = await this.db.prepare(`
      SELECT 
        sf.file_id, sf.file_name,
        fr.relationship_type, fr.relationship_metadata
      FROM file_relationships fr
      JOIN saved_files sf ON fr.child_file_id = sf.file_id
      WHERE fr.parent_file_id = ?
    `).bind(fileId).all();

    const childNodes: FileLineageNode[] = [];
    
    for (const child of children.results || []) {
      const childNode: FileLineageNode = {
        file_id: child.file_id,
        file_name: child.file_name,
        relationship_type: child.relationship_type,
        metadata: JSON.parse(child.relationship_metadata || '{}'),
        children: await this.getChildren(child.file_id) // Recursive
      };
      childNodes.push(childNode);
    }

    return childNodes;
  }

  private async getParents(fileId: string): Promise<FileLineageNode[]> {
    const parents = await this.db.prepare(`
      SELECT 
        sf.file_id, sf.file_name,
        fr.relationship_type, fr.relationship_metadata
      FROM file_relationships fr
      JOIN saved_files sf ON fr.parent_file_id = sf.file_id
      WHERE fr.child_file_id = ?
    `).bind(fileId).all();

    const parentNodes: FileLineageNode[] = [];
    
    for (const parent of parents.results || []) {
      const parentNode: FileLineageNode = {
        file_id: parent.file_id,
        file_name: parent.file_name,
        relationship_type: parent.relationship_type,
        metadata: JSON.parse(parent.relationship_metadata || '{}'),
        parents: await this.getParents(parent.file_id) // Recursive
      };
      parentNodes.push(parentNode);
    }

    return parentNodes;
  }

  async getRelatedFiles(fileId: string, depth: number = 3): Promise<string[]> {
    // Get all related files up to specified depth
    const relatedFiles = new Set<string>();
    await this.traverseRelationships(fileId, depth, relatedFiles);
    relatedFiles.delete(fileId); // Remove the original file
    return Array.from(relatedFiles);
  }

  private async traverseRelationships(
    fileId: string, 
    remainingDepth: number, 
    visited: Set<string>
  ): Promise<void> {
    if (remainingDepth <= 0 || visited.has(fileId)) {
      return;
    }

    visited.add(fileId);

    // Get all related files (parents and children)
    const related = await this.db.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN parent_file_id = ? THEN child_file_id
          ELSE parent_file_id
        END as related_file_id
      FROM file_relationships
      WHERE parent_file_id = ? OR child_file_id = ?
    `).bind(fileId, fileId, fileId).all();

    // Recursively traverse
    for (const relation of related.results || []) {
      await this.traverseRelationships(
        relation.related_file_id,
        remainingDepth - 1,
        visited
      );
    }
  }

  async deleteRelationships(fileId: string): Promise<void> {
    await this.db.prepare(`
      DELETE FROM file_relationships 
      WHERE parent_file_id = ? OR child_file_id = ?
    `).bind(fileId, fileId).run();
  }
}
```

### 4.4 Query Optimization for D1
**Duration**: 0.5 days

#### 4.4.1 Optimized Query Patterns
```typescript
// apps/api/src/db/queries/optimized.ts
import { D1Database } from '@cloudflare/workers-types';

export class OptimizedQueries {
  constructor(private db: D1Database) {}

  // Optimized file listing with pagination
  async getFilesPaginated(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    orderBy: string = 'uploaded_at',
    orderDirection: 'ASC' | 'DESC' = 'DESC'
  ) {
    const query = `
      SELECT 
        file_id, file_name, uploaded_at, file_size, content_type,
        system_tags, user_tags
      FROM saved_files 
      WHERE user_id = ?
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?
    `;
    
    return await this.db.prepare(query)
      .bind(userId, limit, offset)
      .all();
  }

  // Batch file operations
  async getMultipleFiles(fileIds: string[], userId: string) {
    const placeholders = fileIds.map(() => '?').join(',');
    const query = `
      SELECT * FROM saved_files 
      WHERE file_id IN (${placeholders}) AND user_id = ?
    `;
    
    return await this.db.prepare(query)
      .bind(...fileIds, userId)
      .all();
  }

  // Efficient tag search
  async searchFilesByTags(userId: string, tags: string[]) {
    const tagConditions = tags.map(() => 
      '(user_tags LIKE ? OR system_tags LIKE ?)'
    ).join(' AND ');
    
    const query = `
      SELECT * FROM saved_files 
      WHERE user_id = ? AND ${tagConditions}
    `;
    
    const bindings = [userId];
    tags.forEach(tag => {
      bindings.push(`%"${tag}"%`, `%"${tag}"%`);
    });
    
    return await this.db.prepare(query)
      .bind(...bindings)
      .all();
  }

  // File statistics
  async getUserFileStats(userId: string) {
    const query = `
      SELECT 
        COUNT(*) as total_files,
        SUM(CASE WHEN file_size IS NOT NULL THEN file_size ELSE 0 END) as total_size,
        MAX(uploaded_at) as last_upload,
        COUNT(CASE WHEN uploaded_at > datetime('now', '-7 days') THEN 1 END) as recent_uploads
      FROM saved_files 
      WHERE user_id = ?
    `;
    
    return await this.db.prepare(query).bind(userId).first();
  }
}
```

### 4.5 Data Integrity Validation
**Duration**: 0.5 days

#### 4.5.1 Validation Framework
```typescript
// apps/api/src/utils/migration-validator.ts
import { D1Database } from '@cloudflare/workers-types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  statistics: {
    totalUsers: number;
    totalFiles: number;
    totalRelationships: number;
    orphanedFiles: number;
    brokenRelationships: number;
  };
}

export class MigrationValidator {
  constructor(private db: D1Database) {}

  async validateMigration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      statistics: {
        totalUsers: 0,
        totalFiles: 0,
        totalRelationships: 0,
        orphanedFiles: 0,
        brokenRelationships: 0
      }
    };

    // Run all validation checks
    await this.validateUsers(result);
    await this.validateFiles(result);
    await this.validateRelationships(result);
    await this.validateReferences(result);
    await this.validateJsonFields(result);

    result.isValid = result.errors.length === 0;
    return result;
  }

  private async validateUsers(result: ValidationResult): Promise<void> {
    // Count total users
    const userCount = await this.db.prepare('SELECT COUNT(*) as count FROM users').first();
    result.statistics.totalUsers = userCount?.count || 0;

    // Check for duplicate emails
    const duplicateEmails = await this.db.prepare(`
      SELECT email, COUNT(*) as count 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `).all();

    if (duplicateEmails.results?.length > 0) {
      result.errors.push(`Found ${duplicateEmails.results.length} duplicate emails`);
    }

    // Check for invalid email formats
    const invalidEmails = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE email NOT LIKE '%@%.%'
    `).first();

    if (invalidEmails?.count > 0) {
      result.warnings.push(`Found ${invalidEmails.count} invalid email formats`);
    }
  }

  private async validateFiles(result: ValidationResult): Promise<void> {
    // Count total files
    const fileCount = await this.db.prepare('SELECT COUNT(*) as count FROM saved_files').first();
    result.statistics.totalFiles = fileCount?.count || 0;

    // Check for orphaned files (user doesn't exist)
    const orphanedFiles = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM saved_files sf 
      LEFT JOIN users u ON sf.user_id = u.id 
      WHERE u.id IS NULL
    `).first();

    result.statistics.orphanedFiles = orphanedFiles?.count || 0;
    if (result.statistics.orphanedFiles > 0) {
      result.errors.push(`Found ${result.statistics.orphanedFiles} orphaned files`);
    }

    // Check for duplicate file IDs
    const duplicateFileIds = await this.db.prepare(`
      SELECT file_id, COUNT(*) as count 
      FROM saved_files 
      GROUP BY file_id 
      HAVING COUNT(*) > 1
    `).all();

    if (duplicateFileIds.results?.length > 0) {
      result.errors.push(`Found ${duplicateFileIds.results.length} duplicate file IDs`);
    }
  }

  private async validateRelationships(result: ValidationResult): Promise<void> {
    // Count total relationships
    const relationshipCount = await this.db.prepare('SELECT COUNT(*) as count FROM file_relationships').first();
    result.statistics.totalRelationships = relationshipCount?.count || 0;

    // Check for broken relationships (files don't exist)
    const brokenRelationships = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM file_relationships fr 
      WHERE NOT EXISTS (SELECT 1 FROM saved_files WHERE file_id = fr.parent_file_id)
         OR NOT EXISTS (SELECT 1 FROM saved_files WHERE file_id = fr.child_file_id)
    `).first();

    result.statistics.brokenRelationships = brokenRelationships?.count || 0;
    if (result.statistics.brokenRelationships > 0) {
      result.errors.push(`Found ${result.statistics.brokenRelationships} broken file relationships`);
    }

    // Check for circular references
    const circularRefs = await this.checkCircularReferences();
    if (circularRefs.length > 0) {
      result.warnings.push(`Found ${circularRefs.length} potential circular references`);
    }
  }

  private async validateJsonFields(result: ValidationResult): Promise<void> {
    // Validate JSON fields in saved_files
    const invalidJsonFiles = await this.db.prepare(`
      SELECT file_id 
      FROM saved_files 
      WHERE (system_tags IS NOT NULL AND system_tags != '' AND json_valid(system_tags) = 0)
         OR (user_tags IS NOT NULL AND user_tags != '' AND json_valid(user_tags) = 0)
         OR (metadata IS NOT NULL AND metadata != '' AND json_valid(metadata) = 0)
    `).all();

    if (invalidJsonFiles.results?.length > 0) {
      result.errors.push(`Found ${invalidJsonFiles.results.length} files with invalid JSON`);
    }
  }

  private async validateReferences(result: ValidationResult): Promise<void> {
    // Check foreign key constraints manually (SQLite doesn't enforce them in D1)
    const invalidUserRefs = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM saved_files sf 
      WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = sf.user_id)
    `).first();

    if (invalidUserRefs?.count > 0) {
      result.errors.push(`Found ${invalidUserRefs.count} files with invalid user references`);
    }
  }

  private async checkCircularReferences(): Promise<string[]> {
    // Simple circular reference detection
    const relationships = await this.db.prepare(`
      SELECT parent_file_id, child_file_id 
      FROM file_relationships
    `).all();

    const graph = new Map<string, Set<string>>();
    
    // Build adjacency list
    for (const rel of relationships.results || []) {
      if (!graph.has(rel.parent_file_id)) {
        graph.set(rel.parent_file_id, new Set());
      }
      graph.get(rel.parent_file_id)!.add(rel.child_file_id);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        this.detectCycleDFS(node, graph, visited, recursionStack, cycles);
      }
    }

    return cycles;
  }

  private detectCycleDFS(
    node: string,
    graph: Map<string, Set<string>>,
    visited: Set<string>,
    recursionStack: Set<string>,
    cycles: string[]
  ): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (this.detectCycleDFS(neighbor, graph, visited, recursionStack, cycles)) {
          cycles.push(`${node} -> ${neighbor}`);
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        cycles.push(`${node} -> ${neighbor}`);
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }
}
```

### 4.6 Testing and Validation
**Duration**: 0.5 days

#### 4.6.1 Migration Testing Suite
```typescript
// apps/api/src/test/migration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MigrationValidator } from '../utils/migration-validator';
import { DataTypeConverter } from '../utils/data-converter';

describe('Database Migration', () => {
  let mockDb: any;
  let validator: MigrationValidator;

  beforeAll(() => {
    // Setup mock D1 database
    mockDb = createMockDb();
    validator = new MigrationValidator(mockDb);
  });

  describe('Data Type Conversion', () => {
    it('should convert PostgreSQL arrays to JSON strings', () => {
      const pgArray = ['tag1', 'tag2', 'tag3'];
      const result = DataTypeConverter.arrayToJson(pgArray);
      expect(result).toBe('["tag1","tag2","tag3"]');
    });

    it('should convert JSON strings back to arrays', () => {
      const jsonString = '["tag1","tag2","tag3"]';
      const result = DataTypeConverter.jsonToArray(jsonString);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle empty arrays', () => {
      const result = DataTypeConverter.arrayToJson([]);
      expect(result).toBe(null);
    });

    it('should convert booleans to integers', () => {
      expect(DataTypeConverter.booleanToInteger(true)).toBe(1);
      expect(DataTypeConverter.booleanToInteger(false)).toBe(0);
      expect(DataTypeConverter.booleanToInteger(null)).toBe(null);
    });

    it('should convert integers back to booleans', () => {
      expect(DataTypeConverter.integerToBoolean(1)).toBe(true);
      expect(DataTypeConverter.integerToBoolean(0)).toBe(false);
      expect(DataTypeConverter.integerToBoolean(null)).toBe(null);
    });
  });

  describe('Migration Validation', () => {
    it('should validate successful migration', async () => {
      const result = await validator.validateMigration();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect orphaned files', async () => {
      // Setup test data with orphaned file
      // ... test implementation
    });

    it('should detect broken relationships', async () => {
      // Setup test data with broken relationships
      // ... test implementation
    });
  });
});
```

## Migration Execution Plan

### 4.7 Pre-Migration Checklist
- [ ] PostgreSQL database accessible
- [ ] Neo4j database accessible
- [ ] D1 database created and configured
- [ ] Migration scripts tested in development
- [ ] Backup of existing data created
- [ ] Rollback procedure documented

### 4.8 Migration Steps
1. **Export PostgreSQL data**
   ```bash
   npm run migrate:export-postgresql
   ```

2. **Export Neo4j relationships**
   ```bash
   npm run migrate:export-neo4j
   ```

3. **Run D1 schema migration**
   ```bash
   npm run db:migrate
   ```

4. **Import data to D1**
   ```bash
   npm run migrate:import-d1
   ```

5. **Validate migration**
   ```bash
   npm run migrate:validate
   ```

### 4.9 Post-Migration Validation
- [ ] All data imported successfully
- [ ] Data integrity validation passed
- [ ] Query performance acceptable
- [ ] File relationships working correctly
- [ ] Authentication working with new schema
- [ ] Application functionality verified

## Success Criteria

- [ ] All PostgreSQL data migrated to D1
- [ ] Neo4j relationships converted to relational tables
- [ ] Data integrity maintained
- [ ] Query performance meets requirements
- [ ] All application features working
- [ ] Migration validation passed
- [ ] Ready for Phase 5 (file storage migration)

## Rollback Strategy

### Emergency Rollback
1. **Revert Workers to use PostgreSQL**
2. **Restore PostgreSQL data from backup**
3. **Update environment variables**
4. **Verify application functionality**

### Data Recovery
- **PostgreSQL backup**: Full database backup before migration
- **D1 export**: Export D1 data before rollback
- **Incremental restoration**: Restore only changed data if possible

## Next Steps

After completing Phase 4:
1. **Database migration completed**
2. **Ready for Phase 5**: File storage migration to R2
3. **Data layer**: All data operations using D1
4. **Performance optimization**: Monitor and optimize queries