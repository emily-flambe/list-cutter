# Phase 5: Detailed File Storage Migration Implementation Plan

## Executive Summary

This document provides a detailed implementation plan for migrating the List Cutter application's file storage from local filesystem to Cloudflare R2 object storage. The current Django application stores CSV files locally with metadata in PostgreSQL, which will be migrated to R2 with D1 database integration while maintaining all existing functionality.

## Current State Analysis

### 1. Current File Storage Architecture

**Local Storage Structure:**
```
app/media/
├── uploads/          # User uploaded files
└── generated/        # Generated/processed files
```

**Key Implementation Details:**
- **Storage Base**: `MEDIA_ROOT = os.path.join(BASE_DIR, 'media')`
- **Upload Directory**: `os.path.join(settings.MEDIA_ROOT, 'uploads')`
- **Generated Directory**: `os.path.join(settings.MEDIA_ROOT, 'generated')`
- **File Size Limit**: 10MB (configurable via `MAX_FILE_SIZE` env var)
- **File URL Serving**: Django static file serving via `settings.MEDIA_URL`

**Current File Operations:**

1. **Upload Flow** (`upload_file()` in views.py):
   - Validates file size and type
   - Uses `save_uploaded_file()` to write to filesystem
   - Creates `SavedFile` model record with `file_path`
   - Generates unique filenames with `set_file_name()`

2. **Download Flow** (`download_file()` in views.py):
   - Serves files directly via `FileResponse`
   - Uses `os.path.join(UPLOAD_DIR, filename)`
   - No access control beyond basic file existence

3. **File Processing** (`filter_csv_with_where()` in file_utils.py):
   - Reads entire CSV into memory with pandas
   - Applies filters and column selection
   - Returns processed CSV data as string

4. **File Management**:
   - Deletion removes both database record and filesystem file
   - File listing queries database for metadata
   - Uniqueness enforced via incremental naming

### 2. Current Database Schema

**SavedFile Model (PostgreSQL):**
```python
class SavedFile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    file_id = models.CharField(max_length=255, unique=True)
    file_name = models.CharField(max_length=255, unique=True)
    file_path = models.CharField(max_length=500, unique=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    system_tags = ArrayField(models.CharField(max_length=255), null=True)
    user_tags = ArrayField(models.CharField(max_length=255), null=True)
    metadata = models.JSONField(blank=True, null=True)
```

**Key Issues Identified:**
- `file_path` contains full local filesystem path
- No file integrity verification (checksums)
- No storage class or caching metadata
- Limited metadata for file operations
- Direct filesystem dependency

## Target R2 Architecture

### 1. R2 Bucket Design

**Bucket Structure:**
```
cutty-files/
├── uploads/
│   └── user-{user_id}/
│       ├── {file_id}-{timestamp}.csv
│       └── metadata/
│           └── {file_id}.json
├── generated/
│   └── user-{user_id}/
│       ├── {original_file_id}-filtered-{timestamp}.csv
│       └── {original_file_id}-processed-{timestamp}.csv
├── temp/
│   ├── multipart-uploads/
│   └── processing/
└── archives/
    └── {year}/{month}/
        └── deleted-{file_id}-{timestamp}.csv
```

**Key Improvements:**
- User-scoped organization prevents accidental access
- Timestamped files prevent naming conflicts
- Separate metadata storage for complex file information
- Temporary and archive areas for lifecycle management
- Hierarchical structure for efficient querying

### 2. Enhanced Database Schema (D1)

```sql
CREATE TABLE saved_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    uploaded_at DATETIME NOT NULL,
    last_accessed DATETIME,
    access_count INTEGER DEFAULT 0,
    system_tags TEXT, -- JSON array
    user_tags TEXT,   -- JSON array
    metadata TEXT,    -- JSON object
    checksum TEXT NOT NULL,
    storage_class TEXT DEFAULT 'Standard',
    lifecycle_status TEXT DEFAULT 'active', -- active, archived, deleted
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- File relationships (for generated files)
CREATE TABLE file_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_file_id TEXT NOT NULL,
    child_file_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- 'filtered', 'processed', 'cut'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_file_id) REFERENCES saved_files(file_id),
    FOREIGN KEY (child_file_id) REFERENCES saved_files(file_id)
);

-- File access audit
CREATE TABLE file_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'upload', 'download', 'view', 'delete', 'process'
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    bytes_transferred INTEGER,
    processing_time_ms INTEGER
);

-- Indexes for performance
CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_file_id ON saved_files(file_id);
CREATE INDEX idx_saved_files_r2_key ON saved_files(r2_key);
CREATE INDEX idx_saved_files_lifecycle ON saved_files(lifecycle_status, expires_at);
CREATE INDEX idx_file_relationships_parent ON file_relationships(parent_file_id);
CREATE INDEX idx_file_access_logs_file_user ON file_access_logs(file_id, user_id);
CREATE INDEX idx_file_access_logs_timestamp ON file_access_logs(timestamp);
```

## Detailed Implementation Plan

### Phase 5.1: R2 Infrastructure Setup

#### 5.1.1 Cloudflare R2 Configuration

**Bucket Creation:**
```bash
# Create production bucket
npx wrangler r2 bucket create cutty-files-prod

# Create staging bucket for testing
npx wrangler r2 bucket create cutty-files-staging

# Configure CORS for direct browser uploads
npx wrangler r2 bucket cors put cutty-files-prod --file cors-config.json
```

**CORS Configuration (`cors-config.json`):**
```json
{
  "rules": [
    {
      "allowedOrigins": [
        "https://cutty.com", 
        "https://staging.cutty.com",
        "http://localhost:3000"
      ],
      "allowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "allowedHeaders": [
        "Content-Type", 
        "Content-Length", 
        "Authorization",
        "X-File-ID",
        "X-Upload-Type"
      ],
      "exposedHeaders": ["ETag", "X-Upload-ID"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

**Enhanced Wrangler Configuration:**
```toml
name = "cutty-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["streams_enable_constructors"]

[[r2_buckets]]
binding = "FILES_BUCKET"
bucket_name = "cutty-files-prod"
preview_bucket_name = "cutty-files-staging"

[[d1_databases]]
binding = "DB"
database_name = "cutty-db"
database_id = "your-d1-database-id"

