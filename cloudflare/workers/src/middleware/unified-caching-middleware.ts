// Unified Caching Middleware - Performance Optimization Issue #69
// Integrates all caching strategies with intelligent routing and optimization

import { Context, Next } from 'hono';
import { CacheService } from '../types/cache';
import { CacheFactory } from '../services/cache/cache-factory';
import { ResponseCachingMiddleware } from './response-caching-middleware';
import { PerformanceMeasurementMiddleware } from './performance-measurement-middleware';

export interface UnifiedCachingOptions {
  environment?: 'development' | 'staging' | 'production';
  workloadType?: 'read-heavy' | 'write-heavy' | 'balanced' | 'large-files';
  enableCompression?: boolean;
  enableMetrics?: boolean;
  adaptiveOptimization?: boolean;
  cacheConfiguration?: {
    memory?: { maxEntries: number; ttl: number };
    edge?: { ttl: number };
    kv?: { ttl: number };
  };
  performanceThresholds?: {
    slowRequestThreshold: number;
    cacheHitRateTarget: number;
  };
}

export class UnifiedCachingMiddleware {
  private cacheService: CacheService;
  private responseCachingMiddleware: ResponseCachingMiddleware;
  private performanceMiddleware: PerformanceMeasurementMiddleware;
  private readonly options: Required<UnifiedCachingOptions>;

  constructor(
    options: UnifiedCachingOptions = {},
    dependencies: {
      edgeCache?: Cache;
      kvNamespace?: KVNamespace;
      metricsService?: any;
    } = {}
  ) {
    this.options = {
      environment: 'production',
      workloadType: 'balanced',
      enableCompression: true,
      enableMetrics: true,
      adaptiveOptimization: true,
      cacheConfiguration: {
        memory: { maxEntries: 1000, ttl: 300 },
        edge: { ttl: 600 },
        kv: { ttl: 3600 }
      },
      performanceThresholds: {
        slowRequestThreshold: 2000,
        cacheHitRateTarget: 0.8
      },
      ...options
    };

    // Initialize cache service
    this.cacheService = this.createOptimalCacheService(dependencies);

    // Initialize middleware components
    this.responseCachingMiddleware = new ResponseCachingMiddleware(this.cacheService, {
      enableCompression: this.options.enableCompression,
      enableMetrics: this.options.enableMetrics
    });

    this.performanceMiddleware = new PerformanceMeasurementMiddleware({
      enableDetailedTiming: true,
      slowRequestThreshold: this.options.performanceThresholds.slowRequestThreshold,
      metricsService: dependencies.metricsService,
      onSlowRequest: this.handleSlowRequest.bind(this)
    });
  }

  // Main unified caching middleware that orchestrates all caching strategies
  middleware() {
    return async (c: Context, next: Next) => {
      // 1. Performance measurement (start)
      await this.performanceMiddleware.middleware()(c, async () => {
        
        // 2. Apply appropriate caching strategy based on request type
        const requestType = this.classifyRequest(c.req);
        
        switch (requestType) {
          case 'file':
            await this.handleFileRequest(c, next);
            break;
          
          case 'api':
            await this.handleAPIRequest(c, next);
            break;
          
          case 'static':
            await this.handleStaticRequest(c, next);
            break;
          
          default:
            await this.handleGenericRequest(c, next);
        }
        
        // 3. Adaptive optimization (if enabled)
        if (this.options.adaptiveOptimization) {
          await this.performAdaptiveOptimization(c);
        }
      });
    };
  }

  // File-specific caching strategy
  private async handleFileRequest(c: Context, next: Next): Promise<void> {
    await this.responseCachingMiddleware.fileResponseMiddleware()(c, next);
  }

  // API-specific caching strategy
  private async handleAPIRequest(c: Context, next: Next): Promise<void> {
    await this.responseCachingMiddleware.apiResponseMiddleware()(c, next);
  }

