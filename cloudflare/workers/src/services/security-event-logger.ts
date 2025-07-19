import { 
  SecurityEventType, 
  SecurityEventSeverity, 
  SecurityEventCategory, 
  RiskLevel 
} from '../types/security-events';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  category: SecurityEventCategory;
  riskLevel: RiskLevel;
  timestamp: Date;
  message: string;
  userId?: string;
  fileId?: string;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  requiresResponse: boolean;
  details?: Record<string, unknown>;
  actionTaken?: string;
  threatType?: string;
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  responseTime?: number;
  alertId?: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: SecurityEventSeverity;
  title: string;
  description: string;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  events: SecurityEvent[];
  metrics?: Record<string, unknown>;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByCategory: Record<string, number>;
  averageResponseTime: number;
  threatsDetected: number;
  threatsBlocked: number;
  falsePositives: number;
  systemUptime: number;
  performanceMetrics: {
    scanDuration: number;
    throughput: number;
    errorRate: number;
  };
}

export class SecurityEventLogger {
  private db: D1Database;
  private alertWebhook?: string;

  constructor(
    db: D1Database,
    metricsService: any, // Keep parameter for backward compatibility but don't use it
    alertWebhook?: string
  ) {
    this.db = db;
    this.alertWebhook = alertWebhook;
  }

