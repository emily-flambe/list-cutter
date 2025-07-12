# Performance Optimization

## Performance Strategy

### Performance Goals
- **Response Time**: < 200ms global average for API endpoints
- **Time to First Byte (TTFB)**: < 100ms for static assets
- **File Processing**: < 500ms for CSV files up to 1MB
- **Cache Hit Rate**: > 80% for frequently accessed data
- **Core Web Vitals**: Excellent scores across all metrics

### Performance Monitoring
- **Real User Monitoring (RUM)**: Track actual user experience
- **Synthetic Monitoring**: Proactive performance testing
- **Performance Budgets**: Enforce performance constraints
- **Continuous Profiling**: Identify performance bottlenecks

## Caching Strategy

### Multi-Layer Caching Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser       │    │   Edge Cache    │    │   Workers       │
│                 │    │                 │    │                 │
│  - Local Cache  │    │  - Response     │    │  - Memory Cache │
│  - Service      │    │    Cache        │    │  - Computed     │
│    Worker       │    │  - Static       │    │    Results      │
│                 │    │    Assets       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   D1 Database   │
                    │                 │
                    │  - Query Cache  │
                    │  - Connection   │
                    │    Pool         │
                    └─────────────────┘
```

### Edge Caching Implementation
```typescript
export const edgeCacheMiddleware = async (c: Context, next: Next) => {
  const cacheKey = generateCacheKey(c.req);
  const cachedResponse = await getFromEdgeCache(cacheKey);
  
  if (cachedResponse) {
    // Cache hit - return cached response
    c.res.headers.set('X-Cache', 'HIT');
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      headers: cachedResponse.headers
    });
  }
  
  // Cache miss - execute request
  await next();
  
  // Cache successful responses
  if (c.res.status === 200 && shouldCache(c.req.path)) {
    await setEdgeCache(cacheKey, c.res, getCacheTTL(c.req.path));
    c.res.headers.set('X-Cache', 'MISS');
  }
};

const getCacheTTL = (path: string): number => {
  const cacheConfig: Record<string, number> = {
    '/api/files/list': 60,        // 1 minute
    '/api/users/profile': 300,    // 5 minutes
    '/health': 30,                // 30 seconds
    '/static/': 86400            // 24 hours
  };
  
  for (const [pattern, ttl] of Object.entries(cacheConfig)) {
    if (path.startsWith(pattern)) return ttl;
  }
  
  return 0; // No cache by default
};
```

### Memory Caching
```typescript
class MemoryCache {
  private cache = new Map<string, { value: any; expires: number }>();
  
  set(key: string, value: any, ttlSeconds: number): void {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const memoryCache = new MemoryCache();

export const withMemoryCache = async <T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>
): Promise<T> => {
  // Try memory cache first
  const cached = memoryCache.get(key);
  if (cached !== null) return cached;
  
  // Cache miss - compute value
  const value = await producer();
  memoryCache.set(key, value, ttlSeconds);
  
  return value;
};
```

### Database Query Optimization
```typescript
// Query result caching
export const withQueryCache = async <T>(
  query: string,
  params: any[],
  executor: () => Promise<T>
): Promise<T> => {
  const cacheKey = `query:${hashQuery(query, params)}`;
  
  return withMemoryCache(cacheKey, 300, executor); // 5 minute cache
};

// Optimized queries with indexes
export const getFilesByUser = async (userId: string, limit = 50, offset = 0) => {
  // Use indexed query for better performance
  return withQueryCache(
    'SELECT * FROM saved_files WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset],
    () => db.prepare(
      'SELECT * FROM saved_files WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(userId, limit, offset).all()
  );
};

// Batch operations for efficiency
export const getUserFileStats = async (userId: string) => {
  return withQueryCache(
    'getUserFileStats',
    [userId],
    async () => {
      const [totalFiles, totalSize] = await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM saved_files WHERE user_id = ?').bind(userId).first(),
        db.prepare('SELECT SUM(size) as total_size FROM saved_files WHERE user_id = ?').bind(userId).first()
      ]);
      
      return {
        totalFiles: totalFiles?.count || 0,
        totalSize: totalSize?.total_size || 0
      };
    }
  );
};
```

## File Processing Optimization

### Streaming File Processing
```typescript
export const processCSVStream = async (fileStream: ReadableStream, options: ProcessingOptions) => {
  const reader = fileStream.getReader();
  const writer = new WritableStream();
  
  let buffer = '';
  let headerProcessed = false;
  let lineCount = 0;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      
      // Keep incomplete line in buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!headerProcessed) {
          // Process header
          await processHeader(line, options);
          headerProcessed = true;
        } else {
          // Process data row
          const processedRow = await processDataRow(line, options);
          if (processedRow) {
            await writer.write(processedRow);
            lineCount++;
          }
        }
        
        // Yield control periodically to prevent blocking
        if (lineCount % 1000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    
    // Process remaining buffer
    if (buffer.trim()) {
      const processedRow = await processDataRow(buffer, options);
      if (processedRow) {
        await writer.write(processedRow);
      }
    }
    
  } finally {
    reader.releaseLock();
  }
};
```

### Optimized File Upload
```typescript
export const optimizedFileUpload = async (file: File, c: Context) => {
  // Validate file before processing
  if (!validateFileSize(file.size)) {
    throw new Error('File too large');
  }
  
  // Generate optimized R2 key
  const r2Key = generateOptimizedR2Key(file.name, c.get('user').id);
  
  // Use multipart upload for large files
  if (file.size > 5 * 1024 * 1024) { // 5MB threshold
    return uploadLargeFile(file, r2Key, c);
  }
  
  // Direct upload for smaller files
  return uploadSmallFile(file, r2Key, c);
};

