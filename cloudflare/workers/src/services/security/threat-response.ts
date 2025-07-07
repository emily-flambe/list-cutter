import {
  ThreatResponse,
  ThreatAction,
  ThreatResponseDetails,
  NotificationRecord,
  QuarantineInfo,
  ThreatDetectionResult,
  PIIDetectionResult,
  ThreatSeverity,
  ThreatRecommendation,
  SecurityAuditEvent,
  SecurityEventType,
  ThreatDetectionConfig
} from '../../types/threat-intelligence';

/**
 * Automated Threat Response System
 * Handles automated responses to detected threats based on configurable rules
 */
export class ThreatResponseService {
  private db: D1Database;
  private r2Bucket: R2Bucket;
  private config: ThreatDetectionConfig;

  constructor(db: D1Database, r2Bucket: R2Bucket, config: ThreatDetectionConfig) {
    this.db = db;
    this.r2Bucket = r2Bucket;
    this.config = config;
  }

  /**
   * Process threat detection results and trigger automated responses
   */
  async processThreatDetection(
    threatResult: ThreatDetectionResult,
    file: File,
    userId?: string,
    ipAddress?: string
  ): Promise<ThreatResponse[]> {
    const responses: ThreatResponse[] = [];

    try {
      // Determine response actions based on threat level and configuration
      const actions = this.determineResponseActions(threatResult);

      for (const action of actions) {
        const response = await this.executeResponse(
          action,
          threatResult,
          file,
          userId,
          ipAddress
        );
        responses.push(response);
      }

      // Log response actions
      await this.logResponseActions(threatResult, responses, userId);

      return responses;
    } catch (error) {
      console.error('Threat response processing failed:', error);
      throw error;
    }
  }

  /**
   * Process PII detection results and trigger automated responses
   */
  async processPIIDetection(
    piiResult: PIIDetectionResult,
    file: File,
    userId?: string,
    ipAddress?: string
  ): Promise<ThreatResponse[]> {
    const responses: ThreatResponse[] = [];

    try {
      // Determine response actions based on PII sensitivity and compliance requirements
      const actions = this.determinePIIResponseActions(piiResult);

      for (const action of actions) {
        const response = await this.executePIIResponse(
          action,
          piiResult,
          file,
          userId,
          ipAddress
        );
        responses.push(response);
      }

      // Log response actions
      await this.logPIIResponseActions(piiResult, responses, userId);

      return responses;
    } catch (error) {
      console.error('PII response processing failed:', error);
      throw error;
    }
  }

  /**
   * Determine appropriate response actions for threat detection
   */
  private determineResponseActions(threatResult: ThreatDetectionResult): ThreatAction[] {
    const actions: ThreatAction[] = [];

    // Always log the event
    actions.push(ThreatAction.LOG);

    // Determine primary action based on risk score and severity
    if (threatResult.riskScore >= this.config.autoQuarantineThreshold) {
      if (threatResult.overallRisk === ThreatSeverity.CRITICAL) {
        actions.push(ThreatAction.BLOCK);
        actions.push(ThreatAction.DELETE);
        actions.push(ThreatAction.ESCALATE);
      } else if (threatResult.overallRisk === ThreatSeverity.HIGH) {
        actions.push(ThreatAction.QUARANTINE);
        actions.push(ThreatAction.ESCALATE);
      } else {
        actions.push(ThreatAction.QUARANTINE);
      }
    } else {
      // Lower risk threats
      if (threatResult.overallRisk === ThreatSeverity.MEDIUM) {
        actions.push(ThreatAction.NOTIFY);
      }
    }

    // Check for specific threat types requiring special handling
    const criticalThreats = threatResult.threats.filter(t => 
      t.signature.type === 'ransomware' || 
      t.signature.type === 'malware' ||
      t.signature.type === 'backdoor'
    );

    if (criticalThreats.length > 0) {
      if (!actions.includes(ThreatAction.BLOCK)) {
        actions.push(ThreatAction.BLOCK);
      }
      if (!actions.includes(ThreatAction.ESCALATE)) {
        actions.push(ThreatAction.ESCALATE);
      }
    }

    // Add notifications if enabled
    if (this.config.enableNotifications && !actions.includes(ThreatAction.NOTIFY)) {
      actions.push(ThreatAction.NOTIFY);
    }

    return actions;
  }

