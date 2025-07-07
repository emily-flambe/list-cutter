/**
 * Example usage of the enhanced R2 storage service with comprehensive metrics collection
 * This demonstrates how to integrate the metrics collection layer into your application
 */

import { EnhancedR2ServiceFactory } from '../services/storage/r2-service-factory.js';
import { MetricsConfiguration } from '../types/metrics.js';
import { CloudflareEnv } from '../types/env.js';

/**
 * Example configuration for metrics collection
 */
const metricsConfig: Partial<MetricsConfiguration> = {
  enableMetrics: true,
  enableDetailedMetrics: true,
  enableUserMetrics: true,
  enableSystemMetrics: true,
  
  // Sample 10% of successful operations to reduce overhead
  successMetricsSamplingRate: 0.1,
  // Sample 100% of errors for comprehensive error tracking
  errorMetricsSamplingRate: 1.0,
  // Sample 1% for detailed metrics
  detailedMetricsSamplingRate: 0.01,
  
  // Enable asynchronous metrics for better performance
  asyncMetrics: true,
  batchSize: 50,
  flushInterval: 30000, // 30 seconds
  
  // Alert thresholds
  alertThresholds: {
    maxResponseTime: 5000, // 5 seconds
    maxErrorRate: 0.05, // 5%
    maxQueueDepth: 1000,
    maxStorageUsage: 0.9, // 90%
    maxDailyBandwidth: 10 * 1024 * 1024 * 1024, // 10GB
    maxFilesPerUser: 10000,
    maxConcurrentUploads: 10,
    maxFailedOperationsPerMinute: 100,
    customThresholds: {}
  }
};

/**
 * Example: File upload with metrics collection
 */
export async function uploadFileWithMetrics(
  env: CloudflareEnv,
  fileData: ArrayBuffer,
  userId: string,
  fileName: string,
  contentType: string,
  requestId?: string,
  userAgent?: string,
  ipAddress?: string
) {
  // Get enhanced R2 service instance
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    const uploadResult = await r2Service.uploadFile(
      fileData,
      {
        userId,
        fileId: crypto.randomUUID(),
        fileName,
        contentType,
        storageClass: 'Standard',
        metadata: {
          uploadedBy: userId,
          originalSize: fileData.byteLength.toString(),
          uploadMethod: 'api'
        }
      },
      {
        requestId,
        userAgent,
        ipAddress,
        region: 'us-east-1' // Or detect from request
      }
    );

    console.log('Upload successful:', uploadResult);
    return uploadResult;
    
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

/**
 * Example: File download with metrics collection
 */
export async function downloadFileWithMetrics(
  env: CloudflareEnv,
  fileId: string,
  userId: string,
  rangeHeader?: string,
  requestId?: string,
  userAgent?: string,
  ipAddress?: string
) {
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    const downloadResult = await r2Service.downloadFile(
      fileId,
      userId,
      { range: rangeHeader },
      {
        requestId,
        userAgent,
        ipAddress,
        region: 'us-east-1'
      }
    );

    if (downloadResult) {
      console.log('Download successful, size:', downloadResult.size);
      return downloadResult;
    } else {
      throw new Error('File not found');
    }
    
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

/**
 * Example: File deletion with metrics collection
 */
export async function deleteFileWithMetrics(
  env: CloudflareEnv,
  fileId: string,
  userId: string,
  requestId?: string,
  userAgent?: string,
  ipAddress?: string
) {
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    const deleteResult = await r2Service.deleteFile(
      fileId,
      userId,
      {
        requestId,
        userAgent,
        ipAddress,
        region: 'us-east-1'
      }
    );

    console.log('Delete successful:', deleteResult);
    return deleteResult;
    
  } catch (error) {
    console.error('Delete failed:', error);
    throw error;
  }
}

/**
 * Example: Get user storage usage and analytics
 */
export async function getUserStorageAnalytics(
  env: CloudflareEnv,
  userId: string
) {
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    // Get current usage metrics
    const currentUsage = await r2Service.getUserStorageUsage(userId);
    console.log('Current usage:', currentUsage);
    
    // Get historical analytics for the last 30 days
    const analytics = await r2Service.getUserStorageAnalytics(userId, {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      granularity: 'day'
    });
    console.log('Historical analytics:', analytics);
    
    return {
      currentUsage,
      analytics
    };
    
  } catch (error) {
    console.error('Failed to get user analytics:', error);
    throw error;
  }
}

/**
 * Example: Get system-wide storage metrics
 */
