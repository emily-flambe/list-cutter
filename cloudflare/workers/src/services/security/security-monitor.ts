/**
 * Security Monitoring Service
 * 
 * This service provides comprehensive security monitoring capabilities including:
 * - Performance monitoring for security features
 * - Threat detection and alerting
 * - Security metrics collection
 * - Anomaly detection
 * - Real-time security health monitoring
 */

import { SecurityConfigManager } from '../../config/security-config';
import { ValidationResult } from './file-validator';
import { 
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEventCategory,
  RiskLevel,
  SecurityMetrics as SecurityEventsMetrics
} from '../../types/security-events';

// Metadata interfaces for type safety
interface SecurityEventMetadata {
  operation?: string;
  duration?: number;
  threshold?: number;
  success?: boolean;
  method?: string;
  filename?: string;
  fileSize?: number;
  validationResults?: ValidationResult;
  blocked?: boolean;
  limit?: number;
  current?: number;
  usage?: number;
  threatType?: string;
  [key: string]: unknown;
}

interface FileValidationResults {
  passed: boolean;
  checks: {
    fileType: boolean;
    fileSize: boolean;
    virusScan: boolean;
    contentAnalysis: boolean;
  };
  warnings: string[];
  errors: string[];
}

interface ThreatMetadata {
  threatType: string;
  confidence: number;
  indicators: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  [key: string]: unknown;
}

// SecurityEvent is now imported from ../../types/security-events

export interface SecurityHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  authSystem: 'healthy' | 'degraded' | 'critical';
  fileValidation: 'healthy' | 'degraded' | 'critical';
  rateLimit: 'healthy' | 'degraded' | 'critical';
  threatDetection: 'healthy' | 'degraded' | 'critical';
}

