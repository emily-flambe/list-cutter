// Smart Caching Middleware - Performance Optimization Issue #69
// Implements intelligent request/response caching with automatic cache management

import { CacheService, RequestHandler } from '../types/cache';
import { EnhancedMetricsService } from '../services/monitoring/enhanced-metrics-service';

export class CachingMiddleware {
  constructor(
    private cacheService: CacheService,
    private metricsService: EnhancedMetricsService
  ) {}
  
  createCachingHandler(handler: RequestHandler): RequestHandler {
    return async (request: Request): Promise<Response> => {
      const cacheKey = this.generateCacheKey(request);
      const startTime = Date.now();
      
      try {
        // 1. Check cache for response
        const cachedResponse = await this.getCachedResponse(cacheKey, request);
        if (cachedResponse) {
          // Record cache hit
          await this.recordCacheMetrics(cacheKey, Date.now() - startTime, true);
          return cachedResponse;
        }
        
        // 2. Execute request handler
        const response = await handler(request);
        
        // 3. Cache response if appropriate
        if (this.shouldCacheResponse(request, response)) {
          await this.cacheResponse(cacheKey, response, request);
        }
        
        // 4. Record cache miss
        await this.recordCacheMetrics(cacheKey, Date.now() - startTime, false);
        
        return response;
        
      } catch (error) {
        console.error('Caching middleware error:', error);
        
        // Still try to execute the handler even if caching fails
        try {
          const response = await handler(request);
          await this.recordCacheMetrics(cacheKey, Date.now() - startTime, false, true);
          return response;
        } catch (handlerError) {
          console.error('Handler execution failed:', handlerError);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
    };
  }
  
  private generateCacheKey(request: Request): string {
    const url = new URL(request.url);
    const method = request.method;
    const headers = request.headers;
    
    // Create cache key based on URL, method, and relevant headers
    const keyComponents = [
      method,
      url.hostname,
      url.pathname,
      url.search,
      headers.get('Authorization')?.substring(0, 20), // Partial auth for user-specific caching
      headers.get('Accept-Encoding'),
      headers.get('Content-Type')
    ].filter(Boolean); // Remove null/undefined values
    
    const cacheKey = keyComponents.join(':')
      .replace(/[^a-zA-Z0-9:\-_]/g, '_') // Sanitize key
      .substring(0, 512); // Limit key length for performance
    
    return `request:${cacheKey}`;
  }
  
  private shouldCacheResponse(request: Request, response: Response): boolean {
    // Don't cache errors
    if (response.status >= 400) {
      return false;
    }
    
    // Don't cache POST/PUT/DELETE/PATCH requests
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return false;
    }
    
    // Don't cache responses with Set-Cookie
    if (response.headers.has('Set-Cookie')) {
      return false;
    }
    
    // Don't cache responses that explicitly forbid caching
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl && (
      cacheControl.includes('no-cache') || 
      cacheControl.includes('no-store') || 
      cacheControl.includes('private')
    )) {
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
      'application/pdf',
      'application/octet-stream'
    ];
    
    const isCachableType = cachableTypes.some(type => contentType.includes(type));
    
    // Cache specific API endpoints
    const url = new URL(request.url);
    const cachableEndpoints = [
      '/api/files/',
      '/api/metrics/',
      '/api/dashboard/',
      '/api/quota/',
      '/api/security/config'
    ];
    
    const isCachableEndpoint = cachableEndpoints.some(endpoint => 
      url.pathname.startsWith(endpoint)
    );
    
    return isCachableType || isCachableEndpoint;
  }
  
  private async getCachedResponse(cacheKey: string, request: Request): Promise<Response | null> {
    try {
      // For file requests, use file cache
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/files/')) {
        const fileKey = this.extractFileKeyFromUrl(url);
        if (fileKey) {
          const cachedFile = await this.cacheService.getCachedFile(fileKey);
          if (cachedFile) {
            return new Response(cachedFile, {
              headers: {
                'Content-Type': 'application/octet-stream',
                'X-Cache': 'HIT-FILE',
                'Cache-Control': 'public, max-age=3600'
              }
            });
          }
        }
      }
      
      // For API responses, use query cache
      const cachedQuery = await this.cacheService.getCachedQuery(cacheKey);
      if (cachedQuery) {
        return new Response(JSON.stringify(cachedQuery.data), {
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT-QUERY',
            'Cache-Control': `public, max-age=${cachedQuery.ttl || 300}`,
            ...cachedQuery.headers
          }
        });
      }
      
