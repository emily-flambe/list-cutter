# Phase 3: Backend Migration - Django to Cloudflare Workers
**Duration**: 7-10 days  
**Status**: Ready for Implementation

## Overview
This phase migrates the Django backend to Cloudflare Workers using TypeScript. The migration preserves all existing functionality while adapting to the Workers runtime environment and leveraging Cloudflare's edge computing capabilities.

## Prerequisites
- Phase 1 completed (development environment setup)
- Phase 2 completed (frontend migration)
- Django backend analysis completed
- Cloudflare Workers project configured

## Current Django Backend Summary

### Architecture
- **Framework**: Django 5.1.5 with Django Rest Framework
- **Database**: PostgreSQL with ArrayField and JSONField
- **Graph Database**: Neo4j for file relationship tracking
- **Authentication**: JWT with djangorestframework-simplejwt
- **File Storage**: Local filesystem
- **CSV Processing**: Pandas for data manipulation

### Key Features
- JWT authentication with token refresh
- CSV upload and processing
- SQL-like filtering on CSV data
- File management with tagging
- File lineage tracking with Neo4j
- User-scoped data access

## Target Architecture

### New Stack
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: Hono (lightweight web framework)
- **Database**: D1 (SQLite-based)
- **File Storage**: R2 (object storage)
- **Authentication**: JWT with Workers KV
- **CSV Processing**: Custom TypeScript implementation

## Tasks Breakdown

### 3.1 Project Structure Setup
**Duration**: 2 hours

#### 3.1.1 Initialize Workers Project
```bash
cd apps/api

# Verify structure from Phase 1
ls -la src/
```

#### 3.1.2 Install Additional Dependencies
```bash
npm install --save \
  @hono/cors \
  @hono/jwt \
  @hono/secure-headers \
  csv-parser \
  csv-writer \
  mime-types \
  sharp

npm install --save-dev \
  @types/mime-types \
  @types/csv-parser \
  @types/csv-writer
```

#### 3.1.3 Create Detailed Directory Structure
```
apps/api/src/
├── index.ts                    # Main Worker entry point
├── routes/                     # API route handlers
│   ├── auth/                   # Authentication routes
│   │   ├── login.ts
│   │   ├── register.ts
│   │   ├── refresh.ts
│   │   └── user.ts
│   ├── files/                  # File management routes
│   │   ├── upload.ts
│   │   ├── download.ts
│   │   ├── list.ts
│   │   ├── delete.ts
│   │   └── metadata.ts
│   ├── csv/                    # CSV processing routes
│   │   ├── analyze.ts
│   │   ├── filter.ts
│   │   └── export.ts
│   └── lineage/                # File lineage routes
│       ├── create.ts
│       └── fetch.ts
├── services/                   # Business logic services
│   ├── auth.ts                 # Authentication service
│   ├── csvProcessor.ts         # CSV processing logic
│   ├── fileManager.ts          # File operations
│   ├── sqlFilter.ts            # SQL-like filtering
│   └── lineageTracker.ts       # File relationship tracking
├── db/                         # Database operations
│   ├── schema.ts               # D1 schema definitions
│   ├── migrations/             # Database migrations
│   └── queries/                # SQL query builders
├── middleware/                 # Request middleware
│   ├── auth.ts                 # Authentication middleware
│   ├── cors.ts                 # CORS configuration
│   └── validation.ts           # Input validation
├── utils/                      # Utility functions
│   ├── errors.ts               # Error handling
│   ├── response.ts             # Response formatting
│   └── validation.ts           # Data validation
└── types/                      # TypeScript type definitions
    ├── database.ts             # Database types
    ├── api.ts                  # API types
    └── csv.ts                  # CSV processing types
```

### 3.2 Database Schema Migration
**Duration**: 1.5 days

#### 3.2.1 Create D1 Database Schema
**apps/api/src/db/schema.ts**:
```typescript
export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SavedFile {
  id: string;
  user_id: string;
  file_id: string;
  file_name: string;
  file_path: string;
  r2_key?: string;
  uploaded_at: string;
  system_tags: string; // JSON array as string
  user_tags: string;   // JSON array as string
  metadata: string;    // JSON object as string
}

export interface FileRelationship {
  id: string;
  parent_file_id: string;
  child_file_id: string;
  relationship_type: 'CUT_FROM' | 'DERIVED_FROM';
  created_at: string;
  metadata: string;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}
```