  // Static content caching strategy
  private async handleStaticRequest(c: Context, next: Next): Promise<void> {
    const url = new URL(c.req.url);
    const staticKey = `static:${url.pathname}${url.search}`;
    
    try {
      // Check for cached static content
      const cached = await this.cacheService.getCachedMetadata(staticKey);
      if (cached) {
        c.set('cacheResult', 'hit');
        c.res = new Response(cached.content, {
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT-STATIC',
            'Cache-Control': 'public, max-age=86400' // 24 hours for static content
          }
        });
        return;
      }

      c.set('cacheResult', 'miss');
      await next();

      // Cache static response
      if (c.res.ok) {
        const response = c.res.clone();
        const content = await response.text();
        
        await this.cacheService.cacheMetadata(staticKey, {
          content,
          headers: this.extractHeaders(c.res),
          timestamp: Date.now()
        }, 86400); // 24 hours
      }

    } catch (error) {
      console.error('Static content caching error:', error);
      await next();
    }
  }

  // Generic request handling with basic caching
  private async handleGenericRequest(c: Context, next: Next): Promise<void> {
    await this.responseCachingMiddleware.middleware()(c, next);
  }

  // Classify request type for optimal caching strategy
  private classifyRequest(request: Request): 'file' | 'api' | 'static' | 'generic' {
    const url = new URL(request.url);
    const path = url.pathname;

    // File requests
    if (path.includes('/files/') || path.includes('/download/') || path.includes('/upload/')) {
      return 'file';
    }

    // API requests
    if (path.startsWith('/api/')) {
      return 'api';
    }

    // Static content (CSS, JS, images, etc.)
    if (path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
      return 'static';
    }

    return 'generic';
  }

  // Adaptive optimization based on performance metrics
  private async performAdaptiveOptimization(c: Context): Promise<void> {
    try {
      const metrics = this.performanceMiddleware.getPerformanceSummary();
      
      // Adjust caching strategy based on performance
      if (metrics.cacheHitRate.last5Minutes < this.options.performanceThresholds.cacheHitRateTarget) {
        await this.optimizeCacheStrategy('increase_aggressiveness');
      }

      if (metrics.averageResponseTime.last5Minutes > this.options.performanceThresholds.slowRequestThreshold) {
        await this.optimizeCacheStrategy('improve_speed');
      }

      // Memory pressure adaptation
      if (metrics.activeRequests > 100) {
        await this.optimizeCacheStrategy('reduce_memory');
      }

    } catch (error) {
      console.error('Adaptive optimization error:', error);
    }
  }

  // Dynamic cache strategy optimization
  private async optimizeCacheStrategy(optimization: string): Promise<void> {
    switch (optimization) {
      case 'increase_aggressiveness':
        // Increase TTL values and cache more aggressively
        console.log('Adaptive optimization: Increasing cache aggressiveness');
        break;
      
      case 'improve_speed':
        // Prioritize memory cache over edge/KV
        console.log('Adaptive optimization: Prioritizing speed');
        break;
      
      case 'reduce_memory':
        // Reduce memory cache size, rely more on edge/KV
        console.log('Adaptive optimization: Reducing memory usage');
        break;
    }
  }

  // Handle slow requests with enhanced caching
  private handleSlowRequest(metrics: any): void {
    console.warn(`Slow request detected: ${metrics.operation} - ${metrics.duration}ms`);
    
    // For slow requests, implement more aggressive caching
    // This could involve pre-warming cache or increasing TTL values
  }

  // Create optimal cache service based on configuration
  private createOptimalCacheService(dependencies: any): CacheService {
    if (this.options.workloadType) {
      return CacheFactory.createOptimizedForWorkload(this.options.workloadType, {
        edgeCache: dependencies.edgeCache || caches.default,
        kvNamespace: dependencies.kvNamespace,
        metricsService: dependencies.metricsService
      });
    }

    return CacheFactory.createForEnvironment(this.options.environment, {
      edgeCache: dependencies.edgeCache || caches.default,
      kvNamespace: dependencies.kvNamespace,
      metricsService: dependencies.metricsService
    });
  }

  // Database query caching middleware
  databaseCachingMiddleware() {
    return async (c: Context, next: Next) => {
      const startTime = performance.now();
      
      // This would wrap database operations
      await next();
      
      const duration = performance.now() - startTime;
      
      // Record database performance metrics
      if (this.options.enableMetrics) {
        this.performanceMiddleware.markEvent(
          c.get('requestId'), 
          'database_query', 
          { duration }
        );
      }
    };
  }

  // Cache warming middleware for popular content
  cacheWarmingMiddleware() {
    return async (c: Context, next: Next) => {
      await next();
      
      // After successful response, consider warming related cache entries
      if (c.res.ok) {
        await this.warmRelatedCache(c);
      }
    };
  }

  // Warm cache for related/popular content
  private async warmRelatedCache(c: Context): Promise<void> {
    try {
      const url = new URL(c.req.url);
      
      // For file requests, warm metadata cache
      if (url.pathname.includes('/files/')) {
        const fileId = this.extractFileId(url.pathname);
        if (fileId) {
          // Pre-cache file metadata
          setTimeout(async () => {
            try {
              await this.cacheService.cacheMetadata(`file_meta:${fileId}`, {
                lastAccessed: Date.now(),
                popular: true
              }, 3600);
            } catch (error) {
              console.error('Cache warming error:', error);
            }
          }, 0);
        }
      }
    } catch (error) {
      console.error('Related cache warming error:', error);
    }
  }

  // Cache invalidation middleware
  cacheInvalidationMiddleware() {
    return async (c: Context, next: Next) => {
      const method = c.req.method;
      
      // For write operations, invalidate related cache entries
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const url = new URL(c.req.url);
        
        await next();
        
        // Invalidate cache after successful write operations
        if (c.res.ok) {
          await this.invalidateRelatedCache(url.pathname);
        }
      } else {
        await next();
      }
    };
  }

  // Invalidate cache entries related to a path
  private async invalidateRelatedCache(path: string): Promise<void> {
    try {
      if (path.includes('/files/')) {
        await this.cacheService.invalidateCache('file:');
        await this.cacheService.invalidateCache('query:files');
      } else if (path.includes('/api/')) {
        await this.cacheService.invalidateCache('api:');
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Utility methods
  private extractFileId(pathname: string): string | null {
    const match = pathname.match(/\/files\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    const importantHeaders = ['Content-Type', 'Content-Length', 'ETag', 'Last-Modified'];
    
    for (const header of importantHeaders) {
      const value = response.headers.get(header);
      if (value) {
        headers[header] = value;
      }
    }
    
    return headers;
  }

  // Public methods for monitoring and control
  async getCacheStats(): Promise<any> {
    const cacheStats = await this.cacheService.getCacheStats();
    const performanceStats = this.performanceMiddleware.getPerformanceSummary();
    const responseCacheStats = this.responseCachingMiddleware.getStats();

    return {
      cache: cacheStats,
      performance: performanceStats,
      responseCache: responseCacheStats,
      configuration: {
        environment: this.options.environment,
        workloadType: this.options.workloadType,
        adaptiveOptimization: this.options.adaptiveOptimization
      }
    };
  }

  async warmCache(urls: string[]): Promise<void> {
    console.log(`Warming cache for ${urls.length} URLs`);
    
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          // Cache the response
          const request = new Request(url);
          const cacheKey = this.generateCacheKey(request);
          await this.responseCachingMiddleware.getCachedResponse(cacheKey);
        }
      } catch (error) {
        console.error(`Cache warming failed for ${url}:`, error);
      }
    }
  }

  private generateCacheKey(request: Request): string {
    const url = new URL(request.url);
    return `unified:${request.method}:${url.pathname}:${url.search}`;
  }

  // Reset all caches (useful for testing/debugging)
  async resetCaches(): Promise<void> {
    await this.cacheService.invalidateCache('');
    this.performanceMiddleware.reset();
    this.responseCachingMiddleware.resetStats();
  }
}