      return null;
    } catch (error) {
      console.error('Cache retrieval error:', error);
      return null;
    }
  }
  
  private async cacheResponse(cacheKey: string, response: Response, request: Request): Promise<void> {
    try {
      const ttl = this.calculateTTL(response, request);
      const url = new URL(request.url);
      
      // For file responses, cache as file
      if (url.pathname.startsWith('/api/files/') && response.headers.get('Content-Type')?.includes('octet-stream')) {
        const fileKey = this.extractFileKeyFromUrl(url);
        if (fileKey) {
          const responseClone = response.clone();
          const content = await responseClone.arrayBuffer();
          await this.cacheService.cacheFile(fileKey, content, ttl);
          return;
        }
      }
      
      // For API responses, cache as query
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const responseClone = response.clone();
        const data = await responseClone.json();
        
        const cacheData = {
          data,
          ttl,
          headers: this.extractCacheableHeaders(response)
        };
        
        await this.cacheService.cacheQuery(cacheKey, cacheData, ttl);
        return;
      }
      
      // For other content types, cache as metadata
      const responseClone = response.clone();
      const content = await responseClone.text();
      
      const cacheData = {
        content,
        contentType: response.headers.get('Content-Type'),
        status: response.status,
        headers: this.extractCacheableHeaders(response)
      };
      
      await this.cacheService.cacheMetadata(cacheKey, cacheData, ttl);
      
    } catch (error) {
      console.error('Cache storage error:', error);
      // Don't throw - caching failures shouldn't break the response
    }
  }
  
  private calculateTTL(response: Response, request: Request): number {
    // Check Cache-Control header first
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl) {
      const maxAge = cacheControl.match(/max-age=(\d+)/);
      if (maxAge) {
        return parseInt(maxAge[1]);
      }
    }
    
    // Default TTL based on content type and endpoint
    const contentType = response.headers.get('Content-Type') || '';
    const url = new URL(request.url);
    
    // Static assets - long cache
    if (contentType.includes('image/') || 
        contentType.includes('video/') || 
        contentType.includes('audio/') ||
        contentType.includes('text/css') ||
        contentType.includes('application/javascript')) {
      return 3600; // 1 hour
    }
    
    // API endpoints - based on endpoint type
    if (url.pathname.startsWith('/api/files/')) {
      return 1800; // 30 minutes for file metadata
    } else if (url.pathname.startsWith('/api/metrics/')) {
      return 300; // 5 minutes for metrics
    } else if (url.pathname.startsWith('/api/dashboard/')) {
      return 600; // 10 minutes for dashboard data
    } else if (url.pathname.startsWith('/api/quota/')) {
      return 900; // 15 minutes for quota info
    } else if (url.pathname.startsWith('/api/security/config')) {
      return 1800; // 30 minutes for security config
    }
    
    // JSON responses - medium cache
    if (contentType.includes('application/json')) {
      return 300; // 5 minutes
    }
    
    // HTML responses - short cache
    if (contentType.includes('text/html')) {
      return 180; // 3 minutes
    }
    
    // Default
    return 300; // 5 minutes
  }
  
  private extractFileKeyFromUrl(url: URL): string | null {
    const pathParts = url.pathname.split('/');
    const fileIndex = pathParts.indexOf('files');
    
    if (fileIndex >= 0 && pathParts.length > fileIndex + 1) {
      return pathParts[fileIndex + 1];
    }
    
    return null;
  }
  
  private extractCacheableHeaders(response: Response): Record<string, string> {
    const cacheableHeaders: Record<string, string> = {};
    const headersToCache = [
      'Content-Type',
      'Content-Length',
      'Last-Modified',
      'ETag',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers'
    ];
    
    for (const header of headersToCache) {
      const value = response.headers.get(header);
      if (value) {
        cacheableHeaders[header] = value;
      }
    }
    
    return cacheableHeaders;
  }
  
  private async recordCacheMetrics(
    cacheKey: string, 
    duration: number, 
    hit: boolean, 
    error: boolean = false
  ): Promise<void> {
    try {
      await this.metricsService.recordCacheMetrics({
        cacheKey,
        hit,
        miss: !hit,
        duration,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to record cache metrics:', error);
    }
  }
  
  // Utility method for cache warming
  async warmCache(urls: string[], method: string = 'GET'): Promise<void> {
    const warmupPromises = urls.map(async (url) => {
      try {
        const request = new Request(url, { method });
        const cacheKey = this.generateCacheKey(request);
        
        // Check if already cached
        const cached = await this.getCachedResponse(cacheKey, request);
        if (!cached) {
          console.log(`Cache warming: ${url}`);
          // This would typically involve making actual requests to warm the cache
          // Implementation depends on your specific warming strategy
        }
      } catch (error) {
        console.error(`Cache warming failed for ${url}:`, error);
      }
    });
    
    await Promise.all(warmupPromises);
  }
  
  // Utility method for cache invalidation
  async invalidatePattern(pattern: string): Promise<void> {
    await this.cacheService.invalidateCache(pattern);
  }
}