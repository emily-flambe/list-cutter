/**
 * Request Test Fixtures
 * 
 * Predefined request data for testing API endpoints and middleware.
 */

export const requestBodies = {
  // Registration requests
  registration: {
    valid: {
      username: 'newuser',
      email: 'new@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    },
    
    invalidEmail: {
      username: 'user',
      email: 'not-an-email',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    },
    
    shortPassword: {
      username: 'user',
      email: 'user@example.com',
      password: 'short',
      confirmPassword: 'short',
    },
    
    missingFields: {
      username: 'user',
      // Missing email, password, confirmPassword
    },
    
    extraFields: {
      username: 'user',
      email: 'user@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      maliciousField: '<script>alert("xss")</script>',
      adminFlag: true,
    },
  },
  
  // Login requests
  login: {
    valid: {
      username: 'testuser',
      password: 'Password123!',
    },
    
    invalidCredentials: {
      username: 'testuser',
      password: 'WrongPassword',
    },
    
    missingUsername: {
      password: 'Password123!',
    },
    
    missingPassword: {
      username: 'testuser',
    },
    
    empty: {},
    
    sqlInjection: {
      username: "admin'; DROP TABLE users; --",
      password: 'password',
    },
    
    xssPayload: {
      username: '<script>alert("xss")</script>',
      password: '<img src=x onerror=alert(1)>',
    },
    
    oversizeInput: {
      username: 'a'.repeat(1000),
      password: 'b'.repeat(1000),
    },
  },
  
  // Token refresh requests
  refresh: {
    valid: {
      refresh_token: 'valid-refresh-token-here',
    },
    
    expired: {
      refresh_token: 'expired-refresh-token',
    },
    
    invalid: {
      refresh_token: 'invalid-token-format',
    },
    
    missing: {},
    
    wrong_field: {
      refreshToken: 'valid-refresh-token-here', // Wrong field name
    },
  },
  
  // File upload requests
  fileUpload: {
    valid: {
      filename: 'test.txt',
      content_type: 'text/plain',
      content: 'Hello, World!',
    },
    
    large: {
      filename: 'large.txt',
      content_type: 'text/plain',
      content: 'x'.repeat(10 * 1024 * 1024), // 10MB
    },
    
    executable: {
      filename: 'malware.exe',
      content_type: 'application/octet-stream',
      content: 'MZ\x90\x00', // PE header
    },
    
    script: {
      filename: 'script.js',
      content_type: 'application/javascript',
      content: 'alert("xss");',
    },
    
    noExtension: {
      filename: 'README',
      content_type: 'text/plain',
      content: 'This is a readme file',
    },
    
    longFilename: {
      filename: 'a'.repeat(255) + '.txt',
      content_type: 'text/plain',
      content: 'content',
    },
  },
};

export const requestHeaders = {
  standard: {
    'Content-Type': 'application/json',
    'User-Agent': 'Test-Client/1.0',
    'Accept': 'application/json',
  },
  
  withAuth: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer valid-token-here',
    'User-Agent': 'Test-Client/1.0',
  },
  
  malformed: {
    'content-type': 'application/json', // Lowercase
    'AUTHORIZATION': 'bearer token', // Wrong case
    '': 'empty-header-name',
    'X-Custom': '', // Empty value
  },
  
  suspicious: {
    'X-Forwarded-For': '1.2.3.4, 5.6.7.8',
    'X-Real-IP': '9.10.11.12',
    'User-Agent': 'curl/7.68.0',
    'X-Forwarded-Proto': 'http', // Insecure
  },
  
  attack: {
    'User-Agent': '<script>alert("xss")</script>',
    'X-Injection': "'; DROP TABLE users; --",
    'Cookie': 'session=malicious_value',
    'Referer': 'http://malicious-site.com',
  },
  
  cors: {
    'Origin': 'https://trusted-domain.com',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Authorization, Content-Type',
  },
  
  invalidCors: {
    'Origin': 'http://untrusted-domain.com',
    'Access-Control-Request-Method': 'DELETE',
    'Access-Control-Request-Headers': 'X-Dangerous-Header',
  },
};

export const urlPatterns = {
  valid: [
    '/',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/files/upload',
    '/api/v1/files/download/abc123',
    '/dashboard',
    '/dashboard/analytics',
  ],
  
  invalid: [
    '/api/v1/admin/delete-all', // Non-existent endpoint
    '/api/../../../etc/passwd', // Path traversal
    '/api/v1/auth/login/../admin', // Path traversal
    '/%2e%2e%2f%2e%2e%2f', // URL encoded path traversal
    '/api/v1/auth/\x00\x01\x02', // Null bytes
  ],
  
  malicious: [
    '/api/v1/auth/login?redirect=javascript:alert(1)',
    '/api/v1/files/download/<script>alert(1)</script>',
    '/api/v1/search?q=\'; DROP TABLE users; --',
    '/callback?code=<img src=x onerror=alert(1)>',
  ],
  
  longPaths: [
    '/' + 'a'.repeat(1000),
    '/api/v1/' + 'path/'.repeat(100),
    '/search?' + 'param=value&'.repeat(50),
  ],
};

export const httpMethods = {
  allowed: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  disallowed: ['TRACE', 'CONNECT', 'HEAD'],
  malformed: ['', 'INVALID', '123', 'get', 'POST '], // Wrong case, trailing space
};

export const queryParameters = {
  pagination: {
    valid: { page: '1', limit: '10' },
    invalidPage: { page: '-1', limit: '10' },
    invalidLimit: { page: '1', limit: '0' },
    oversizeLimit: { page: '1', limit: '10000' },
    nonNumeric: { page: 'abc', limit: 'xyz' },
  },
  
  search: {
    valid: { q: 'test query' },
    empty: { q: '' },
    malicious: { q: '<script>alert(1)</script>' },
    sql: { q: "'; DROP TABLE files; --" },
    oversize: { q: 'x'.repeat(1000) },
  },
  
  filters: {
    valid: { type: 'image', size: 'small' },
    invalid: { type: 'malicious', size: 'enormous' },
    encoded: { filter: '%3Cscript%3Ealert(1)%3C/script%3E' },
  },
};