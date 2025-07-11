import { Context } from 'hono';
import { R2StorageService } from '../services/storage/r2-service';
import { SecurityManager } from '../services/security/security-manager';
import { ProductionSecurityMiddleware, SecurityValidationResult, FileMetadata } from '../middleware/security-middleware';
import { SecurityEventLogger } from '../services/security-event-logger';
import { MetricsService } from '../services/monitoring/metrics-service';
import { QuotaManager } from '../services/security/quota-manager';
import { AccessControlService } from '../services/security/access-control';
import { ComplianceManager } from '../services/security/compliance-manager';
import { ThreatResponseService } from '../services/security/threat-response';
import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  SecurityEventCategory, 
  RiskLevel 
} from '../types/security-events';
import { ThreatDetectionResponse } from '../types/threat-intelligence';
import { QuotaOperationType } from '../types/quota';
import type { CloudflareEnv } from '../types/env';

export interface FileUploadRequest {
  file: File;
  userId: string;
  fileName: string;
  contentType: string;
  metadata?: Record<string, string>;
  tags?: string[];
}

export interface FileDownloadRequest {
  fileId: string;
  userId: string;
  range?: string;
}

export interface FileUploadResponse {
  success: boolean;
  fileId?: string;
  r2Key?: string;
  etag?: string;
  size?: number;
  uploadType?: 'single' | 'multipart';
  securityScanResult?: ThreatDetectionResponse;
  message: string;
  warnings?: string[];
}

export interface FileDownloadResponse {
  success: boolean;
  fileObject?: R2ObjectBody;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  message: string;
  errors?: string[];
}

export class SecureFileHandler {
  private r2Storage: R2StorageService;
  private securityMiddleware: ProductionSecurityMiddleware;
  private securityEventLogger: SecurityEventLogger;
  private metricsService: MetricsService;
  private threatResponse: ThreatResponseService;

  constructor(
    r2Storage: R2StorageService,
    securityManager: SecurityManager,
    accessControl: AccessControlService,
    auditLogger: SecurityEventLogger,
    complianceManager: ComplianceManager,
    quotaManager: QuotaManager,
    metricsService: MetricsService,
    threatResponse: ThreatResponseService
  ) {
    this.r2Storage = r2Storage;
    this.securityEventLogger = auditLogger;
    this.metricsService = metricsService;
    this.threatResponse = threatResponse;
    
    // Initialize security middleware
    this.securityMiddleware = new ProductionSecurityMiddleware(
      securityManager,
      accessControl,
      auditLogger,
      complianceManager,
      quotaManager
    );
  }

  /**
   * Handle secure file upload with comprehensive security validation
   */
  async handleFileUpload(request: Request, context: Context): Promise<FileUploadResponse> {
    const startTime = Date.now();
    const uploadId = crypto.randomUUID();
    let fileId: string | undefined;
    let scanResult: ThreatDetectionResponse | undefined;

    try {
      // 1. Pre-upload security validation
      const validationResult = await this.securityMiddleware.validateFileUpload(request, context);
      
      if (!validationResult.isValid) {
        await this.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.FILE_UPLOAD_REJECTED,
          severity: SecurityEventSeverity.MEDIUM,
          category: SecurityEventCategory.ACCESS_CONTROL,
          riskLevel: RiskLevel.MEDIUM,
          userId: this.extractUserId(request),
          ipAddress: request.headers.get('CF-Connecting-IP'),
          userAgent: request.headers.get('User-Agent'),
          timestamp: new Date(),
          message: 'File upload rejected due to security validation failure',
          details: {
            violations: validationResult.violations,
            riskScore: validationResult.riskScore,
            recommendations: validationResult.recommendations
          },
          requiresResponse: false,
          actionTaken: 'upload_rejected'
        }, context);

        return {
          success: false,
          message: 'File upload rejected due to security validation failure',
          warnings: validationResult.violations.map(v => v.message)
        };
      }

      // 2. Extract file data from request
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const userId = this.extractUserId(request) || 'anonymous';
      
      if (!file) {
        return {
          success: false,
          message: 'No file provided in request'
        };
      }

