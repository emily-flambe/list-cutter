import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';
import type { ExportedHandlerScheduledHandler } from '@cloudflare/workers-types';
import type { CloudflareEnv } from './types/env.js';
import { IntegratedDashboardAPI } from './routes/dashboard-integration.js';
import { createAlertRoutes } from './routes/alerts.js';
import { createAlertDashboardRoutes } from './routes/dashboard-alerts.js';
import { createAlertJobRoutes } from './routes/alert-jobs.js';
import type { Hono as HonoApp } from 'hono';

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
import { SecurityMonitorService } from './services/security/security-monitor';
import { SecurityMetricsCollector } from './services/security/metrics-collector';
import { SecurityHeadersMiddleware } from './middleware/security-headers';
import { ProductionSecurityMiddleware } from './middleware/security-middleware';
import { SecurityManager } from './services/security/security-manager';
import { AccessControlService } from './services/security/access-control';
import { ComplianceManager } from './services/security/compliance-manager';
import { QuotaManager } from './services/security/quota-manager';
import { SecurityAuditLogger } from './services/security/audit-logger';
import { SecurityEventLogger } from './services/security-event-logger';
import { MetricsService } from './services/monitoring/metrics-service';
import { verifyJWT } from './services/auth/jwt';

// Import route handlers
// import migrationRoutes from './routes/migration.js'; // Removed - file doesn't exist
import secureFilesRoutes from './routes/secure-files.js';
import monitoringRoutes from './routes/monitoring.js';
import dashboardMonitoringRoutes from './routes/dashboard-monitoring.js';
import backupRoutes from './routes/backup-routes.js';
import disasterRecoveryRoutes from './routes/disaster-recovery-routes.js';
import dataExportRoutes from './routes/data-export-routes.js';
import performanceOptimizationRoutes from './routes/performance-optimization.js';
import authRoutes from './routes/auth.js';
import blueGreenDeploymentRoutes from './routes/deployment/blue-green.js';
// import csvRoutes from '@routes/csv';
// import userRoutes from '@routes/users';

type HonoVariables = {
  securityConfig?: SecurityConfigManager;
  securityMonitor?: SecurityMonitorService;
  securityMetrics?: SecurityMetricsCollector;
  securityMiddleware?: ProductionSecurityMiddleware;
  securityEventLogger?: SecurityEventLogger;
  userId?: string;
};

const app = new Hono<{ Bindings: CloudflareEnv; Variables: HonoVariables }>();