#### 3.2.2 Create Database Migration Scripts
**apps/api/src/db/migrations/001_initial.sql**:
```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Saved files table
CREATE TABLE saved_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  r2_key TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  system_tags TEXT, -- JSON array
  user_tags TEXT,   -- JSON array
  metadata TEXT,    -- JSON object
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File relationships table (replacing Neo4j)
CREATE TABLE file_relationships (
  id TEXT PRIMARY KEY,
  parent_file_id TEXT NOT NULL,
  child_file_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
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

-- Indexes for performance
CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_file_relationships_parent ON file_relationships(parent_file_id);
CREATE INDEX idx_file_relationships_child ON file_relationships(child_file_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

#### 3.2.3 Create Database Query Builders
**apps/api/src/db/queries/users.ts**:
```typescript
import { D1Database } from '@cloudflare/workers-types';
import { User } from '../schema';

export class UserQueries {
  constructor(private db: D1Database) {}

  async create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await this.db.prepare(`
      INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(id, user.username, user.email, user.password_hash, now, now).first<User>();
    
    if (!result) throw new Error('Failed to create user');
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.db.prepare(`
      SELECT * FROM users WHERE email = ?
    `).bind(email).first<User>();
  }

  async findById(id: string): Promise<User | null> {
    return await this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(id).first<User>();
  }

  async updatePassword(id: string, password_hash: string): Promise<void> {
    await this.db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
    `).bind(password_hash, new Date().toISOString(), id).run();
  }
}
```

### 3.3 Authentication Service Implementation
**Duration**: 1.5 days

#### 3.3.1 JWT Authentication Service
**apps/api/src/services/auth.ts**:
```typescript
import { sign, verify } from 'hono/jwt';
import { UserQueries } from '../db/queries/users';
import { User } from '../db/schema';

export interface JWTPayload {
  sub: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export class AuthService {
  private userQueries: UserQueries;
  private jwtSecret: string;

  constructor(db: D1Database, jwtSecret: string) {
    this.userQueries = new UserQueries(db);
    this.jwtSecret = jwtSecret;
  }

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }

  async generateTokens(user: User): Promise<{ access: string; refresh: string }> {
    const now = Math.floor(Date.now() / 1000);
    
    const accessPayload: JWTPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      iat: now,
      exp: now + (10 * 60) // 10 minutes
    };

    const refreshPayload = {
      sub: user.id,
      type: 'refresh',
      iat: now,
      exp: now + (24 * 60 * 60) // 24 hours
    };

    const access = await sign(accessPayload, this.jwtSecret);
    const refresh = await sign(refreshPayload, this.jwtSecret);

    return { access, refresh };
  }

  async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = await verify(token, this.jwtSecret);
      return payload as JWTPayload;
    } catch {
      return null;
    }
  }

  async register(username: string, email: string, password: string): Promise<User> {
    // Check if user exists
    const existingUser = await this.userQueries.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password and create user
    const password_hash = await this.hashPassword(password);
    return await this.userQueries.create({
      username,
      email,
      password_hash
    });
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: { access: string; refresh: string } }> {
    const user = await this.userQueries.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    return { user, tokens };
  }
}
```

#### 3.3.2 Authentication Middleware
**apps/api/src/middleware/auth.ts**:
```typescript
import { Context, Next } from 'hono';
import { AuthService } from '../services/auth';

