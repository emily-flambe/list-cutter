import { Context, Next } from 'hono';
import { SecurityManager } from '../services/security/security-manager';
import { AccessControlService } from '../services/security/access-control';
import { SecurityAuditLogger } from '../services/security/audit-logger';
import { ComplianceManager } from '../services/security/compliance-manager';
import { QuotaManager } from '../services/security/quota-manager';
import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  SecurityEventCategory, 
  RiskLevel 
} from '../types/security-events';
import { 
  ThreatDetectionResponse, 
  ThreatSeverity 
} from '../types/threat-intelligence';
import { QuotaOperationType } from '../types/quota';
import type { CloudflareEnv } from '../types/env';

export interface SecurityValidationResult {
  isValid: boolean;
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: Record<string, unknown>;
  }>;
  recommendations: string[];
  riskScore: number;
  allowedActions: string[];
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  contentType: string;
  lastModified?: Date;
  customMetadata?: Record<string, string>;
}

export interface SecurityEvent {
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
  metadata?: Record<string, unknown>;
}

export interface SecurityMiddleware {
  // Pre-upload security validation
  validateFileUpload(request: Request, context: Context): Promise<SecurityValidationResult>;
  
  // Post-upload security scanning
  scanUploadedFile(fileKey: string, metadata: FileMetadata, context: Context): Promise<ThreatDetectionResponse>;
  
  // Access control enforcement
  enforceFileAccess(fileKey: string, userId: string, action: string, context: Context): Promise<boolean>;
  
  // Security event logging
  logSecurityEvent(event: SecurityEvent, context: Context): Promise<void>;
}

export class ProductionSecurityMiddleware implements SecurityMiddleware {
  private securityManager: SecurityManager;
  private accessControl: AccessControlService;
  private auditLogger: SecurityAuditLogger;
  private complianceManager: ComplianceManager;
  private quotaManager: QuotaManager;

  constructor(
    securityManager: SecurityManager,
    accessControl: AccessControlService,
    auditLogger: SecurityAuditLogger,
    complianceManager: ComplianceManager,
    quotaManager: QuotaManager
  ) {
    this.securityManager = securityManager;
    this.accessControl = accessControl;
    this.auditLogger = auditLogger;
    this.complianceManager = complianceManager;
    this.quotaManager = quotaManager;
  }