const uploadLargeFile = async (file: File, r2Key: string, c: Context) => {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const chunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // Initialize multipart upload
  const uploadId = await c.env.R2.createMultipartUpload(r2Key);
  
  const uploadPromises = [];
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    uploadPromises.push(
      c.env.R2.uploadPart(r2Key, uploadId, i + 1, chunk)
    );
  }
  
  const parts = await Promise.all(uploadPromises);
  
  // Complete multipart upload
  return c.env.R2.completeMultipartUpload(r2Key, uploadId, parts);
};
```

## Database Performance Optimization

### Index Strategy
```sql
-- User-based indexes for fast lookups
CREATE INDEX idx_saved_files_user_id ON saved_files(user_id);
CREATE INDEX idx_saved_files_user_created ON saved_files(user_id, created_at DESC);

-- File access pattern indexes
CREATE INDEX idx_file_metadata_file_id ON file_metadata(file_id);
CREATE INDEX idx_file_lineage_parent ON file_lineage(parent_file_id);
CREATE INDEX idx_file_lineage_child ON file_lineage(child_file_id);

-- Security and monitoring indexes
CREATE INDEX idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, timestamp DESC);
CREATE INDEX idx_usage_metrics_user_time ON usage_metrics(user_id, timestamp DESC);

-- Authentication indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

### Query Optimization Patterns
```typescript
// Use prepared statements for better performance
const preparedQueries = {
  getUserFiles: db.prepare(`
    SELECT f.*, m.content_type, m.processing_status 
    FROM saved_files f 
    LEFT JOIN file_metadata m ON f.id = m.file_id 
    WHERE f.user_id = ? 
    ORDER BY f.created_at DESC 
    LIMIT ?
  `),
  
  getFileWithMetadata: db.prepare(`
    SELECT f.*, m.content_type, m.processing_status, m.r2_key
    FROM saved_files f
    LEFT JOIN file_metadata m ON f.id = m.file_id
    WHERE f.id = ? AND f.user_id = ?
  `),
  
  getUserStats: db.prepare(`
    SELECT 
      COUNT(*) as file_count,
      SUM(size) as total_size,
      MAX(created_at) as last_upload
    FROM saved_files 
    WHERE user_id = ?
  `)
};

// Batch operations for efficiency
export const batchUpdateFileMetadata = async (updates: FileMetadataUpdate[]) => {
  const stmt = db.prepare(`
    UPDATE file_metadata 
    SET processing_status = ?, r2_key = ?, updated_at = CURRENT_TIMESTAMP
    WHERE file_id = ?
  `);
  
  const transaction = db.transaction((updates) => {
    for (const update of updates) {
      stmt.run(update.status, update.r2Key, update.fileId);
    }
  });
  
  return transaction(updates);
};
```

## Frontend Performance Optimization

### React Optimization
```jsx
// Component memoization
export const FileList = React.memo(({ files, onFileSelect }) => {
  return (
    <VirtualizedList
      items={files}
      renderItem={({ item }) => <FileItem file={item} onSelect={onFileSelect} />}
      itemHeight={60}
      overscan={5}
    />
  );
});

// Virtualized lists for large datasets
import { FixedSizeList } from 'react-window';

export const VirtualizedFileList = ({ files }) => {
  const renderRow = useCallback(({ index, style }) => (
    <div style={style}>
      <FileItem file={files[index]} />
    </div>
  ), [files]);
  
  return (
    <FixedSizeList
      height={400}
      itemCount={files.length}
      itemSize={60}
      overscanCount={5}
    >
      {renderRow}
    </FixedSizeList>
  );
};

// Lazy loading for large components
const CSVProcessor = React.lazy(() => import('./CSVProcessor'));

export const App = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CSVProcessor />
    </Suspense>
  );
};
```

### Asset Optimization
```javascript
// Vite configuration for optimal builds
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
          utils: ['axios', 'date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  
  // Asset optimization
  assetsInclude: ['**/*.woff2'],
  
  // Code splitting
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@mui/icons-material']
  }
});
```

