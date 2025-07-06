# Phase 3: Full-Stack Migration to Cloudflare Workers

## Overview

This document provides a comprehensive technical implementation plan for migrating the entire List Cutter application (both frontend and backend) to Cloudflare Workers using TypeScript. Following Cloudflare's official recommendation to migrate from Pages to Workers for all new projects, we will deploy both the React frontend and API backend on Workers, leveraging Workers' new static asset hosting capabilities introduced in 2024-2025.

## Table of Contents

1. [Workers-Only Architecture](#workers-only-architecture)
2. [API Endpoint Mapping](#api-endpoint-mapping)
3. [TypeScript Data Models](#typescript-data-models)
4. [Workers Project Structure](#workers-project-structure)
5. [Frontend Static Asset Serving](#frontend-static-asset-serving)
6. [Endpoint Migration Guide](#endpoint-migration-guide)
7. [CSV Processing Logic](#csv-processing-logic)
8. [SQL Filter Parsing](#sql-filter-parsing)
9. [Error Handling Patterns](#error-handling-patterns)
10. [Testing Strategy](#testing-strategy)
11. [Incremental Migration Approach](#incremental-migration-approach)

## Workers-Only Architecture

### Why Workers Instead of Pages

As of 2024-2025, Cloudflare officially recommends using Workers over Pages for new projects:
- **Unified Platform**: Workers now supports static asset hosting, eliminating the need for separate Pages deployments
- **Enhanced Features**: Workers provides access to Durable Objects, Cron Triggers, comprehensive observability, and more
- **Development Focus**: Workers will receive Cloudflare's primary development efforts going forward
- **Cost Efficiency**: Static asset requests on Workers are free, matching Pages pricing model

### Architecture Benefits

1. **Single Deployment**: Both frontend and backend in one Worker
2. **Simplified Routing**: Unified routing logic for API and static assets
3. **Shared Configuration**: One wrangler.toml for the entire application
4. **Better Performance**: Reduced latency with co-located frontend and backend
5. **Enhanced Capabilities**: Access to full Workers feature set for both tiers

### Migration Path from Pages

For the frontend currently on Pages (Phase 2), we will:
1. Move static assets to Workers using the new static asset hosting
2. Configure asset bindings in wrangler.toml
3. Implement routing to serve both API and frontend from one Worker
4. Leverage Workers' built-in caching for static assets

## API Endpoint Mapping

### Current Django URLs to Workers Routes

| Django URL Pattern | HTTP Method | Workers Route | Priority |
|-------------------|-------------|---------------|----------|
| `/` | GET | `/` | Low |
| `/api/list_cutter/csv_cutter/` | POST | `/api/list_cutter/csv_cutter` | High |
| `/api/list_cutter/export_csv/` | POST | `/api/list_cutter/export_csv` | High |
| `/api/list_cutter/upload/` | POST | `/api/list_cutter/upload` | High |
| `/api/list_cutter/list_saved_files/` | GET | `/api/list_cutter/list_saved_files` | High |
| `/api/list_cutter/download/<filename>/` | GET | `/api/list_cutter/download/:filename` | Medium |
| `/api/list_cutter/delete/<file_id>/` | DELETE | `/api/list_cutter/delete/:file_id` | Medium |
| `/api/list_cutter/save_generated_file/` | POST | `/api/list_cutter/save_generated_file` | Medium |
| `/api/list_cutter/update_tags/<file_id>/` | PATCH | `/api/list_cutter/update_tags/:file_id` | Low |
| `/api/list_cutter/fetch_saved_file/<file_id>/` | GET | `/api/list_cutter/fetch_saved_file/:file_id` | Medium |
| `/api/list_cutter/fetch_file_lineage/<file_id>/` | GET | `/api/list_cutter/fetch_file_lineage/:file_id` | Low |
| `/api/accounts/register/` | POST | `/api/accounts/register` | High |
| `/api/accounts/login/` | POST | `/api/accounts/login` | High |
| `/api/accounts/token/refresh/` | POST | `/api/accounts/token/refresh` | High |
| `/api/accounts/user/` | GET | `/api/accounts/user` | High |

## TypeScript Data Models

### User Model

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

interface UserRegistration {
  username: string;
  email?: string;
  password: string;
  password2: string;
}
```

### SavedFile Model

```typescript
interface SavedFile {
  file_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  system_tags: string[];
  user_tags: string[];
  metadata?: Record<string, any>;
}

interface SavedFileCreate {
  user_id: string;
  file_name: string;
  file_path: string;
  system_tags: string[];
  metadata?: Record<string, any>;
}
```

### File Operations

```typescript
interface UploadResponse {
  columns?: string[];
  file_path: string;
  file_id?: string;
  file_name?: string;
}

interface ExportRequest {
  columns: string[];
  file_path: string;
  filters?: Record<string, string>;
}

interface FileLineage {
  nodes: Array<{
    file_id: string;
    file_name: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}
```

## Workers Project Structure

```
workers/
├── src/
│   ├── index.ts              # Main entry point with routing logic
│   ├── routes/
│   │   ├── api/              # API routes
│   │   │   ├── list_cutter/
│   │   │   │   ├── csv_cutter.ts
│   │   │   │   ├── export_csv.ts
│   │   │   │   ├── upload.ts
│   │   │   │   ├── list_files.ts
│   │   │   │   ├── download.ts
│   │   │   │   ├── delete.ts
│   │   │   │   └── ...
│   │   │   └── accounts/
│   │   │       ├── register.ts
│   │   │       ├── login.ts
│   │   │       └── user.ts
│   │   └── static.ts         # Static asset handler
│   ├── services/
│   │   ├── csv/
│   │   │   ├── parser.ts
│   │   │   ├── filter.ts
│   │   │   └── writer.ts
│   │   ├── storage/
│   │   │   ├── r2.ts
│   │   │   └── d1.ts
│   │   └── auth/
│   │       ├── jwt.ts
│   │       └── password.ts
│   ├── models/
│   │   ├── user.ts
│   │   └── saved_file.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── error.ts
│   │   └── router.ts         # Main routing middleware
│   └── utils/
│       ├── validators.ts
│       └── helpers.ts
├── public/                   # Frontend static assets (from React build)
│   ├── index.html
│   ├── assets/
│   │   ├── js/
│   │   ├── css/
│   │   └── images/
│   └── _headers             # Custom headers for static assets
├── wrangler.toml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Frontend Static Asset Serving

### Wrangler Configuration for Static Assets

```toml
# wrangler.toml
name = "list-cutter"
main = "src/index.ts"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

# Static asset configuration
[assets]
directory = "./public"
binding = "ASSETS"

# Browser rendering for dynamic routes
[browser]
binding = "BROWSER"

# Build configuration
[build]
command = "npm run build:all"

[build.upload]
rules = [
  { type = "CompiledWasm", globs = ["**/*.wasm"], fallthrough = true },
  { type = "Data", globs = ["**/*.html", "**/*.css", "**/*.js", "**/*.json"] }
]
```

### Main Router Implementation

```typescript
// src/index.ts
import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { apiRouter } from './routes/api';

const app = new Hono<{ Bindings: Env }>();

// API routes - higher priority
app.route('/api', apiRouter);

// Health check
app.get('/health', (c) => c.json({ status: 'healthy' }));

// Static assets - serve frontend
app.get('/*', serveStatic({ root: './' }));

// SPA fallback - serve index.html for client-side routing
app.get('/*', async (c) => {
  try {
    const asset = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
    return new Response(asset.body, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (e) {
    return c.text('Not Found', 404);
  }
});

export default app;
```

### Build Process Integration

```json
// package.json
{
  "scripts": {
    "build:frontend": "cd ../app/frontend && npm run build && cp -r dist/* ../workers/public/",
    "build:backend": "tsc && esbuild src/index.ts --bundle --format=esm --outfile=dist/index.js",
    "build:all": "npm run build:frontend && npm run build:backend",
    "dev": "wrangler dev --local",
    "deploy": "npm run build:all && wrangler deploy"
  }
}
```

### Custom Headers for Static Assets

```
# public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Content-Type: application/javascript
  Cache-Control: public, max-age=31536000

/*.css
  Content-Type: text/css
  Cache-Control: public, max-age=31536000

/index.html
  Cache-Control: no-cache
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

## Endpoint Migration Guide

### 1. CSV Cutter Upload Endpoint

**Django Implementation:**
```python
@api_view(['POST'])
@parser_classes([MultiPartParser])
def upload_file_for_csv_cutter(request):
    if 'file' not in request.FILES:
        return Response({'error': 'No file uploaded'}, status=400)
    
    file = request.FILES['file']
    file_path = save_uploaded_file(file)
    columns = get_csv_columns(file_path)
    return Response({'columns': columns, 'file_path': file_path}, status=200)
```

**TypeScript/Workers Implementation:**
```typescript
// src/routes/list_cutter/csv_cutter.ts
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

export async function handleCsvCutterUpload(
  request: Request, 
  env: Env
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Check file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File size exceeds ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)}MB limit` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate unique file path
    const fileId = uuidv4();
    const fileName = `uploads/${fileId}_${file.name}`;
    
    // Read file content
    const buffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(buffer);
    
    // Parse CSV to get columns
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true
    });
    
    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    
    // Save to R2
    await env.R2_BUCKET.put(fileName, buffer);
    
    return new Response(JSON.stringify({
      columns,
      file_path: fileName
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    return new Response(JSON.stringify({ 
      error: `Could not read CSV file: ${error.message}` 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 2. Export CSV Endpoint

**Django Implementation:**
```python
@api_view(['POST'])
def export_csv(request):
    selected_columns = request.data.get('columns')
    file_path = request.data.get('file_path')
    where_clauses = request.data.get('filters', {})
    
    csv_data = filter_csv_with_where(file_path, selected_columns, where_clauses)
    response = HttpResponse(csv_data, content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="filtered.csv"'
    return response
```

**TypeScript/Workers Implementation:**
```typescript
// src/routes/list_cutter/export_csv.ts
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { parseWhereClause } from '../../services/csv/filter';

export async function handleExportCsv(
  request: Request, 
  env: Env
): Promise<Response> {
  const body = await request.json() as ExportRequest;
  const { columns: selectedColumns, file_path, filters = {} } = body;
  
  if (!selectedColumns || selectedColumns.length === 0) {
    return new Response(JSON.stringify({ error: 'No columns provided.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Fetch file from R2
    const file = await env.R2_BUCKET.get(file_path);
    if (!file) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const content = await file.text();
    
    // Parse CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true
    });

    // Apply filters
    const filteredRecords = records.filter(row => {
      for (const [column, whereClause] of Object.entries(filters)) {
        if (column in row) {
          try {
            if (!parseWhereClause(row[column], whereClause)) {
              return false;
            }
          } catch (error) {
            return false;
          }
        }
      }
      return true;
    });

    // Select only requested columns
    const outputRecords = filteredRecords.map(row => {
      const newRow: Record<string, any> = {};
      for (const col of selectedColumns) {
        if (col in row) {
          newRow[col] = row[col];
        }
      }
      return newRow;
    });

    // Convert to CSV
    const csvOutput = stringify(outputRecords, {
      header: true,
      columns: selectedColumns
    });

    return new Response(csvOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="filtered.csv"'
      }
    });
  } catch (error) {
    console.error('Export CSV error:', error);
    return new Response(JSON.stringify({ 
      error: `Error processing CSV: ${error.message}` 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 3. Authenticated Upload Endpoint

**TypeScript/Workers Implementation:**
```typescript
// src/routes/list_cutter/upload.ts
import { verifyJWT } from '../../services/auth/jwt';
import { v4 as uuidv4 } from 'uuid';

export async function handleUpload(
  request: Request, 
  env: Env
): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.substring(7);
  const user = await verifyJWT(token, env.JWT_SECRET);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const MAX_FILE_SIZE = parseInt(env.MAX_FILE_SIZE || '10485760');
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File size exceeds ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(2)}MB limit.` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileId = uuidv4();
    const timestamp = Date.now();
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const extension = file.name.split('.').pop();
    const fileName = `${baseName}_${timestamp}.${extension}`;
    const filePath = `uploads/${fileId}_${fileName}`;
    
    // Save to R2
    const buffer = await file.arrayBuffer();
    await env.R2_BUCKET.put(filePath, buffer);
    
    // Save metadata to D1
    const uploadedAt = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO saved_files (
        file_id, user_id, file_name, file_path, 
        uploaded_at, system_tags, user_tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      user.id,
      fileName,
      filePath,
      uploadedAt,
      JSON.stringify(['uploaded']),
      JSON.stringify([]),
      JSON.stringify({})
    ).run();

    return new Response(JSON.stringify({
      message: 'File uploaded successfully',
      file_id: fileId,
      file_name: fileName,
      file_path: filePath
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('File upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'File upload failed. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 4. List Saved Files Endpoint

**TypeScript/Workers Implementation:**
```typescript
// src/routes/list_cutter/list_files.ts
export async function handleListSavedFiles(
  request: Request, 
  env: Env
): Promise<Response> {
  const user = await verifyAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Query D1 for user's files
    const result = await env.DB.prepare(`
      SELECT DISTINCT ON (file_name) 
        file_id, file_name, file_path, uploaded_at, 
        system_tags, user_tags, metadata
      FROM saved_files
      WHERE user_id = ?
      ORDER BY file_name, uploaded_at DESC
    `).bind(user.id).all();

    const files = result.results.map(row => ({
      file_id: row.file_id,
      file_name: row.file_name,
      file_path: row.file_path,
      uploaded_at: row.uploaded_at,
      system_tags: JSON.parse(row.system_tags as string || '[]'),
      user_tags: JSON.parse(row.user_tags as string || '[]'),
      metadata: JSON.parse(row.metadata as string || '{}')
    }));

    return new Response(JSON.stringify({ files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List files error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to list files' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## CSV Processing Logic

### Filter Parser Implementation

```typescript
// src/services/csv/filter.ts
export function parseWhereClause(value: string, condition: string): boolean {
  if (!condition || condition.trim() === '') {
    return true; // No condition = include all rows
  }

  const match = condition.match(/^([<>!=]=?|BETWEEN|IN)\s*(.+)$/i);
  if (!match) {
    throw new Error(`Invalid WHERE clause format: ${condition}`);
  }

  const [, operator, expression] = match;
  const upperOperator = operator.toUpperCase();

  // Convert value to number if possible
  const numValue = parseFloat(value);
  const isNumber = !isNaN(numValue);
  const cleanValue = value.trim();

  if (upperOperator === 'BETWEEN') {
    const bounds = expression.replace(/AND/i, '').trim().split(/\s+/);
    if (bounds.length !== 2) {
      throw new Error(`Invalid BETWEEN clause: ${condition}`);
    }
    const [lower, upper] = bounds.map(parseFloat);
    return isNumber && numValue >= lower && numValue <= upper;
  }

  if (upperOperator === 'IN') {
    const cleanExpression = expression.replace(/[()]/g, '').trim();
    const values = cleanExpression
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''));
    return values.includes(cleanValue);
  }

  // Numeric comparisons
  if (isNumber) {
    const compareValue = parseFloat(expression);
    switch (operator) {
      case '>': return numValue > compareValue;
      case '<': return numValue < compareValue;
      case '>=': return numValue >= compareValue;
      case '<=': return numValue <= compareValue;
      case '!=': return numValue !== compareValue;
      case '=':
      case '==': return numValue === compareValue;
    }
  }

  // String comparisons
  const cleanExpression = expression.replace(/['"]/g, '').trim();
  switch (operator) {
    case '!=': return cleanValue !== cleanExpression;
    case '=':
    case '==': return cleanValue === cleanExpression;
    default: return true;
  }
}
```

### CSV Writer Service

```typescript
// src/services/csv/writer.ts
import { stringify } from 'csv-stringify/sync';

export function generateCsv(
  records: Record<string, any>[],
  columns?: string[]
): string {
  const options = {
    header: true,
    columns: columns || undefined
  };
  
  return stringify(records, options);
}

export async function saveCsvToR2(
  env: Env,
  fileName: string,
  csvContent: string
): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(csvContent);
  
  await env.R2_BUCKET.put(fileName, buffer, {
    httpMetadata: {
      contentType: 'text/csv'
    }
  });
  
  return fileName;
}
```

## SQL Filter Parsing

### Advanced Filter Implementation

```typescript
// src/services/csv/advanced-filter.ts
interface FilterCondition {
  column: string;
  operator: string;
  value: string | number | string[];
}

export function parseComplexFilter(filterString: string): FilterCondition[] {
  // Parse SQL-like WHERE clauses into structured conditions
  const conditions: FilterCondition[] = [];
  
  // Handle AND/OR logic
  const parts = filterString.split(/\s+(AND|OR)\s+/i);
  
  for (const part of parts) {
    if (part.toUpperCase() === 'AND' || part.toUpperCase() === 'OR') {
      continue; // Skip logical operators for now
    }
    
    const match = part.match(/(\w+)\s*([<>!=]=?|BETWEEN|IN|LIKE)\s*(.+)/i);
    if (match) {
      const [, column, operator, value] = match;
      conditions.push({
        column: column.trim(),
        operator: operator.toUpperCase(),
        value: parseFilterValue(operator, value)
      });
    }
  }
  
  return conditions;
}

function parseFilterValue(
  operator: string, 
  value: string
): string | number | string[] {
  const upperOp = operator.toUpperCase();
  
  if (upperOp === 'IN') {
    return value
      .replace(/[()]/g, '')
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''));
  }
  
  if (upperOp === 'BETWEEN') {
    return value.replace(/AND/i, '').trim();
  }
  
  // Try to parse as number
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num;
  }
  
  // Return as string
  return value.replace(/['"]/g, '').trim();
}
```

## Error Handling Patterns

### Centralized Error Handler

```typescript
// src/middleware/error.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
  }
}

export function errorHandler(error: unknown): Response {
  console.error('Error:', error);
  
  if (error instanceof ApiError) {
    return new Response(JSON.stringify({
      error: error.message,
      details: error.details
    }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (error instanceof Error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    error: 'Internal server error'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Validation Utilities

```typescript
// src/utils/validators.ts
export function validateFileUpload(file: File): void {
  if (!file) {
    throw new ApiError(400, 'No file uploaded');
  }
  
  const validExtensions = ['.csv', '.txt'];
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validExtensions.includes(extension)) {
    throw new ApiError(400, 'Invalid file type. Only CSV and TXT files are allowed.');
  }
}

export function validateColumns(
  requestedColumns: string[], 
  availableColumns: string[]
): string[] {
  const validColumns = requestedColumns.filter(col => 
    availableColumns.includes(col)
  );
  
  if (validColumns.length === 0) {
    throw new ApiError(400, 'None of the selected columns are valid.');
  }
  
  return validColumns;
}
```

## Testing Strategy

### 1. Unit Tests for Core Logic

```typescript
// tests/services/csv/filter.test.ts
import { describe, it, expect } from 'vitest';
import { parseWhereClause } from '../../../src/services/csv/filter';

describe('parseWhereClause', () => {
  it('should handle numeric comparisons', () => {
    expect(parseWhereClause('100', '> 50')).toBe(true);
    expect(parseWhereClause('30', '> 50')).toBe(false);
    expect(parseWhereClause('50', '>= 50')).toBe(true);
  });
  
  it('should handle BETWEEN clauses', () => {
    expect(parseWhereClause('75', 'BETWEEN 50 AND 100')).toBe(true);
    expect(parseWhereClause('25', 'BETWEEN 50 AND 100')).toBe(false);
  });
  
  it('should handle IN clauses', () => {
    expect(parseWhereClause('apple', "IN ('apple', 'banana', 'orange')")).toBe(true);
    expect(parseWhereClause('grape', "IN ('apple', 'banana', 'orange')")).toBe(false);
  });
  
  it('should handle string equality', () => {
    expect(parseWhereClause('test', "= 'test'")).toBe(true);
    expect(parseWhereClause('test', "!= 'other'")).toBe(true);
  });
});
```

### 2. Integration Tests with Miniflare

```typescript
// tests/integration/endpoints.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Miniflare } from 'miniflare';

describe('API Endpoints', () => {
  let mf: Miniflare;
  
  beforeAll(async () => {
    mf = new Miniflare({
      script: './dist/index.js',
      modules: true,
      r2Buckets: ['LIST_CUTTER_FILES'],
      d1Databases: ['LIST_CUTTER_DB']
    });
  });
  
  it('should upload CSV file', async () => {
    const formData = new FormData();
    formData.append('file', new File(['col1,col2\nval1,val2'], 'test.csv'));
    
    const response = await mf.dispatchFetch('http://localhost/api/list_cutter/csv_cutter', {
      method: 'POST',
      body: formData
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.columns).toEqual(['col1', 'col2']);
  });
});
```

### 3. Parallel Django Comparison Testing

```typescript
// tests/compatibility/django-parity.test.ts
import { describe, it, expect } from 'vitest';
import { compareDjangoResponse } from './utils';

describe('Django API Compatibility', () => {
  it('should match Django CSV export behavior', async () => {
    const testData = {
      columns: ['name', 'age'],
      file_path: 'test.csv',
      filters: { age: '> 25' }
    };
    
    const [djangoResponse, workersResponse] = await Promise.all([
      fetch('http://django-backend/api/list_cutter/export_csv/', {
        method: 'POST',
        body: JSON.stringify(testData)
      }),
      fetch('http://workers-backend/api/list_cutter/export_csv', {
        method: 'POST',
        body: JSON.stringify(testData)
      })
    ]);
    
    const djangoCSV = await djangoResponse.text();
    const workersCSV = await workersResponse.text();
    
    expect(workersCSV).toBe(djangoCSV);
  });
});
```

## Incremental Migration Approach

### Phase 3.1: Workers Foundation & Static Assets (Week 1)
1. **Set up unified Workers project structure**
2. **Configure wrangler.toml for static assets**
3. **Migrate frontend from Pages to Workers**
4. **Implement main router with API/static separation**
5. **Deploy and test static asset serving**
6. **Set up CI/CD pipeline for unified deployment**

### Phase 3.2: Non-Authenticated Endpoints (Week 2)
1. **Home endpoint** (`/`) - serves React app
2. **CSV Cutter** (`/api/list_cutter/csv_cutter/`)
3. **Export CSV** (`/api/list_cutter/export_csv/`)
4. **Download File** (`/api/list_cutter/download/<filename>/`)
5. **Ensure frontend can communicate with co-located API**

### Phase 3.3: Authentication System (Week 3)
1. **JWT Implementation**
2. **Register endpoint** (`/api/accounts/register/`)
3. **Login endpoint** (`/api/accounts/login/`)
4. **Token refresh** (`/api/accounts/token/refresh/`)
5. **User info** (`/api/accounts/user/`)
6. **Update frontend auth to use relative API paths**

### Phase 3.4: Authenticated File Operations (Week 4)
1. **Upload file** (`/api/list_cutter/upload/`)
2. **List saved files** (`/api/list_cutter/list_saved_files/`)
3. **Delete file** (`/api/list_cutter/delete/<file_id>/`)
4. **Save generated file** (`/api/list_cutter/save_generated_file/`)

### Phase 3.5: Advanced Features & Optimization (Week 5)
1. **Update tags** (`/api/list_cutter/update_tags/<file_id>/`)
2. **Fetch saved file** (`/api/list_cutter/fetch_saved_file/<file_id>/`)
3. **File lineage** (`/api/list_cutter/fetch_file_lineage/<file_id>/`)
4. **Implement edge caching for static assets**
5. **Add performance monitoring**

### Migration Checklist

#### Frontend Migration
- [ ] Build React app for production
- [ ] Configure static asset directory in wrangler.toml
- [ ] Set up asset binding and caching rules
- [ ] Test SPA routing with Workers
- [ ] Update API calls to use relative paths
- [ ] Remove Pages-specific configuration
- [ ] Test static asset performance

#### Per API Endpoint
- [ ] Write TypeScript implementation
- [ ] Add request/response validation
- [ ] Implement error handling
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Compare output with Django
- [ ] Update API documentation
- [ ] Test with co-located frontend
- [ ] Monitor for errors

#### Deployment
- [ ] Deploy unified Worker to staging
- [ ] Test full application functionality
- [ ] Verify static asset caching
- [ ] Performance benchmarking
- [ ] Deploy to production
- [ ] Update DNS (single A record for Workers)
- [ ] Remove Pages deployment

### Rollback Strategy

1. **Feature Flags**: Use Cloudflare's percentage-based routing
2. **Dual Running**: Keep Django running during migration
3. **Quick Rollback**: DNS changes can revert in minutes
4. **Data Sync**: Ensure R2 and Django storage stay in sync during transition

### Success Metrics

- Response time < 100ms for file operations
- Zero data loss during migration
- API compatibility maintained (no frontend changes required)
- Error rate < 0.1%
- Cost reduction > 50% compared to current infrastructure

## Next Steps

1. **Set up unified Workers project**
   - Initialize Workers project with static asset support
   - Configure wrangler.toml for both frontend and backend
   - Set up build pipeline for React + TypeScript

2. **Migrate frontend from Pages**
   - Build React app and copy to Workers public directory
   - Configure asset bindings and caching
   - Test SPA routing with Workers

3. **Create D1 database schema**
   - Set up development and production databases
   - Run initial migrations

4. **Implement core infrastructure**
   - Main router with API/static separation
   - JWT authentication system
   - Middleware for CORS, auth, and error handling

5. **Begin API migration**
   - Start with Phase 3.2 non-authenticated endpoints
   - Ensure frontend-backend integration works

6. **Set up testing and deployment**
   - Comprehensive testing suite with Vitest
   - Staging environment for unified app
   - CI/CD pipeline for automated deployment

## Benefits of Unified Workers Deployment

1. **Simplified Architecture**: Single deployment target for entire application
2. **Better Performance**: Reduced latency between frontend and backend
3. **Cost Efficiency**: Free static asset requests, single Worker billing
4. **Enhanced Features**: Access to full Workers ecosystem
5. **Easier Maintenance**: One codebase, one deployment, one monitoring setup
6. **Future-Proof**: Aligned with Cloudflare's recommended architecture