[vars]
MAX_FILE_SIZE = "10485760"  # 10MB
MAX_CHUNK_SIZE = "5242880"  # 5MB for multipart
ALLOWED_FILE_TYPES = "text/csv,application/vnd.ms-excel,application/csv"
CACHE_TTL = "3600"
SIGNED_URL_EXPIRY = "1800"  # 30 minutes
```

#### 5.1.2 TypeScript Type Definitions

```typescript
// types/storage.ts
export interface FileMetadata {
  fileId: string;
  fileName: string;
  userId: number;
  fileSize: number;
  contentType: string;
  checksum: string;
  uploadedAt: Date;
  lastAccessed?: Date;
  accessCount: number;
  systemTags: string[];
  userTags: string[];
  customMetadata: Record<string, any>;
  storageClass: 'Standard' | 'InfrequentAccess';
  lifecycleStatus: 'active' | 'archived' | 'deleted';
  expiresAt?: Date;
}

export interface UploadOptions {
  userId: number;
  fileId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  metadata?: Record<string, any>;
  storageClass?: 'Standard' | 'InfrequentAccess';
  chunkSize?: number;
}

export interface DownloadOptions {
  userId: number;
  fileId: string;
  range?: {
    start: number;
    end?: number;
  };
  includeMetadata?: boolean;
}

export interface ProcessingOptions {
  selectedColumns: string[];
  whereFilters: Record<string, string>;
  outputFormat: 'csv' | 'json';
  streaming: boolean;
}
```

### Phase 5.2: Core R2 Service Implementation

#### 5.2.1 Enhanced R2 Storage Service

```typescript
// services/R2StorageService.ts
import { FileMetadata, UploadOptions, DownloadOptions } from '../types/storage';

export class R2StorageService {
  private bucket: R2Bucket;
  private db: D1Database;
  
  constructor(bucket: R2Bucket, db: D1Database) {
    this.bucket = bucket;
    this.db = db;
  }

