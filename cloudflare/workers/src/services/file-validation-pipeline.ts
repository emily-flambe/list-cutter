import { SecurityManager } from './security/security-manager';
import { ComplianceManager } from './security/compliance-manager';
import { ThreatDetectionService } from './security/threat-detector';
import { PIIScannerService } from './security/pii-scanner';
import { QuotaManager } from './security/quota-manager';
import { AccessControlService } from './security/access-control';
import { SecurityEventLogger } from './security-event-logger';
import { ThreatResponseService } from './security/threat-response';
import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  SecurityEventCategory, 
  RiskLevel 
} from '../types/security-events';
import { 
  ThreatDetectionResponse, 
  ThreatSeverity,
  ValidationResult 
} from '../types/threat-intelligence';
import { QuotaOperationType } from '../types/quota';

export interface FileValidationRequest {
  file: File;
  userId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  metadata?: Record<string, string>;
  tags?: string[];
  validationLevel?: 'basic' | 'standard' | 'comprehensive' | 'strict';
  complianceMode?: 'permissive' | 'balanced' | 'strict';
  scanOptions?: {
    enableMalwareDetection?: boolean;
    enablePIIDetection?: boolean;
    enableContentValidation?: boolean;
    enableHeaderValidation?: boolean;
    enableVirusScanning?: boolean;
    scanTimeout?: number;
  };
}

export interface FileValidationResponse {
  isValid: boolean;
  riskScore: number;
  validationLevel: string;
  
  // Basic validation results
  basicValidation: {
    fileSizeValid: boolean;
    contentTypeValid: boolean;
    extensionValid: boolean;
    headerValid: boolean;
  };
  
  // Security scan results
  securityScan: {
    malwareDetected: boolean;
    threatsFound: number;
    riskLevel: ThreatSeverity;
    scanDuration: number;
    engineVersion: string;
  };
  
  // PII detection results
  piiDetection: {
    piiFound: boolean;
    piiTypes: string[];
    confidenceLevel: number;
    recommendations: string[];
  };
  
  // Compliance validation
  compliance: {
    isCompliant: boolean;
    violations: string[];
    requirements: string[];
    recommendations: string[];
  };
  
  // Quota validation
  quota: {
    withinLimits: boolean;
    currentUsage: number;
    limit: number;
    percentUsed: number;
  };
  
  // Access control validation
  accessControl: {
    hasPermission: boolean;
    effectiveRole: string;
    requiredRole: string;
  };
  
  // Final recommendation
  recommendation: 'allow' | 'warn' | 'block' | 'quarantine' | 'manual_review';
  warnings: string[];
  errors: string[];
  
  // Response actions taken
  responseActions: Array<{
    action: string;
    reason: string;
    timestamp: Date;
    success: boolean;
  }>;
  
  // Validation metadata
  validationId: string;
  timestamp: Date;
  validationDuration: number;
}

export interface ValidationContext {
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  region?: string;
  sessionId?: string;
  authMethod?: string;
}

export class FileValidationPipeline {
  private securityManager: SecurityManager;
  private complianceManager: ComplianceManager;
  private threatDetection: ThreatDetectionService;
  private piiScanner: PIIScannerService;
  private quotaManager: QuotaManager;
  private accessControl: AccessControlService;
  private securityEventLogger: SecurityEventLogger;
  private threatResponse: ThreatResponseService;

  constructor(
    securityManager: SecurityManager,
    complianceManager: ComplianceManager,
    threatDetection: ThreatDetectionService,
    piiScanner: PIIScannerService,
    quotaManager: QuotaManager,
    accessControl: AccessControlService,
    securityEventLogger: SecurityEventLogger,
    threatResponse: ThreatResponseService
  ) {
    this.securityManager = securityManager;
    this.complianceManager = complianceManager;
    this.threatDetection = threatDetection;
    this.piiScanner = piiScanner;
    this.quotaManager = quotaManager;
    this.accessControl = accessControl;
    this.securityEventLogger = securityEventLogger;
    this.threatResponse = threatResponse;
  }

