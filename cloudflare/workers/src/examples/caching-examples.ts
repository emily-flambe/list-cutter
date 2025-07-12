// Caching and Performance Examples - Performance Optimization Issue #69
// Demonstrates how to use the new caching and performance optimization features

import { CacheFactory, createOptimalCacheService, createCacheServiceWithMetrics } from '../services/cache';
import { UnifiedCachingMiddleware } from '../middleware/unified-caching-middleware';
import { ResponseCachingMiddleware } from '../middleware/response-caching-middleware';
import { PerformanceMeasurementMiddleware } from '../middleware/performance-measurement-middleware';
import { PerformanceOptimizer } from '../services/cache/performance-optimizer';
import { Hono } from 'hono';

// Example 1: Basic Cache Service Usage
export function basicCacheExample() {
  // Create a cache service optimized for production environment
  const cacheService = createOptimalCacheService('production', {
    edgeCache: caches.default,
    // kvNamespace: env.CACHE_KV, // If available
  });

  return {
    // Cache a file
    async cacheFile(fileId: string, content: ArrayBuffer) {
      await cacheService.cacheFile(fileId, content, 3600); // 1 hour TTL
    },

    // Retrieve cached file
    async getCachedFile(fileId: string) {
      return await cacheService.getCachedFile(fileId);
    },

    // Cache API response
    async cacheAPIResponse(endpoint: string, data: any) {
      await cacheService.cacheQuery(endpoint, data, 300); // 5 minutes TTL
    },

    // Get cache statistics
    async getStats() {
      return await cacheService.getCacheStats();
    }
  };
}

// Example 2: Advanced Cache Configuration
export function advancedCacheExample(env: any) {
  // Create cache service with metrics integration
  const cacheService = createCacheServiceWithMetrics(
    env.METRICS_SERVICE,
    'production',
    {
      edgeCache: caches.default,
      kvNamespace: env.CACHE_KV
    }
  );

  // Create cache optimized for specific workload
  const readHeavyCacheService = CacheFactory.createOptimizedForWorkload('read-heavy', {
    edgeCache: caches.default,
    kvNamespace: env.CACHE_KV,
    metricsService: env.METRICS_SERVICE
  });

  return { cacheService, readHeavyCacheService };
}

// Example 3: Hono App with Unified Caching Middleware
export function createCachedApp(env: any) {
  const app = new Hono();

  // Initialize unified caching middleware
  const cachingMiddleware = new UnifiedCachingMiddleware({
    environment: 'production',
    workloadType: 'balanced',
    enableCompression: true,
    enableMetrics: true,
    adaptiveOptimization: true
  }, {
    edgeCache: caches.default,
    kvNamespace: env.CACHE_KV,
    metricsService: env.METRICS_SERVICE
  });

  // Apply caching middleware to all routes
  app.use('*', cachingMiddleware.middleware());

  // File routes with optimized caching
  app.get('/api/files/:id', async (c) => {
    const fileId = c.req.param('id');
    
    // The middleware automatically handles caching
    const fileData = await getFileFromStorage(fileId);
    
    return c.json({
      fileId,
      size: fileData.byteLength,
      cached: c.get('cacheResult') === 'hit'
    });
  });

  // API routes with intelligent caching
  app.get('/api/dashboard/stats', async (c) => {
    // This will be automatically cached by the API middleware
    const stats = await getDashboardStats();
    
    return c.json(stats);
  });

  // Cache management endpoints
  app.get('/admin/cache/stats', async (c) => {
    const stats = await cachingMiddleware.getCacheStats();
    return c.json(stats);
  });

  app.post('/admin/cache/warm', async (c) => {
    const { urls } = await c.req.json();
    await cachingMiddleware.warmCache(urls);
    return c.json({ success: true, warmed: urls.length });
  });

  return app;
}

// Example 4: Performance Measurement Integration
export function performanceMeasurementExample() {
  const app = new Hono();

  // Initialize performance middleware
  const performanceMiddleware = new PerformanceMeasurementMiddleware({
    enableDetailedTiming: true,
    slowRequestThreshold: 2000, // 2 seconds
    sampleRate: 1.0, // Sample all requests
    onSlowRequest: (metrics) => {
      console.warn(`Slow request detected: ${metrics.operation} - ${metrics.duration}ms`);
    }
  });

  // Apply performance measurement
  app.use('*', performanceMiddleware.middleware());

  // Add custom performance marks in your handlers
  app.get('/api/complex-operation', async (c) => {
    const requestId = c.get('requestId');
    
    // Mark start of expensive operation
    performanceMiddleware.markEvent(requestId, 'expensive_operation_start');
    
    await performExpensiveOperation();
    
    // Mark end of expensive operation
    performanceMiddleware.markEvent(requestId, 'expensive_operation_end');
    
    return c.json({ result: 'completed' });
  });

  // Performance monitoring endpoints
  app.get('/admin/performance/summary', async (c) => {
    const summary = performanceMiddleware.getPerformanceSummary();
    return c.json(summary);
  });

  app.get('/admin/performance/slow-requests', async (c) => {
    const slowRequests = performanceMiddleware.getSlowRequests();
    return c.json(slowRequests);
  });

  return app;
}