  async uploadFile(
    fileData: ArrayBuffer | ReadableStream | Uint8Array,
    options: UploadOptions
  ): Promise<{ success: boolean; r2Object?: R2Object; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Generate R2 key with timestamp to prevent conflicts
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const r2Key = `uploads/user-${options.userId}/${options.fileId}-${timestamp}.csv`;
      
      // Calculate checksum for integrity
      const checksum = await this.calculateChecksum(fileData);
      
      // Prepare R2 upload options
      const uploadMetadata: R2PutOptions = {
        httpMetadata: {
          contentType: options.contentType,
          cacheControl: 'private, max-age=3600',
          contentDisposition: `attachment; filename="${options.fileName}"`,
        },
        customMetadata: {
          originalName: options.fileName,
          userId: options.userId.toString(),
          fileId: options.fileId,
          uploadedAt: new Date().toISOString(),
          checksum,
          version: '1',
          ...options.metadata,
        },
        storageClass: options.storageClass || 'Standard',
      };

      // Upload to R2
      const r2Object = await this.bucket.put(r2Key, fileData, uploadMetadata);
      
      if (!r2Object) {
        throw new Error('R2 upload failed - no object returned');
      }

      // Store metadata in D1
      await this.saveFileMetadata({
        fileId: options.fileId,
        fileName: options.fileName,
        userId: options.userId,
        fileSize: options.fileSize,
        contentType: options.contentType,
        checksum,
        uploadedAt: new Date(),
        accessCount: 0,
        systemTags: ['uploaded'],
        userTags: [],
        customMetadata: options.metadata || {},
        storageClass: options.storageClass || 'Standard',
        lifecycleStatus: 'active',
      }, r2Key);

      // Log successful upload
      await this.logFileAccess({
        fileId: options.fileId,
        userId: options.userId,
        action: 'upload',
        success: true,
        bytesTransferred: options.fileSize,
        processingTimeMs: Date.now() - startTime,
      });

      return { success: true, r2Object };
    } catch (error) {
      // Log failed upload
      await this.logFileAccess({
        fileId: options.fileId,
        userId: options.userId,
        action: 'upload',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  async downloadFile(options: DownloadOptions): Promise<{
    success: boolean;
    fileObject?: R2ObjectBody;
    metadata?: FileMetadata;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Verify user access and get file metadata
      const fileRecord = await this.getFileMetadata(options.fileId, options.userId);
      if (!fileRecord) {
        return { success: false, error: 'File not found or access denied' };
      }

      // Build R2 get options
      const getOptions: R2GetOptions = {};
      if (options.range) {
        getOptions.range = {
          offset: options.range.start,
          length: options.range.end ? options.range.end - options.range.start + 1 : undefined,
        };
      }

      // Download from R2
      const fileObject = await this.bucket.get(fileRecord.r2Key, getOptions);
      
      if (!fileObject) {
        return { success: false, error: 'File not found in storage' };
      }

      // Update access tracking
      await this.updateFileAccess(options.fileId);

      // Log successful download
      await this.logFileAccess({
        fileId: options.fileId,
        userId: options.userId,
        action: 'download',
        success: true,
        bytesTransferred: fileObject.size,
        processingTimeMs: Date.now() - startTime,
      });

      return { 
        success: true, 
        fileObject,
        metadata: options.includeMetadata ? fileRecord : undefined 
      };
    } catch (error) {
      await this.logFileAccess({
        fileId: options.fileId,
        userId: options.userId,
        action: 'download',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Download failed' 
      };
    }
  }

  async deleteFile(fileId: string, userId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get file metadata for R2 key
      const fileRecord = await this.getFileMetadata(fileId, userId);
      if (!fileRecord) {
        return { success: false, error: 'File not found or access denied' };
      }

      // Move to archive before deletion (optional retention)
      const archiveKey = `archives/${new Date().getFullYear()}/${new Date().getMonth() + 1}/deleted-${fileId}-${Date.now()}.csv`;
      
      // Copy to archive
      await this.bucket.put(archiveKey, await this.bucket.get(fileRecord.r2Key));
      
      // Delete from primary location
      await this.bucket.delete(fileRecord.r2Key);

      // Update database record (soft delete)
      await this.db.prepare(`
        UPDATE saved_files 
        SET lifecycle_status = 'deleted', 
            updated_at = CURRENT_TIMESTAMP,
            r2_key = ?
        WHERE file_id = ? AND user_id = ?
      `).bind(archiveKey, fileId, userId).run();

      // Log deletion
      await this.logFileAccess({
        fileId,
        userId,
        action: 'delete',
        success: true,
      });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete failed' 
      };
    }
  }

  async listUserFiles(
    userId: number, 
    limit: number = 50, 
    offset: number = 0,
    filter?: { status?: string; tags?: string[] }
  ): Promise<{
    files: FileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    let whereClause = 'WHERE user_id = ? AND lifecycle_status = ?';
    const params = [userId, filter?.status || 'active'];

    if (filter?.tags && filter.tags.length > 0) {
      // Simple tag filtering - could be enhanced with JSON functions
      whereClause += ' AND (user_tags LIKE ? OR system_tags LIKE ?)';
      const tagPattern = `%"${filter.tags[0]}"%`;
      params.push(tagPattern, tagPattern);
    }

    const countResult = await this.db.prepare(`
      SELECT COUNT(*) as total FROM saved_files ${whereClause}
    `).bind(...params).first();

    const filesResult = await this.db.prepare(`
      SELECT * FROM saved_files 
      ${whereClause}
      ORDER BY uploaded_at DESC 
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    const files: FileMetadata[] = filesResult.results.map(row => ({
      fileId: row.file_id as string,
      fileName: row.file_name as string,
      userId: row.user_id as number,
      fileSize: row.file_size as number,
      contentType: row.content_type as string,
      checksum: row.checksum as string,
      uploadedAt: new Date(row.uploaded_at as string),
      lastAccessed: row.last_accessed ? new Date(row.last_accessed as string) : undefined,
      accessCount: row.access_count as number,
      systemTags: JSON.parse(row.system_tags as string || '[]'),
      userTags: JSON.parse(row.user_tags as string || '[]'),
      customMetadata: JSON.parse(row.metadata as string || '{}'),
      storageClass: row.storage_class as 'Standard' | 'InfrequentAccess',
      lifecycleStatus: row.lifecycle_status as 'active' | 'archived' | 'deleted',
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    }));

    const total = countResult?.total as number || 0;
    const hasMore = offset + limit < total;

    return { files, total, hasMore };
  }

  private async saveFileMetadata(metadata: FileMetadata, r2Key: string): Promise<void> {
    await this.db.prepare(`
      INSERT INTO saved_files (
        file_id, file_name, user_id, r2_key, file_size, content_type,
        uploaded_at, access_count, system_tags, user_tags, metadata,
        checksum, storage_class, lifecycle_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metadata.fileId,
      metadata.fileName,
      metadata.userId,
      r2Key,
      metadata.fileSize,
      metadata.contentType,
      metadata.uploadedAt.toISOString(),
      metadata.accessCount,
      JSON.stringify(metadata.systemTags),
      JSON.stringify(metadata.userTags),
      JSON.stringify(metadata.customMetadata),
      metadata.checksum,
      metadata.storageClass,
      metadata.lifecycleStatus
    ).run();
  }

  private async getFileMetadata(fileId: string, userId: number): Promise<(FileMetadata & { r2Key: string }) | null> {
    const result = await this.db.prepare(`
      SELECT * FROM saved_files 
      WHERE file_id = ? AND user_id = ? AND lifecycle_status = 'active'
    `).bind(fileId, userId).first();

    if (!result) return null;

    return {
      fileId: result.file_id as string,
      fileName: result.file_name as string,
      userId: result.user_id as number,
      fileSize: result.file_size as number,
      contentType: result.content_type as string,
      checksum: result.checksum as string,
      uploadedAt: new Date(result.uploaded_at as string),
      lastAccessed: result.last_accessed ? new Date(result.last_accessed as string) : undefined,
      accessCount: result.access_count as number,
      systemTags: JSON.parse(result.system_tags as string || '[]'),
      userTags: JSON.parse(result.user_tags as string || '[]'),
      customMetadata: JSON.parse(result.metadata as string || '{}'),
      storageClass: result.storage_class as 'Standard' | 'InfrequentAccess',
      lifecycleStatus: result.lifecycle_status as 'active' | 'archived' | 'deleted',
      expiresAt: result.expires_at ? new Date(result.expires_at as string) : undefined,
      r2Key: result.r2_key as string,
    };
  }

  private async updateFileAccess(fileId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE saved_files 
      SET last_accessed = CURRENT_TIMESTAMP, 
          access_count = access_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE file_id = ?
    `).bind(fileId).run();
  }

  private async logFileAccess(log: {
    fileId: string;
    userId: number;
    action: string;
    success: boolean;
    bytesTransferred?: number;
    processingTimeMs?: number;
    errorMessage?: string;
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO file_access_logs 
      (file_id, user_id, action, success, bytes_transferred, processing_time_ms, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      log.fileId,
      log.userId,
      log.action,
      log.success,
      log.bytesTransferred || null,
      log.processingTimeMs || null,
      log.errorMessage || null
    ).run();
  }

  private async calculateChecksum(data: ArrayBuffer | ReadableStream | Uint8Array): Promise<string> {
    let buffer: ArrayBuffer;
    
    if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (data instanceof Uint8Array) {
      buffer = data.buffer;
    } else {
      // For ReadableStream, we need to consume it
      const reader = data.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLength += value.length;
      }
      
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      buffer = combined.buffer;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

### Phase 5.3: File Migration Implementation

#### 5.3.1 Migration Service with Batching

```typescript
// services/MigrationService.ts
export interface MigrationPlan {
  totalFiles: number;
  estimatedSize: number;
  batches: MigrationBatch[];
  estimatedDuration: number;
  userDistribution: Record<number, number>;
}

export interface MigrationBatch {
  id: string;
  files: Array<{
    fileId: string;
    fileName: string;
    filePath: string;
    userId: number;
    fileSize: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  startedAt?: Date;
  completedAt?: Date;
  errors: string[];
  progress: {
    completed: number;
    failed: number;
    total: number;
  };
}

export class MigrationService {
  private storageService: R2StorageService;
  private db: D1Database;
  private batchSize: number = 50;
  private maxConcurrency: number = 5;

  constructor(storageService: R2StorageService, db: D1Database) {
    this.storageService = storageService;
    this.db = db;
  }

  async createMigrationPlan(): Promise<MigrationPlan> {
    // Query existing files from Django/PostgreSQL structure
    const filesQuery = `
      SELECT file_id, file_name, file_path, user_id, 
             COALESCE(LENGTH(file_content), 0) as file_size,
             uploaded_at
      FROM list_cutter_savedfile 
      ORDER BY uploaded_at ASC
    `;
    
    const files = await this.db.prepare(filesQuery).all();
    
    // Analyze files and create batches
    const userFiles: Record<number, any[]> = {};
    let totalSize = 0;
    
    for (const file of files.results) {
      const userId = file.user_id as number;
      if (!userFiles[userId]) userFiles[userId] = [];
      userFiles[userId].push(file);
      totalSize += (file.file_size as number) || 0;
    }

    // Create batches prioritizing active users and smaller files first
    const batches: MigrationBatch[] = [];
    let batchCounter = 1;
    let currentBatch: any[] = [];

    for (const [userId, userFileList] of Object.entries(userFiles)) {
      // Sort user files by size (smaller first for faster initial success)
      userFileList.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
      
      for (const file of userFileList) {
        currentBatch.push({
          fileId: file.file_id,
          fileName: file.file_name,
          filePath: file.file_path,
          userId: parseInt(userId),
          fileSize: file.file_size || 0,
          priority: this.determinePriority(file),
        });

        if (currentBatch.length >= this.batchSize) {
          batches.push(this.createBatch(batchCounter++, currentBatch));
          currentBatch = [];
        }
      }
    }

    // Add remaining files to final batch
    if (currentBatch.length > 0) {
      batches.push(this.createBatch(batchCounter, currentBatch));
    }

    return {
      totalFiles: files.results.length,
      estimatedSize: totalSize,
      batches,
      estimatedDuration: this.estimateMigrationDuration(files.results.length, totalSize),
      userDistribution: Object.fromEntries(
        Object.entries(userFiles).map(([userId, files]) => [parseInt(userId), files.length])
      ),
    };
  }

  async executeMigration(plan: MigrationPlan, options: {
    dryRun?: boolean;
    stopOnError?: boolean;
    progressCallback?: (progress: MigrationProgress) => void;
  } = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      totalBatches: plan.batches.length,
      completedBatches: 0,
      failedBatches: 0,
      totalFiles: plan.totalFiles,
      migratedFiles: 0,
      failedFiles: 0,
      errors: [],
      duration: 0,
      throughput: 0,
    };

    console.log(`Starting migration: ${plan.totalFiles} files in ${plan.batches.length} batches`);
    
    if (options.dryRun) {
      console.log('DRY RUN MODE - No actual migration will occur');
      return { ...result, success: true };
    }

    // Process batches with limited concurrency
    const batchPromises: Promise<void>[] = [];
    const semaphore = new Semaphore(this.maxConcurrency);

    for (const batch of plan.batches) {
      const batchPromise = semaphore.acquire().then(async (release) => {
        try {
          await this.processBatch(batch);
          result.completedBatches++;
          result.migratedFiles += batch.progress.completed;
          result.failedFiles += batch.progress.failed;
          
          if (options.progressCallback) {
            options.progressCallback({
              batchesCompleted: result.completedBatches,
              totalBatches: result.totalBatches,
              filesCompleted: result.migratedFiles,
              totalFiles: result.totalFiles,
              currentBatch: batch.id,
              errors: result.errors,
            });
          }
        } catch (error) {
          result.failedBatches++;
          result.errors.push(`Batch ${batch.id} failed: ${error.message}`);
          
          if (options.stopOnError) {
            throw error;
          }
        } finally {
          release();
        }
      });
      
      batchPromises.push(batchPromise);
    }

    try {
      await Promise.all(batchPromises);
      result.success = result.failedBatches === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Migration failed: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    result.throughput = result.migratedFiles / (result.duration / 1000); // files per second

    console.log(`Migration completed: ${result.migratedFiles}/${result.totalFiles} files migrated`);
    return result;
  }

  private async processBatch(batch: MigrationBatch): Promise<void> {
    console.log(`Processing batch ${batch.id} with ${batch.files.length} files`);
    batch.status = 'processing';
    batch.startedAt = new Date();

    for (const file of batch.files) {
      try {
        await this.migrateFile(file);
        batch.progress.completed++;
        console.log(`✓ Migrated ${file.fileName}`);
      } catch (error) {
        batch.progress.failed++;
        batch.errors.push(`${file.fileName}: ${error.message}`);
        console.error(`✗ Failed to migrate ${file.fileName}: ${error.message}`);
      }
    }

    batch.status = batch.progress.failed > 0 ? 'failed' : 'completed';
    batch.completedAt = new Date();
    
    // Save batch results
    await this.saveBatchResults(batch);
  }

  private async migrateFile(file: {
    fileId: string;
    fileName: string;
    filePath: string;
    userId: number;
    fileSize: number;
  }): Promise<void> {
    // Read file from local filesystem
    // This would need to be implemented based on your environment
    // For example, in a Node.js environment:
    const fileData = await this.readLocalFile(file.filePath);
    
    // Upload to R2 using storage service
    const uploadResult = await this.storageService.uploadFile(fileData, {
      userId: file.userId,
      fileId: file.fileId,
      fileName: file.fileName,
      contentType: 'text/csv',
      fileSize: fileData.byteLength,
      metadata: {
        migratedFrom: file.filePath,
        migratedAt: new Date().toISOString(),
        originalSize: file.fileSize,
      },
    });

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed');
    }

    // Verify migration
    const verification = await this.verifyMigration(file.fileId, file.userId, fileData);
    if (!verification.success) {
      throw new Error(`Verification failed: ${verification.error}`);
    }
  }

  private async verifyMigration(
    fileId: string, 
    userId: number, 
    originalData: ArrayBuffer
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Download from R2 and compare
      const downloadResult = await this.storageService.downloadFile({
        userId,
        fileId,
      });

      if (!downloadResult.success) {
        return { success: false, error: 'Failed to download for verification' };
      }

      const downloadedData = await downloadResult.fileObject!.arrayBuffer();
      
      // Compare sizes
      if (downloadedData.byteLength !== originalData.byteLength) {
        return { success: false, error: 'File size mismatch' };
      }

      // Compare checksums
      const originalChecksum = await this.calculateChecksum(originalData);
      const downloadedChecksum = await this.calculateChecksum(downloadedData);
      
      if (originalChecksum !== downloadedChecksum) {
        return { success: false, error: 'Checksum mismatch' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async readLocalFile(filePath: string): Promise<ArrayBuffer> {
    // This would be implemented based on your migration environment
    // Example for Node.js:
    throw new Error('readLocalFile implementation depends on migration environment');
  }

  private async calculateChecksum(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private determinePriority(file: any): 'high' | 'medium' | 'low' {
    // Prioritize recently accessed or smaller files
    const daysSinceUpload = (Date.now() - new Date(file.uploaded_at).getTime()) / (1000 * 60 * 60 * 24);
    const fileSize = file.file_size || 0;
    
    if (daysSinceUpload < 7 || fileSize < 1024 * 1024) { // Recent or small files
      return 'high';
    } else if (daysSinceUpload < 30) { // Files from last month
      return 'medium';
    }
    return 'low';
  }

  private createBatch(id: number, files: any[]): MigrationBatch {
    return {
      id: `batch-${id.toString().padStart(3, '0')}`,
      files,
      status: 'pending',
      errors: [],
      progress: {
        completed: 0,
        failed: 0,
        total: files.length,
      },
    };
  }

  private estimateMigrationDuration(fileCount: number, totalSize: number): number {
    // Rough estimation based on file count and size
    const avgProcessingTimePerFile = 2000; // 2 seconds per file
    const bandwidthMbps = 100; // Assume 100 Mbps upload
    
    const processingTime = fileCount * avgProcessingTimePerFile;
    const uploadTime = (totalSize / (bandwidthMbps * 1024 * 1024 / 8)) * 1000;
    
    return Math.max(processingTime, uploadTime);
  }

  private async saveBatchResults(batch: MigrationBatch): Promise<void> {
    await this.db.prepare(`
      INSERT OR REPLACE INTO migration_batches 
      (batch_id, started_at, completed_at, total_files, successful_files, failed_files, status, results)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batch.id,
      batch.startedAt?.toISOString(),
      batch.completedAt?.toISOString(),
      batch.progress.total,
      batch.progress.completed,
      batch.progress.failed,
      batch.status,
      JSON.stringify({
        errors: batch.errors,
        files: batch.files.map(f => ({ fileId: f.fileId, fileName: f.fileName })),
      })
    ).run();
  }
}

// Utility class for concurrency control
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }
}

// Supporting interfaces
interface MigrationProgress {
  batchesCompleted: number;
  totalBatches: number;
  filesCompleted: number;
  totalFiles: number;
  currentBatch: string;
  errors: string[];
}

interface MigrationResult {
  success: boolean;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  errors: string[];
  duration: number;
  throughput: number;
}
```

### Phase 5.4: Enhanced File Processing with Streaming

#### 5.4.1 Streaming CSV Processor for Large Files

```typescript
// services/StreamingCSVProcessor.ts
import { ProcessingOptions } from '../types/storage';

export class StreamingCSVProcessor {
  private storageService: R2StorageService;
  private maxMemoryUsage: number = 50 * 1024 * 1024; // 50MB

  constructor(storageService: R2StorageService) {
    this.storageService = storageService;
  }

  async processCSV(
    userId: number,
    fileId: string,
    options: ProcessingOptions
  ): Promise<ReadableStream<Uint8Array>> {
    // Get file from R2
    const downloadResult = await this.storageService.downloadFile({
      userId,
      fileId,
    });

    if (!downloadResult.success) {
      throw new Error('Failed to retrieve file for processing');
    }

    const fileObject = downloadResult.fileObject!;
    
    if (options.streaming) {
      return this.createStreamingProcessor(fileObject, options);
    } else {
      return this.createBatchProcessor(fileObject, options);
    }
  }

  private createStreamingProcessor(
    fileObject: R2ObjectBody,
    options: ProcessingOptions
  ): ReadableStream<Uint8Array> {
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();
    
    let buffer = '';
    let headerProcessed = false;
    let columnIndices: Record<string, number> = {};

    return new ReadableStream({
      start(controller) {
        // Start with BOM for Excel compatibility if CSV output
        if (options.outputFormat === 'csv') {
          controller.enqueue(textEncoder.encode('\uFEFF'));
        }
      },

      async pull(controller) {
        try {
          const reader = fileObject.body.getReader();
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Process any remaining buffer
              if (buffer.trim()) {
                const processedData = this.processLine(
                  buffer.trim(), 
                  columnIndices, 
                  options, 
                  false
                );
                if (processedData) {
                  controller.enqueue(textEncoder.encode(processedData));
                }
              }
              controller.close();
              break;
            }
            
            buffer += textDecoder.decode(value, { stream: true });
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              if (!headerProcessed) {
                // Process header
                const columns = this.parseCSVLine(line);
                columnIndices = this.buildColumnIndices(columns, options.selectedColumns);
                
                const header = this.formatOutput(
                  options.selectedColumns, 
                  options.outputFormat
                );
                controller.enqueue(textEncoder.encode(header));
                headerProcessed = true;
                continue;
              }
              
              const processedData = this.processLine(
                line, 
                columnIndices, 
                options, 
                false
              );
              
              if (processedData) {
                controller.enqueue(textEncoder.encode(processedData));
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  private createBatchProcessor(
    fileObject: R2ObjectBody,
    options: ProcessingOptions
  ): ReadableStream<Uint8Array> {
    const textEncoder = new TextEncoder();
    
    return new ReadableStream({
      async start(controller) {
        try {
          // Read entire file into memory for batch processing
          const fileText = await fileObject.text();
          const lines = fileText.split('\n');
          
          if (lines.length === 0) {
            controller.close();
            return;
          }
          
          // Process header
          const headerLine = lines[0];
          const columns = this.parseCSVLine(headerLine);
          const columnIndices = this.buildColumnIndices(columns, options.selectedColumns);
          
          // Output header
          const header = this.formatOutput(options.selectedColumns, options.outputFormat);
          controller.enqueue(textEncoder.encode(header));
          
          // Process data lines in chunks to avoid blocking
          const chunkSize = 1000;
          for (let i = 1; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, i + chunkSize);
            const processedChunk = this.processChunk(chunk, columnIndices, options);
            
            if (processedChunk) {
              controller.enqueue(textEncoder.encode(processedChunk));
            }
            
            // Yield control to avoid blocking
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  private processChunk(
    lines: string[],
    columnIndices: Record<string, number>,
    options: ProcessingOptions
  ): string {
    const processedLines: string[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const processedLine = this.processLine(line, columnIndices, options, true);
      if (processedLine) {
        processedLines.push(processedLine.replace(/\n$/, ''));
      }
    }
    
    return processedLines.join('\n') + (processedLines.length > 0 ? '\n' : '');
  }

  private processLine(
    line: string,
    columnIndices: Record<string, number>,
    options: ProcessingOptions,
    isChunk: boolean
  ): string | null {
    try {
      const values = this.parseCSVLine(line);
      
      // Apply filters
      if (!this.applyFilters(values, columnIndices, options.whereFilters)) {
        return null;
      }
      
      // Extract selected columns
      const selectedValues = options.selectedColumns.map(column => {
        const index = columnIndices[column];
        return index !== undefined ? values[index] || '' : '';
      });
      
      const output = this.formatOutput(selectedValues, options.outputFormat);
      return isChunk ? output : output + '\n';
    } catch (error) {
      console.warn(`Error processing line: ${error.message}`);
      return null;
    }
  }

  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
      i++;
    }
    
    values.push(current.trim());
    return values;
  }

  private buildColumnIndices(
    allColumns: string[],
    selectedColumns: string[]
  ): Record<string, number> {
    const indices: Record<string, number> = {};
    
    for (const selectedColumn of selectedColumns) {
      const index = allColumns.findIndex(col => 
        col.trim().toLowerCase() === selectedColumn.trim().toLowerCase()
      );
      if (index !== -1) {
        indices[selectedColumn] = index;
      }
    }
    
    return indices;
  }

  private applyFilters(
    values: string[],
    columnIndices: Record<string, number>,
    filters: Record<string, string>
  ): boolean {
    for (const [column, filterExpression] of Object.entries(filters)) {
      if (!filterExpression || filterExpression.trim() === '') continue;
      
      const columnIndex = columnIndices[column];
      if (columnIndex === undefined) continue;
      
      const value = values[columnIndex] || '';
      if (!this.evaluateFilter(value, filterExpression)) {
        return false;
      }
    }
    
    return true;
  }

  private evaluateFilter(value: string, expression: string): boolean {
    try {
      // Handle different filter types
      const trimmedExpression = expression.trim();
      
      if (trimmedExpression.startsWith('=')) {
        return value === trimmedExpression.substring(1).trim();
      }
      
      if (trimmedExpression.startsWith('!=')) {
        return value !== trimmedExpression.substring(2).trim();
      }
      
      if (trimmedExpression.startsWith('>=')) {
        const numValue = parseFloat(value);
        const filterValue = parseFloat(trimmedExpression.substring(2).trim());
        return !isNaN(numValue) && !isNaN(filterValue) && numValue >= filterValue;
      }
      
      if (trimmedExpression.startsWith('<=')) {
        const numValue = parseFloat(value);
        const filterValue = parseFloat(trimmedExpression.substring(2).trim());
        return !isNaN(numValue) && !isNaN(filterValue) && numValue <= filterValue;
      }
      
      if (trimmedExpression.startsWith('>')) {
        const numValue = parseFloat(value);
        const filterValue = parseFloat(trimmedExpression.substring(1).trim());
        return !isNaN(numValue) && !isNaN(filterValue) && numValue > filterValue;
      }
      
      if (trimmedExpression.startsWith('<')) {
        const numValue = parseFloat(value);
        const filterValue = parseFloat(trimmedExpression.substring(1).trim());
        return !isNaN(numValue) && !isNaN(filterValue) && numValue < filterValue;
      }
      
      if (trimmedExpression.toUpperCase().startsWith('CONTAINS')) {
        const searchValue = trimmedExpression.substring(8).trim().replace(/['"]/g, '');
        return value.toLowerCase().includes(searchValue.toLowerCase());
      }
      
      if (trimmedExpression.toUpperCase().startsWith('IN')) {
        const listMatch = trimmedExpression.match(/IN\s*\(([^)]+)\)/i);
        if (listMatch) {
          const values = listMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
          return values.includes(value);
        }
      }
      
      // Default: treat as exact match
      return value === trimmedExpression;
    } catch (error) {
      console.warn(`Filter evaluation error: ${error.message}`);
      return true; // Include row if filter evaluation fails
    }
  }

  private formatOutput(data: string[], format: 'csv' | 'json'): string {
    if (format === 'json') {
      return JSON.stringify(data) + '\n';
    }
    
    // CSV format with proper escaping
    const escapedData = data.map(value => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    
    return escapedData.join(',') + '\n';
  }
}
```

### Phase 5.5: Performance Optimization and Monitoring

#### 5.5.1 Caching and CDN Integration

```typescript
// services/CacheService.ts
export class FileCache {
  private cache: Cache;
  private storageService: R2StorageService;
  private defaultTTL: number = 3600; // 1 hour

  constructor(cache: Cache, storageService: R2StorageService) {
    this.cache = cache;
    this.storageService = storageService;
  }

  async getCachedFile(
    userId: number, 
    fileId: string, 
    options?: { range?: string }
  ): Promise<Response | null> {
    const cacheKey = this.buildCacheKey(userId, fileId, options);
    
    try {
      const cached = await this.cache.match(cacheKey);
      if (cached) {
        // Add cache hit header
        const response = new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: new Headers(cached.headers),
        });
        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Key', cacheKey);
        return response;
      }
    } catch (error) {
      console.warn(`Cache retrieval failed: ${error.message}`);
    }
    
    return null;
  }

  async cacheFileResponse(
    userId: number,
    fileId: string,
    response: Response,
    options?: { 
      ttl?: number; 
      range?: string;
      tags?: string[];
    }
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(userId, fileId, options);
    const ttl = options?.ttl || this.defaultTTL;
    
    try {
      // Clone response for caching
      const cacheResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
      
      // Add cache metadata
      cacheResponse.headers.set('Cache-Control', `private, max-age=${ttl}`);
      cacheResponse.headers.set('X-Cache', 'MISS');
      cacheResponse.headers.set('X-Cached-At', new Date().toISOString());
      
      if (options?.tags) {
        cacheResponse.headers.set('X-Cache-Tags', options.tags.join(','));
      }
      
      await this.cache.put(cacheKey, cacheResponse);
    } catch (error) {
      console.warn(`Cache storage failed: ${error.message}`);
    }
  }

  async invalidateFileCache(userId: number, fileId: string): Promise<void> {
    // Invalidate all variations of this file
    const patterns = [
      this.buildCacheKey(userId, fileId),
      this.buildCacheKey(userId, fileId, { range: 'partial' }),
    ];
    
    for (const pattern of patterns) {
      try {
        await this.cache.delete(pattern);
      } catch (error) {
        console.warn(`Cache invalidation failed for ${pattern}: ${error.message}`);
      }
    }
  }

  async invalidateUserCache(userId: number): Promise<void> {
    // This is a simplified approach - in production you might want
    // a more sophisticated cache tagging system
    console.log(`Invalidating cache for user ${userId}`);
    // Note: Cache API doesn't support pattern matching, so you'd need
    // to track cache keys separately for bulk invalidation
  }

  private buildCacheKey(
    userId: number, 
    fileId: string, 
    options?: { range?: string }
  ): string {
    let key = `file:${userId}:${fileId}`;
    
    if (options?.range) {
      key += `:range:${options.range}`;
    }
    
    return key;
  }
}

// Enhanced response helper with CDN optimization
export function addCDNHeaders(
  response: Response, 
  options: {
    isPublic?: boolean;
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
  } = {}
): Response {
  const headers = new Headers(response.headers);
  
  const maxAge = options.maxAge || 3600;
  const sMaxAge = options.sMaxAge || maxAge * 24; // CDN caches longer
  
  if (options.isPublic) {
    headers.set('Cache-Control', 
      `public, max-age=${maxAge}, s-maxage=${sMaxAge}${
        options.staleWhileRevalidate ? `, stale-while-revalidate=${options.staleWhileRevalidate}` : ''
      }`
    );
  } else {
    headers.set('Cache-Control', `private, max-age=${maxAge}`);
  }
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  
  // CORS headers for file access
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Range');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

#### 5.5.2 Comprehensive Monitoring and Metrics

```typescript
// services/MetricsService.ts
export interface FileMetric {
  timestamp: string;
  userId: number;
  fileId: string;
  action: 'upload' | 'download' | 'delete' | 'process' | 'list';
  success: boolean;
  duration: number;
  fileSize?: number;
  bytesTransferred?: number;
  errorCode?: string;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
  cacheHit?: boolean;
  processingTimeMs?: number;
}

export class MetricsService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }

  async recordMetric(metric: FileMetric): Promise<void> {
    try {
      // Store in database for long-term analysis
      await this.db.prepare(`
        INSERT INTO file_access_logs (
          file_id, user_id, action, timestamp, success, 
          bytes_transferred, processing_time_ms, error_message,
          ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        metric.fileId,
        metric.userId,
        metric.action,
        metric.timestamp,
        metric.success,
        metric.bytesTransferred || null,
        metric.processingTimeMs || metric.duration,
        metric.errorMessage || null,
        metric.ipAddress || null,
        metric.userAgent || null
      ).run();
      
      // Also log to console for real-time monitoring
      this.logStructuredMetric(metric);
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  async getMetricsSummary(timeframe: {
    start: Date;
    end: Date;
    userId?: number;
  }): Promise<{
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    totalBytesTransferred: number;
    operationBreakdown: Record<string, number>;
    errorBreakdown: Record<string, number>;
    topUsers: Array<{ userId: number; operationCount: number }>;
  }> {
    const baseQuery = `
      FROM file_access_logs 
      WHERE timestamp >= ? AND timestamp <= ?
      ${timeframe.userId ? 'AND user_id = ?' : ''}
    `;
    
    const params = [
      timeframe.start.toISOString(),
      timeframe.end.toISOString(),
    ];
    
    if (timeframe.userId) {
      params.push(timeframe.userId.toString());
    }

    // Get overall stats
    const overallStats = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_operations,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
        AVG(processing_time_ms) as avg_response_time,
        SUM(COALESCE(bytes_transferred, 0)) as total_bytes
      ${baseQuery}
    `).bind(...params).first();

    // Get operation breakdown
    const operationBreakdown = await this.db.prepare(`
      SELECT action, COUNT(*) as count
      ${baseQuery}
      GROUP BY action
    `).bind(...params).all();

    // Get error breakdown
    const errorBreakdown = await this.db.prepare(`
      SELECT error_message, COUNT(*) as count
      ${baseQuery}
      AND success = FALSE AND error_message IS NOT NULL
      GROUP BY error_message
    `).bind(...params).all();

    // Get top users (if not filtering by specific user)
    const topUsers = timeframe.userId ? [] : await this.db.prepare(`
      SELECT user_id, COUNT(*) as operation_count
      ${baseQuery}
      GROUP BY user_id
      ORDER BY operation_count DESC
      LIMIT 10
    `).bind(...params).all();

    return {
      totalOperations: overallStats?.total_operations as number || 0,
      successRate: overallStats?.success_rate as number || 0,
      averageResponseTime: overallStats?.avg_response_time as number || 0,
      totalBytesTransferred: overallStats?.total_bytes as number || 0,
      operationBreakdown: Object.fromEntries(
        operationBreakdown.results.map(row => [row.action, row.count])
      ),
      errorBreakdown: Object.fromEntries(
        errorBreakdown.results.map(row => [row.error_message, row.count])
      ),
      topUsers: topUsers.results.map(row => ({
        userId: row.user_id as number,
        operationCount: row.operation_count as number,
      })),
    };
  }

  async getPerformanceMetrics(timeframe: {
    start: Date;
    end: Date;
  }): Promise<{
    uploadMetrics: {
      averageUploadTime: number;
      averageUploadSpeed: number; // bytes per second
      successRate: number;
      totalUploads: number;
    };
    downloadMetrics: {
      averageDownloadTime: number;
      averageDownloadSpeed: number;
      cacheHitRate: number;
      totalDownloads: number;
    };
    processingMetrics: {
      averageProcessingTime: number;
      totalProcessingOperations: number;
      successRate: number;
    };
  }> {
    const params = [timeframe.start.toISOString(), timeframe.end.toISOString()];

    // Upload metrics
    const uploadStats = await this.db.prepare(`
      SELECT 
        AVG(processing_time_ms) as avg_time,
        AVG(CASE WHEN processing_time_ms > 0 AND bytes_transferred > 0 
            THEN bytes_transferred * 1000.0 / processing_time_ms 
            ELSE NULL END) as avg_speed,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
        COUNT(*) as total_count
      FROM file_access_logs 
      WHERE timestamp >= ? AND timestamp <= ? AND action = 'upload'
    `).bind(...params).first();

    // Download metrics  
    const downloadStats = await this.db.prepare(`
      SELECT 
        AVG(processing_time_ms) as avg_time,
        AVG(CASE WHEN processing_time_ms > 0 AND bytes_transferred > 0 
            THEN bytes_transferred * 1000.0 / processing_time_ms 
            ELSE NULL END) as avg_speed,
        COUNT(*) as total_count
      FROM file_access_logs 
      WHERE timestamp >= ? AND timestamp <= ? AND action = 'download'
    `).bind(...params).first();

    // Processing metrics
    const processingStats = await this.db.prepare(`
      SELECT 
        AVG(processing_time_ms) as avg_time,
        AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
        COUNT(*) as total_count
      FROM file_access_logs 
      WHERE timestamp >= ? AND timestamp <= ? AND action = 'process'
    `).bind(...params).first();

    return {
      uploadMetrics: {
        averageUploadTime: uploadStats?.avg_time as number || 0,
        averageUploadSpeed: uploadStats?.avg_speed as number || 0,
        successRate: uploadStats?.success_rate as number || 0,
        totalUploads: uploadStats?.total_count as number || 0,
      },
      downloadMetrics: {
        averageDownloadTime: downloadStats?.avg_time as number || 0,
        averageDownloadSpeed: downloadStats?.avg_speed as number || 0,
        cacheHitRate: 0, // Would need to track cache hits separately
        totalDownloads: downloadStats?.total_count as number || 0,
      },
      processingMetrics: {
        averageProcessingTime: processingStats?.avg_time as number || 0,
        totalProcessingOperations: processingStats?.total_count as number || 0,
        successRate: processingStats?.success_rate as number || 0,
      },
    };
  }

  private logStructuredMetric(metric: FileMetric): void {
    // Log in a format suitable for monitoring tools like Datadog, New Relic, etc.
    const logEntry = {
      '@timestamp': metric.timestamp,
      level: metric.success ? 'info' : 'error',
      service: 'cutty-files',
      action: metric.action,
      user_id: metric.userId,
      file_id: metric.fileId,
      duration_ms: metric.duration,
      success: metric.success,
      file_size_bytes: metric.fileSize,
      bytes_transferred: metric.bytesTransferred,
      cache_hit: metric.cacheHit,
      error_code: metric.errorCode,
      error_message: metric.errorMessage,
      user_agent: metric.userAgent,
      ip_address: metric.ipAddress,
    };
    
    console.log(JSON.stringify(logEntry));
  }
}
```

## Execution Timeline and Rollout Strategy

### Phase 5 Implementation Schedule (4-5 days)

#### Day 1: Infrastructure and Core Services
**Morning (4 hours):**
- Set up R2 buckets (prod/staging)
- Configure CORS and access policies
- Create D1 database schema with indexes
- Set up Wrangler configuration

**Afternoon (4 hours):**
- Implement core R2StorageService
- Add file upload/download functionality
- Implement basic error handling and logging
- Write unit tests for storage service

#### Day 2: Migration Framework
**Morning (4 hours):**
- Implement MigrationService with batching
- Add file integrity verification
- Create migration planning and analysis tools
- Test migration with sample data

**Afternoon (4 hours):**
- Implement streaming CSV processor
- Add large file handling with multipart uploads
- Create performance monitoring hooks
- Test end-to-end file processing

#### Day 3: Security and Access Control
**Morning (4 hours):**
- Implement user access control and authorization
- Add file type validation and content scanning
- Create signed URL generation for secure access
- Implement rate limiting and abuse prevention

**Afternoon (4 hours):**
- Add comprehensive audit logging
- Implement cache service with CDN optimization
- Create monitoring and metrics collection
- Performance testing and optimization

#### Day 4: Migration Execution
**Morning (4 hours):**
- Dry run migration with production data
- Validate migration results and integrity
- Fix any issues discovered during testing
- Prepare rollback procedures

**Afternoon (4 hours):**
- Execute staged migration (10% of files)
- Monitor performance and error rates
- Validate migrated files access and functionality
- Prepare for full migration

#### Day 5: Production Deployment
**Morning (4 hours):**
- Execute full migration in batches
- Monitor system performance and user impact
- Validate all file operations work correctly
- Switch application to use R2 exclusively

**Afternoon (2 hours):**
- Final validation and testing
- Clean up migration artifacts
- Document any issues and resolutions
- Set up ongoing monitoring and alerting

### Rollback Strategy

#### Immediate Rollback (< 1 hour)
1. **DNS/Traffic Switch**: Redirect traffic back to old filesystem-based deployment
2. **Database Rollback**: Restore database from pre-migration backup
3. **File Access**: Ensure local files are still accessible
4. **Monitoring**: Verify all systems return to baseline performance

#### Partial Rollback (< 4 hours)
1. **Selective Migration**: Identify problematic files/users
2. **File Restoration**: Copy files back from R2 to local filesystem
3. **Database Updates**: Update file_path references in database
4. **User Communication**: Notify affected users of temporary issues

#### Full Recovery (< 24 hours)
1. **Complete Restoration**: Restore all files to filesystem
2. **Data Integrity Check**: Verify all files and metadata
3. **System Validation**: Test all functionality thoroughly
4. **Post-Mortem**: Document issues and improvement plan

## Success Criteria and Validation

### Technical Success Metrics
- **Data Integrity**: 100% of files migrated without corruption (verified by checksums)
- **Performance**: File operations perform at least as fast as before migration
- **Availability**: System maintains 99.9% uptime during migration
- **Scalability**: System handles 2x current load without degradation

### Business Success Metrics
- **User Experience**: No noticeable impact on user workflows
- **Cost Efficiency**: Storage costs reduced by target percentage
- **Feature Enablement**: New capabilities (large files, better processing) work correctly
- **Security**: Enhanced access control and audit logging functional

### Validation Procedures
1. **Automated Testing**: Comprehensive test suite validates all file operations
2. **User Acceptance Testing**: Key users validate critical workflows
3. **Performance Benchmarking**: Load testing confirms performance targets
4. **Security Audit**: Penetration testing validates access controls

## Risk Mitigation

### High-Risk Areas
1. **Data Loss**: Comprehensive backup and verification procedures
2. **Performance Degradation**: Staged rollout with performance monitoring
3. **User Disruption**: Communication plan and gradual migration
4. **Security Vulnerabilities**: Security review and penetration testing

### Contingency Plans
1. **Migration Failure**: Automated rollback procedures
2. **Performance Issues**: Traffic throttling and cache warming
3. **Security Breach**: Immediate access revocation and audit
4. **Scalability Problems**: Auto-scaling and load balancing

This comprehensive implementation plan provides a robust foundation for migrating List Cutter's file storage to Cloudflare R2 while maintaining system reliability, security, and performance throughout the transition.