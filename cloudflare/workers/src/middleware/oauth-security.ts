/**
 * OAuth Security Middleware
 * 
 * Comprehensive security middleware for OAuth endpoints that provides:
 * - Multi-layered rate limiting
 * - Input validation and sanitization  
 * - Security event logging
 * - Request context enrichment
 * - Attack pattern detection
 * 
 * This middleware should be applied to all OAuth routes for maximum protection.
 */

import { Context } from 'hono';
import { HonoRequest } from 'hono';
import { OAuthRateLimiter, RequestContext } from '../services/auth/oauth-rate-limiter';

export interface OAuthSecurityConfig {
  enableRateLimiting: boolean;
  enableSecurityLogging: boolean;
  enableInputValidation: boolean;
  blockSuspiciousActivity: boolean;
  
  // Custom rate limit overrides
  rateLimitConfig?: {
    generalLimit?: number;
    failureLimit?: number;
    burstLimit?: number;
  };
}

export interface SecurityContext {
  ip_address: string;
  user_agent: string;
  user_id?: number;
  request_id: string;
  timestamp: number;
  
  // Rate limiting info
  rate_limit_status?: {
    remaining: number;
    resetTime: number;
  };
  
  // Security flags
  is_suspicious?: boolean;
  security_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  blocked: boolean;
  reason?: string;
}

export class OAuthSecurityMiddleware {
  private rateLimiter: OAuthRateLimiter;
  private config: OAuthSecurityConfig;

  constructor(
    rateLimiter: OAuthRateLimiter,
    config: OAuthSecurityConfig = {
      enableRateLimiting: true,
      enableSecurityLogging: true,
      enableInputValidation: true,
      blockSuspiciousActivity: true,
    }
  ) {
    this.rateLimiter = rateLimiter;
    this.config = config;
  }

  /**
   * Main security middleware function for OAuth routes
   */
  async securityCheck(c: Context, eventType: 'attempt' | 'failure' | 'success' = 'attempt') {
    const securityContext = await this.buildSecurityContext(c);
    
    // Log security event
    if (this.config.enableSecurityLogging) {
      await this.logSecurityEvent(c, 'oauth_request', 'info', {
        event_type: eventType,
        security_context: securityContext,
      });
    }

    // Input validation
    if (this.config.enableInputValidation) {
      const validation = await this.validateRequest(c, eventType);
      if (!validation.valid || validation.blocked) {
        await this.logSecurityEvent(c, 'oauth_validation_failed', 'warning', {
          errors: validation.errors,
          warnings: validation.warnings,
          reason: validation.reason,
        });

        return c.json({
          error: 'Invalid request',
          message: validation.reason || 'Request validation failed',
        }, 400);
      }
    }

    // Rate limiting check
    if (this.config.enableRateLimiting) {
      const requestContext: RequestContext = {
        ip_address: securityContext.ip_address,
        user_agent: securityContext.user_agent,
        user_id: securityContext.user_id,
        event_type: eventType,
      };

      const rateLimitResult = await this.rateLimiter.checkRateLimit(requestContext);
      
      if (!rateLimitResult.allowed) {
        await this.logSecurityEvent(c, 'oauth_rate_limited', 'warning', {
          reason: rateLimitResult.reason,
          severity: rateLimitResult.severity,
          remaining: rateLimitResult.remaining,
          reset_time: rateLimitResult.resetTime,
        });

        // Set rate limit headers
        c.header('X-RateLimit-Limit', this.config.rateLimitConfig?.generalLimit?.toString() || '30');
        c.header('X-RateLimit-Remaining', (rateLimitResult.remaining || 0).toString());
        c.header('X-RateLimit-Reset', (rateLimitResult.resetTime || Date.now()).toString());

        return c.json({
          error: 'Rate limit exceeded',
          message: rateLimitResult.reason,
          retry_after: rateLimitResult.resetTime,
        }, 429);
      }

      // Add rate limit info to security context
      securityContext.rate_limit_status = {
        remaining: rateLimitResult.remaining || 0,
        resetTime: rateLimitResult.resetTime || Date.now(),
      };
    }

    // Store security context for use in route handlers
    c.set('securityContext', securityContext);

    // Add security headers
    this.addSecurityHeaders(c);
  }

  /**
   * Records OAuth event after processing (success/failure)
   */
  async recordOAuthEvent(c: Context, eventType: 'success' | 'failure', details?: any) {
    const securityContext = c.get('securityContext') as SecurityContext;
    
    if (!securityContext) {
      console.warn('Security context not found - OAuth event not recorded');
      return;
    }

    // Record in rate limiter
    if (this.config.enableRateLimiting) {
      await this.rateLimiter.recordOAuthEvent({
        ip_address: securityContext.ip_address,
        user_agent: securityContext.user_agent,
        user_id: securityContext.user_id,
        event_type: eventType,
      });
    }

    // Log security event
    if (this.config.enableSecurityLogging) {
      await this.logSecurityEvent(c, `oauth_${eventType}`, eventType === 'success' ? 'info' : 'warning', {
        event_type: eventType,
        details,
        security_context: securityContext,
      });
    }
  }

