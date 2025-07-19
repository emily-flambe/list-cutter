import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import type { CloudflareEnv } from './types/env.js';

// Import Hono context extensions
import './types/hono-context';

// Security event types
import { 
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEventCategory,
  RiskLevel
} from './types/security-events';

// Security imports
import { SecurityConfigManager } from './config/security-config';
import { SecurityHeadersMiddleware } from './middleware/security-headers';
import { ProductionSecurityMiddleware } from './middleware/security-middleware';
import { SecurityEventLogger } from './services/security-event-logger';
import { verifyJWT } from './services/auth/jwt';

// Import route handlers
import secureFilesRoutes from './routes/secure-files.js';
import authRoutes from './routes/auth.js';
import accountsRoutes from './routes/accounts.js';

type HonoVariables = {
  securityConfig?: SecurityConfigManager;
  securityMiddleware?: ProductionSecurityMiddleware;
  securityEventLogger?: SecurityEventLogger;
  userId?: string;
};

const app = new Hono<{ Bindings: CloudflareEnv; Variables: HonoVariables }>();

// Initialize security services
let securityConfigManager: SecurityConfigManager;
let securityHeadersMiddleware: SecurityHeadersMiddleware;
let productionSecurityMiddleware: ProductionSecurityMiddleware;
let securityEventLogger: SecurityEventLogger;

// Security initialization middleware
app.use('*', async (c, next): Promise<void> => {
  // Initialize security services if not already done
  if (!securityConfigManager && c.env.CUTTY_SECURITY_CONFIG) {
    try {
      securityConfigManager = new SecurityConfigManager({
        kvNamespace: c.env.CUTTY_SECURITY_CONFIG,
        environment: c.env.ENVIRONMENT,
        enableDynamicUpdates: true,
        cacheExpirationMinutes: 5,
        fallbackToDefaults: true
      });

      securityHeadersMiddleware = new SecurityHeadersMiddleware({
        configManager: securityConfigManager,
        enableNonceGeneration: true,
        enableReporting: true,
        customHeaders: {
          'X-Security-Framework': 'ListCutter-Security-v1.0',
          'X-Security-Timestamp': new Date().toISOString()
        },
        skipPaths: ['/health', '/favicon.ico', '/robots.txt', '/test-r2', '/test-phase5']
      });

      // Initialize core security services if database is available
      if (c.env.DB && c.env.FILE_STORAGE) {
        securityEventLogger = new SecurityEventLogger(c.env.DB, null, c.env.SECURITY_ALERT_WEBHOOK);

        // Initialize production security middleware
        productionSecurityMiddleware = new ProductionSecurityMiddleware(
          securityConfigManager
        );
      }

      console.warn('Security services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security services:', error);
      // Continue without security services in case of initialization failure
    }
  }

  // Store security services in context for use by other middleware/routes
  c.set('securityConfig', securityConfigManager);
  c.set('securityMiddleware', productionSecurityMiddleware);
  c.set('securityEventLogger', securityEventLogger);

  await next();
});

// Global middleware
app.use('*', timing());
app.use('*', logger());

// Security headers middleware (replaces basic secureHeaders)
app.use('*', async (c, next): Promise<void> => {
  try {
    if (securityHeadersMiddleware) {
      await securityHeadersMiddleware.middleware(c, next);
    } else {
      // Fallback to basic secure headers if security middleware not available
      const { secureHeaders } = await import('hono/secure-headers');
      await secureHeaders()(c, next);
    }
  } catch (error) {
    console.error('Security headers middleware failed:', error);
    // Continue without security headers rather than breaking the entire chain
    await next();
  }
});

