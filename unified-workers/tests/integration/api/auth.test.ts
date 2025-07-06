import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestUser, loginTestUser, fetchAsUser } from '@tests/setup/unified-worker';

// Note: These tests use the actual Worker environment with real bindings
// but isolated test data to ensure test reliability

describe('Authentication API Integration', () => {
  let testUserCredentials: {
    username: string;
    email: string;
    password: string;
  };

  beforeEach(async () => {
    // Create unique test credentials for each test
    const timestamp = Date.now();
    testUserCredentials = {
      username: `testuser_${timestamp}`,
      email: `test_${timestamp}@example.com`,
      password: 'testpass123',
    };
  });

  describe('POST /api/accounts/register', () => {
    it('should register new user successfully', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserCredentials.username,
          email: testUserCredentials.email,
          password: testUserCredentials.password,
          password2: testUserCredentials.password,
        }),
      });

      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        user: {
          username: testUserCredentials.username,
          email: testUserCredentials.email,
        },
      });
      
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.access_token).toBeValidJWT();
      expect(data.refresh_token).toBeValidJWT();
      
      // Tokens should be different
      expect(data.access_token).not.toBe(data.refresh_token);
      
      // Should not return password
      expect(data.user.password).toBeUndefined();
    });

    it('should reject duplicate username registration', async () => {
      // Register first user
      await createTestUser(
        testUserCredentials.username,
        testUserCredentials.email,
        testUserCredentials.password
      );

      // Try to register same username with different email
      const response = await fetch('http://localhost:8787/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserCredentials.username,
          email: 'different@example.com',
          password: testUserCredentials.password,
          password2: testUserCredentials.password,
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should reject duplicate email registration', async () => {
      // Register first user
      await createTestUser(
        testUserCredentials.username,
        testUserCredentials.email,
        testUserCredentials.password
      );

      // Try to register different username with same email
      const response = await fetch('http://localhost:8787/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'differentuser',
          email: testUserCredentials.email,
          password: testUserCredentials.password,
          password2: testUserCredentials.password,
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should validate password confirmation', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserCredentials.username,
          email: testUserCredentials.email,
          password: testUserCredentials.password,
          password2: 'differentpassword',
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('do not match');
    });

    it('should validate required fields', async () => {
      const invalidRequests = [
        {}, // Missing all fields
        { username: testUserCredentials.username }, // Missing email and passwords
        { 
          username: testUserCredentials.username, 
          email: testUserCredentials.email 
        }, // Missing passwords
        {
          username: testUserCredentials.username,
          email: testUserCredentials.email,
          password: testUserCredentials.password
        }, // Missing password2
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await fetch('http://localhost:8787/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user@domain',
        'user.domain.com',
      ];

      for (const invalidEmail of invalidEmails) {
        const response = await fetch('http://localhost:8787/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `user_${Date.now()}`,
            email: invalidEmail,
            password: testUserCredentials.password,
            password2: testUserCredentials.password,
          }),
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('email');
      }
    });

    it('should validate password strength', async () => {
      const weakPasswords = [
        '', // Empty
        'abc', // Too short
        '12345678', // Only numbers
        'password', // Common password
      ];

      for (const weakPassword of weakPasswords) {
        const response = await fetch('http://localhost:8787/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `user_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
            password: weakPassword,
            password2: weakPassword,
          }),
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('password');
      }
    });
  });

  describe('POST /api/accounts/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await createTestUser(
        testUserCredentials.username,
        testUserCredentials.email,
        testUserCredentials.password
      );
    });

    it('should login with valid credentials', async () => {
      const response = await loginTestUser(
        testUserCredentials.username,
        testUserCredentials.password
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        user: {
          username: testUserCredentials.username,
          email: testUserCredentials.email,
        },
      });
      
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.access_token).toBeValidJWT();
      expect(data.refresh_token).toBeValidJWT();
    });

    it('should reject invalid username', async () => {
      const response = await loginTestUser(
        'nonexistentuser',
        testUserCredentials.password
      );

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const response = await loginTestUser(
        testUserCredentials.username,
        'wrongpassword'
      );

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid credentials');
    });

    it('should validate required fields', async () => {
      const invalidRequests = [
        {}, // Missing all fields
        { username: testUserCredentials.username }, // Missing password
        { password: testUserCredentials.password }, // Missing username
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await fetch('http://localhost:8787/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidRequest),
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      }
    });

    it('should handle case sensitivity correctly', async () => {
      // Login with uppercase username should fail
      const response = await loginTestUser(
        testUserCredentials.username.toUpperCase(),
        testUserCredentials.password
      );

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid credentials');
    });
  });

  describe('POST /api/accounts/token/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create user and get initial tokens
      await createTestUser(
        testUserCredentials.username,
        testUserCredentials.email,
        testUserCredentials.password
      );

      const loginResponse = await loginTestUser(
        testUserCredentials.username,
        testUserCredentials.password
      );
      const loginData = await loginResponse.json();
      refreshToken = loginData.refresh_token;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
      });
      
      expect(data.access_token).toBeDefined();
      expect(data.refresh_token).toBeDefined();
      expect(data.access_token).toBeValidJWT();
      expect(data.refresh_token).toBeValidJWT();
      
      // New tokens should be different from original
      expect(data.refresh_token).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: 'invalid.jwt.token',
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid refresh token');
    });

    it('should reject access token used as refresh token', async () => {
      // Get access token
      const loginResponse = await loginTestUser(
        testUserCredentials.username,
        testUserCredentials.password
      );
      const loginData = await loginResponse.json();

      const response = await fetch('http://localhost:8787/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: loginData.access_token, // Using access token instead
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid refresh token');
    });

    it('should prevent reuse of refresh token after logout', async () => {
      // Logout (which should blacklist the refresh token)
      await fetch('http://localhost:8787/api/accounts/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      });

      // Try to use the refresh token
      const response = await fetch('http://localhost:8787/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid refresh token');
    });
  });

  describe('GET /api/accounts/user', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Create user and get access token
      await createTestUser(
        testUserCredentials.username,
        testUserCredentials.email,
        testUserCredentials.password
      );

      const loginResponse = await loginTestUser(
        testUserCredentials.username,
        testUserCredentials.password
      );
      const loginData = await loginResponse.json();
      accessToken = loginData.access_token;
    });

    it('should return user profile with valid token', async () => {
      const response = await fetchAsUser('/api/accounts/user', {
        method: 'GET',
      }, testUserCredentials.username);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        user: {
          username: testUserCredentials.username,
          email: testUserCredentials.email,
        },
      });
      
      // Should not return sensitive information
      expect(data.user.password).toBeUndefined();
      expect(data.user.id).toBeDefined();
      expect(data.user.created_at).toBeDefined();
    });

    it('should reject request without authorization header', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/user', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization required');
    });

    it('should reject request with invalid token', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/user', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid.jwt.token',
        },
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid token');
    });

    it('should reject request with malformed authorization header', async () => {
      const malformedHeaders = [
        'invalid-format',
        'Bearer',
        'Basic dXNlcjpwYXNz', // Wrong auth type
        `Token ${accessToken}`, // Wrong prefix
      ];

      for (const authHeader of malformedHeaders) {
        const response = await fetch('http://localhost:8787/api/accounts/user', {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
        });

        expect(response.status).toBe(401);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      }
    });
  });

  describe('POST /api/accounts/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create user and get tokens
      await createTestUser(
        testUserCredentials.username,
        testUserCredentials.email,
        testUserCredentials.password
      );

      const loginResponse = await loginTestUser(
        testUserCredentials.username,
        testUserCredentials.password
      );
      const loginData = await loginResponse.json();
      accessToken = loginData.access_token;
      refreshToken = loginData.refresh_token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        success: true,
        message: 'Logged out successfully',
      });
    });

    it('should invalidate tokens after logout', async () => {
      // Logout
      await fetch('http://localhost:8787/api/accounts/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      // Try to use access token after logout
      const userResponse = await fetch('http://localhost:8787/api/accounts/user', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      expect(userResponse.status).toBe(401);

      // Try to use refresh token after logout
      const refreshResponse = await fetch('http://localhost:8787/api/accounts/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      expect(refreshResponse.status).toBe(401);
    });

    it('should reject logout without authorization', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authorization required');
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include proper CORS headers', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/register', {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    it('should include security headers in responses', async () => {
      const response = await fetch('http://localhost:8787/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserCredentials.username,
          email: testUserCredentials.email,
          password: testUserCredentials.password,
          password2: testUserCredentials.password,
        }),
      });

      // Check for security headers
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBeDefined();
    });

    it('should handle rate limiting gracefully', async () => {
      // This test simulates rate limiting - actual implementation may vary
      const requests = Array.from({ length: 10 }, () =>
        fetch('http://localhost:8787/api/accounts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'nonexistent',
            password: 'wrong',
          }),
        })
      );

      const responses = await Promise.all(requests);
      
      // Some responses might be rate limited (429), others might be 401
      const statusCodes = responses.map(r => r.status);
      expect(statusCodes.every(code => [401, 429].includes(code))).toBe(true);
    });
  });
});