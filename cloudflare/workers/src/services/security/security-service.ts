import { AuditLogger } from './audit-logger';
import { IncidentResponseService, IncidentResponseConfig } from './incident-response';
import { SecurityMonitoringDashboard } from './monitoring-dashboard';
import { ComplianceManager } from './compliance-manager';
import { SecurityAuditPerformanceOptimizer, PerformanceConfig } from './performance-optimizer';
import { FileValidationService } from './file-validator';
import { SecurityEvent, SecurityEventType } from '../../types/security-events';

/**
 * Integrated security service configuration
 */
export interface SecurityServiceConfig {
  auditLogging: {
    enabled: boolean;
    performanceOptimization: Partial<PerformanceConfig>;
  };
  incidentResponse: IncidentResponseConfig;
  monitoring: {
    enabled: boolean;
    dashboardRefreshInterval: number;
  };
  compliance: {
    frameworks: string[];
    automatedReporting: boolean;
  };
  fileValidation: {
    enabled: boolean;
    threatDetection: boolean;
    piiDetection: boolean;
  };
}

/**
 * Security service health status
 */
export interface SecurityServiceHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    auditLogger: { status: 'healthy' | 'degraded' | 'unhealthy'; latency: number };
    incidentResponse: { status: 'healthy' | 'degraded' | 'unhealthy'; activeIncidents: number };
    monitoring: { status: 'healthy' | 'degraded' | 'unhealthy'; queueDepth: number };
    compliance: { status: 'healthy' | 'degraded' | 'unhealthy'; overdueRequests: number };
    fileValidation: { status: 'healthy' | 'degraded' | 'unhealthy'; validationRate: number };
  };
  lastHealthCheck: Date;
}

/**
 * Comprehensive integrated security service
 * Orchestrates all security components with optimized performance
 */
export class IntegratedSecurityService {
  private auditLogger: AuditLogger;
  private incidentResponse: IncidentResponseService;
  private monitoringDashboard: SecurityMonitoringDashboard;
  private complianceManager: ComplianceManager;
  private performanceOptimizer: SecurityAuditPerformanceOptimizer;
  private fileValidator: FileValidationService;
  private config: SecurityServiceConfig;

  private healthStatus: SecurityServiceHealth = {
    overall: 'healthy',
    components: {
      auditLogger: { status: 'healthy', latency: 0 },
      incidentResponse: { status: 'healthy', activeIncidents: 0 },
      monitoring: { status: 'healthy', queueDepth: 0 },
      compliance: { status: 'healthy', overdueRequests: 0 },
      fileValidation: { status: 'healthy', validationRate: 0 }
    },
    lastHealthCheck: new Date()
  };

  constructor(
    db: D1Database,
    config: SecurityServiceConfig
  ) {
    this.config = config;

    // Initialize core audit logger
    this.auditLogger = new AuditLogger(db);

    // Initialize performance optimizer
    this.performanceOptimizer = new SecurityAuditPerformanceOptimizer(
      config.auditLogging.performanceOptimization
    );

    // Initialize incident response
    this.incidentResponse = new IncidentResponseService(
      db,
      this.auditLogger,
      config.incidentResponse
    );

    // Initialize monitoring dashboard
    this.monitoringDashboard = new SecurityMonitoringDashboard(
      db,
      this.auditLogger
    );

    // Initialize compliance manager
    this.complianceManager = new ComplianceManager(
      db,
      this.auditLogger
    );

    // Initialize file validator
    this.fileValidator = new FileValidationService(
      db,
      undefined, // threatDetectionConfig would go here
      this.auditLogger
    );

    // Start health monitoring
    this.startHealthMonitoring();

    // Optimize database indexes
    this.optimizeDatabase(db);
  }

