import type { Env } from '../../types';

export interface SecurityEvent {
  timestamp: number;
  event_type: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  method?: string;
  success: boolean;
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export class SecurityLogger {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async logEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      id: crypto.randomUUID()
    };
    
    try {
      // Store in KV with TTL for recent events (30 days)
      await this.env.AUTH_KV.put(
        `security_log:${logEntry.id}`,
        JSON.stringify(logEntry),
        { expirationTtl: 2592000 } // 30 days
      );
      
      // Store in D1 for long-term analysis
      await this.env.DB.prepare(`
        INSERT INTO security_events (
          id, timestamp, event_type, user_id, ip_address, 
          user_agent, endpoint, method, success, error_code, 
          error_message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logEntry.id,
        logEntry.timestamp,
        logEntry.event_type,
        logEntry.user_id,
        logEntry.ip_address,
        logEntry.user_agent,
        logEntry.endpoint,
        logEntry.method,
        logEntry.success ? 1 : 0,
        logEntry.error_code,
        logEntry.error_message,
        JSON.stringify(logEntry.metadata || {})
      ).run();
      
      // Check for threat patterns after logging
      await this.checkThreatPatterns(logEntry);
      
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - logging failures shouldn't break the application
    }
  }
  
  /**
   * Log authentication events (login, logout, registration, etc.)
   */
  async logAuthEvent(
    eventType: 'login' | 'logout' | 'registration' | 'token_refresh' | 'password_reset',
    request: Request,
    success: boolean,
    userId?: number,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const url = new URL(request.url);
    
    await this.logEvent({
      timestamp: Date.now(),
      event_type: success ? `${eventType}_success` : `${eventType}_failed`,
      user_id: userId,
      ip_address: this.getClientIP(request),
      user_agent: request.headers.get('User-Agent') || undefined,
      endpoint: url.pathname,
      method: request.method,
      success,
      error_code: errorCode,
      error_message: errorMessage,
      metadata
    });
  }
  
  /**
   * Log security violations and suspicious activity
   */
  async logSecurityViolation(
    violationType: 'rate_limit_exceeded' | 'invalid_token' | 'unauthorized_access' | 'suspicious_activity',
    request: Request,
    details?: Record<string, any>
  ): Promise<void> {
    const url = new URL(request.url);
    
    await this.logEvent({
      timestamp: Date.now(),
      event_type: violationType,
      ip_address: this.getClientIP(request),
      user_agent: request.headers.get('User-Agent') || undefined,
      endpoint: url.pathname,
      method: request.method,
      success: false,
      metadata: details
    });
  }
  
  /**
   * Log API requests for performance monitoring
   */
  async logAPIRequest(
    request: Request,
    response: Response,
    userId?: number,
    startTime?: number
  ): Promise<void> {
    const url = new URL(request.url);
    const endTime = Date.now();
    const responseTime = startTime ? endTime - startTime : undefined;
    
    await this.logEvent({
      timestamp: endTime,
      event_type: 'api_request',
      user_id: userId,
      ip_address: this.getClientIP(request),
      user_agent: request.headers.get('User-Agent') || undefined,
      endpoint: url.pathname,
      method: request.method,
      success: response.status < 400,
      metadata: {
        status_code: response.status,
        response_time: responseTime,
        content_length: response.headers.get('Content-Length'),
        query_params: Object.fromEntries(url.searchParams.entries())
      }
    });
  }
  
  /**
   * Check for threat patterns after logging an event
   */
  private async checkThreatPatterns(event: SecurityEvent): Promise<void> {
    if (!event.ip_address) return;
    
    try {
      // Check for brute force attacks on failed login attempts
      if (event.event_type === 'login_failed') {
        await this.checkBruteForce(event.ip_address);
      }
      
      // Check for token manipulation attempts
      if (event.event_type === 'invalid_token') {
        await this.checkTokenManipulation(event.ip_address);
      }
      
      // Check for rate limit violations
      if (event.event_type === 'rate_limit_exceeded') {
        await this.checkRateLimitBypass(event.ip_address);
      }
      
    } catch (error) {
      console.error('Failed to check threat patterns:', error);
    }
  }
  
  /**
   * Check for brute force login attempts
   */
  private async checkBruteForce(ipAddress: string): Promise<void> {
    const window = 300000; // 5 minutes
    const threshold = 5; // 5 failed attempts
    
    const key = `brute_force:${ipAddress}:${Math.floor(Date.now() / window)}`;
    const current = await this.env.AUTH_KV.get(key);
    const count = current ? parseInt(current) + 1 : 1;
    
    await this.env.AUTH_KV.put(
      key,
      count.toString(),
      { expirationTtl: Math.ceil(window / 1000) }
    );
    
    if (count >= threshold) {
      await this.logEvent({
        timestamp: Date.now(),
        event_type: 'brute_force_detected',
        ip_address: ipAddress,
        success: false,
        metadata: { 
          failed_attempts: count,
          window_minutes: window / 60000,
          threshold
        }
      });
    }
  }
  
  /**
   * Check for token manipulation attempts
   */
  private async checkTokenManipulation(ipAddress: string): Promise<void> {
    const window = 300000; // 5 minutes
    const threshold = 10; // 10 invalid token attempts
    
    const key = `token_manipulation:${ipAddress}:${Math.floor(Date.now() / window)}`;
    const current = await this.env.AUTH_KV.get(key);
    const count = current ? parseInt(current) + 1 : 1;
    
    await this.env.AUTH_KV.put(
      key,
      count.toString(),
      { expirationTtl: Math.ceil(window / 1000) }
    );
    
    if (count >= threshold) {
      await this.logEvent({
        timestamp: Date.now(),
        event_type: 'token_manipulation_detected',
        ip_address: ipAddress,
        success: false,
        metadata: { 
          invalid_attempts: count,
          window_minutes: window / 60000,
          threshold
        }
      });
    }
  }
  
  /**
   * Check for rate limit bypass attempts
   */
  private async checkRateLimitBypass(ipAddress: string): Promise<void> {
    const window = 60000; // 1 minute
    const threshold = 10; // 10 rate limit hits
    
    const key = `rate_limit_bypass:${ipAddress}:${Math.floor(Date.now() / window)}`;
    const current = await this.env.AUTH_KV.get(key);
    const count = current ? parseInt(current) + 1 : 1;
    
    await this.env.AUTH_KV.put(
      key,
      count.toString(),
      { expirationTtl: Math.ceil(window / 1000) }
    );
    
    if (count >= threshold) {
      await this.logEvent({
        timestamp: Date.now(),
        event_type: 'rate_limit_bypass_detected',
        ip_address: ipAddress,
        success: false,
        metadata: { 
          rate_limit_hits: count,
          window_minutes: window / 60000,
          threshold
        }
      });
    }
  }
  
  /**
   * Get client IP address from request headers
   */
  private getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           request.headers.get('X-Real-IP') ||
           'unknown';
  }
  
  /**
   * Get recent security events for analysis
   */
  async getRecentEvents(
    filters: {
      ip_address?: string;
      user_id?: number;
      event_type?: string;
      minutes?: number;
    } = {}
  ): Promise<SecurityEvent[]> {
    const { ip_address, user_id, event_type, minutes = 60 } = filters;
    const sinceTimestamp = Date.now() - (minutes * 60000);
    
    let query = `
      SELECT * FROM security_events 
      WHERE timestamp > ?
    `;
    const params: any[] = [sinceTimestamp];
    
    if (ip_address) {
      query += ` AND ip_address = ?`;
      params.push(ip_address);
    }
    
    if (user_id) {
      query += ` AND user_id = ?`;
      params.push(user_id);
    }
    
    if (event_type) {
      query += ` AND event_type = ?`;
      params.push(event_type);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT 100`;
    
    try {
      const results = await this.env.DB.prepare(query).bind(...params).all();
      
      return results.results.map(row => ({
        timestamp: row.timestamp as number,
        event_type: row.event_type as string,
        user_id: row.user_id as number | undefined,
        ip_address: row.ip_address as string | undefined,
        user_agent: row.user_agent as string | undefined,
        endpoint: row.endpoint as string | undefined,
        method: row.method as string | undefined,
        success: Boolean(row.success),
        error_code: row.error_code as string | undefined,
        error_message: row.error_message as string | undefined,
        metadata: JSON.parse(row.metadata as string || '{}')
      }));
      
    } catch (error) {
      console.error('Failed to get recent events:', error);
      return [];
    }
  }
}