export const authMiddleware = (authService: AuthService) => {
  return async (c: Context, next: Next) => {
    const authorization = c.req.header('authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authorization.split(' ')[1];
    const payload = await authService.verifyToken(token);
    
    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Add user info to context
    c.set('user', payload);
    await next();
  };
};
```

### 3.4 CSV Processing Service
**Duration**: 2 days

#### 3.4.1 CSV Processing Service
**apps/api/src/services/csvProcessor.ts**:
```typescript
import { parse } from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

export interface CSVColumn {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  sample_values: string[];
}

export interface CSVData {
  columns: CSVColumn[];
  row_count: number;
  preview: Record<string, any>[];
}

export class CSVProcessor {
  async analyzeCSV(fileContent: string): Promise<CSVData> {
    const rows: Record<string, any>[] = [];
    
    return new Promise((resolve, reject) => {
      const parser = parse({
        headers: true,
        skipEmptyLines: true,
        maxRows: 1000 // Limit preview rows
      });

      parser.on('data', (row) => {
        rows.push(row);
      });

      parser.on('end', () => {
        if (rows.length === 0) {
          reject(new Error('No data found in CSV'));
          return;
        }

        const columns = this.extractColumns(rows);
        const preview = rows.slice(0, 10); // First 10 rows for preview

        resolve({
          columns,
          row_count: rows.length,
          preview
        });
      });

      parser.on('error', reject);
      parser.write(fileContent);
      parser.end();
    });
  }

  private extractColumns(rows: Record<string, any>[]): CSVColumn[] {
    if (rows.length === 0) return [];

    const firstRow = rows[0];
    const columns: CSVColumn[] = [];

    for (const [columnName, value] of Object.entries(firstRow)) {
      const sampleValues = rows
        .slice(0, 10)
        .map(row => row[columnName])
        .filter(val => val !== null && val !== undefined && val !== '')
        .slice(0, 5);

      const type = this.inferColumnType(sampleValues);

      columns.push({
        name: columnName,
        type,
        sample_values: sampleValues.map(String)
      });
    }

    return columns;
  }

  private inferColumnType(values: any[]): 'string' | 'number' | 'boolean' | 'date' {
    if (values.length === 0) return 'string';

    const numericCount = values.filter(v => !isNaN(Number(v))).length;
    const booleanCount = values.filter(v => 
      typeof v === 'boolean' || ['true', 'false', 'yes', 'no', '1', '0'].includes(String(v).toLowerCase())
    ).length;
    const dateCount = values.filter(v => !isNaN(Date.parse(String(v)))).length;

    const ratio = (count: number) => count / values.length;

    if (ratio(booleanCount) > 0.8) return 'boolean';
    if (ratio(numericCount) > 0.8) return 'number';
    if (ratio(dateCount) > 0.8) return 'date';
    return 'string';
  }

  async filterCSV(fileContent: string, whereClause: string): Promise<string> {
    const rows: Record<string, any>[] = [];
    
    // Parse CSV
    await new Promise<void>((resolve, reject) => {
      const parser = parse({
        headers: true,
        skipEmptyLines: true
      });

      parser.on('data', (row) => {
        rows.push(row);
      });

      parser.on('end', resolve);
      parser.on('error', reject);
      parser.write(fileContent);
      parser.end();
    });

    // Apply filter
    const filteredRows = this.applyWhereClause(rows, whereClause);

    // Convert back to CSV
    if (filteredRows.length === 0) {
      return '';
    }

    const columns = Object.keys(filteredRows[0]);
    const csvWriter = createObjectCsvWriter({
      path: '', // Not used for string output
      header: columns.map(name => ({ id: name, title: name }))
    });

    // Create CSV string manually since csv-writer doesn't support string output
    const header = columns.join(',');
    const dataRows = filteredRows.map(row => 
      columns.map(col => this.escapeCsvValue(row[col])).join(',')
    );

    return [header, ...dataRows].join('\n');
  }

  private applyWhereClause(rows: Record<string, any>[], whereClause: string): Record<string, any>[] {
    if (!whereClause) return rows;

    // Simple WHERE clause parsing - this is a simplified version
    // In production, you'd want a more robust SQL parser
    const conditions = this.parseWhereClause(whereClause);
    
    return rows.filter(row => this.evaluateConditions(row, conditions));
  }

  private parseWhereClause(whereClause: string): any[] {
    // Simplified parser - handles basic conditions
    // Format: column operator value
    const conditions: any[] = [];
    
    // Split by AND/OR (simplified)
    const parts = whereClause.split(/\s+(AND|OR)\s+/i);
    
    for (let i = 0; i < parts.length; i += 2) {
      const conditionStr = parts[i].trim();
      const operator = i + 1 < parts.length ? parts[i + 1].toUpperCase() : null;
      
      const condition = this.parseCondition(conditionStr);
      if (condition) {
        conditions.push({ ...condition, logicalOperator: operator });
      }
    }
    
    return conditions;
  }

  private parseCondition(conditionStr: string): any {
    const operators = ['>=', '<=', '!=', '=', '>', '<', 'LIKE', 'IN', 'BETWEEN'];
    
    for (const op of operators) {
      const index = conditionStr.indexOf(op);
      if (index > 0) {
        const column = conditionStr.substring(0, index).trim();
        const value = conditionStr.substring(index + op.length).trim();
        
        return {
          column,
          operator: op,
          value: this.parseValue(value)
        };
      }
    }
    
    return null;
  }

  private parseValue(value: string): any {
    // Remove quotes
    value = value.replace(/^['"]|['"]$/g, '');
    
    // Try to parse as number
    if (!isNaN(Number(value))) {
      return Number(value);
    }
    
    // Try to parse as boolean
    if (['true', 'false'].includes(value.toLowerCase())) {
      return value.toLowerCase() === 'true';
    }
    
    return value;
  }

  private evaluateConditions(row: Record<string, any>, conditions: any[]): boolean {
    if (conditions.length === 0) return true;
    
    let result = this.evaluateCondition(row, conditions[0]);
    
    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(row, condition);
      
      if (condition.logicalOperator === 'AND') {
        result = result && conditionResult;
      } else if (condition.logicalOperator === 'OR') {
        result = result || conditionResult;
      }
    }
    
    return result;
  }

  private evaluateCondition(row: Record<string, any>, condition: any): boolean {
    const { column, operator, value } = condition;
    const rowValue = row[column];
    
    switch (operator) {
      case '=':
        return rowValue == value;
      case '!=':
        return rowValue != value;
      case '>':
        return Number(rowValue) > Number(value);
      case '<':
        return Number(rowValue) < Number(value);
      case '>=':
        return Number(rowValue) >= Number(value);
      case '<=':
        return Number(rowValue) <= Number(value);
      case 'LIKE':
        return String(rowValue).includes(String(value));
      default:
        return false;
    }
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    const str = String(value);
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  }
}
```

### 3.5 File Management Service
**Duration**: 1.5 days

#### 3.5.1 File Manager Service
**apps/api/src/services/fileManager.ts**:
```typescript
import { R2Bucket } from '@cloudflare/workers-types';
import { SavedFile } from '../db/schema';

export interface FileMetadata {
  size: number;
  type: string;
  lastModified: string;
  columns?: string[];
  rowCount?: number;
}

export class FileManager {
  constructor(
    private r2Bucket: R2Bucket,
    private db: D1Database
  ) {}

  async uploadFile(
    userId: string,
    filename: string,
    content: ArrayBuffer,
    metadata: FileMetadata
  ): Promise<SavedFile> {
    const fileId = crypto.randomUUID();
    const r2Key = `files/${userId}/${fileId}/${filename}`;
    
    // Upload to R2
    await this.r2Bucket.put(r2Key, content, {
      customMetadata: {
        userId,
        originalName: filename,
        uploadedAt: new Date().toISOString()
      }
    });

    // Save to database
    const savedFile: SavedFile = {
      id: crypto.randomUUID(),
      user_id: userId,
      file_id: fileId,
      file_name: filename,
      file_path: r2Key,
      r2_key: r2Key,
      uploaded_at: new Date().toISOString(),
      system_tags: JSON.stringify(['uploaded']),
      user_tags: JSON.stringify([]),
      metadata: JSON.stringify(metadata)
    };

    await this.db.prepare(`
      INSERT INTO saved_files (
        id, user_id, file_id, file_name, file_path, r2_key, 
        uploaded_at, system_tags, user_tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      savedFile.id,
      savedFile.user_id,
      savedFile.file_id,
      savedFile.file_name,
      savedFile.file_path,
      savedFile.r2_key,
      savedFile.uploaded_at,
      savedFile.system_tags,
      savedFile.user_tags,
      savedFile.metadata
    ).run();

    return savedFile;
  }

  async getFile(fileId: string, userId: string): Promise<{ file: SavedFile; content: ArrayBuffer } | null> {
    const file = await this.db.prepare(`
      SELECT * FROM saved_files WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).first<SavedFile>();

    if (!file || !file.r2_key) return null;

    const r2Object = await this.r2Bucket.get(file.r2_key);
    if (!r2Object) return null;

    const content = await r2Object.arrayBuffer();
    return { file, content };
  }

  async listFiles(userId: string): Promise<SavedFile[]> {
    const result = await this.db.prepare(`
      SELECT * FROM saved_files WHERE user_id = ? ORDER BY uploaded_at DESC
    `).bind(userId).all<SavedFile>();

    return result.results || [];
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    const file = await this.db.prepare(`
      SELECT * FROM saved_files WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).first<SavedFile>();

    if (!file) return false;

    // Delete from R2
    if (file.r2_key) {
      await this.r2Bucket.delete(file.r2_key);
    }

    // Delete from database
    await this.db.prepare(`
      DELETE FROM saved_files WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).run();

    return true;
  }

  async updateTags(fileId: string, userId: string, userTags: string[]): Promise<SavedFile | null> {
    const tagsJson = JSON.stringify(userTags);
    
    await this.db.prepare(`
      UPDATE saved_files SET user_tags = ? WHERE file_id = ? AND user_id = ?
    `).bind(tagsJson, fileId, userId).run();

    return await this.db.prepare(`
      SELECT * FROM saved_files WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).first<SavedFile>();
  }
}
```

### 3.6 API Route Implementation
**Duration**: 2 days

#### 3.6.1 Main Application Entry Point
**apps/api/src/index.ts**:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { authRoutes } from './routes/auth';
import { fileRoutes } from './routes/files';
import { csvRoutes } from './routes/csv';
import { AuthService } from './services/auth';
import { FileManager } from './services/fileManager';
import { CSVProcessor } from './services/csvProcessor';

export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  JWT_SECRET: string;
  CORS_ORIGINS: string;
}

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = c.env.CORS_ORIGINS.split(',');
    return allowedOrigins.includes(origin) || origin === undefined;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Initialize services
app.use('*', async (c, next) => {
  const authService = new AuthService(c.env.DB, c.env.JWT_SECRET);
  const fileManager = new FileManager(c.env.STORAGE, c.env.DB);
  const csvProcessor = new CSVProcessor();

  c.set('authService', authService);
  c.set('fileManager', fileManager);
  c.set('csvProcessor', csvProcessor);
  
  await next();
});

// Routes
app.route('/auth', authRoutes);
app.route('/files', fileRoutes);
app.route('/csv', csvRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Global error handler:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
```

#### 3.6.2 Authentication Routes
**apps/api/src/routes/auth/index.ts**:
```typescript
import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { AuthService } from '../../services/auth';
import { authMiddleware } from '../../middleware/auth';

const auth = new Hono();

// Login
auth.post('/login', 
  validator('json', (value, c) => {
    const { email, password } = value;
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    return { email, password };
  }),
  async (c) => {
    try {
      const { email, password } = c.req.valid('json');
      const authService = c.get('authService') as AuthService;
      
      const result = await authService.login(email, password);
      
      return c.json({
        access: result.tokens.access,
        refresh: result.tokens.refresh,
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email
        }
      });
    } catch (error) {
      return c.json({ error: error.message }, 401);
    }
  }
);

// Register
auth.post('/register',
  validator('json', (value, c) => {
    const { username, email, password } = value;
    if (!username || !email || !password) {
      return c.json({ error: 'Username, email, and password are required' }, 400);
    }
    return { username, email, password };
  }),
  async (c) => {
    try {
      const { username, email, password } = c.req.valid('json');
      const authService = c.get('authService') as AuthService;
      
      const user = await authService.register(username, email, password);
      const tokens = await authService.generateTokens(user);
      
      return c.json({
        access: tokens.access,
        refresh: tokens.refresh,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      }, 201);
    } catch (error) {
      return c.json({ error: error.message }, 400);
    }
  }
);

// Get current user
auth.get('/user', authMiddleware(authService), async (c) => {
  const user = c.get('user');
  return c.json({
    id: user.sub,
    username: user.username,
    email: user.email
  });
});

// Token refresh
auth.post('/refresh',
  validator('json', (value, c) => {
    const { refresh } = value;
    if (!refresh) {
      return c.json({ error: 'Refresh token is required' }, 400);
    }
    return { refresh };
  }),
  async (c) => {
    try {
      const { refresh } = c.req.valid('json');
      const authService = c.get('authService') as AuthService;
      
      const payload = await authService.verifyToken(refresh);
      if (!payload || payload.type !== 'refresh') {
        return c.json({ error: 'Invalid refresh token' }, 401);
      }
      
      // Get user and generate new tokens
      const user = await authService.userQueries.findById(payload.sub);
      if (!user) {
        return c.json({ error: 'User not found' }, 401);
      }
      
      const tokens = await authService.generateTokens(user);
      return c.json({
        access: tokens.access,
        refresh: tokens.refresh
      });
    } catch (error) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }
  }
);

export { auth as authRoutes };
```

### 3.7 Testing Implementation
**Duration**: 1.5 days

#### 3.7.1 Unit Tests for Services
**apps/api/src/test/services/auth.test.ts**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../services/auth';

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn(),
          run: vi.fn()
        })
      })
    };
    authService = new AuthService(mockDb, 'test-secret');
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'testpassword';
      const hash = await authService.hashPassword(password);
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const password = 'testpassword';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid password', async () => {
      const password = 'testpassword';
      const hash = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword('wrongpassword', hash);
      expect(isValid).toBe(false);
    });
  });
});
```

#### 3.7.2 Integration Tests
**apps/api/src/test/integration/auth.test.ts**:
```typescript
import { describe, it, expect } from 'vitest';
import app from '../../index';

describe('Authentication Integration', () => {
  it('should handle login request', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    expect(res.status).toBe(401); // Since user doesn't exist
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('should validate required fields', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com'
        // Missing password
      })
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('password');
  });
});
```

### 3.8 Development and Deployment Scripts
**Duration**: 1 hour

#### 3.8.1 Development Scripts
**apps/api/package.json** (update scripts):
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler build",
    "deploy": "wrangler deploy",
    "deploy:staging": "wrangler deploy --env staging",
    "deploy:production": "wrangler deploy --env production",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src",
    "type-check": "tsc --noEmit",
    "db:migrate": "wrangler d1 execute list-cutter-db --file=src/db/migrations/001_initial.sql"
  }
}
```

#### 3.8.2 Database Migration Script
**apps/api/scripts/migrate.ts**:
```typescript
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const migrationsDir = join(__dirname, '../src/db/migrations');
  const migrations = ['001_initial.sql'];

  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration);
    const sql = readFileSync(migrationPath, 'utf8');
    
    console.log(`Running migration: ${migration}`);
    
    try {
      execSync(`wrangler d1 execute list-cutter-db --command="${sql}"`, {
        stdio: 'inherit'
      });
      console.log(`✅ Migration ${migration} completed`);
    } catch (error) {
      console.error(`❌ Migration ${migration} failed:`, error.message);
      process.exit(1);
    }
  }
}

