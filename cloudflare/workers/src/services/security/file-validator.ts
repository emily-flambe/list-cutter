
import { ThreatDetectionService } from './threat-detector';
import { PIIScannerService } from './pii-scanner';
import { 
  ThreatDetectionResult, 
  PIIDetectionResult, 
  ThreatSeverity, 
  ThreatRecommendation,
  ThreatDetectionConfig
} from '../../types/threat-intelligence';

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  scanContent?: boolean;
  checkMagicBytes?: boolean;
  enableThreatDetection?: boolean;
  enablePIIDetection?: boolean;
  threatScanTimeout?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    size: number;
    type: string;
    extension: string;
    magicBytes?: string;
    hash?: string;
  };
  securityScan?: {
    threats: string[];
    risk: 'low' | 'medium' | 'high';
  };
  threatDetection?: import('../../types/threat-intelligence').ThreatDetectionResult;
  piiDetection?: import('../../types/threat-intelligence').PIIDetectionResult;
  riskScore?: number;
  overallRisk?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  recommendation?: 'block' | 'quarantine' | 'sanitize' | 'warn' | 'allow' | 'manual_review';
}

export interface FileUploadLimits {
  maxFileSize: number;
  maxFilesPerHour: number;
  maxTotalSizePerHour: number;
}

import { SecurityAuditLogger } from './audit-logger.js';
import { SecurityEventType } from '../../types/security-events.js';

/**
 * Comprehensive file validation and security service
 * Implements multiple layers of security for file uploads
 */
