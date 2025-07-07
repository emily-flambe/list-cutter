# Phase 5: File Storage Migration to R2 - Workers-Integrated Implementation

## Overview

This document provides a detailed technical implementation plan for migrating the List Cutter application's file storage from local filesystem to Cloudflare R2 object storage. Following our unified Workers architecture, R2 will be directly bound to our single Worker deployment serving both frontend and backend. The integration leverages R2's native Workers bindings for zero-latency file access, with metadata stored in D1 for a fully integrated Cloudflare stack.

## Current Architecture Analysis

### Current File Storage System

**Storage Location**: Local filesystem using Django MEDIA_ROOT
- Upload directory: `app/media/uploads/`
- Generated files: `app/media/generated/`
- Max file size: 10MB (configurable via `MAX_FILE_SIZE` env var)

**Database Schema** (PostgreSQL):
```sql
-- SavedFile model
CREATE TABLE list_cutter_savedfile (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_user(id),
    file_id VARCHAR(255) UNIQUE NOT NULL,
    file_name VARCHAR(255) UNIQUE NOT NULL,
    file_path VARCHAR(500) UNIQUE NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    system_tags TEXT[],
    user_tags TEXT[],
    metadata JSONB
);
```

**Current File Operations**:
- Upload: `save_uploaded_file()` saves to local filesystem
- Download: `FileResponse` serves files directly from filesystem
- Metadata: File info stored in PostgreSQL with full file path
- Processing: In-memory CSV processing with pandas

## Target R2 Architecture

### R2 Bucket Structure

**Bucket Organization**:
```
<<<<<<< HEAD
cutty-files/
=======
cutty-files-{environment}/
>>>>>>> origin/main
├── uploads/
│   ├── user-{user_id}/
│   │   ├── {file_id}.csv
│   │   └── {file_id}.json (metadata)
├── generated/
│   ├── user-{user_id}/
│   │   ├── {file_id}-filtered.csv
│   │   └── {file_id}-processed.csv
└── temp/
    ├── multipart-uploads/
    └── processing/
```

**Key Naming Convention**:
- User-scoped: `uploads/user-{user_id}/{file_id}.csv`
- Generated files: `generated/user-{user_id}/{file_id}-{operation}.csv`
- Metadata files: `uploads/user-{user_id}/{file_id}.json`

### D1 Database Schema

**Updated SavedFile schema for D1**:
```sql
CREATE TABLE saved_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    r2_key TEXT NOT NULL,  -- R2 object key
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    uploaded_at DATETIME NOT NULL,
    system_tags TEXT,  -- JSON array as text
    user_tags TEXT,    -- JSON array as text
    metadata TEXT,     -- JSON object as text
    checksum TEXT,     -- File integrity verification
    storage_class TEXT DEFAULT 'Standard',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_saved_files_r2_key ON saved_files(r2_key);
```

## Workers-R2 Integration Architecture

### R2 in the Unified Workers Environment

With our unified Workers deployment, R2 provides seamless object storage integration:

1. **Direct Binding**: R2 buckets are bound directly to the Worker through wrangler.toml
2. **Zero Egress Fees**: Worker-to-R2 communication is free within Cloudflare
3. **Native API**: Use R2's native JavaScript API without SDK overhead
4. **Automatic Replication**: R2 handles global distribution automatically
5. **Integrated Auth**: Leverage Workers' authentication for R2 access control

### Unified Wrangler Configuration

```toml
# wrangler.toml
name = "cutty"
main = "src/index.ts"
compatibility_date = "2024-12-30"

# R2 Storage bindings
[[r2_buckets]]
binding = "FILE_STORAGE"
<<<<<<< HEAD
bucket_name = "cutty-files-prod"
preview_bucket_name = "cutty-files-staging"
=======
bucket_name = "cutty-files-production"
preview_bucket_name = "cutty-files-preview"
>>>>>>> origin/main

# Development R2 bucket
[env.development.r2_buckets]
[[env.development.r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-dev"

# D1 Database (for file metadata)
[[d1_databases]]
binding = "DB"
database_name = "cutty-production"
database_id = "your-database-id"

# Environment variables
[vars]
MAX_FILE_SIZE = "52428800"  # 50MB
ALLOWED_FILE_TYPES = "text/csv,application/vnd.ms-excel,text/plain"
FILE_RETENTION_DAYS = "90"
```

### R2 Access Pattern in Unified Workers

