# Issue #69: Performance Optimization - Technical Implementation Plan

## Executive Summary
**Priority**: MEDIUM (Improves user experience)
**Estimated Duration**: 4 days
**Dependencies**: Issue #64 (Database Schema) and Issue #65 (Monitoring) should be completed first
**Risk Level**: Low (enhances performance, not blocking)

## Problem Statement
While the R2 storage system is functional, there are opportunities for significant performance improvements that would enhance user experience, reduce costs, and improve system efficiency. Current performance bottlenecks include lack of caching, unoptimized file compression, inefficient pre-signed URL generation, and suboptimal database queries.

## Technical Analysis

### Current State
- ✅ **Basic R2 operations**: File upload/download working
- ✅ **Database operations**: Basic CRUD operations functional
- ✅ **Monitoring framework**: Performance metrics being collected
- ❌ **Caching layer**: No caching implemented
- ❌ **File compression**: No automatic compression
- ❌ **Pre-signed URLs**: Basic implementation, not optimized
- ❌ **Database optimization**: No query optimization or indexing strategy

### Performance Bottlenecks Identified
Based on system analysis:

1. **Database Query Performance**: Unoptimized queries and missing indexes
2. **File Transfer Performance**: No compression, no streaming optimization
3. **Caching**: No caching layer for frequently accessed data
4. **API Response Times**: Inefficient data serialization and transfer
5. **Concurrent Operations**: Limited concurrency and parallel processing

## Implementation Strategy

### Phase 1: Multi-Layer Caching Strategy (Day 1)

#### Task 1.1: Implement Edge Caching
**File**: `cloudflare/workers/src/services/cache-service.ts`

```typescript
interface CacheService {
  // File content caching
  cacheFile(key: string, content: ArrayBuffer, ttl: number): Promise<void>;
  getCachedFile(key: string): Promise<ArrayBuffer | null>;
  
  // Database query caching
  cacheQuery(key: string, result: any, ttl: number): Promise<void>;
  getCachedQuery(key: string): Promise<any | null>;
  
  // Metadata caching
  cacheMetadata(key: string, metadata: any, ttl: number): Promise<void>;
  getCachedMetadata(key: string): Promise<any | null>;
}

class MultiLayerCacheService implements CacheService {
  constructor(
    private edgeCache: Cache,        // Cloudflare Edge Cache
    private kvCache: KVNamespace,    // KV for distributed caching
    private memoryCache: Map<string, CacheEntry> // In-memory cache
  ) {}
  
  async cacheFile(key: string, content: ArrayBuffer, ttl: number): Promise<void> {
    const cacheKey = `file:${key}`;
    const response = new Response(content, {
      headers: {
        'Cache-Control': `public, max-age=${ttl}`,
        'Content-Type': 'application/octet-stream'
      }
    });
    
    // 1. Cache in edge cache for global distribution
    await this.edgeCache.put(cacheKey, response.clone());
    
    // 2. Cache in KV for persistence
    await this.kvCache.put(cacheKey, content, { expirationTtl: ttl });
    
    // 3. Cache in memory for fastest access
    this.memoryCache.set(cacheKey, {
      data: content,
      timestamp: Date.now(),
      ttl: ttl * 1000
    });
  }
  
  async getCachedFile(key: string): Promise<ArrayBuffer | null> {
    const cacheKey = `file:${key}`;
    
    // 1. Check memory cache first (fastest)
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult && this.isCacheValid(memoryResult)) {
      return memoryResult.data;
    }
    
    // 2. Check edge cache (fast, globally distributed)
    const edgeResult = await this.edgeCache.match(cacheKey);
    if (edgeResult) {
      const data = await edgeResult.arrayBuffer();
      // Populate memory cache
      this.memoryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      });
      return data;
    }
    
    // 3. Check KV cache (slower but persistent)
    const kvResult = await this.kvCache.get(cacheKey, 'arrayBuffer');
    if (kvResult) {
      // Populate higher-level caches
      await this.cacheFile(key, kvResult, 300); // 5 minutes
      return kvResult;
    }
    
    return null;
  }
  
  async cacheQuery(key: string, result: any, ttl: number): Promise<void> {
    const cacheKey = `query:${key}`;
    const serializedResult = JSON.stringify(result);
    
    // Cache in KV for persistence
    await this.kvCache.put(cacheKey, serializedResult, { expirationTtl: ttl });
    
    // Cache in memory for speed
    this.memoryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl: ttl * 1000
    });
  }
  
  async getCachedQuery(key: string): Promise<any | null> {
    const cacheKey = `query:${key}`;
    
    // Check memory cache first
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult && this.isCacheValid(memoryResult)) {
      return memoryResult.data;
    }
    
    // Check KV cache
    const kvResult = await this.kvCache.get(cacheKey);
    if (kvResult) {
      const data = JSON.parse(kvResult);
      // Populate memory cache
      this.memoryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      });
      return data;
    }
    
    return null;
  }
  
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }
}
```

