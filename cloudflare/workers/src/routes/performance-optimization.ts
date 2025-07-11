// Performance Optimization Routes - Issue #69
// Integrates all performance optimization services for comprehensive optimization

import { Hono } from 'hono';
import { timing } from 'hono/timing';
import { MultiLayerCacheService } from '../services/cache-service';
import { CompressionService } from '../services/compression-service';
import { OptimizedDatabaseService } from '../services/optimized-database-service';
import { OptimizedPresignedUrlService } from '../services/optimized-presigned-url-service';
import { OptimizedR2Service } from '../services/storage/optimized-r2-service';
import { PerformanceMonitoringService } from '../services/performance-monitoring-service';
import { CachingMiddleware } from '../middleware/caching-middleware';
import { MetricsService } from '../services/monitoring/metrics-service';
import { EnhancedMetricsService } from '../services/monitoring/enhanced-metrics-service';
import { AlertManagementService } from '../services/monitoring/alert-management-service';
import { R2StorageService } from '../services/storage/r2-service';
import { SecurityAuditLogger } from '../services/security/audit-logger';
import { QuotaManager } from '../services/security/quota-manager';
import type { CloudflareEnv } from '../types/env';
import type { 
  PerformanceMetrics, 
  PerformanceReport, 
  OptimizationTarget,
  PresignedUrlOptions,
  BatchPresignedUrlOptions,
  OptimizedUploadOptions
} from '../types/cache';

type HonoContext = {
  Bindings: CloudflareEnv;
  Variables: {
    cacheService?: MultiLayerCacheService;
    compressionService?: CompressionService;
    optimizedDbService?: OptimizedDatabaseService;
    optimizedPresignedUrlService?: OptimizedPresignedUrlService;
    optimizedR2Service?: OptimizedR2Service;
    performanceMonitoringService?: PerformanceMonitoringService;
    cachingMiddleware?: CachingMiddleware;
  };
};

const app = new Hono<HonoContext>();

// Performance optimization middleware
app.use('*', timing());

// Initialize performance services
app.use('*', async (c, next) => {
  try {
    const env = c.env;
    
    // Only initialize if we have required bindings
    if (env.DB && env.FILE_STORAGE && env.ANALYTICS) {
      // Initialize core services
      const metricsService = new MetricsService(env.ANALYTICS, env.DB);
      const enhancedMetricsService = new EnhancedMetricsService(env.ANALYTICS, env.DB);
      const auditLogger = new SecurityAuditLogger(env.DB, env.ANALYTICS);
      const quotaManager = new QuotaManager(env.DB);
      
      // Initialize cache service
      const cacheService = new MultiLayerCacheService(
        caches.default, // Edge cache
        env.CACHE_KV, // KV cache
        1000 // Max memory entries
      );
      
      // Initialize compression service
      const compressionService = new CompressionService();
      
      // Initialize optimized database service
      const optimizedDbService = new OptimizedDatabaseService(
        env.DB,
        cacheService,
        enhancedMetricsService
      );
      
      // Initialize optimized pre-signed URL service
      const optimizedPresignedUrlService = new OptimizedPresignedUrlService(
        env.FILE_STORAGE,
        cacheService,
        env.DB,
        enhancedMetricsService
      );
      
      // Initialize optimized R2 service
      const optimizedR2Service = new OptimizedR2Service(
        env.FILE_STORAGE,
        env.DB,
        metricsService,
        compressionService,
        cacheService,
        quotaManager,
        auditLogger
      );
      
      // Initialize alert service
      const alertService = new AlertManagementService(env.DB, env.ANALYTICS);
      
      // Initialize performance monitoring service
      const performanceMonitoringService = new PerformanceMonitoringService(
        enhancedMetricsService,
        alertService,
        cacheService
      );
      
      // Initialize caching middleware
      const cachingMiddleware = new CachingMiddleware(
        cacheService,
        enhancedMetricsService
      );
      
      // Store services in context
      c.set('cacheService', cacheService);
      c.set('compressionService', compressionService);
      c.set('optimizedDbService', optimizedDbService);
      c.set('optimizedPresignedUrlService', optimizedPresignedUrlService);
      c.set('optimizedR2Service', optimizedR2Service);
      c.set('performanceMonitoringService', performanceMonitoringService);
      c.set('cachingMiddleware', cachingMiddleware);
    }
    
    await next();
  } catch (error) {
    console.error('Performance optimization initialization failed:', error);
    await next(); // Continue without optimization services
  }
});

