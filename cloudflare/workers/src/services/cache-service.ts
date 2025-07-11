// Multi-Layer Caching Service - Performance Optimization Issue #69
// Implements edge caching, KV caching, and memory caching for optimal performance

import { CacheService, CacheEntry, CacheStats } from '../types/cache';

export class MultiLayerCacheService implements CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private cacheStats = {
    memory: { hits: 0, misses: 0, requests: 0 },
    kv: { hits: 0, misses: 0, requests: 0 },
    edge: { hits: 0, misses: 0, requests: 0 }
  };

  constructor(
    private edgeCache: Cache,        // Cloudflare Edge Cache
    private kvCache: KVNamespace | null,    // KV for distributed caching (optional)
    private maxMemoryEntries: number = 1000 // Memory cache size limit
  ) {}
  
  async cacheFile(key: string, content: ArrayBuffer, ttl: number): Promise<void> {
    const cacheKey = `file:${key}`;
    const response = new Response(content, {
      headers: {
        'Cache-Control': `public, max-age=${ttl}`,
        'Content-Type': 'application/octet-stream',
        'X-Cache-TTL': ttl.toString(),
        'X-Cache-Timestamp': Date.now().toString()
      }
    });
    
    try {
      // 1. Cache in edge cache for global distribution
      await this.edgeCache.put(cacheKey, response.clone());
      
      // 2. Cache in KV for persistence (if available)
      if (this.kvCache) {
        const kvValue = {
          data: Array.from(new Uint8Array(content)),
          timestamp: Date.now(),
          ttl: ttl * 1000
        };
        await this.kvCache.put(cacheKey, JSON.stringify(kvValue), { 
          expirationTtl: ttl 
        });
      }
      
      // 3. Cache in memory for fastest access
      this.setMemoryCache(cacheKey, {
        data: content,
        timestamp: Date.now(),
        ttl: ttl * 1000
      });
      
    } catch (error) {
      console.error('Cache storage failed:', error);
      // Don't throw - caching failures shouldn't break the application
    }
  }
  
  async getCachedFile(key: string): Promise<ArrayBuffer | null> {
    const cacheKey = `file:${key}`;
    
    try {
      // 1. Check memory cache first (fastest)
      this.cacheStats.memory.requests++;
      const memoryResult = this.memoryCache.get(cacheKey);
      if (memoryResult && this.isCacheValid(memoryResult)) {
        this.cacheStats.memory.hits++;
        return memoryResult.data as ArrayBuffer;
      }
      this.cacheStats.memory.misses++;
      
      // 2. Check edge cache (fast, globally distributed)
      this.cacheStats.edge.requests++;
      const edgeResult = await this.edgeCache.match(cacheKey);
      if (edgeResult) {
        this.cacheStats.edge.hits++;
        const data = await edgeResult.arrayBuffer();
        
        // Populate memory cache
        this.setMemoryCache(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        });
        
        return data;
      }
      this.cacheStats.edge.misses++;
      
      // 3. Check KV cache (slower but persistent)
      this.cacheStats.kv.requests++;
      const kvResult = await this.kvCache.get(cacheKey);
      if (kvResult) {
        const kvData = JSON.parse(kvResult);
        
        // Check if KV entry is still valid
        if (Date.now() - kvData.timestamp < kvData.ttl) {
          this.cacheStats.kv.hits++;
          const data = new Uint8Array(kvData.data).buffer;
          
          // Populate higher-level caches
          await this.cacheFile(key, data, 300); // 5 minutes
          
          return data;
        }
      }
      this.cacheStats.kv.misses++;
      
    } catch (error) {
      console.error('Cache retrieval failed:', error);
    }
    
    return null;
  }
  
  async cacheQuery(key: string, result: any, ttl: number): Promise<void> {
    const cacheKey = `query:${key}`;
    
    try {
      const serializedResult = JSON.stringify(result);
      
      // Cache in KV for persistence (if available)
      if (this.kvCache) {
        await this.kvCache.put(cacheKey, serializedResult, { 
          expirationTtl: ttl 
        });
      }
      
      // Cache in memory for speed
      this.setMemoryCache(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: ttl * 1000
      });
      
    } catch (error) {
      console.error('Query cache storage failed:', error);
    }
  }
  
  async getCachedQuery(key: string): Promise<any | null> {
    const cacheKey = `query:${key}`;
    
    try {
      // Check memory cache first
      this.cacheStats.memory.requests++;
      const memoryResult = this.memoryCache.get(cacheKey);
      if (memoryResult && this.isCacheValid(memoryResult)) {
        this.cacheStats.memory.hits++;
        return memoryResult.data;
      }
      this.cacheStats.memory.misses++;
      
      // Check KV cache (if available)
      if (this.kvCache) {
        this.cacheStats.kv.requests++;
        const kvResult = await this.kvCache.get(cacheKey);
        if (kvResult) {
          this.cacheStats.kv.hits++;
          const data = JSON.parse(kvResult);
          
          // Populate memory cache
          this.setMemoryCache(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: 300000 // 5 minutes
          });
          
          return data;
        }
        this.cacheStats.kv.misses++;
      }
      
    } catch (error) {
      console.error('Query cache retrieval failed:', error);
    }
    
    return null;
  }
  
  async cacheMetadata(key: string, metadata: any, ttl: number): Promise<void> {
    const cacheKey = `metadata:${key}`;
    
    try {
      const serializedMetadata = JSON.stringify(metadata);
      
      // Cache in KV for persistence (if available)
      if (this.kvCache) {
        await this.kvCache.put(cacheKey, serializedMetadata, { 
          expirationTtl: ttl 
        });
      }
      
      // Cache in memory for speed
      this.setMemoryCache(cacheKey, {
        data: metadata,
        timestamp: Date.now(),
        ttl: ttl * 1000
      });
      
    } catch (error) {
      console.error('Metadata cache storage failed:', error);
    }
  }
  
  async getCachedMetadata(key: string): Promise<any | null> {
    const cacheKey = `metadata:${key}`;
    
    try {
      // Check memory cache first
      this.cacheStats.memory.requests++;
      const memoryResult = this.memoryCache.get(cacheKey);
      if (memoryResult && this.isCacheValid(memoryResult)) {
        this.cacheStats.memory.hits++;
        return memoryResult.data;
      }
      this.cacheStats.memory.misses++;
      
      // Check KV cache (if available)
      if (this.kvCache) {
        this.cacheStats.kv.requests++;
        const kvResult = await this.kvCache.get(cacheKey);
        if (kvResult) {
          this.cacheStats.kv.hits++;
          const data = JSON.parse(kvResult);
          
          // Populate memory cache
          this.setMemoryCache(cacheKey, {
            data,
            timestamp: Date.now(),
            ttl: 300000 // 5 minutes
          });
          
          return data;
        }
        this.cacheStats.kv.misses++;
      }
      
    } catch (error) {
      console.error('Metadata cache retrieval failed:', error);
    }
    
    return null;
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
      }
      
      // Note: KV and Edge cache invalidation is more complex
      // For now, we'll let them expire naturally
      // In production, you might implement a more sophisticated invalidation strategy
      
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
  
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  private setMemoryCache(key: string, entry: CacheEntry): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      this.evictOldestEntry();
    }
    
    this.memoryCache.set(key, entry);
  }
  
  private evictOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }
  
  private getMemoryCacheSize(): number {
    // Estimate memory usage in bytes
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      if (entry.data instanceof ArrayBuffer) {
        size += entry.data.byteLength;
      } else {
        // Rough estimate for object size
        size += JSON.stringify(entry.data).length * 2; // UTF-16 approximation
      }
    }
    return size;
  }
  
  // Cleanup method for expired entries
  cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isCacheValid(entry)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }
  }
}