      fileId = crypto.randomUUID();

      // 3. Prepare file metadata
      const metadata: FileMetadata = {
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        lastModified: new Date(file.lastModified),
        customMetadata: {
          uploadId,
          userId,
          originalName: file.name,
          uploadedAt: new Date().toISOString()
        }
      };

      // 4. Convert file to appropriate format for R2 storage
      const fileBuffer = await file.arrayBuffer();

      // 5. Upload file to R2 storage
      const uploadResult = await this.r2Storage.uploadFile(
        fileBuffer,
        {
          userId,
          fileId,
          fileName: file.name,
          contentType: file.type,
          metadata: metadata.customMetadata
        },
        {
          requestId: uploadId,
          userAgent: request.headers.get('User-Agent'),
          ipAddress: request.headers.get('CF-Connecting-IP'),
          region: request.headers.get('CF-Region')
        }
      );

      // 6. Post-upload security scanning
      scanResult = await this.securityMiddleware.scanUploadedFile(
        uploadResult.r2Key,
        metadata,
        context
      );

      // 7. Handle security scan results
      if (!scanResult.success) {
        await this.handleThreatDetection(uploadResult, scanResult, context);
        
        return {
          success: false,
          fileId: uploadResult.fileId,
          securityScanResult: scanResult,
          message: 'File upload completed but security scan failed',
          warnings: ['File has been quarantined for manual review']
        };
      }