#### Task 1.2: Implement Smart Caching Middleware
**File**: `cloudflare/workers/src/middleware/caching-middleware.ts`

```typescript
class CachingMiddleware {
  constructor(
    private cacheService: CacheService,
    private metricsService: MetricsService
  ) {}
  
  async handleRequest(request: Request, handler: RequestHandler): Promise<Response> {
    const cacheKey = this.generateCacheKey(request);
    const startTime = Date.now();
    
    // 1. Check cache for response
    const cachedResponse = await this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      // Record cache hit
      await this.metricsService.recordCacheHit(cacheKey, Date.now() - startTime);
      return cachedResponse;
    }
    
    // 2. Execute request handler
    const response = await handler(request);
    
    // 3. Cache response if appropriate
    if (this.shouldCacheResponse(request, response)) {
      await this.cacheResponse(cacheKey, response);
    }
    
    // 4. Record cache miss
    await this.metricsService.recordCacheMiss(cacheKey, Date.now() - startTime);
    
    return response;
  }
  
  private generateCacheKey(request: Request): string {
    const url = new URL(request.url);
    const method = request.method;
    const headers = request.headers;
    
    // Create cache key based on URL, method, and relevant headers
    const keyComponents = [
      method,
      url.pathname,
      url.search,
      headers.get('Authorization')?.substring(0, 20), // Partial auth for user-specific caching
      headers.get('Accept-Encoding')
    ];
    
    return `request:${keyComponents.join(':')}`
      .replace(/[^a-zA-Z0-9:]/g, '_')
      .substring(0, 512); // Limit key length
  }
  
  private shouldCacheResponse(request: Request, response: Response): boolean {
    // Don't cache errors
    if (response.status >= 400) {
      return false;
    }
    
    // Don't cache POST/PUT/DELETE requests
    if (!['GET', 'HEAD'].includes(request.method)) {
      return false;
    }
    
    // Don't cache responses with Set-Cookie
    if (response.headers.has('Set-Cookie')) {
      return false;
    }
    
    // Cache based on content type
    const contentType = response.headers.get('Content-Type') || '';
    const cachableTypes = [
      'application/json',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'image/',
      'video/',
      'audio/',
      'application/pdf'
    ];
    
    return cachableTypes.some(type => contentType.includes(type));
  }
  
  private async cacheResponse(key: string, response: Response): Promise<void> {
    const ttl = this.calculateTTL(response);
    
    // Clone response for caching
    const responseClone = response.clone();
    const content = await responseClone.arrayBuffer();
    
    await this.cacheService.cacheFile(key, content, ttl);
  }
  
  private calculateTTL(response: Response): number {
    const cacheControl = response.headers.get('Cache-Control');
    
    if (cacheControl) {
      const maxAge = cacheControl.match(/max-age=(\d+)/);
      if (maxAge) {
        return parseInt(maxAge[1]);
      }
    }
    
    // Default TTL based on content type
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('image/') || contentType.includes('video/')) {
      return 3600; // 1 hour for media files
    } else if (contentType.includes('application/json')) {
      return 300; // 5 minutes for JSON
    } else {
      return 600; // 10 minutes default
    }
  }
}
```

### Phase 2: File Compression and Optimization (Day 2)

#### Task 2.1: Implement Automatic File Compression
**File**: `cloudflare/workers/src/services/compression-service.ts`

