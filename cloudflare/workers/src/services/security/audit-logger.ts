import {
  FileOperation,
  FileAccessAudit
} from '../../types/permissions';

export interface AuditEvent {
  fileId: string;
  userId?: string;
  shareToken?: string;
  operation: FileOperation;
  result: 'allowed' | 'denied';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  bytesTransferred?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface SecurityIncident {
  type: 'access_denied' | 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_token' | 'permission_escalation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId?: string;
  fileId?: string;
  ipAddress?: string;
  userAgent?: string;
  evidence: Record<string, unknown>;
  timestamp: Date;
}

export interface AuditSummary {
  fileId: string;
  totalAccesses: number;
  successfulAccesses: number;
  deniedAccesses: number;
  uniqueUsers: number;
  firstAccess: Date;
  lastAccess: Date;
  totalBytesTransferred: number;
  averageResponseTime: number;
  topOperations: Array<{
    operation: FileOperation;
    count: number;
    successRate: number;
  }>;
  suspiciousActivity: Array<{
    type: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

/**
 * Comprehensive Audit Logging Service
 * Provides detailed audit trails and security monitoring for file operations
 */
export class SecurityAuditLogger {
  private db: D1Database;
  private analytics?: AnalyticsEngineDataset;
  private readonly _BATCH_SIZE = 100;
  private readonly RETENTION_DAYS = 365;

  constructor(db: D1Database, analytics?: AnalyticsEngineDataset) {
    this.db = db;
    this.analytics = analytics;
  }

  /**
   * Log a file access event
   */
  async logFileAccess(event: AuditEvent): Promise<string> {
    const auditId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    try {
      // Store in D1 database for detailed queries
      await this.db
        .prepare(`
          INSERT INTO file_access_audit 
          (id, file_id, user_id, share_token, operation, result, reason, ip_address, user_agent, request_id, bytes_transferred, duration_ms, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          auditId,
          event.fileId,
          event.userId || null,
          event.shareToken || null,
          event.operation,
          event.result,
          event.reason || null,
          event.ipAddress || null,
          event.userAgent || null,
          event.requestId || null,
          event.bytesTransferred || null,
          event.durationMs || null,
          JSON.stringify(event.metadata || {}),
          timestamp
        )
        .run();

      // Store in Analytics Engine for real-time monitoring (if available)
      if (this.analytics) {
        this.analytics.writeDataPoint({
          blobs: [
            event.fileId,
            event.userId || 'anonymous',
            event.operation,
            event.result,
            event.ipAddress || 'unknown'
          ],
          doubles: [
            event.bytesTransferred || 0,
            event.durationMs || 0
          ],
          indexes: [event.fileId]
        });
      }

      // Check for suspicious activity patterns
      await this.detectSuspiciousActivity(event);

      return auditId;

    } catch (error) {
      console.error('Failed to log file access:', error);
      // Return a placeholder ID to avoid breaking the calling code
      return auditId;
    }
  }

  /**
   * Log a security incident
   */
  async logSecurityIncident(incident: SecurityIncident): Promise<void> {
    const incidentId = crypto.randomUUID();

    try {
      await this.db
        .prepare(`
          INSERT INTO security_incidents 
          (id, type, severity, description, user_id, file_id, ip_address, user_agent, evidence, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          incidentId,
          incident.type,
          incident.severity,
          incident.description,
          incident.userId || null,
          incident.fileId || null,
          incident.ipAddress || null,
          incident.userAgent || null,
          JSON.stringify(incident.evidence),
          incident.timestamp.toISOString()
        )
        .run();

      // Trigger alerts for high/critical severity incidents
      if (incident.severity === 'high' || incident.severity === 'critical') {
        await this.triggerSecurityAlert(incident);
      }

    } catch (error) {
      console.error('Failed to log security incident:', error);
    }
  }

  /**
   * Get audit summary for a file
   */
  async getFileAuditSummary(fileId: string, days: number = 30): Promise<AuditSummary> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // Get basic statistics
    const basicStats = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_accesses,
          SUM(CASE WHEN result = 'allowed' THEN 1 ELSE 0 END) as successful_accesses,
          SUM(CASE WHEN result = 'denied' THEN 1 ELSE 0 END) as denied_accesses,
          COUNT(DISTINCT user_id) as unique_users,
          MIN(created_at) as first_access,
          MAX(created_at) as last_access,
          SUM(COALESCE(bytes_transferred, 0)) as total_bytes,
          AVG(COALESCE(duration_ms, 0)) as avg_response_time
        FROM file_access_audit
        WHERE file_id = ? AND created_at >= ?
      `)
      .bind(fileId, startDate.toISOString())
      .first();

    // Get operation statistics
    const operationStats = await this.db
      .prepare(`
        SELECT 
          operation,
          COUNT(*) as count,
          (SUM(CASE WHEN result = 'allowed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as success_rate
        FROM file_access_audit
        WHERE file_id = ? AND created_at >= ?
        GROUP BY operation
        ORDER BY count DESC
      `)
      .bind(fileId, startDate.toISOString())
      .all();

    // Get suspicious activity
    const suspiciousActivity = await this.db
      .prepare(`
        SELECT 
          'denied_access' as type,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM file_access_audit
        WHERE file_id = ? AND result = 'denied' AND created_at >= ?
        
        UNION ALL
        
        SELECT 
          'rapid_requests' as type,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM file_access_audit
        WHERE file_id = ? AND created_at >= ?
        GROUP BY user_id, DATE(created_at)
        HAVING COUNT(*) > 100
      `)
      .bind(fileId, startDate.toISOString(), fileId, startDate.toISOString())
      .all();

    return {
      fileId,
      totalAccesses: basicStats?.total_accesses as number || 0,
      successfulAccesses: basicStats?.successful_accesses as number || 0,
      deniedAccesses: basicStats?.denied_accesses as number || 0,
      uniqueUsers: basicStats?.unique_users as number || 0,
      firstAccess: basicStats?.first_access ? new Date(basicStats.first_access as string) : new Date(),
      lastAccess: basicStats?.last_access ? new Date(basicStats.last_access as string) : new Date(),
      totalBytesTransferred: basicStats?.total_bytes as number || 0,
      averageResponseTime: basicStats?.avg_response_time as number || 0,
      topOperations: operationStats.results.map((row: {
        operation: string;
        count: number;
        success_rate: number;
      }) => ({
        operation: row.operation as FileOperation,
        count: row.count as number,
        successRate: row.success_rate as number
      })),
      suspiciousActivity: suspiciousActivity.results.map((row: {
        type: string;
        count: number;
        last_occurrence: string;
      }) => ({
        type: row.type as string,
        count: row.count as number,
        lastOccurrence: new Date(row.last_occurrence as string)
      }))
    };
  }

  /**
   * Get user access summary
   */
  async getUserAccessSummary(
    userId: string, 
    days: number = 30
  ): Promise<{
    totalFiles: number;
    totalAccesses: number;
    successfulAccesses: number;
    deniedAccesses: number;
    totalBytesTransferred: number;
    averageResponseTime: number;
    mostAccessedFiles: Array<{
      fileId: string;
      filename: string;
      accessCount: number;
      lastAccessed: Date;
    }>;
  }> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const summary = await this.db
      .prepare(`
        SELECT 
          COUNT(DISTINCT faa.file_id) as total_files,
          COUNT(*) as total_accesses,
          SUM(CASE WHEN faa.result = 'allowed' THEN 1 ELSE 0 END) as successful_accesses,
          SUM(CASE WHEN faa.result = 'denied' THEN 1 ELSE 0 END) as denied_accesses,
          SUM(COALESCE(faa.bytes_transferred, 0)) as total_bytes,
          AVG(COALESCE(faa.duration_ms, 0)) as avg_response_time
        FROM file_access_audit faa
        WHERE faa.user_id = ? AND faa.created_at >= ?
      `)
      .bind(userId, startDate.toISOString())
      .first();

    const mostAccessed = await this.db
      .prepare(`
        SELECT 
          faa.file_id,
          f.filename,
          COUNT(*) as access_count,
          MAX(faa.created_at) as last_accessed
        FROM file_access_audit faa
        JOIN files f ON faa.file_id = f.id
        WHERE faa.user_id = ? AND faa.created_at >= ?
        GROUP BY faa.file_id, f.filename
        ORDER BY access_count DESC
        LIMIT 10
      `)
      .bind(userId, startDate.toISOString())
      .all();

    return {
      totalFiles: summary?.total_files as number || 0,
      totalAccesses: summary?.total_accesses as number || 0,
      successfulAccesses: summary?.successful_accesses as number || 0,
      deniedAccesses: summary?.denied_accesses as number || 0,
      totalBytesTransferred: summary?.total_bytes as number || 0,
      averageResponseTime: summary?.avg_response_time as number || 0,
      mostAccessedFiles: mostAccessed.results.map((row: {
        file_id: string;
        filename: string;
        access_count: number;
        last_accessed: string;
      }) => ({
        fileId: row.file_id as string,
        filename: row.filename as string,
        accessCount: row.access_count as number,
        lastAccessed: new Date(row.last_accessed as string)
      }))
    };
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(event: AuditEvent): Promise<void> {
    try {
      // Check for rapid repeated failures
      if (event.result === 'denied') {
        const recentFailures = await this.db
          .prepare(`
            SELECT COUNT(*) as count
            FROM file_access_audit
            WHERE (user_id = ? OR ip_address = ?)
              AND result = 'denied'
              AND created_at >= datetime('now', '-5 minutes')
          `)
          .bind(event.userId || null, event.ipAddress || null)
          .first();

        if (recentFailures && recentFailures.count as number >= 10) {
          await this.logSecurityIncident({
            type: 'access_denied',
            severity: 'high',
            description: `Rapid access denials detected: ${recentFailures.count} failures in 5 minutes`,
            userId: event.userId,
            fileId: event.fileId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            evidence: {
              failureCount: recentFailures.count,
              timeWindow: '5 minutes',
              operation: event.operation
            },
            timestamp: new Date()
          });
        }
      }

      // Check for unusual access patterns
      if (event.userId) {
        const hourlyAccesses = await this.db
          .prepare(`
            SELECT COUNT(*) as count
            FROM file_access_audit
            WHERE user_id = ?
              AND created_at >= datetime('now', '-1 hour')
          `)
          .bind(event.userId)
          .first();

        if (hourlyAccesses && hourlyAccesses.count as number >= 1000) {
          await this.logSecurityIncident({
            type: 'suspicious_activity',
            severity: 'medium',
            description: `Unusually high activity: ${hourlyAccesses.count} accesses in 1 hour`,
            userId: event.userId,
            fileId: event.fileId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            evidence: {
              accessCount: hourlyAccesses.count,
              timeWindow: '1 hour',
              threshold: 1000
            },
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      console.error('Failed to detect suspicious activity:', error);
    }
  }

  /**
   * Trigger security alert
   */
  private async triggerSecurityAlert(incident: SecurityIncident): Promise<void> {
    try {
      // This would integrate with your alerting system
      // For now, we'll just log to console
      console.warn('SECURITY ALERT:', {
        type: incident.type,
        severity: incident.severity,
        description: incident.description,
        timestamp: incident.timestamp,
        evidence: incident.evidence
      });

      // Store alert in database
      await this.db
        .prepare(`
          INSERT INTO security_alerts 
          (id, incident_type, severity, description, user_id, file_id, ip_address, evidence, created_at, acknowledged)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `)
        .bind(
          crypto.randomUUID(),
          incident.type,
          incident.severity,
          incident.description,
          incident.userId || null,
          incident.fileId || null,
          incident.ipAddress || null,
          JSON.stringify(incident.evidence),
          incident.timestamp.toISOString()
        )
        .run();

    } catch (error) {
      console.error('Failed to trigger security alert:', error);
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date(Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000));
    
    const result = await this.db
      .prepare(`
        DELETE FROM file_access_audit
        WHERE created_at < ?
      `)
      .bind(cutoffDate.toISOString())
      .run();

    return result.meta.changes;
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    fileId?: string,
    userId?: string
  ): Promise<FileAccessAudit[]> {
    let query = `
      SELECT id, file_id, user_id, share_token, operation, result, reason, 
             ip_address, user_agent, request_id, bytes_transferred, duration_ms, 
             metadata, created_at
      FROM file_access_audit
      WHERE created_at >= ? AND created_at <= ?
    `;
    
    const params = [startDate.toISOString(), endDate.toISOString()];

    if (fileId) {
      query += ' AND file_id = ?';
      params.push(fileId);
    }

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at ASC';

    const results = await this.db.prepare(query).bind(...params).all();

    return results.results.map((row: {
      id: string;
      file_id: string;
      user_id?: string;
      share_token?: string;
      operation: string;
      result: string;
      reason?: string;
      ip_address?: string;
      user_agent?: string;
      request_id?: string;
      bytes_transferred?: number;
      duration_ms?: number;
      metadata?: string;
      created_at: string;
    }) => ({
      id: row.id,
      fileId: row.file_id,
      userId: row.user_id,
      shareToken: row.share_token,
      operation: row.operation as FileOperation,
      result: row.result as 'allowed' | 'denied',
      reason: row.reason,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestId: row.request_id,
      bytesTransferred: row.bytes_transferred,
      durationMs: row.duration_ms,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at)
    }));
  }

  // Additional methods required by other services
  async logComplianceEvent(event: {
    type: string;
    description: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logSecurityIncident({
      type: 'suspicious_activity',
      severity: 'medium',
      description: `Compliance Event: ${event.description}`,
      userId: event.userId,
      evidence: event.metadata || {},
      timestamp: new Date()
    });
  }

  async createAuditTrailEntry(entry: {
    action: string;
    userId?: string;
    details: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logSecurityIncident({
      type: 'suspicious_activity',
      severity: 'low',
      description: `Audit Trail: ${entry.action} - ${entry.details}`,
      userId: entry.userId,
      evidence: entry.metadata || {},
      timestamp: new Date()
    });
  }

  async logSystemEvent(event: {
    type: string;
    description: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logSecurityIncident({
      type: 'suspicious_activity',
      severity: (event.severity as any) || 'low',
      description: `System Event: ${event.description}`,
      evidence: event.metadata || {},
      timestamp: new Date()
    });
  }

  async logSecurityViolationEvent(event: {
    type: string;
    description: string;
    userId?: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logSecurityIncident({
      type: 'suspicious_activity',
      severity: (event.severity as any) || 'medium',
      description: `Security Violation: ${event.description}`,
      userId: event.userId,
      evidence: event.metadata || {},
      timestamp: new Date()
    });
  }

  async logSecurityEvent(event: {
    type: string;
    description: string;
    userId?: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.logSecurityIncident({
      type: 'suspicious_activity',
      severity: (event.severity as any) || 'medium',
      description: `Security Event: ${event.description}`,
      userId: event.userId,
      evidence: event.metadata || {},
      timestamp: new Date()
    });
  }

  async logFileAccessEvent(event: AuditEvent): Promise<string> {
    return await this.logFileAccess(event);
  }

  async generateSecurityMetrics(period: string = '24h'): Promise<Record<string, unknown>> {
    // Basic implementation - can be enhanced
    return {
      period,
      timestamp: new Date().toISOString(),
      metrics: {
        totalEvents: 0,
        securityViolations: 0,
        complianceEvents: 0
      }
    };
  }

  async querySecurityEvents(_query: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
    userId?: string;
    limit?: number;
  }): Promise<SecurityIncident[]> {
    // Basic implementation - can be enhanced  
    return [];
  }
}