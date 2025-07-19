import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { SecureFileHandler } from '../handlers/secure-file-handler';
import { FileValidationPipeline } from '../services/file-validation-pipeline';
import { SecurityEventLogger } from '../services/security-event-logger';
import { securityMiddleware, ProductionSecurityMiddleware } from '../middleware/security-middleware';
import { SecurityManager } from '../services/security/security-manager';
import { AccessControlService } from '../services/security/access-control';
import { ComplianceManager } from '../services/security/compliance-manager';
import { QuotaManager } from '../services/security/quota-manager';
import { ThreatResponseService } from '../services/security/threat-response';
import { ThreatDetectionService } from '../services/security/threat-detector';
import { PIIScannerService } from '../services/security/pii-scanner';
import { SecurityAuditLogger } from '../services/security/audit-logger';
import { R2StorageService } from '../services/storage/r2-service';
import { SecureR2StorageService } from '../services/storage/secure-r2-service';
import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  SecurityEventCategory, 
  RiskLevel 
} from '../types/security-events';
import type { CloudflareEnv } from '../types/env';

type HonoContext = {
  Bindings: CloudflareEnv;
  Variables: {
    securityHandler?: SecureFileHandler;
    validationPipeline?: FileValidationPipeline;
    securityEventLogger?: SecurityEventLogger;
    userId?: string;
  };
};

const app = new Hono<HonoContext>();

// Global middleware
app.use('*', timing());
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://cutty.emilycogsdill.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

// Security middleware initialization
app.use('*', async (c, next) => {
  try {
    const env = c.env;
    
    // Initialize security services if not already done
    if (!c.get('securityHandler') && env.DB && env.FILE_STORAGE) {
      // Initialize core services
      const metricsService = new MetricsService(env.ANALYTICS, env.DB);
      const quotaManager = new QuotaManager(env.DB);
      const auditLogger = new SecurityAuditLogger(env.DB, env.ANALYTICS);
      const securityEventLogger = new SecurityEventLogger(env.DB, metricsService);
      
      // Initialize security services
      const accessControl = new AccessControlService(env.DB);
      const complianceManager = new ComplianceManager(env.DB);
      const threatDetection = new ThreatDetectionService(env.DB);
      const piiScanner = new PIIScannerService(env.DB);
      const threatResponse = new ThreatResponseService(env.DB, env.FILE_STORAGE);
      const securityManager = new SecurityManager(env.DB, env.FILE_STORAGE, env.ANALYTICS);
      
      // Initialize storage services
      const r2Storage = new R2StorageService(env.FILE_STORAGE, env.DB, metricsService, quotaManager, auditLogger);
      
      // Initialize secure file handler
      const secureHandler = new SecureFileHandler(
        r2Storage,
        securityManager,
        accessControl,
        securityEventLogger,
        complianceManager,
        quotaManager,
        metricsService,
        threatResponse
      );
      
      // Initialize validation pipeline
      const validationPipeline = new FileValidationPipeline(
        securityManager,
        complianceManager,
        threatDetection,
        piiScanner,
        quotaManager,
        accessControl,
        securityEventLogger,
        threatResponse
      );
      
      // Store services in context
      c.set('securityHandler', secureHandler);
      c.set('validationPipeline', validationPipeline);
      c.set('securityEventLogger', securityEventLogger);
      
      console.log('Security services initialized for file routes');
    }
    
    await next();
  } catch (error) {
    console.error('Failed to initialize security services:', error);
    return c.json({
      error: 'Security service initialization failed',
      message: 'Unable to process file operations at this time'
    }, 500);
  }
});