```typescript
class CompressionService {
  constructor(
    private compressionAlgorithms: Map<string, CompressionAlgorithm>
  ) {
    this.setupCompressionAlgorithms();
  }
  
  private setupCompressionAlgorithms(): void {
    this.compressionAlgorithms.set('gzip', new GzipCompressionAlgorithm());
    this.compressionAlgorithms.set('brotli', new BrotliCompressionAlgorithm());
    this.compressionAlgorithms.set('lz4', new LZ4CompressionAlgorithm());
  }
  
  async compressFile(file: ArrayBuffer, options: CompressionOptions = {}): Promise<CompressionResult> {
    const originalSize = file.byteLength;
    const algorithm = this.selectOptimalAlgorithm(file, options);
    
    const startTime = Date.now();
    const compressedData = await algorithm.compress(file);
    const compressionTime = Date.now() - startTime;
    
    const compressionRatio = compressedData.byteLength / originalSize;
    
    // Only use compression if it provides meaningful size reduction
    if (compressionRatio > 0.9) {
      return {
        success: false,
        reason: 'insufficient_compression',
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        algorithm: 'none'
      };
    }
    
    return {
      success: true,
      data: compressedData,
      originalSize,
      compressedSize: compressedData.byteLength,
      compressionRatio,
      algorithm: algorithm.name,
      compressionTime
    };
  }
  
  private selectOptimalAlgorithm(file: ArrayBuffer, options: CompressionOptions): CompressionAlgorithm {
    const fileSize = file.byteLength;
    const contentType = options.contentType || 'application/octet-stream';
    
    // Select algorithm based on file characteristics
    if (contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('xml')) {
      // Text files compress well with brotli
      return this.compressionAlgorithms.get('brotli')!;
    } else if (fileSize > 10 * 1024 * 1024) { // > 10MB
      // Large files benefit from faster compression
      return this.compressionAlgorithms.get('lz4')!;
    } else {
      // Default to gzip for good balance
      return this.compressionAlgorithms.get('gzip')!;
    }
  }
  
  async decompressFile(compressedData: ArrayBuffer, algorithm: string): Promise<ArrayBuffer> {
    const compressionAlgorithm = this.compressionAlgorithms.get(algorithm);
    if (!compressionAlgorithm) {
      throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
    
    return await compressionAlgorithm.decompress(compressedData);
  }
}

// Compression algorithm implementations
class GzipCompressionAlgorithm implements CompressionAlgorithm {
  name = 'gzip';
  
  async compress(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(data);
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }
  
  async decompress(data: ArrayBuffer): Promise<ArrayBuffer> {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(data);
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result.buffer;
  }
}
```

#### Task 2.2: Optimize File Upload/Download Performance
**File**: `cloudflare/workers/src/services/optimized-r2-service.ts`

