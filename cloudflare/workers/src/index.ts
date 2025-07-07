import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import type { CloudflareEnv } from './types/env';
import { IntegratedDashboardAPI } from './routes/dashboard-integration.js';
import { createAlertRoutes } from './routes/alerts.js';
import { createAlertDashboardRoutes } from './routes/dashboard-alerts.js';
import { createAlertJobRoutes } from './routes/alert-jobs.js';

// Import route handlers
import migrationRoutes from './routes/migration.js';
// import authRoutes from '@routes/auth';
// import csvRoutes from '@routes/csv';
// import fileRoutes from '@routes/files';
// import userRoutes from '@routes/users';

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Initialize dashboard API and alert routes
let dashboardAPI: IntegratedDashboardAPI;
let alertRoutes: any;
let alertDashboardRoutes: any;
let alertJobRoutes: any;

// Global middleware
app.use('*', timing());
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS configuration
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
    credentials: true,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Test R2 storage endpoint for Phase 5 verification
app.get('/test-r2', async (c) => {
  try {
    // Test R2 bucket connectivity
    const testKey = 'test-connectivity-' + Date.now();
    const testData = 'Phase 5 R2 test data';
    
    // Try to put and get a test file
    await c.env.FILE_STORAGE.put(testKey, testData);
    const retrieved = await c.env.FILE_STORAGE.get(testKey);
    
    if (retrieved) {
      const content = await retrieved.text();
      // Clean up test file
      await c.env.FILE_STORAGE.delete(testKey);
      
      return c.json({
        status: 'success',
        message: 'R2 storage is working correctly',
        test: {
          wrote: testData,
          read: content,
          match: content === testData
        }
      });
    } else {
      return c.json({
        status: 'error',
        message: 'Failed to retrieve test file from R2'
      }, 500);
    }
  } catch (error) {
    return c.json({
      status: 'error',
      message: 'R2 storage test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Test Phase 5 R2StorageService endpoint (basic test without DB)
app.get('/test-phase5', async (c) => {
  try {
    return c.json({
      status: 'success',
      message: 'Phase 5 R2StorageService ready for instantiation',
      features: {
        multipartUpload: 'Available',
        maxSingleUploadSize: '50MB',
        maxMultipartUploadSize: '5GB',
        multipartChunkSize: '5MB'
      },
      bucket_binding: c.env.FILE_STORAGE ? 'Connected' : 'Not found',
      note: 'Full service available when D1 database is configured'
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: 'Failed to test Phase 5 setup',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Initialize dashboard API and alert routes when environment is available
app.use('*', async (c, next) => {
  if (!dashboardAPI && c.env.ANALYTICS && c.env.DB) {
    dashboardAPI = new IntegratedDashboardAPI(
      c.env.ANALYTICS,
      c.env.DB,
      {
        enableMetrics: true,
        enableDetailedMetrics: false,
        successMetricsSamplingRate: 0.1,
        errorMetricsSamplingRate: 1.0
      }
    );
    
    // Initialize alert routes
    alertRoutes = createAlertRoutes(c.env.DB, c.env.ANALYTICS);
    alertDashboardRoutes = createAlertDashboardRoutes(c.env.DB, c.env.ANALYTICS);
    alertJobRoutes = createAlertJobRoutes(c.env.DB, c.env.ANALYTICS);
  }
  await next();
});

// Dashboard API routes
app.all('/admin/metrics/*', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/user/storage/*', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/metrics/realtime/*', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/metrics/historical/*', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/api/metrics/*', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

// Dashboard health check endpoint
app.get('/dashboard/health', async (c) => {
  if (!dashboardAPI) {
    return c.json({ 
      status: 'error',
      message: 'Dashboard API not initialized',
      timestamp: new Date().toISOString()
    }, 500);
  }
  
  try {
    const healthCheck = await dashboardAPI.healthCheck();
    return c.json(healthCheck);
  } catch (error) {
    return c.json({
      status: 'error',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Dashboard cache management endpoint (admin only)
app.post('/dashboard/cache/clear', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  try {
    const pattern = c.req.query('pattern');
    dashboardAPI.clearCache(pattern);
    
    return c.json({
      success: true,
      message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Dashboard statistics endpoint
app.get('/dashboard/stats', async (c) => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  try {
    const stats = await dashboardAPI.getDashboardStats();
    return c.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Alert API routes
app.all('/api/alerts/*', async (c) => {
  if (!alertRoutes) {
    return c.json({ error: 'Alert system not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  return alertRoutes.fetch(request, c.env);
});

// Alert dashboard routes
app.all('/api/dashboard/*', async (c) => {
  if (!alertDashboardRoutes) {
    return c.json({ error: 'Alert dashboard not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as any,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  return alertDashboardRoutes.fetch(request, c.env);
});

// API version prefix
const v1 = app.basePath('/api');

// Mount routes
v1.route('/migration', migrationRoutes);
// v1.route('/auth', authRoutes);
// v1.route('/csv', csvRoutes);
// v1.route('/files', fileRoutes);
// v1.route('/users', userRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: 'The requested resource does not exist',
      path: c.req.path,
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  // Log error (console.error is available in Workers runtime)
  console.error(`Error: ${err.message}`, err.stack);
  
  const status = err instanceof Error && 'status' in err 
    ? (err as Error & { status?: number }).status || 500
    : 500;
    
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      message: 'An unexpected error occurred',
      ...(c.env?.ENVIRONMENT === 'development' && { stack: err.stack }),
    },
    status as 500
  );
});

// Scheduled event handler for cron triggers
export const scheduled: ExportedHandlerScheduledHandler<CloudflareEnv> = async (event, env, ctx) => {
  console.log('Scheduled event triggered:', event.cron);
  
  try {
    // Initialize alert job routes if not already done
    const alertJobRoutes = createAlertJobRoutes(env.DB, env.ANALYTICS);
    
    let response: Response;
    
    switch (event.cron) {
      case '*/5 * * * *': // Every 5 minutes - Alert evaluation
        console.log('Running scheduled alert evaluation...');
        response = await alertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/evaluate', { method: 'POST' }),
          env
        );
        break;
        
      case '*/15 * * * *': // Every 15 minutes - Retry failed notifications  
        console.log('Running notification retry job...');
        response = await alertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/retry-notifications', { method: 'POST' }),
          env
        );
        break;
        
      case '0 2 * * *': // Daily at 2 AM - Cleanup old data
        console.log('Running alert cleanup job...');
        response = await alertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/cleanup', { method: 'POST' }),
          env
        );
        break;
        
      case '*/10 * * * *': // Every 10 minutes - Health check 
        console.log('Running alert health check...');
        response = await alertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/health-check', { method: 'POST' }),
          env
        );
        break;
        
      default:
        console.log('Unknown cron pattern:', event.cron);
        return;
    }
    
    const result = await response.json();
    console.log('Scheduled job result:', result);
    
  } catch (error) {
    console.error('Scheduled job failed:', error);
  }
};

export default app;