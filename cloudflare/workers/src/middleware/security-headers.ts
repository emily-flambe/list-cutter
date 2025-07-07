/**
 * Enhanced Security Headers Middleware
 * 
 * This middleware provides comprehensive security headers management with:
 * - Dynamic configuration from security config
 * - Performance monitoring
 * - Threat mitigation
 * - Compliance with security standards
 * - Environment-specific customization
 */

import type { Context, Next } from 'hono';
import { SecurityConfigManager } from '../config/security-config';
import { SecurityMonitorService } from '../services/security/security-monitor';
import { 
  SecurityEventType,
  SecurityEventSeverity,
  SecurityEventCategory,
  RiskLevel
} from '../types/security-events';

export interface SecurityHeadersOptions {
  configManager: SecurityConfigManager;
  monitor?: SecurityMonitorService;
  enableNonceGeneration?: boolean;
  enableReporting?: boolean;
  customHeaders?: Record<string, string>;
  skipPaths?: string[];
}

export interface SecurityHeadersContext {
  nonce?: string;
  requestId?: string;
  securityLevel?: 'low' | 'medium' | 'high';
  headers: Record<string, string>;
}

/**
 * Enhanced Security Headers Middleware
 * 
 * Provides dynamic security headers based on configuration and threat level
 */
export class SecurityHeadersMiddleware {
  private configManager: SecurityConfigManager;
  private monitor?: SecurityMonitorService;
  private enableNonceGeneration: boolean;
  private enableReporting: boolean;
  private customHeaders: Record<string, string>;
  private skipPaths: string[];
  
  constructor(options: SecurityHeadersOptions) {
    this.configManager = options.configManager;
    this.monitor = options.monitor;
    this.enableNonceGeneration = options.enableNonceGeneration || false;
    this.enableReporting = options.enableReporting || false;
    this.customHeaders = options.customHeaders || {};
    this.skipPaths = options.skipPaths || [];
  }
  
  /**
   * Main middleware function
   */
  async middleware(c: Context, next: Next): Promise<void> {
    const startTime = this.monitor?.startPerformanceTimer('security_headers');
    
    try {
      // Check if path should be skipped
      const path = c.req.path;
      if (this.skipPaths.some(skipPath => path.startsWith(skipPath))) {
        await next();
        return;
      }
      
      // Get security configuration
      const config = await this.configManager.getHeadersConfig();
      
      // Create security context
      const securityContext = await this.createSecurityContext(c);
      
      // Set security headers
      await this.setSecurityHeaders(c, config, securityContext);
      
      // Continue with request
      await next();
      
      // Add response-specific headers
      await this.setResponseHeaders(c, securityContext);
      
    } catch (error) {
      console.error('Security headers middleware error:', error);
      
      // Set minimal security headers as fallback
      await this.setMinimalSecurityHeaders(c);
      
      // Continue with request even if security headers fail
      await next();
    } finally {
      if (startTime && this.monitor) {
        const duration = this.monitor.endPerformanceTimer(startTime);
        // Record performance metrics
        await this.monitor.recordEvent({
          id: crypto.randomUUID(),
          type: SecurityEventType.SYSTEM_MAINTENANCE,
          severity: SecurityEventSeverity.INFO,
          category: SecurityEventCategory.SYSTEM,
          riskLevel: RiskLevel.NONE,
          timestamp: new Date(),
          message: 'Security headers applied',
          source: 'security_headers_middleware',
          requiresResponse: false,
          details: {
            path: c.req.path,
            duration,
            responseTime: duration
          }
        });
      }
    }
  }
  
  /**
   * Create security context for request
   */
  private async createSecurityContext(c: Context): Promise<SecurityHeadersContext> {
    const requestId = c.get('requestId') || crypto.randomUUID();
    let nonce: string | undefined;
    
    // Generate nonce if enabled
    if (this.enableNonceGeneration) {
      nonce = await this.generateNonce();
    }
    
    // Determine security level based on request characteristics
    const securityLevel = await this.determineSecurityLevel(c);
    
    return {
      nonce,
      requestId,
      securityLevel,
      headers: {}
    };
  }
  
