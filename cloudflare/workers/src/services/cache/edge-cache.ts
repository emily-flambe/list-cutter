// Edge Cache Service - Performance Optimization Issue #69
// Utilizes Cloudflare's global edge cache for distributed caching

import { CacheService, CacheStats } from '../../types/cache';

export class EdgeCacheService implements CacheService {
  private cacheStats = {
    hits: 0,
    misses: 0,
    requests: 0
  };

  constructor(
    private edgeCache: Cache,
    private defaultTTL: number = 300 // 5 minutes
  ) {}

  async cacheFile(key: string, content: ArrayBuffer, ttl: number = this.defaultTTL): Promise<void> {
    const cacheKey = `file:${key}`;
    
    try {
      const response = new Response(content, {
        headers: {
          'Cache-Control': `public, max-age=${ttl}`,
          'Content-Type': 'application/octet-stream',
          'X-Cache-TTL': ttl.toString(),
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Type': 'file'
        }
      });
      
      await this.edgeCache.put(cacheKey, response);
      
    } catch (error) {
      console.error('Edge cache file storage failed:', error);
    }
  }

  async getCachedFile(key: string): Promise<ArrayBuffer | null> {
    const cacheKey = `file:${key}`;
    this.cacheStats.requests++;
    
    try {
      const cachedResponse = await this.edgeCache.match(cacheKey);
      
      if (cachedResponse) {
        // Check if cache is still valid
        const cacheTimestamp = cachedResponse.headers.get('X-Cache-Timestamp');
        const cacheTTL = cachedResponse.headers.get('X-Cache-TTL');
        
        if (cacheTimestamp && cacheTTL) {
          const age = Date.now() - parseInt(cacheTimestamp);
          const maxAge = parseInt(cacheTTL) * 1000;
          
          if (age < maxAge) {
            this.cacheStats.hits++;
            return await cachedResponse.arrayBuffer();
          }
        } else {
          // Fallback to browser cache headers
          const cacheControl = cachedResponse.headers.get('Cache-Control');
          if (cacheControl && cacheControl.includes('max-age')) {
            this.cacheStats.hits++;
            return await cachedResponse.arrayBuffer();
          }
        }
      }
      
      this.cacheStats.misses++;
      return null;
      
    } catch (error) {
      console.error('Edge cache file retrieval failed:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  async cacheQuery(key: string, result: any, ttl: number = this.defaultTTL): Promise<void> {
    const cacheKey = `query:${key}`;
    
    try {
      const serialized = JSON.stringify(result);
      const response = new Response(serialized, {
        headers: {
          'Cache-Control': `public, max-age=${ttl}`,
          'Content-Type': 'application/json',
          'X-Cache-TTL': ttl.toString(),
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Type': 'query'
        }
      });
      
      await this.edgeCache.put(cacheKey, response);
      
    } catch (error) {
      console.error('Edge cache query storage failed:', error);
    }
  }

  async getCachedQuery(key: string): Promise<any | null> {
    const cacheKey = `query:${key}`;
    this.cacheStats.requests++;
    
    try {
      const cachedResponse = await this.edgeCache.match(cacheKey);
      
      if (cachedResponse) {
        // Check if cache is still valid
        const cacheTimestamp = cachedResponse.headers.get('X-Cache-Timestamp');
        const cacheTTL = cachedResponse.headers.get('X-Cache-TTL');
        
        if (cacheTimestamp && cacheTTL) {
          const age = Date.now() - parseInt(cacheTimestamp);
          const maxAge = parseInt(cacheTTL) * 1000;
          
          if (age < maxAge) {
            this.cacheStats.hits++;
            const text = await cachedResponse.text();
            return JSON.parse(text);
          }
        } else {
          // Fallback to browser cache headers
          const cacheControl = cachedResponse.headers.get('Cache-Control');
          if (cacheControl && cacheControl.includes('max-age')) {
            this.cacheStats.hits++;
            const text = await cachedResponse.text();
            return JSON.parse(text);
          }
        }
      }
      
      this.cacheStats.misses++;
      return null;
      
    } catch (error) {
      console.error('Edge cache query retrieval failed:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  async cacheMetadata(key: string, metadata: any, ttl: number = this.defaultTTL): Promise<void> {
    const cacheKey = `metadata:${key}`;
    
    try {
      const serialized = JSON.stringify(metadata);
      const response = new Response(serialized, {
        headers: {
          'Cache-Control': `public, max-age=${ttl}`,
          'Content-Type': 'application/json',
          'X-Cache-TTL': ttl.toString(),
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Type': 'metadata'
        }
      });
      
      await this.edgeCache.put(cacheKey, response);
      
    } catch (error) {
      console.error('Edge cache metadata storage failed:', error);
    }
  }

  async getCachedMetadata(key: string): Promise<any | null> {
    const cacheKey = `metadata:${key}`;
    this.cacheStats.requests++;
    
    try {
      const cachedResponse = await this.edgeCache.match(cacheKey);
      
      if (cachedResponse) {
        // Check if cache is still valid
        const cacheTimestamp = cachedResponse.headers.get('X-Cache-Timestamp');
        const cacheTTL = cachedResponse.headers.get('X-Cache-TTL');
        
        if (cacheTimestamp && cacheTTL) {
          const age = Date.now() - parseInt(cacheTimestamp);
          const maxAge = parseInt(cacheTTL) * 1000;
          
          if (age < maxAge) {
            this.cacheStats.hits++;
            const text = await cachedResponse.text();
            return JSON.parse(text);
          }
        } else {
          // Fallback to browser cache headers
          const cacheControl = cachedResponse.headers.get('Cache-Control');
          if (cacheControl && cacheControl.includes('max-age')) {
            this.cacheStats.hits++;
            const text = await cachedResponse.text();
            return JSON.parse(text);
          }
        }
      }
      
      this.cacheStats.misses++;
      return null;
      
    } catch (error) {
      console.error('Edge cache metadata retrieval failed:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  async invalidateCache(keyPattern: string): Promise<void> {
    // Edge cache invalidation is limited - we can't enumerate keys
    // This is a limitation of the Cache API
    console.warn(`Edge cache invalidation for pattern "${keyPattern}" requested, but Cache API doesn't support key enumeration`);
    
    // In practice, you might need to:
    // 1. Keep track of cached keys in KV or memory
    // 2. Use Cloudflare's purge API for specific URLs
    // 3. Let items expire naturally
    
    // For now, we'll just log the request
    console.log(`Edge cache invalidation requested for pattern: ${keyPattern}`);
  }

  async getCacheStats(): Promise<CacheStats> {
    const hitRate = this.cacheStats.requests > 0 ? 
      this.cacheStats.hits / this.cacheStats.requests : 0;
    const missRate = this.cacheStats.requests > 0 ? 
      this.cacheStats.misses / this.cacheStats.requests : 0;

    return {
      memoryCache: {
        size: 0,
        hitRate: 0,
        missRate: 0,
        entries: 0
      },
      kvCache: {
        hitRate: 0,
        missRate: 0,
        totalRequests: 0
      },
      edgeCache: {
        hitRate,
        missRate,
        totalRequests: this.cacheStats.requests
      },
      overall: {
        hitRate,
        missRate,
        totalRequests: this.cacheStats.requests
      }
    };
  }

  // Edge-specific methods
  async warmCache(urls: string[]): Promise<void> {
    // Pre-populate edge cache with important resources
    const warmupPromises = urls.map(async (url) => {
      try {
        // In a real implementation, you'd fetch the actual content
        // and cache it using the appropriate cache method
        console.log(`Warming edge cache for: ${url}`);
        
        // This is a placeholder - actual implementation would vary
        // based on the type of content being warmed
        
      } catch (error) {
        console.error(`Edge cache warming failed for ${url}:`, error);
      }
    });
    
    await Promise.all(warmupPromises);
  }

  async getResponseForCaching(
    content: any, 
    contentType: string, 
    ttl: number,
    additionalHeaders: Record<string, string> = {}
  ): Promise<Response> {
    let body: string | ArrayBuffer;
    
    if (content instanceof ArrayBuffer) {
      body = content;
    } else {
      body = JSON.stringify(content);
    }
    
    return new Response(body, {
      headers: {
        'Cache-Control': `public, max-age=${ttl}`,
        'Content-Type': contentType,
        'X-Cache-TTL': ttl.toString(),
        'X-Cache-Timestamp': Date.now().toString(),
        ...additionalHeaders
      }
    });
  }

  // Utility method to check if a response is cacheable
  isResponseCacheable(response: Response): boolean {
    // Check status code
    if (response.status >= 400) {
      return false;
    }
    
    // Check cache control headers
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl && (
      cacheControl.includes('no-cache') || 
      cacheControl.includes('no-store') || 
      cacheControl.includes('private')
    )) {
      return false;
    }
    
    // Check for dynamic content indicators
    if (response.headers.has('Set-Cookie')) {
      return false;
    }
    
    return true;
  }

  // Get cache statistics with edge-specific metrics
  async getDetailedStats(): Promise<any> {
    const stats = await this.getCacheStats();
    
    return {
      ...stats,
      edgeSpecific: {
        globalDistribution: true,
        purgeCapability: false, // Cache API limitation
        compressionSupport: true,
        geoReplication: true
      }
    };
  }
}