```typescript
class OptimizedR2Service extends R2StorageService {
  constructor(
    r2Bucket: R2Bucket,
    db: D1Database,
    private compressionService: CompressionService,
    private cacheService: CacheService
  ) {
    super(r2Bucket, db);
  }
  
  async uploadFile(request: Request): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      // 1. Parse multipart form data efficiently
      const formData = await this.parseFormDataStream(request);
      
      // 2. Validate file
      const fileValidation = await this.validateFile(formData.file);
      if (!fileValidation.isValid) {
        throw new Error(`File validation failed: ${fileValidation.errors.join(', ')}`);
      }
      
      // 3. Optimize file before upload
      const optimizedFile = await this.optimizeFile(formData.file);
      
      // 4. Upload with parallel processing
      const uploadResult = await this.performOptimizedUpload(optimizedFile);
      
      // 5. Cache file metadata
      await this.cacheFileMetadata(uploadResult.fileId, uploadResult.metadata);
      
      // 6. Record performance metrics
      await this.recordUploadMetrics(uploadResult, Date.now() - startTime);
      
      return uploadResult;
      
    } catch (error) {
      console.error('Optimized upload failed:', error);
      throw error;
    }
  }
  
  async downloadFile(fileKey: string): Promise<Response> {
    const startTime = Date.now();
    
    try {
      // 1. Check cache first
      const cachedFile = await this.cacheService.getCachedFile(fileKey);
      if (cachedFile) {
        return new Response(cachedFile, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Cache': 'HIT'
          }
        });
      }
      
      // 2. Get file from R2
      const fileObject = await this.r2Bucket.get(fileKey);
      if (!fileObject) {
        return new Response('File not found', { status: 404 });
      }
      
      // 3. Check if file is compressed
      const metadata = await this.getFileMetadata(fileKey);
      let responseData = fileObject.body;
      
      if (metadata.isCompressed) {
        // Decompress file
        const compressedData = await fileObject.arrayBuffer();
        const decompressedData = await this.compressionService.decompressFile(
          compressedData,
          metadata.compressionAlgorithm
        );
        responseData = decompressedData;
      }
      
      // 4. Cache the file
      await this.cacheService.cacheFile(fileKey, responseData as ArrayBuffer, 3600);
      
      // 5. Create optimized response
      const response = new Response(responseData, {
        headers: {
          'Content-Type': metadata.mimeType,
          'Content-Length': metadata.originalSize.toString(),
          'Cache-Control': 'public, max-age=3600',
          'X-Cache': 'MISS'
        }
      });
      
      // 6. Record performance metrics
      await this.recordDownloadMetrics(fileKey, Date.now() - startTime);
      
      return response;
      
    } catch (error) {
      console.error('Optimized download failed:', error);
      throw error;
    }
  }
  
  private async optimizeFile(file: File): Promise<OptimizedFile> {
    const fileBuffer = await file.arrayBuffer();
    
    // 1. Compress file if beneficial
    const compressionResult = await this.compressionService.compressFile(fileBuffer, {
      contentType: file.type
    });
    
    // 2. Generate optimized metadata
    const metadata = {
      originalSize: file.size,
      mimeType: file.type,
      isCompressed: compressionResult.success,
      compressionAlgorithm: compressionResult.algorithm,
      compressionRatio: compressionResult.compressionRatio,
      optimizedSize: compressionResult.success ? compressionResult.compressedSize : file.size
    };
    
    return {
      data: compressionResult.success ? compressionResult.data : fileBuffer,
      metadata
    };
  }
  
  private async performOptimizedUpload(optimizedFile: OptimizedFile): Promise<UploadResult> {
    const fileId = crypto.randomUUID();
    const r2Key = `files/${fileId}`;
    
    // 1. Upload file to R2
    await this.r2Bucket.put(r2Key, optimizedFile.data);
    
    // 2. Store metadata in database
    await this.db.prepare(`
      INSERT INTO files (
        id, r2_key, filename, mime_type, file_size, 
        original_size, is_compressed, compression_algorithm, 
        compression_ratio, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      r2Key,
      optimizedFile.metadata.filename,
      optimizedFile.metadata.mimeType,
      optimizedFile.metadata.optimizedSize,
      optimizedFile.metadata.originalSize,
      optimizedFile.metadata.isCompressed,
      optimizedFile.metadata.compressionAlgorithm,
      optimizedFile.metadata.compressionRatio,
      new Date().toISOString()
    ).run();
    
    return {
      fileId,
      r2Key,
      metadata: optimizedFile.metadata
    };
  }
  
  private async parseFormDataStream(request: Request): Promise<FormDataResult> {
    // Optimized streaming parser for large files
    const contentType = request.headers.get('content-type') || '';
    const boundary = contentType.split('boundary=')[1];
    
    if (!boundary) {
      throw new Error('Invalid multipart form data');
    }
    
    const reader = request.body?.getReader();
    if (!reader) {
      throw new Error('No request body');
    }
    
    // Stream parsing implementation for memory efficiency
    // This avoids loading entire file into memory at once
    return await this.streamParseMultipart(reader, boundary);
  }
}
```

### Phase 3: Database Query Optimization (Day 3)

#### Task 3.1: Implement Database Query Optimization
**File**: `cloudflare/workers/src/services/optimized-database-service.ts`

```typescript
class OptimizedDatabaseService {
  constructor(
    private db: D1Database,
    private cacheService: CacheService,
    private metricsService: MetricsService
  ) {}
  