export interface SecurityMonitorMetrics {
  timestamp: string;
  performance: {
    authenticationLatency: number;
    fileValidationLatency: number;
    rateLimitCheckLatency: number;
    totalSecurityOverhead: number;
  };
  counters: {
    authenticationAttempts: number;
    authenticationFailures: number;
    fileUploads: number;
    fileUploadFailures: number;
    rateLimitViolations: number;
    threatDetections: number;
    anomaliesDetected: number;
    securityViolations: number;
  };
  thresholds: {
    maxAuthFailures: number;
    maxFileFailures: number;
    maxRateLimitViolations: number;
    maxThreatDetections: number;
  };
  health: {
    overall: 'healthy' | 'degraded' | 'critical';
    authSystem: 'healthy' | 'degraded' | 'critical';
    fileValidation: 'healthy' | 'degraded' | 'critical';
    rateLimit: 'healthy' | 'degraded' | 'critical';
    threatDetection: 'healthy' | 'degraded' | 'critical';
  };
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  type: 'threshold_exceeded' | 'anomaly_detected' | 'system_degraded' | 'critical_threat';
  severity: 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedComponent: string;
  metrics: Record<string, number>;
  recommendations: string[];
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SecurityDashboard {
  timestamp: string;
  summary: {
    totalEvents: number;
    openAlerts: number;
    systemHealth: 'healthy' | 'degraded' | 'critical';
    averageResponseTime: number;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  recentEvents: SecurityEvent[];
  activeAlerts: SecurityAlert[];
  metrics: SecurityMonitorMetrics;
  trends: {
    authFailureRate: number;
    fileUploadFailureRate: number;
    threatDetectionRate: number;
    performanceTrend: 'improving' | 'stable' | 'degrading';
  };
}

export interface SecurityMonitorOptions {
  configManager: SecurityConfigManager;
  analytics: AnalyticsEngineDataset;
  kvNamespace: KVNamespace;
  alertWebhook?: string;
  performanceThreshold: number;
  enableRealTimeMonitoring: boolean;
  batchSize: number;
  metricsRetentionDays: number;
}

/**
 * Security Monitoring Service
 * 
 * Provides comprehensive security monitoring with real-time threat detection,
 * performance monitoring, and automated alerting capabilities.
 */
export class SecurityMonitorService {
  private configManager: SecurityConfigManager;
  private analytics: AnalyticsEngineDataset;
  private kvNamespace: KVNamespace;
  private alertWebhook?: string;
  private performanceThreshold: number;
  private enableRealTimeMonitoring: boolean;
  private batchSize: number;
  private metricsRetentionDays: number;
  
  // In-memory cache for performance metrics
  private metricsCache: Map<string, SecurityMonitorMetrics> = new Map();
  private eventBuffer: SecurityEvent[] = [];
  private lastFlushTime: number = Date.now();
  
  // Performance tracking
  private performanceTimers: Map<string, number> = new Map();
  
  constructor(options: SecurityMonitorOptions) {
    this.configManager = options.configManager;
    this.analytics = options.analytics;
    this.kvNamespace = options.kvNamespace;
    this.alertWebhook = options.alertWebhook;
    this.performanceThreshold = options.performanceThreshold;
    this.enableRealTimeMonitoring = options.enableRealTimeMonitoring;
    this.batchSize = options.batchSize;
    this.metricsRetentionDays = options.metricsRetentionDays;
  }
  
  /**
   * Start performance monitoring for a security operation
   */
  startPerformanceTimer(operation: string): string {
    const timerId = `${operation}-${Date.now()}-${Math.random()}`;
    this.performanceTimers.set(timerId, Date.now());
    return timerId;
  }
  
  /**
   * End performance monitoring and record metrics
   */
  endPerformanceTimer(timerId: string): number {
    const startTime = this.performanceTimers.get(timerId);
    if (!startTime) {
      return 0;
    }
    
    const duration = Date.now() - startTime;
    this.performanceTimers.delete(timerId);
    
    // Check if duration exceeds threshold
    if (duration > this.performanceThreshold) {
      this.recordEvent({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'violation',
        severity: 'medium',
        source: 'performance_monitor',
        description: `Security operation exceeded performance threshold: ${duration}ms`,
        metadata: {
          operation: timerId.split('-')[0],
          duration,
          threshold: this.performanceThreshold
        },
        resolved: false,
        responseTime: duration
      });
    }
    
    return duration;
  }
  
  /**
   * Record a security event
   */
  async recordEvent(event: SecurityEvent): Promise<void> {
    // Add to event buffer
    this.eventBuffer.push(event);
    
    // Update metrics cache
    await this.updateMetrics(event);
    
    // Check for immediate alerts
    if (event.severity === SecurityEventSeverity.CRITICAL || event.severity === SecurityEventSeverity.HIGH) {
      await this.checkForAlerts(event);
    }
    
    // Flush buffer if needed
    if (this.eventBuffer.length >= this.batchSize || 
        Date.now() - this.lastFlushTime > 60000) { // 1 minute
      await this.flushEventBuffer();
    }
  }
  
  /**
   * Record authentication event
   */
  async recordAuthEvent(
    success: boolean,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    responseTime?: number
  ): Promise<void> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type: success ? SecurityEventType.AUTHENTICATION_SUCCESS : SecurityEventType.AUTHENTICATION_FAILURE,
      severity: success ? SecurityEventSeverity.INFO : SecurityEventSeverity.MEDIUM,
      category: SecurityEventCategory.AUTHENTICATION,
      riskLevel: success ? RiskLevel.NONE : RiskLevel.LOW,
      timestamp: new Date(),
      message: success ? 'Authentication successful' : 'Authentication failed',
      userId,
      ipAddress,
      userAgent,
      source: 'auth_service',
      requiresResponse: !success,
      details: {
        success,
        method: 'password',
        responseTime
      }
    };
    
    await this.recordEvent(event);
  }
  