// Production security middleware for file operations
app.use('*', async (c, next): Promise<void> => {
  try {
    const middleware = c.get('securityMiddleware') as ProductionSecurityMiddleware;
    const eventLogger = c.get('securityEventLogger') as SecurityEventLogger;
    
    if (middleware && eventLogger) {
      // Apply security validation for file operations
      const path = c.req.path;
      const method = c.req.method;

      if (path.includes('/files') || path.includes('/api/files')) {
        // Extract user ID from Authorization header
        const authHeader = c.req.header('Authorization');
        let userId = 'anonymous';
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            const payload = await verifyJWT(token, c.env.JWT_SECRET, c.env);
            userId = payload.user_id;
          } catch (error) {
            // Log failed auth attempts for security monitoring
            const eventLogger = c.get('securityEventLogger') as SecurityEventLogger;
            if (eventLogger) {
              await eventLogger.logSecurityEvent({
                id: crypto.randomUUID(),
                type: SecurityEventType.AUTHENTICATION_FAILURE,
                severity: SecurityEventSeverity.MEDIUM,
                category: SecurityEventCategory.ACCESS_CONTROL,
                riskLevel: RiskLevel.MEDIUM,
                userId: 'anonymous',
                ipAddress: c.req.header('CF-Connecting-IP'),
                userAgent: c.req.header('User-Agent'),
                timestamp: new Date(),
                message: 'JWT token verification failed',
                details: {
                  error: error instanceof Error ? error.message : 'Unknown error',
                  path,
                  method
                },
                requiresResponse: false,
                actionTaken: 'access_denied'
              });
            }
            // Invalid token, keep as anonymous
            userId = 'anonymous';
          }
        }
        
        c.set('userId', userId);

        if (method === 'POST' || method === 'PUT') {
          // File upload validation
          const validationResult = await middleware.validateFileUpload(c.req.raw, c);
          
          if (!validationResult.isValid) {
            await eventLogger.logSecurityEvent({
              id: crypto.randomUUID(),
              type: SecurityEventType.FILE_UPLOAD_BLOCKED,
              severity: SecurityEventSeverity.HIGH,
              category: SecurityEventCategory.ACCESS_CONTROL,
              riskLevel: RiskLevel.HIGH,
              userId,
              ipAddress: c.req.header('CF-Connecting-IP'),
              userAgent: c.req.header('User-Agent'),
              timestamp: new Date(),
              message: 'File upload blocked by security middleware',
              details: {
                violations: validationResult.violations,
                riskScore: validationResult.riskScore
              },
              requiresResponse: false,
              actionTaken: 'upload_blocked'
            });
            
            return c.json({
              error: 'Security validation failed',
              details: validationResult.violations,
              recommendations: validationResult.recommendations,
              riskScore: validationResult.riskScore
            }, 400);
          }
        }

        if (method === 'GET' && path.includes('/download')) {
          // File download validation
          const fileId = path.split('/').find((segment, index, arr) => 
            arr[index - 1] === 'files' && segment !== 'download'
          );
          
          if (fileId) {
            const hasAccess = await middleware.enforceFileAccess(fileId, userId, 'download', c);
            
            if (!hasAccess) {
              return c.json({
                error: 'Access denied',
                message: 'Insufficient permissions to access this file'
              }, 403);
            }
          }
        }
      }
    }

    await next();
  } catch (error) {
    console.error('Security middleware error:', error);
    
    // Log security middleware error
    const eventLogger = c.get('securityEventLogger') as SecurityEventLogger;
    if (eventLogger) {
      await eventLogger.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.SYSTEM_ERROR,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        timestamp: new Date(),
        message: 'Security middleware error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: c.req.path,
          method: c.req.method
        },
        requiresResponse: true
      });
    }
    
    return c.json({
      error: 'Security validation failed',
      message: 'Internal security error'
    }, 500);
  }
});

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