  /**
   * Set main security headers
   */
  private async setSecurityHeaders(
    c: Context,
    config: {
      contentSecurityPolicy: string;
      strictTransportSecurity: string;
      xFrameOptions: string;
      xContentTypeOptions: string;
      referrerPolicy: string;
      permissionsPolicy: string;
      expectCt: string;
      crossOriginResourcePolicy: string;
      crossOriginOpenerPolicy: string;
      crossOriginEmbedderPolicy: string;
      enableReporting?: boolean;
      reportUri?: string;
    },
    securityContext: SecurityHeadersContext
  ): Promise<void> {
    const headers = c.res.headers;
    
    // Content Security Policy
    let csp = config.contentSecurityPolicy;
    if (securityContext.nonce) {
      csp = csp.replace(/'unsafe-inline'/g, `'nonce-${securityContext.nonce}'`);
    }
    
    // Add reporting endpoint if enabled
    if (this.enableReporting) {
      csp += `; report-uri /api/security/csp-report`;
    }
    
    headers.set('Content-Security-Policy', csp);
    
    // Strict Transport Security
    headers.set('Strict-Transport-Security', config.strictTransportSecurity);
    
    // X-Frame-Options
    headers.set('X-Frame-Options', config.xFrameOptions);
    
    // X-Content-Type-Options
    headers.set('X-Content-Type-Options', config.xContentTypeOptions);
    
    // Referrer Policy
    headers.set('Referrer-Policy', config.referrerPolicy);
    
    // Permissions Policy
    headers.set('Permissions-Policy', config.permissionsPolicy);
    
    // Cross-Origin Resource Policy
    headers.set('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
    
    // Cross-Origin Opener Policy
    headers.set('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
    
    // Cross-Origin Embedder Policy
    headers.set('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
    
    // Expect-CT (if not deprecated)
    if (config.expectCt) {
      headers.set('Expect-CT', config.expectCt);
    }
    
    // Custom security headers
    for (const [key, value] of Object.entries(this.customHeaders)) {
      headers.set(key, value);
    }
    
    // Request ID for tracking
    headers.set('X-Request-ID', securityContext.requestId);
    
    // Security level indicator (development only)
    if (c.env?.ENVIRONMENT === 'development') {
      headers.set('X-Security-Level', securityContext.securityLevel);
    }
    
    // Store nonce in context for use by other middleware
    if (securityContext.nonce) {
      c.set('nonce', securityContext.nonce);
    }
  }
  
  /**
   * Set response-specific headers
   */
  private async setResponseHeaders(
    c: Context,
    securityContext: SecurityHeadersContext
  ): Promise<void> {
    const headers = c.res.headers;
    
    // Cache control for security-sensitive endpoints
    const path = c.req.path;
    if (this.isSecuritySensitivePath(path)) {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
    }
    
    // Content sniffing protection
    const contentType = headers.get('Content-Type');
    if (contentType && contentType.startsWith('text/html')) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }
    
    // Download protection
    if (this.isDownloadEndpoint(path)) {
      headers.set('Content-Disposition', 'attachment');
      headers.set('X-Download-Options', 'noopen');
    }
    
    // Security timing headers
    const processingTime = Date.now() - (c.get('startTime') || Date.now());
    headers.set('X-Processing-Time', processingTime.toString());
    
    // Enhanced security for high-risk responses
    if (securityContext.securityLevel === 'high') {
      headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
      headers.set('X-Permitted-Cross-Domain-Policies', 'none');
    }
  }
  
  /**
   * Set minimal security headers as fallback
   */
  private async setMinimalSecurityHeaders(c: Context): Promise<void> {
    const headers = c.res.headers;
    
    // Essential security headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Content-Security-Policy', "default-src 'self'");
  }
  
  /**
   * Generate cryptographically secure nonce
   */
  private async generateNonce(): Promise<string> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...randomBytes));
  }
  
  /**
   * Determine security level based on request characteristics
   */
  private async determineSecurityLevel(c: Context): Promise<'low' | 'medium' | 'high'> {
    const path = c.req.path;
    const method = c.req.method;
    const userAgent = c.req.header('User-Agent') || '';
    
    // High security for authentication endpoints
    if (path.includes('/auth/') || path.includes('/login')) {
      return 'high';
    }
    
    // High security for file operations
    if (path.includes('/upload') || path.includes('/download')) {
      return 'high';
    }
    
    // Medium security for API endpoints
    if (path.startsWith('/api/')) {
      return 'medium';
    }
    
    // Medium security for POST/PUT/DELETE requests
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      return 'medium';
    }
    
    // Check for suspicious user agents
    const suspiciousPatterns = [
      /bot/i,
      /spider/i,
      /crawler/i,
      /scanner/i,
      /curl/i,
      /wget/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Check if path is security-sensitive
   */
  private isSecuritySensitivePath(path: string): boolean {
    const sensitivePaths = [
      '/auth/',
      '/login',
      '/register',
      '/reset-password',
      '/admin/',
      '/api/user',
      '/api/auth'
    ];
    
    return sensitivePaths.some(sensitivePath => path.startsWith(sensitivePath));
  }
  
  /**
   * Check if path is a download endpoint
   */
  private isDownloadEndpoint(path: string): boolean {
    return path.includes('/download') || 
           path.includes('/export') || 
           path.endsWith('.csv') || 
           path.endsWith('.json') || 
           path.endsWith('.txt');
  }
}

