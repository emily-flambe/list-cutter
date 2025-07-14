/**
 * OAuth Rate Limiting Service
 * 
 * Multi-layered rate limiting specifically designed for OAuth flows
 * to prevent abuse and protect against various attack patterns.
 * 
 * Implements:
 * - General rate limiting for OAuth attempts
 * - Enhanced rate limiting for failed attempts
 * - Burst protection for rapid requests
 * - Suspicious activity detection
 */

import { D1Database } from '@cloudflare/workers-types';

export interface RateLimitConfig {
  // General OAuth attempts (successful + failed)
  generalLimit: number;           // Default: 30
  generalWindow: number;          // Default: 15 minutes

  // Failed OAuth attempts (additional protection)
  failureLimit: number;           // Default: 15
  failureWindow: number;          // Default: 15 minutes

  // Burst protection (rapid requests)
  burstLimit: number;             // Default: 15
  burstWindow: number;            // Default: 1 minute

  // Suspicious activity thresholds
  suspiciousThreshold: number;    // Default: 10 failures in 5 minutes
  suspiciousWindow: number;       // Default: 5 minutes
}

export interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetTime?: number;
  reason?: string;
  severity?: 'warning' | 'error' | 'critical';
}

export interface RequestContext {
  ip_address: string;
  user_agent?: string;
  user_id?: number;
  event_type: 'attempt' | 'failure' | 'success';
}

export class OAuthRateLimiter {
  private db: D1Database;
  private config: RateLimitConfig;