  /**
   * Execute comprehensive file validation pipeline
   */
  async validateFile(
    request: FileValidationRequest,
    context: ValidationContext = {}
  ): Promise<FileValidationResponse> {
    const validationId = crypto.randomUUID();
    const startTime = Date.now();

    // Initialize response structure
    const response: FileValidationResponse = {
      isValid: true,
      riskScore: 0,
      validationLevel: request.validationLevel || 'standard',
      basicValidation: {
        fileSizeValid: false,
        contentTypeValid: false,
        extensionValid: false,
        headerValid: false
      },
      securityScan: {
        malwareDetected: false,
        threatsFound: 0,
        riskLevel: ThreatSeverity.INFO,
        scanDuration: 0,
        engineVersion: '1.0.0'
      },
      piiDetection: {
        piiFound: false,
        piiTypes: [],
        confidenceLevel: 0,
        recommendations: []
      },
      compliance: {
        isCompliant: true,
        violations: [],
        requirements: [],
        recommendations: []
      },
      quota: {
        withinLimits: true,
        currentUsage: 0,
        limit: 0,
        percentUsed: 0
      },
      accessControl: {
        hasPermission: true,
        effectiveRole: 'none',
        requiredRole: 'viewer'
      },
      recommendation: 'allow',
      warnings: [],
      errors: [],
      responseActions: [],
      validationId,
      timestamp: new Date(),
      validationDuration: 0
    };

    try {
      // Log validation start
      await this.logValidationEvent(validationId, 'validation_started', request, context);

      // Phase 1: Basic validation
      await this.performBasicValidation(request, response, context);

      // Phase 2: Access control validation
      await this.performAccessControlValidation(request, response, context);

      // Phase 3: Quota validation
      await this.performQuotaValidation(request, response, context);

      // Phase 4: Security scanning (if enabled and basic validation passed)
      if (response.basicValidation.fileSizeValid && response.basicValidation.contentTypeValid) {
        await this.performSecurityScanning(request, response, context);
      }

      // Phase 5: PII detection (if enabled)
      if (request.scanOptions?.enablePIIDetection !== false) {
        await this.performPIIDetection(request, response, context);
      }

      // Phase 6: Compliance validation
      await this.performComplianceValidation(request, response, context);

      // Phase 7: Generate final recommendation
      this.generateFinalRecommendation(response);

      // Phase 8: Execute automated responses
      await this.executeAutomatedResponses(request, response, context);

      // Calculate final validation duration
      response.validationDuration = Date.now() - startTime;

      // Log validation completion
      await this.logValidationEvent(validationId, 'validation_completed', request, context, response);

      return response;

    } catch (error) {
      // Handle validation failure
      response.isValid = false;
      response.recommendation = 'manual_review';
      response.errors.push(error instanceof Error ? error.message : 'Unknown validation error');
      response.validationDuration = Date.now() - startTime;

      // Log validation failure
      await this.logValidationEvent(validationId, 'validation_failed', request, context, response, error);

      return response;
    }
  }

  /**
   * Phase 1: Basic file validation
   */
  private async performBasicValidation(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      // Validate file size
      const maxFileSize = this.getMaxFileSize(request.validationLevel || 'standard');
      response.basicValidation.fileSizeValid = request.fileSize <= maxFileSize;
      
      if (!response.basicValidation.fileSizeValid) {
        response.errors.push(`File size ${request.fileSize} exceeds maximum allowed size ${maxFileSize}`);
        response.riskScore += 3;
      }

      // Validate content type
      response.basicValidation.contentTypeValid = this.isAllowedContentType(
        request.contentType,
        request.validationLevel || 'standard'
      );
      
      if (!response.basicValidation.contentTypeValid) {
        response.errors.push(`Content type '${request.contentType}' is not allowed`);
        response.riskScore += 2;
      }

      // Validate file extension
      const extension = this.extractFileExtension(request.fileName);
      response.basicValidation.extensionValid = this.isAllowedExtension(
        extension,
        request.validationLevel || 'standard'
      );
      
      if (!response.basicValidation.extensionValid) {
        response.warnings.push(`File extension '${extension}' requires additional validation`);
        response.riskScore += 1;
      }

      // Validate file header (magic bytes)
      if (request.scanOptions?.enableHeaderValidation !== false) {
        response.basicValidation.headerValid = await this.validateFileHeader(request.file);
        
        if (!response.basicValidation.headerValid) {
          response.warnings.push('File header does not match file extension');
          response.riskScore += 2;
        }
      } else {
        response.basicValidation.headerValid = true;
      }

      // Update overall validity
      response.isValid = response.isValid && 
        response.basicValidation.fileSizeValid && 
        response.basicValidation.contentTypeValid;

    } catch (error) {
      response.errors.push(`Basic validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      response.riskScore += 5;
    }
  }

  /**
   * Phase 2: Access control validation
   */
  private async performAccessControlValidation(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      // Check upload permission
      const hasUploadPermission = await this.accessControl.checkPermission(
        request.userId,
        'file_upload',
        { metadata: request.metadata }
      );

      response.accessControl.hasPermission = hasUploadPermission;
      response.accessControl.effectiveRole = hasUploadPermission ? 'uploader' : 'none';
      response.accessControl.requiredRole = 'uploader';

      if (!hasUploadPermission) {
        response.errors.push('User does not have permission to upload files');
        response.riskScore += 5;
        response.isValid = false;
      }

    } catch (error) {
      response.errors.push(`Access control validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      response.riskScore += 3;
    }
  }