export class FileValidationService {
  private db: D1Database;
  private auditLogger?: SecurityAuditLogger;
  private threatDetectionService: ThreatDetectionService;
  private piiScannerService: PIIScannerService;
  private defaultMaxSize = 50 * 1024 * 1024; // 50MB
  private allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/json'
  ];
  private allowedExtensions = ['.csv', '.txt', '.json'];

  // File signature magic bytes for type verification
  private magicBytes = new Map([
    ['csv', ['2C', '22', '0D0A', '0A']], // Common CSV patterns
    ['txt', ['54', '20', '0D0A', '0A']], // Text patterns
    ['json', ['7B', '5B']], // { or [
  ]);

  // Suspicious patterns to scan for
  private suspiciousPatterns = [
    /<script[\s\S]*?>/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<iframe[\s\S]*?>/i,
    /<embed[\s\S]*?>/i,
    /<object[\s\S]*?>/i,
    /eval\s*\(/i,
    /document\.write/i,
    /window\.location/i
  ];

  constructor(db: D1Database, threatDetectionConfig?: ThreatDetectionConfig, auditLogger?: SecurityAuditLogger) {
    this.db = db;
    this.auditLogger = auditLogger;
    
    // Initialize threat detection service with configuration
    const defaultThreatConfig: ThreatDetectionConfig = {
      enableMalwareDetection: true,
      enablePIIDetection: true,
      enableBehaviorAnalysis: true,
      enableRealTimeScanning: true,
      maxScanSize: 50 * 1024 * 1024, // 50MB
      scanTimeoutMs: 30000, // 30 seconds
      confidenceThreshold: 70,
      autoQuarantineThreshold: 85,
      enableNotifications: true,
      notificationSettings: {
        email: { enabled: false, recipients: [], template: '' },
        webhook: { enabled: false, url: '', headers: {} },
        dashboard: { enabled: true, realTimeUpdates: true }
      },
      complianceMode: 'balanced' as const
    };
    
    this.threatDetectionService = new ThreatDetectionService(
      db, 
      threatDetectionConfig || defaultThreatConfig
    );
    this.piiScannerService = new PIIScannerService(db);
  }

  /**
   * Validate a file upload comprehensively
   */
  async validateFile(
    file: File,
    userId: string,
    options: FileValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      maxSize = this.defaultMaxSize,
      allowedTypes = this.allowedMimeTypes,
      allowedExtensions = this.allowedExtensions,
      scanContent = true,
      checkMagicBytes = true,
      enableThreatDetection = true,
      enablePIIDetection = true,
      threatScanTimeout = 30000
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic file info
    const fileInfo = {
      size: file.size,
      type: file.type,
      extension: this.getFileExtension(file.name),
      magicBytes: undefined as string | undefined,
      hash: undefined as string | undefined
    };

    // Generate file hash for threat detection
    if (enableThreatDetection) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        fileInfo.hash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } catch (error) {
        warnings.push('Failed to generate file hash for threat detection');
      }
    }

    // Size validation
    if (file.size > maxSize) {
      errors.push(`File size ${this.formatSize(file.size)} exceeds maximum allowed size ${this.formatSize(maxSize)}`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // Type validation
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Extension validation
    if (!allowedExtensions.includes(fileInfo.extension.toLowerCase())) {
      errors.push(`File extension '${fileInfo.extension}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`);
    }

    // Filename validation
    const filenameValidation = this.validateFilename(file.name);
    if (!filenameValidation.valid) {
      errors.push(...filenameValidation.errors);
      warnings.push(...filenameValidation.warnings);
    }

    // Rate limiting check
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      errors.push(rateLimitCheck.reason || 'Rate limit exceeded');
      
      // Log rate limit violation
      if (this.auditLogger) {
        await this.auditLogger.logSecurityViolationEvent(
          SecurityEventType.RATE_LIMIT_EXCEEDED,
          {
            userId,
            violationType: 'file_upload_rate_limit',
            threshold: rateLimitCheck.threshold,
            actualValue: rateLimitCheck.actualValue,
            details: {
              fileName: file.name,
              fileSize: file.size,
              reason: rateLimitCheck.reason
            }
          }
        );
      }
    }

    // Content validation (if no critical errors so far)
    let securityScan: ValidationResult['securityScan'] | undefined;
    let threatDetection: ThreatDetectionResult | undefined;
    let piiDetection: PIIDetectionResult | undefined;
    let overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'info' | undefined;
    let riskScore: number | undefined;
    let recommendation: 'block' | 'quarantine' | 'sanitize' | 'warn' | 'allow' | 'manual_review' | undefined;

    if (errors.length === 0 && scanContent) {
      try {
        const contentValidation = await this.validateFileContent(file, {
          checkMagicBytes,
          scanForThreats: true
        });

        if (!contentValidation.valid) {
          errors.push(...contentValidation.errors);
          warnings.push(...contentValidation.warnings);
        }

        if (contentValidation.magicBytes) {
          fileInfo.magicBytes = contentValidation.magicBytes;
        }

        securityScan = contentValidation.securityScan;
      } catch (error) {
        warnings.push(`Content validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Advanced threat detection
      if (enableThreatDetection) {
        try {
          const fileId = crypto.randomUUID();
          threatDetection = await this.threatDetectionService.scanFile(file, fileId, userId);
          
          // Convert threat severity to our format
          overallRisk = this.mapThreatSeverity(threatDetection.overallRisk);
          riskScore = threatDetection.riskScore;
          recommendation = this.mapThreatRecommendation(threatDetection.recommendation);

          // Add threat-based errors and warnings
          if (threatDetection.overallRisk === ThreatSeverity.CRITICAL) {
            errors.push('Critical security threat detected - file blocked');
            
            // Log critical threat detection
            if (this.auditLogger) {
              await this.auditLogger.logSecurityViolationEvent(
                SecurityEventType.MALICIOUS_FILE_DETECTED,
                {
                  userId,
                  violationType: 'malicious_file',
                  resourceId: file.name,
                  resourceType: 'file',
                  details: {
                    fileName: file.name,
                    fileSize: file.size,
                    threats: threatDetection.threats,
                    riskScore: threatDetection.riskScore
                  }
                }
              );
            }
          } else if (threatDetection.overallRisk === ThreatSeverity.HIGH) {
            errors.push('High-risk security threat detected - file rejected');
            
            // Log high-risk threat detection
            if (this.auditLogger) {
              await this.auditLogger.logSecurityViolationEvent(
                SecurityEventType.SUSPICIOUS_ACTIVITY,
                {
                  userId,
                  violationType: 'high_risk_file',
                  resourceId: file.name,
                  resourceType: 'file',
                  details: {
                    fileName: file.name,
                    fileSize: file.size,
                    threats: threatDetection.threats,
                    riskScore: threatDetection.riskScore
                  }
                }
              );
            }
          } else if (threatDetection.overallRisk === ThreatSeverity.MEDIUM) {
            warnings.push('Medium-risk security threat detected - review recommended');
          }

          if (threatDetection.threats.length > 0) {
            warnings.push(`${threatDetection.threats.length} security threat(s) detected`);
          }
        } catch (error) {
          warnings.push(`Advanced threat detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // PII detection
      if (enablePIIDetection) {
        try {
          const fileId = crypto.randomUUID();
          piiDetection = await this.piiScannerService.scanForPII(file, fileId, userId);
          
          // Add PII-based warnings and errors
          if (piiDetection.piiFindings.length > 0) {
            const criticalPII = piiDetection.piiFindings.filter(f => f.severity === 'critical');
            const highPII = piiDetection.piiFindings.filter(f => f.severity === 'high');
            
            if (criticalPII.length > 0) {
              errors.push(`Critical PII detected (${criticalPII.length} instances) - file blocked`);
            } else if (highPII.length > 0) {
              warnings.push(`High-risk PII detected (${highPII.length} instances) - data handling required`);
            } else {
              warnings.push(`PII detected (${piiDetection.piiFindings.length} instances) - review recommended`);
            }
          }

          // Add compliance warnings
          if (piiDetection.complianceFlags.length > 0) {
            warnings.push(`${piiDetection.complianceFlags.length} compliance flag(s) raised`);
          }
        } catch (error) {
          warnings.push(`PII detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // Log overall validation result
    if (this.auditLogger) {
      if (errors.length > 0) {
        await this.auditLogger.logSecurityEvent({
          type: SecurityEventType.FILE_VALIDATION_FAILED,
          userId,
          resourceType: 'file',
          resourceId: file.name,
          resourceName: file.name,
          message: `File validation failed: ${errors.join(', ')}`,
          details: {
            fileName: file.name,
            fileSize: file.size,
            errors,
            warnings,
            threatDetection: threatDetection ? {
              threats: threatDetection.threats,
              riskScore: threatDetection.riskScore,
              overallRisk: threatDetection.overallRisk
            } : undefined,
            piiDetection: piiDetection ? {
              piiCount: piiDetection.piiFindings.length,
              complianceFlags: piiDetection.complianceFlags
            } : undefined
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fileInfo,
      securityScan,
      threatDetection,
      piiDetection,
      riskScore,
      overallRisk,
      recommendation
    };
  }

  /**
   * Validate file content including magic bytes and threat scanning
   */
  private async validateFileContent(
    file: File,
    options: { checkMagicBytes: boolean; scanForThreats: boolean }
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    magicBytes?: string;
    securityScan?: ValidationResult['securityScan'];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let magicBytes: string | undefined;
    let securityScan: ValidationResult['securityScan'] | undefined;

    // Read file content (first few KB for analysis)
    const maxSampleSize = 8192; // 8KB should be enough for validation
    const arrayBuffer = await file.slice(0, maxSampleSize).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Magic bytes validation
    if (options.checkMagicBytes) {
      magicBytes = Array.from(uint8Array.slice(0, 16))
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join('');

      const isValidMagicBytes = this.validateMagicBytes(file.name, magicBytes);
      if (!isValidMagicBytes) {
        warnings.push('File content does not match expected format based on extension');
      }
    }

    // Content threat scanning
    if (options.scanForThreats) {
      securityScan = await this.scanForThreats(uint8Array);
      
      if (securityScan.risk === 'high') {
        errors.push('File contains high-risk content and cannot be uploaded');
      } else if (securityScan.risk === 'medium') {
        warnings.push('File contains potentially suspicious content');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      magicBytes,
      securityScan
    };
  }

  /**
   * Validate filename for security issues
   */
  private validateFilename(filename: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length check
    if (filename.length > 255) {
      errors.push('Filename is too long (maximum 255 characters)');
    }

    if (filename.length === 0) {
      errors.push('Filename cannot be empty');
    }

    // Character validation - check for invalid filename characters
    if (/[<>:"|?*]/.test(filename) || filename.charCodeAt(0) <= 31) {
      errors.push('Filename contains invalid characters');
    }

    // Path traversal check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename cannot contain path traversal sequences');
    }

    // Reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const baseName = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(baseName)) {
      errors.push('Filename uses a reserved system name');
    }

    // Hidden file check
    if (filename.startsWith('.')) {
      warnings.push('Hidden files may not be processed correctly');
    }

    // Unicode validation
    try {
      // Check for problematic Unicode characters
      const normalized = filename.normalize('NFC');
      if (normalized !== filename) {
        warnings.push('Filename contains non-normalized Unicode characters');
      }
    } catch {
      errors.push('Filename contains invalid Unicode characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate magic bytes against expected file type
   */
  private validateMagicBytes(filename: string, magicBytes: string): boolean {
    const extension = this.getFileExtension(filename).toLowerCase().substring(1);
    const expectedPatterns = this.magicBytes.get(extension);
    
    if (!expectedPatterns) {
      return true; // No validation rules for this type
    }

    return expectedPatterns.some(pattern => magicBytes.startsWith(pattern));
  }

  /**
   * Scan file content for security threats
   */
  private async scanForThreats(content: Uint8Array): Promise<{
    threats: string[];
    risk: 'low' | 'medium' | 'high';
  }> {
    const threats: string[] = [];
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    
    try {
      // Convert to text for pattern matching
      const textContent = textDecoder.decode(content);
      
      // Scan for suspicious patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(textContent)) {
          threats.push(`Suspicious pattern detected: ${pattern.source}`);
        }
      }

      // Check for embedded files or suspicious binary content
      if (this.containsBinaryExecutable(content)) {
        threats.push('File may contain embedded executable content');
      }

      // Check for excessive special characters (possible obfuscation)
      const specialCharRatio = this.calculateSpecialCharRatio(textContent);
      if (specialCharRatio > 0.3) {
        threats.push('High ratio of special characters detected (possible obfuscation)');
      }

      // Determine risk level
      let risk: 'low' | 'medium' | 'high' = 'low';
      if (threats.length > 0) {
        const highRiskPatterns = ['script', 'executable', 'obfuscation'];
        const hasHighRisk = threats.some(threat => 
          highRiskPatterns.some(pattern => threat.toLowerCase().includes(pattern))
        );
        
        risk = hasHighRisk ? 'high' : 'medium';
      }

      return { threats, risk };
    } catch {
      // If we can't decode the content, treat it as suspicious
      return {
        threats: ['Unable to decode file content'],
        risk: 'medium'
      };
    }
  }

  /**
   * Check if content contains binary executable signatures
   */
  private containsBinaryExecutable(content: Uint8Array): boolean {
    const executableSignatures = [
      [0x4D, 0x5A], // PE executable (MZ)
      [0x7F, 0x45, 0x4C, 0x46], // ELF executable
      [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O executable
      [0x50, 0x4B, 0x03, 0x04], // ZIP (could contain executables)
    ];

    for (const signature of executableSignatures) {
      if (content.length >= signature.length) {
        let matches = true;
        for (let i = 0; i < signature.length; i++) {
          if (content[i] !== signature[i]) {
            matches = false;
            break;
          }
        }
        if (matches) return true;
      }
    }

    return false;
  }

  /**
   * Calculate ratio of special characters to total characters
   */
  private calculateSpecialCharRatio(text: string): number {
    const specialCharCount = (text.match(/[^\w\s.,;:!?\-'"]/g) || []).length;
    return text.length > 0 ? specialCharCount / text.length : 0;
  }

  /**
   * Check rate limiting for user uploads
   */
  private async checkRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get user's uploads in the last hour
    const recentUploads = await this.db
      .prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as total_size
        FROM files 
        WHERE user_id = ? AND created_at > ?
      `)
      .bind(userId, oneHourAgo.toISOString())
      .first();

    const uploadCount = recentUploads?.count as number || 0;
    const totalSize = recentUploads?.total_size as number || 0;

    // Default limits (these could be made configurable per user)
    const limits: FileUploadLimits = {
      maxFileSize: this.defaultMaxSize,
      maxFilesPerHour: 100,
      maxTotalSizePerHour: 500 * 1024 * 1024 // 500MB
    };

    if (uploadCount >= limits.maxFilesPerHour) {
      return {
        allowed: false,
        reason: `Upload limit exceeded: ${uploadCount}/${limits.maxFilesPerHour} files per hour`
      };
    }

    if (totalSize >= limits.maxTotalSizePerHour) {
      return {
        allowed: false,
        reason: `Size limit exceeded: ${this.formatSize(totalSize)}/${this.formatSize(limits.maxTotalSizePerHour)} per hour`
      };
    }

    return { allowed: true };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot) : '';
  }

  /**
   * Format file size for human reading
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Sanitize filename for safe storage
   */
  sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    let sanitized = filename
      .replace(/[<>:"|?*]/g, '_')
      .split('')
      .map(char => char.charCodeAt(0) <= 31 ? '_' : char)
      .join('')
      .replace(/\.\./g, '_')
      .replace(/[/\\]/g, '_');

    // Ensure it doesn't start with a dot
    if (sanitized.startsWith('.')) {
      sanitized = '_' + sanitized.substring(1);
    }

    // Limit length
    if (sanitized.length > 255) {
      const extension = this.getFileExtension(sanitized);
      const baseName = sanitized.substring(0, 255 - extension.length);
      sanitized = baseName + extension;
    }

    return sanitized;
  }

  /**
   * Generate secure file ID
   */
  generateSecureFileId(): string {
    // Use crypto.randomUUID() for cryptographically secure random ID
    return crypto.randomUUID();
  }

  /**
   * Map threat severity to validation result format
   */
  private mapThreatSeverity(severity: ThreatSeverity): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (severity) {
      case ThreatSeverity.CRITICAL:
        return 'critical';
      case ThreatSeverity.HIGH:
        return 'high';
      case ThreatSeverity.MEDIUM:
        return 'medium';
      case ThreatSeverity.LOW:
        return 'low';
      case ThreatSeverity.INFO:
        return 'info';
      default:
        return 'low';
    }
  }

  /**
   * Map threat recommendation to validation result format
   */
  private mapThreatRecommendation(recommendation: ThreatRecommendation): 'block' | 'quarantine' | 'sanitize' | 'warn' | 'allow' | 'manual_review' {
    switch (recommendation) {
      case ThreatRecommendation.BLOCK:
        return 'block';
      case ThreatRecommendation.QUARANTINE:
        return 'quarantine';
      case ThreatRecommendation.SANITIZE:
        return 'sanitize';
      case ThreatRecommendation.WARN:
        return 'warn';
      case ThreatRecommendation.ALLOW:
        return 'allow';
      case ThreatRecommendation.MANUAL_REVIEW:
        return 'manual_review';
      default:
        return 'manual_review';
    }
  }

  /**
   * Get threat detection service instance
   */
  getThreatDetectionService(): ThreatDetectionService {
    return this.threatDetectionService;
  }

  /**
   * Get PII scanner service instance
   */
  getPIIScannerService(): PIIScannerService {
    return this.piiScannerService;
  }

  /**
   * Update threat detection configuration
   */
  async updateThreatDetectionConfig(config: Partial<ThreatDetectionConfig>): Promise<void> {
    // This would update the configuration for the threat detection service
    // Implementation depends on how configuration is managed
  }

  /**
   * Get comprehensive security report for a file
   */
  async getSecurityReport(
    file: File,
    fileId: string,
    userId?: string
  ): Promise<{
    validation: ValidationResult;
    detailedThreats: ThreatDetectionResult | null;
    detailedPII: PIIDetectionResult | null;
  }> {
    const validation = await this.validateFile(file, userId || 'system', {
      enableThreatDetection: true,
      enablePIIDetection: true,
      scanContent: true,
      checkMagicBytes: true
    });

    return {
      validation,
      detailedThreats: validation.threatDetection || null,
      detailedPII: validation.piiDetection || null
    };
  }
}