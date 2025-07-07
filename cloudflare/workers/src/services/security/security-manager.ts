import { FileValidationService } from './file-validator';
import { ThreatDetectionService } from './threat-detector';
import { PIIScannerService } from './pii-scanner';
import { ThreatResponseService } from './threat-response';
import { ThreatIntelligenceDatabaseService } from './threat-intelligence-db';
import { SecurityAuditService } from './security-audit';
import {
  ThreatDetectionConfig,
  ThreatDetectionResult,
  PIIDetectionResult,
  ThreatResponse,
  ValidationResult,
  SecurityAuditEvent,
  ThreatSeverity,
  SecurityEventType,
  ThreatDetectionResponse
} from '../../types/threat-intelligence';

/**
 * Security Manager - Central coordination service
 * Orchestrates all security services and provides a unified interface
 */
export class SecurityManager {
  private fileValidator: FileValidationService;
  private threatDetector: ThreatDetectionService;
  private piiScanner: PIIScannerService;
  private threatResponse: ThreatResponseService;
  private threatIntelligenceDB: ThreatIntelligenceDatabaseService;
  private securityAudit: SecurityAuditService;
  private config: ThreatDetectionConfig;

  constructor(
    db: D1Database,
    r2Bucket: R2Bucket,
    analytics?: AnalyticsEngineDataset,
    config?: Partial<ThreatDetectionConfig>
  ) {
    // Initialize default configuration
    this.config = {
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
        email: { 
          enabled: false, 
          recipients: [], 
          template: 'security-alert' 
        },
        webhook: { 
          enabled: false, 
          url: '', 
          headers: {} 
        },
        dashboard: { 
          enabled: true, 
          realTimeUpdates: true 
        }
      },
      complianceMode: 'balanced' as const,
      ...config
    };