  /**
   * Phase 3: Quota validation
   */
  private async performQuotaValidation(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      // Check quota limits
      const quotaCheck = await this.quotaManager.checkQuota({
        userId: request.userId,
        operationType: QuotaOperationType.UPLOAD,
        resourceSize: request.fileSize,
        ignoreOverage: false
      });

      response.quota.withinLimits = quotaCheck.isAllowed;
      response.quota.currentUsage = quotaCheck.currentUsage;
      response.quota.limit = quotaCheck.limit;
      response.quota.percentUsed = quotaCheck.limit > 0 ? (quotaCheck.currentUsage / quotaCheck.limit) * 100 : 0;

      if (!quotaCheck.isAllowed) {
        response.errors.push(quotaCheck.errorMessage || 'Upload quota exceeded');
        response.riskScore += 4;
        response.isValid = false;
      } else if (response.quota.percentUsed > 80) {
        response.warnings.push('Approaching quota limit');
        response.riskScore += 1;
      }

    } catch (error) {
      response.errors.push(`Quota validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      response.riskScore += 2;
    }
  }

  /**
   * Phase 4: Security scanning
   */
  private async performSecurityScanning(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      const scanStartTime = Date.now();

      // Perform comprehensive security scan
      const scanResult = await this.securityManager.scanFile(
        request.file,
        request.userId,
        context.ipAddress,
        context.userAgent
      );

      response.securityScan.malwareDetected = !scanResult.success;
      response.securityScan.threatsFound = scanResult.results.threats.length;
      response.securityScan.riskLevel = scanResult.results.overallRisk;
      response.securityScan.scanDuration = Date.now() - scanStartTime;
      response.securityScan.engineVersion = scanResult.results.engineVersion;

      if (!scanResult.success) {
        response.errors.push('Security threats detected in file');
        response.riskScore += 8;
        response.isValid = false;

        // Add threat-specific information
        for (const threat of scanResult.results.threats) {
          response.errors.push(`Threat detected: ${threat.type} (confidence: ${threat.confidence}%)`);
        }
      }

      // Add response actions to overall response
      for (const action of scanResult.responseActions) {
        response.responseActions.push({
          action: action.action,
          reason: action.reason,
          timestamp: new Date(),
          success: action.success
        });
      }

    } catch (error) {
      response.warnings.push(`Security scanning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      response.riskScore += 3;
    }
  }