// Authentication middleware (placeholder)
app.use('/files/*', async (c, next) => {
  try {
    // Extract user ID from Authorization header
    const authHeader = c.req.header('Authorization');
    let userId = 'anonymous';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // TODO: Implement JWT token validation
      // For now, extract a placeholder user ID
      userId = 'authenticated_user';
    }
    
    c.set('userId', userId);
    await next();
  } catch (error) {
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

// Apply security middleware to all file operations
app.use('/files/*', securityMiddleware);

/**
 * Upload file endpoint with comprehensive security validation
 */
app.post('/files/upload', async (c) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    const securityHandler = c.get('securityHandler');
    const validationPipeline = c.get('validationPipeline');
    const securityEventLogger = c.get('securityEventLogger');
    const userId = c.get('userId') || 'anonymous';
    
    if (!securityHandler || !validationPipeline) {
      return c.json({ error: 'Security services not available' }, 503);
    }
    
    // Extract file from form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const tags = formData.get('tags') as string;
    const validationLevel = formData.get('validationLevel') as string || 'standard';
    const complianceMode = formData.get('complianceMode') as string || 'balanced';
    
    if (!file) {
      return c.json({
        error: 'No file provided',
        message: 'Please select a file to upload'
      }, 400);
    }
    
    // Phase 1: Pre-upload validation
    const validationResult = await validationPipeline.validateFile({
      file,
      userId,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      validationLevel: validationLevel as any,
      complianceMode: complianceMode as any,
      scanOptions: {
        enableMalwareDetection: true,
        enablePIIDetection: true,
        enableContentValidation: true,
        enableHeaderValidation: true,
        scanTimeout: 30000
      }
    }, {
      requestId,
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('CF-Connecting-IP'),
      region: c.req.header('CF-Region')
    });
    
    // Phase 2: Handle validation results
    if (validationResult.recommendation === 'block') {
      await securityEventLogger?.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_UPLOAD_BLOCKED,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.ACCESS_CONTROL,
        riskLevel: RiskLevel.HIGH,
        userId,
        ipAddress: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        timestamp: new Date(),
        message: 'File upload blocked due to security validation failure',
        details: {
          fileName: file.name,
          fileSize: file.size,
          riskScore: validationResult.riskScore,
          errors: validationResult.errors,
          validationId: validationResult.validationId
        },
        requiresResponse: false,
        actionTaken: 'upload_blocked'
      });
      
      return c.json({
        success: false,
        error: 'File upload blocked',
        message: 'File failed security validation',
        details: {
          riskScore: validationResult.riskScore,
          errors: validationResult.errors,
          validationId: validationResult.validationId
        }
      }, 403);
    }
    
    if (validationResult.recommendation === 'manual_review') {
      return c.json({
        success: false,
        error: 'Manual review required',
        message: 'File requires manual security review',
        details: {
          riskScore: validationResult.riskScore,
          warnings: validationResult.warnings,
          validationId: validationResult.validationId,
          reviewProcess: 'File has been flagged for manual review by security team'
        }
      }, 202);
    }
    
    // Phase 3: Proceed with secure upload
    const uploadResult = await securityHandler.handleFileUpload(c.req.raw, c);
    
    // Phase 4: Return response based on upload result
    if (!uploadResult.success) {
      return c.json({
        success: false,
        error: uploadResult.message,
        warnings: uploadResult.warnings,
        validationResult: {
          validationId: validationResult.validationId,
          riskScore: validationResult.riskScore,
          recommendation: validationResult.recommendation
        }
      }, 400);
    }
    
    // Success response
    return c.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileId: uploadResult.fileId,
        fileName: file.name,
        fileSize: uploadResult.size,
        uploadType: uploadResult.uploadType,
        etag: uploadResult.etag
      },
      security: {
        validationId: validationResult.validationId,
        riskScore: validationResult.riskScore,
        recommendation: validationResult.recommendation,
        scanResult: uploadResult.securityScanResult?.success,
        threatsDetected: uploadResult.securityScanResult?.results.threats.length || 0
      },
      warnings: validationResult.warnings.length > 0 ? validationResult.warnings : undefined,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    // Log upload error
    const securityEventLogger = c.get('securityEventLogger');
    await securityEventLogger?.logSecurityEvent({
      id: crypto.randomUUID(),
      type: SecurityEventType.FILE_UPLOAD_FAILED,
      severity: SecurityEventSeverity.HIGH,
      category: SecurityEventCategory.SYSTEM_FAILURE,
      riskLevel: RiskLevel.HIGH,
      userId: c.get('userId'),
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date(),
      message: 'File upload failed due to system error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        processingTime: Date.now() - startTime
      },
      requiresResponse: true,
      actionTaken: 'upload_failed'
    });
    
    return c.json({
      success: false,
      error: 'File upload failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      requestId
    }, 500);
  }
});

/**
 * Download file endpoint with access control
 */
