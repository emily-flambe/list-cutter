import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import type { CloudflareEnv } from './types/env';

// Security imports
import { SecurityConfigManager } from './config/security-config';
import { SecurityMonitorService } from './services/security/security-monitor';
import { SecurityMetricsCollector } from './services/security/metrics-collector';
import { SecurityHeadersMiddleware } from './middleware/security-headers';

// Import route handlers
// import authRoutes from '@routes/auth';
// import csvRoutes from '@routes/csv';
// import fileRoutes from '@routes/files';
// import userRoutes from '@routes/users';

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Initialize security services
let securityConfigManager: SecurityConfigManager;
let securityMonitor: SecurityMonitorService;
let securityMetricsCollector: SecurityMetricsCollector;
let securityHeadersMiddleware: SecurityHeadersMiddleware;

// Security initialization middleware
app.use('*', async (c, next) => {
  // Initialize security services if not already done
  if (!securityConfigManager && c.env.SECURITY_CONFIG) {
    try {
      securityConfigManager = new SecurityConfigManager({
        kvNamespace: c.env.SECURITY_CONFIG,
        environment: c.env.ENVIRONMENT,
        enableDynamicUpdates: true,
        cacheExpirationMinutes: 5,
        fallbackToDefaults: true
      });

      securityMonitor = new SecurityMonitorService({
        configManager: securityConfigManager,
        analytics: c.env.ANALYTICS,
        kvNamespace: c.env.SECURITY_EVENTS,
        alertWebhook: c.env.SECURITY_ALERT_WEBHOOK,
        performanceThreshold: parseInt(c.env.SECURITY_PERFORMANCE_THRESHOLD || '100'),
        enableRealTimeMonitoring: c.env.SECURITY_ENABLE_REAL_TIME_MONITORING === 'true',
        batchSize: 100,
        metricsRetentionDays: parseInt(c.env.SECURITY_METRICS_RETENTION_DAYS || '30')
      });

      securityMetricsCollector = new SecurityMetricsCollector({
        configManager: securityConfigManager,
        monitor: securityMonitor,
        analytics: c.env.ANALYTICS,
        kvStorage: c.env.SECURITY_METRICS,
        config: {
          enabled: true,
          batchSize: 100,
          flushIntervalSeconds: 60,
          retentionDays: parseInt(c.env.SECURITY_METRICS_RETENTION_DAYS || '30'),
          aggregationWindows: [5, 15, 60, 1440],
          enabledMetrics: [
            'security.auth.attempts',
            'security.auth.failures',
            'security.auth.duration',
            'security.file.validations',
            'security.file.validation_duration',
            'security.file.threats',
            'security.rate_limit.checks',
            'security.rate_limit.violations',
            'security.events.count',
            'security.events.response_time',
            'security.performance.duration'
          ],
          alertThresholds: {
            'security.auth.failures': 10,
            'security.file.threats': 5,
            'security.rate_limit.violations': 100,
            'security.performance.duration': 1000
          }
        }
      });

      securityHeadersMiddleware = new SecurityHeadersMiddleware({
        configManager: securityConfigManager,
        monitor: securityMonitor,
        enableNonceGeneration: true,
        enableReporting: true,
        customHeaders: {
          'X-Security-Framework': 'ListCutter-Security-v1.0',
          'X-Security-Timestamp': new Date().toISOString()
        },
        skipPaths: ['/health', '/favicon.ico', '/robots.txt', '/test-r2', '/test-phase5']
      });

      console.log('Security services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security services:', error);
      // Continue without security services in case of initialization failure
    }
  }

  // Store security services in context for use by other middleware/routes
  c.set('securityConfig', securityConfigManager);
  c.set('securityMonitor', securityMonitor);
  c.set('securityMetrics', securityMetricsCollector);

  await next();
});

// Global middleware
app.use('*', timing());
app.use('*', logger());