/**
 * Security Headers Configuration Builder
 */
export class SecurityHeadersConfigBuilder {
  private config: {
    contentSecurityPolicy?: string;
    strictTransportSecurity?: string;
    enableReporting?: boolean;
    reportUri?: string;
  } = {};
  
  /**
   * Set Content Security Policy
   */
  contentSecurityPolicy(policy: string): this {
    this.config.contentSecurityPolicy = policy;
    return this;
  }
  
  /**
   * Set Strict Transport Security
   */
  strictTransportSecurity(maxAge: number = 31536000, includeSubDomains: boolean = true): this {
    let policy = `max-age=${maxAge}`;
    if (includeSubDomains) {
      policy += '; includeSubDomains';
    }
    this.config.strictTransportSecurity = policy;
    return this;
  }
  
  /**
   * Set X-Frame-Options
   */
  xFrameOptions(option: 'DENY' | 'SAMEORIGIN' | string): this {
    this.config.xFrameOptions = option;
    return this;
  }
  
  /**
   * Set Referrer Policy
   */
  referrerPolicy(policy: string): this {
    this.config.referrerPolicy = policy;
    return this;
  }
  
  /**
   * Set Permissions Policy
   */
  permissionsPolicy(policy: string): this {
    this.config.permissionsPolicy = policy;
    return this;
  }
  
  /**
   * Enable CSP reporting
   */
  enableCspReporting(reportUri: string): this {
    this.config.enableReporting = true;
    this.config.reportUri = reportUri;
    return this;
  }
  
  /**
   * Build configuration
   */
  build(): {
    contentSecurityPolicy?: string;
    strictTransportSecurity?: string;
    enableReporting?: boolean;
    reportUri?: string;
  } {
    return this.config;
  }
}

/**
 * Security Headers Middleware Factory
 */
export class SecurityHeadersMiddlewareFactory {
  static create(options: SecurityHeadersOptions): SecurityHeadersMiddleware {
    return new SecurityHeadersMiddleware(options);
  }
  
  static createFromConfig(
    configManager: SecurityConfigManager,
    monitor?: SecurityMonitorService
  ): SecurityHeadersMiddleware {
    return new SecurityHeadersMiddleware({
      configManager,
      monitor,
      enableNonceGeneration: true,
      enableReporting: true,
      customHeaders: {
        'X-Security-Framework': 'ListCutter-Security-v1.0',
        'X-Security-Timestamp': new Date().toISOString()
      },
      skipPaths: ['/health', '/favicon.ico', '/robots.txt']
    });
  }
}

/**
 * CSP Report Handler
 */
export class CSPReportHandler {
  private monitor?: SecurityMonitorService;
  
  constructor(monitor?: SecurityMonitorService) {
    this.monitor = monitor;
  }
  