  /**
   * Record file upload event
   */
  async recordFileUploadEvent(
    success: boolean,
    filename: string,
    fileSize: number,
    userId?: string,
    ipAddress?: string,
    validationResults?: FileValidationResults,
    responseTime?: number
  ): Promise<void> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type: success ? SecurityEventType.FILE_UPLOADED : SecurityEventType.FILE_VALIDATION_FAILED,
      severity: success ? SecurityEventSeverity.INFO : SecurityEventSeverity.MEDIUM,
      category: SecurityEventCategory.FILE_ACCESS,
      riskLevel: success ? RiskLevel.NONE : RiskLevel.LOW,
      timestamp: new Date(),
      message: success ? 'File upload successful' : 'File upload failed',
      userId,
      ipAddress,
      source: 'file_validation_service',
      requiresResponse: !success,
      details: {
        filename,
        fileSize,
        success,
        validationResults,
        responseTime
      }
    };
    
    await this.recordEvent(event);
  }
  
  /**
   * Record rate limit event
   */
  async recordRateLimitEvent(
    blocked: boolean,
    limit: number,
    current: number,
    ipAddress?: string,
    userId?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type: blocked ? SecurityEventType.RATE_LIMIT_EXCEEDED : SecurityEventType.SYSTEM_ERROR,
      severity: blocked ? SecurityEventSeverity.MEDIUM : SecurityEventSeverity.INFO,
      category: SecurityEventCategory.SECURITY_VIOLATION,
      riskLevel: blocked ? RiskLevel.MEDIUM : RiskLevel.NONE,
      timestamp: new Date(),
      message: blocked ? 'Rate limit exceeded' : 'Rate limit check passed',
      userId,
      ipAddress,
      source: 'rate_limit_service',
      requiresResponse: blocked,
      details: {
        blocked,
        limit,
        current,
        usage: current / limit
      }
    };
    
    await this.recordEvent(event);
  }
  
  /**
   * Record threat detection event
   */
  async recordThreatEvent(
    threatType: string,
    severity: SecurityEventSeverity,
    description: string,
    metadata: ThreatMetadata,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type: SecurityEventType.MALICIOUS_FILE_DETECTED,
      severity,
      category: SecurityEventCategory.SECURITY_VIOLATION,
      riskLevel: severity === SecurityEventSeverity.CRITICAL ? RiskLevel.CRITICAL : RiskLevel.HIGH,
      timestamp: new Date(),
      message: description,
      userId,
      ipAddress,
      source: 'threat_detection_service',
      requiresResponse: true,
      details: {
        threatType,
        ...metadata
      }
    };
    
    await this.recordEvent(event);
  }
  
  /**
   * Get current security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMonitorMetrics> {
    const now = new Date();
    const cacheKey = `metrics-${now.getHours()}`;
    
    let metrics = this.metricsCache.get(cacheKey);
    if (!metrics) {
      metrics = await this.calculateMetrics();
      this.metricsCache.set(cacheKey, metrics);
    }
    
    return metrics;
  }
  
  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<SecurityDashboard> {
    const [metrics, recentEvents, activeAlerts] = await Promise.all([
      this.getSecurityMetrics(),
      this.getRecentEvents(24), // Last 24 hours
      this.getActiveAlerts()
    ]);
    
    const trends = await this.calculateTrends();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalEvents: recentEvents.length,
        openAlerts: activeAlerts.length,
        systemHealth: metrics.health.overall,
        averageResponseTime: this.calculateAverageResponseTime(recentEvents),
        threatLevel: this.calculateThreatLevel(metrics, activeAlerts)
      },
      recentEvents: recentEvents.slice(0, 50), // Latest 50 events
      activeAlerts,
      metrics,
      trends
    };
  }
  
  /**
   * Get recent security events
   */
  async getRecentEvents(hoursBack: number = 24): Promise<SecurityEvent[]> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const eventsKey = `events-${cutoff.toISOString().split('T')[0]}`;
    
    try {
      const eventsData = await this.kvNamespace.get(eventsKey);
      if (!eventsData) return [];
      
      const events = JSON.parse(eventsData) as SecurityEvent[];
      return events.filter(event => new Date(event.timestamp) >= cutoff);
    } catch (error) {
      console.error('Failed to retrieve recent events:', error);
      return [];
    }
  }
  
  /**
   * Get active security alerts
   */
  async getActiveAlerts(): Promise<SecurityAlert[]> {
    try {
      const alertsData = await this.kvNamespace.get('active-alerts');
      if (!alertsData) return [];
      
      const alerts = JSON.parse(alertsData) as SecurityAlert[];
      return alerts.filter(alert => !alert.resolved);
    } catch (error) {
      console.error('Failed to retrieve active alerts:', error);
      return [];
    }
  }
  
  /**
   * Resolve a security alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    try {
      const alertsData = await this.kvNamespace.get('active-alerts');
      if (!alertsData) return;
      
      const alerts = JSON.parse(alertsData) as SecurityAlert[];
      const alertIndex = alerts.findIndex(alert => alert.id === alertId);
      
      if (alertIndex >= 0) {
        alerts[alertIndex].resolved = true;
        alerts[alertIndex].resolvedAt = new Date().toISOString();
        alerts[alertIndex].resolvedBy = resolvedBy;
        
        await this.kvNamespace.put('active-alerts', JSON.stringify(alerts));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }
  
  /**
   * Check system health
   */
  async checkSystemHealth(): Promise<SecurityMonitorMetrics['health']> {
    const metrics = await this.getSecurityMetrics();
    const config = await this.configManager.getMonitoringConfig();
    
    const health: SecurityMonitorMetrics['health'] = {
      overall: 'healthy',
      authSystem: 'healthy',
      fileValidation: 'healthy',
      rateLimit: 'healthy',
      threatDetection: 'healthy'
    };
    
    // Check authentication system
    if (metrics.counters.authenticationFailures > config.alertThresholds.failedLoginAttempts) {
      health.authSystem = 'degraded';
    }
    
    // Check file validation
    if (metrics.counters.fileUploadFailures > config.alertThresholds.suspiciousFileUploads) {
      health.fileValidation = 'degraded';
    }
    
    // Check rate limiting
    if (metrics.counters.rateLimitViolations > config.alertThresholds.rateLimitExceeded) {
      health.rateLimit = 'degraded';
    }
    
    // Check threat detection
    if (metrics.counters.threatDetections > config.alertThresholds.suspiciousFileUploads) {
      health.threatDetection = 'degraded';
    }
    
    // Check performance
    if (metrics.performance.totalSecurityOverhead > this.performanceThreshold) {
      health.overall = 'degraded';
    }
    
    // Determine overall health
    const systems = [health.authSystem, health.fileValidation, health.rateLimit, health.threatDetection];
    const criticalCount = systems.filter(s => s === 'critical').length;
    const degradedCount = systems.filter(s => s === 'degraded').length;
    
    if (criticalCount > 0) {
      health.overall = 'critical';
    } else if (degradedCount > 1) {
      health.overall = 'degraded';
    }
    
    return health;
  }
  
  /**
   * Update metrics based on event
   */
  private async updateMetrics(event: SecurityEvent): Promise<void> {
    const now = new Date();
    const cacheKey = `metrics-${now.getHours()}`;
    
    let metrics = this.metricsCache.get(cacheKey);
    if (!metrics) {
      metrics = await this.calculateMetrics();
    }
    
    // Update counters based on event type
    switch (event.type) {
      case SecurityEventType.AUTHENTICATION_SUCCESS:
      case SecurityEventType.AUTHENTICATION_FAILURE:
        metrics.counters.authenticationAttempts++;
        if (event.type === SecurityEventType.AUTHENTICATION_FAILURE) {
          metrics.counters.authenticationFailures++;
        }
        if (event.details?.responseTime) {
          metrics.performance.authenticationLatency = 
            (metrics.performance.authenticationLatency + (event.details.responseTime as number)) / 2;
        }
        break;
        
      case SecurityEventType.FILE_UPLOADED:
      case SecurityEventType.FILE_VALIDATION_FAILED:
        metrics.counters.fileUploads++;
        if (event.type === SecurityEventType.FILE_VALIDATION_FAILED) {
          metrics.counters.fileUploadFailures++;
        }
        if (event.details?.responseTime) {
          metrics.performance.fileValidationLatency = 
            (metrics.performance.fileValidationLatency + (event.details.responseTime as number)) / 2;
        }
        break;
        
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        metrics.counters.rateLimitViolations++;
        if (event.details?.responseTime) {
          metrics.performance.rateLimitCheckLatency = 
            (metrics.performance.rateLimitCheckLatency + (event.details.responseTime as number)) / 2;
        }
        break;
        
      case SecurityEventType.MALICIOUS_FILE_DETECTED:
        metrics.counters.threatDetections++;
        break;
        
      case SecurityEventType.ANOMALY_DETECTED:
        metrics.counters.anomaliesDetected++;
        break;
        
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        metrics.counters.securityViolations++;
        break;
    }
    
    // Update total security overhead
    metrics.performance.totalSecurityOverhead = 
      metrics.performance.authenticationLatency +
      metrics.performance.fileValidationLatency +
      metrics.performance.rateLimitCheckLatency;
    
    // Update health status
    metrics.health = await this.checkSystemHealth();
    
    // Update cache
    this.metricsCache.set(cacheKey, metrics);
  }
  
  /**
   * Calculate current metrics
   */
  private async calculateMetrics(): Promise<SecurityMonitorMetrics> {
    const config = await this.configManager.getMonitoringConfig();
    
    return {
      timestamp: new Date().toISOString(),
      performance: {
        authenticationLatency: 0,
        fileValidationLatency: 0,
        rateLimitCheckLatency: 0,
        totalSecurityOverhead: 0
      },
      counters: {
        authenticationAttempts: 0,
        authenticationFailures: 0,
        fileUploads: 0,
        fileUploadFailures: 0,
        rateLimitViolations: 0,
        threatDetections: 0,
        anomaliesDetected: 0,
        securityViolations: 0
      },
      thresholds: {
        maxAuthFailures: config.alertThresholds.failedLoginAttempts,
        maxFileFailures: config.alertThresholds.suspiciousFileUploads,
        maxRateLimitViolations: config.alertThresholds.rateLimitExceeded,
        maxThreatDetections: config.alertThresholds.securityViolations
      },
      health: {
        overall: 'healthy',
        authSystem: 'healthy',
        fileValidation: 'healthy',
        rateLimit: 'healthy',
        threatDetection: 'healthy'
      }
    };
  }
  
  /**
   * Check for alerts based on event
   */
  private async checkForAlerts(_event: SecurityEvent): Promise<void> {
    const metrics = await this.getSecurityMetrics();
    const config = await this.configManager.getMonitoringConfig();
    
    const alerts: SecurityAlert[] = [];
    
    // Check thresholds
    if (metrics.counters.authenticationFailures >= config.alertThresholds.failedLoginAttempts) {
      alerts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'threshold_exceeded',
        severity: 'high',
        title: 'Authentication Failure Threshold Exceeded',
        description: `Authentication failures (${metrics.counters.authenticationFailures}) exceeded threshold (${config.alertThresholds.failedLoginAttempts})`,
        affectedComponent: 'auth_system',
        metrics: {
          current: metrics.counters.authenticationFailures,
          threshold: config.alertThresholds.failedLoginAttempts
        },
        recommendations: [
          'Review authentication logs for suspicious patterns',
          'Consider implementing additional rate limiting',
          'Check for potential brute force attacks'
        ],
        resolved: false
      });
    }
    
    if (metrics.counters.threatDetections >= config.alertThresholds.securityViolations) {
      alerts.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'threshold_exceeded',
        severity: 'critical',
        title: 'Threat Detection Threshold Exceeded',
        description: `Threat detections (${metrics.counters.threatDetections}) exceeded threshold (${config.alertThresholds.securityViolations})`,
        affectedComponent: 'threat_detection',
        metrics: {
          current: metrics.counters.threatDetections,
          threshold: config.alertThresholds.securityViolations
        },
        recommendations: [
          'Immediately review threat detection logs',
          'Consider blocking suspicious IP addresses',
          'Escalate to security team'
        ],
        resolved: false
      });
    }
    
    // Save alerts
    if (alerts.length > 0) {
      await this.saveAlerts(alerts);
      
      // Send notifications if webhook configured
      if (this.alertWebhook) {
        await this.sendAlertNotifications(alerts);
      }
    }
  }
  
  /**
   * Save alerts to KV store
   */
  private async saveAlerts(alerts: SecurityAlert[]): Promise<void> {
    try {
      const existingAlertsData = await this.kvNamespace.get('active-alerts');
      const existingAlerts = existingAlertsData ? JSON.parse(existingAlertsData) : [];
      
      const allAlerts = [...existingAlerts, ...alerts];
      await this.kvNamespace.put('active-alerts', JSON.stringify(allAlerts));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }
  
  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alerts: SecurityAlert[]): Promise<void> {
    if (!this.alertWebhook) return;
    
    for (const alert of alerts) {
      try {
        await fetch(this.alertWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: `🚨 Security Alert: ${alert.title}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'Severity', value: alert.severity, short: true },
                { title: 'Component', value: alert.affectedComponent, short: true },
                { title: 'Description', value: alert.description, short: false },
                { title: 'Recommendations', value: alert.recommendations.join('\n'), short: false }
              ]
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send alert notification:', error);
      }
    }
  }
  
  /**
   * Flush event buffer to analytics
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;
    
    try {
      // Send to analytics engine
      for (const event of this.eventBuffer) {
        this.analytics.writeDataPoint({
          blobs: [event.type, event.source, event.severity],
          doubles: [event.responseTime || 0],
          indexes: [event.userId || 'anonymous']
        });
      }
      
      // Store in KV for historical analysis
      const today = new Date().toISOString().split('T')[0];
      const eventsKey = `events-${today}`;
      
      const existingEventsData = await this.kvNamespace.get(eventsKey);
      const existingEvents = existingEventsData ? JSON.parse(existingEventsData) : [];
      
      const allEvents = [...existingEvents, ...this.eventBuffer];
      await this.kvNamespace.put(eventsKey, JSON.stringify(allEvents));
      
      // Clear buffer
      this.eventBuffer = [];
      this.lastFlushTime = Date.now();
      
    } catch (error) {
      console.error('Failed to flush event buffer:', error);
    }
  }
  
  /**
   * Calculate performance trends
   */
  private async calculateTrends(): Promise<SecurityDashboard['trends']> {
    const metrics = await this.getSecurityMetrics();
    
    // For now, return placeholder trends
    // In a real implementation, this would compare with historical data
    return {
      authFailureRate: metrics.counters.authenticationFailures / Math.max(metrics.counters.authenticationAttempts, 1),
      fileUploadFailureRate: metrics.counters.fileUploadFailures / Math.max(metrics.counters.fileUploads, 1),
      threatDetectionRate: metrics.counters.threatDetections / Math.max(metrics.counters.fileUploads, 1),
      performanceTrend: metrics.performance.totalSecurityOverhead <= this.performanceThreshold ? 'stable' : 'degrading'
    };
  }
  
  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(events: SecurityEvent[]): number {
    const eventsWithTime = events.filter(e => e.responseTime !== undefined);
    if (eventsWithTime.length === 0) return 0;
    
    const totalTime = eventsWithTime.reduce((sum, event) => sum + (event.responseTime || 0), 0);
    return totalTime / eventsWithTime.length;
  }
  
  /**
   * Calculate threat level
   */
  private calculateThreatLevel(metrics: SecurityMonitorMetrics, alerts: SecurityAlert[]): SecurityDashboard['summary']['threatLevel'] {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    
    if (criticalAlerts > 0) return 'critical';
    if (highAlerts > 0) return 'high';
    if (metrics.counters.threatDetections > 0) return 'medium';
    return 'low';
  }
  
  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.metricsRetentionDays * 24 * 60 * 60 * 1000);
    const cutoffKey = `events-${cutoffDate.toISOString().split('T')[0]}`;
    
    try {
      // Remove old event data
      await this.kvNamespace.delete(cutoffKey);
      
      // Clear old metrics cache
      const oldCacheKeys = Array.from(this.metricsCache.keys()).filter(key => {
        const hour = parseInt(key.split('-')[1]);
        return hour < new Date().getHours() - 24;
      });
      
      for (const key of oldCacheKeys) {
        this.metricsCache.delete(key);
      }
      
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }
  
  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(): Promise<SecurityDashboard> {
    const metrics = await this.getSecurityMetrics();
    const alerts = await this.getActiveAlerts();
    const trends = await this.calculateTrends();
    
    return {
      summary: {
        totalEvents: Object.values(metrics.counters).reduce((sum, count) => sum + count, 0),
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        activeThreats: metrics.counters.threatDetections,
        systemHealth: await this.checkSystemHealth(),
        threatLevel: this.calculateThreatLevel(metrics, alerts)
      },
      metrics,
      alerts: alerts.slice(0, 10), // Latest 10 alerts
      trends,
      performance: {
        averageResponseTime: this.calculateAverageResponseTime(this.eventBuffer),
        throughput: metrics.counters.authenticationAttempts + metrics.counters.fileUploads,
        errorRate: (metrics.counters.authenticationFailures + metrics.counters.fileUploadFailures) / 
                  Math.max(metrics.counters.authenticationAttempts + metrics.counters.fileUploads, 1)
      }
    };
  }
  
  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      const alertsData = await this.kvNamespace.get('active-alerts');
      const alerts = alertsData ? JSON.parse(alertsData) : [];
      
      const alertIndex = alerts.findIndex((a: SecurityAlert) => a.id === alertId);
      if (alertIndex >= 0) {
        alerts[alertIndex].resolved = true;
        alerts[alertIndex].resolvedBy = resolvedBy;
        alerts[alertIndex].resolvedAt = new Date().toISOString();
        
        await this.kvNamespace.put('active-alerts', JSON.stringify(alerts));
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }
  
  /**
   * Get active alerts
   */
  private async getActiveAlerts(): Promise<SecurityAlert[]> {
    try {
      const alertsData = await this.kvNamespace.get('active-alerts');
      const alerts = alertsData ? JSON.parse(alertsData) : [];
      return alerts.filter((a: SecurityAlert) => !a.resolved);
    } catch (error) {
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }
}

/**
 * Security Monitor Factory
 */
export class SecurityMonitorFactory {
  static create(options: SecurityMonitorOptions): SecurityMonitorService {
    return new SecurityMonitorService(options);
  }
  
  static createFromEnv(env: {
    SECURITY_CONFIG: KVNamespace;
    SECURITY_EVENTS: KVNamespace;
    ANALYTICS: AnalyticsEngineDataset;
    ALERT_WEBHOOK?: string;
    ENVIRONMENT?: string;
  }): SecurityMonitorService {
    const configManager = new SecurityConfigManager({
      kvNamespace: env.SECURITY_CONFIG,
      environment: env.ENVIRONMENT || 'development',
      enableDynamicUpdates: true,
      cacheExpirationMinutes: 5,
      fallbackToDefaults: true
    });
    
    return new SecurityMonitorService({
      configManager,
      analytics: env.ANALYTICS,
      kvNamespace: env.SECURITY_EVENTS,
      alertWebhook: env.ALERT_WEBHOOK,
      performanceThreshold: 100, // 100ms
      enableRealTimeMonitoring: true,
      batchSize: 100,
      metricsRetentionDays: 30
    });
  }
}