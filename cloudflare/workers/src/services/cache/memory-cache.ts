// Memory-Only Cache Service - Performance Optimization Issue #69
// Fast in-memory caching for development and high-speed scenarios

import { CacheService, CacheEntry, CacheStats } from '../../types/cache';

export class MemoryCacheService implements CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private accessOrder: Map<string, number> = new Map(); // For LRU tracking
  private accessCounter = 0;
  
  private cacheStats = {
    hits: 0,
    misses: 0,
    requests: 0,
    evictions: 0
  };

  constructor(
    private maxEntries: number = 1000,
    private defaultTTL: number = 300 // 5 minutes
  ) {}

  async cacheFile(key: string, content: ArrayBuffer, ttl: number = this.defaultTTL): Promise<void> {
    const cacheKey = `file:${key}`;
    this.setCache(cacheKey, {
      data: content,
      timestamp: Date.now(),
      ttl: ttl * 1000
    });
  }

  async getCachedFile(key: string): Promise<ArrayBuffer | null> {
    const cacheKey = `file:${key}`;
    this.cacheStats.requests++;
    
    const entry = this.memoryCache.get(cacheKey);
    if (entry && this.isCacheValid(entry)) {
      this.cacheStats.hits++;
      this.updateAccessOrder(cacheKey);
      return entry.data as ArrayBuffer;
    }
    
    this.cacheStats.misses++;
    if (entry && !this.isCacheValid(entry)) {
      this.memoryCache.delete(cacheKey);
      this.accessOrder.delete(cacheKey);
    }
    
    return null;
  }

  async cacheQuery(key: string, result: any, ttl: number = this.defaultTTL): Promise<void> {
    const cacheKey = `query:${key}`;
    this.setCache(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl: ttl * 1000
    });
  }

  async getCachedQuery(key: string): Promise<any | null> {
    const cacheKey = `query:${key}`;
    this.cacheStats.requests++;
    
    const entry = this.memoryCache.get(cacheKey);
    if (entry && this.isCacheValid(entry)) {
      this.cacheStats.hits++;
      this.updateAccessOrder(cacheKey);
      return entry.data;
    }
    
    this.cacheStats.misses++;
    if (entry && !this.isCacheValid(entry)) {
      this.memoryCache.delete(cacheKey);
      this.accessOrder.delete(cacheKey);
    }
    
    return null;
  }

  async cacheMetadata(key: string, metadata: any, ttl: number = this.defaultTTL): Promise<void> {
    const cacheKey = `metadata:${key}`;
    this.setCache(cacheKey, {
      data: metadata,
      timestamp: Date.now(),
      ttl: ttl * 1000
    });
  }

  async getCachedMetadata(key: string): Promise<any | null> {
    const cacheKey = `metadata:${key}`;
    this.cacheStats.requests++;
    
    const entry = this.memoryCache.get(cacheKey);
    if (entry && this.isCacheValid(entry)) {
      this.cacheStats.hits++;
      this.updateAccessOrder(cacheKey);
      return entry.data;
    }
    
    this.cacheStats.misses++;
    if (entry && !this.isCacheValid(entry)) {
      this.memoryCache.delete(cacheKey);
      this.accessOrder.delete(cacheKey);
    }
    
    return null;
  }

  async invalidateCache(keyPattern: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const key of this.memoryCache.keys()) {
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  async getCacheStats(): Promise<CacheStats> {
    const hitRate = this.cacheStats.requests > 0 ? 
      this.cacheStats.hits / this.cacheStats.requests : 0;
    const missRate = this.cacheStats.requests > 0 ? 
      this.cacheStats.misses / this.cacheStats.requests : 0;

    return {
      memoryCache: {
        size: this.getMemoryCacheSize(),
        hitRate,
        missRate,
        entries: this.memoryCache.size
      },
      kvCache: {
        hitRate: 0,
        missRate: 0,
        totalRequests: 0
      },
      edgeCache: {
        hitRate: 0,
        missRate: 0,
        totalRequests: 0
      },
      overall: {
        hitRate,
        missRate,
        totalRequests: this.cacheStats.requests
      }
    };
  }

  // Memory-specific methods
  getMemoryUsage(): number {
    return this.getMemoryCacheSize();
  }

  getEntryCount(): number {
    return this.memoryCache.size;
  }

  getEvictionCount(): number {
    return this.cacheStats.evictions;
  }

  // Clean up expired entries manually
  cleanupExpired(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      this.accessOrder.delete(key);
    }
    
    return keysToDelete.length;
  }

  // Preload cache with commonly accessed data
  async preload(items: Array<{key: string, data: any, ttl?: number, type?: 'file' | 'query' | 'metadata'}>): Promise<void> {
    for (const item of items) {
      const ttl = item.ttl || this.defaultTTL;
      
      switch (item.type || 'query') {
        case 'file':
          await this.cacheFile(item.key, item.data, ttl);
          break;
        case 'metadata':
          await this.cacheMetadata(item.key, item.data, ttl);
          break;
        default:
          await this.cacheQuery(item.key, item.data, ttl);
      }
    }
  }

  // Get cache keys matching pattern
  getKeys(pattern?: string): string[] {
    const keys = Array.from(this.memoryCache.keys());
    
    if (pattern) {
      return keys.filter(key => key.includes(pattern));
    }
    
    return keys;
  }

  // Export cache for debugging/analysis
  exportCache(): Record<string, any> {
    const exported: Record<string, any> = {};
    
    for (const [key, entry] of this.memoryCache.entries()) {
      exported[key] = {
        data: entry.data,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        isValid: this.isCacheValid(entry),
        age: Date.now() - entry.timestamp
      };
    }
    
    return exported;
  }

  private setCache(key: string, entry: CacheEntry): void {
    // Check if we need to evict entries
    if (this.memoryCache.size >= this.maxEntries) {
      this.evictLRU();
    }
    
    this.memoryCache.set(key, entry);
    this.updateAccessOrder(key);
  }

  private evictLRU(): void {
    // Find least recently used entry
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }

  private updateAccessOrder(key: string): void {
    this.accessOrder.set(key, ++this.accessCounter);
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
        // Rough estimate for object size
        size += JSON.stringify(entry.data).length * 2; // UTF-16 approximation
      }
    }
    
    return size;
  }
}