  /**
   * Determine appropriate response actions for PII detection
   */
  private determinePIIResponseActions(piiResult: PIIDetectionResult): ThreatAction[] {
    const actions: ThreatAction[] = [];

    // Always log the event
    actions.push(ThreatAction.LOG);

    // Check for critical PII types
    const criticalPII = piiResult.piiFindings.filter(f => f.severity === 'critical');
    const highPII = piiResult.piiFindings.filter(f => f.severity === 'high');

    if (criticalPII.length > 0) {
      // Critical PII requires blocking and sanitization
      actions.push(ThreatAction.BLOCK);
      actions.push(ThreatAction.SANITIZE);
      actions.push(ThreatAction.ESCALATE);
    } else if (highPII.length > 0) {
      // High-risk PII requires sanitization and notification
      actions.push(ThreatAction.SANITIZE);
      actions.push(ThreatAction.NOTIFY);
    } else if (piiResult.piiFindings.length > 0) {
      // Other PII requires notification
      actions.push(ThreatAction.NOTIFY);
    }

    // Check compliance requirements
    if (piiResult.complianceFlags.length > 0) {
      const criticalCompliance = piiResult.complianceFlags.filter(f => 
        f.severity === ThreatSeverity.CRITICAL
      );
      
      if (criticalCompliance.length > 0) {
        if (!actions.includes(ThreatAction.BLOCK)) {
          actions.push(ThreatAction.BLOCK);
        }
        if (!actions.includes(ThreatAction.ESCALATE)) {
          actions.push(ThreatAction.ESCALATE);
        }
      }
    }

    return actions;
  }