  constructor(db: D1Database, config?: Partial<RateLimitConfig>) {
    this.db = db;
    this.config = {
      generalLimit: config?.generalLimit || 30,
      generalWindow: config?.generalWindow || 15 * 60 * 1000, // 15 minutes
      failureLimit: config?.failureLimit || 15,
      failureWindow: config?.failureWindow || 15 * 60 * 1000, // 15 minutes
      burstLimit: config?.burstLimit || 15,
      burstWindow: config?.burstWindow || 60 * 1000, // 1 minute
      suspiciousThreshold: config?.suspiciousThreshold || 10,
      suspiciousWindow: config?.suspiciousWindow || 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Checks if OAuth request should be allowed based on rate limits
   * Returns detailed information about rate limit status
   */
  async checkRateLimit(context: RequestContext): Promise<RateLimitResult> {
    try {
      // Clean up expired rate limit records
      await this.cleanupExpiredRecords();

      // Check general rate limit (all OAuth attempts)
      const generalCheck = await this.checkGeneralRateLimit(context);
      if (!generalCheck.allowed) {
        return generalCheck;
      }

      // Check burst protection (rapid requests)
      const burstCheck = await this.checkBurstProtection(context);
      if (!burstCheck.allowed) {
        return burstCheck;
      }

      // For failure events, check enhanced failure rate limit
      if (context.event_type === 'failure') {
        const failureCheck = await this.checkFailureRateLimit(context);
        if (!failureCheck.allowed) {
          return failureCheck;
        }

        // Check for suspicious activity patterns
        const suspiciousCheck = await this.checkSuspiciousActivity(context);
        if (!suspiciousCheck.allowed) {
          return suspiciousCheck;
        }
      }

      // Record this request for future rate limiting
      await this.recordRequest(context);

      return {
        allowed: true,
        remaining: await this.getRemainingRequests(context),
        resetTime: await this.getResetTime(context),
      };

    } catch (error) {
      console.error('Rate limiting check failed:', error);
      
      // Fail safe: allow request but log the error
      // In production, you might want to fail closed for security
      return {
        allowed: true,
        reason: 'Rate limit check failed - allowing request',
        severity: 'error',
      };
    }
  }

  /**
   * Records successful or failed OAuth attempt for rate limiting
   */
  async recordOAuthEvent(context: RequestContext): Promise<void> {
    await this.recordRequest(context);
  }

  /**
   * Gets current rate limit status without recording new request
   */
  async getRateLimitStatus(ip_address: string, user_id?: number): Promise<{
    general: { count: number; limit: number; remaining: number };
    burst: { count: number; limit: number; remaining: number };
    failures: { count: number; limit: number; remaining: number };
  }> {
    const now = new Date().toISOString();
    
    const [generalCount, burstCount, failureCount] = await Promise.all([
      this.getRequestCount(ip_address, this.config.generalWindow, ['attempt', 'failure', 'success']),
      this.getRequestCount(ip_address, this.config.burstWindow, ['attempt', 'failure', 'success']),
      this.getRequestCount(ip_address, this.config.failureWindow, ['failure']),
    ]);

    return {
      general: {
        count: generalCount,
        limit: this.config.generalLimit,
        remaining: Math.max(0, this.config.generalLimit - generalCount),
      },
      burst: {
        count: burstCount,
        limit: this.config.burstLimit,
        remaining: Math.max(0, this.config.burstLimit - burstCount),
      },
      failures: {
        count: failureCount,
        limit: this.config.failureLimit,
        remaining: Math.max(0, this.config.failureLimit - failureCount),
      },
    };
  }

  /**
   * Checks general rate limit (all OAuth requests)
   */
  private async checkGeneralRateLimit(context: RequestContext): Promise<RateLimitResult> {
    const count = await this.getRequestCount(
      context.ip_address, 
      this.config.generalWindow,
      ['attempt', 'failure', 'success']
    );

    if (count >= this.config.generalLimit) {
      return {
        allowed: false,
        reason: 'General rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + this.config.generalWindow,
        severity: 'warning',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks burst protection (rapid requests in short time)
   */
  private async checkBurstProtection(context: RequestContext): Promise<RateLimitResult> {
    const count = await this.getRequestCount(
      context.ip_address,
      this.config.burstWindow,
      ['attempt', 'failure', 'success']
    );

    if (count >= this.config.burstLimit) {
      return {
        allowed: false,
        reason: 'Burst rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + this.config.burstWindow,
        severity: 'warning',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks enhanced rate limit for failed OAuth attempts
   */
  private async checkFailureRateLimit(context: RequestContext): Promise<RateLimitResult> {
    const count = await this.getRequestCount(
      context.ip_address,
      this.config.failureWindow,
      ['failure']
    );

    if (count >= this.config.failureLimit) {
      return {
        allowed: false,
        reason: 'Failure rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + this.config.failureWindow,
        severity: 'error',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks for suspicious activity patterns
   */
  private async checkSuspiciousActivity(context: RequestContext): Promise<RateLimitResult> {
    const failureCount = await this.getRequestCount(
      context.ip_address,
      this.config.suspiciousWindow,
      ['failure']
    );

    if (failureCount >= this.config.suspiciousThreshold) {
      return {
        allowed: false,
        reason: 'Suspicious activity detected',
        remaining: 0,
        resetTime: Date.now() + this.config.suspiciousWindow,
        severity: 'critical',
      };
    }

    return { allowed: true };
  }

  /**
   * Records OAuth request in rate limiting table
   */
  private async recordRequest(context: RequestContext): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO oauth_rate_limits (ip_address, user_id, event_type, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(context.ip_address, context.user_id || null, context.event_type)
      .run();
  }

  /**
   * Gets request count for IP address within time window
   */
  private async getRequestCount(
    ip_address: string, 
    windowMs: number, 
    eventTypes: string[]
  ): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs).toISOString();
    
    const placeholders = eventTypes.map(() => '?').join(',');
    const query = `
      SELECT COUNT(*) as count 
      FROM oauth_rate_limits 
      WHERE ip_address = ? 
        AND event_type IN (${placeholders})
        AND created_at > ?
    `;

    const result = await this.db
      .prepare(query)
      .bind(ip_address, ...eventTypes, windowStart)
      .first();

    return Number(result?.count) || 0;
  }

  /**
   * Gets remaining requests for current window
   */
  private async getRemainingRequests(context: RequestContext): Promise<number> {
    const count = await this.getRequestCount(
      context.ip_address,
      this.config.generalWindow,
      ['attempt', 'failure', 'success']
    );

    return Math.max(0, this.config.generalLimit - count);
  }

  /**
   * Gets reset time for current rate limit window
   */
  private async getResetTime(context: RequestContext): Promise<number> {
    // Find the oldest request in the current window
    const windowStart = new Date(Date.now() - this.config.generalWindow).toISOString();
    
    const result = await this.db
      .prepare(`
        SELECT created_at 
        FROM oauth_rate_limits 
        WHERE ip_address = ? AND created_at > ?
        ORDER BY created_at ASC 
        LIMIT 1
      `)
      .bind(context.ip_address, windowStart)
      .first();

    if (result?.created_at) {
      const oldestRequest = new Date(result.created_at).getTime();
      return oldestRequest + this.config.generalWindow;
    }

    return Date.now() + this.config.generalWindow;
  }

  /**
   * Cleans up expired rate limit records to prevent table bloat
   */
  private async cleanupExpiredRecords(): Promise<void> {
    // Only clean up records older than the longest window + buffer
    const maxWindow = Math.max(
      this.config.generalWindow,
      this.config.failureWindow,
      this.config.burstWindow,
      this.config.suspiciousWindow
    );

    const cutoffTime = new Date(Date.now() - maxWindow - 60000).toISOString(); // Add 1 minute buffer

    await this.db
      .prepare('DELETE FROM oauth_rate_limits WHERE created_at < ?')
      .bind(cutoffTime)
      .run();
  }

  /**
   * Gets comprehensive rate limit analytics for monitoring
   */
  async getRateLimitAnalytics(hours: number = 24): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    blockedRequests: number;
    topSourceIPs: Array<{ ip: string; count: number }>;
    requestsPerHour: Array<{ hour: string; count: number }>;
  }> {
    const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const [totalRequests, successCount, failureCount, topIPs, hourlyData] = await Promise.all([
      this.db.prepare(`
        SELECT COUNT(*) as count FROM oauth_rate_limits WHERE created_at > ?
      `).bind(windowStart).first(),
      
      this.db.prepare(`
        SELECT COUNT(*) as count FROM oauth_rate_limits 
        WHERE created_at > ? AND event_type = 'success'
      `).bind(windowStart).first(),
      
      this.db.prepare(`
        SELECT COUNT(*) as count FROM oauth_rate_limits 
        WHERE created_at > ? AND event_type = 'failure'
      `).bind(windowStart).first(),
      
      this.db.prepare(`
        SELECT ip_address as ip, COUNT(*) as count 
        FROM oauth_rate_limits 
        WHERE created_at > ? 
        GROUP BY ip_address 
        ORDER BY count DESC 
        LIMIT 10
      `).bind(windowStart).all(),
      
      this.db.prepare(`
        SELECT 
          strftime('%Y-%m-%d %H:00:00', created_at) as hour,
          COUNT(*) as count
        FROM oauth_rate_limits 
        WHERE created_at > ?
        GROUP BY hour
        ORDER BY hour
      `).bind(windowStart).all(),
    ]);

    return {
      totalRequests: Number(totalRequests?.count) || 0,
      successfulRequests: Number(successCount?.count) || 0,
      failedRequests: Number(failureCount?.count) || 0,
      blockedRequests: 0, // Would need additional tracking for blocked requests
      topSourceIPs: (topIPs.results || []).map(row => ({
        ip: String(row.ip),
        count: Number(row.count),
      })),
      requestsPerHour: (hourlyData.results || []).map(row => ({
        hour: String(row.hour),
        count: Number(row.count),
      })),
    };
  }
}