import type { Env } from '../../types';
import { SecurityEvent, SecurityLogger } from './logger';

export interface ThreatRule {
  name: string;
  description: string;
  condition: (events: SecurityEvent[]) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'block' | 'alert';
}

export const THREAT_RULES: ThreatRule[] = [
  {
    name: 'brute_force_login',
    description: 'Multiple failed login attempts from same IP',
    condition: (events) => {
      const failedLogins = events.filter(e => 
        e.event_type === 'login_failed' && 
        Date.now() - e.timestamp < 300000 // 5 minutes
      );
      return failedLogins.length >= 5;
    },
    severity: 'high',
    action: 'block'
  },
  {
    name: 'token_manipulation',
    description: 'Multiple invalid token attempts',
    condition: (events) => {
      const invalidTokens = events.filter(e => 
        e.event_type === 'invalid_token' && 
        Date.now() - e.timestamp < 300000 // 5 minutes
      );
      return invalidTokens.length >= 10;
    },
    severity: 'medium',
    action: 'alert'
  },
  {
    name: 'account_enumeration',
    description: 'Systematic username enumeration attempt',
    condition: (events) => {
      const registrationAttempts = events.filter(e => 
        e.event_type === 'registration_failed' && 
        Date.now() - e.timestamp < 600000 // 10 minutes
      );
      return registrationAttempts.length >= 20;
    },
    severity: 'medium',
    action: 'alert'
  },
  {
    name: 'rate_limit_bypass',
    description: 'Attempts to bypass rate limiting',
    condition: (events) => {
      const rateLimitHits = events.filter(e => 
        e.event_type === 'rate_limit_exceeded' && 
        Date.now() - e.timestamp < 60000 // 1 minute
      );
      return rateLimitHits.length >= 10;
    },
    severity: 'high',
    action: 'block'
  },
  {
    name: 'distributed_attack',
    description: 'Coordinated attack from multiple IPs',
    condition: (events) => {
      const recentFailures = events.filter(e => 
        !e.success && 
        Date.now() - e.timestamp < 600000 // 10 minutes
      );
      const uniqueIPs = new Set(recentFailures.map(e => e.ip_address));
      return uniqueIPs.size >= 10 && recentFailures.length >= 50;
    },
    severity: 'critical',
    action: 'alert'
  },
  {
    name: 'suspicious_user_agent',
    description: 'Suspicious or automated user agent patterns',
    condition: (events) => {
      const suspiciousPatterns = [
        /bot/i, /crawler/i, /spider/i, /scan/i, /curl/i, /wget/i
      ];
      
      return events.some(e => {
        if (!e.user_agent) return false;
        return suspiciousPatterns.some(pattern => pattern.test(e.user_agent!));
      });
    },
    severity: 'low',
    action: 'log'
  },
  {
    name: 'rapid_succession_requests',
    description: 'Unusually rapid API requests from single source',
    condition: (events) => {
      const recentRequests = events.filter(e => 
        e.event_type === 'api_request' && 
        Date.now() - e.timestamp < 60000 // 1 minute
      );
      return recentRequests.length >= 100;
    },
    severity: 'medium',
    action: 'alert'
  }
];

export class ThreatDetector {
  private env: Env;
  private logger: SecurityLogger;
  
  constructor(env: Env, logger: SecurityLogger) {
    this.env = env;
    this.logger = logger;
  }
  
  /**
   * Analyze a security event against all threat detection rules
   */
  async analyzeEvent(event: SecurityEvent): Promise<void> {
    const ipAddress = event.ip_address;
    if (!ipAddress) return;
    
    try {
      // Get recent events for this IP
      const recentEvents = await this.logger.getRecentEvents({
        ip_address: ipAddress,
        minutes: 60
      });
      recentEvents.push(event);
      
      // Check each threat rule
      for (const rule of THREAT_RULES) {
        if (rule.condition(recentEvents)) {
          await this.handleThreat(rule, event, recentEvents);
        }
      }
      
    } catch (error) {
      console.error('Failed to analyze security event:', error);
    }
  }
  