## Performance Testing

### Load Testing
```bash
# Artillery load testing
npm run test:load

# Custom load test with specific scenarios
artillery run tests/performance/load-test.yml

# Stress testing
artillery run tests/performance/stress-test.yml --target=https://cutty.emilycogsdill.com
```

### Performance Benchmarking
```typescript
// Benchmark critical paths
export const benchmarkFileProcessing = async () => {
  const testSizes = [1024, 10240, 102400, 1024000]; // 1KB to 1MB
  
  for (const size of testSizes) {
    const testData = generateTestCSV(size);
    const startTime = performance.now();
    
    await processCSVData(testData);
    
    const duration = performance.now() - startTime;
    console.log(`Size: ${size} bytes, Duration: ${duration}ms`);
  }
};

// Database performance testing
export const benchmarkDatabaseQueries = async () => {
  const queries = [
    () => getUserFiles('test-user-id', 50),
    () => getFileMetadata('test-file-id'),
    () => getUserStats('test-user-id')
  ];
  
  for (const [index, query] of queries.entries()) {
    const runs = 100;
    const times = [];
    
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      await query();
      times.push(performance.now() - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    
    console.log(`Query ${index}: Avg: ${avg}ms, P95: ${p95}ms`);
  }
};
```

### Real User Monitoring
```typescript
// Performance metrics collection
export const collectPerformanceMetrics = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    const metrics = {
      // Core Web Vitals
      TTFB: navigation.responseStart - navigation.requestStart,
      FCP: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime,
      LCP: getLargestContentfulPaint(),
      CLS: getCumulativeLayoutShift(),
      FID: getFirstInputDelay(),
      
      // Navigation timing
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      
      // Resource timing
      resources: performance.getEntriesByType('resource').map(entry => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize
      }))
    };
    
    // Send metrics to analytics
    sendAnalyticsEvent('performance_metrics', metrics);
  }
};
```

## Performance Monitoring and Alerts

### Performance Monitoring Dashboard
```typescript
export const getPerformanceMetrics = async (timeRange: string) => {
  const metrics = await db.prepare(`
    SELECT 
      AVG(response_time) as avg_response_time,
      P95(response_time) as p95_response_time,
      COUNT(*) as total_requests,
      COUNT(CASE WHEN response_time > 2000 THEN 1 END) as slow_requests
    FROM performance_logs 
    WHERE timestamp > datetime('now', '-' || ? || ' hours')
  `).bind(timeRange).first();
  
  return metrics;
};

// Performance alerting
export const checkPerformanceThresholds = async () => {
  const metrics = await getPerformanceMetrics('1');
  
  if (metrics.avg_response_time > 1000) {
    await sendPerformanceAlert({
      type: 'high_response_time',
      value: metrics.avg_response_time,
      threshold: 1000
    });
  }
  
  if (metrics.slow_requests / metrics.total_requests > 0.05) {
    await sendPerformanceAlert({
      type: 'high_slow_request_rate',
      value: metrics.slow_requests / metrics.total_requests,
      threshold: 0.05
    });
  }
};
```

### Performance Optimization Recommendations
```typescript
// Automated performance analysis
export const analyzePerformance = async () => {
  const analysis = {
    cacheHitRate: await getCacheHitRate(),
    averageResponseTime: await getAverageResponseTime(),
    slowQueries: await getSlowQueries(),
    largFiles: await getLargeFiles(),
    recommendations: []
  };
  
  // Generate recommendations
  if (analysis.cacheHitRate < 0.8) {
    analysis.recommendations.push('Improve cache strategy for better hit rates');
  }
  
  if (analysis.slowQueries.length > 0) {
    analysis.recommendations.push('Optimize slow database queries');
  }
  
  if (analysis.largFiles.length > 0) {
    analysis.recommendations.push('Implement file compression for large uploads');
  }
  
  return analysis;
};
```

## Performance Best Practices

### Code-Level Optimizations
- **Use async/await properly**: Avoid blocking operations
- **Implement proper caching**: Multi-layer cache strategy
- **Optimize database queries**: Use indexes and prepared statements
- **Stream large data**: Avoid loading entire files into memory
- **Lazy load components**: Load only what's needed
- **Minimize bundle size**: Code splitting and tree shaking

### Infrastructure Optimizations
- **Edge computing**: Leverage Cloudflare's global network
- **CDN utilization**: Cache static assets at edge locations
- **Database optimization**: Proper indexing and query optimization
- **Compression**: Gzip/Brotli compression for responses
- **HTTP/2**: Multiplexed connections for better performance

### Continuous Performance Improvement
- **Regular performance audits**: Monthly performance reviews
- **Load testing**: Regular stress testing of critical paths
- **Performance budgets**: Enforce performance constraints in CI/CD
- **User experience monitoring**: Track real user performance metrics
- **Performance culture**: Make performance a team priority