  async validateFileUpload(request: Request, context: Context): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      isValid: true,
      violations: [],
      recommendations: [],
      riskScore: 0,
      allowedActions: ['upload', 'scan']
    };

    try {
      // Extract request metadata
      const contentLength = request.headers.get('content-length');
      const contentType = request.headers.get('content-type');
      const userId = this.extractUserId(request);
      const ipAddress = request.headers.get('CF-Connecting-IP') || 'unknown';
      const userAgent = request.headers.get('User-Agent') || 'unknown';

      // 1. Basic request validation
      if (!contentLength || parseInt(contentLength) === 0) {
        result.isValid = false;
        result.violations.push({
          type: 'invalid_content_length',
          severity: 'high',
          message: 'Invalid or missing content length'
        });
        return result;
      }

      const fileSize = parseInt(contentLength);
      
      // 2. File size validation
      const maxFileSize = 100 * 1024 * 1024; // 100MB limit
      if (fileSize > maxFileSize) {
        result.isValid = false;
        result.violations.push({
          type: 'file_size_exceeded',
          severity: 'high',
          message: `File size ${fileSize} exceeds maximum allowed size of ${maxFileSize}`
        });
      }

      // 3. Content type validation
      if (!contentType || !this.isAllowedContentType(contentType)) {
        result.isValid = false;
        result.violations.push({
          type: 'invalid_content_type',
          severity: 'high',
          message: `Content type '${contentType}' is not allowed`
        });
      }

      // 4. User authentication validation
      if (!userId) {
        result.isValid = false;
        result.violations.push({
          type: 'authentication_required',
          severity: 'critical',
          message: 'User authentication required for file upload'
        });
        return result;
      }

      // 5. Quota validation
      const quotaCheck = await this.quotaManager.checkQuota({
        userId,
        operationType: QuotaOperationType.UPLOAD,
        resourceSize: fileSize,
        ignoreOverage: false
      });

      if (!quotaCheck.isAllowed) {
        result.isValid = false;
        result.violations.push({
          type: 'quota_exceeded',
          severity: 'high',
          message: quotaCheck.errorMessage || 'Upload quota exceeded'
        });
      }

      // 6. Access control validation
      const hasUploadPermission = await this.accessControl.checkPermission(
        userId,
        'file_upload',
        request
      );

      if (!hasUploadPermission) {
        result.isValid = false;
        result.violations.push({
          type: 'access_denied',
          severity: 'high',
          message: 'User does not have permission to upload files'
        });
      }

      // 7. Rate limiting validation
      const rateLimitCheck = await this.checkRateLimit(userId, 'upload');
      if (!rateLimitCheck.allowed) {
        result.isValid = false;
        result.violations.push({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          message: 'Upload rate limit exceeded'
        });
      }

      // 8. Security headers validation
      const securityHeaders = this.validateSecurityHeaders(request);
      if (!securityHeaders.valid) {
        result.violations.push({
          type: 'security_headers_invalid',
          severity: 'medium',
          message: 'Invalid or missing security headers',
          details: securityHeaders.violations
        });
      }

      // Calculate risk score
      result.riskScore = this.calculateRiskScore(result.violations);

      // Generate recommendations
      if (result.violations.length > 0) {
        result.recommendations = this.generateSecurityRecommendations(result.violations);
      }

      // Log validation event
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_UPLOAD_VALIDATION,
        severity: result.isValid ? SecurityEventSeverity.LOW : SecurityEventSeverity.MEDIUM,
        category: SecurityEventCategory.ACCESS_CONTROL,
        riskLevel: result.riskScore > 7 ? RiskLevel.HIGH : result.riskScore > 3 ? RiskLevel.MEDIUM : RiskLevel.LOW,
        userId,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        message: `File upload validation ${result.isValid ? 'passed' : 'failed'}`,
        details: {
          fileSize,
          contentType,
          violations: result.violations,
          riskScore: result.riskScore
        },
        requiresResponse: !result.isValid
      }, context);

      return result;

    } catch (error) {
      // Log error and return failure
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.SYSTEM_ERROR,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        timestamp: new Date(),
        message: 'File upload validation failed due to system error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        requiresResponse: true
      }, context);

      return {
        isValid: false,
        violations: [{
          type: 'system_error',
          severity: 'critical',
          message: 'Security validation failed due to system error'
        }],
        recommendations: ['Contact system administrator'],
        riskScore: 10,
        allowedActions: []
      };
    }
  }

  async scanUploadedFile(fileKey: string, metadata: FileMetadata, context: Context): Promise<ThreatDetectionResponse> {
    try {
      // Get file from R2 for scanning
      const env = context.env as CloudflareEnv;
      const fileObject = await env.FILE_STORAGE.get(fileKey);
      
      if (!fileObject) {
        throw new Error(`File not found: ${fileKey}`);
      }

      // Create File object for scanning
      const fileBuffer = await fileObject.arrayBuffer();
      const file = new File([fileBuffer], metadata.fileName, {
        type: metadata.contentType,
        lastModified: metadata.lastModified?.getTime() || Date.now()
      });

      // Perform comprehensive security scan
      const scanResult = await this.securityManager.scanFile(
        file,
        this.extractUserId(context.req.raw),
        context.req.header('CF-Connecting-IP'),
        context.req.header('User-Agent')
      );

      // Handle scan results
      if (!scanResult.success) {
        // Log critical security event
        await this.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.THREAT_DETECTED,
          severity: SecurityEventSeverity.CRITICAL,
          category: SecurityEventCategory.MALWARE_DETECTION,
          riskLevel: RiskLevel.HIGH,
          fileId: fileKey,
          timestamp: new Date(),
          message: 'Threat detected in uploaded file',
          details: {
            fileName: metadata.fileName,
            fileSize: metadata.fileSize,
            contentType: metadata.contentType,
            threats: scanResult.results.threats,
            riskScore: scanResult.results.riskScore
          },
          requiresResponse: true,
          threatType: scanResult.results.overallRisk,
          actionTaken: 'quarantine'
        }, context);

        // Execute threat response
        if (scanResult.responseActions.length > 0) {
          for (const action of scanResult.responseActions) {
            await this.logSecurityEvent({
              id: crypto.randomUUID(),
              type: SecurityEventType.AUTOMATED_RESPONSE,
              severity: SecurityEventSeverity.MEDIUM,
              category: SecurityEventCategory.INCIDENT_RESPONSE,
              riskLevel: RiskLevel.MEDIUM,
              fileId: fileKey,
              timestamp: new Date(),
              message: `Automated response executed: ${action.action}`,
              details: {
                responseType: action.action,
                reason: action.reason,
                responseData: action.responseData
              },
              requiresResponse: false,
              actionTaken: action.action
            }, context);
          }
        }
      }

      return scanResult;

    } catch (error) {
      // Log scan failure
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.SYSTEM_ERROR,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        fileId: fileKey,
        timestamp: new Date(),
        message: 'File security scan failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          fileName: metadata.fileName,
          fileSize: metadata.fileSize
        },
        requiresResponse: true
      }, context);

      // Return failure response
      return {
        success: false,
        fileId: fileKey,
        results: {
          fileId: fileKey,
          fileName: metadata.fileName,
          threats: [],
          riskScore: 0,
          overallRisk: ThreatSeverity.INFO,
          scanDuration: 0,
          scanTimestamp: new Date(),
          scanEngine: 'SecurityMiddleware',
          engineVersion: '1.0.0',
          recommendation: 'manual_review'
        },
        responseActions: [],
        message: `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
    }
  }

  async enforceFileAccess(fileKey: string, userId: string, action: string, context: Context): Promise<boolean> {
    try {
      // Check file-level permissions
      const hasFileAccess = await this.accessControl.checkFileAccess(
        userId,
        fileKey,
        action
      );

      if (!hasFileAccess) {
        await this.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.ACCESS_DENIED,
          severity: SecurityEventSeverity.MEDIUM,
          category: SecurityEventCategory.ACCESS_CONTROL,
          riskLevel: RiskLevel.MEDIUM,
          userId,
          fileId: fileKey,
          ipAddress: context.req.header('CF-Connecting-IP'),
          userAgent: context.req.header('User-Agent'),
          timestamp: new Date(),
          message: `File access denied: ${action}`,
          details: {
            requestedAction: action,
            reason: 'insufficient_permissions'
          },
          requiresResponse: false,
          actionTaken: 'access_denied'
        }, context);

        return false;
      }

      // Check compliance requirements
      const complianceCheck = await this.complianceManager.checkFileAccess(
        userId,
        fileKey,
        action
      );

      if (!complianceCheck.isCompliant) {
        await this.logSecurityEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.COMPLIANCE_VIOLATION,
          severity: SecurityEventSeverity.HIGH,
          category: SecurityEventCategory.COMPLIANCE,
          riskLevel: RiskLevel.HIGH,
          userId,
          fileId: fileKey,
          ipAddress: context.req.header('CF-Connecting-IP'),
          userAgent: context.req.header('User-Agent'),
          timestamp: new Date(),
          message: `File access denied: compliance violation`,
          details: {
            requestedAction: action,
            complianceViolations: complianceCheck.violations,
            reason: 'compliance_violation'
          },
          requiresResponse: true,
          actionTaken: 'access_denied'
        }, context);

        return false;
      }

      // Log successful access
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_ACCESS_GRANTED,
        severity: SecurityEventSeverity.LOW,
        category: SecurityEventCategory.ACCESS_CONTROL,
        riskLevel: RiskLevel.LOW,
        userId,
        fileId: fileKey,
        ipAddress: context.req.header('CF-Connecting-IP'),
        userAgent: context.req.header('User-Agent'),
        timestamp: new Date(),
        message: `File access granted: ${action}`,
        details: {
          requestedAction: action
        },
        requiresResponse: false,
        actionTaken: 'access_granted'
      }, context);

      return true;

    } catch (error) {
      // Log access check failure
      await this.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.SYSTEM_ERROR,
        severity: SecurityEventSeverity.HIGH,
        category: SecurityEventCategory.SYSTEM_FAILURE,
        riskLevel: RiskLevel.HIGH,
        userId,
        fileId: fileKey,
        timestamp: new Date(),
        message: 'File access check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestedAction: action
        },
        requiresResponse: true
      }, context);

      return false;
    }
  }

  async logSecurityEvent(event: SecurityEvent, context: Context): Promise<void> {
    try {
      await this.auditLogger.logSecurityEvent(event);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Helper methods
  private extractUserId(request: Request): string | undefined {
    // Extract user ID from JWT token or session
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // TODO: Implement JWT token parsing
      // For now, return a placeholder
      return 'user_from_token';
    }
    return undefined;
  }

  private isAllowedContentType(contentType: string): boolean {
    const allowedTypes = [
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    return allowedTypes.some(type => contentType.includes(type));
  }

  private async checkRateLimit(userId: string, action: string): Promise<{ allowed: boolean; reason?: string }> {
    // Implementation would check rate limits from database or cache
    // For now, return allowed
    return { allowed: true };
  }

  private validateSecurityHeaders(request: Request): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check required security headers
    if (!request.headers.get('X-Requested-With')) {
      violations.push('Missing X-Requested-With header');
    }

    if (!request.headers.get('Origin') && !request.headers.get('Referer')) {
      violations.push('Missing Origin or Referer header');
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  private calculateRiskScore(violations: SecurityValidationResult['violations']): number {
    let score = 0;
    
    for (const violation of violations) {
      switch (violation.severity) {
        case 'critical':
          score += 4;
          break;
        case 'high':
          score += 3;
          break;
        case 'medium':
          score += 2;
          break;
        case 'low':
          score += 1;
          break;
      }
    }

    return Math.min(score, 10); // Cap at 10
  }

  private generateSecurityRecommendations(violations: SecurityValidationResult['violations']): string[] {
    const recommendations: string[] = [];

    for (const violation of violations) {
      switch (violation.type) {
        case 'file_size_exceeded':
          recommendations.push('Reduce file size or use multipart upload');
          break;
        case 'invalid_content_type':
          recommendations.push('Use supported file types only');
          break;
        case 'authentication_required':
          recommendations.push('Provide valid authentication credentials');
          break;
        case 'quota_exceeded':
          recommendations.push('Upgrade account or reduce storage usage');
          break;
        case 'access_denied':
          recommendations.push('Contact administrator for access permissions');
          break;
        case 'rate_limit_exceeded':
          recommendations.push('Reduce upload frequency');
          break;
      }
    }

    return recommendations;
  }
}

/**
 * Hono middleware function for security validation
 */
export async function securityMiddleware(c: Context, next: Next) {
  try {
    const env = c.env as CloudflareEnv;
    
    // Initialize security services if not already done
    if (!c.get('securityMiddleware')) {
      // This would be initialized in the main app
      // For now, skip security validation
      console.warn('Security middleware not initialized, skipping validation');
      await next();
      return;
    }

    const middleware = c.get('securityMiddleware') as ProductionSecurityMiddleware;
    
    // Apply security validation for file operations
    const path = c.req.path;
    const method = c.req.method;

    if (path.includes('/files') && (method === 'POST' || method === 'PUT')) {
      // File upload validation
      const validationResult = await middleware.validateFileUpload(c.req.raw, c);
      
      if (!validationResult.isValid) {
        return c.json({
          error: 'Security validation failed',
          details: validationResult.violations,
          recommendations: validationResult.recommendations,
          riskScore: validationResult.riskScore
        }, 400);
      }
    }

    if (path.includes('/files') && method === 'GET') {
      // File download validation
      const fileId = c.req.param('fileId');
      const userId = c.get('userId') || 'anonymous';
      
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

    await next();
  } catch (error) {
    console.error('Security middleware error:', error);
    return c.json({
      error: 'Security validation failed',
      message: 'Internal security error'
    }, 500);
  }
}