export async function getSystemMetrics(env: CloudflareEnv) {
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    const systemMetrics = await r2Service.getSystemStorageMetrics();
    console.log('System metrics:', systemMetrics);
    return systemMetrics;
    
  } catch (error) {
    console.error('Failed to get system metrics:', error);
    throw error;
  }
}

/**
 * Example: Hono middleware for automatic metrics collection
 */
export function createMetricsMiddleware(env: CloudflareEnv) {
  return async (c: any, next: () => Promise<void>) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    
    // Add context to request
    c.set('requestId', requestId);
    c.set('startTime', startTime);
    c.set('userAgent', userAgent);
    c.set('ipAddress', ipAddress);
    
    try {
      await next();
      
      // Record successful request metric
      const duration = Date.now() - startTime;
      console.log(`Request ${requestId} completed in ${duration}ms`);
      
    } catch (error) {
      // Record failed request metric
      const duration = Date.now() - startTime;
      console.error(`Request ${requestId} failed after ${duration}ms:`, error);
      throw error;
    }
  };
}

/**
 * Example: Periodic metrics flush (call this in a scheduled worker)
 */
export async function periodicMetricsFlush(env: CloudflareEnv) {
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    // Flush any pending metrics
    await r2Service.flushMetrics();
    
    // Get cache statistics
    const cacheStats = r2Service.getCacheStats();
    console.log('Cache statistics:', cacheStats);
    
    // Optionally clear old cache entries if memory usage is high
    if (cacheStats.totalMemoryUsage > 10 * 1024 * 1024) { // 10MB
      console.log('Cache memory usage high, clearing old entries');
      // Could implement selective cache clearing here
    }
    
  } catch (error) {
    console.error('Failed to flush metrics:', error);
  }
}

/**
 * Example: Application shutdown cleanup
 */
export async function gracefulShutdown(env: CloudflareEnv) {
  const r2Service = EnhancedR2ServiceFactory.getInstance(env, metricsConfig);
  
  try {
    console.log('Starting graceful shutdown...');
    
    // Flush all pending metrics
    await r2Service.flushMetrics();
    
    // Cleanup resources
    await r2Service.cleanup();
    
    console.log('Graceful shutdown completed');
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
  }
}

/**
 * Example usage in a Hono application
 */
export function setupR2Routes(app: any, env: CloudflareEnv) {
  // Add metrics middleware
  app.use('*', createMetricsMiddleware(env));
  
  // Upload endpoint
  app.post('/api/v1/files/upload', async (c: any) => {
    const userId = c.get('userId'); // Assuming auth middleware sets this
    const requestId = c.get('requestId');
    const userAgent = c.get('userAgent');
    const ipAddress = c.get('ipAddress');
    
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }
      
      const fileData = await file.arrayBuffer();
      const result = await uploadFileWithMetrics(
        env,
        fileData,
        userId,
        file.name,
        file.type,
        requestId,
        userAgent,
        ipAddress
      );
      
      return c.json(result);
      
    } catch (error) {
      return c.json({ error: error.message }, 500);
    }
  });
  
  // Download endpoint
  app.get('/api/v1/files/:fileId/download', async (c: any) => {
    const userId = c.get('userId');
    const fileId = c.req.param('fileId');
    const rangeHeader = c.req.header('Range');
    const requestId = c.get('requestId');
    const userAgent = c.get('userAgent');
    const ipAddress = c.get('ipAddress');
    
    try {
      const result = await downloadFileWithMetrics(
        env,
        fileId,
        userId,
        rangeHeader,
        requestId,
        userAgent,
        ipAddress
      );
      
      if (!result) {
        return c.json({ error: 'File not found' }, 404);
      }
      
      return new Response(result.body, {
        headers: {
          'Content-Type': result.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Length': result.size.toString(),
          'ETag': result.etag,
          'Cache-Control': result.httpMetadata?.cacheControl || 'private'
        }
      });
      
    } catch (error) {
      return c.json({ error: error.message }, 500);
    }
  });
  
  // User analytics endpoint
  app.get('/api/v1/users/:userId/analytics', async (c: any) => {
    const userId = c.req.param('userId');
    const currentUserId = c.get('userId');
    
    // Ensure user can only access their own analytics
    if (userId !== currentUserId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    try {
      const analytics = await getUserStorageAnalytics(env, userId);
      return c.json(analytics);
      
    } catch (error) {
      return c.json({ error: error.message }, 500);
    }
  });
}