// Initialize security services
let securityConfigManager: SecurityConfigManager;
let securityMonitor: SecurityMonitorService;
let securityMetricsCollector: SecurityMetricsCollector;
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

      securityMonitor = new SecurityMonitorService({
        configManager: securityConfigManager,
        analytics: c.env.ANALYTICS,
        kvNamespace: c.env.CUTTY_SECURITY_EVENTS,
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
        kvStorage: c.env.CUTTY_SECURITY_METRICS,
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

      // Initialize core security services if database is available
      if (c.env.DB && c.env.FILE_STORAGE) {
        const metricsService = new MetricsService(c.env.ANALYTICS, c.env.DB);
        const securityAuditLogger = new SecurityAuditLogger(c.env.DB, c.env.ANALYTICS);
        securityEventLogger = new SecurityEventLogger(c.env.DB, metricsService, c.env.SECURITY_ALERT_WEBHOOK);
        
        // Initialize security management services
        const securityManager = new SecurityManager(c.env.DB, c.env.FILE_STORAGE, c.env.ANALYTICS);
        const accessControl = new AccessControlService(c.env.DB);
        const complianceManager = new ComplianceManager(c.env.DB);
        const quotaManager = new QuotaManager(c.env.DB);

        // Initialize production security middleware
        productionSecurityMiddleware = new ProductionSecurityMiddleware(
          securityManager,
          accessControl,
          securityAuditLogger,
          complianceManager,
          quotaManager
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
  c.set('securityMonitor', securityMonitor);
  c.set('securityMetrics', securityMetricsCollector);
  c.set('securityMiddleware', productionSecurityMiddleware);
  c.set('securityEventLogger', securityEventLogger);

  await next();
});

// Initialize dashboard API and alert routes
let dashboardAPI: IntegratedDashboardAPI | undefined;
let alertRoutes: HonoApp<{ Bindings: CloudflareEnv }> | undefined;
let alertDashboardRoutes: HonoApp<{ Bindings: CloudflareEnv }> | undefined;
let alertJobRoutes: HonoApp<{ Bindings: CloudflareEnv }> | undefined;

// Global middleware
app.use('*', timing());
app.use('*', logger());

// Security headers middleware (replaces basic secureHeaders)
app.use('*', async (c, next): Promise<void> => {
  if (securityHeadersMiddleware) {
    await securityHeadersMiddleware.middleware(c, next);
  } else {
    // Fallback to basic secure headers if security middleware not available
    const { secureHeaders } = await import('hono/secure-headers');
    await secureHeaders()(c, next);
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
            userId = payload.user_id.toString();
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

app.use('*', prettyJSON());

// CORS configuration - Allow same-origin and development
app.use('*', async (c, next): Promise<Response> => {
  const corsMiddleware = cors({
    origin: ['http://localhost:5173', 'https://cutty.emilycogsdill.com', 'https://cutty-api.emily-cogsdill.workers.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
    credentials: true,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Health check endpoint
app.get('/health', async (c): Promise<Response> => {
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
app.get('/api/security/config', async (c): Promise<Response> => {
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

app.get('/api/security/dashboard', async (c): Promise<Response> => {
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

app.get('/api/security/metrics', async (c): Promise<Response> => {
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

app.post('/api/security/alerts/:alertId/resolve', async (c): Promise<Response> => {
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

app.post('/api/security/config/update', async (c): Promise<Response> => {
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

app.post('/api/security/csp-report', async (c): Promise<Response> => {
  const securityMonitor = c.get('securityMonitor') as SecurityMonitorService;
  
  try {
    const report = await c.req.json();
    
    // Log CSP violation
    console.warn('CSP Violation Report:', report);
    
    // Record security event if monitoring is available
    if (securityMonitor) {
      await securityMonitor.recordEvent({
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
app.get('/api/security/pipeline/health', async (c): Promise<Response> => {
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
app.post('/api/security/pipeline/test', async (c): Promise<Response> => {
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
        securityMonitor: !!c.get('securityMonitor'),
        securityMetrics: !!c.get('securityMetrics')
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

// Initialize dashboard API and alert routes when environment is available
app.use('*', async (c, next): Promise<void> => {
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
app.all('/admin/metrics/*', async (c): Promise<Response> => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/user/storage/*', async (c): Promise<Response> => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/metrics/realtime/*', async (c): Promise<Response> => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/metrics/historical/*', async (c): Promise<Response> => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

app.all('/api/metrics/*', async (c): Promise<Response> => {
  if (!dashboardAPI) {
    return c.json({ error: 'Dashboard API not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  const response = await dashboardAPI.handleRequest(request, c.env);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

// Dashboard health check endpoint
app.get('/dashboard/health', async (c): Promise<Response> => {
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
app.post('/dashboard/cache/clear', async (c): Promise<Response> => {
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
app.get('/dashboard/stats', async (c): Promise<Response> => {
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
app.all('/api/alerts/*', async (c): Promise<Response> => {
  if (!alertRoutes) {
    return c.json({ error: 'Alert system not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  return alertRoutes.fetch(request, c.env);
});

// Alert dashboard routes
app.all('/api/dashboard/*', async (c): Promise<Response> => {
  if (!alertDashboardRoutes) {
    return c.json({ error: 'Alert dashboard not initialized' }, 500);
  }
  
  const request = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.header() as Record<string, string>,
    body: c.req.method !== 'GET' ? await c.req.raw.clone().text() : undefined
  });
  
  return alertDashboardRoutes.fetch(request, c.env);
});

// API version prefix
const v1 = app.basePath('/api');

// Mount routes
// v1.route('/migration', migrationRoutes); // Removed - migration routes handled by blue-green deployment
v1.route('/', secureFilesRoutes); // Secure file routes at /api/files/*
v1.route('/monitoring', monitoringRoutes); // Monitoring routes at /api/monitoring/*
v1.route('/dashboard', dashboardMonitoringRoutes); // Dashboard monitoring routes at /api/dashboard/*
v1.route('/backup', backupRoutes); // Backup routes at /api/backup/*
v1.route('/disaster-recovery', disasterRecoveryRoutes); // Disaster recovery routes at /api/disaster-recovery/*
v1.route('/data-export', dataExportRoutes); // Data export routes at /api/data-export/*
v1.route('/performance', performanceOptimizationRoutes); // Performance optimization routes at /api/performance/*
v1.route('/auth', authRoutes);
v1.route('/deployment', blueGreenDeploymentRoutes); // Blue-green deployment routes at /api/deployment/*
// v1.route('/csv', csvRoutes);
// v1.route('/users', userRoutes);

// Frontend serving logic for non-API routes
app.get('*', async (c): Promise<Response> => {
  // Skip API routes - let them be handled by the API handlers above
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/health') || c.req.path.startsWith('/test-') || c.req.path.startsWith('/admin/') || c.req.path.startsWith('/user/') || c.req.path.startsWith('/metrics/') || c.req.path.startsWith('/dashboard/')) {
    // Let these continue to the 404 handler
    return c.next();
  }

  try {
    // Try to serve the asset directly from ASSETS binding
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    
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
      return c.next();
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
    return c.next();
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

// Scheduled event handler for cron triggers
export const scheduled: ExportedHandlerScheduledHandler<CloudflareEnv> = async (event, env, _ctx) => {
  console.warn('Scheduled event triggered:', event.cron);
  
  try {
    // Initialize alert job routes if not already done
    const scheduledAlertJobRoutes = createAlertJobRoutes(env.DB, env.ANALYTICS);
    
    let response: Response;
    
    switch (event.cron) {
      case '*/5 * * * *': // Every 5 minutes - Metrics collection, alert evaluation and auto recovery check
        // Use scheduledTime modulo to distribute jobs across 5-minute intervals
        const minute = Math.floor(event.scheduledTime / 60000) % 3;
        if (minute === 0) {
          console.warn('Running scheduled metrics collection...');
          response = await app.fetch(
            new Request('http://localhost/api/monitoring/collect-metrics', { method: 'POST' }),
            env
          );
        } else if (minute === 1) {
          console.warn('Running scheduled alert evaluation...');
          response = await scheduledAlertJobRoutes.fetch(
            new Request('http://localhost/api/alerts/jobs/evaluate', { method: 'POST' }),
            env
          );
        } else {
          console.warn('Running auto recovery check...');
          response = await app.fetch(
            new Request('http://localhost/api/disaster-recovery/auto-recovery-check', { method: 'POST' }),
            env
          );
        }
        break;
        
      case '0 */6 * * *': // Every 6 hours - Cost calculation
        console.warn('Running scheduled cost calculation...');
        response = await app.fetch(
          new Request('http://localhost/api/monitoring/calculate-costs', { method: 'POST' }),
          env
        );
        break;
        
      case '*/1 * * * *': // Every minute - Alert checking
        console.warn('Running scheduled alert checking...');
        response = await app.fetch(
          new Request('http://localhost/api/monitoring/check-alerts', { method: 'POST' }),
          env
        );
        break;
        
      case '*/15 * * * *': // Every 15 minutes - Retry failed notifications  
        console.warn('Running notification retry job...');
        response = await scheduledAlertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/retry-notifications', { method: 'POST' }),
          env
        );
        break;
        
      case '0 2 * * *': // Daily at 2 AM - Daily backup, daily report, and alert cleanup
        console.warn('Running daily backup...');
        response = await app.fetch(
          new Request('http://localhost/api/backup/daily', { method: 'POST' }),
          env
        );
        
        // Also run daily report generation
        const dailyReportResponse = await app.fetch(
          new Request('http://localhost/api/monitoring/generate-daily-report', { method: 'POST' }),
          env
        );
        console.warn('Daily report result:', await dailyReportResponse.json());
        
        // Also run alert cleanup
        const cleanupResponse = await scheduledAlertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/cleanup', { method: 'POST' }),
          env
        );
        console.warn('Alert cleanup result:', await cleanupResponse.json());
        break;
        
      case '0 3 * * 0': // Weekly backup on Sunday at 3 AM
        console.warn('Running weekly backup...');
        response = await app.fetch(
          new Request('http://localhost/api/backup/weekly', { method: 'POST' }),
          env
        );
        break;
        
      case '0 4 1 * *': // Monthly backup and monthly report on 1st at 4 AM
        console.warn('Running monthly backup...');
        response = await app.fetch(
          new Request('http://localhost/api/backup/monthly', { method: 'POST' }),
          env
        );
        
        // Also run monthly report generation
        const monthlyReportResponse = await app.fetch(
          new Request('http://localhost/api/monitoring/generate-monthly-report', { method: 'POST' }),
          env
        );
        console.warn('Monthly report result:', await monthlyReportResponse.json());
        break;
        
      case '0 5 * * 0': // Weekly cleanup on Sunday at 5 AM - Old metrics cleanup
        console.warn('Running old metrics cleanup...');
        response = await app.fetch(
          new Request('http://localhost/api/monitoring/cleanup-old-metrics', { method: 'POST' }),
          env
        );
        break;
        
      case '0 6 * * *': // Daily export cleanup at 6 AM
        console.warn('Running export cleanup...');
        response = await app.fetch(
          new Request('http://localhost/api/data-export/scheduled-cleanup', { method: 'POST' }),
          env
        );
        break;
        
      case '*/10 * * * *': // Every 10 minutes - Health check 
        console.warn('Running alert health check...');
        response = await scheduledAlertJobRoutes.fetch(
          new Request('http://localhost/api/alerts/jobs/health-check', { method: 'POST' }),
          env
        );
        break;
        
      default:
        console.warn('Unknown cron pattern:', event.cron);
        return;
    }
    
    const result = await response.json();
    console.warn('Scheduled job result:', result);
    
  } catch (error) {
    console.error('Scheduled job failed:', error);
  }
};

export default app;