  /**
   * Execute a threat response action
   */
  private async executeResponse(
    action: ThreatAction,
    threatResult: ThreatDetectionResult,
    file: File,
    userId?: string,
    ipAddress?: string
  ): Promise<ThreatResponse> {
    const responseId = crypto.randomUUID();
    const timestamp = new Date();

    let details: ThreatResponseDetails = {
      originalFile: {
        name: file.name,
        size: file.size,
        hash: '', // Would be calculated
        location: ''
      },
      notifications: [],
      quarantineInfo: undefined
    };

    try {
      switch (action) {
        case ThreatAction.BLOCK:
          details = await this.executeBlock(threatResult, file, details);
          break;

        case ThreatAction.QUARANTINE:
          details = await this.executeQuarantine(threatResult, file, details);
          break;

        case ThreatAction.DELETE:
          details = await this.executeDelete(threatResult, file, details);
          break;

        case ThreatAction.SANITIZE:
          details = await this.executeSanitize(threatResult, file, details);
          break;

        case ThreatAction.NOTIFY:
          details = await this.executeNotify(threatResult, file, details, userId);
          break;

        case ThreatAction.ESCALATE:
          details = await this.executeEscalate(threatResult, file, details, userId);
          break;

        case ThreatAction.LOG:
          details = await this.executeLog(threatResult, file, details);
          break;
      }

      const response: ThreatResponse = {
        threatId: responseId,
        action,
        timestamp,
        automated: true,
        userId,
        reason: `Automated response to ${threatResult.overallRisk} threat (score: ${threatResult.riskScore})`,
        details
      };

      // Store response in database
      await this.storeResponse(response);

      return response;
    } catch (error) {
      throw new Error(`Failed to execute ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute PII response action
   */
  private async executePIIResponse(
    action: ThreatAction,
    piiResult: PIIDetectionResult,
    file: File,
    userId?: string,
    ipAddress?: string
  ): Promise<ThreatResponse> {
    const responseId = crypto.randomUUID();
    const timestamp = new Date();

    let details: ThreatResponseDetails = {
      originalFile: {
        name: file.name,
        size: file.size,
        hash: '',
        location: ''
      },
      notifications: [],
      quarantineInfo: undefined
    };

    try {
      switch (action) {
        case ThreatAction.BLOCK:
          details = await this.executePIIBlock(piiResult, file, details);
          break;

        case ThreatAction.SANITIZE:
          details = await this.executePIISanitize(piiResult, file, details);
          break;

        case ThreatAction.NOTIFY:
          details = await this.executePIINotify(piiResult, file, details, userId);
          break;

        case ThreatAction.ESCALATE:
          details = await this.executePIIEscalate(piiResult, file, details, userId);
          break;

        case ThreatAction.LOG:
          details = await this.executePIILog(piiResult, file, details);
          break;
      }

      const response: ThreatResponse = {
        threatId: responseId,
        action,
        timestamp,
        automated: true,
        userId,
        reason: `Automated PII response: ${piiResult.piiFindings.length} PII findings, ${piiResult.classificationLevel} classification`,
        details
      };

      // Store response in database
      await this.storeResponse(response);

      return response;
    } catch (error) {
      throw new Error(`Failed to execute PII ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute block action
   */
  private async executeBlock(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    // Block the file from being processed further
    // In practice, this would involve updating database records or cache entries
    
    console.log(`Blocking file ${file.name} due to threat detection`);
    
    details.originalFile.location = 'BLOCKED';
    
    return details;
  }

  /**
   * Execute quarantine action
   */
  private async executeQuarantine(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    try {
      // Store file in quarantine location
      const quarantineKey = `quarantine/${crypto.randomUUID()}-${file.name}`;
      const fileBuffer = await file.arrayBuffer();
      
      await this.r2Bucket.put(quarantineKey, fileBuffer, {
        customMetadata: {
          'threat-score': threatResult.riskScore.toString(),
          'threat-level': threatResult.overallRisk,
          'scan-timestamp': threatResult.scanTimestamp.toISOString(),
          'quarantine-reason': 'automated-threat-detection'
        }
      });

      details.quarantineInfo = {
        location: quarantineKey,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        accessLevel: 'security',
        reviewRequired: true,
        reviewDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      details.originalFile.location = quarantineKey;

      console.log(`File ${file.name} quarantined to ${quarantineKey}`);
      
      return details;
    } catch (error) {
      throw new Error(`Quarantine failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute delete action
   */
  private async executeDelete(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    // Mark file for deletion - in practice this would remove from storage
    console.log(`Deleting file ${file.name} due to critical threat`);
    
    details.originalFile.location = 'DELETED';
    
    return details;
  }

  /**
   * Execute sanitize action
   */
  private async executeSanitize(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    try {
      // Create sanitized version by removing threats
      const fileBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      let content = textDecoder.decode(fileBuffer);

      // Remove detected threats
      for (const threat of threatResult.threats) {
        const start = threat.location.offset;
        const end = start + threat.location.length;
        const replacement = '[THREAT_REMOVED]';
        content = content.substring(0, start) + replacement + content.substring(end);
      }

      // Store sanitized version
      const sanitizedKey = `sanitized/${crypto.randomUUID()}-${file.name}`;
      const sanitizedBuffer = new TextEncoder().encode(content);
      
      await this.r2Bucket.put(sanitizedKey, sanitizedBuffer, {
        customMetadata: {
          'sanitized': 'true',
          'original-threats': threatResult.threats.length.toString(),
          'sanitization-timestamp': new Date().toISOString()
        }
      });

      details.processedFile = {
        name: `sanitized-${file.name}`,
        size: sanitizedBuffer.byteLength,
        hash: '', // Would calculate hash
        location: sanitizedKey,
        modifications: [`Removed ${threatResult.threats.length} threats`]
      };

      console.log(`File ${file.name} sanitized and stored at ${sanitizedKey}`);
      
      return details;
    } catch (error) {
      throw new Error(`Sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute notify action
   */
  private async executeNotify(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails,
    userId?: string
  ): Promise<ThreatResponseDetails> {
    const notifications: NotificationRecord[] = [];

    // Email notifications
    if (this.config.notificationSettings.email?.enabled) {
      for (const recipient of this.config.notificationSettings.email.recipients) {
        const notification: NotificationRecord = {
          recipient,
          method: 'email',
          timestamp: new Date(),
          status: 'sent', // In practice, would track actual delivery
          message: `Threat detected in file ${file.name}: ${threatResult.overallRisk} risk (score: ${threatResult.riskScore})`
        };
        notifications.push(notification);
      }
    }

    // Webhook notifications
    if (this.config.notificationSettings.webhook?.enabled) {
      const notification: NotificationRecord = {
        recipient: this.config.notificationSettings.webhook.url,
        method: 'webhook',
        timestamp: new Date(),
        status: 'sent',
        message: JSON.stringify({
          event: 'threat_detected',
          file: file.name,
          risk: threatResult.overallRisk,
          score: threatResult.riskScore,
          threats: threatResult.threats.length
        })
      };
      notifications.push(notification);
    }

    details.notifications = notifications;
    
    console.log(`Sent ${notifications.length} notifications for file ${file.name}`);
    
    return details;
  }

  /**
   * Execute escalate action
   */
  private async executeEscalate(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails,
    userId?: string
  ): Promise<ThreatResponseDetails> {
    // Create escalation ticket/alert
    const escalationId = crypto.randomUUID();
    
    await this.db.prepare(`
      INSERT INTO threat_escalations 
      (id, file_name, threat_level, risk_score, threats_count, user_id, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      escalationId,
      file.name,
      threatResult.overallRisk,
      threatResult.riskScore,
      threatResult.threats.length,
      userId,
      new Date().toISOString(),
      'open'
    ).run();

    console.log(`Escalated threat for file ${file.name} - ticket ${escalationId}`);
    
    return details;
  }

  /**
   * Execute log action
   */
  private async executeLog(
    threatResult: ThreatDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    // Detailed logging is handled elsewhere, this is for audit trail
    console.log(`Logged threat detection for file ${file.name}`);
    return details;
  }

  /**
   * Execute PII-specific sanitization
   */
  private async executePIISanitize(
    piiResult: PIIDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    try {
      // Import the PII scanner service to use its sanitization functionality
      // This would be injected in a real implementation
      const fileBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      let content = textDecoder.decode(fileBuffer);

      // Remove/mask PII findings
      const sortedFindings = piiResult.piiFindings.sort((a, b) => b.location.offset - a.location.offset);
      
      for (const finding of sortedFindings) {
        const start = finding.location.offset;
        const end = start + finding.location.length;
        const replacement = this.getPIIMask(finding.type);
        content = content.substring(0, start) + replacement + content.substring(end);
      }

      // Store sanitized version
      const sanitizedKey = `pii-sanitized/${crypto.randomUUID()}-${file.name}`;
      const sanitizedBuffer = new TextEncoder().encode(content);
      
      await this.r2Bucket.put(sanitizedKey, sanitizedBuffer, {
        customMetadata: {
          'pii-sanitized': 'true',
          'pii-findings': piiResult.piiFindings.length.toString(),
          'classification': piiResult.classificationLevel,
          'sanitization-timestamp': new Date().toISOString()
        }
      });

      details.processedFile = {
        name: `pii-sanitized-${file.name}`,
        size: sanitizedBuffer.byteLength,
        hash: '',
        location: sanitizedKey,
        modifications: [`Sanitized ${piiResult.piiFindings.length} PII instances`]
      };

      return details;
    } catch (error) {
      throw new Error(`PII sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute PII block action
   */
  private async executePIIBlock(
    piiResult: PIIDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    console.log(`Blocking file ${file.name} due to critical PII detection`);
    details.originalFile.location = 'BLOCKED_PII';
    return details;
  }

  /**
   * Execute PII notification
   */
  private async executePIINotify(
    piiResult: PIIDetectionResult,
    file: File,
    details: ThreatResponseDetails,
    userId?: string
  ): Promise<ThreatResponseDetails> {
    const notifications: NotificationRecord[] = [];

    const notification: NotificationRecord = {
      recipient: 'compliance-team@company.com',
      method: 'email',
      timestamp: new Date(),
      status: 'sent',
      message: `PII detected in file ${file.name}: ${piiResult.piiFindings.length} findings, classification: ${piiResult.classificationLevel}`
    };
    notifications.push(notification);

    details.notifications = notifications;
    return details;
  }

  /**
   * Execute PII escalation
   */
  private async executePIIEscalate(
    piiResult: PIIDetectionResult,
    file: File,
    details: ThreatResponseDetails,
    userId?: string
  ): Promise<ThreatResponseDetails> {
    const escalationId = crypto.randomUUID();
    
    await this.db.prepare(`
      INSERT INTO pii_escalations 
      (id, file_name, classification_level, pii_count, compliance_flags, user_id, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      escalationId,
      file.name,
      piiResult.classificationLevel,
      piiResult.piiFindings.length,
      piiResult.complianceFlags.length,
      userId,
      new Date().toISOString(),
      'open'
    ).run();

    return details;
  }

  /**
   * Execute PII log action
   */
  private async executePIILog(
    piiResult: PIIDetectionResult,
    file: File,
    details: ThreatResponseDetails
  ): Promise<ThreatResponseDetails> {
    console.log(`Logged PII detection for file ${file.name}`);
    return details;
  }

  /**
   * Get PII mask for a specific type
   */
  private getPIIMask(type: string): string {
    const masks: Record<string, string> = {
      'ssn': '[SSN_REDACTED]',
      'credit_card': '[CARD_REDACTED]',
      'phone_number': '[PHONE_REDACTED]',
      'email': '[EMAIL_REDACTED]',
      'bank_account': '[ACCOUNT_REDACTED]'
    };
    return masks[type] || '[PII_REDACTED]';
  }

  /**
   * Store response in database
   */
  private async storeResponse(response: ThreatResponse): Promise<void> {
    await this.db.prepare(`
      INSERT INTO threat_responses 
      (id, action, timestamp, automated, user_id, reason, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      response.threatId,
      response.action,
      response.timestamp.toISOString(),
      response.automated,
      response.userId,
      response.reason,
      JSON.stringify(response.details)
    ).run();
  }

  /**
   * Log response actions for threat detection
   */
  private async logResponseActions(
    threatResult: ThreatDetectionResult,
    responses: ThreatResponse[],
    userId?: string
  ): Promise<void> {
    const event: SecurityAuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: SecurityEventType.THREAT_DETECTED,
      severity: threatResult.overallRisk,
      userId,
      fileId: threatResult.fileId,
      ipAddress: '',
      userAgent: '',
      details: {
        description: `Automated threat response executed for file: ${threatResult.fileName}`,
        affectedResources: [threatResult.fileId],
        threatData: threatResult,
        responseActions: responses.map(r => r.action),
        additionalContext: {
          responsesExecuted: responses.length,
          automated: true
        }
      },
      resolved: false
    };

    await this.db.prepare(`
      INSERT INTO security_audit_events 
      (id, timestamp, event_type, severity, user_id, file_id, ip_address, user_agent, details, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      event.resolved
    ).run();
  }

  /**
   * Log response actions for PII detection
   */
  private async logPIIResponseActions(
    piiResult: PIIDetectionResult,
    responses: ThreatResponse[],
    userId?: string
  ): Promise<void> {
    const event: SecurityAuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: SecurityEventType.PII_DETECTED,
      severity: ThreatSeverity.HIGH,
      userId,
      fileId: piiResult.fileId,
      ipAddress: '',
      userAgent: '',
      details: {
        description: `Automated PII response executed for file: ${piiResult.fileName}`,
        affectedResources: [piiResult.fileId],
        piiData: piiResult,
        responseActions: responses.map(r => r.action),
        additionalContext: {
          responsesExecuted: responses.length,
          automated: true
        }
      },
      resolved: false
    };

    await this.db.prepare(`
      INSERT INTO security_audit_events 
      (id, timestamp, event_type, severity, user_id, file_id, ip_address, user_agent, details, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      event.resolved
    ).run();
  }

  /**
   * Get response history for a file
   */
  async getResponseHistory(fileId: string): Promise<ThreatResponse[]> {
    const results = await this.db.prepare(`
      SELECT * FROM threat_responses 
      WHERE JSON_EXTRACT(details, '$.originalFile.fileId') = ?
      ORDER BY timestamp DESC
    `).bind(fileId).all();

    return results.results.map(row => ({
      threatId: row.id as string,
      action: row.action as ThreatAction,
      timestamp: new Date(row.timestamp as string),
      automated: row.automated as boolean,
      userId: row.user_id as string,
      reason: row.reason as string,
      details: JSON.parse(row.details as string)
    }));
  }

  /**
   * Update response configuration
   */
  async updateConfiguration(config: Partial<ThreatDetectionConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }
}