  /**
   * Phase 5: PII detection
   */
  private async performPIIDetection(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      // Perform PII scanning
      const piiResult = await this.piiScanner.scanFile(request.file);

      response.piiDetection.piiFound = piiResult.piiFindings.length > 0;
      response.piiDetection.piiTypes = piiResult.piiFindings.map(finding => finding.type);
      response.piiDetection.confidenceLevel = piiResult.overallConfidence;
      response.piiDetection.recommendations = piiResult.recommendations;

      if (response.piiDetection.piiFound) {
        const highConfidencePII = piiResult.piiFindings.filter(finding => finding.confidence > 0.8);
        
        if (highConfidencePII.length > 0) {
          response.warnings.push(`High-confidence PII detected: ${highConfidencePII.map(p => p.type).join(', ')}`);
          response.riskScore += 3;
        } else {
          response.warnings.push(`Potential PII detected: ${response.piiDetection.piiTypes.join(', ')}`);
          response.riskScore += 1;
        }
      }

    } catch (error) {
      response.warnings.push(`PII detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      response.riskScore += 1;
    }
  }

  /**
   * Phase 6: Compliance validation
   */
  private async performComplianceValidation(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      // Perform compliance checking
      const complianceResult = await this.complianceManager.checkFileCompliance(
        {
          fileId: crypto.randomUUID(), // Temporary ID for validation
          userId: request.userId,
          fileName: request.fileName,
          contentType: request.contentType,
          fileSize: request.fileSize,
          tags: request.tags,
          piiTypes: response.piiDetection.piiTypes
        },
        request.complianceMode || 'balanced'
      );

      response.compliance.isCompliant = complianceResult.isCompliant;
      response.compliance.violations = complianceResult.violations;
      response.compliance.requirements = complianceResult.requirements || [];
      response.compliance.recommendations = complianceResult.recommendations;

      if (!complianceResult.isCompliant) {
        // Check for critical violations
        const criticalViolations = complianceResult.violations.filter(v => v.includes('critical') || v.includes('CRITICAL'));
        
        if (criticalViolations.length > 0) {
          response.errors.push(`Critical compliance violations: ${criticalViolations.join(', ')}`);
          response.riskScore += 6;
          response.isValid = false;
        } else {
          response.warnings.push(`Compliance violations: ${complianceResult.violations.join(', ')}`);
          response.riskScore += 2;
        }
      }

    } catch (error) {
      response.warnings.push(`Compliance validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      response.riskScore += 2;
    }
  }

  /**
   * Generate final recommendation based on all validation results
   */
  private generateFinalRecommendation(response: FileValidationResponse): void {
    // Critical failures result in blocking
    if (!response.isValid || response.securityScan.malwareDetected) {
      response.recommendation = 'block';
      return;
    }

    // High risk score requires manual review
    if (response.riskScore >= 8) {
      response.recommendation = 'manual_review';
      return;
    }

    // Medium risk score with PII or compliance issues requires quarantine
    if (response.riskScore >= 5 && (response.piiDetection.piiFound || !response.compliance.isCompliant)) {
      response.recommendation = 'quarantine';
      return;
    }

    // Low to medium risk score with warnings
    if (response.riskScore >= 3 || response.warnings.length > 0) {
      response.recommendation = 'warn';
      return;
    }

    // All checks passed
    response.recommendation = 'allow';
  }

  /**
   * Execute automated responses based on validation results
   */
  private async executeAutomatedResponses(
    request: FileValidationRequest,
    response: FileValidationResponse,
    context: ValidationContext
  ): Promise<void> {
    try {
      if (response.recommendation === 'block' && response.securityScan.malwareDetected) {
        // Execute threat response
        const threatResponse = await this.threatResponse.processThreatDetection(
          {
            fileId: crypto.randomUUID(),
            fileName: request.fileName,
            threats: [], // Would be populated from security scan
            riskScore: response.riskScore,
            overallRisk: response.securityScan.riskLevel,
            scanDuration: response.securityScan.scanDuration,
            scanTimestamp: new Date(),
            scanEngine: 'ValidationPipeline',
            engineVersion: '1.0.0',
            recommendation: 'block'
          },
          request.file,
          request.userId,
          context.ipAddress
        );

        // Add threat response actions
        for (const action of threatResponse) {
          response.responseActions.push({
            action: action.action,
            reason: action.reason,
            timestamp: new Date(),
            success: action.success
          });
        }
      }

      if (response.recommendation === 'quarantine') {
        response.responseActions.push({
          action: 'quarantine',
          reason: 'File flagged for manual review due to risk factors',
          timestamp: new Date(),
          success: true
        });
      }

    } catch (error) {
      console.error('Failed to execute automated responses:', error);
    }
  }

