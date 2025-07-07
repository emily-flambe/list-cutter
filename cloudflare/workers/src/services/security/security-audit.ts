import {
  SecurityAuditEvent,
  SecurityEventType,
  SecurityEventDetails,
  ThreatSeverity,
  ThreatDetectionResult,
  PIIDetectionResult,
  ThreatResponse,
  ThreatStatistics,
  ThreatCount,
  PIICount,
  RiskDistribution,
  ComplianceStatus,
  ComplianceRegulation
} from '../../types/threat-intelligence';

/**
 * Security Audit and Logging Service
 * Comprehensive security event logging, monitoring, and reporting
 */
export class SecurityAuditService {
  private db: D1Database;
  private analytics?: AnalyticsEngineDataset;

  constructor(db: D1Database, analytics?: AnalyticsEngineDataset) {
    this.db = db;
    this.analytics = analytics;
  }

  /**
   * Initialize security audit database tables
   */
  async initializeAuditDatabase(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS security_audit_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        user_id TEXT,
        file_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT NOT NULL,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_by TEXT,
        resolved_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS threat_detection_errors (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        error_code TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        file_id TEXT,
        user_id TEXT,
        retryable BOOLEAN DEFAULT FALSE,
        retry_count INTEGER DEFAULT 0,
        last_retry TEXT,
        resolved BOOLEAN DEFAULT FALSE
      )`,
      
      `CREATE TABLE IF NOT EXISTS pii_findings (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        finding_type TEXT NOT NULL,
        masked_value TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        severity TEXT NOT NULL,
        location_offset INTEGER NOT NULL,
        location_length INTEGER NOT NULL,
        pattern_id TEXT,
        context TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS threat_responses (
        id TEXT PRIMARY KEY,
        threat_id TEXT,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        automated BOOLEAN DEFAULT TRUE,
        user_id TEXT,
        reason TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        error_message TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS security_metrics (
        id TEXT PRIMARY KEY,
        metric_type TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_data TEXT,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS compliance_audits (
        id TEXT PRIMARY KEY,
        regulation TEXT NOT NULL,
        audit_date TEXT NOT NULL,
        compliant BOOLEAN NOT NULL,
        violations_count INTEGER DEFAULT 0,
        findings TEXT,
        auditor TEXT,
        next_audit_date TEXT,
        status TEXT DEFAULT 'active'
      )`
    ];

    for (const table of tables) {
      await this.db.prepare(table).run();
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON security_audit_events(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_audit_events_type ON security_audit_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON security_audit_events(severity)',
      'CREATE INDEX IF NOT EXISTS idx_audit_events_user ON security_audit_events(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_events_file ON security_audit_events(file_id)',
      'CREATE INDEX IF NOT EXISTS idx_pii_findings_file ON pii_findings(file_id)',
      'CREATE INDEX IF NOT EXISTS idx_pii_findings_type ON pii_findings(finding_type)',
      'CREATE INDEX IF NOT EXISTS idx_threat_responses_timestamp ON threat_responses(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_security_metrics_type ON security_metrics(metric_type)'
    ];

    for (const index of indexes) {
      await this.db.prepare(index).run();
    }

    // Security audit database initialized successfully
  }

  /**
   * Log a security audit event
   */
  async logSecurityEvent(event: SecurityAuditEvent): Promise<void> {
    try {
      // Store in database
      await this.db.prepare(`
        INSERT INTO security_audit_events 
        (id, timestamp, event_type, severity, user_id, file_id, ip_address, user_agent, details, resolved, resolved_by, resolved_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.id,
        event.timestamp.toISOString(),
        event.eventType,
        event.severity,
        event.userId,
        event.fileId,
        event.ipAddress,
        event.userAgent,
        JSON.stringify(event.details),
        event.resolved,
        event.resolvedBy,
        event.resolvedAt?.toISOString(),
        event.notes
      ).run();

      // Send to analytics if available
      if (this.analytics) {
        await this.analytics.writeDataPoint({
          blobs: [
            event.eventType,
            event.severity,
            event.userId || 'anonymous',
            event.ipAddress
          ],
          doubles: [
            1, // Event count
            this.severityToNumber(event.severity)
          ],
          indexes: [
            event.eventType,
            event.severity
          ]
        });
      }

      // Log critical events to console for immediate attention
      if (event.severity === ThreatSeverity.CRITICAL) {
        console.error(`CRITICAL SECURITY EVENT: ${event.eventType} - ${event.details.description}`);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Log threat detection event with detailed information
   */
  async logThreatDetection(
    threatResult: ThreatDetectionResult,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const event: SecurityAuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: SecurityEventType.THREAT_DETECTED,
      severity: threatResult.overallRisk,
      userId,
      fileId: threatResult.fileId,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      details: {
        description: `Threat detection completed for file: ${threatResult.fileName}`,
        affectedResources: [threatResult.fileId],
        threatData: threatResult,
        responseActions: [],
        additionalContext: {
          scanDuration: threatResult.scanDuration,
          threatsFound: threatResult.threats.length,
          riskScore: threatResult.riskScore,
          scanEngine: threatResult.scanEngine,
          engineVersion: threatResult.engineVersion
        }
      },
      resolved: false
    };

    await this.logSecurityEvent(event);
  }

  /**
   * Log PII detection event
   */
  async logPIIDetection(
    piiResult: PIIDetectionResult,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const event: SecurityAuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: SecurityEventType.PII_DETECTED,
      severity: this.determinePIISeverity(piiResult),
      userId,
      fileId: piiResult.fileId,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent || 'unknown',
      details: {
        description: `PII detection completed for file: ${piiResult.fileName}`,
        affectedResources: [piiResult.fileId],
        piiData: piiResult,
        responseActions: [],
        additionalContext: {
          piiCount: piiResult.piiFindings.length,
          classificationLevel: piiResult.classificationLevel,
          complianceFlags: piiResult.complianceFlags.length,
          recommendedHandling: piiResult.recommendedHandling
        }
      },
      resolved: false
    };

    await this.logSecurityEvent(event);

    // Store individual PII findings
    for (const finding of piiResult.piiFindings) {
      await this.db.prepare(`
        INSERT INTO pii_findings 
        (id, file_id, finding_type, masked_value, confidence, severity, location_offset, location_length, pattern_id, context)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        finding.id,
        piiResult.fileId,
        finding.type,
        finding.value,
        finding.confidence,
        finding.severity,
        finding.location.offset,
        finding.location.length,
        finding.pattern,
        finding.context
      ).run();
    }
  }

  /**
   * Log threat response actions
   */
  async logThreatResponse(response: ThreatResponse): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO threat_responses 
        (id, threat_id, action, timestamp, automated, user_id, reason, details, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        response.threatId,
        response.threatId,
        response.action,
        response.timestamp.toISOString(),
        response.automated,
        response.userId,
        response.reason,
        JSON.stringify(response.details),
        'completed'
      ).run();

      // Log as security event
      const event: SecurityAuditEvent = {
        id: crypto.randomUUID(),
        timestamp: response.timestamp,
        eventType: this.getEventTypeForAction(response.action),
        severity: ThreatSeverity.INFO,
        userId: response.userId,
        fileId: response.details.originalFile.name,
        ipAddress: 'system',
        userAgent: 'automated-response',
        details: {
          description: `Automated threat response executed: ${response.action}`,
          affectedResources: [response.details.originalFile.name],
          responseActions: [response.action],
          additionalContext: {
            automated: response.automated,
            reason: response.reason,
            threatId: response.threatId
          }
        },
        resolved: true
      };

      await this.logSecurityEvent(event);
    } catch (error) {
      console.error('Failed to log threat response:', error);
    }
  }

  /**
   * Get security events with filtering and pagination
   */
  async getSecurityEvents(options: {
    startDate?: Date;
    endDate?: Date;
    eventType?: SecurityEventType;
    severity?: ThreatSeverity;
    userId?: string;
    fileId?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    events: SecurityAuditEvent[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      startDate,
      endDate,
      eventType,
      severity,
      userId,
      fileId,
      resolved,
      limit = 100,
      offset = 0
    } = options;

    let query = 'SELECT * FROM security_audit_events WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM security_audit_events WHERE 1=1';
    const params: any[] = [];

    // Build WHERE clause
    if (startDate) {
      query += ' AND timestamp >= ?';
      countQuery += ' AND timestamp >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      countQuery += ' AND timestamp <= ?';
      params.push(endDate.toISOString());
    }

    if (eventType) {
      query += ' AND event_type = ?';
      countQuery += ' AND event_type = ?';
      params.push(eventType);
    }

    if (severity) {
      query += ' AND severity = ?';
      countQuery += ' AND severity = ?';
      params.push(severity);
    }

    if (userId) {
      query += ' AND user_id = ?';
      countQuery += ' AND user_id = ?';
      params.push(userId);
    }

    if (fileId) {
      query += ' AND file_id = ?';
      countQuery += ' AND file_id = ?';
      params.push(fileId);
    }

    if (resolved !== undefined) {
      query += ' AND resolved = ?';
      countQuery += ' AND resolved = ?';
      params.push(resolved);
    }

    // Add ordering and pagination
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [eventsResult, countResult] = await Promise.all([
      this.db.prepare(query).bind(...params).all(),
      this.db.prepare(countQuery).bind(...params.slice(0, -2)).first()
    ]);

    const events: SecurityAuditEvent[] = eventsResult.results.map(row => this.mapToSecurityEvent(row));
    const total = countResult?.total as number || 0;
    const hasMore = offset + limit < total;

    return { events, total, hasMore };
  }

  /**
   * Generate threat statistics for a time period
   */
  async generateThreatStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<ThreatStatistics> {
    try {
      // Get total scans and threats detected
      const [scanStats, threatStats, piiStats] = await Promise.all([
        this.db.prepare(`
          SELECT COUNT(*) as total_scans
          FROM security_audit_events 
          WHERE event_type IN ('threat_detected', 'file_scanned') 
          AND timestamp BETWEEN ? AND ?
        `).bind(startDate.toISOString(), endDate.toISOString()).first(),

        this.db.prepare(`
          SELECT 
            COUNT(*) as threats_detected,
            COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
            COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
            COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
            COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
            COUNT(CASE WHEN severity = 'info' THEN 1 END) as info_count
          FROM security_audit_events 
          WHERE event_type = 'threat_detected' 
          AND timestamp BETWEEN ? AND ?
        `).bind(startDate.toISOString(), endDate.toISOString()).first(),

        this.db.prepare(`
          SELECT COUNT(*) as pii_detected
          FROM security_audit_events 
          WHERE event_type = 'pii_detected' 
          AND timestamp BETWEEN ? AND ?
        `).bind(startDate.toISOString(), endDate.toISOString()).first()
      ]);

      // Get blocked and quarantined files
      const actionStats = await this.db.prepare(`
        SELECT 
          COUNT(CASE WHEN action = 'block' THEN 1 END) as files_blocked,
          COUNT(CASE WHEN action = 'quarantine' THEN 1 END) as files_quarantined
        FROM threat_responses 
        WHERE timestamp BETWEEN ? AND ?
      `).bind(startDate.toISOString(), endDate.toISOString()).first();

      // Calculate average scan time
      const avgScanTime = await this.db.prepare(`
        SELECT AVG(CAST(JSON_EXTRACT(details, '$.additionalContext.scanDuration') AS REAL)) as avg_scan_time
        FROM security_audit_events 
        WHERE event_type = 'threat_detected' 
        AND timestamp BETWEEN ? AND ?
        AND JSON_EXTRACT(details, '$.additionalContext.scanDuration') IS NOT NULL
      `).bind(startDate.toISOString(), endDate.toISOString()).first();

      // Get top threats (mock data - would need threat detail parsing)
      const topThreats: ThreatCount[] = [
        { type: 'obfuscated_code' as any, count: 15, percentage: 35.7 },
        { type: 'suspicious_script' as any, count: 12, percentage: 28.6 },
        { type: 'malware' as any, count: 8, percentage: 19.0 },
        { type: 'phishing' as any, count: 7, percentage: 16.7 }
      ];

      // Get top PII types (mock data)
      const topPIITypes: PIICount[] = [
        { type: 'email' as any, count: 25, percentage: 41.7 },
        { type: 'phone_number' as any, count: 18, percentage: 30.0 },
        { type: 'ssn' as any, count: 10, percentage: 16.7 },
        { type: 'credit_card' as any, count: 7, percentage: 11.6 }
      ];

      const riskDistribution: RiskDistribution = {
        critical: threatStats?.critical_count as number || 0,
        high: threatStats?.high_count as number || 0,
        medium: threatStats?.medium_count as number || 0,
        low: threatStats?.low_count as number || 0,
        info: threatStats?.info_count as number || 0
      };

      // Mock compliance status
      const complianceStatus: ComplianceStatus = {
        regulation: ComplianceRegulation.GDPR,
        compliant: true,
        violations: 0,
        lastAudit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        nextAudit: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000) // ~11 months from now
      };

      return {
        period: {
          start: startDate,
          end: endDate
        },
        totalScans: scanStats?.total_scans as number || 0,
        threatsDetected: threatStats?.threats_detected as number || 0,
        piiDetected: piiStats?.pii_detected as number || 0,
        filesBlocked: actionStats?.files_blocked as number || 0,
        filesQuarantined: actionStats?.files_quarantined as number || 0,
        avgScanTime: avgScanTime?.avg_scan_time as number || 0,
        topThreats,
        topPIITypes,
        riskDistribution,
        complianceStatus
      };
    } catch (error) {
      console.error('Failed to generate threat statistics:', error);
      throw error;
    }
  }

  /**
   * Resolve a security event
   */
  async resolveSecurityEvent(
    eventId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<void> {
    await this.db.prepare(`
      UPDATE security_audit_events 
      SET resolved = TRUE, resolved_by = ?, resolved_at = ?, notes = ?
      WHERE id = ?
    `).bind(
      resolvedBy,
      new Date().toISOString(),
      notes,
      eventId
    ).run();
  }

  /**
   * Get security dashboard metrics
   */
  async getDashboardMetrics(): Promise<{
    recentEvents: SecurityAuditEvent[];
    criticalAlerts: number;
    activeThreatLevel: ThreatSeverity;
    scansSummary: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    threatsSummary: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topRisks: { type: string; count: number }[];
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recentEvents, criticalCount, scansToday, scansWeek, scansMonth, threatsToday, threatsWeek, threatsMonth] = await Promise.all([
      this.getSecurityEvents({ limit: 10 }),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE severity = 'critical' AND resolved = FALSE
      `).first(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE event_type IN ('threat_detected', 'file_scanned') AND timestamp >= ?
      `).bind(today.toISOString()).first(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE event_type IN ('threat_detected', 'file_scanned') AND timestamp >= ?
      `).bind(thisWeek.toISOString()).first(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE event_type IN ('threat_detected', 'file_scanned') AND timestamp >= ?
      `).bind(thisMonth.toISOString()).first(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE event_type = 'threat_detected' AND timestamp >= ?
      `).bind(today.toISOString()).first(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE event_type = 'threat_detected' AND timestamp >= ?
      `).bind(thisWeek.toISOString()).first(),
      this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE event_type = 'threat_detected' AND timestamp >= ?
      `).bind(thisMonth.toISOString()).first()
    ]);

    // Determine active threat level
    let activeThreatLevel = ThreatSeverity.LOW;
    if (criticalCount && (criticalCount.count as number) > 0) {
      activeThreatLevel = ThreatSeverity.CRITICAL;
    } else {
      // Check for recent high-severity events
      const recentHighSeverity = await this.db.prepare(`
        SELECT COUNT(*) as count FROM security_audit_events 
        WHERE severity IN ('high', 'critical') AND timestamp >= ?
      `).bind(thisWeek.toISOString()).first();
      
      if (recentHighSeverity && (recentHighSeverity.count as number) > 5) {
        activeThreatLevel = ThreatSeverity.HIGH;
      } else if (recentHighSeverity && (recentHighSeverity.count as number) > 0) {
        activeThreatLevel = ThreatSeverity.MEDIUM;
      }
    }

    // Mock top risks data
    const topRisks = [
      { type: 'Obfuscated Code', count: 15 },
      { type: 'PII Exposure', count: 12 },
      { type: 'Suspicious Scripts', count: 8 },
      { type: 'Malware Signatures', count: 5 }
    ];

    return {
      recentEvents: recentEvents.events,
      criticalAlerts: criticalCount?.count as number || 0,
      activeThreatLevel,
      scansSummary: {
        today: scansToday?.count as number || 0,
        thisWeek: scansWeek?.count as number || 0,
        thisMonth: scansMonth?.count as number || 0
      },
      threatsSummary: {
        today: threatsToday?.count as number || 0,
        thisWeek: threatsWeek?.count as number || 0,
        thisMonth: threatsMonth?.count as number || 0
      },
      topRisks
    };
  }

  /**
   * Helper methods
   */
  private severityToNumber(severity: ThreatSeverity): number {
    switch (severity) {
      case ThreatSeverity.CRITICAL: return 5;
      case ThreatSeverity.HIGH: return 4;
      case ThreatSeverity.MEDIUM: return 3;
      case ThreatSeverity.LOW: return 2;
      case ThreatSeverity.INFO: return 1;
      default: return 0;
    }
  }

  private determinePIISeverity(piiResult: PIIDetectionResult): ThreatSeverity {
    const hasCritical = piiResult.piiFindings.some(f => f.severity === 'critical');
    const hasHigh = piiResult.piiFindings.some(f => f.severity === 'high');

    if (hasCritical) return ThreatSeverity.CRITICAL;
    if (hasHigh) return ThreatSeverity.HIGH;
    if (piiResult.piiFindings.length > 0) return ThreatSeverity.MEDIUM;
    return ThreatSeverity.INFO;
  }

  private getEventTypeForAction(action: string): SecurityEventType {
    switch (action) {
      case 'block': return SecurityEventType.MALWARE_BLOCKED;
      case 'quarantine': return SecurityEventType.FILE_QUARANTINED;
      default: return SecurityEventType.SYSTEM_ALERT;
    }
  }

  private mapToSecurityEvent(row: any): SecurityAuditEvent {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      eventType: row.event_type as SecurityEventType,
      severity: row.severity as ThreatSeverity,
      userId: row.user_id,
      fileId: row.file_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      details: JSON.parse(row.details),
      resolved: row.resolved,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      notes: row.notes
    };
  }
}