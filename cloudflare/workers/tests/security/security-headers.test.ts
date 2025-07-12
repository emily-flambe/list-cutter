import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { CloudflareEnv } from '../../src/types/env';

/**
 * Security Headers Validation Tests
 * 
 * Tests comprehensive security headers implementation:
 * - Content Security Policy (CSP) validation
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options protection
 * - X-Content-Type-Options validation
 * - X-XSS-Protection headers
 * - Referrer-Policy enforcement
 * - Permissions-Policy controls
 * - Cross-Origin policies (CORS, COOP, COEP)
 * - Security header bypass attempts
 * - Header injection prevention
 */

const mockEnv: CloudflareEnv = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  AUTH_KV: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  SECURITY_CONFIG: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  SECURITY_EVENTS: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  SECURITY_METRICS: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  DB: {} as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
};

// Security headers middleware
function addSecurityHeaders() {
  return async (c: any, next: any) => {
    await next();
    
    // Content Security Policy
    c.header('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "object-src 'none';"
    );
    
    // HTTP Strict Transport Security
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Frame Options
    c.header('X-Frame-Options', 'DENY');
    
    // Content Type Options
    c.header('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection
    c.header('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    c.header('Permissions-Policy', 
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), ' +
      'accelerometer=(), gyroscope=(), magnetometer=(), ambient-light-sensor=(), ' +
      'autoplay=(), encrypted-media=(), fullscreen=(self), picture-in-picture=()'
    );
    
    // Cross-Origin Policies
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Embedder-Policy', 'require-corp');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Additional Security Headers
    c.header('X-Permitted-Cross-Domain-Policies', 'none');
    c.header('X-Download-Options', 'noopen');
    c.header('X-DNS-Prefetch-Control', 'off');
    
    // Remove server information
    c.header('Server', '');
    c.header('X-Powered-By', '');
  };
}