// Example 5: Automatic Performance Optimization
export async function performanceOptimizationExample(cacheService: any) {
  const optimizer = new PerformanceOptimizer(cacheService);

  // Get optimization recommendations
  const recommendations = optimizer.getOptimizationRecommendations();
  console.log('Optimization recommendations:', recommendations);

  // Apply all optimizations
  const appliedOptimizations = await optimizer.applyAllOptimizations();
  console.log('Applied optimizations:', appliedOptimizations);

  // Measure optimization impact
  const impact = await optimizer.measureOptimizationImpact('intelligent_cache_warming');
  console.log('Optimization impact:', impact);

  // Get optimization status
  const status = optimizer.getOptimizationStatus();
  console.log('Optimization status:', status);

  return optimizer;
}

// Example 6: Custom Cache Strategy
export function customCacheStrategyExample() {
  // Create hybrid cache with custom configuration
  const cacheService = CacheFactory.create({
    type: 'hybrid',
    enableCompression: true,
    compressionThreshold: 512, // Compress files larger than 512 bytes
    maxMemoryEntries: 2000,
    environment: 'production'
  }, {
    edgeCache: caches.default,
    enableMetrics: true
  });

  return {
    // Cache with custom TTL based on content type
    async smartCache(key: string, data: any, contentType: string) {
      let ttl = 300; // Default 5 minutes
      
      if (contentType.includes('image/')) {
        ttl = 3600; // 1 hour for images
      } else if (contentType.includes('application/json')) {
        ttl = 180; // 3 minutes for JSON
      } else if (contentType.includes('text/csv')) {
        ttl = 1800; // 30 minutes for CSV files
      }

      if (data instanceof ArrayBuffer) {
        await cacheService.cacheFile(key, data, ttl);
      } else {
        await cacheService.cacheQuery(key, data, ttl);
      }
    },

    // Intelligent cache warming based on usage patterns
    async warmPopularContent() {
      const popularFiles = [
        'user_analytics_report.csv',
        'dashboard_overview.json',
        'system_metrics.json'
      ];

      for (const fileId of popularFiles) {
        try {
          const cached = await cacheService.getCachedFile(fileId);
          if (!cached) {
            // File not cached, warm it
            const fileData = await fetchFileFromStorage(fileId);
            await cacheService.cacheFile(fileId, fileData, 3600);
            console.log(`Warmed cache for ${fileId}`);
          }
        } catch (error) {
          console.error(`Failed to warm cache for ${fileId}:`, error);
        }
      }
    }
  };
}

// Example 7: Response Caching with Custom Rules
export function responseCachingExample(cacheService: any) {
  const responseCaching = new ResponseCachingMiddleware(cacheService, {
    defaultTTL: 300,
    enableCompression: true,
    compressionThreshold: 1024,
    onlyPaths: ['/api/', '/files/'], // Only cache these paths
    skipPaths: ['/api/auth/', '/api/upload/'] // Skip caching for these paths
  });

  const app = new Hono();

  // Apply response caching to specific routes
  app.use('/api/files/*', responseCaching.fileResponseMiddleware());
  app.use('/api/dashboard/*', responseCaching.apiResponseMiddleware());
  app.use('/static/*', responseCaching.middleware());

  return app;
}

// Utility functions (would be implemented elsewhere)
async function getFileFromStorage(fileId: string): Promise<ArrayBuffer> {
  // Mock implementation
  return new ArrayBuffer(1024);
}

async function getDashboardStats(): Promise<any> {
  // Mock implementation
  return { users: 100, files: 500, storage: '10GB' };
}

async function performExpensiveOperation(): Promise<void> {
  // Simulate expensive operation
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function fetchFileFromStorage(fileId: string): Promise<ArrayBuffer> {
  // Mock implementation
  return new ArrayBuffer(2048);
}

// Export usage examples
export const CachingExamples = {
  basicCacheExample,
  advancedCacheExample,
  createCachedApp,
  performanceMeasurementExample,
  performanceOptimizationExample,
  customCacheStrategyExample,
  responseCachingExample
};