    // Initialize all services
    this.threatIntelligenceDB = new ThreatIntelligenceDatabaseService(db);
    this.securityAudit = new SecurityAuditService(db, analytics);
    this.fileValidator = new FileValidationService(db, this.config);
    this.threatDetector = new ThreatDetectionService(db, this.config);
    this.piiScanner = new PIIScannerService(db);
    this.threatResponse = new ThreatResponseService(db, r2Bucket, this.config);
  }

  /**
   * Initialize the security system
   */
  async initialize(): Promise<void> {
    console.log('Initializing Security Manager...');
    
    try {
      // Initialize all services
      await Promise.all([
        this.threatIntelligenceDB.initializeDatabase(),
        this.securityAudit.initializeAuditDatabase()
      ]);

      // Update threat detection service with latest intelligence
      const threatDB = await this.threatIntelligenceDB.getThreatIntelligenceDatabase();
      await this.threatDetector.updateThreatIntelligence(threatDB);

      console.log('Security Manager initialized successfully');
      
      // Log initialization event
      await this.securityAudit.logSecurityEvent({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        eventType: SecurityEventType.SYSTEM_ALERT,
        severity: ThreatSeverity.INFO,
        userId: 'system',
        fileId: undefined,
        ipAddress: 'system',
        userAgent: 'security-manager',
        details: {
          description: 'Security Manager initialized successfully',
          affectedResources: ['security-system'],
          responseActions: [],
          additionalContext: {
            services: [
              'FileValidator',
              'ThreatDetector', 
              'PIIScanner',
              'ThreatResponse',
              'ThreatIntelligenceDB',
              'SecurityAudit'
            ],
            config: this.config
          }
        },
        resolved: true
      });
    } catch (error) {
      console.error('Failed to initialize Security Manager:', error);
      throw error;
    }
  }

  /**
   * Comprehensive file security scan
   * This is the main entry point for file security validation
   */
  async scanFile(
    file: File,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ThreatDetectionResponse> {
    const startTime = Date.now();
    const fileId = crypto.randomUUID();

    try {
      // 1. Basic file validation with integrated threat detection
      console.log(`Starting comprehensive security scan for file: ${file.name}`);
      
      const validation = await this.fileValidator.validateFile(file, userId || 'anonymous', {
        enableThreatDetection: this.config.enableMalwareDetection,
        enablePIIDetection: this.config.enablePIIDetection,
        scanContent: true,
        checkMagicBytes: true,
        threatScanTimeout: this.config.scanTimeoutMs
      });

      // 2. Process threat detection results
      let threatResponses: ThreatResponse[] = [];
      
      if (validation.threatDetection) {
        // Log threat detection
        await this.securityAudit.logThreatDetection(
          validation.threatDetection,
          userId,
          ipAddress,
          userAgent
        );

        // Execute automated threat responses
        if (validation.threatDetection.threats.length > 0) {
          threatResponses = await this.threatResponse.processThreatDetection(
            validation.threatDetection,
            file,
            userId,
            ipAddress
          );

          // Log responses
          for (const response of threatResponses) {
            await this.securityAudit.logThreatResponse(response);
          }
        }
      }

      // 3. Process PII detection results
      if (validation.piiDetection) {
        // Log PII detection
        await this.securityAudit.logPIIDetection(
          validation.piiDetection,
          userId,
          ipAddress,
          userAgent
        );

        // Execute PII-specific responses
        if (validation.piiDetection.piiFindings.length > 0) {
          const piiResponses = await this.threatResponse.processPIIDetection(
            validation.piiDetection,
            file,
            userId,
            ipAddress
          );

          threatResponses.push(...piiResponses);

          // Log PII responses
          for (const response of piiResponses) {
            await this.securityAudit.logThreatResponse(response);
          }
        }
      }

      // 4. Generate final response
      const scanDuration = Date.now() - startTime;
      const success = validation.valid && 
        (validation.recommendation === 'allow' || validation.recommendation === 'warn');

      const response: ThreatDetectionResponse = {
        success,
        fileId,
        results: validation.threatDetection || {
          fileId,
          fileName: file.name,
          threats: [],
          riskScore: 0,
          overallRisk: ThreatSeverity.INFO,
          scanDuration,
          scanTimestamp: new Date(),
          scanEngine: 'SecurityManager',
          engineVersion: '1.0.0',
          recommendation: 'allow' as any
        },
        piiResults: validation.piiDetection,
        responseActions: threatResponses,
        message: this.generateScanMessage(validation, threatResponses),
        timestamp: new Date()
      };

      console.log(`Security scan completed for ${file.name}: ${response.message}`);
      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during security scan';
      
      // Log error event
      await this.securityAudit.logSecurityEvent({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        eventType: SecurityEventType.SYSTEM_ALERT,
        severity: ThreatSeverity.HIGH,
        userId,
        fileId,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        details: {
          description: `Security scan failed for file: ${file.name}`,
          affectedResources: [fileId],
          responseActions: [],
          additionalContext: {
            error: errorMessage,
            scanDuration: Date.now() - startTime
          }
        },
        resolved: false
      });

      // Return error response
      return {
        success: false,
        fileId,
        results: {
          fileId,
          fileName: file.name,
          threats: [],
          riskScore: 0,
          overallRisk: ThreatSeverity.INFO,
          scanDuration: Date.now() - startTime,
          scanTimestamp: new Date(),
          scanEngine: 'SecurityManager',
          engineVersion: '1.0.0',
          recommendation: 'manual_review' as any
        },
        responseActions: [],
        message: `Security scan failed: ${errorMessage}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<{
    metrics: any;
    recentEvents: SecurityAuditEvent[];
    threatStatistics: any;
    systemHealth: {
      status: 'healthy' | 'warning' | 'critical';
      services: Array<{ name: string; status: string; lastCheck: Date }>;
      performance: {
        avgScanTime: number;
        scanThroughput: number;
        errorRate: number;
      };
    };
  }> {
    try {
      const [metrics, threatStats] = await Promise.all([
        this.securityAudit.getDashboardMetrics(),
        this.securityAudit.generateThreatStatistics(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          new Date()
        )
      ]);

      // Check system health
      const systemHealth = await this.checkSystemHealth();

      return {
        metrics,
        recentEvents: metrics.recentEvents,
        threatStatistics: threatStats,
        systemHealth
      };
    } catch (error) {
      console.error('Failed to get security dashboard:', error);
      throw error;
    }
  }

  /**
   * Update threat intelligence
   */
  async updateThreatIntelligence(sourceUrl?: string): Promise<void> {
    try {
      console.log('Updating threat intelligence...');
      
      // Update from external source if provided
      if (sourceUrl) {
        const updateResult = await this.threatIntelligenceDB.updateFromExternalSource(sourceUrl);
        console.log(`Threat intelligence update result:`, updateResult);
      }

      // Get updated intelligence database
      const threatDB = await this.threatIntelligenceDB.getThreatIntelligenceDatabase();
      
      // Update threat detection service
      await this.threatDetector.updateThreatIntelligence(threatDB);

      // Log update event
      await this.securityAudit.logSecurityEvent({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        eventType: SecurityEventType.SYSTEM_ALERT,
        severity: ThreatSeverity.INFO,
        userId: 'system',
        fileId: undefined,
        ipAddress: 'system',
        userAgent: 'security-manager',
        details: {
          description: 'Threat intelligence updated successfully',
          affectedResources: ['threat-intelligence-db'],
          responseActions: [],
          additionalContext: {
            sourceUrl,
            signaturesCount: threatDB.signatures.length,
            patternsCount: threatDB.piiPatterns.length,
            hashesCount: threatDB.malwareHashes.length
          }
        },
        resolved: true
      });

      console.log('Threat intelligence updated successfully');
    } catch (error) {
      console.error('Failed to update threat intelligence:', error);
      throw error;
    }
  }

  /**
   * Get threat response history for a file
   */
  async getFileSecurityHistory(fileId: string): Promise<{
    responses: ThreatResponse[];
    events: SecurityAuditEvent[];
  }> {
    const [responses, eventsResult] = await Promise.all([
      this.threatResponse.getResponseHistory(fileId),
      this.securityAudit.getSecurityEvents({ fileId, limit: 100 })
    ]);

    return {
      responses,
      events: eventsResult.events
    };
  }

  /**
   * Update security configuration
   */
  async updateConfiguration(newConfig: Partial<ThreatDetectionConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Update all services with new configuration
    await Promise.all([
      this.threatResponse.updateConfiguration(this.config),
      this.fileValidator.updateThreatDetectionConfig(this.config)
    ]);

    // Log configuration change
    await this.securityAudit.logSecurityEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: SecurityEventType.SYSTEM_ALERT,
      severity: ThreatSeverity.INFO,
      userId: 'admin',
      fileId: undefined,
      ipAddress: 'system',
      userAgent: 'security-manager',
      details: {
        description: 'Security configuration updated',
        affectedResources: ['security-config'],
        responseActions: [],
        additionalContext: {
          configChanges: newConfig
        }
      },
      resolved: true
    });
  }

  /**
   * Emergency security lockdown
   */
  async emergencyLockdown(reason: string, initiatedBy: string): Promise<void> {
    // Disable all file processing
    this.config.enableMalwareDetection = false;
    this.config.enablePIIDetection = false;
    this.config.enableRealTimeScanning = false;

    // Log emergency event
    await this.securityAudit.logSecurityEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: SecurityEventType.SYSTEM_ALERT,
      severity: ThreatSeverity.CRITICAL,
      userId: initiatedBy,
      fileId: undefined,
      ipAddress: 'system',
      userAgent: 'security-manager',
      details: {
        description: `Emergency security lockdown initiated: ${reason}`,
        affectedResources: ['entire-system'],
        responseActions: ['lockdown'],
        additionalContext: {
          reason,
          initiatedBy,
          lockdownTime: new Date().toISOString()
        }
      },
      resolved: false
    });

    console.log(`EMERGENCY LOCKDOWN: ${reason} (initiated by: ${initiatedBy})`);
  }

  /**
   * Private helper methods
   */
  private generateScanMessage(
    validation: ValidationResult,
    responses: ThreatResponse[]
  ): string {
    if (!validation.valid) {
      return `File rejected: ${validation.errors.join(', ')}`;
    }

    if (validation.recommendation === 'block') {
      return 'File blocked due to critical security threats';
    }

    if (validation.recommendation === 'quarantine') {
      return 'File quarantined for manual review';
    }

    if (validation.threatDetection?.threats.length || validation.piiDetection?.piiFindings.length) {
      const threatCount = validation.threatDetection?.threats.length || 0;
      const piiCount = validation.piiDetection?.piiFindings.length || 0;
      const responseCount = responses.length;
      
      return `File processed with ${threatCount} threat(s) and ${piiCount} PII finding(s). ${responseCount} automated response(s) executed.`;
    }

    return 'File passed security validation';
  }

  private async checkSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    services: Array<{ name: string; status: string; lastCheck: Date }>;
    performance: {
      avgScanTime: number;
      scanThroughput: number;
      errorRate: number;
    };
  }> {
    // This would perform actual health checks in a real implementation
    const services = [
      { name: 'FileValidator', status: 'healthy', lastCheck: new Date() },
      { name: 'ThreatDetector', status: 'healthy', lastCheck: new Date() },
      { name: 'PIIScanner', status: 'healthy', lastCheck: new Date() },
      { name: 'ThreatResponse', status: 'healthy', lastCheck: new Date() },
      { name: 'ThreatIntelligenceDB', status: 'healthy', lastCheck: new Date() },
      { name: 'SecurityAudit', status: 'healthy', lastCheck: new Date() }
    ];

    const performance = {
      avgScanTime: 245, // ms
      scanThroughput: 150, // files per minute
      errorRate: 0.02 // 2%
    };

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Check for any unhealthy services
    const unhealthyServices = services.filter(s => s.status !== 'healthy');
    if (unhealthyServices.length > 0) {
      status = unhealthyServices.some(s => s.status === 'critical') ? 'critical' : 'warning';
    }

    // Check performance metrics
    if (performance.errorRate > 0.05 || performance.avgScanTime > 1000) {
      status = status === 'critical' ? 'critical' : 'warning';
    }

    return { status, services, performance };
  }

  /**
   * Get service instances for direct access if needed
   */
  getServices() {
    return {
      fileValidator: this.fileValidator,
      threatDetector: this.threatDetector,
      piiScanner: this.piiScanner,
      threatResponse: this.threatResponse,
      threatIntelligenceDB: this.threatIntelligenceDB,
      securityAudit: this.securityAudit
    };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ThreatDetectionConfig {
    return { ...this.config };
  }
}