  /**
   * Handle CSP violation reports
   */
  async handleReport(c: Context): Promise<Response> {
    try {
      const report = await c.req.json();
      
      // Log CSP violation
      console.warn('CSP Violation Report:', report);
      
      // Record security event
      if (this.monitor) {
        await this.monitor.recordEvent({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: 'violation',
          severity: 'medium',
          source: 'csp_report',
          description: 'Content Security Policy violation detected',
          metadata: {
            report,
            violatedDirective: report['csp-report']?.['violated-directive'],
            blockedUri: report['csp-report']?.['blocked-uri'],
            sourceFile: report['csp-report']?.['source-file']
          },
          ipAddress: c.req.header('CF-Connecting-IP'),
          userAgent: c.req.header('User-Agent'),
          resolved: false
        });
      }
      
      return c.json({ received: true }, 204);
    } catch (error) {
      console.error('Error handling CSP report:', error);
      return c.json({ error: 'Invalid report format' }, 400);
    }
  }
}

/**
 * Utility functions for security headers
 */
export class SecurityHeadersUtils {
  /**
   * Validate CSP directive
   */
  static validateCSP(csp: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for unsafe directives
    if (csp.includes("'unsafe-eval'")) {
      errors.push("'unsafe-eval' is not recommended");
    }
    
    if (csp.includes("'unsafe-inline'") && !csp.includes('nonce-')) {
      errors.push("'unsafe-inline' without nonce is not recommended");
    }
    
    // Check for wildcard sources
    if (csp.includes('*') && !csp.includes('data:')) {
      errors.push("Wildcard sources should be avoided");
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Generate secure CSP policy
   */
  static generateSecureCSP(options: {
    allowInlineScripts?: boolean;
    allowDataUris?: boolean;
    allowedDomains?: string[];
    nonce?: string;
  } = {}): string {
    const {
      allowInlineScripts = false,
      allowDataUris = false,
      allowedDomains = [],
      nonce
    } = options;
    
    let policy = "default-src 'self'";
    
    // Script sources
    let scriptSrc = "script-src 'self'";
    if (allowInlineScripts && nonce) {
      scriptSrc += ` 'nonce-${nonce}'`;
    }
    policy += `; ${scriptSrc}`;
    
    // Style sources
    let styleSrc = "style-src 'self'";
    if (allowInlineScripts && nonce) {
      styleSrc += ` 'nonce-${nonce}'`;
    }
    policy += `; ${styleSrc}`;
    
    // Image sources
    let imgSrc = "img-src 'self'";
    if (allowDataUris) {
      imgSrc += " data:";
    }
    policy += `; ${imgSrc}`;
    
    // Add allowed domains
    if (allowedDomains.length > 0) {
      const domains = allowedDomains.join(' ');
      policy += `; connect-src 'self' ${domains}`;
    }
    
    // Other directives
    policy += "; font-src 'self'; object-src 'none'; base-uri 'self'";
    
    return policy;
  }
  
  /**
   * Check if headers meet security standards
   */
  static checkSecurityStandards(headers: Record<string, string>): {
    score: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let score = 0;
    
    // Check for essential headers
    if (headers['Content-Security-Policy']) {
      score += 20;
    } else {
      recommendations.push('Add Content-Security-Policy header');
    }
    
    if (headers['Strict-Transport-Security']) {
      score += 15;
    } else {
      recommendations.push('Add Strict-Transport-Security header');
    }
    
    if (headers['X-Frame-Options']) {
      score += 10;
    } else {
      recommendations.push('Add X-Frame-Options header');
    }
    
    if (headers['X-Content-Type-Options']) {
      score += 10;
    } else {
      recommendations.push('Add X-Content-Type-Options header');
    }
    
    if (headers['Referrer-Policy']) {
      score += 10;
    } else {
      recommendations.push('Add Referrer-Policy header');
    }
    
    if (headers['Permissions-Policy']) {
      score += 10;
    } else {
      recommendations.push('Add Permissions-Policy header');
    }
    
    // Check for advanced headers
    if (headers['Cross-Origin-Resource-Policy']) {
      score += 10;
    }
    
    if (headers['Cross-Origin-Opener-Policy']) {
      score += 10;
    }
    
    if (headers['Cross-Origin-Embedder-Policy']) {
      score += 5;
    }
    
    return { score, recommendations };
  }
}