  /**
   * Builds comprehensive security context from request
   */
  private async buildSecurityContext(c: Context): Promise<SecurityContext> {
    const request = c.req;
    
    // Extract IP address with proxy support
    const ip_address = this.extractIPAddress(request);
    
    // Extract and validate user agent
    const user_agent = request.header('User-Agent') || 'unknown';
    
    // Generate unique request ID for tracking
    const request_id = crypto.randomUUID();
    
    // Basic security level assessment
    const security_level = this.assessSecurityLevel(ip_address, user_agent);
    
    return {
      ip_address,
      user_agent,
      request_id,
      timestamp: Date.now(),
      security_level,
    };
  }

  /**
   * Extracts real IP address with support for proxies and CDN
   */
  private extractIPAddress(request: HonoRequest): string {
    // Check Cloudflare headers first
    const cfConnectingIP = request.header('CF-Connecting-IP');
    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    // Check other common proxy headers
    const xForwardedFor = request.header('X-Forwarded-For');
    if (xForwardedFor) {
      // Take the first IP in the chain
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = request.header('X-Real-IP');
    if (xRealIP) {
      return xRealIP;
    }

    // Fallback to connection info (may not be available in all environments)
    return 'unknown';
  }

  /**
   * Assesses basic security level based on request characteristics
   */
  private assessSecurityLevel(ip_address: string, user_agent: string): 'low' | 'medium' | 'high' | 'critical' {
    let risk_score = 0;

    // IP address checks
    if (ip_address === 'unknown') risk_score += 2;
    if (this.isPrivateIP(ip_address)) risk_score += 1;

    // User agent checks
    if (user_agent === 'unknown') risk_score += 2;
    if (this.isSuspiciousUserAgent(user_agent)) risk_score += 3;
    if (user_agent.length < 10) risk_score += 1;

    // Risk level mapping
    if (risk_score >= 5) return 'critical';
    if (risk_score >= 3) return 'high';
    if (risk_score >= 1) return 'medium';
    return 'low';
  }

  /**
   * Checks if IP address is in private ranges
   */
  private isPrivateIP(ip: string): boolean {
    if (ip === 'unknown') return false;
    
    // Basic private IP detection (IPv4 only for simplicity)
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Checks for suspicious user agent patterns
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /^$/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Validates OAuth request parameters and format
   */
  private async validateRequest(c: Context, eventType: string): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const url = new URL(c.req.url);
    const path = url.pathname;

    // Validate OAuth initiation request
    if (path.includes('/auth/google') && !path.includes('/callback')) {
      const returnUrl = url.searchParams.get('return_url');
      
      if (returnUrl) {
        if (!this.isValidReturnUrl(returnUrl)) {
          errors.push('Invalid return URL format');
        }
        if (returnUrl.length > 500) {
          errors.push('Return URL too long');
        }
      }
    }

    // Validate OAuth callback request
    if (path.includes('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (!code && !error) {
        errors.push('Missing authorization code or error parameter');
      }

      if (code) {
        if (typeof code !== 'string' || code.length < 10 || code.length > 512) {
          errors.push('Invalid authorization code format');
        }
      }

      if (!state) {
        errors.push('Missing state parameter');
      } else if (typeof state !== 'string' || state.length < 10) {
        errors.push('Invalid state parameter format');
      }

      if (error) {
        warnings.push(`OAuth error received: ${error}`);
      }
    }

    // Check for suspicious request patterns
    const securityContext = c.get('securityContext') as SecurityContext;
    if (securityContext?.security_level === 'critical') {
      warnings.push('High-risk request detected');
    }

    // Determine if request should be blocked
    const blocked = errors.length > 0 || (
      this.config.blockSuspiciousActivity && 
      securityContext?.security_level === 'critical'
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      blocked,
      reason: blocked ? (errors[0] || 'Suspicious activity detected') : undefined,
    };
  }

  /**
   * Validates return URL to prevent open redirect attacks
   */
  private isValidReturnUrl(url: string): boolean {
    try {
      // Allow relative URLs starting with /
      if (url.startsWith('/') && !url.startsWith('//')) {
        return url.length <= 500 && !/[<>"']/.test(url);
      }

      // For absolute URLs, only allow same domain
      const parsed = new URL(url);
      const allowedDomains = [
        'cutty.emilycogsdill.com',
        'list-cutter.emilycogsdill.com',
        'localhost',
      ];

      return allowedDomains.some(domain => 
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Adds security headers to OAuth responses
   */
  private addSecurityHeaders(c: Context): void {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }

  /**
   * Logs comprehensive security events for monitoring
   */
  private async logSecurityEvent(
    c: Context,
    eventType: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    details: any
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event_type: eventType,
        severity,
        request_id: c.get('securityContext')?.request_id || crypto.randomUUID(),
        ip_address: c.get('securityContext')?.ip_address || 'unknown',
        user_agent: c.get('securityContext')?.user_agent || 'unknown',
        url: c.req.url,
        method: c.req.method,
        details,
      };

      // In production, you'd send this to your logging service
      console.log('OAuth Security Event:', JSON.stringify(logEntry));

      // Also store in database if available
      const db = c.env.CUTTY_DB;
      if (db) {
        await db
          .prepare(`
            INSERT INTO oauth_security_events (event_type, severity, ip_address, user_agent, details, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `)
          .bind(
            eventType,
            severity,
            logEntry.ip_address,
            logEntry.user_agent,
            JSON.stringify(details)
          )
          .run();
      }
    } catch (error) {
      console.error('Failed to log OAuth security event:', error);
    }
  }
}