runMigrations().catch(console.error);
```

## Validation Checklist

### 3.9 Pre-deployment Validation
- [ ] All TypeScript compiles without errors
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Database migrations run successfully
- [ ] Environment variables configured
- [ ] R2 bucket configured
- [ ] JWT secret set
- [ ] CORS configuration correct
- [ ] API endpoints respond correctly
- [ ] Authentication flow works end-to-end

### 3.10 Post-deployment Validation
- [ ] Workers API is accessible
- [ ] All endpoints return correct responses
- [ ] Authentication works with frontend
- [ ] File upload/download works
- [ ] CSV processing works
- [ ] Database operations work
- [ ] Error handling works correctly
- [ ] Performance is acceptable

## Migration Strategy

### 3.11 Parallel Development
- Keep Django API running during development
- Use feature flags to route specific endpoints to Workers
- Gradual migration of endpoints
- Comprehensive testing before full cutover

### 3.12 Data Migration
- Export existing PostgreSQL data
- Transform ArrayField to JSON strings
- Import to D1 database
- Verify data integrity

### 3.13 File Migration
- Download files from EC2 filesystem
- Upload to R2 with proper keys
- Update database file paths
- Verify file accessibility

## Success Criteria

- [ ] All Django API endpoints implemented in Workers
- [ ] Authentication system working
- [ ] File operations working with R2
- [ ] CSV processing matching Django functionality
- [ ] Database operations working with D1
- [ ] Performance meets or exceeds Django performance
- [ ] Ready for Phase 4 (database migration)

## Next Steps

After completing Phase 3:
1. **Backend API is fully implemented**
2. **Ready for Phase 4**: Database migration from PostgreSQL to D1
3. **Ready for Phase 5**: File storage migration from filesystem to R2
4. **Frontend integration**: Update frontend to use Workers API exclusively