  /**
   * Helper methods
   */
  private getMaxFileSize(validationLevel: string): number {
    switch (validationLevel) {
      case 'basic':
        return 50 * 1024 * 1024; // 50MB
      case 'standard':
        return 100 * 1024 * 1024; // 100MB
      case 'comprehensive':
        return 200 * 1024 * 1024; // 200MB
      case 'strict':
        return 10 * 1024 * 1024; // 10MB
      default:
        return 100 * 1024 * 1024; // 100MB
    }
  }

  private isAllowedContentType(contentType: string, validationLevel: string): boolean {
    const strictTypes = [
      'text/plain',
      'text/csv',
      'application/json',
      'application/pdf'
    ];

    const standardTypes = [
      ...strictTypes,
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const comprehensiveTypes = [
      ...standardTypes,
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'audio/mpeg',
      'application/xml'
    ];

    switch (validationLevel) {
      case 'strict':
        return strictTypes.some(type => contentType.includes(type));
      case 'standard':
        return standardTypes.some(type => contentType.includes(type));
      case 'comprehensive':
      case 'basic':
        return comprehensiveTypes.some(type => contentType.includes(type));
      default:
        return standardTypes.some(type => contentType.includes(type));
    }
  }

  private isAllowedExtension(extension: string, validationLevel: string): boolean {
    const strictExtensions = ['.txt', '.csv', '.json', '.pdf'];
    const standardExtensions = [...strictExtensions, '.jpg', '.jpeg', '.png', '.gif', '.zip', '.xlsx', '.xls'];
    const comprehensiveExtensions = [...standardExtensions, '.webp', '.svg', '.mp4', '.mp3', '.xml'];

    switch (validationLevel) {
      case 'strict':
        return strictExtensions.includes(extension.toLowerCase());
      case 'standard':
        return standardExtensions.includes(extension.toLowerCase());
      case 'comprehensive':
      case 'basic':
        return comprehensiveExtensions.includes(extension.toLowerCase());
      default:
        return standardExtensions.includes(extension.toLowerCase());
    }
  }

  private extractFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
  }

  private async validateFileHeader(file: File): Promise<boolean> {
    try {
      // Read first few bytes to check magic bytes
      const buffer = await file.slice(0, 16).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      // Basic header validation - this would be more comprehensive in production
      // PDF files start with %PDF
      if (file.type.includes('pdf')) {
        return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      }
      
      // JPEG files start with FF D8
      if (file.type.includes('jpeg') || file.type.includes('jpg')) {
        return bytes[0] === 0xFF && bytes[1] === 0xD8;
      }
      
      // PNG files start with 89 50 4E 47
      if (file.type.includes('png')) {
        return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      }
      
      // For other file types, assume valid for now
      return true;
      
    } catch (error) {
      console.error('File header validation failed:', error);
      return false;
    }
  }

  private async logValidationEvent(
    validationId: string,
    eventType: string,
    request: FileValidationRequest,
    context: ValidationContext,
    response?: FileValidationResponse,
    error?: unknown
  ): Promise<void> {
    try {
      await this.securityEventLogger.logSecurityEvent({
        id: crypto.randomUUID(),
        type: SecurityEventType.FILE_VALIDATION,
        severity: error ? SecurityEventSeverity.HIGH : SecurityEventSeverity.LOW,
        category: SecurityEventCategory.FILE_OPERATION,
        riskLevel: response ? (response.riskScore > 5 ? RiskLevel.HIGH : RiskLevel.LOW) : RiskLevel.MEDIUM,
        userId: request.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        timestamp: new Date(),
        message: `File validation ${eventType}`,
        details: {
          validationId,
          fileName: request.fileName,
          fileSize: request.fileSize,
          contentType: request.contentType,
          validationLevel: request.validationLevel,
          riskScore: response?.riskScore,
          recommendation: response?.recommendation,
          errors: response?.errors,
          warnings: response?.warnings,
          error: error instanceof Error ? error.message : undefined
        },
        requiresResponse: eventType === 'validation_failed' || (response?.recommendation === 'block'),
        source: 'file-validation-pipeline'
      });
    } catch (logError) {
      console.error('Failed to log validation event:', logError);
    }
  }
}