      // 8. Log successful upload
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_UPLOADED,
        severity: SecurityEventSeverity.LOW,
        category: SecurityEventCategory.FILE_OPERATION,
        riskLevel: RiskLevel.LOW,
        userId,
        fileId: uploadResult.fileId,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        timestamp: new Date(),
        message: 'File uploaded successfully',
        details: {
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          uploadType: uploadResult.uploadType,
          scanResult: scanResult.results,
          duration: Date.now() - startTime
        },
        requiresResponse: false,
        actionTaken: 'upload_completed'
      }, context);

      // 9. Record upload metrics
      await this.recordUploadMetrics(uploadResult, scanResult, startTime);

      return {
        success: true,
        fileId: uploadResult.fileId,
        r2Key: uploadResult.r2Key,
        etag: uploadResult.etag,
        size: uploadResult.size,
        uploadType: uploadResult.uploadType,
        securityScanResult: scanResult,
        message: 'File uploaded and scanned successfully'
      };

    } catch (error) {
      // Log upload failure
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_UPLOAD_FAILED,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        userId: this.extractUserId(request),
        fileId,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        timestamp: new Date(),
        message: 'File upload failed due to system error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          uploadId,
          duration: Date.now() - startTime
        },
        requiresResponse: true,
        actionTaken: 'upload_failed'
      }, context);

      return {
        success: false,
        message: `File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle secure file download with access control
   */
  async handleFileDownload(request: Request, context: Context): Promise<FileDownloadResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Extract request parameters
      const { fileId, userId } = await this.extractDownloadContext(request, context);
      const range = request.headers.get('Range');

      if (!fileId || !userId) {
        return {
          success: false,
          message: 'Invalid file ID or user authentication required'
        };
      }

      // 2. Enforce access control
      const hasAccess = await this.securityMiddleware.enforceFileAccess(
        fileId,
        userId,
        'download',
        context
      );

      if (!hasAccess) {
        await this.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.FILE_ACCESS_DENIED,
          severity: SecurityEventSeverity.MEDIUM,
          category: SecurityEventCategory.ACCESS_CONTROL,
          riskLevel: RiskLevel.MEDIUM,
          userId,
          fileId,
          ipAddress: request.headers.get('CF-Connecting-IP'),
          userAgent: request.headers.get('User-Agent'),
          timestamp: new Date(),
          message: 'File download access denied',
          details: {
            requestedAction: 'download',
            reason: 'insufficient_permissions'
          },
          requiresResponse: false,
          actionTaken: 'access_denied'
        }, context);

        return {
          success: false,
          message: 'Access denied: insufficient permissions to download this file'
        };
      }

      // 3. Download file from R2
      const downloadOptions = range ? { range } : {};
      const fileObject = await this.r2Storage.downloadFile(
        fileId,
        userId,
        downloadOptions,
        {
          requestId: crypto.randomUUID(),
          userAgent: request.headers.get('User-Agent'),
          ipAddress: request.headers.get('CF-Connecting-IP'),
          region: request.headers.get('CF-Region')
        }
      );

      if (!fileObject) {
        return {
          success: false,
          message: 'File not found or access denied'
        };
      }

      // 4. Log successful download
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_DOWNLOADED,
        severity: SecurityEventSeverity.LOW,
        category: SecurityEventCategory.FILE_OPERATION,
        riskLevel: RiskLevel.LOW,
        userId,
        fileId,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        timestamp: new Date(),
        message: 'File downloaded successfully',
        details: {
          fileSize: fileObject.size,
          contentType: fileObject.httpMetadata?.contentType,
          rangeRequest: !!range,
          duration: Date.now() - startTime
        },
        requiresResponse: false,
        actionTaken: 'download_completed'
      }, context);

      // 5. Record download metrics
      await this.recordDownloadMetrics(fileObject, startTime);

      return {
        success: true,
        fileObject,
        fileName: fileObject.customMetadata?.originalName || 'download',
        contentType: fileObject.httpMetadata?.contentType,
        fileSize: fileObject.size,
        message: 'File downloaded successfully'
      };

    } catch (error) {
      // Log download failure
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_DOWNLOAD_FAILED,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        userId: this.extractUserId(request),
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        timestamp: new Date(),
        message: 'File download failed due to system error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        },
        requiresResponse: true,
        actionTaken: 'download_failed'
      }, context);

      return {
        success: false,
        message: `File download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Handle secure file deletion with security validation
   */
  async handleFileDelete(request: Request, context: Context): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    
    try {
      // 1. Extract request parameters
      const { fileId, userId } = await this.extractDeleteContext(request, context);

      if (!fileId || !userId) {
        return {
          success: false,
          message: 'Invalid file ID or user authentication required'
        };
      }

      // 2. Enforce access control for deletion
      const hasAccess = await this.securityMiddleware.enforceFileAccess(
        fileId,
        userId,
        'delete',
        context
      );

      if (!hasAccess) {
        await this.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.FILE_ACCESS_DENIED,
          severity: SecurityEventSeverity.MEDIUM,
          category: SecurityEventCategory.ACCESS_CONTROL,
          riskLevel: RiskLevel.MEDIUM,
          userId,
          fileId,
          ipAddress: request.headers.get('CF-Connecting-IP'),
          userAgent: request.headers.get('User-Agent'),
          timestamp: new Date(),
          message: 'File deletion access denied',
          details: {
            requestedAction: 'delete',
            reason: 'insufficient_permissions'
          },
          requiresResponse: false,
          actionTaken: 'access_denied'
        }, context);

        return {
          success: false,
          message: 'Access denied: insufficient permissions to delete this file'
        };
      }

      // 3. Delete file from R2
      const deleteResult = await this.r2Storage.deleteFile(
        fileId,
        userId,
        {
          requestId: crypto.randomUUID(),
          userAgent: request.headers.get('User-Agent'),
          ipAddress: request.headers.get('CF-Connecting-IP'),
          region: request.headers.get('CF-Region')
        }
      );

      if (!deleteResult) {
        return {
          success: false,
          message: 'File not found or already deleted'
        };
      }

      // 4. Log successful deletion
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_DELETED,
        severity: SecurityEventSeverity.LOW,
        category: SecurityEventCategory.FILE_OPERATION,
        riskLevel: RiskLevel.LOW,
        userId,
        fileId,
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        timestamp: new Date(),
        message: 'File deleted successfully',
        details: {
          duration: Date.now() - startTime
        },
        requiresResponse: false,
        actionTaken: 'delete_completed'
      }, context);

      return {
        success: true,
        message: 'File deleted successfully'
      };

    } catch (error) {
      // Log deletion failure
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_DELETE_FAILED,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        userId: this.extractUserId(request),
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
        timestamp: new Date(),
        message: 'File deletion failed due to system error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime
        },
        requiresResponse: true,
        actionTaken: 'delete_failed'
      }, context);

      return {
        success: false,
        message: `File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Private helper methods
   */
  private async handleThreatDetection(
    uploadResult: { fileId: string; r2Key: string },
    scanResult: ThreatDetectionResponse,
    context: Context
  ): Promise<void> {
    try {
      // Execute threat response actions
      for (const action of scanResult.responseActions) {
        await this.threatResponse.executeAction(
          action,
          uploadResult.fileId,
          scanResult.results
        );
      }

      // Log threat detection
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.THREAT_DETECTED,
        severity: SecurityEventSeverity.CRITICAL,
        category: SecurityEventCategory.MALWARE_DETECTION,
        riskLevel: RiskLevel.HIGH,
        fileId: uploadResult.fileId,
        timestamp: new Date(),
        message: 'Threat detected in uploaded file',
        details: {
          threats: scanResult.results.threats,
          riskScore: scanResult.results.riskScore,
          scanEngine: scanResult.results.scanEngine,
          responseActions: scanResult.responseActions.map(a => a.action)
        },
        requiresResponse: true,
        threatType: scanResult.results.overallRisk,
        actionTaken: 'quarantine'
      }, context);

    } catch (error) {
      console.error('Failed to handle threat detection:', error);
    }
  }

  private async logSecurityEvent(
    event: {
      id: string;
      type: SecurityEventType;
      severity: SecurityEventSeverity;
      category: SecurityEventCategory;
      riskLevel: RiskLevel;
      userId?: string;
      fileId?: string;
      ipAddress?: string;
      userAgent?: string;
      timestamp: Date;
      message: string;
      details?: Record<string, unknown>;
      requiresResponse: boolean;
      actionTaken?: string;
      threatType?: string;
    },
    context: Context
  ): Promise<void> {
    try {
      await this.securityEventLogger.logSecurityEvent({
        ...event,
        source: 'secure-file-handler'
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private extractUserId(request: Request): string | undefined {
    // Extract user ID from JWT token or session
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // TODO: Implement JWT token parsing
      return 'user_from_token';
    }
    return undefined;
  }

  private async extractDownloadContext(
    request: Request,
    context: Context
  ): Promise<{ fileId: string; userId: string }> {
    const fileId = context.req.param('fileId') || context.req.query('fileId');
    const userId = this.extractUserId(request) || context.get('userId');

    return {
      fileId: fileId || '',
      userId: userId || ''
    };
  }

  private async extractDeleteContext(
    request: Request,
    context: Context
  ): Promise<{ fileId: string; userId: string }> {
    const fileId = context.req.param('fileId') || context.req.query('fileId');
    const userId = this.extractUserId(request) || context.get('userId');

    return {
      fileId: fileId || '',
      userId: userId || ''
    };
  }

  private async recordUploadMetrics(
    uploadResult: { fileId: string; size: number; uploadType: string },
    scanResult: ThreatDetectionResponse,
    startTime: number
  ): Promise<void> {
    try {
      // Record upload metrics
      await this.metricsService.recordUploadMetrics({
        fileId: uploadResult.fileId,
        fileSize: uploadResult.size,
        uploadType: uploadResult.uploadType,
        scanDuration: scanResult.results.scanDuration,
        scanSuccess: scanResult.success,
        threatsDetected: scanResult.results.threats.length,
        totalDuration: Date.now() - startTime
      });
    } catch (error) {
      console.error('Failed to record upload metrics:', error);
    }
  }

  private async recordDownloadMetrics(
    fileObject: R2ObjectBody,
    startTime: number
  ): Promise<void> {
    try {
      // Record download metrics
      await this.metricsService.recordDownloadMetrics({
        fileSize: fileObject.size,
        contentType: fileObject.httpMetadata?.contentType,
        duration: Date.now() - startTime,
        success: true
      });
    } catch (error) {
      console.error('Failed to record download metrics:', error);
    }
  }
}