app.get('/files/:fileId/download', async (c) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    const securityHandler = c.get('securityHandler');
    const securityEventLogger = c.get('securityEventLogger');
    const userId = c.get('userId') || 'anonymous';
    const fileId = c.req.param('fileId');
    
    if (!securityHandler) {
      return c.json({ error: 'Security services not available' }, 503);
    }
    
    if (!fileId) {
      return c.json({ error: 'File ID required' }, 400);
    }
    
    // Execute secure download
    const downloadResult = await securityHandler.handleFileDownload(c.req.raw, c);
    
    if (!downloadResult.success) {
      return c.json({
        success: false,
        error: downloadResult.message,
        errors: downloadResult.errors
      }, downloadResult.message.includes('Access denied') ? 403 : 404);
    }
    
    if (!downloadResult.fileObject) {
      return c.json({
        success: false,
        error: 'File not found'
      }, 404);
    }
    
    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', downloadResult.contentType || 'application/octet-stream');
    headers.set('Content-Length', downloadResult.fileSize?.toString() || '0');
    headers.set('Content-Disposition', `attachment; filename="${downloadResult.fileName || 'download'}"`);
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('X-File-Id', fileId);
    headers.set('X-Processing-Time', (Date.now() - startTime).toString());
    
    // Handle range requests
    const range = c.req.header('Range');
    if (range) {
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Range', `bytes 0-${(downloadResult.fileSize || 1) - 1}/${downloadResult.fileSize || 0}`);
      return new Response(downloadResult.fileObject.body, {
        status: 206,
        headers
      });
    }
    
    return new Response(downloadResult.fileObject.body, {
      status: 200,
      headers
    });
    
  } catch (error) {
    // Log download error
    const securityEventLogger = c.get('securityEventLogger');
    await securityEventLogger?.logSecurityEvent({
      id: crypto.randomUUID(),
      type: SecurityEventType.FILE_DOWNLOAD_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      category: SecurityEventCategory.SYSTEM_FAILURE,
      riskLevel: RiskLevel.MEDIUM,
      userId: c.get('userId'),
      fileId: c.req.param('fileId'),
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date(),
      message: 'File download failed due to system error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        processingTime: Date.now() - startTime
      },
      requiresResponse: false,
      actionTaken: 'download_failed'
    });
    
    return c.json({
      success: false,
      error: 'File download failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      requestId
    }, 500);
  }
});

/**
 * Delete file endpoint with access control
 */
app.delete('/files/:fileId', async (c) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    const securityHandler = c.get('securityHandler');
    const securityEventLogger = c.get('securityEventLogger');
    const userId = c.get('userId') || 'anonymous';
    const fileId = c.req.param('fileId');
    
    if (!securityHandler) {
      return c.json({ error: 'Security services not available' }, 503);
    }
    
    if (!fileId) {
      return c.json({ error: 'File ID required' }, 400);
    }
    
    // Execute secure deletion
    const deleteResult = await securityHandler.handleFileDelete(c.req.raw, c);
    
    if (!deleteResult.success) {
      return c.json({
        success: false,
        error: deleteResult.message
      }, deleteResult.message.includes('Access denied') ? 403 : 404);
    }
    
    return c.json({
      success: true,
      message: 'File deleted successfully',
      fileId,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    // Log deletion error
    const securityEventLogger = c.get('securityEventLogger');
    await securityEventLogger?.logSecurityEvent({
      id: crypto.randomUUID(),
      type: SecurityEventType.FILE_DELETE_FAILED,
      severity: SecurityEventSeverity.MEDIUM,
      category: SecurityEventCategory.SYSTEM_FAILURE,
      riskLevel: RiskLevel.MEDIUM,
      userId: c.get('userId'),
      fileId: c.req.param('fileId'),
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date(),
      message: 'File deletion failed due to system error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        processingTime: Date.now() - startTime
      },
      requiresResponse: false,
      actionTaken: 'delete_failed'
    });
    
    return c.json({
      success: false,
      error: 'File deletion failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      requestId
    }, 500);
  }
});

/**
 * List user files endpoint
 */
app.get('/files', async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const includeShared = c.req.query('includeShared') === 'true';
    
    // TODO: Implement secure file listing
    // For now, return placeholder
    return c.json({
      success: true,
      data: {
        files: [],
        total: 0,
        limit,
        offset
      },
      message: 'File listing not yet implemented'
    });
    
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to list files',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, 500);
  }
});

/**
 * Get file validation status
 */
app.get('/files/:fileId/validation', async (c) => {
  try {
    const userId = c.get('userId') || 'anonymous';
    const fileId = c.req.param('fileId');
    
    if (!fileId) {
      return c.json({ error: 'File ID required' }, 400);
    }
    
    // TODO: Implement validation status lookup
    return c.json({
      success: true,
      data: {
        fileId,
        validationStatus: 'completed',
        riskScore: 0,
        recommendation: 'allow',
        lastValidated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to get validation status',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, 500);
  }
});

/**
 * Health check endpoint for file services
 */
app.get('/files/health', async (c) => {
  try {
    const securityHandler = c.get('securityHandler');
    const validationPipeline = c.get('validationPipeline');
    
    return c.json({
      success: true,
      status: 'healthy',
      services: {
        securityHandler: !!securityHandler,
        validationPipeline: !!validationPipeline,
        database: !!c.env.DB,
        storage: !!c.env.FILE_STORAGE
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return c.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default app;