  /**
   * Log a security event to the database
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // 1. Store security event in database
      await this.db.prepare(`
        INSERT INTO security_events (
          id, event_type, severity, category, risk_level, user_id, file_id, 
          ip_address, user_agent, source, requires_response, details, 
          action_taken, threat_type, metadata, resolved, response_time, 
          alert_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.id,
        event.type,
        event.severity,
        event.category,
        event.riskLevel,
        event.userId,
        event.fileId,
        event.ipAddress,
        event.userAgent,
        event.source || 'security-middleware',
        event.requiresResponse ? 1 : 0,
        JSON.stringify(event.details || {}),
        event.actionTaken,
        event.threatType,
        JSON.stringify(event.metadata || {}),
        event.resolved ? 1 : 0,
        event.responseTime,
        event.alertId,
        event.timestamp.toISOString()
      ).run();

      // 2. Metrics recording removed (monitoring service deleted)

      // 3. Trigger alerts for high-severity events
      if (this.shouldTriggerAlert(event)) {
        await this.triggerSecurityAlert(event);
      }

      // 4. Execute automated responses if configured
      if (event.requiresResponse && this.shouldExecuteAutomatedResponse(event)) {
        await this.executeAutomatedResponse(event);
      }

    } catch (error) {
      console.error('Failed to log security event:', error);
      // Fallback: log to console if database fails
      console.error('Security Event (fallback):', JSON.stringify(event, null, 2));
    }
  }

  /**
   * Log multiple security events in batch
   */
  async logSecurityEvents(events: SecurityEvent[]): Promise<void> {
    try {
      // Batch insert for performance
      const stmt = this.db.prepare(`
        INSERT INTO security_events (
          id, event_type, severity, category, risk_level, user_id, file_id, 
          ip_address, user_agent, source, requires_response, details, 
          action_taken, threat_type, metadata, resolved, response_time, 
          alert_id, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = events.map(event => stmt.bind(
        event.id,
        event.type,
        event.severity,
        event.category,
        event.riskLevel,
        event.userId,
        event.fileId,
        event.ipAddress,
        event.userAgent,
        event.source || 'security-middleware',
        event.requiresResponse ? 1 : 0,
        JSON.stringify(event.details || {}),
        event.actionTaken,
        event.threatType,
        JSON.stringify(event.metadata || {}),
        event.resolved ? 1 : 0,
        event.responseTime,
        event.alertId,
        event.timestamp.toISOString()
      ));

      await this.db.batch(batch);

      // Process metrics and alerts for each event
      for (const event of events) {
        await this.recordSecurityMetrics(event);
        
        if (this.shouldTriggerAlert(event)) {
          await this.triggerSecurityAlert(event);
        }
      }

    } catch (error) {
      console.error('Failed to log security events batch:', error);
      // Fallback to individual logging
      for (const event of events) {
        await this.logSecurityEvent(event);
      }
    }
  }

  /**
   * Create a security alert from critical events
   */
  async createSecurityAlert(
    type: string,
    title: string,
    description: string,
    severity: SecurityEventSeverity,
    events: SecurityEvent[]
  ): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      type,
      severity,
      title,
      description,
      timestamp: new Date(),
      resolved: false,
      events
    };

    try {
      // Store alert in database
      await this.db.prepare(`
        INSERT INTO security_alerts (
          id, type, severity, title, description, timestamp, 
          resolved, resolved_by, resolved_at, events, metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        alert.id,
        alert.type,
        alert.severity,
        alert.title,
        alert.description,
        alert.timestamp.toISOString(),
        alert.resolved ? 1 : 0,
        alert.resolvedBy,
        alert.resolvedAt?.toISOString(),
        JSON.stringify(alert.events),
        JSON.stringify(alert.metrics || {})
      ).run();

      // Update events with alert ID
      for (const event of events) {
        await this.db.prepare(`
          UPDATE security_events 
          SET alert_id = ? 
          WHERE id = ?
        `).bind(alert.id, event.id).run();
      }

      return alert;

    } catch (error) {
      console.error('Failed to create security alert:', error);
      throw error;
    }
  }

  /**
   * Resolve a security alert
   */
  async resolveSecurityAlert(alertId: string, resolvedBy: string): Promise<void> {
    try {
      await this.db.prepare(`
        UPDATE security_alerts 
        SET resolved = 1, resolved_by = ?, resolved_at = ? 
        WHERE id = ?
      `).bind(resolvedBy, new Date().toISOString(), alertId).run();

      // Mark associated events as resolved
      await this.db.prepare(`
        UPDATE security_events 
        SET resolved = 1 
        WHERE alert_id = ?
      `).bind(alertId).run();

    } catch (error) {
      console.error('Failed to resolve security alert:', error);
      throw error;
    }
  }

  /**
   * Get security events with filtering
   */
  async getSecurityEvents(filters: {
    startTime?: Date;
    endTime?: Date;
    severity?: SecurityEventSeverity;
    category?: SecurityEventCategory;
    userId?: string;
    fileId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<SecurityEvent[]> {
    try {
      let sql = 'SELECT * FROM security_events WHERE 1=1';
      const params: unknown[] = [];

      if (filters.startTime) {
        sql += ' AND timestamp >= ?';
        params.push(filters.startTime.toISOString());
      }

      if (filters.endTime) {
        sql += ' AND timestamp <= ?';
        params.push(filters.endTime.toISOString());
      }

      if (filters.severity) {
        sql += ' AND severity = ?';
        params.push(filters.severity);
      }

      if (filters.category) {
        sql += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.userId) {
        sql += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters.fileId) {
        sql += ' AND file_id = ?';
        params.push(filters.fileId);
      }

      sql += ' ORDER BY timestamp DESC';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }

      const result = await this.db.prepare(sql).bind(...params).all();
      
      return result.results.map(row => this.parseSecurityEvent(row));

    } catch (error) {
      console.error('Failed to get security events:', error);
      return [];
    }
  }

  /**
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(timeRange: {
    start: Date;
    end: Date;
  }): Promise<SecurityMetrics> {
    try {
      const events = await this.getSecurityEvents({
        startTime: timeRange.start,
        endTime: timeRange.end
      });

      const metrics: SecurityMetrics = {
        totalEvents: events.length,
        eventsByType: {},
        eventsBySeverity: {},
        eventsByCategory: {},
        averageResponseTime: 0,
        threatsDetected: 0,
        threatsBlocked: 0,
        falsePositives: 0,
        systemUptime: 100, // Placeholder
        performanceMetrics: {
          scanDuration: 0,
          throughput: 0,
          errorRate: 0
        }
      };

      // Calculate aggregated metrics
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const event of events) {
        // Count by type
        metrics.eventsByType[event.type] = (metrics.eventsByType[event.type] || 0) + 1;

        // Count by severity
        metrics.eventsBySeverity[event.severity] = (metrics.eventsBySeverity[event.severity] || 0) + 1;

        // Count by category
        metrics.eventsByCategory[event.category] = (metrics.eventsByCategory[event.category] || 0) + 1;

        // Calculate response time
        if (event.responseTime) {
          totalResponseTime += event.responseTime;
          responseTimeCount++;
        }

        // Count threats
        if (event.type === SecurityEventType.THREAT_DETECTED) {
          metrics.threatsDetected++;
        }

        if (event.actionTaken === 'blocked' || event.actionTaken === 'quarantined') {
          metrics.threatsBlocked++;
        }
      }

      // Calculate averages
      metrics.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

      return metrics;

    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        eventsByCategory: {},
        averageResponseTime: 0,
        threatsDetected: 0,
        threatsBlocked: 0,
        falsePositives: 0,
        systemUptime: 0,
        performanceMetrics: {
          scanDuration: 0,
          throughput: 0,
          errorRate: 0
        }
      };
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    summary: SecurityMetrics;
    topThreats: Array<{ type: string; count: number; severity: string }>;
    userActivity: Array<{ userId: string; eventCount: number; riskScore: number }>;
    systemHealth: { status: string; issues: string[] };
  }> {
    try {
      const [metrics, events] = await Promise.all([
        this.getSecurityMetrics(timeRange),
        this.getSecurityEvents({
          startTime: timeRange.start,
          endTime: timeRange.end
        })
      ]);

      // Top threats analysis
      const threatCounts = new Map<string, { count: number; severity: string }>();
      events.forEach(event => {
        if (event.type === SecurityEventType.THREAT_DETECTED && event.threatType) {
          const existing = threatCounts.get(event.threatType);
          if (existing) {
            existing.count++;
          } else {
            threatCounts.set(event.threatType, {
              count: 1,
              severity: event.severity
            });
          }
        }
      });

      const topThreats = Array.from(threatCounts.entries())
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // User activity analysis
      const userActivity = new Map<string, { eventCount: number; riskScore: number }>();
      events.forEach(event => {
        if (event.userId) {
          const existing = userActivity.get(event.userId);
          if (existing) {
            existing.eventCount++;
            existing.riskScore += this.calculateEventRiskScore(event);
          } else {
            userActivity.set(event.userId, {
              eventCount: 1,
              riskScore: this.calculateEventRiskScore(event)
            });
          }
        }
      });

      const topUsers = Array.from(userActivity.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10);

      // System health check
      const systemHealth = {
        status: 'healthy',
        issues: [] as string[]
      };

      // Check for critical issues
      const criticalEvents = events.filter(e => e.severity === SecurityEventSeverity.CRITICAL);
      if (criticalEvents.length > 0) {
        systemHealth.status = 'critical';
        systemHealth.issues.push(`${criticalEvents.length} critical security events detected`);
      }

      return {
        summary: metrics,
        topThreats,
        userActivity: topUsers,
        systemHealth
      };

    } catch (error) {
      console.error('Failed to generate security report:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async recordSecurityMetrics(event: SecurityEvent): Promise<void> {
    // Metrics recording removed - monitoring service deleted
    // This method is kept as a no-op for backward compatibility
  }

  private shouldTriggerAlert(event: SecurityEvent): boolean {
    // Trigger alerts for high-severity events or specific event types
    return event.severity === SecurityEventSeverity.HIGH || 
           event.severity === SecurityEventSeverity.CRITICAL ||
           event.type === SecurityEventType.THREAT_DETECTED ||
           event.type === SecurityEventType.MULTIPLE_FAILED_ATTEMPTS ||
           event.type === SecurityEventType.SUSPICIOUS_ACTIVITY;
  }

  private async triggerSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      // Create alert if this is a new high-severity event
      const alertTitle = this.generateAlertTitle(event);
      const alertDescription = this.generateAlertDescription(event);

      const alert = await this.createSecurityAlert(
        event.type,
        alertTitle,
        alertDescription,
        event.severity,
        [event]
      );

      // Send webhook notification if configured
      if (this.alertWebhook) {
        await this.sendWebhookNotification(alert);
      }

    } catch (error) {
      console.error('Failed to trigger security alert:', error);
    }
  }

  private shouldExecuteAutomatedResponse(event: SecurityEvent): boolean {
    // Execute automated responses for specific event types
    return event.type === SecurityEventType.THREAT_DETECTED ||
           event.type === SecurityEventType.MULTIPLE_FAILED_ATTEMPTS ||
           event.severity === SecurityEventSeverity.CRITICAL;
  }

  private async executeAutomatedResponse(event: SecurityEvent): Promise<void> {
    try {
      // Implement automated response logic
      switch (event.type) {
        case SecurityEventType.THREAT_DETECTED:
          await this.quarantineFile(event);
          break;
        case SecurityEventType.MULTIPLE_FAILED_ATTEMPTS:
          await this.blockUser(event);
          break;
        default:
          console.warn('No automated response defined for event type:', event.type);
      }
    } catch (error) {
      console.error('Failed to execute automated response:', error);
    }
  }

  private async quarantineFile(event: SecurityEvent): Promise<void> {
    if (event.fileId) {
      // Implementation would quarantine the file
      console.warn('File quarantine not implemented for:', event.fileId);
    }
  }

  private async blockUser(event: SecurityEvent): Promise<void> {
    if (event.userId) {
      // Implementation would block the user
      console.warn('User blocking not implemented for:', event.userId);
    }
  }

  private generateAlertTitle(event: SecurityEvent): string {
    switch (event.type) {
      case SecurityEventType.THREAT_DETECTED:
        return `Threat Detected: ${event.threatType || 'Unknown'}`;
      case SecurityEventType.MULTIPLE_FAILED_ATTEMPTS:
        return 'Multiple Failed Authentication Attempts';
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
        return 'Suspicious Activity Detected';
      default:
        return `Security Alert: ${event.type}`;
    }
  }

  private generateAlertDescription(event: SecurityEvent): string {
    return `${event.message}\n\nDetails: ${JSON.stringify(event.details, null, 2)}`;
  }

  private async sendWebhookNotification(alert: SecurityAlert): Promise<void> {
    if (!this.alertWebhook) return;

    try {
      await fetch(this.alertWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert_id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          timestamp: alert.timestamp.toISOString(),
          events: alert.events.length
        })
      });
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  private calculateEventRiskScore(event: SecurityEvent): number {
    let score = 0;
    
    switch (event.severity) {
      case SecurityEventSeverity.CRITICAL:
        score += 4;
        break;
      case SecurityEventSeverity.HIGH:
        score += 3;
        break;
      case SecurityEventSeverity.MEDIUM:
        score += 2;
        break;
      case SecurityEventSeverity.LOW:
        score += 1;
        break;
    }

    switch (event.riskLevel) {
      case RiskLevel.HIGH:
        score += 2;
        break;
      case RiskLevel.MEDIUM:
        score += 1;
        break;
    }

    return score;
  }

  private parseSecurityEvent(row: Record<string, unknown>): SecurityEvent {
    return {
      id: row.id as string,
      type: row.event_type as SecurityEventType,
      severity: row.severity as SecurityEventSeverity,
      category: row.category as SecurityEventCategory,
      riskLevel: row.risk_level as RiskLevel,
      timestamp: new Date(row.timestamp as string),
      message: row.message as string,
      userId: row.user_id as string,
      fileId: row.file_id as string,
      ipAddress: row.ip_address as string,
      userAgent: row.user_agent as string,
      source: row.source as string,
      requiresResponse: Boolean(row.requires_response),
      details: row.details ? JSON.parse(row.details as string) : undefined,
      actionTaken: row.action_taken as string,
      threatType: row.threat_type as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      resolved: Boolean(row.resolved),
      responseTime: row.response_time as number,
      alertId: row.alert_id as string
    };
  }
}