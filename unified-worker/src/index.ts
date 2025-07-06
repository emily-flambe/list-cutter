import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { HonoEnv } from '@/types/env';

// Import middleware
import { enforceHTTPS, addSecurityHeaders } from '@/middleware/security';
import { rateLimitMiddleware } from '@/middleware/rateLimit';
import { requestIdMiddleware } from '@/middleware/requestId';

// Import route handlers
import { healthRoutes } from '@/routes/health';
import { authRoutes } from '@/routes/auth';
import { fileRoutes } from '@/routes/files';
import { csvRoutes } from '@/routes/csv';
import { adminRoutes } from '@/routes/admin';

// Import static asset handler
import { staticAssetHandler } from '@/middleware/staticAssets';

const app = new Hono<HonoEnv>();

// Global middleware stack
app.use('*', timing());
app.use('*', logger());
app.use('*', requestIdMiddleware);
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// Security middleware
app.use('*', (c, next) => {
  const httpsResponse = enforceHTTPS(c.req.raw);
  if (httpsResponse) {
    return httpsResponse;
  }
  return next();
});

// Rate limiting
app.use('/api/*', rateLimitMiddleware);

// CORS configuration
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
    credentials: true,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// API Routes
const api = app.basePath('/api/v1');
api.route('/health', healthRoutes);
api.route('/auth', authRoutes);
api.route('/files', fileRoutes);
api.route('/csv', csvRoutes);
api.route('/admin', adminRoutes);

// Health check endpoint at root level
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint for monitoring
app.get('/metrics', (c) => {
  return c.json({
    environment: c.env.ENVIRONMENT,
    uptime: Date.now(),
    memory: (performance as any).memory || {},
    timestamp: new Date().toISOString(),
  });
});

// Static asset serving for frontend
app.use('/*', staticAssetHandler);

// 404 handler for API routes
app.onError((err, c) => {
  console.error(`Error: ${err.message}`, err.stack);
  
  const status = 'status' in err ? (err as any).status || 500 : 500;
  const isDevelopment = c.env?.ENVIRONMENT === 'development';
    
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      message: 'An unexpected error occurred',
      requestId: c.get('requestId'),
      ...(isDevelopment && { stack: err.stack }),
    },
    status
  );
});

// 404 handler
app.notFound((c) => {
  const path = c.req.path;
  
  // If it's an API request, return JSON 404
  if (path.startsWith('/api/')) {
    return c.json(
      {
        error: 'Not Found',
        message: 'The requested API endpoint does not exist',
        path,
        requestId: c.get('requestId'),
      },
      404
    );
  }
  
  // For frontend routes, serve the React app's index.html
  // This enables client-side routing
  return c.env.ASSETS.fetch(new Request(`${c.req.url.split(path)[0]}/index.html`));
});

export default app;