  async executeOptimizedQuery(query: string, params: any[] = []): Promise<any> {
    const queryKey = this.generateQueryKey(query, params);
    const startTime = Date.now();
    
    try {
      // 1. Check cache first
      const cachedResult = await this.cacheService.getCachedQuery(queryKey);
      if (cachedResult) {
        await this.metricsService.recordQueryCacheHit(queryKey, Date.now() - startTime);
        return cachedResult;
      }
      
      // 2. Execute query with optimization
      const optimizedQuery = await this.optimizeQuery(query, params);
      const result = await this.db.prepare(optimizedQuery.sql).bind(...optimizedQuery.params).all();
      
      // 3. Cache result if appropriate
      if (this.shouldCacheQuery(query)) {
        await this.cacheService.cacheQuery(queryKey, result, this.calculateQueryTTL(query));
      }
      
      // 4. Record performance metrics
      await this.metricsService.recordQueryExecution(queryKey, Date.now() - startTime);
      
      return result;
      
    } catch (error) {
      console.error('Optimized query failed:', error);
      throw error;
    }
  }
  
  private async optimizeQuery(query: string, params: any[]): Promise<OptimizedQuery> {
    // 1. Analyze query structure
    const analysis = await this.analyzeQuery(query);
    
    // 2. Apply optimization strategies
    let optimizedSQL = query;
    
    // Add appropriate indexes hints
    if (analysis.hasWhereClause) {
      optimizedSQL = this.addIndexHints(optimizedSQL, analysis.whereColumns);
    }
    
    // Optimize JOIN operations
    if (analysis.hasJoins) {
      optimizedSQL = this.optimizeJoins(optimizedSQL, analysis.joinTables);
    }
    
    // Add LIMIT if missing for potentially large result sets
    if (analysis.potentiallyLargeResult && !analysis.hasLimit) {
      optimizedSQL += ' LIMIT 1000';
    }
    
    return {
      sql: optimizedSQL,
      params,
      optimizations: analysis.appliedOptimizations
    };
  }
  
  private analyzeQuery(query: string): QueryAnalysis {
    const upperQuery = query.toUpperCase();
    
    return {
      hasWhereClause: upperQuery.includes('WHERE'),
      hasJoins: upperQuery.includes('JOIN'),
      hasLimit: upperQuery.includes('LIMIT'),
      hasOrderBy: upperQuery.includes('ORDER BY'),
      potentiallyLargeResult: upperQuery.includes('SELECT') && !upperQuery.includes('WHERE'),
      whereColumns: this.extractWhereColumns(query),
      joinTables: this.extractJoinTables(query),
      appliedOptimizations: []
    };
  }
  
  private generateQueryKey(query: string, params: any[]): string {
    return `query:${query}:${JSON.stringify(params)}`
      .replace(/\s+/g, '_')
      .substring(0, 256);
  }
  
  private shouldCacheQuery(query: string): boolean {
    const upperQuery = query.toUpperCase();
    
    // Don't cache write operations
    if (upperQuery.includes('INSERT') || upperQuery.includes('UPDATE') || upperQuery.includes('DELETE')) {
      return false;
    }
    
    // Cache read operations
    return upperQuery.includes('SELECT');
  }
  
  private calculateQueryTTL(query: string): number {
    const upperQuery = query.toUpperCase();
    
    // Long TTL for relatively static data
    if (upperQuery.includes('user_quotas') || upperQuery.includes('pricing_tiers')) {
      return 3600; // 1 hour
    }
    
    // Medium TTL for semi-dynamic data
    if (upperQuery.includes('files') || upperQuery.includes('storage_metrics')) {
      return 300; // 5 minutes
    }
    
    // Short TTL for dynamic data
    return 60; // 1 minute
  }
}
```

#### Task 3.2: Database Index Optimization
**File**: `cloudflare/workers/migrations/0006_performance_indexes.sql`

```sql
-- Performance optimization indexes for Phase 5.5

