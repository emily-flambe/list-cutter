import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import type { CloudflareEnv } from './types/env';
import { R2StorageService } from './services/storage/r2-service';

// Import route handlers
// import authRoutes from '@routes/auth';
// import csvRoutes from '@routes/csv';
// import fileRoutes from '@routes/files';
// import userRoutes from '@routes/users';

const app = new Hono<{ Bindings: CloudflareEnv }>();

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
      error: error.message
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

// API version prefix - routes will be added in Phase 2
// const v1 = app.basePath('/api/v1');

// Mount routes (to be added in Phase 2)
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

export default app;