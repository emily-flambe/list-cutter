/**
 * Caching Middleware for Unified Workers
 * Implements both in-memory and KV-based caching strategies
 */

import type { Env } from '../types';

export interface CacheEntry<T> {
  data: T;
  expires: number;
  metadata: {
    created: number;
    hits: number;
    lastAccessed: number;
  };
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  useKV?: boolean; // Whether to use KV for persistent cache
  namespace?: string; // Cache namespace for organization
  compressionThreshold?: number; // Size threshold for compression
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private maxMemoryEntries = 1000; // Prevent memory bloat
  private defaultTTL = 3600; // 1 hour default

  constructor(
    private env: Env,
    private options: CacheOptions = {}
  ) {}

  /**
   * Get value from cache (memory first, then KV)
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const cacheKey = this.buildKey(key, options?.namespace);
    
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(cacheKey);
    if (memoryEntry && Date.now() < memoryEntry.expires) {
      memoryEntry.metadata.hits++;
      memoryEntry.metadata.lastAccessed = Date.now();
      return memoryEntry.data as T;
    }

    // Remove expired memory entry
    if (memoryEntry) {
      this.memoryCache.delete(cacheKey);
    }

    // Try KV cache if enabled
    if (options?.useKV || this.options.useKV) {
      try {
        const kvValue = await this.env.CACHE.get(cacheKey);
        if (kvValue) {
          const entry: CacheEntry<T> = JSON.parse(kvValue);
          if (Date.now() < entry.expires) {
            // Store back in memory for faster access
            this.setMemoryCache(cacheKey, entry.data, entry.expires - Date.now());
            return entry.data;
          } else {
            // Remove expired KV entry
            await this.env.CACHE.delete(cacheKey);
          }
        }
      } catch (error) {
        console.warn('KV cache read error:', error);
      }
    }

    return null;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string, 
    data: T, 
    options?: CacheOptions
  ): Promise<void> {
    const cacheKey = this.buildKey(key, options?.namespace);
    const ttl = options?.ttl || this.defaultTTL;
    const expires = Date.now() + (ttl * 1000);

    const entry: CacheEntry<T> = {
      data,
      expires,
      metadata: {
        created: Date.now(),
        hits: 0,
        lastAccessed: Date.now(),
      },
    };

    // Always set in memory cache
    this.setMemoryCache(cacheKey, data, ttl * 1000);

    // Set in KV if enabled
    if (options?.useKV || this.options.useKV) {
      try {
        const serialized = JSON.stringify(entry);
        
        // Compress large entries if threshold is set
        const compressionThreshold = options?.compressionThreshold || this.options.compressionThreshold;
        if (compressionThreshold && serialized.length > compressionThreshold) {
          // For now, just log - compression would require additional library
          console.log(`Large cache entry (${serialized.length} bytes) for key: ${cacheKey}`);
        }

        await this.env.CACHE.put(cacheKey, serialized, {
          expirationTtl: ttl,
        });
      } catch (error) {
        console.warn('KV cache write error:', error);
      }
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    const cacheKey = this.buildKey(key, options?.namespace);
    
    // Remove from memory
    this.memoryCache.delete(cacheKey);

    // Remove from KV if enabled
    if (options?.useKV || this.options.useKV) {
      try {
        await this.env.CACHE.delete(cacheKey);
      } catch (error) {
        console.warn('KV cache delete error:', error);
      }
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string, options?: CacheOptions): Promise<number> {
    const namespace = options?.namespace || this.options.namespace;
    const regex = new RegExp(pattern);
    let invalidated = 0;

    // Invalidate memory cache
    for (const [key] of this.memoryCache.entries()) {
      if (regex.test(this.extractKey(key, namespace))) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    // Invalidate KV cache if enabled
    if (options?.useKV || this.options.useKV) {
      try {
        const prefix = namespace ? `${namespace}:` : '';
        const list = await this.env.CACHE.list({ prefix });
        
        for (const item of list.keys) {
          const extractedKey = this.extractKey(item.name, namespace);
          if (regex.test(extractedKey)) {
            await this.env.CACHE.delete(item.name);
            invalidated++;
          }
        }
      } catch (error) {
        console.warn('KV cache pattern invalidation error:', error);
      }
    }

    return invalidated;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryEntries: number;
    memoryHitRate: number;
    kvEntries?: number;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    const memoryEntries = this.memoryCache.size;
    let totalHits = 0;
    let totalAccesses = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const [, entry] of this.memoryCache.entries()) {
      totalHits += entry.metadata.hits;
      totalAccesses += entry.metadata.hits + 1; // +1 for initial set
      oldestEntry = Math.min(oldestEntry, entry.metadata.created);
      newestEntry = Math.max(newestEntry, entry.metadata.created);
    }

    const stats = {
      memoryEntries,
      memoryHitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      oldestEntry: oldestEntry === Date.now() ? undefined : oldestEntry,
      newestEntry: newestEntry || undefined,
    };

    // Get KV stats if available
    if (this.options.useKV) {
      try {
        const list = await this.env.CACHE.list();
        (stats as any).kvEntries = list.keys.length;
      } catch (error) {
        console.warn('Error getting KV stats:', error);
      }
    }

    return stats;
  }

  /**
   * Clear all cache entries
   */
  async clear(options?: CacheOptions): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear KV cache if enabled
    if (options?.useKV || this.options.useKV) {
      try {
        const namespace = options?.namespace || this.options.namespace;
        const prefix = namespace ? `${namespace}:` : '';
        const list = await this.env.CACHE.list({ prefix });
        
        const deletePromises = list.keys.map(item => 
          this.env.CACHE.delete(item.name)
        );
        
        await Promise.all(deletePromises);
      } catch (error) {
        console.warn('KV cache clear error:', error);
      }
    }
  }

  /**
   * Cleanup expired entries from memory cache
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expires) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Evict least recently used entries to maintain memory limits
   */
  evictLRU(targetSize?: number): number {
    const target = targetSize || this.maxMemoryEntries;
    
    if (this.memoryCache.size <= target) {
      return 0;
    }

    // Sort by last accessed time
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => a.metadata.lastAccessed - b.metadata.lastAccessed);

    const toEvict = this.memoryCache.size - target;
    let evicted = 0;

    for (let i = 0; i < toEvict && i < entries.length; i++) {
      this.memoryCache.delete(entries[i][0]);
      evicted++;
    }

    return evicted;
  }

  /**
   * Cache middleware for HTTP requests
   */
  middleware() {
    return async (
      request: Request,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const url = new URL(request.url);
      
      // Only cache GET requests
      if (request.method !== 'GET') {
        return next();
      }

      // Skip caching for certain paths
      if (this.shouldSkipCache(url.pathname)) {
        return next();
      }

      const cacheKey = this.buildRequestKey(request);
      
      // Try to get from cache
      const cached = await this.get<{
        body: string;
        status: number;
        headers: Record<string, string>;
      }>(cacheKey, { useKV: true, ttl: 300 }); // 5 minutes for HTTP responses

      if (cached) {
        return new Response(cached.body, {
          status: cached.status,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
            'X-Cache-Date': new Date().toISOString(),
          },
        });
      }

      // Get fresh response
      const response = await next();
      
      // Cache successful responses
      if (response.status === 200 && this.shouldCacheResponse(response)) {
        const body = await response.text();
        const headers: Record<string, string> = {};
        
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        await this.set(cacheKey, {
          body,
          status: response.status,
          headers,
        }, { useKV: true, ttl: 300 });

        return new Response(body, {
          status: response.status,
          headers: {
            ...headers,
            'X-Cache': 'MISS',
            'X-Cache-Date': new Date().toISOString(),
          },
        });
      }

      return response;
    };
  }

  private setMemoryCache<T>(key: string, data: T, ttlMs: number): void {
    // Evict old entries if at capacity
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      this.evictLRU(this.maxMemoryEntries - 1);
    }

    const entry: CacheEntry<T> = {
      data,
      expires: Date.now() + ttlMs,
      metadata: {
        created: Date.now(),
        hits: 0,
        lastAccessed: Date.now(),
      },
    };

    this.memoryCache.set(key, entry);
  }

  private buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.options.namespace;
    return ns ? `${ns}:${key}` : key;
  }

  private extractKey(fullKey: string, namespace?: string): string {
    const ns = namespace || this.options.namespace;
    return ns && fullKey.startsWith(`${ns}:`) 
      ? fullKey.substring(ns.length + 1) 
      : fullKey;
  }

  private buildRequestKey(request: Request): string {
    const url = new URL(request.url);
    return `http:${request.method}:${url.pathname}${url.search}`;
  }

  private shouldSkipCache(pathname: string): boolean {
    const skipPatterns = [
      '/api/accounts/user', // User-specific data
      '/api/accounts/logout', // State-changing operations
      '/health', // Health checks should be real-time
    ];

    return skipPatterns.some(pattern => pathname.includes(pattern));
  }

  private shouldCacheResponse(response: Response): boolean {
    const contentType = response.headers.get('content-type');
    
    // Cache JSON and text responses
    if (contentType?.includes('application/json') || contentType?.includes('text/')) {
      return true;
    }

    return false;
  }
}

/**
 * Cache decorator for functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  options: CacheOptions & {
    keyGenerator?: (...args: Parameters<T>) => string;
    cacheManager: CacheManager;
  }
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const key = options.keyGenerator 
        ? options.keyGenerator(...args)
        : `${propertyKey}:${JSON.stringify(args)}`;

      // Try cache first
      const cached = await options.cacheManager.get<ReturnType<T>>(key, options);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Cache result
      await options.cacheManager.set(key, result, options);

      return result;
    };

    return descriptor;
  };
}