-- Files table indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_r2_key ON files(r2_key);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_size ON files(file_size);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_files_user_created ON files(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_user_type ON files(user_id, mime_type);

-- File access logs indexes
CREATE INDEX IF NOT EXISTS idx_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON file_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON file_access_logs(action);

-- Composite indexes for access patterns
CREATE INDEX IF NOT EXISTS idx_access_logs_user_timestamp ON file_access_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_access_logs_file_timestamp ON file_access_logs(file_id, timestamp);

-- Storage metrics indexes
CREATE INDEX IF NOT EXISTS idx_storage_metrics_user_id ON storage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_metrics_timestamp ON storage_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_storage_metrics_metric_type ON storage_metrics(metric_type);

-- Multipart uploads indexes
CREATE INDEX IF NOT EXISTS idx_multipart_user_id ON multipart_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_multipart_status ON multipart_uploads(status);
CREATE INDEX IF NOT EXISTS idx_multipart_created_at ON multipart_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_multipart_expires_at ON multipart_uploads(expires_at);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);

-- Alert rules indexes
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_severity ON alert_rules(severity);

-- Cost tracking indexes
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_date ON cost_tracking(date);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_cost_type ON cost_tracking(cost_type);

-- User quotas indexes
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_tier ON user_quotas(tier);
CREATE INDEX IF NOT EXISTS idx_user_quotas_updated_at ON user_quotas(updated_at);

-- Query optimization hints
ANALYZE files;
ANALYZE file_access_logs;
ANALYZE storage_metrics;
ANALYZE multipart_uploads;
ANALYZE security_events;
ANALYZE alert_rules;
ANALYZE cost_tracking;
ANALYZE user_quotas;
```

### Phase 4: Pre-signed URL Optimization and Performance Monitoring (Day 4)

#### Task 4.1: Optimize Pre-signed URL Generation
**File**: `cloudflare/workers/src/services/optimized-presigned-url-service.ts`

```typescript
class OptimizedPresignedUrlService {
  constructor(
    private r2Bucket: R2Bucket,
    private cacheService: CacheService,
    private db: D1Database
  ) {}
  
  async generatePresignedUrl(fileKey: string, operation: 'read' | 'write', expiresIn: number = 3600): Promise<PresignedUrlResult> {
    const cacheKey = `presigned:${fileKey}:${operation}:${expiresIn}`;
    
    // 1. Check cache for existing valid URL
    const cachedUrl = await this.cacheService.getCachedQuery(cacheKey);
    if (cachedUrl && this.isUrlValid(cachedUrl)) {
      return {
        url: cachedUrl.url,
        expiresAt: cachedUrl.expiresAt,
        cached: true
      };
    }
    
    // 2. Generate new pre-signed URL
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    let url: string;
    if (operation === 'read') {
      url = await this.r2Bucket.get(fileKey)?.then(obj => obj?.url || '');
    } else {
      // For write operations, generate upload URL
      url = await this.generateUploadUrl(fileKey, expiresIn);
    }
    
    const result = {
      url,
      expiresAt,
      cached: false
    };
    
    // 3. Cache the URL (with shorter TTL than expiration)
    const cacheTTL = Math.min(expiresIn * 0.8, 1800); // 80% of expiration or 30 minutes max
    await this.cacheService.cacheQuery(cacheKey, result, cacheTTL);
    
    return result;
  }
  
  async generateBatchPresignedUrls(fileKeys: string[], operation: 'read' | 'write', expiresIn: number = 3600): Promise<BatchPresignedUrlResult> {
    const results: Record<string, PresignedUrlResult> = {};
    const startTime = Date.now();
    
    // 1. Process URLs in parallel for better performance
    const urlPromises = fileKeys.map(async (fileKey) => {
      try {
        const result = await this.generatePresignedUrl(fileKey, operation, expiresIn);
        results[fileKey] = result;
      } catch (error) {
        results[fileKey] = {
          error: error.message,
          url: '',
          expiresAt: new Date(),
          cached: false
        };
      }
    });
    
    await Promise.all(urlPromises);
    
    const processingTime = Date.now() - startTime;
    const successCount = Object.values(results).filter(r => !r.error).length;
    
    return {
      results,
      totalCount: fileKeys.length,
      successCount,
      errorCount: fileKeys.length - successCount,
      processingTime,
      cached: Object.values(results).filter(r => r.cached).length
    };
  }
  