```typescript
// src/types/env.ts
export interface Env {
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  ASSETS: Fetcher;
  // Other bindings...
}

// src/services/storage/r2-service.ts
export class R2Service {
  constructor(
    private bucket: R2Bucket,
    private db: D1Database
  ) {}

  async uploadFile(
    file: File,
    userId: string,
    request: Request
  ): Promise<UploadResult> {
    const fileId = crypto.randomUUID();
    const key = `uploads/user-${userId}/${fileId}-${file.name}`;
    
    // Upload to R2
    const object = await this.bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        userId,
        fileId,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });
    
    // Store metadata in D1
    await this.db.prepare(`
      INSERT INTO saved_files (
        user_id, file_id, file_name, r2_key, file_size, 
        content_type, uploaded_at, checksum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, fileId, file.name, key, file.size,
      file.type, new Date().toISOString(), object.etag
    ).run();
    
    return { fileId, key, etag: object.etag };
  }

  async downloadFile(fileId: string, userId: string): Promise<Response> {
    // Get metadata from D1
    const fileData = await this.db.prepare(`
      SELECT r2_key, file_name, content_type 
      FROM saved_files 
      WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).first();
    
    if (!fileData) {
      return new Response('File not found', { status: 404 });
    }
    
    // Stream from R2
    const object = await this.bucket.get(fileData.r2_key);
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }
    
    return new Response(object.body, {
      headers: {
        'Content-Type': fileData.content_type,
        'Content-Disposition': `attachment; filename="${fileData.file_name}"`,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  }
}
```

### Benefits of R2 with Unified Workers

1. **Single Deployment**: R2, D1, and application code in one Worker
2. **Simplified Architecture**: No separate storage service or CDN needed
3. **Cost Efficiency**: Free bandwidth between Workers and R2
4. **Global Performance**: R2's automatic replication with Worker's edge compute
5. **Unified Security**: Single authentication layer for app and storage

## Implementation Plan

### 1. R2 Bucket Setup and Configuration

#### 1.1 Bucket Creation
```bash
# Create R2 bucket
npx wrangler r2 bucket create cutty-files-dev

# Configure CORS for web uploads
npx wrangler r2 bucket cors put cutty-files-dev --file cors.json
```

#### 1.2 CORS Configuration (`cors.json`)
```json
{
  "rules": [
    {
      "allowedOrigins": ["*"],
      "allowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "allowedHeaders": ["*"],
      "exposedHeaders": ["ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

#### 1.3 Unified Worker Configuration

Since we're using a unified Workers deployment, R2 configuration is integrated with our main wrangler.toml alongside frontend assets and D1:

```toml
# wrangler.toml (complete unified configuration)
name = "cutty"
main = "src/index.ts"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

# Frontend static assets
[assets]
directory = "./public"
binding = "ASSETS"

# R2 Storage
[[r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-dev"
<<<<<<< HEAD
preview_bucket_name = "cutty-files-staging"
=======
preview_bucket_name = "cutty-files-preview"
>>>>>>> origin/main

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "cutty-db"
database_id = "your-d1-database-id"
migrations_dir = "./migrations"

# Environment variables
[vars]
MAX_FILE_SIZE = "52428800"  # 50MB (increased from 10MB)
ALLOWED_FILE_TYPES = "text/csv,application/vnd.ms-excel,text/plain"
API_VERSION = "v1"
```

### 2. TypeScript R2 Integration in Unified Worker

#### 2.1 R2 Service Layer with D1 Integration (`src/services/storage/r2-storage.ts`)
```typescript
export interface FileUploadOptions {
  userId: number;
  fileId: string;
  fileName: string;
  contentType: string;
  metadata?: Record<string, any>;
  storageClass?: 'Standard' | 'InfrequentAccess';
}

export interface FileDownloadOptions {
  userId: number;
  fileId: string;
  range?: string;
}

export class R2StorageService {
  constructor(private bucket: R2Bucket) {}

  async uploadFile(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    options: FileUploadOptions
  ): Promise<R2Object> {
    const key = this.generateFileKey(options.userId, options.fileId);
    
    const uploadOptions: R2PutOptions = {
      httpMetadata: {
        contentType: options.contentType,
        cacheControl: 'public, max-age=3600',
      },
      customMetadata: {
        originalName: options.fileName,
        userId: options.userId.toString(),
        fileId: options.fileId,
        uploadedAt: new Date().toISOString(),
        ...options.metadata,
      },
      storageClass: options.storageClass || 'Standard',
    };

    const result = await this.bucket.put(key, fileData, uploadOptions);
    
    if (!result) {
      throw new Error('Failed to upload file to R2');
    }

    return result;
  }

  async downloadFile(options: FileDownloadOptions): Promise<R2ObjectBody | null> {
    const key = this.generateFileKey(options.userId, options.fileId);
    
    const downloadOptions: R2GetOptions = {};
    if (options.range) {
      downloadOptions.range = this.parseRange(options.range);
    }

    return await this.bucket.get(key, downloadOptions);
  }

  async deleteFile(userId: number, fileId: string): Promise<void> {
    const key = this.generateFileKey(userId, fileId);
    await this.bucket.delete(key);
  }

  async getFileMetadata(userId: number, fileId: string): Promise<R2Object | null> {
    const key = this.generateFileKey(userId, fileId);
    return await this.bucket.head(key);
  }

  async listUserFiles(userId: number, limit = 100, cursor?: string): Promise<R2Objects> {
    const prefix = `uploads/user-${userId}/`;
    
    const options: R2ListOptions = {
      prefix,
      limit,
    };
    
    if (cursor) {
      options.cursor = cursor;
    }

    return await this.bucket.list(options);
  }

  private generateFileKey(userId: number, fileId: string): string {
    return `uploads/user-${userId}/${fileId}.csv`;
  }

  private parseRange(range: string): R2Range {
    const match = range.match(/^bytes=(\d+)-(\d+)?$/);
    if (!match) {
      throw new Error('Invalid range format');
    }
    
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : undefined;
    
    return { offset: start, length: end ? end - start + 1 : undefined };
  }
}
```

#### 2.2 Large File Upload with Multipart API (`src/services/multipartUpload.ts`)
```typescript
export interface MultipartUploadSession {
  uploadId: string;
  fileId: string;
  key: string;
  parts: Array<{
    partNumber: number;
    etag: string;
    size: number;
  }>;
  createdAt: Date;
  userId: number;
}

export class MultipartUploadService {
  constructor(private bucket: R2Bucket, private db: D1Database) {}

  async initiateMultipartUpload(
    userId: number,
    fileId: string,
    fileName: string,
    contentType: string
  ): Promise<MultipartUploadSession> {
    const key = `uploads/user-${userId}/${fileId}.csv`;
    
    const multipartUpload = await this.bucket.createMultipartUpload(key, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=3600',
      },
      customMetadata: {
        originalName: fileName,
        userId: userId.toString(),
        fileId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const session: MultipartUploadSession = {
      uploadId: multipartUpload.uploadId,
      fileId,
      key,
      parts: [],
      createdAt: new Date(),
      userId,
    };

    // Store session in D1 for tracking
    await this.db.prepare(`
      INSERT INTO multipart_uploads 
      (upload_id, file_id, user_id, key, created_at, session_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      multipartUpload.uploadId,
      fileId,
      userId,
      key,
      session.createdAt.toISOString(),
      JSON.stringify(session)
    ).run();

    return session;
  }

  async uploadPart(
    uploadId: string,
    partNumber: number,
    data: ArrayBuffer | ReadableStream
  ): Promise<R2UploadedPart> {
    // Retrieve session
    const sessionResult = await this.db.prepare(`
      SELECT session_data FROM multipart_uploads WHERE upload_id = ?
    `).bind(uploadId).first();

    if (!sessionResult) {
      throw new Error('Upload session not found');
    }

    const session: MultipartUploadSession = JSON.parse(sessionResult.session_data as string);
    
    const uploadedPart = await this.bucket.uploadPart(session.key, uploadId, partNumber, data);
    
    // Update session with part info
    session.parts.push({
      partNumber,
      etag: uploadedPart.etag,
      size: data instanceof ArrayBuffer ? data.byteLength : 0,
    });

    // Update session in database
    await this.db.prepare(`
      UPDATE multipart_uploads 
      SET session_data = ? 
      WHERE upload_id = ?
    `).bind(JSON.stringify(session), uploadId).run();

    return uploadedPart;
  }

  async completeMultipartUpload(uploadId: string): Promise<R2Object> {
    // Retrieve session
    const sessionResult = await this.db.prepare(`
      SELECT session_data FROM multipart_uploads WHERE upload_id = ?
    `).bind(uploadId).first();

    if (!sessionResult) {
      throw new Error('Upload session not found');
    }

    const session: MultipartUploadSession = JSON.parse(sessionResult.session_data as string);
    
    const result = await this.bucket.completeMultipartUpload(session.key, uploadId, session.parts);
    
    // Clean up session
    await this.db.prepare(`
      DELETE FROM multipart_uploads WHERE upload_id = ?
    `).bind(uploadId).run();

    return result;
  }

  async abortMultipartUpload(uploadId: string): Promise<void> {
    const sessionResult = await this.db.prepare(`
      SELECT session_data FROM multipart_uploads WHERE upload_id = ?
    `).bind(uploadId).first();

    if (!sessionResult) {
      throw new Error('Upload session not found');
    }

    const session: MultipartUploadSession = JSON.parse(sessionResult.session_data as string);
    
    await this.bucket.abortMultipartUpload(session.key, uploadId);
    
    // Clean up session
    await this.db.prepare(`
      DELETE FROM multipart_uploads WHERE upload_id = ?
    `).bind(uploadId).run();
  }
}
```

### 3. File Upload Handler (`src/routes/files/upload.ts`)
```typescript
import { R2StorageService } from '../../services/r2Storage';
import { MultipartUploadService } from '../../services/multipartUpload';

export async function handleFileUpload(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response('Expected multipart/form-data', { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response('No file uploaded', { status: 400 });
    }

    // Validate file type
    const allowedTypes = env.ALLOWED_FILE_TYPES.split(',');
    if (!allowedTypes.includes(file.type)) {
      return new Response('Invalid file type', { status: 400 });
    }

    // Validate file size
    const maxSize = parseInt(env.MAX_FILE_SIZE);
    if (file.size > maxSize) {
      return new Response(`File too large. Max size: ${maxSize} bytes`, { status: 400 });
    }

    const userId = await getUserIdFromRequest(request, env);
    const fileId = generateFileId();
    
    const storageService = new R2StorageService(env.FILES_BUCKET);
    
    // For files larger than 5MB, use multipart upload
    if (file.size > 5 * 1024 * 1024) {
      return await handleLargeFileUpload(file, userId, fileId, storageService, env);
    }

    // Standard upload for smaller files
    const fileData = await file.arrayBuffer();
    
    const uploadResult = await storageService.uploadFile(fileData, {
      userId,
      fileId,
      fileName: file.name,
      contentType: file.type,
      metadata: {
        originalSize: file.size,
        checksum: await calculateChecksum(fileData),
      },
    });

    // Save metadata to D1
    await saveFileMetadata(env.DB, {
      userId,
      fileId,
      fileName: file.name,
      r2Key: uploadResult.key,
      fileSize: file.size,
      contentType: file.type,
      checksum: await calculateChecksum(fileData),
      metadata: {
        originalSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      fileId,
      fileName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('File upload failed:', error);
    return new Response('Upload failed', { status: 500 });
  }
}

async function handleLargeFileUpload(
  file: File,
  userId: number,
  fileId: string,
  storageService: R2StorageService,
  env: Env
): Promise<Response> {
  const multipartService = new MultipartUploadService(env.FILES_BUCKET, env.DB);
  
  try {
    // Initiate multipart upload
    const session = await multipartService.initiateMultipartUpload(
      userId,
      fileId,
      file.name,
      file.type
    );

    // For demo purposes, we'll upload in 5MB chunks
    const chunkSize = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    const uploadPromises: Promise<any>[] = [];
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      const uploadPromise = multipartService.uploadPart(
        session.uploadId,
        i + 1,
        await chunk.arrayBuffer()
      );
      
      uploadPromises.push(uploadPromise);
    }

    // Wait for all parts to upload
    await Promise.all(uploadPromises);
    
    // Complete multipart upload
    const result = await multipartService.completeMultipartUpload(session.uploadId);
    
    // Save metadata to D1
    await saveFileMetadata(env.DB, {
      userId,
      fileId,
      fileName: file.name,
      r2Key: result.key,
      fileSize: file.size,
      contentType: file.type,
      checksum: result.etag,
      metadata: {
        originalSize: file.size,
        uploadedAt: new Date().toISOString(),
        multipart: true,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      fileId,
      fileName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // Clean up failed upload
    try {
      await multipartService.abortMultipartUpload(session.uploadId);
    } catch (cleanupError) {
      console.error('Failed to cleanup multipart upload:', cleanupError);
    }
    
    throw error;
  }
}
```

### 4. File Download Handler (`src/routes/files/download.ts`)
```typescript
export async function handleFileDownload(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const fileId = url.pathname.split('/').pop();
    
    if (!fileId) {
      return new Response('File ID required', { status: 400 });
    }

    const userId = await getUserIdFromRequest(request, env);
    
    // Check if user has access to this file
    const fileRecord = await env.DB.prepare(`
      SELECT * FROM saved_files 
      WHERE file_id = ? AND user_id = ?
    `).bind(fileId, userId).first();

    if (!fileRecord) {
      return new Response('File not found', { status: 404 });
    }

    const storageService = new R2StorageService(env.FILES_BUCKET);
    
    // Check for range requests (for streaming/partial downloads)
    const range = request.headers.get('range');
    
    const fileObject = await storageService.downloadFile({
      userId,
      fileId,
      range: range || undefined,
    });

    if (!fileObject) {
      return new Response('File not found in storage', { status: 404 });
    }

    // Determine response status
    const status = range ? 206 : 200;
    
    // Build response headers
    const headers = new Headers();
    headers.set('Content-Type', fileRecord.content_type as string);
    headers.set('Content-Length', fileObject.size.toString());
    headers.set('Content-Disposition', `attachment; filename="${fileRecord.file_name}"`);
    headers.set('ETag', fileObject.etag);
    headers.set('Last-Modified', fileObject.uploaded.toUTCString());
    
    // Add cache headers
    headers.set('Cache-Control', 'private, max-age=3600');
    
    // Handle range requests
    if (range && fileObject.range) {
      headers.set('Content-Range', 
        `bytes ${fileObject.range.offset}-${fileObject.range.offset + fileObject.range.length - 1}/${fileObject.size}`
      );
      headers.set('Accept-Ranges', 'bytes');
    }

    return new Response(fileObject.body, {
      status,
      headers,
    });

  } catch (error) {
    console.error('File download failed:', error);
    return new Response('Download failed', { status: 500 });
  }
}
```

### 5. File Processing with Streaming (`src/services/csvProcessor.ts`)
```typescript
export class StreamingCSVProcessor {
  constructor(private bucket: R2Bucket) {}

  async processCSVWithFilters(
    userId: number,
    fileId: string,
    selectedColumns: string[],
    whereFilters: Record<string, string>
  ): Promise<ReadableStream<Uint8Array>> {
    const key = `uploads/user-${userId}/${fileId}.csv`;
    const fileObject = await this.bucket.get(key);
    
    if (!fileObject) {
      throw new Error('File not found');
    }

    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();
    
    return new ReadableStream({
      start(controller) {
        // Send CSV header
        const header = selectedColumns.join(',') + '\n';
        controller.enqueue(textEncoder.encode(header));
      },
      
      async pull(controller) {
        const reader = fileObject.body.getReader();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            buffer += textDecoder.decode(value, { stream: true });
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.trim()) {
                const processedLine = this.processCSVLine(line, selectedColumns, whereFilters);
                if (processedLine) {
                  controller.enqueue(textEncoder.encode(processedLine + '\n'));
                }
              }
            }
          }
          
          // Process remaining buffer
          if (buffer.trim()) {
            const processedLine = this.processCSVLine(buffer, selectedColumns, whereFilters);
            if (processedLine) {
              controller.enqueue(textEncoder.encode(processedLine + '\n'));
            }
          }
          
          controller.close();
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      }
    });
  }

  private processCSVLine(
    line: string,
    selectedColumns: string[],
    whereFilters: Record<string, string>
  ): string | null {
    // Parse CSV line and apply filters
    const values = this.parseCSVLine(line);
    
    // Apply WHERE filters
    for (const [column, filter] of Object.entries(whereFilters)) {
      const columnIndex = selectedColumns.indexOf(column);
      if (columnIndex !== -1) {
        const value = values[columnIndex];
        if (!this.evaluateFilter(value, filter)) {
          return null; // Filter out this row
        }
      }
    }
    
    // Return filtered columns
    return selectedColumns.map(col => {
      const index = selectedColumns.indexOf(col);
      return values[index] || '';
    }).join(',');
  }

  private parseCSVLine(line: string): string[] {
    // Simple CSV parser - you might want to use a more robust one
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  private evaluateFilter(value: string, filter: string): boolean {
    // Implement your filter logic here
    // This is a simplified version - expand based on your needs
    if (!filter) return true;
    
    if (filter.startsWith('=')) {
      return value === filter.substring(1);
    } else if (filter.startsWith('>')) {
      return parseFloat(value) > parseFloat(filter.substring(1));
    } else if (filter.startsWith('<')) {
      return parseFloat(value) < parseFloat(filter.substring(1));
    }
    
    return true;
  }
}
```

## File Migration Strategy

### 1. Pre-Migration Assessment

#### 1.1 Audit Current Files
```typescript
// Migration audit script
async function auditCurrentFiles(env: Env): Promise<MigrationAudit> {
  const files = await env.DB.prepare(`
    SELECT file_id, file_name, file_path, file_size, user_id, uploaded_at
    FROM saved_files
    ORDER BY uploaded_at DESC
  `).all();

  const audit: MigrationAudit = {
    totalFiles: files.results.length,
    totalSize: 0,
    userDistribution: {},
    sizeDistribution: { small: 0, medium: 0, large: 0 },
    oldestFile: null,
    newestFile: null,
  };

  for (const file of files.results) {
    const size = file.file_size as number;
    audit.totalSize += size;
    
    // Track user distribution
    const userId = file.user_id as number;
    audit.userDistribution[userId] = (audit.userDistribution[userId] || 0) + 1;
    
    // Size distribution
    if (size < 1024 * 1024) { // < 1MB
      audit.sizeDistribution.small++;
    } else if (size < 10 * 1024 * 1024) { // < 10MB
      audit.sizeDistribution.medium++;
    } else {
      audit.sizeDistribution.large++;
    }
  }

  return audit;
}
```

### 2. Batch Migration Script

#### 2.1 Migration Worker (`src/migration/filesMigration.ts`)
```typescript
export interface MigrationBatch {
  files: Array<{
    fileId: string;
    localPath: string;
    userId: number;
    fileName: string;
    fileSize: number;
  }>;
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export class FilesMigrationService {
  constructor(private bucket: R2Bucket, private db: D1Database) {}

  async migrateBatch(batch: MigrationBatch): Promise<void> {
    console.log(`Starting migration batch ${batch.batchId} with ${batch.files.length} files`);

    const results: Array<{ fileId: string; success: boolean; error?: string }> = [];

    for (const file of batch.files) {
      try {
        await this.migrateFile(file);
        results.push({ fileId: file.fileId, success: true });
        console.log(`✓ Migrated ${file.fileName}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ fileId: file.fileId, success: false, error: errorMsg });
        console.error(`✗ Failed to migrate ${file.fileName}: ${errorMsg}`);
      }
    }

    // Log batch results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Batch ${batch.batchId} completed: ${successful} successful, ${failed} failed`);

    // Update migration status in database
    await this.updateMigrationStatus(batch.batchId, results);
  }

  private async migrateFile(file: {
    fileId: string;
    localPath: string;
    userId: number;
    fileName: string;
    fileSize: number;
  }): Promise<void> {
    // Read file from local filesystem (you'd need to implement this)
    const fileData = await this.readLocalFile(file.localPath);
    
    // Calculate checksum for integrity verification
    const checksum = await this.calculateChecksum(fileData);
    
    // Upload to R2
    const r2Key = `uploads/user-${file.userId}/${file.fileId}.csv`;
    
    await this.bucket.put(r2Key, fileData, {
      httpMetadata: {
        contentType: 'text/csv',
        cacheControl: 'public, max-age=3600',
      },
      customMetadata: {
        originalName: file.fileName,
        userId: file.userId.toString(),
        fileId: file.fileId,
        migratedAt: new Date().toISOString(),
        originalPath: file.localPath,
        checksum,
      },
    });

    // Update database record
    await this.db.prepare(`
      UPDATE saved_files 
      SET r2_key = ?, checksum = ?, migrated_at = ?
      WHERE file_id = ?
    `).bind(r2Key, checksum, new Date().toISOString(), file.fileId).run();

    // Verify upload
    const verification = await this.verifyMigration(file.fileId, fileData);
    if (!verification.success) {
      throw new Error(`Verification failed: ${verification.error}`);
    }
  }

  private async verifyMigration(fileId: string, originalData: ArrayBuffer): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get file info from database
      const fileRecord = await this.db.prepare(`
        SELECT r2_key, checksum FROM saved_files WHERE file_id = ?
      `).bind(fileId).first();

      if (!fileRecord) {
        return { success: false, error: 'File record not found' };
      }

      // Download from R2
      const r2Object = await this.bucket.get(fileRecord.r2_key as string);
      
      if (!r2Object) {
        return { success: false, error: 'File not found in R2' };
      }

      // Verify checksum
      const downloadedData = await r2Object.arrayBuffer();
      const downloadedChecksum = await this.calculateChecksum(downloadedData);
      
      if (downloadedChecksum !== fileRecord.checksum) {
        return { success: false, error: 'Checksum mismatch' };
      }

      // Verify file size
      if (downloadedData.byteLength !== originalData.byteLength) {
        return { success: false, error: 'File size mismatch' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown verification error' 
      };
    }
  }

  private async readLocalFile(path: string): Promise<ArrayBuffer> {
    // This would need to be implemented based on your migration environment
    // For example, if running in Node.js, you'd use fs.readFile
    throw new Error('readLocalFile not implemented - depends on migration environment');
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async updateMigrationStatus(
    batchId: string,
    results: Array<{ fileId: string; success: boolean; error?: string }>
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO migration_batches 
      (batch_id, completed_at, total_files, successful_files, failed_files, results)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      batchId,
      new Date().toISOString(),
      results.length,
      results.filter(r => r.success).length,
      results.filter(r => !r.success).length,
      JSON.stringify(results)
    ).run();
  }
}
```

### 3. Migration Validation

#### 3.1 Post-Migration Validation Script
```typescript
export class MigrationValidator {
  constructor(private bucket: R2Bucket, private db: D1Database) {}

  async validateMigration(): Promise<ValidationReport> {
    const report: ValidationReport = {
      totalFiles: 0,
      validatedFiles: 0,
      failedFiles: 0,
      errors: [],
      completedAt: new Date(),
    };

    // Get all migrated files
    const files = await this.db.prepare(`
      SELECT file_id, r2_key, checksum, file_size, user_id 
      FROM saved_files 
      WHERE r2_key IS NOT NULL
    `).all();

    report.totalFiles = files.results.length;

    for (const file of files.results) {
      try {
        const isValid = await this.validateFile(file);
        if (isValid) {
          report.validatedFiles++;
        } else {
          report.failedFiles++;
          report.errors.push(`File ${file.file_id} validation failed`);
        }
      } catch (error) {
        report.failedFiles++;
        report.errors.push(`File ${file.file_id} error: ${error.message}`);
      }
    }

    return report;
  }

  private async validateFile(file: any): Promise<boolean> {
    // Check if file exists in R2
    const r2Object = await this.bucket.get(file.r2_key);
    
    if (!r2Object) {
      return false;
    }

    // Verify size
    if (r2Object.size !== file.file_size) {
      return false;
    }

    // Verify checksum if available
    if (file.checksum) {
      const data = await r2Object.arrayBuffer();
      const computedChecksum = await this.calculateChecksum(data);
      
      if (computedChecksum !== file.checksum) {
        return false;
      }
    }

    return true;
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

## URL Generation and Access Control

### 1. Signed URL Generation
```typescript
export class SignedURLService {
  constructor(private bucket: R2Bucket) {}

  async generateSignedDownloadURL(
    userId: number,
    fileId: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const key = `uploads/user-${userId}/${fileId}.csv`;
    
    // Generate signed URL for temporary access
    const signedUrl = await this.bucket.createSignedUrl(key, {
      expiresIn,
      action: 'read',
    });

    return signedUrl;
  }

  async generateSignedUploadURL(
    userId: number,
    fileId: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<{ url: string; fields: Record<string, string> }> {
    const key = `uploads/user-${userId}/${fileId}.csv`;
    
    // Generate pre-signed POST URL for direct browser uploads
    const presignedPost = await this.bucket.createSignedPostUrl(key, {
      expiresIn,
      conditions: [
        ['content-length-range', 0, 10485760], // 10MB max
        ['eq', '$Content-Type', contentType],
      ],
    });

    return presignedPost;
  }
}
```

### 2. Access Control Middleware
```typescript
export async function fileAccessControl(
  request: Request,
  env: Env,
  fileId: string
): Promise<{ authorized: boolean; userId?: number; error?: string }> {
  try {
    // Extract user from JWT token
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return { authorized: false, error: 'No authorization token' };
    }

    const userId = await verifyJWT(token, env.JWT_SECRET);
    
    if (!userId) {
      return { authorized: false, error: 'Invalid token' };
    }

    // Check if user owns the file
    const fileRecord = await env.DB.prepare(`
      SELECT user_id FROM saved_files WHERE file_id = ?
    `).bind(fileId).first();

    if (!fileRecord) {
      return { authorized: false, error: 'File not found' };
    }

    if (fileRecord.user_id !== userId) {
      return { authorized: false, error: 'Access denied' };
    }

    return { authorized: true, userId };
  } catch (error) {
    return { authorized: false, error: 'Authorization failed' };
  }
}
```

## Performance Optimization

### 1. Caching Strategy
```typescript
export class FileCache {
  constructor(private cache: Cache, private bucket: R2Bucket) {}

  async getCachedFile(key: string): Promise<Response | null> {
    const cacheKey = `file:${key}`;
    const cached = await this.cache.match(cacheKey);
    
    if (cached) {
      // Add cache hit header
      cached.headers.set('X-Cache', 'HIT');
      return cached;
    }

    return null;
  }

  async cacheFile(key: string, response: Response, ttl: number = 3600): Promise<void> {
    const cacheKey = `file:${key}`;
    
    // Clone response for caching
    const cacheResponse = response.clone();
    cacheResponse.headers.set('Cache-Control', `public, max-age=${ttl}`);
    cacheResponse.headers.set('X-Cache', 'MISS');
    
    await this.cache.put(cacheKey, cacheResponse);
  }
}
```

### 2. CDN Integration
```typescript
export function addCDNHeaders(response: Response, isPublic: boolean = false): Response {
  const headers = new Headers(response.headers);
  
  if (isPublic) {
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    headers.set('CDN-Cache-Control', 'max-age=86400');
  } else {
    headers.set('Cache-Control', 'private, max-age=300');
  }

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

## Database Schema Updates

### 1. Migration Tables
```sql
-- Migration tracking
CREATE TABLE migration_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT UNIQUE NOT NULL,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  total_files INTEGER NOT NULL,
  successful_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  results TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Multipart upload tracking
CREATE TABLE multipart_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id TEXT UNIQUE NOT NULL,
  file_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  session_data TEXT NOT NULL, -- JSON
  status TEXT DEFAULT 'active'
);

-- File access logs
CREATE TABLE file_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'upload', 'download', 'delete'
  ip_address TEXT,
  user_agent TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- Indexes
CREATE INDEX idx_migration_batches_status ON migration_batches(status);
CREATE INDEX idx_multipart_uploads_user_id ON multipart_uploads(user_id);
CREATE INDEX idx_multipart_uploads_upload_id ON multipart_uploads(upload_id);
CREATE INDEX idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX idx_file_access_logs_user_id ON file_access_logs(user_id);
```

## Testing Strategy

### 1. Unit Tests
```typescript
// Test file upload
describe('File Upload', () => {
  test('should upload small file successfully', async () => {
    const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', mockFile);

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await handleFileUpload(request, mockEnv, mockCtx);
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.fileId).toBeDefined();
  });

  test('should reject oversized file', async () => {
    const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
    const mockFile = new File([largeContent], 'large.csv', { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', mockFile);

    const request = new Request('http://localhost/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await handleFileUpload(request, mockEnv, mockCtx);
    expect(response.status).toBe(400);
  });
});
```

### 2. Integration Tests
```typescript
// Test migration end-to-end
describe('File Migration', () => {
  test('should migrate file from filesystem to R2', async () => {
    const migrationService = new FilesMigrationService(mockBucket, mockDB);
    
    const batch: MigrationBatch = {
      batchId: 'test-batch-1',
      status: 'pending',
      files: [{
        fileId: 'test-file-1',
        localPath: '/tmp/test.csv',
        userId: 1,
        fileName: 'test.csv',
        fileSize: 1024,
      }],
    };

    await migrationService.migrateBatch(batch);
    
    // Verify file exists in R2
    const r2Object = await mockBucket.get('uploads/user-1/test-file-1.csv');
    expect(r2Object).toBeDefined();
    
    // Verify database record updated
    const dbRecord = await mockDB.prepare(`
      SELECT r2_key FROM saved_files WHERE file_id = ?
    `).bind('test-file-1').first();
    
    expect(dbRecord.r2_key).toBe('uploads/user-1/test-file-1.csv');
  });
});
```

## Security Considerations

### 1. File Type Validation
```typescript
export function validateFileType(file: File): boolean {
  const allowedTypes = ['text/csv', 'application/vnd.ms-excel'];
  const allowedExtensions = ['.csv'];
  
  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return false;
  }

  // Check file extension
  const extension = file.name.toLowerCase().split('.').pop();
  if (!allowedExtensions.includes(`.${extension}`)) {
    return false;
  }

  return true;
}
```

### 2. Content Scanning
```typescript
export async function scanFileContent(fileData: ArrayBuffer): Promise<{
  safe: boolean;
  threats: string[];
}> {
  const decoder = new TextDecoder();
  const content = decoder.decode(fileData.slice(0, 1024)); // Check first 1KB
  
  const threats: string[] = [];
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      threats.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }

  return {
    safe: threats.length === 0,
    threats,
  };
}
```

## Monitoring and Observability

### 1. Metrics Collection
```typescript
export class FileMetrics {
  static async recordUpload(
    fileSize: number,
    userId: number,
    success: boolean,
    duration: number
  ): Promise<void> {
    // Record metrics for monitoring
    console.log(JSON.stringify({
      event: 'file_upload',
      file_size: fileSize,
      user_id: userId,
      success,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    }));
  }

  static async recordDownload(
    fileId: string,
    userId: number,
    bytes_served: number,
    cache_hit: boolean
  ): Promise<void> {
    console.log(JSON.stringify({
      event: 'file_download',
      file_id: fileId,
      user_id: userId,
      bytes_served,
      cache_hit,
      timestamp: new Date().toISOString(),
    }));
  }
}
```

## Timeline and Rollout

### Phase 5 Implementation Timeline (2-3 days)

#### Day 1: R2 Setup and Core Services
- **Morning**: R2 bucket creation and configuration
- **Afternoon**: Implement R2StorageService and basic upload/download
- **Evening**: Set up multipart upload service

#### Day 2: Migration Implementation
- **Morning**: Implement migration scripts and validation
- **Afternoon**: Test migration process with sample data
- **Evening**: Implement access control and security measures

#### Day 3: Testing and Deployment
- **Morning**: Comprehensive testing and performance optimization
- **Afternoon**: Deploy to staging and validate
- **Evening**: Production deployment and monitoring setup

### Migration Rollout Strategy

1. **Pilot Migration**: Migrate 10% of files for testing
2. **Batch Migration**: Migrate remaining files in batches of 100
3. **Validation**: Verify all files post-migration
4. **Cutover**: Switch application to use R2 exclusively
5. **Cleanup**: Remove local files after verification period

## Success Criteria

- All files successfully migrated to R2 without data loss
- File upload/download performance maintained or improved
- Proper access control and security implemented
- Multipart upload working for large files
- Database schema updated and optimized
- Monitoring and alerting in place
- Zero downtime during migration

## Rollback Plan

If migration fails:
1. Immediate rollback to filesystem storage
2. Restore database from backup
3. Investigate and fix issues
4. Re-run migration with improvements

## Conclusion

This comprehensive plan provides a robust approach to migrating List Cutter's file storage from local filesystem to Cloudflare R2 within our unified Workers architecture. The integration leverages the full power of Cloudflare's platform:

### Unified Architecture Benefits
1. **Single Deployment Unit**: Frontend, backend, database (D1), and storage (R2) all managed through one Worker
2. **Zero Network Latency**: Direct bindings between Worker, D1, and R2 eliminate network overhead
3. **Simplified Development**: One wrangler.toml, one deployment command, one monitoring dashboard
4. **Cost Optimization**: Free bandwidth between all Cloudflare services, pay only for storage and requests
5. **Global Scale**: Automatic edge deployment with R2's global replication

### Technical Advantages
- **Native Integration**: No SDKs needed, direct R2 API access
- **Streaming Support**: Efficient handling of large CSV files
- **Atomic Operations**: File uploads with D1 metadata in single transactions
- **Built-in Security**: Workers authentication extends to R2 access
- **Performance**: Sub-millisecond access to both files and metadata

The unified Workers approach transforms List Cutter into a modern, edge-first application with world-class performance and reliability, all while simplifying the development and deployment process.