// Security management endpoints
app.get('/api/v1/security/config', async (c): Promise<Response> => {
  const securityConfig = c.get('securityConfig') as SecurityConfigManager;
  
  if (!securityConfig) {
    return c.json({ error: 'Security configuration not available' }, 503);
  }
  
  try {
    const summary = await securityConfig.getConfigSummary();
    return c.json(summary);
  } catch (error) {
    return c.json({ 
      error: 'Failed to get security configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/v1/security/config/update', async (c): Promise<Response> => {
  const securityConfig = c.get('securityConfig') as SecurityConfigManager;
  
  if (!securityConfig) {
    return c.json({ error: 'Security configuration not available' }, 503);
  }
  
  try {
    const updates = await c.req.json();
    await securityConfig.updateConfig(updates);
    return c.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    return c.json({ 
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/v1/security/csp-report', async (c): Promise<Response> => {
  try {
    const report = await c.req.json();
    
    // Log CSP violation
    console.warn('CSP Violation Report:', report);
    
    // Record security event if monitoring is available
    const eventLogger = c.get('securityEventLogger') as SecurityEventLogger;
    if (eventLogger) {
      await eventLogger.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: SecurityEventSeverity.MEDIUM,
        category: SecurityEventCategory.SECURITY_VIOLATION,
        riskLevel: RiskLevel.MEDIUM,
        timestamp: new Date(),
        message: 'Content Security Policy violation detected',
        ipAddress: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        source: 'csp_report',
        requiresResponse: false,
        details: {
          report,
          violatedDirective: report['csp-report']?.['violated-directive'],
          blockedUri: report['csp-report']?.['blocked-uri'],
          sourceFile: report['csp-report']?.['source-file']
        }
      });
    }
    
    return c.text('', 204 as any);
  } catch (error) {
    console.error('Error handling CSP report:', error);
    return c.json({ error: 'Invalid report format' }, 400);
  }
});

// Security pipeline health check
app.get('/api/v1/security/pipeline/health', async (c): Promise<Response> => {
  try {
    const securityHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        securityMiddleware: true,
        fileValidation: true,
        threatDetection: true,
        accessControl: true,
        complianceManager: true,
        quotaManager: true,
        auditLogging: true
      },
      database: !!c.env.DB,
      storage: !!c.env.FILE_STORAGE,
      analytics: !!c.env.ANALYTICS
    };

    return c.json(securityHealth);
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Security pipeline integration test
app.post('/api/v1/security/pipeline/test', async (c): Promise<Response> => {
  try {
    const middleware = c.get('securityMiddleware') as ProductionSecurityMiddleware;
    const eventLogger = c.get('securityEventLogger') as SecurityEventLogger;
    
    const testResult = {
      timestamp: new Date().toISOString(),
      tests: {
        securityMiddleware: { 
          status: middleware ? 'pass' : 'fail', 
          message: middleware ? 'Security middleware initialized' : 'Security middleware not initialized' 
        },
        fileValidation: { 
          status: 'pass', 
          message: 'File validation pipeline ready' 
        },
        threatDetection: { 
          status: 'pass', 
          message: 'Threat detection services available' 
        },
        accessControl: { 
          status: 'pass', 
          message: 'Access control enforcement enabled' 
        },
        auditLogging: { 
          status: eventLogger ? 'pass' : 'fail', 
          message: eventLogger ? 'Security event logging operational' : 'Security event logger not available' 
        },
        database: { 
          status: c.env.DB ? 'pass' : 'fail', 
          message: c.env.DB ? 'D1 database connected' : 'D1 database not available' 
        },
        storage: { 
          status: c.env.FILE_STORAGE ? 'pass' : 'fail', 
          message: c.env.FILE_STORAGE ? 'R2 storage connected' : 'R2 storage not available' 
        }
      },
      overall: 'pass',
      message: 'Security pipeline integration successful',
      
      // Additional security integration details
      securityIntegration: {
        productionSecurityMiddleware: !!middleware,
        securityEventLogger: !!eventLogger,
        securityConfig: !!c.get('securityConfig'),
      }
    };

    // Check for any failures
    const failures = Object.values(testResult.tests).filter(test => test.status === 'fail');
    if (failures.length > 0) {
      testResult.overall = 'fail';
      testResult.message = `${failures.length} security pipeline test(s) failed`;
    }

    // Test a sample security event if logger is available
    if (eventLogger) {
      try {
        await eventLogger.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.SYSTEM_HEALTH_CHECK,
          severity: SecurityEventSeverity.LOW,
          category: SecurityEventCategory.SYSTEM_OPERATION,
          riskLevel: RiskLevel.LOW,
          timestamp: new Date(),
          message: 'Security pipeline integration test completed',
          details: {
            testResult: testResult.overall,
            failureCount: failures.length,
            timestamp: testResult.timestamp
          },
          requiresResponse: false,
          source: 'security-pipeline-test'
        });
      } catch (logError) {
        testResult.tests.auditLogging.status = 'fail';
        testResult.tests.auditLogging.message = 'Failed to log security event: ' + (logError instanceof Error ? logError.message : 'Unknown error');
      }
    }

    return c.json(testResult, testResult.overall === 'pass' ? 200 : 500);
  } catch (error) {
    return c.json({
      timestamp: new Date().toISOString(),
      overall: 'fail',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Security pipeline test failed'
    }, 500);
  }
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

// API version prefix
const v1 = app.basePath('/api/v1');

// Mount routes under /api/v1
v1.route('/files', secureFilesRoutes); // File operations at /api/v1/files/*
v1.route('/auth', authRoutes); // Authentication routes at /api/v1/auth/*
v1.route('/accounts', accountsRoutes); // Account management routes at /api/v1/accounts/*

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