  private async generateUploadUrl(fileKey: string, expiresIn: number): Promise<string> {
    // Generate pre-signed URL for uploads
    // This is a simplified implementation - actual implementation depends on R2 API
    const uploadId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    
    const uploadUrl = `https://r2.emilycogsdill.com/upload/${fileKey}?uploadId=${uploadId}&expires=${expiresAt}`;
    
    return uploadUrl;
  }
  
  private isUrlValid(cachedUrl: any): boolean {
    return cachedUrl.expiresAt && new Date(cachedUrl.expiresAt) > new Date();
  }
}
```

#### Task 4.2: Implement Performance Monitoring and Optimization
**File**: `cloudflare/workers/src/services/performance-monitoring-service.ts`

```typescript
class PerformanceMonitoringService {
  constructor(
    private metricsService: MetricsService,
    private alertService: AlertService
  ) {}
  
  async recordFileOperation(operation: FileOperation): Promise<void> {
    const performanceMetrics = {
      operation: operation.type,
      fileSize: operation.fileSize,
      duration: operation.duration,
      cacheHit: operation.cacheHit,
      compressionRatio: operation.compressionRatio,
      timestamp: new Date().toISOString()
    };
    
    // 1. Store detailed metrics
    await this.metricsService.recordPerformanceMetrics(performanceMetrics);
    
    // 2. Check for performance issues
    await this.checkPerformanceThresholds(performanceMetrics);
    
    // 3. Update performance baselines
    await this.updatePerformanceBaselines(performanceMetrics);
  }
  
  async generatePerformanceReport(): Promise<PerformanceReport> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const metrics = await this.metricsService.getPerformanceMetrics(startTime, endTime);
    
    return {
      period: {
        start: startTime,
        end: endTime
      },
      summary: {
        totalOperations: metrics.length,
        averageResponseTime: this.calculateAverage(metrics.map(m => m.duration)),
        cacheHitRate: this.calculateCacheHitRate(metrics),
        compressionEfficiency: this.calculateCompressionEfficiency(metrics),
        throughput: this.calculateThroughput(metrics)
      },
      trends: {
        responseTimetrend: this.calculateTrend(metrics, 'duration'),
        cacheHitTrend: this.calculateTrend(metrics, 'cacheHit'),
        errorRateTrend: this.calculateTrend(metrics, 'errors')
      },
      recommendations: await this.generatePerformanceRecommendations(metrics)
    };
  }
  
  private async checkPerformanceThresholds(metrics: PerformanceMetrics): Promise<void> {
    const thresholds = {
      maxResponseTime: 5000, // 5 seconds
      minCacheHitRate: 0.8,   // 80%
      maxErrorRate: 0.05      // 5%
    };
    
    // Check response time
    if (metrics.duration > thresholds.maxResponseTime) {
      await this.alertService.triggerAlert({
        type: 'performance_degradation',
        severity: 'high',
        message: `Response time exceeded threshold: ${metrics.duration}ms`,
        metadata: metrics
      });
    }
    
    // Check cache hit rate (if we have recent data)
    const recentCacheHitRate = await this.getRecentCacheHitRate();
    if (recentCacheHitRate < thresholds.minCacheHitRate) {
      await this.alertService.triggerAlert({
        type: 'cache_performance_issue',
        severity: 'medium',
        message: `Cache hit rate below threshold: ${recentCacheHitRate}`,
        metadata: { cacheHitRate: recentCacheHitRate }
      });
    }
  }
  
  private async generatePerformanceRecommendations(metrics: PerformanceMetrics[]): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    
    const avgResponseTime = this.calculateAverage(metrics.map(m => m.duration));
    const cacheHitRate = this.calculateCacheHitRate(metrics);
    const compressionEfficiency = this.calculateCompressionEfficiency(metrics);
    
    // Response time recommendations
    if (avgResponseTime > 2000) {
      recommendations.push({
        type: 'response_time',
        priority: 'high',
        message: 'Consider implementing additional caching layers',
        details: 'Average response time is above 2 seconds'
      });
    }
    
    // Cache hit rate recommendations
    if (cacheHitRate < 0.7) {
      recommendations.push({
        type: 'cache_optimization',
        priority: 'medium',
        message: 'Optimize caching strategy and TTL settings',
        details: `Cache hit rate is ${(cacheHitRate * 100).toFixed(1)}%`
      });
    }
    
    // Compression recommendations
    if (compressionEfficiency < 0.3) {
      recommendations.push({
        type: 'compression',
        priority: 'low',
        message: 'Review compression algorithms and thresholds',
        details: 'Compression efficiency could be improved'
      });
    }
    
    return recommendations;
  }
  
  private calculateAverage(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculateCacheHitRate(metrics: PerformanceMetrics[]): number {
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    return cacheHits / metrics.length;
  }
  
  private calculateCompressionEfficiency(metrics: PerformanceMetrics[]): number {
    const compressedMetrics = metrics.filter(m => m.compressionRatio && m.compressionRatio < 1);
    if (compressedMetrics.length === 0) return 0;
    
    const avgCompressionRatio = compressedMetrics.reduce((sum, m) => sum + m.compressionRatio!, 0) / compressedMetrics.length;
    return 1 - avgCompressionRatio; // Convert to efficiency (higher is better)
  }
}
```

## Validation and Testing

### Performance Testing Framework
```bash
# Load testing
cd cloudflare/workers
npm test -- --testNamePattern="Performance.*load"