  /**
   * Check if an IP address is currently blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      const blocked = await this.env.AUTH_KV.get(`blocked_ip:${ipAddress}`);
      if (!blocked) return false;
      
      const blockData = JSON.parse(blocked);
      return Date.now() < blockData.expires_at;
      
    } catch (error) {
      console.error('Failed to check IP block status:', error);
      return false;
    }
  }
  
  /**
   * Get blocking information for an IP address
   */
  async getIPBlockInfo(ipAddress: string): Promise<{
    blocked: boolean;
    reason?: string;
    expires_at?: number;
    severity?: string;
  }> {
    try {
      const blocked = await this.env.AUTH_KV.get(`blocked_ip:${ipAddress}`);
      if (!blocked) return { blocked: false };
      
      const blockData = JSON.parse(blocked);
      if (Date.now() >= blockData.expires_at) {
        return { blocked: false };
      }
      
      return {
        blocked: true,
        reason: blockData.reason,
        expires_at: blockData.expires_at,
        severity: blockData.severity
      };
      
    } catch (error) {
      console.error('Failed to get IP block info:', error);
      return { blocked: false };
    }
  }
  
  /**
   * Manually block an IP address
   */
  async blockIP(
    ipAddress: string, 
    reason: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    customDuration?: number
  ): Promise<void> {
    const blockDuration = customDuration || this.getBlockDuration(severity);
    
    const blockData = {
      blocked_at: Date.now(),
      expires_at: Date.now() + (blockDuration * 1000),
      severity,
      reason,
      manual: true
    };
    
    await this.env.AUTH_KV.put(
      `blocked_ip:${ipAddress}`,
      JSON.stringify(blockData),
      { expirationTtl: blockDuration }
    );
    
    // Log the manual block
    await this.logger.logEvent({
      timestamp: Date.now(),
      event_type: 'ip_blocked_manual',
      ip_address: ipAddress,
      success: false,
      metadata: {
        reason,
        severity,
        duration_seconds: blockDuration,
        expires_at: blockData.expires_at
      }
    });
  }
  
  /**
   * Remove an IP block
   */
  async unblockIP(ipAddress: string, reason: string): Promise<void> {
    await this.env.AUTH_KV.delete(`blocked_ip:${ipAddress}`);
    
    // Log the unblock
    await this.logger.logEvent({
      timestamp: Date.now(),
      event_type: 'ip_unblocked',
      ip_address: ipAddress,
      success: true,
      metadata: { reason }
    });
  }
  
  /**
   * Handle a detected threat
   */
  private async handleThreat(
    rule: ThreatRule, 
    event: SecurityEvent, 
    events: SecurityEvent[]
  ): Promise<void> {
    // Log the threat detection
    await this.logger.logEvent({
      timestamp: Date.now(),
      event_type: 'threat_detected',
      ip_address: event.ip_address,
      user_id: event.user_id,
      success: false,
      metadata: {
        rule_name: rule.name,
        rule_description: rule.description,
        severity: rule.severity,
        action: rule.action,
        triggering_events: events.length,
        event_types: [...new Set(events.map(e => e.event_type))]
      }
    });
    
    // Take action based on rule
    switch (rule.action) {
      case 'block':
        if (event.ip_address) {
          await this.blockIPForThreat(event.ip_address, rule);
        }
        break;
      case 'alert':
        await this.sendAlert(rule, event, events);
        break;
      case 'log':
        // Already logged above
        break;
    }
  }
  
