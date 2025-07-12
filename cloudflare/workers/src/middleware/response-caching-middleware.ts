// Response Caching Middleware - Performance Optimization Issue #69
// Advanced response caching with intelligent cache control and optimization

import { CacheService } from '../types/cache';
import { Context, Next } from 'hono';

export interface ResponseCachingOptions {
  defaultTTL?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  cacheHeaders?: boolean;
  varyHeaders?: string[];
  enableMetrics?: boolean;
  skipPaths?: string[];
  onlyPaths?: string[];
}

export interface CachedResponse {
  data: any;
  headers: Record<string, string>;
  status: number;
  timestamp: number;
  ttl: number;
  etag?: string;
  lastModified?: string;
}

export class ResponseCachingMiddleware {
  private readonly options: Required<ResponseCachingOptions>;
  private responseStats = {
    hits: 0,
    misses: 0,
    bypassed: 0,
    errors: 0
  };

  constructor(
    private cacheService: CacheService,
    options: ResponseCachingOptions = {}
  ) {
    this.options = {
      defaultTTL: 300, // 5 minutes
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      cacheHeaders: true,
      varyHeaders: ['Accept-Encoding', 'Authorization'],
      enableMetrics: true,
      skipPaths: ['/health', '/metrics'],
      onlyPaths: [],
      ...options
    };
  }

  // Main middleware function
  middleware() {
    return async (c: Context, next: Next) => {
      const request = c.req;
      const startTime = Date.now();

      try {
        // Check if we should cache this request
        if (!this.shouldCacheRequest(request)) {
          this.responseStats.bypassed++;
          await next();
          return;
        }

        // Generate cache key
        const cacheKey = this.generateResponseCacheKey(request);

        // Try to get cached response
        const cachedResponse = await this.getCachedResponse(cacheKey);
        if (cachedResponse) {
          this.responseStats.hits++;
          
          // Set response from cache
          this.setResponseFromCache(c, cachedResponse);
          
          if (this.options.enableMetrics) {
            await this.recordMetrics('cache_hit', Date.now() - startTime, cacheKey);
          }
          
          return;
        }

        // Cache miss - execute the request
        this.responseStats.misses++;
        await next();

        // Cache the response if appropriate
        const response = c.res;
        if (this.shouldCacheResponse(request, response)) {
          await this.cacheResponse(cacheKey, request, response);
        }

        if (this.options.enableMetrics) {
          await this.recordMetrics('cache_miss', Date.now() - startTime, cacheKey);
        }

      } catch (error) {
        this.responseStats.errors++;
        console.error('Response caching middleware error:', error);
        
        // Continue with the request even if caching fails
        if (!c.res.headers.get('content-type')) {
          await next();
        }
      }
    };
  }

  // File-specific caching middleware
  fileResponseMiddleware() {
    return async (c: Context, next: Next) => {
      const request = c.req;
      const url = new URL(request.url);
      
      // Only apply to file endpoints
      if (!url.pathname.includes('/files/')) {
        await next();
        return;
      }

      const startTime = Date.now();
      const fileId = this.extractFileId(url.pathname);
      
      if (!fileId) {
        await next();
        return;
      }

      try {
        // Check for cached file data
        const cachedFile = await this.cacheService.getCachedFile(fileId);
        if (cachedFile) {
          this.responseStats.hits++;
          
          // Create response from cached file
          const response = new Response(cachedFile, {
            headers: {
              'Content-Type': this.determineContentType(request, fileId),
              'Cache-Control': 'public, max-age=3600',
              'X-Cache': 'HIT',
              'ETag': this.generateETag(cachedFile),
              'Last-Modified': new Date().toUTCString()
            }
          });

          // Set the cached response
          c.res = response;
          
          if (this.options.enableMetrics) {
            await this.recordMetrics('file_cache_hit', Date.now() - startTime, fileId);
          }
          
          return;
        }

        // Cache miss - execute request
        this.responseStats.misses++;
        await next();

        // Cache the file response
        const response = c.res;
        if (response.ok && response.body) {
          const responseClone = response.clone();
          const arrayBuffer = await responseClone.arrayBuffer();
          
          // Cache with appropriate TTL based on file type
          const ttl = this.getFileCacheTTL(fileId, arrayBuffer.byteLength);
          await this.cacheService.cacheFile(fileId, arrayBuffer, ttl);
        }

        if (this.options.enableMetrics) {
          await this.recordMetrics('file_cache_miss', Date.now() - startTime, fileId);
        }

      } catch (error) {
        this.responseStats.errors++;
        console.error('File response caching error:', error);
        await next();
      }
    };
  }