// Security headers middleware (replaces basic secureHeaders)
app.use('*', async (c, next) => {
  if (securityHeadersMiddleware) {
    await securityHeadersMiddleware.middleware(c, next);
  } else {
    // Fallback to basic secure headers if security middleware not available
    const { secureHeaders } = await import('hono/secure-headers');
    await secureHeaders()(c, next);
  }
});

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
app.get('/health', async (c) => {
  const securityMonitor = c.get('securityMonitor') as SecurityMonitorService;
  
  let securityHealth = null;
  if (securityMonitor) {
    try {
      securityHealth = await securityMonitor.checkSystemHealth();
    } catch (error) {
      console.error('Failed to get security health:', error);
    }
  }
  
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    security: securityHealth ? {
      overall: securityHealth.overall,
      systems: {
        auth: securityHealth.authSystem,
        fileValidation: securityHealth.fileValidation,
        rateLimit: securityHealth.rateLimit,
        threatDetection: securityHealth.threatDetection
      }
    } : undefined
  });
});

// Security management endpoints
app.get('/api/security/config', async (c) => {
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

app.get('/api/security/dashboard', async (c) => {
  const securityMonitor = c.get('securityMonitor') as SecurityMonitorService;
  
  if (!securityMonitor) {
    return c.json({ error: 'Security monitoring not available' }, 503);
  }
  
  try {
    const dashboard = await securityMonitor.getSecurityDashboard();
    return c.json(dashboard);
  } catch (error) {
    return c.json({ 
      error: 'Failed to get security dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.get('/api/security/metrics', async (c) => {
  const securityMetrics = c.get('securityMetrics') as SecurityMetricsCollector;
  
  if (!securityMetrics) {
    return c.json({ error: 'Security metrics not available' }, 503);
  }
  
  try {
    const timeRange = c.req.query('timeRange') || '24h';
    const format = c.req.query('format') || 'json';
    
    if (format === 'dashboard') {
      const dashboardData = await securityMetrics.generateDashboardData(timeRange);
      return c.json(dashboardData);
    } else if (format === 'export') {
      const hoursBack = timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);
      
      const exportFormat = c.req.query('exportFormat') || 'json';
      const data = await securityMetrics.exportMetrics(
        startTime.toISOString(),
        endTime.toISOString(),
        exportFormat as 'json' | 'csv'
      );
      
      if (exportFormat === 'csv') {
        c.header('Content-Type', 'text/csv');
        c.header('Content-Disposition', `attachment; filename="security-metrics-${timeRange}.csv"`);
        return c.text(data);
      }
      
      return c.text(data);
    } else {
      const hoursBack = timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;
      const summary = await securityMetrics.getMetricsSummary(hoursBack);
      return c.json(summary);
    }
  } catch (error) {
    return c.json({ 
      error: 'Failed to get security metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/security/alerts/:alertId/resolve', async (c) => {
  const securityMonitor = c.get('securityMonitor') as SecurityMonitorService;
  
  if (!securityMonitor) {
    return c.json({ error: 'Security monitoring not available' }, 503);
  }
  
  try {
    const alertId = c.req.param('alertId');
    const body = await c.req.json().catch(() => ({}));
    const resolvedBy = body.resolvedBy || 'api';
    
    await securityMonitor.resolveAlert(alertId, resolvedBy);
    return c.json({ success: true, message: 'Alert resolved successfully' });
  } catch (error) {
    return c.json({ 
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/api/security/config/update', async (c) => {
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

app.post('/api/security/csp-report', async (c) => {
  const securityMonitor = c.get('securityMonitor') as SecurityMonitorService;
  
  try {
    const report = await c.req.json();
    
    // Log CSP violation
    console.warn('CSP Violation Report:', report);
    
    // Record security event if monitoring is available
    if (securityMonitor) {
      await securityMonitor.recordEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'violation',
        severity: 'medium',
        source: 'csp_report',
        description: 'Content Security Policy violation detected',
        metadata: {
          report,
          violatedDirective: report['csp-report']?.['violated-directive'],
          blockedUri: report['csp-report']?.['blocked-uri'],
          sourceFile: report['csp-report']?.['source-file']
        },
        ipAddress: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        resolved: false
      });
    }
    
    return c.json({ received: true }, 204);
  } catch (error) {
    console.error('Error handling CSP report:', error);
    return c.json({ error: 'Invalid report format' }, 400);
  }
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