// Hybrid Cache Service - Performance Optimization Issue #69
// Combines multiple cache layers with intelligent routing and compression

import { CacheService, CacheEntry, CacheStats, CompressionOptions, CompressionResult } from '../../types/cache';

export interface HybridCacheOptions {
  edgeCache: Cache;
  kvNamespace?: KVNamespace | null;
  maxMemoryEntries?: number;
  enableCompression?: boolean;
  compressionThreshold?: number; // bytes
  metricsService?: any;
  adaptiveOptimization?: boolean;
}

export class HybridCacheService implements CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private accessPatterns: Map<string, { count: number; lastAccess: number; avgSize: number }> = new Map();
  
  private cacheStats = {
    memory: { hits: 0, misses: 0, requests: 0 },
    kv: { hits: 0, misses: 0, requests: 0 },
    edge: { hits: 0, misses: 0, requests: 0 },
    compression: { attempts: 0, successes: 0, savings: 0 }
  };

  private readonly options: Required<HybridCacheOptions>;

  constructor(options: HybridCacheOptions) {
    this.options = {
      maxMemoryEntries: 1000,
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      metricsService: null,
      adaptiveOptimization: true,
      ...options
    };
  }

  async cacheFile(key: string, content: ArrayBuffer, ttl: number): Promise<void> {
    const cacheKey = `file:${key}`;
    const size = content.byteLength;
    
    try {
      // Update access patterns
      this.updateAccessPattern(cacheKey, size);
      
      // Determine optimal caching strategy based on size and access patterns
      const strategy = this.determineCachingStrategy(cacheKey, size);
      
      let finalContent = content;
      let compressionMetadata: any = null;
      
      // Apply compression if beneficial
      if (this.options.enableCompression && size > this.options.compressionThreshold) {
        const compressionResult = await this.attemptCompression(content);
        if (compressionResult.success && compressionResult.data) {
          finalContent = compressionResult.data;
          compressionMetadata = {
            algorithm: compressionResult.algorithm,
            originalSize: compressionResult.originalSize,
            compressedSize: compressionResult.compressedSize,
            ratio: compressionResult.compressionRatio
          };
          
          this.cacheStats.compression.attempts++;
          this.cacheStats.compression.successes++;
          this.cacheStats.compression.savings += compressionResult.originalSize - compressionResult.compressedSize;
        } else {
          this.cacheStats.compression.attempts++;
        }
      }
      
      const cacheEntry: CacheEntry = {
        data: finalContent,
        timestamp: Date.now(),
        ttl: ttl * 1000,
        metadata: {
          originalSize: size,
          compressed: !!compressionMetadata,
          compressionInfo: compressionMetadata,
          strategy
        }
      };
      
      // Cache according to strategy
      await this.applyCachingStrategy(cacheKey, cacheEntry, strategy);
      
      // Record metrics
      if (this.options.metricsService) {
        await this.recordCacheOperation('file_cache', cacheKey, size, strategy);
      }
      
    } catch (error) {
      console.error('Hybrid cache file storage failed:', error);
    }
  }

  async getCachedFile(key: string): Promise<ArrayBuffer | null> {
    const cacheKey = `file:${key}`;
    
    try {
      // Try memory cache first (fastest)
      this.cacheStats.memory.requests++;
      const memoryResult = this.memoryCache.get(cacheKey);
      if (memoryResult && this.isCacheValid(memoryResult)) {
        this.cacheStats.memory.hits++;
        this.updateAccessPattern(cacheKey, 0);
        
        return await this.decompressIfNeeded(memoryResult);
      }
      this.cacheStats.memory.misses++;
      
      // Try edge cache (fast, globally distributed)
      this.cacheStats.edge.requests++;
      const edgeResult = await this.options.edgeCache.match(cacheKey);
      if (edgeResult) {
        this.cacheStats.edge.hits++;
        const data = await edgeResult.arrayBuffer();
        
        // Populate memory cache with decompressed data if space allows
        if (this.memoryCache.size < this.options.maxMemoryEntries) {
          this.setMemoryCache(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: 300000 // 5 minutes
          });
        }
        
        // Note: Edge cached data might be compressed, but Response.arrayBuffer() handles it
        return data;
      }
      this.cacheStats.edge.misses++;
      
      // Try KV cache (persistent but slower)
      if (this.options.kvNamespace) {
        this.cacheStats.kv.requests++;
        const kvResult = await this.options.kvNamespace.get(cacheKey);
        if (kvResult) {
          const kvData = JSON.parse(kvResult);
          
          if (Date.now() - kvData.timestamp < kvData.ttl) {
            this.cacheStats.kv.hits++;
            const data = new Uint8Array(kvData.data).buffer;
            
            // Populate higher-level caches
            await this.cacheFile(key, data, 300); // 5 minutes
            
            return data;
          }
        }
        this.cacheStats.kv.misses++;
      }
      
      return null;
      
    } catch (error) {
      console.error('Hybrid cache file retrieval failed:', error);
      return null;
    }
  }

  async cacheQuery(key: string, result: any, ttl: number): Promise<void> {
    const cacheKey = `query:${key}`;
    const serialized = JSON.stringify(result);
    const size = serialized.length * 2; // Rough UTF-16 size estimate
    
    try {
      this.updateAccessPattern(cacheKey, size);
      const strategy = this.determineCachingStrategy(cacheKey, size);
      
      const cacheEntry: CacheEntry = {
        data: result,
        timestamp: Date.now(),
        ttl: ttl * 1000,
        metadata: { strategy, dataType: 'query' }
      };
      
      await this.applyCachingStrategy(cacheKey, cacheEntry, strategy);
      
      if (this.options.metricsService) {
        await this.recordCacheOperation('query_cache', cacheKey, size, strategy);
      }
      
    } catch (error) {
      console.error('Hybrid cache query storage failed:', error);
    }
  }

  async getCachedQuery(key: string): Promise<any | null> {
    const cacheKey = `query:${key}`;
    
    try {
      // Memory first
      this.cacheStats.memory.requests++;
      const memoryResult = this.memoryCache.get(cacheKey);
      if (memoryResult && this.isCacheValid(memoryResult)) {
        this.cacheStats.memory.hits++;
        this.updateAccessPattern(cacheKey, 0);
        return memoryResult.data;
      }
      this.cacheStats.memory.misses++;
      
      // KV for queries (edge cache less suitable for JSON)
      if (this.options.kvNamespace) {
        this.cacheStats.kv.requests++;
        const kvResult = await this.options.kvNamespace.get(cacheKey);
        if (kvResult) {
          this.cacheStats.kv.hits++;
          const data = JSON.parse(kvResult);
          
          // Populate memory cache
          this.setMemoryCache(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: 300000
          });
          
          return data;
        }
        this.cacheStats.kv.misses++;
      }
      
      return null;
      
    } catch (error) {
      console.error('Hybrid cache query retrieval failed:', error);
      return null;
    }
  }

  async cacheMetadata(key: string, metadata: any, ttl: number): Promise<void> {
    return this.cacheQuery(key, metadata, ttl); // Metadata handled like queries
  }

  async getCachedMetadata(key: string): Promise<any | null> {
    return this.getCachedQuery(key); // Metadata handled like queries
  }

  async invalidateCache(keyPattern: string): Promise<void> {
    try {
      // Invalidate memory cache
      const keysToDelete: string[] = [];
      for (const key of this.memoryCache.keys()) {
        if (key.includes(keyPattern)) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
        this.accessPatterns.delete(key);
      }
      
      // KV and Edge cache invalidation is more complex
      // For now, we'll let them expire naturally
      console.log(`Invalidated memory cache for pattern: ${keyPattern}`);
      
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    const memoryStats = this.cacheStats.memory;
    const kvStats = this.cacheStats.kv;
    const edgeStats = this.cacheStats.edge;
    
    const calculateHitRate = (hits: number, total: number) => 
      total > 0 ? hits / total : 0;
    
    const calculateMissRate = (misses: number, total: number) => 
      total > 0 ? misses / total : 0;
    
    const totalRequests = memoryStats.requests + kvStats.requests + edgeStats.requests;
    const totalHits = memoryStats.hits + kvStats.hits + edgeStats.hits;
    
    return {
      memoryCache: {
        size: this.getMemoryCacheSize(),
        hitRate: calculateHitRate(memoryStats.hits, memoryStats.requests),
        missRate: calculateMissRate(memoryStats.misses, memoryStats.requests),
        entries: this.memoryCache.size
      },
      kvCache: {
        hitRate: calculateHitRate(kvStats.hits, kvStats.requests),
        missRate: calculateMissRate(kvStats.misses, kvStats.requests),
        totalRequests: kvStats.requests
      },
      edgeCache: {
        hitRate: calculateHitRate(edgeStats.hits, edgeStats.requests),
        missRate: calculateMissRate(edgeStats.misses, edgeStats.requests),
        totalRequests: edgeStats.requests
      },
      overall: {
        hitRate: calculateHitRate(totalHits, totalRequests),
        missRate: calculateMissRate(totalRequests - totalHits, totalRequests),
        totalRequests
      }
    };
  }

  // Hybrid-specific methods
  async getAdvancedStats(): Promise<any> {
    const baseStats = await this.getCacheStats();
    
    return {
      ...baseStats,
      compression: {
        attemptCount: this.cacheStats.compression.attempts,
        successCount: this.cacheStats.compression.successes,
        successRate: this.cacheStats.compression.attempts > 0 ? 
          this.cacheStats.compression.successes / this.cacheStats.compression.attempts : 0,
        totalSavings: this.cacheStats.compression.savings,
        averageSavings: this.cacheStats.compression.successes > 0 ?
          this.cacheStats.compression.savings / this.cacheStats.compression.successes : 0
      },
      accessPatterns: this.getAccessPatternSummary(),
      optimization: this.getOptimizationSuggestions()
    };
  }

  private determineCachingStrategy(key: string, size: number): string[] {
    const strategies: string[] = [];
    const pattern = this.accessPatterns.get(key);
    
    // Always cache in memory for frequently accessed items
    if (!pattern || pattern.count < 3 || size < 64 * 1024) { // < 64KB
      strategies.push('memory');
    }
    
    // Use edge cache for medium-sized files that are accessed globally
    if (size < 10 * 1024 * 1024) { // < 10MB
      strategies.push('edge');
    }
    
    // Use KV for persistent storage of all items
    if (this.options.kvNamespace) {
      strategies.push('kv');
    }
    
    return strategies;
  }

  private async applyCachingStrategy(key: string, entry: CacheEntry, strategies: string[]): Promise<void> {
    for (const strategy of strategies) {
      try {
        switch (strategy) {
          case 'memory':
            this.setMemoryCache(key, entry);
            break;
          case 'edge':
            await this.cacheInEdge(key, entry);
            break;
          case 'kv':
            await this.cacheInKV(key, entry);
            break;
        }
      } catch (error) {
        console.error(`Failed to cache in ${strategy}:`, error);
      }
    }
  }

  private async cacheInEdge(key: string, entry: CacheEntry): Promise<void> {
    let content: ArrayBuffer | string;
    let contentType: string;
    
    if (entry.data instanceof ArrayBuffer) {
      content = entry.data;
      contentType = 'application/octet-stream';
    } else {
      content = JSON.stringify(entry.data);
      contentType = 'application/json';
    }
    
    const response = new Response(content, {
      headers: {
        'Cache-Control': `public, max-age=${Math.floor(entry.ttl / 1000)}`,
        'Content-Type': contentType,
        'X-Cache-TTL': Math.floor(entry.ttl / 1000).toString(),
        'X-Cache-Timestamp': entry.timestamp.toString(),
        'X-Cache-Metadata': JSON.stringify(entry.metadata || {})
      }
    });
    
    await this.options.edgeCache.put(key, response);
  }

  private async cacheInKV(key: string, entry: CacheEntry): Promise<void> {
    if (!this.options.kvNamespace) return;
    
    let serializedData: any;
    if (entry.data instanceof ArrayBuffer) {
      serializedData = Array.from(new Uint8Array(entry.data));
    } else {
      serializedData = entry.data;
    }
    
    const kvValue = {
      data: serializedData,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      metadata: entry.metadata
    };
    
    await this.options.kvNamespace.put(key, JSON.stringify(kvValue), {
      expirationTtl: Math.floor(entry.ttl / 1000)
    });
  }

  private async attemptCompression(data: ArrayBuffer): Promise<CompressionResult> {
    try {
      // Use built-in compression (gzip via CompressionStream)
      const compressionStream = new CompressionStream('gzip');
      const writer = compressionStream.writable.getWriter();
      const reader = compressionStream.readable.getReader();
      
      const chunks: Uint8Array[] = [];
      
      // Start compression
      const writePromise = writer.write(new Uint8Array(data)).then(() => writer.close());
      
      // Read compressed data
      const readPromise = (async () => {
        let result;
        while (!(result = await reader.read()).done) {
          chunks.push(result.value);
        }
      })();
      
      await Promise.all([writePromise, readPromise]);
      
      // Combine chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const compressed = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      const compressedSize = compressed.byteLength;
      const originalSize = data.byteLength;
      const ratio = compressedSize / originalSize;
      
      // Only use compression if it saves significant space
      if (ratio < 0.9) { // At least 10% savings
        return {
          success: true,
          data: compressed.buffer,
          originalSize,
          compressedSize,
          compressionRatio: ratio,
          algorithm: 'gzip'
        };
      } else {
        return {
          success: false,
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          algorithm: 'none',
          reason: 'Insufficient compression benefit'
        };
      }
      
    } catch (error) {
      console.error('Compression failed:', error);
      return {
        success: false,
        originalSize: data.byteLength,
        compressedSize: data.byteLength,
        compressionRatio: 1,
        algorithm: 'none',
        reason: `Compression error: ${error.message}`
      };
    }
  }

  private async decompressIfNeeded(entry: CacheEntry): Promise<ArrayBuffer> {
    if (entry.metadata?.compressed && entry.metadata?.compressionInfo) {
      try {
        const decompressionStream = new DecompressionStream('gzip');
        const writer = decompressionStream.writable.getWriter();
        const reader = decompressionStream.readable.getReader();
        
        const chunks: Uint8Array[] = [];
        
        const writePromise = writer.write(new Uint8Array(entry.data as ArrayBuffer)).then(() => writer.close());
        
        const readPromise = (async () => {
          let result;
          while (!(result = await reader.read()).done) {
            chunks.push(result.value);
          }
        })();
        
        await Promise.all([writePromise, readPromise]);
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const decompressed = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }
        
        return decompressed.buffer;
        
      } catch (error) {
        console.error('Decompression failed:', error);
        return entry.data as ArrayBuffer;
      }
    }
    
    return entry.data as ArrayBuffer;
  }

  private updateAccessPattern(key: string, size: number): void {
    const pattern = this.accessPatterns.get(key) || { count: 0, lastAccess: 0, avgSize: 0 };
    
    pattern.count++;
    pattern.lastAccess = Date.now();
    if (size > 0) {
      pattern.avgSize = ((pattern.avgSize * (pattern.count - 1)) + size) / pattern.count;
    }
    
    this.accessPatterns.set(key, pattern);
  }

  private getAccessPatternSummary(): any {
    const patterns = Array.from(this.accessPatterns.entries());
    const totalKeys = patterns.length;
    
    if (totalKeys === 0) {
      return { totalKeys: 0, hotKeys: [], coldKeys: [] };
    }
    
    const sorted = patterns.sort((a, b) => b[1].count - a[1].count);
    const hotKeys = sorted.slice(0, 10).map(([key, pattern]) => ({ key, ...pattern }));
    const coldKeys = sorted.slice(-5).map(([key, pattern]) => ({ key, ...pattern }));
    
    return { totalKeys, hotKeys, coldKeys };
  }

  private getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.cacheStats;
    
    // Memory cache optimization
    const memoryHitRate = stats.memory.requests > 0 ? stats.memory.hits / stats.memory.requests : 0;
    if (memoryHitRate < 0.7) {
      suggestions.push('Consider increasing memory cache size or adjusting TTL values');
    }
    
    // Compression optimization
    const compressionRate = stats.compression.attempts > 0 ? stats.compression.successes / stats.compression.attempts : 0;
    if (compressionRate < 0.5 && stats.compression.attempts > 10) {
      suggestions.push('Review compression threshold - many files may not benefit from compression');
    }
    
    // Access pattern optimization
    const hotKeys = Array.from(this.accessPatterns.values()).filter(p => p.count > 10);
    if (hotKeys.length > this.options.maxMemoryEntries * 0.8) {
      suggestions.push('Consider increasing memory cache size for frequently accessed items');
    }
    
    return suggestions;
  }

  private async recordCacheOperation(operation: string, key: string, size: number, strategy: string[]): Promise<void> {
    if (this.options.metricsService) {
      try {
        await this.options.metricsService.recordCustomMetric('cache_operation', {
          operation,
          key: key.substring(0, 50), // Truncate for privacy
          size,
          strategy: strategy.join(','),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to record cache metrics:', error);
      }
    }
  }

  private setMemoryCache(key: string, entry: CacheEntry): void {
    if (this.memoryCache.size >= this.options.maxMemoryEntries) {
      this.evictLRU();
    }
    this.memoryCache.set(key, entry);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.accessPatterns.delete(oldestKey);
    }
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private getMemoryCacheSize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      if (entry.data instanceof ArrayBuffer) {
        size += entry.data.byteLength;
      } else {
        size += JSON.stringify(entry.data).length * 2;
      }
    }
    return size;
  }
}