// Performance dashboard endpoint
app.get('/dashboard', async (c) => {
  try {
    const performanceService = c.get('performanceMonitoringService');
    
    if (!performanceService) {
      return c.json({ error: 'Performance monitoring not available' }, 503);
    }
    
    const report = await performanceService.generatePerformanceReport();
    const targets = await performanceService.getOptimizationTargets();
    
    return c.json({
      success: true,
      data: {
        report,
        optimizationTargets: targets,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Performance dashboard error:', error);
    return c.json({
      error: 'Failed to generate performance dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Cache statistics endpoint
app.get('/cache/stats', async (c) => {
  try {
    const cacheService = c.get('cacheService');
    
    if (!cacheService) {
      return c.json({ error: 'Cache service not available' }, 503);
    }
    
    const stats = await cacheService.getCacheStats();
    
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return c.json({
      error: 'Failed to get cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Cache management endpoints
app.post('/cache/warm', async (c) => {
  try {
    const cacheService = c.get('cacheService');
    const optimizedPresignedUrlService = c.get('optimizedPresignedUrlService');
    
    if (!cacheService || !optimizedPresignedUrlService) {
      return c.json({ error: 'Cache services not available' }, 503);
    }
    
    const body = await c.req.json();
    const { fileKeys, operations } = body;
    
    if (!fileKeys || !Array.isArray(fileKeys)) {
      return c.json({ error: 'fileKeys array is required' }, 400);
    }
    
    // Warm URL cache
    await optimizedPresignedUrlService.warmUrlCache(fileKeys, operations);
    
    return c.json({
      success: true,
      message: `Cache warmed for ${fileKeys.length} files`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache warming error:', error);
    return c.json({
      error: 'Failed to warm cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/cache/clear', async (c) => {
  try {
    const cacheService = c.get('cacheService');
    
    if (!cacheService) {
      return c.json({ error: 'Cache service not available' }, 503);
    }
    
    const body = await c.req.json().catch(() => ({}));
    const { pattern } = body;
    
    if (pattern) {
      await cacheService.invalidateCache(pattern);
    } else {
      // Clear all caches
      await cacheService.invalidateCache('');
    }
    
    return c.json({
      success: true,
      message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All caches cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clearing error:', error);
    return c.json({
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Database optimization endpoints
app.get('/database/stats', async (c) => {
  try {
    const optimizedDbService = c.get('optimizedDbService');
    
    if (!optimizedDbService) {
      return c.json({ error: 'Optimized database service not available' }, 503);
    }
    
    const stats = optimizedDbService.getQueryStatistics();
    
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database stats error:', error);
    return c.json({
      error: 'Failed to get database statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/database/cache/clear', async (c) => {
  try {
    const optimizedDbService = c.get('optimizedDbService');
    
    if (!optimizedDbService) {
      return c.json({ error: 'Optimized database service not available' }, 503);
    }
    
    await optimizedDbService.clearCaches();
    
    return c.json({
      success: true,
      message: 'Database caches cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database cache clearing error:', error);
    return c.json({
      error: 'Failed to clear database caches',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Pre-signed URL optimization endpoints
app.post('/presigned-urls/generate', async (c) => {
  try {
    const optimizedPresignedUrlService = c.get('optimizedPresignedUrlService');
    
    if (!optimizedPresignedUrlService) {
      return c.json({ error: 'Optimized pre-signed URL service not available' }, 503);
    }
    
    const body = await c.req.json();
    const { fileKey, options } = body;
    
    if (!fileKey || !options) {
      return c.json({ error: 'fileKey and options are required' }, 400);
    }
    
    const result = await optimizedPresignedUrlService.generatePresignedUrl(fileKey, options);
    
    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pre-signed URL generation error:', error);
    return c.json({
      error: 'Failed to generate pre-signed URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/presigned-urls/batch', async (c) => {
  try {
    const optimizedPresignedUrlService = c.get('optimizedPresignedUrlService');
    
    if (!optimizedPresignedUrlService) {
      return c.json({ error: 'Optimized pre-signed URL service not available' }, 503);
    }
    
    const body = await c.req.json();
    const batchOptions = body as BatchPresignedUrlOptions;
    
    if (!batchOptions.operations || !Array.isArray(batchOptions.operations)) {
      return c.json({ error: 'operations array is required' }, 400);
    }
    
    const result = await optimizedPresignedUrlService.generateBatchPresignedUrls(batchOptions);
    
    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Batch pre-signed URL generation error:', error);
    return c.json({
      error: 'Failed to generate batch pre-signed URLs',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/presigned-urls/stats', async (c) => {
  try {
    const optimizedPresignedUrlService = c.get('optimizedPresignedUrlService');
    
    if (!optimizedPresignedUrlService) {
      return c.json({ error: 'Optimized pre-signed URL service not available' }, 503);
    }
    
    const stats = optimizedPresignedUrlService.getGenerationStats();
    
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pre-signed URL stats error:', error);
    return c.json({
      error: 'Failed to get pre-signed URL statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// File compression endpoints
app.post('/compression/analyze', async (c) => {
  try {
    const compressionService = c.get('compressionService');
    
    if (!compressionService) {
      return c.json({ error: 'Compression service not available' }, 503);
    }
    
    const body = await c.req.json();
    const { file, contentType } = body;
    
    if (!file) {
      return c.json({ error: 'file data is required' }, 400);
    }
    
    // Convert base64 to ArrayBuffer if needed
    const fileBuffer = typeof file === 'string' 
      ? Uint8Array.from(atob(file), c => c.charCodeAt(0)).buffer
      : file;
    
    const analysis = await compressionService.analyzeCompressibility(fileBuffer, contentType);
    
    return c.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Compression analysis error:', error);
    return c.json({
      error: 'Failed to analyze file compressibility',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/compression/algorithms', async (c) => {
  try {
    const compressionService = c.get('compressionService');
    
    if (!compressionService) {
      return c.json({ error: 'Compression service not available' }, 503);
    }
    
    const algorithms = compressionService.getSupportedAlgorithms();
    
    return c.json({
      success: true,
      data: { algorithms },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Compression algorithms error:', error);
    return c.json({
      error: 'Failed to get supported algorithms',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Optimized file upload endpoint
app.post('/upload/optimized', async (c) => {
  try {
    const optimizedR2Service = c.get('optimizedR2Service');
    
    if (!optimizedR2Service) {
      return c.json({ error: 'Optimized R2 service not available' }, 503);
    }
    
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const optionsStr = formData.get('options') as string;
    
    if (!file) {
      return c.json({ error: 'file is required' }, 400);
    }
    
    const options: OptimizedUploadOptions = optionsStr ? JSON.parse(optionsStr) : {};
    
    const result = await optimizedR2Service.uploadFileOptimized(file, options);
    
    return c.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Optimized upload error:', error);
    return c.json({
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Optimized file download endpoint
app.get('/download/:fileKey', async (c) => {
  try {
    const optimizedR2Service = c.get('optimizedR2Service');
    
    if (!optimizedR2Service) {
      return c.json({ error: 'Optimized R2 service not available' }, 503);
    }
    
    const fileKey = c.req.param('fileKey');
    const userId = c.req.header('X-User-ID'); // Optional user ID for access control
    
    const response = await optimizedR2Service.downloadFileOptimized(fileKey, userId);
    
    return response;
  } catch (error) {
    console.error('Optimized download error:', error);
    return c.json({
      error: 'Failed to download file',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Performance optimization triggers
app.post('/optimize/trigger', async (c) => {
  try {
    const performanceService = c.get('performanceMonitoringService');
    
    if (!performanceService) {
      return c.json({ error: 'Performance monitoring service not available' }, 503);
    }
    
    const targets = await performanceService.getOptimizationTargets();
    
    if (targets.length === 0) {
      return c.json({
        success: true,
        message: 'No optimization targets identified',
        timestamp: new Date().toISOString()
      });
    }
    
    await performanceService.triggerOptimizationActions(targets);
    
    return c.json({
      success: true,
      message: `Triggered optimization for ${targets.length} targets`,
      data: { targets },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Performance optimization trigger error:', error);
    return c.json({
      error: 'Failed to trigger optimization',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Performance health check
app.get('/health', async (c) => {
  try {
    const services = {
      cacheService: !!c.get('cacheService'),
      compressionService: !!c.get('compressionService'),
      optimizedDbService: !!c.get('optimizedDbService'),
      optimizedPresignedUrlService: !!c.get('optimizedPresignedUrlService'),
      optimizedR2Service: !!c.get('optimizedR2Service'),
      performanceMonitoringService: !!c.get('performanceMonitoringService'),
      cachingMiddleware: !!c.get('cachingMiddleware')
    };
    
    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;
    
    return c.json({
      status: healthyServices === totalServices ? 'healthy' : 'partial',
      services,
      healthyServices,
      totalServices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Performance health check error:', error);
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default app;