  /**
   * Log a security event with full integration
   */
  async logSecurityEvent(event: Partial<SecurityEvent>): Promise<string> {
    if (!this.config.auditLogging.enabled) {
      return 'logging_disabled';
    }

    try {
      // Use performance-optimized logging
      const eventId = await this.performanceOptimizer.optimizeEventLogging(
        this.auditLogger,
        event as SecurityEvent
      );

      // Process for incident response
      if (event.requiresResponse || this.isCriticalEvent(event as SecurityEvent)) {
        await this.incidentResponse.processSecurityEvent(event as SecurityEvent);
      }

      return eventId;
    } catch (error) {
      console.error('Failed to log security event:', error);
      
      // Log the logging failure itself
      await this.auditLogger.logSystemEvent(
        SecurityEventType.SYSTEM_ERROR,
        {
          component: 'integrated-security-service',
          errorCode: 'LOGGING_FAILURE',
          details: {
            originalEventType: event.type,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      );

      throw error;
    }
  }

  /**
   * Validate file with integrated security scanning
   */
  async validateFile(
    file: File,
    userId: string,
    options: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
    } = {}
  ): Promise<{
    valid: boolean;
    eventId?: string;
    errors: string[];
    warnings: string[];
    riskScore?: number;
  }> {
    if (!this.config.fileValidation.enabled) {
      return {
        valid: true,
        errors: [],
        warnings: ['File validation disabled']
      };
    }

    try {
      const validationResult = await this.fileValidator.validateFile(file, userId, {
        scanContent: true,
        checkMagicBytes: true
      });

      // Log validation event
      const eventId = await this.logSecurityEvent({
        type: validationResult.valid 
          ? SecurityEventType.FILE_UPLOADED 
          : SecurityEventType.FILE_VALIDATION_FAILED,
        userId,
        resourceType: 'file',
        resourceId: file.name,
        resourceName: file.name,
        message: validationResult.valid 
          ? 'File validation successful' 
          : `File validation failed: ${validationResult.errors.join(', ')}`,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        sessionId: options.sessionId,
        details: {
          fileName: file.name,
          fileSize: file.size,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          riskScore: validationResult.riskScore
        }
      });

      return {
        valid: validationResult.valid,
        eventId,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        riskScore: validationResult.riskScore
      };
    } catch (error) {
      console.error('File validation failed:', error);
      
      // Log validation failure
      const eventId = await this.logSecurityEvent({
        type: SecurityEventType.SYSTEM_ERROR,
        userId,
        message: 'File validation system error',
        details: {
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      return {
        valid: false,
        eventId,
        errors: ['File validation system error'],
        warnings: []
      };
    }
  }

  /**
   * Get comprehensive security dashboard data
   */
  async getDashboardData(userId: string, role: string): Promise<Record<string, unknown>> {
    if (!this.config.monitoring.enabled) {
      throw new Error('Security monitoring is disabled');
    }

    try {
      const dashboardData = await this.monitoringDashboard.getDashboardData(userId, role);
      
      // Add performance metrics
      const performanceMetrics = this.performanceOptimizer.getPerformanceMetrics();
      
      return {
        ...dashboardData,
        performance: performanceMetrics,
        health: this.healthStatus,
        recommendations: this.performanceOptimizer.getOptimizationRecommendations()
      };
    } catch (error) {
      await this.logSecurityEvent({
        type: SecurityEventType.SYSTEM_ERROR,
        userId,
        message: 'Failed to get dashboard data',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Submit compliance request
   */
  async submitComplianceRequest(
    userId: string,
    requestType: string,
    framework: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      requestMethod: string;
    }
  ): Promise<string> {
    try {
      // This would integrate with the compliance manager
      // For now, just log the request
      const eventId = await this.logSecurityEvent({
        type: SecurityEventType.DATA_EXPORT_REQUESTED,
        userId,
        message: `Compliance request submitted: ${requestType}`,
        details: {
          requestType,
          framework,
          requestMethod: context.requestMethod
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      return eventId;
    } catch (error) {
      console.error('Failed to submit compliance request:', error);
      throw error;
    }
  }

  /**
   * Get security service health status
   */
  getHealthStatus(): SecurityServiceHealth {
    return { ...this.healthStatus };
  }

  /**
   * Generate comprehensive security report
   */
  async generateSecurityReport(
    userId: string,
    period: { start: Date; end: Date },
    reportType: 'summary' | 'detailed' | 'compliance'
  ): Promise<{
    reportId: string;
    generatedAt: Date;
    period: { start: Date; end: Date };
    summary: Record<string, unknown>;
    metrics: Record<string, unknown>;
    incidents: Record<string, unknown>[];
    compliance: Record<string, unknown>;
    performance: Record<string, unknown>;
  }> {
    const reportId = crypto.randomUUID();
    const now = new Date();

    try {
      // Generate metrics
      const metrics = await this.auditLogger.generateSecurityMetrics(
        period.start,
        period.end,
        'daily'
      );

      // Get active incidents
      const incidents = await this.incidentResponse.getActiveIncidents();

      // Get performance data
      const performance = this.performanceOptimizer.generatePerformanceReport();

      // Log report generation
      await this.logSecurityEvent({
        type: SecurityEventType.SYSTEM_MAINTENANCE,
        userId,
        message: `Security report generated: ${reportType}`,
        details: {
          reportId,
          reportType,
          period
        }
      });

      return {
        reportId,
        generatedAt: now,
        period,
        summary: {
          totalEvents: metrics.eventCounts,
          criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
          averageResponseTime: performance.summary.averageLatency,
          complianceStatus: 'compliant' // Would be calculated
        },
        metrics,
        incidents,
        compliance: {}, // Would be populated by compliance manager
        performance
      };
    } catch (error) {
      await this.logSecurityEvent({
        type: SecurityEventType.SYSTEM_ERROR,
        userId,
        message: 'Failed to generate security report',
        details: {
          reportId,
          reportType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  /**
   * Handle security event batch processing
   */
  async processBatchEvents(events: Partial<SecurityEvent>[]): Promise<string[]> {
    const eventIds: string[] = [];

    try {
      // Process events in optimized batches
      for (const event of events) {
        const eventId = await this.logSecurityEvent(event);
        eventIds.push(eventId);
      }

      return eventIds;
    } catch (error) {
      console.error('Batch event processing failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup old data based on retention policies
   */
  async cleanupOldData(): Promise<{
    eventsDeleted: number;
    auditEntriesDeleted: number;
    incidentsClosed: number;
  }> {
    try {
      const eventsDeleted = await this.auditLogger.cleanupOldEvents();
      
      // Log cleanup activity
      await this.logSecurityEvent({
        type: SecurityEventType.SYSTEM_MAINTENANCE,
        message: 'Security data cleanup completed',
        details: {
          eventsDeleted,
          cleanupDate: new Date()
        }
      });

      return {
        eventsDeleted,
        auditEntriesDeleted: 0, // Would be implemented
        incidentsClosed: 0 // Would be implemented
      };
    } catch (error) {
      console.error('Data cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Private: Check if event is critical
   */
  private isCriticalEvent(event: SecurityEvent): boolean {
    return event.severity === 'critical' || 
           event.riskLevel === 'critical' ||
           event.requiresResponse;
  }

  /**
   * Private: Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      await this.updateHealthStatus();
    }, 30000); // Every 30 seconds
  }

  /**
   * Private: Update health status
   */
  private async updateHealthStatus(): Promise<void> {
    try {
      const performanceMetrics = this.performanceOptimizer.getPerformanceMetrics();
      
      // Update component health based on metrics
      this.healthStatus.components.auditLogger = {
        status: performanceMetrics.p95Latency > 50 ? 'degraded' : 'healthy',
        latency: performanceMetrics.averageLatency
      };

      this.healthStatus.components.monitoring = {
        status: performanceMetrics.queueDepth > 1000 ? 'degraded' : 'healthy',
        queueDepth: performanceMetrics.queueDepth
      };

      // Update overall health
      const componentStatuses = Object.values(this.healthStatus.components).map(c => c.status);
      if (componentStatuses.some(s => s === 'unhealthy')) {
        this.healthStatus.overall = 'unhealthy';
      } else if (componentStatuses.some(s => s === 'degraded')) {
        this.healthStatus.overall = 'degraded';
      } else {
        this.healthStatus.overall = 'healthy';
      }

      this.healthStatus.lastHealthCheck = new Date();
    } catch (error) {
      console.error('Health status update failed:', error);
      this.healthStatus.overall = 'unhealthy';
    }
  }

  /**
   * Private: Optimize database for performance
   */
  private async optimizeDatabase(db: D1Database): Promise<void> {
    try {
      await this.performanceOptimizer.optimizeIndexes(db);
    } catch (error) {
      console.error('Database optimization failed:', error);
    }
  }
}