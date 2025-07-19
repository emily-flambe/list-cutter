import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import { secureHeaders } from 'hono/secure-headers';
import type { CloudflareEnv } from './types/env.js';

// Import Hono context extensions
import './types/hono-context';

// Import route handlers
import filesRoutes from './routes/files';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';

// Import security middleware
import { rateLimitMiddleware } from './services/security';

type HonoVariables = {
  userId?: string;
};

const app = new Hono<{ Bindings: CloudflareEnv; Variables: HonoVariables }>();

// Basic initialization middleware
app.use('*', async (c, next): Promise<void> => {
  // Simple request logging in development
  if (c.env.ENVIRONMENT === 'development') {
    console.log(`${c.req.method} ${c.req.path}`);
  }
  await next();
});

// Global middleware
app.use('*', timing());
app.use('*', logger());

// Basic security headers
app.use('*', secureHeaders());


// CORS configuration - Allow same-origin and development (moved before prettyJSON)
app.use('*', cors({
  origin: (origin, c) => {
    // In development, allow all origins (including localhost on any port and any local IP)
    const environment = c?.env?.ENVIRONMENT || 'development';
    if (environment === 'development') {
      return origin || '*';
    }
    
    // In production, only allow specific origins
    const allowedOrigins = [
      'https://cutty.emilycogsdill.com', 
      'https://835ef64d-cutty.emily-cogsdill.workers.dev', 
      'https://cutty.emily-cogsdill.workers.dev'
    ];
    return allowedOrigins.includes(origin || '') ? origin : false;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400,
}));

app.use('*', prettyJSON());

// Health check endpoint
app.get('/health', async (c): Promise<Response> => {
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});


// Test R2 storage endpoint for Phase 5 verification
app.get('/test-r2', async (c): Promise<Response> => {
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
app.get('/test-phase5', async (c): Promise<Response> => {
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

// Apply rate limiting to API routes
app.use('/api/*', rateLimitMiddleware({ 
  windowMs: 60000, // 1 minute
  maxRequests: 60  // 60 requests per minute
}));

// More restrictive rate limiting for auth endpoints
app.use('/api/*/auth/*', rateLimitMiddleware({ 
  windowMs: 300000, // 5 minutes
  maxRequests: 10   // 10 auth requests per 5 minutes
}));

// API version prefix
const v1 = app.basePath('/api/v1');

// Mount routes under /api/v1
v1.route('/files', filesRoutes); // File operations at /api/v1/files/*
v1.route('/auth', authRoutes); // Authentication routes at /api/v1/auth/*
v1.route('/admin', adminRoutes); // Admin routes at /api/v1/admin/*

// Backward compatibility routes (redirect old /api/ to /api/v1/)
const legacyApi = app.basePath('/api');
legacyApi.route('/auth', authRoutes); // Backward compatibility for /api/auth/*

// Frontend serving logic for non-API routes
app.get('*', async (c, next): Promise<Response> => {
  // Skip API routes - let them be handled by the API handlers above
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/health') || c.req.path.startsWith('/test-') || c.req.path.startsWith('/dashboard/')) {
    // Let these continue to the 404 handler
    return next();
  }

  try {
    // Debug logging
    console.log('Asset request:', c.req.path, 'Method:', c.req.method);
    console.log('ASSETS binding available:', !!c.env.ASSETS);
    
    // Try to serve the asset directly from ASSETS binding
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    console.log('Asset fetch result:', c.req.path, 'Status:', asset.status);
    
    // If asset exists, add appropriate headers and return it
    if (asset.status !== 404) {
      const response = new Response(asset.body, asset);
      
      // Add security headers
      response.headers.set('X-Frame-Options', 'DENY');
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('X-XSS-Protection', '1; mode=block');
      response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      
      // Set CSP for same-origin API access
      response.headers.set('Content-Security-Policy', 
        `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'`
      );
      
      // Set caching headers based on file type
      const pathname = c.req.path;
      if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot)$/)) {
        // Static assets - cache for 1 year
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (pathname.match(/\.(html)$/)) {
        // HTML files - no cache for SPA
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }
      
      return response;
    }
    
    // If asset not found, serve index.html for SPA routing
    const indexRequest = new Request(new URL('/index.html', c.req.url));
    const indexAsset = await c.env.ASSETS.fetch(indexRequest);
    
    if (indexAsset.status === 404) {
      // Continue to API 404 handler
      return next();
    }
    
    // Return index.html with proper headers for SPA routing
    const indexResponse = new Response(indexAsset.body, {
      ...indexAsset,
      headers: {
        ...indexAsset.headers,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'`
      }
    });
    
    return indexResponse;
  } catch (error) {
    console.error('Error serving frontend asset:', error);
    // Continue to API 404 handler
    return next();
  }
});

// 404 handler
app.notFound((c): Response => {
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
app.onError((err, c): Response => {
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
    status
  );
});

export default app;