# Cache performance testing
npm test -- --testNamePattern="Cache.*performance"

# Compression testing
npm test -- --testNamePattern="Compression.*efficiency"

# Database optimization testing
npm test -- --testNamePattern="Database.*optimization"
```

### Performance Benchmarking
```bash
# Benchmark file operations
npm run benchmark -- --operation=upload --file-size=1MB --concurrent=10
npm run benchmark -- --operation=download --file-size=1MB --concurrent=10

# Benchmark database queries
npm run benchmark -- --operation=query --query-type=user-files --concurrent=5

# Benchmark caching
npm run benchmark -- --operation=cache --cache-type=file --concurrent=20
```

## Success Criteria

### Performance Improvements
- [ ] 50% reduction in average response time
- [ ] 80% cache hit rate or higher
- [ ] 30% reduction in storage costs through compression
- [ ] 90% reduction in database query times

### System Optimization
- [ ] Multi-layer caching implemented and operational
- [ ] Automatic file compression reducing storage usage
- [ ] Database query optimization reducing latency
- [ ] Pre-signed URL optimization improving user experience

### Monitoring and Alerting
- [ ] Performance monitoring dashboard operational
- [ ] Automated performance alerts configured
- [ ] Performance trend analysis available
- [ ] Optimization recommendations generated

## Risk Mitigation

### High Risk: Performance Regression
**Mitigation**: 
- Comprehensive performance testing before deployment
- Gradual rollout with monitoring
- Rollback capability if performance degrades
- Performance benchmarking and comparison

### Medium Risk: Cache Invalidation Issues
**Mitigation**:
- Robust cache invalidation strategy
- Multiple cache layers with different TTLs
- Cache warming procedures
- Cache monitoring and alerting

### Low Risk: Compression Failures
**Mitigation**:
- Fallback to uncompressed files
- Multiple compression algorithms
- Compression ratio validation
- Error handling and recovery

## Deliverables

### Performance Infrastructure
- [ ] Multi-layer caching system
- [ ] File compression and optimization
- [ ] Database query optimization
- [ ] Pre-signed URL optimization

### Monitoring and Analytics
- [ ] Performance monitoring service
- [ ] Performance reporting dashboard
- [ ] Automated performance alerts
- [ ] Performance recommendation engine

### Documentation
- [ ] Performance optimization guide
- [ ] Caching strategy documentation
- [ ] Database optimization procedures
- [ ] Performance troubleshooting guide

## Next Steps After Completion

1. **Immediate**: Monitor performance improvements and adjust optimizations
2. **Week 2**: Integrate with other Phase 5.5 components for comprehensive optimization
3. **Week 3**: Analyze real-world performance data and further optimize
4. **Ongoing**: Continuous performance monitoring and optimization based on usage patterns

This performance optimization implementation provides significant improvements to user experience, system efficiency, and operational costs while maintaining system reliability and functionality.