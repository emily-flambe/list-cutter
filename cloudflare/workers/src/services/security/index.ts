/**
 * Security Services Module
 * Advanced threat detection and response system for file uploads
 */

// Main services
export { FileValidationService } from './file-validator';
export { ThreatDetectionService } from './threat-detector';
export { PIIScannerService } from './pii-scanner';
export { ThreatResponseService } from './threat-response';
export { ThreatIntelligenceDatabaseService } from './threat-intelligence-db';
export { SecurityAuditService } from './security-audit';
export { SecurityManager } from './security-manager';
export { AuditLogger as SecurityAuditLogger } from './audit-logger';
export { IntegratedSecurityService } from './security-service';

// Type exports
export * from '../../types/threat-intelligence';

// Re-export validation types for backward compatibility
export type { 
  FileValidationOptions, 
  ValidationResult, 
  FileUploadLimits 
} from './file-validator';

// Security configuration interface
export interface SecurityConfig {
  enableMalwareDetection?: boolean;
  enablePIIDetection?: boolean;
  enableBehaviorAnalysis?: boolean;
  enableRealTimeScanning?: boolean;
  maxScanSize?: number;
  scanTimeoutMs?: number;
  quarantineEnabled?: boolean;
  alertThreshold?: number;
  [key: string]: unknown;
}

// Security services type
export interface SecurityServices {
  fileValidator: FileValidationService;
  threatDetector: ThreatDetectionService;
  piiScanner: PIIScannerService;
  threatResponse: ThreatResponseService;
  threatIntelligenceDb: ThreatIntelligenceDatabaseService;
  securityAudit: SecurityAuditService;
}

/**
 * Security System Factory
 * Creates and initializes a complete security system
 */
export class SecuritySystemFactory {
  /**
   * Create a fully configured security manager
   */
  static async createSecurityManager(
    db: D1Database,
    r2Bucket: R2Bucket,
    analytics?: AnalyticsEngineDataset,
    config?: SecurityConfig
  ): Promise<SecurityManager> {
    const securityManager = new SecurityManager(db, r2Bucket, analytics, config);
    await securityManager.initialize();
    return securityManager;
  }

  /**
   * Create individual security services
   */
  static createSecurityServices(
    db: D1Database,
    r2Bucket: R2Bucket,
    analytics?: AnalyticsEngineDataset,
    config?: SecurityConfig
  ): SecurityServices {
    const defaultConfig = {
      enableMalwareDetection: true,
      enablePIIDetection: true,
      enableBehaviorAnalysis: true,
      enableRealTimeScanning: true,
      maxScanSize: 50 * 1024 * 1024,
      scanTimeoutMs: 30000,
      confidenceThreshold: 70,
      autoQuarantineThreshold: 85,
      enableNotifications: true,
      notificationSettings: {
        email: { enabled: false, recipients: [], template: '' },
        webhook: { enabled: false, url: '', headers: {} },
        dashboard: { enabled: true, realTimeUpdates: true }
      },
      complianceMode: 'balanced' as const,
      ...config
    };

    return {
      fileValidator: new FileValidationService(db, defaultConfig),
      threatDetector: new ThreatDetectionService(db, defaultConfig),
      piiScanner: new PIIScannerService(db),
      threatResponse: new ThreatResponseService(db, r2Bucket, defaultConfig),
      threatIntelligenceDB: new ThreatIntelligenceDatabaseService(db),
      securityAudit: new SecurityAuditService(db, analytics)
    };
  }
}

/**
 * Default export - Security Manager for easy import
 */
export default SecurityManager;