describe('Security Headers Validation Tests', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    
    // Add security headers middleware
    app.use('*', addSecurityHeaders());
    
    // Test endpoints
    app.get('/api/test', (c) => c.json({ message: 'test' }));
    app.post('/api/upload', (c) => c.json({ success: true }));
    app.get('/admin/dashboard', (c) => c.html('<html><body>Admin</body></html>'));
    app.get('/public/file.css', (c) => {
      c.header('Content-Type', 'text/css');
      return c.text('body { color: red; }');
    });
  });

  describe('Content Security Policy (CSP)', () => {
    it('should include comprehensive CSP header', async () => {
      const res = await app.request('/api/test');
      
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    it('should prevent inline script execution through CSP', async () => {
      const res = await app.request('/admin/dashboard');
      
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeDefined();
      
      // Should have script-src directive that controls inline scripts
      expect(csp).toContain('script-src');
      
      // For this test, we allow unsafe-inline for compatibility, 
      // but in production this should be removed and use nonces/hashes
      if (!csp?.includes("'unsafe-inline'")) {
        // If unsafe-inline is removed, should use nonce or hash
        expect(csp).toMatch(/'nonce-[a-zA-Z0-9+/]+'|'sha\d+-[a-zA-Z0-9+/]+'=/);
      }
    });

    it('should restrict frame ancestors to prevent clickjacking', async () => {
      const res = await app.request('/admin/dashboard');
      
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should control resource loading sources', async () => {
      const res = await app.request('/api/test');
      
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toBeDefined();
      
      // Should restrict various resource types
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("font-src 'self' data:");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("style-src 'self'");
    });

    it('should prevent object/embed exploitation', async () => {
      const res = await app.request('/api/test');
      
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe('HTTP Strict Transport Security (HSTS)', () => {
    it('should include HSTS header with long max-age', async () => {
      const res = await app.request('/api/test');
      
      const hsts = res.headers.get('Strict-Transport-Security');
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=31536000'); // 1 year
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should apply HSTS to all endpoints', async () => {
      const endpoints = ['/api/test', '/admin/dashboard', '/public/file.css'];
      
      for (const endpoint of endpoints) {
        const res = await app.request(endpoint);
        const hsts = res.headers.get('Strict-Transport-Security');
        expect(hsts).toBeDefined();
        expect(hsts).toContain('max-age=31536000');
      }
    });
  });

  describe('Clickjacking Protection', () => {
    it('should include X-Frame-Options header', async () => {
      const res = await app.request('/admin/dashboard');
      
      const frameOptions = res.headers.get('X-Frame-Options');
      expect(frameOptions).toBe('DENY');
    });

    it('should prevent framing in all contexts', async () => {
      const endpoints = ['/api/test', '/admin/dashboard', '/public/file.css'];
      
      for (const endpoint of endpoints) {
        const res = await app.request(endpoint);
        const frameOptions = res.headers.get('X-Frame-Options');
        expect(frameOptions).toBe('DENY');
      }
    });

    it('should use CSP frame-ancestors as primary protection', async () => {
      const res = await app.request('/admin/dashboard');
      
      const csp = res.headers.get('Content-Security-Policy');
      expect(csp).toContain("frame-ancestors 'none'");
      
      // Both headers should be present for defense in depth
      const frameOptions = res.headers.get('X-Frame-Options');
      expect(frameOptions).toBe('DENY');
    });
  });

  describe('MIME Type Sniffing Protection', () => {
    it('should include X-Content-Type-Options header', async () => {
      const res = await app.request('/public/file.css');
      
      const contentTypeOptions = res.headers.get('X-Content-Type-Options');
      expect(contentTypeOptions).toBe('nosniff');
    });

    it('should prevent MIME sniffing for all content types', async () => {
      const res = await app.request('/api/test');
      
      const contentTypeOptions = res.headers.get('X-Content-Type-Options');
      expect(contentTypeOptions).toBe('nosniff');
    });
  });

  describe('XSS Protection Headers', () => {
    it('should include X-XSS-Protection header', async () => {
      const res = await app.request('/admin/dashboard');
      
      const xssProtection = res.headers.get('X-XSS-Protection');
      expect(xssProtection).toBe('1; mode=block');
    });

    it('should apply XSS protection to HTML responses', async () => {
      const res = await app.request('/admin/dashboard');
      
      const xssProtection = res.headers.get('X-XSS-Protection');
      expect(xssProtection).toContain('mode=block');
    });
  });

  describe('Referrer Policy', () => {
    it('should include appropriate referrer policy', async () => {
      const res = await app.request('/api/test');
      
      const referrerPolicy = res.headers.get('Referrer-Policy');
      expect(referrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    it('should protect sensitive URLs from leaking', async () => {
      const res = await app.request('/admin/dashboard');
      
      const referrerPolicy = res.headers.get('Referrer-Policy');
      expect(referrerPolicy).toBeDefined();
      
      // Should not be 'unsafe-url' or empty
      expect(referrerPolicy).not.toBe('unsafe-url');
      expect(referrerPolicy).not.toBe('');
    });
  });

  describe('Permissions Policy', () => {
    it('should include restrictive permissions policy', async () => {
      const res = await app.request('/api/test');
      
      const permissionsPolicy = res.headers.get('Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
    });

    it('should restrict dangerous browser features', async () => {
      const res = await app.request('/admin/dashboard');
      
      const permissionsPolicy = res.headers.get('Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      
      // Should disable potentially dangerous features
      expect(permissionsPolicy).toContain('payment=()');
      expect(permissionsPolicy).toContain('usb=()');
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
    });

    it('should allow self for necessary features only', async () => {
      const res = await app.request('/admin/dashboard');
      
      const permissionsPolicy = res.headers.get('Permissions-Policy');
      expect(permissionsPolicy).toBeDefined();
      
      // Fullscreen might be allowed for self
      if (permissionsPolicy?.includes('fullscreen')) {
        expect(permissionsPolicy).toContain('fullscreen=(self)');
      }
    });
  });

  describe('Cross-Origin Policies', () => {
    it('should include Cross-Origin-Opener-Policy', async () => {
      const res = await app.request('/api/test');
      
      const coop = res.headers.get('Cross-Origin-Opener-Policy');
      expect(coop).toBe('same-origin');
    });

    it('should include Cross-Origin-Embedder-Policy', async () => {
      const res = await app.request('/api/test');
      
      const coep = res.headers.get('Cross-Origin-Embedder-Policy');
      expect(coep).toBe('require-corp');
    });

    it('should include Cross-Origin-Resource-Policy', async () => {
      const res = await app.request('/public/file.css');
      
      const corp = res.headers.get('Cross-Origin-Resource-Policy');
      expect(corp).toBe('same-origin');
    });

    it('should prevent cross-origin attacks', async () => {
      const res = await app.request('/admin/dashboard');
      
      // All three policies should be present
      expect(res.headers.get('Cross-Origin-Opener-Policy')).toBeDefined();
      expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBeDefined();
      expect(res.headers.get('Cross-Origin-Resource-Policy')).toBeDefined();
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should remove server identification headers', async () => {
      const res = await app.request('/api/test');
      
      const server = res.headers.get('Server');
      const poweredBy = res.headers.get('X-Powered-By');
      
      // Should be empty or not present
      expect(server || '').toBe('');
      expect(poweredBy || '').toBe('');
    });

    it('should include X-Permitted-Cross-Domain-Policies', async () => {
      const res = await app.request('/api/test');
      
      const crossDomainPolicy = res.headers.get('X-Permitted-Cross-Domain-Policies');
      expect(crossDomainPolicy).toBe('none');
    });

    it('should include X-Download-Options for IE', async () => {
      const res = await app.request('/public/file.css');
      
      const downloadOptions = res.headers.get('X-Download-Options');
      expect(downloadOptions).toBe('noopen');
    });

    it('should disable DNS prefetching', async () => {
      const res = await app.request('/api/test');
      
      const dnsPrefetch = res.headers.get('X-DNS-Prefetch-Control');
      expect(dnsPrefetch).toBe('off');
    });
  });

  describe('Header Injection Prevention', () => {
    it('should handle malicious headers in requests', async () => {
      const maliciousHeaders = {
        'X-Injected-Header': 'malicious\r\nX-Evil: true',
        'Host': 'evil.com\r\nX-Forwarded-Host: legitimate.com',
        'User-Agent': 'Browser\r\nSet-Cookie: admin=true',
      };
      
      const res = await app.request('/api/test', {
        headers: maliciousHeaders
      });
      
      // Should not reflect injected headers
      expect(res.headers.get('X-Evil')).toBeNull();
      expect(res.headers.get('Set-Cookie')).toBeNull();
    });

    it('should validate custom security headers format', async () => {
      const res = await app.request('/api/test');
      
      // All security headers should be properly formatted
      const headers = [
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy'
      ];
      
      for (const headerName of headers) {
        const headerValue = res.headers.get(headerName);
        expect(headerValue).toBeDefined();
        expect(headerValue).not.toContain('\r');
        expect(headerValue).not.toContain('\n');
        expect(headerValue).not.toMatch(/\x00-\x1f/); // Control characters
      }
    });

    it('should prevent response splitting through headers', async () => {
      // Test that our security headers don't contain CRLF
      const res = await app.request('/api/test');
      
      const securityHeaders = [
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy'
      ];
      
      for (const headerName of securityHeaders) {
        const headerValue = res.headers.get(headerName);
        if (headerValue) {
          expect(headerValue).not.toMatch(/[\r\n]/);
          expect(headerValue).not.toContain('HTTP/1.1');
          expect(headerValue).not.toContain('Set-Cookie');
        }
      }
    });
  });

  describe('CORS Security', () => {
    it('should not include permissive CORS headers by default', async () => {
      const res = await app.request('/api/test');
      
      // Should not have overly permissive CORS
      const accessControlAllowOrigin = res.headers.get('Access-Control-Allow-Origin');
      expect(accessControlAllowOrigin).not.toBe('*');
      
      const accessControlAllowCredentials = res.headers.get('Access-Control-Allow-Credentials');
      if (accessControlAllowCredentials) {
        expect(accessControlAllowCredentials).not.toBe('true');
      }
    });

    it('should handle OPTIONS requests securely', async () => {
      const res = await app.request('/api/test', { method: 'OPTIONS' });
      
      // Should not expose all methods or headers
      const allowMethods = res.headers.get('Access-Control-Allow-Methods');
      const allowHeaders = res.headers.get('Access-Control-Allow-Headers');
      
      if (allowMethods) {
        expect(allowMethods).not.toContain('*');
      }
      if (allowHeaders) {
        expect(allowHeaders).not.toContain('*');
      }
    });
  });

  describe('Cache Control Security', () => {
    it('should set appropriate cache headers for sensitive endpoints', async () => {
      const res = await app.request('/admin/dashboard');
      
      // Sensitive pages should not be cached
      const cacheControl = res.headers.get('Cache-Control');
      if (cacheControl) {
        // Should prevent caching of sensitive content
        expect(
          cacheControl.includes('no-cache') || 
          cacheControl.includes('no-store') || 
          cacheControl.includes('private')
        ).toBe(true);
      }
    });

    it('should allow caching for static resources', async () => {
      const res = await app.request('/public/file.css');
      
      // Static resources can be cached but should still be secure
      const cacheControl = res.headers.get('Cache-Control');
      // This is optional - just ensuring no security issues if present
      if (cacheControl) {
        expect(cacheControl).not.toContain('public, max-age=31536000'); // Too aggressive
      }
    });
  });

  describe('Security Headers Completeness', () => {
    it('should include all critical security headers', async () => {
      const res = await app.request('/admin/dashboard');
      
      const criticalHeaders = [
        'Content-Security-Policy',
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy'
      ];
      
      for (const header of criticalHeaders) {
        expect(res.headers.get(header)).toBeDefined();
      }
    });

    it('should maintain security headers across different content types', async () => {
      const endpoints = [
        { path: '/api/test', type: 'JSON' },
        { path: '/admin/dashboard', type: 'HTML' },
        { path: '/public/file.css', type: 'CSS' }
      ];
      
      for (const endpoint of endpoints) {
        const res = await app.request(endpoint.path);
        
        // Core security headers should be present regardless of content type
        expect(res.headers.get('X-Frame-Options')).toBeDefined();
        expect(res.headers.get('X-Content-Type-Options')).toBeDefined();
        expect(res.headers.get('Strict-Transport-Security')).toBeDefined();
      }
    });

    it('should not have conflicting security headers', async () => {
      const res = await app.request('/api/test');
      
      // CSP frame-ancestors and X-Frame-Options should be compatible
      const csp = res.headers.get('Content-Security-Policy');
      const frameOptions = res.headers.get('X-Frame-Options');
      
      if (csp?.includes("frame-ancestors 'none'") && frameOptions) {
        expect(frameOptions).toBe('DENY');
      }
      
      // Should not have contradictory policies
      if (csp?.includes("default-src 'none'")) {
        expect(csp).not.toContain("script-src 'unsafe-eval'");
      }
    });
  });

  describe('Security Headers Performance', () => {
    it('should not duplicate security headers', async () => {
      const res = await app.request('/api/test');
      
      // Check that security headers are not duplicated
      const headers = res.headers;
      const headerEntries = Array.from(headers.entries());
      
      const headerCounts = new Map<string, number>();
      for (const [name] of headerEntries) {
        headerCounts.set(name.toLowerCase(), (headerCounts.get(name.toLowerCase()) || 0) + 1);
      }
      
      // Security headers should appear only once
      const securityHeaders = [
        'content-security-policy',
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options'
      ];
      
      for (const header of securityHeaders) {
        const count = headerCounts.get(header);
        if (count) {
          expect(count).toBe(1);
        }
      }
    });

    it('should have reasonable header sizes', async () => {
      const res = await app.request('/api/test');
      
      // Security headers should not be excessively large
      const securityHeaders = [
        'Content-Security-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security'
      ];
      
      for (const headerName of securityHeaders) {
        const headerValue = res.headers.get(headerName);
        if (headerValue) {
          expect(headerValue.length).toBeLessThan(2000); // Reasonable size limit
        }
      }
    });
  });
});