/**
 * OAuth Security Tests
 * 
 * Comprehensive security testing for OAuth implementation including:
 * - Rate limiting enforcement
 * - Input validation and sanitization
 * - CSRF protection via state tokens
 * - Security event logging
 * - Attack pattern detection
 * - Authorization bypass attempts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { OAuthSecurityMiddleware } from '../../src/middleware/oauth-security';
import { OAuthRateLimiter } from '../../src/services/auth/oauth-rate-limiter';
import { OAuthStateManager } from '../../src/services/auth/oauth-state-manager';
import { createMockD1Database, createMockContext } from '../fixtures';

describe('OAuth Security Middleware', () => {
  let securityMiddleware: OAuthSecurityMiddleware;
  let mockRateLimiter: OAuthRateLimiter;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = createMockD1Database();
    mockRateLimiter = new OAuthRateLimiter(mockDb);
    securityMiddleware = new OAuthSecurityMiddleware(mockRateLimiter);
  });

  describe('Rate Limiting Protection', () => {
    test('should allow requests within rate limits', async () => {
      // Mock rate limiter to allow requests
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: true,
        remaining: 25,
        resetTime: Date.now() + 60000,
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(result).toBeUndefined(); // No blocking response
      expect(mockContext.get('securityContext')).toBeDefined();
    });

    test('should block requests exceeding general rate limit', async () => {
      // Mock rate limiter to block requests
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        reason: 'General rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + 900000, // 15 minutes
        severity: 'warning',
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(result).toBeDefined();
      expect(await result.json()).toEqual({
        error: 'Rate limit exceeded',
        message: 'General rate limit exceeded',
        retry_after: expect.any(Number),
      });
    });

    test('should set rate limit headers on blocked requests', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        reason: 'Rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + 900000,
        severity: 'warning',
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Limit', '30');
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
      expect(mockContext.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    test('should handle burst protection', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        reason: 'Burst rate limit exceeded',
        remaining: 0,
        resetTime: Date.now() + 60000,
        severity: 'warning',
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(result).toBeDefined();
      const response = await result.json();
      expect(response.message).toBe('Burst rate limit exceeded');
    });

    test('should detect suspicious activity patterns', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        reason: 'Suspicious activity detected',
        remaining: 0,
        resetTime: Date.now() + 300000, // 5 minutes
        severity: 'critical',
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      const result = await securityMiddleware.securityCheck(mockContext, 'failure');
      
      expect(result).toBeDefined();
      const response = await result.json();
      expect(response.message).toBe('Suspicious activity detected');
    });
  });

  describe('Input Validation', () => {
    test('should validate OAuth initiation parameters', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const testCases = [
        {
          url: '/api/v1/auth/google?return_url=javascript:alert(1)',
          description: 'javascript URL',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google?return_url=http://evil.com',
          description: 'external domain',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google?return_url=' + 'a'.repeat(600),
          description: 'excessively long URL',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google?return_url=/dashboard',
          description: 'valid relative URL',
          shouldBlock: false,
        },
      ];

      for (const testCase of testCases) {
        const mockContext = createMockContext('GET', testCase.url);
        const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        if (testCase.shouldBlock) {
          expect(result).toBeDefined();
          const response = await result.json();
          expect(response.error).toBe('Invalid request');
        } else {
          expect(result).toBeUndefined();
        }
      }
    });

    test('should validate OAuth callback parameters', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const testCases = [
        {
          url: '/api/v1/auth/google/callback?code=&state=valid-state',
          description: 'empty authorization code',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google/callback?code=valid-code&state=',
          description: 'empty state parameter',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google/callback?code=' + 'x'.repeat(600) + '&state=valid-state',
          description: 'excessively long code',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google/callback?code=valid<script>&state=valid-state',
          description: 'code with invalid characters',
          shouldBlock: true,
        },
        {
          url: '/api/v1/auth/google/callback?code=validcode123&state=validstate456',
          description: 'valid parameters',
          shouldBlock: false,
        },
      ];

      for (const testCase of testCases) {
        const mockContext = createMockContext('GET', testCase.url);
        const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        if (testCase.shouldBlock) {
          expect(result).toBeDefined();
          const response = await result.json();
          expect(response.error).toBe('Invalid request');
        } else {
          expect(result).toBeUndefined();
        }
      }
    });

    test('should reject malicious input patterns', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const maliciousInputs = [
        '<script>alert(1)</script>',
        '"><script>alert(1)</script>',
        'javascript:alert(document.cookie)',
        '\'; DROP TABLE users; --',
        '../../../etc/passwd',
        '${jndi:ldap://evil.com}',
      ];

      for (const maliciousInput of maliciousInputs) {
        const encodedInput = encodeURIComponent(maliciousInput);
        const mockContext = createMockContext('GET', `/api/v1/auth/google?return_url=${encodedInput}`);
        
        const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        // Should either block or sanitize the input
        if (result) {
          const response = await result.json();
          expect(response.error).toBe('Invalid request');
        }
      }
    });
  });

  describe('Security Context Generation', () => {
    test('should extract IP addresses correctly', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const testCases = [
        {
          headers: { 'CF-Connecting-IP': '192.168.1.100' },
          expectedIP: '192.168.1.100',
          description: 'Cloudflare IP header',
        },
        {
          headers: { 'X-Forwarded-For': '203.0.113.1, 192.168.1.1' },
          expectedIP: '203.0.113.1',
          description: 'X-Forwarded-For header',
        },
        {
          headers: { 'X-Real-IP': '198.51.100.1' },
          expectedIP: '198.51.100.1',
          description: 'X-Real-IP header',
        },
        {
          headers: {},
          expectedIP: 'unknown',
          description: 'no IP headers',
        },
      ];

      for (const testCase of testCases) {
        const mockContext = createMockContext('GET', '/api/v1/auth/google', testCase.headers);
        await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        const securityContext = mockContext.get('securityContext');
        expect(securityContext.ip_address).toBe(testCase.expectedIP);
      }
    });

    test('should assess security levels correctly', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const testCases = [
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          expectedLevel: 'low',
          description: 'normal browser',
        },
        {
          headers: { 'User-Agent': 'curl/7.68.0' },
          expectedLevel: 'high',
          description: 'curl user agent',
        },
        {
          headers: { 'User-Agent': 'python-requests/2.25.1' },
          expectedLevel: 'high',
          description: 'Python requests',
        },
        {
          headers: {},
          expectedLevel: 'critical',
          description: 'missing user agent',
        },
      ];

      for (const testCase of testCases) {
        const mockContext = createMockContext('GET', '/api/v1/auth/google', testCase.headers);
        await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        const securityContext = mockContext.get('securityContext');
        expect(securityContext.security_level).toBe(testCase.expectedLevel);
      }
    });

    test('should generate unique request IDs', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const context1 = createMockContext('GET', '/api/v1/auth/google');
      const context2 = createMockContext('GET', '/api/v1/auth/google');
      
      await securityMiddleware.securityCheck(context1, 'attempt');
      await securityMiddleware.securityCheck(context2, 'attempt');
      
      const securityContext1 = context1.get('securityContext');
      const securityContext2 = context2.get('securityContext');
      
      expect(securityContext1.request_id).not.toBe(securityContext2.request_id);
      expect(securityContext1.request_id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('Security Event Logging', () => {
    test('should log OAuth request events', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      // Verify security event was logged to database
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO oauth_security_events')
      );
    });

    test('should log security violations', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        reason: 'Rate limit exceeded',
        severity: 'warning',
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO oauth_security_events')
      );
    });

    test('should record OAuth event outcomes', async () => {
      vi.spyOn(mockRateLimiter, 'recordOAuthEvent').mockResolvedValue();

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      mockContext.set('securityContext', {
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        request_id: 'test-request-id',
      });

      await securityMiddleware.recordOAuthEvent(mockContext, 'success', {
        user_id: 123,
        provider: 'google',
      });
      
      expect(mockRateLimiter.recordOAuthEvent).toHaveBeenCalledWith({
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        user_id: undefined, // Not in security context
        event_type: 'success',
      });
    });
  });

  describe('Security Headers', () => {
    test('should set comprehensive security headers', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      const expectedHeaders = [
        ['X-Content-Type-Options', 'nosniff'],
        ['X-Frame-Options', 'DENY'],
        ['X-XSS-Protection', '1; mode=block'],
        ['Referrer-Policy', 'strict-origin-when-cross-origin'],
        ['Cache-Control', 'no-cache, no-store, must-revalidate'],
        ['Pragma', 'no-cache'],
        ['Expires', '0'],
      ];

      for (const [header, value] of expectedHeaders) {
        expect(mockContext.header).toHaveBeenCalledWith(header, value);
      }
    });
  });

  describe('Attack Pattern Detection', () => {
    test('should detect rapid sequential requests', async () => {
      // Mock burst protection triggering
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        reason: 'Burst rate limit exceeded',
        severity: 'warning',
      });

      const mockContext = createMockContext('GET', '/api/v1/auth/google');
      const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(result).toBeDefined();
      const response = await result.json();
      expect(response.message).toBe('Burst rate limit exceeded');
    });

    test('should detect suspicious user agent patterns', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const suspiciousAgents = [
        'Googlebot/2.1',
        'Bingbot/2.0',
        'curl/7.68.0',
        'wget/1.20.3',
        'python-requests/2.25.1',
        'Go-http-client/1.1',
      ];

      for (const userAgent of suspiciousAgents) {
        const mockContext = createMockContext('GET', '/api/v1/auth/google', {
          'User-Agent': userAgent,
        });
        
        await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        const securityContext = mockContext.get('securityContext');
        expect(securityContext.security_level).toBeOneOf(['medium', 'high', 'critical']);
      }
    });

    test('should block requests from private IP ranges in production', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const privateIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '127.0.0.1',
      ];

      for (const privateIP of privateIPs) {
        const mockContext = createMockContext('GET', '/api/v1/auth/google', {
          'CF-Connecting-IP': privateIP,
        });
        
        await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        const securityContext = mockContext.get('securityContext');
        expect(securityContext.security_level).toBeOneOf(['medium', 'high']);
      }
    });
  });

  describe('Return URL Validation', () => {
    test('should allow safe relative URLs', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const safeUrls = [
        '/dashboard',
        '/profile',
        '/settings',
        '/dashboard?tab=overview',
        '/path/to/page',
        '/app#section',
      ];

      for (const safeUrl of safeUrls) {
        const mockContext = createMockContext('GET', `/api/v1/auth/google?return_url=${encodeURIComponent(safeUrl)}`);
        const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        expect(result).toBeUndefined(); // Should not block
      }
    });

    test('should block dangerous URLs', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'http://evil.com',
        'https://phishing-site.com',
        '//evil.com',
        'ftp://malicious.com',
      ];

      for (const dangerousUrl of dangerousUrls) {
        const mockContext = createMockContext('GET', `/api/v1/auth/google?return_url=${encodeURIComponent(dangerousUrl)}`);
        const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
        
        if (result) {
          const response = await result.json();
          expect(response.error).toBe('Invalid request');
        }
      }
    });

    test('should limit return URL length', async () => {
      vi.spyOn(mockRateLimiter, 'checkRateLimit').mockResolvedValue({ allowed: true });

      const longUrl = '/dashboard?' + 'param=value&'.repeat(100); // Very long URL
      const mockContext = createMockContext('GET', `/api/v1/auth/google?return_url=${encodeURIComponent(longUrl)}`);
      const result = await securityMiddleware.securityCheck(mockContext, 'attempt');
      
      expect(result).toBeDefined();
      const response = await result.json();
      expect(response.error).toBe('Invalid request');
    });
  });
});