  /**
   * Block an IP address due to threat detection
   */
  private async blockIPForThreat(ipAddress: string, rule: ThreatRule): Promise<void> {
    const blockDuration = this.getBlockDuration(rule.severity);
    
    const blockData = {
      blocked_at: Date.now(),
      expires_at: Date.now() + (blockDuration * 1000),
      severity: rule.severity,
      reason: `Threat detected: ${rule.name}`,
      rule_name: rule.name,
      manual: false
    };
    
    await this.env.AUTH_KV.put(
      `blocked_ip:${ipAddress}`,
      JSON.stringify(blockData),
      { expirationTtl: blockDuration }
    );
    
    // Log the automatic block
    await this.logger.logEvent({
      timestamp: Date.now(),
      event_type: 'ip_blocked_automatic',
      ip_address: ipAddress,
      success: false,
      metadata: {
        rule_name: rule.name,
        rule_description: rule.description,
        severity: rule.severity,
        duration_seconds: blockDuration,
        expires_at: blockData.expires_at
      }
    });
  }
  
  /**
   * Send security alert (in production, this would integrate with monitoring systems)
   */
  private async sendAlert(
    rule: ThreatRule, 
    event: SecurityEvent, 
    events: SecurityEvent[]
  ): Promise<void> {
    const alertData = {
      rule_name: rule.name,
      description: rule.description,
      severity: rule.severity,
      ip_address: event.ip_address,
      user_id: event.user_id,
      timestamp: new Date(event.timestamp).toISOString(),
      event_count: events.length,
      unique_endpoints: [...new Set(events.map(e => e.endpoint).filter(Boolean))],
      time_window: this.getTimeWindow(events)
    };
    
    // Log the alert
    console.warn(`SECURITY ALERT: ${rule.name}`, alertData);
    
    // In production, this would send to:
    // - Slack/Discord webhook
    // - Email notification
    // - PagerDuty/monitoring system
    // - Security incident management system
    
    // Store alert for dashboard
    await this.env.AUTH_KV.put(
      `security_alert:${crypto.randomUUID()}`,
      JSON.stringify(alertData),
      { expirationTtl: 86400 } // 24 hours
    );
  }
  
  /**
   * Get block duration based on severity
   */
  private getBlockDuration(severity: string): number {
    switch (severity) {
      case 'critical': return 86400; // 24 hours
      case 'high': return 3600;     // 1 hour
      case 'medium': return 900;    // 15 minutes
      case 'low': return 300;       // 5 minutes
      default: return 300;
    }
  }
  
  /**
   * Calculate time window for events
   */
  private getTimeWindow(events: SecurityEvent[]): {
    start: string;
    end: string;
    duration_minutes: number;
  } {
    if (events.length === 0) {
      return { start: '', end: '', duration_minutes: 0 };
    }
    
    const timestamps = events.map(e => e.timestamp).sort((a, b) => a - b);
    const start = timestamps[0];
    const end = timestamps[timestamps.length - 1];
    
    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      duration_minutes: Math.round((end - start) / 60000)
    };
  }
  
  /**
   * Get threat detection statistics
   */
  async getThreatStats(hours: number = 24): Promise<{
    total_threats: number;
    threats_by_type: Record<string, number>;
    blocked_ips: number;
    alerts_sent: number;
  }> {
    const sinceTimestamp = Date.now() - (hours * 60 * 60 * 1000);
    
    try {
      // Get threat detection events
      const threatEvents = await this.logger.getRecentEvents({
        event_type: 'threat_detected',
        minutes: hours * 60
      });
      
      // Get IP block events
      const blockEvents = await this.logger.getRecentEvents({
        event_type: 'ip_blocked_automatic',
        minutes: hours * 60
      });
      
      // Count threats by rule name
      const threatsByType: Record<string, number> = {};
      threatEvents.forEach(event => {
        const ruleName = event.metadata?.rule_name || 'unknown';
        threatsByType[ruleName] = (threatsByType[ruleName] || 0) + 1;
      });
      
      return {
        total_threats: threatEvents.length,
        threats_by_type: threatsByType,
        blocked_ips: blockEvents.length,
        alerts_sent: threatEvents.filter(e => e.metadata?.action === 'alert').length
      };
      
    } catch (error) {
      console.error('Failed to get threat stats:', error);
      return {
        total_threats: 0,
        threats_by_type: {},
        blocked_ips: 0,
        alerts_sent: 0
      };
    }
  }
}