  // API response caching middleware
  apiResponseMiddleware() {
    return async (c: Context, next: Next) => {
      const request = c.req;
      const url = new URL(request.url);
      
      // Only apply to API endpoints
      if (!url.pathname.startsWith('/api/')) {
        await next();
        return;
      }

      const startTime = Date.now();
      const cacheKey = this.generateAPICacheKey(request);

      try {
        // Check for cached API response
        const cachedQuery = await this.cacheService.getCachedQuery(cacheKey);
        if (cachedQuery) {
          this.responseStats.hits++;
          
          const response = new Response(JSON.stringify(cachedQuery.data), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': `public, max-age=${cachedQuery.ttl}`,
              'X-Cache': 'HIT',
              'ETag': this.generateETag(JSON.stringify(cachedQuery.data)),
              ...cachedQuery.headers
            }
          });

          c.res = response;
          
          if (this.options.enableMetrics) {
            await this.recordMetrics('api_cache_hit', Date.now() - startTime, cacheKey);
          }
          
          return;
        }

        // Cache miss - execute request
        this.responseStats.misses++;
        await next();

        // Cache API response
        const response = c.res;
        if (this.shouldCacheAPIResponse(request, response)) {
          await this.cacheAPIResponse(cacheKey, request, response);
        }

        if (this.options.enableMetrics) {
          await this.recordMetrics('api_cache_miss', Date.now() - startTime, cacheKey);
        }

      } catch (error) {
        this.responseStats.errors++;
        console.error('API response caching error:', error);
        await next();
      }
    };
  }

  private shouldCacheRequest(request: Request): boolean {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // Only cache GET and HEAD requests
    if (!['GET', 'HEAD'].includes(method)) {
      return false;
    }

    // Check skip paths
    if (this.options.skipPaths.some(skipPath => path.includes(skipPath))) {
      return false;
    }

    // Check only paths (if specified)
    if (this.options.onlyPaths.length > 0) {
      return this.options.onlyPaths.some(onlyPath => path.includes(onlyPath));
    }

    // Don't cache requests with certain headers
    if (request.headers.get('Cache-Control')?.includes('no-cache')) {
      return false;
    }

    return true;
  }

  private shouldCacheResponse(request: Request, response: Response): boolean {
    // Don't cache error responses
    if (!response.ok) {
      return false;
    }

    // Don't cache responses with Set-Cookie
    if (response.headers.has('Set-Cookie')) {
      return false;
    }

    // Check response cache control
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl && (
      cacheControl.includes('no-cache') || 
      cacheControl.includes('no-store') || 
      cacheControl.includes('private')
    )) {
      return false;
    }

    return true;
  }

  private generateResponseCacheKey(request: Request): string {
    const url = new URL(request.url);
    const varyValues = this.options.varyHeaders.map(header => 
      request.headers.get(header) || ''
    ).join('|');

    const keyComponents = [
      request.method,
      url.pathname,
      url.search,
      varyValues
    ].filter(Boolean);

    return `response:${keyComponents.join(':')}`.replace(/[^a-zA-Z0-9:\-_]/g, '_');
  }

  private generateAPICacheKey(request: Request): string {
    const url = new URL(request.url);
    const auth = request.headers.get('Authorization')?.substring(0, 20) || '';
    
    return `api:${url.pathname}:${url.search}:${auth}`.replace(/[^a-zA-Z0-9:\-_]/g, '_');
  }

  private async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
    try {
      const cached = await this.cacheService.getCachedMetadata(cacheKey);
      
      if (cached && this.isCachedResponseValid(cached)) {
        return cached as CachedResponse;
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving cached response:', error);
      return null;
    }
  }

  private async cacheResponse(cacheKey: string, request: Request, response: Response): Promise<void> {
    try {
      const responseClone = response.clone();
      const data = await responseClone.text();
      const ttl = this.calculateResponseTTL(request, response);

      const cachedResponse: CachedResponse = {
        data,
        headers: this.extractCacheableHeaders(response),
        status: response.status,
        timestamp: Date.now(),
        ttl: ttl * 1000,
        etag: this.generateETag(data),
        lastModified: new Date().toUTCString()
      };

      await this.cacheService.cacheMetadata(cacheKey, cachedResponse, ttl);
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }

  private async cacheAPIResponse(cacheKey: string, request: Request, response: Response): Promise<void> {
    try {
      const responseClone = response.clone();
      const data = await responseClone.json();
      const ttl = this.calculateAPIResponseTTL(request, response);

      const cacheData = {
        data,
        headers: this.extractCacheableHeaders(response),
        ttl
      };

      await this.cacheService.cacheQuery(cacheKey, cacheData, ttl);
    } catch (error) {
      console.error('Error caching API response:', error);
    }
  }

  private setResponseFromCache(c: Context, cachedResponse: CachedResponse): void {
    let body: string | ArrayBuffer = cachedResponse.data;
    
    // Handle different data types
    if (typeof cachedResponse.data === 'object' && !(cachedResponse.data instanceof ArrayBuffer)) {
      body = JSON.stringify(cachedResponse.data);
    }

    const headers = new Headers({
      ...cachedResponse.headers,
      'X-Cache': 'HIT',
      'X-Cache-Timestamp': cachedResponse.timestamp.toString(),
      'Age': Math.floor((Date.now() - cachedResponse.timestamp) / 1000).toString()
    });

    if (cachedResponse.etag) {
      headers.set('ETag', cachedResponse.etag);
    }

    if (cachedResponse.lastModified) {
      headers.set('Last-Modified', cachedResponse.lastModified);
    }

    c.res = new Response(body, {
      status: cachedResponse.status,
      headers
    });
  }

  private shouldCacheAPIResponse(request: Request, response: Response): boolean {
    return this.shouldCacheResponse(request, response) && 
           response.headers.get('Content-Type')?.includes('application/json');
  }

  private calculateResponseTTL(request: Request, response: Response): number {
    // Check response Cache-Control header
    const cacheControl = response.headers.get('Cache-Control');
    if (cacheControl) {
      const maxAge = cacheControl.match(/max-age=(\d+)/);
      if (maxAge) {
        return parseInt(maxAge[1]);
      }
    }

    // Default TTL based on content type
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      return 300; // 5 minutes for JSON
    } else if (contentType.includes('text/html')) {
      return 180; // 3 minutes for HTML
    } else if (contentType.includes('image/') || contentType.includes('video/')) {
      return 3600; // 1 hour for media
    }

    return this.options.defaultTTL;
  }

  private calculateAPIResponseTTL(request: Request, response: Response): number {
    const url = new URL(request.url);
    
    // Different TTLs for different API endpoints
    if (url.pathname.includes('/metrics/')) {
      return 60; // 1 minute for metrics
    } else if (url.pathname.includes('/files/')) {
      return 600; // 10 minutes for file metadata
    } else if (url.pathname.includes('/dashboard/')) {
      return 300; // 5 minutes for dashboard data
    }

    return this.options.defaultTTL;
  }

  private getFileCacheTTL(fileId: string, size: number): number {
    // Longer TTL for larger files (assuming they change less frequently)
    if (size > 10 * 1024 * 1024) { // > 10MB
      return 3600; // 1 hour
    } else if (size > 1024 * 1024) { // > 1MB
      return 1800; // 30 minutes
    } else {
      return 600; // 10 minutes
    }
  }

  private extractFileId(pathname: string): string | null {
    const match = pathname.match(/\/files\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private determineContentType(request: Request, fileId: string): string {
    // Try to determine from file extension or request headers
    const accept = request.headers.get('Accept');
    
    if (fileId.endsWith('.json')) return 'application/json';
    if (fileId.endsWith('.csv')) return 'text/csv';
    if (fileId.endsWith('.txt')) return 'text/plain';
    if (fileId.endsWith('.pdf')) return 'application/pdf';
    
    if (accept?.includes('application/json')) return 'application/json';
    
    return 'application/octet-stream';
  }

  private generateETag(data: string | ArrayBuffer): string {
    // Simple hash-based ETag generation
    let hash = 0;
    const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `"${Math.abs(hash).toString(16)}"`;
  }

  private extractCacheableHeaders(response: Response): Record<string, string> {
    const cacheableHeaders: Record<string, string> = {};
    const headersToCache = [
      'Content-Type',
      'Content-Length',
      'Content-Encoding',
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

  private isCachedResponseValid(cached: CachedResponse): boolean {
    return Date.now() - cached.timestamp < cached.ttl;
  }

  private async recordMetrics(event: string, duration: number, key: string): Promise<void> {
    try {
      // This would integrate with your metrics service
      console.log(`Cache event: ${event}, duration: ${duration}ms, key: ${key.substring(0, 50)}`);
    } catch (error) {
      console.error('Failed to record cache metrics:', error);
    }
  }

  // Public methods for monitoring
  getStats(): typeof this.responseStats {
    return { ...this.responseStats };
  }

  resetStats(): void {
    this.responseStats = { hits: 0, misses: 0, bypassed: 0, errors: 0 };
  }

  getHitRate(): number {
    const total = this.responseStats.hits + this.responseStats.misses;
    return total > 0 ? this.responseStats.hits / total : 0;
  }
}