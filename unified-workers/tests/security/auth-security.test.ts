/**
 * Authentication Security Tests
 * Tests for secure authentication, JWT handling, and session management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { testEnv } from '../setup/test-env';

describe('Authentication Security Tests', () => {
  let worker: UnstableDevWorker;
  let env: any;

  beforeEach(async () => {
    env = await testEnv();
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  describe('JWT Security', () => {
    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'Bearer malformed-token',
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.', // None algorithm
        '', // Empty token
        'null',
        'undefined'
      ];

      for (const token of invalidTokens) {
        const response = await worker.fetch('/api/accounts/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error).toBeDefined();
      }
    });

    it('should reject expired JWT tokens', async () => {
      // Create an expired token (expired 1 hour ago)
      const expiredPayload = {
        user_id: 1,
        username: 'testuser',
        token_type: 'access',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 3660, // 1 hour 1 minute ago
        jti: 'expired-token-id'
      };

      const response = await worker.fetch('/api/accounts/user', {
        headers: {
          'Authorization': `Bearer ${JSON.stringify(expiredPayload)}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain('expired');
    });

    it('should reject tokens with invalid signatures', async () => {
      // Token with wrong secret
      const tokenWithWrongSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o';

      const response = await worker.fetch('/api/accounts/user', {
        headers: {
          'Authorization': `Bearer ${tokenWithWrongSecret}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should reject blacklisted tokens', async () => {
      // First register and login a user
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'security_test_user',
          password: 'SecurePass123!',
          email: 'security@test.com'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'security_test_user',
          password: 'SecurePass123!'
        })
      });

      const { access_token } = await loginResponse.json();

      // Logout to blacklist the token
      await worker.fetch('/api/accounts/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      // Try to use the blacklisted token
      const response = await worker.fetch('/api/accounts/user', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should enforce token type restrictions', async () => {
      // Try to use refresh token as access token
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'token_type_test',
          password: 'SecurePass123!',
          email: 'tokentype@test.com'
        })
      });

      const { refresh_token } = await response.json();

      // Try to use refresh token for authenticated endpoint
      const authResponse = await worker.fetch('/api/accounts/user', {
        headers: {
          'Authorization': `Bearer ${refresh_token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(authResponse.status).toBe(401);
    });
  });

  describe('Password Security', () => {
    it('should reject weak passwords', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'abc123',
        'test',
        'password123',
        'admin',
        'user',
        'qwerty',
        '12345678',
        'Pa$$word' // Too short
      ];

      for (const password of weakPasswords) {
        const response = await worker.fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `weakpass_${Date.now()}`,
            password,
            email: `weakpass_${Date.now()}@test.com`
          })
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('password');
      }
    });

    it('should enforce password complexity requirements', async () => {
      const testCases = [
        { password: 'NoNumbers!', error: 'number' },
        { password: 'nonumbers123', error: 'uppercase' },
        { password: 'NOLOWERCASE123!', error: 'lowercase' },
        { password: 'NoSpecialChars123', error: 'special' },
        { password: 'Short1!', error: 'length' }
      ];

      for (const testCase of testCases) {
        const response = await worker.fetch('/api/accounts/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: `complex_${Date.now()}`,
            password: testCase.password,
            email: `complex_${Date.now()}@test.com`
          })
        });

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.toLowerCase()).toContain(testCase.error);
      }
    });

    it('should protect against timing attacks in login', async () => {
      // Register a user
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'timing_test_user',
          password: 'SecurePass123!',
          email: 'timing@test.com'
        })
      });

      // Test timing consistency between invalid user and invalid password
      const startTime1 = performance.now();
      const response1 = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent_user',
          password: 'WrongPassword123!'
        })
      });
      const endTime1 = performance.now();

      const startTime2 = performance.now();
      const response2 = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'timing_test_user',
          password: 'WrongPassword123!'
        })
      });
      const endTime2 = performance.now();

      expect(response1.status).toBe(401);
      expect(response2.status).toBe(401);

      // Times should be reasonably consistent (within 50ms)
      const timeDiff = Math.abs((endTime1 - startTime1) - (endTime2 - startTime2));
      expect(timeDiff).toBeLessThan(50);
    });
  });

  describe('Session Management', () => {
    it('should invalidate session on password change', async () => {
      // Register and login
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'session_test_user',
          password: 'OldSecurePass123!',
          email: 'session@test.com'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'session_test_user',
          password: 'OldSecurePass123!'
        })
      });

      const { access_token } = await loginResponse.json();

      // Change password
      await worker.fetch('/api/accounts/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          old_password: 'OldSecurePass123!',
          new_password: 'NewSecurePass123!'
        })
      });

      // Old token should be invalidated
      const response = await worker.fetch('/api/accounts/user', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should handle concurrent logout attempts gracefully', async () => {
      // Register and login
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'concurrent_logout_user',
          password: 'SecurePass123!',
          email: 'concurrent@test.com'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'concurrent_logout_user',
          password: 'SecurePass123!'
        })
      });

      const { access_token } = await loginResponse.json();

      // Attempt multiple simultaneous logouts
      const logoutPromises = Array.from({ length: 5 }, () =>
        worker.fetch('/api/accounts/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const responses = await Promise.all(logoutPromises);

      // First logout should succeed, others should handle gracefully
      const successfulLogouts = responses.filter(r => r.status === 200);
      const failedLogouts = responses.filter(r => r.status !== 200);

      expect(successfulLogouts.length).toBeGreaterThan(0);
      expect(failedLogouts.length).toBeGreaterThan(0);
    });
  });

  describe('Authorization Security', () => {
    it('should prevent privilege escalation', async () => {
      // Register two users
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'user1',
          password: 'SecurePass123!',
          email: 'user1@test.com'
        })
      });

      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'user2',
          password: 'SecurePass123!',
          email: 'user2@test.com'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'user1',
          password: 'SecurePass123!'
        })
      });

      const { access_token } = await loginResponse.json();

      // Try to access other user's resources
      const response = await worker.fetch('/api/list_cutter/files/user/2', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(403);
    });

    it('should validate resource ownership', async () => {
      // Register user and upload file
      await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'resource_owner',
          password: 'SecurePass123!',
          email: 'owner@test.com'
        })
      });

      const loginResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'resource_owner',
          password: 'SecurePass123!'
        })
      });

      const { access_token } = await loginResponse.json();

      // Try to manipulate non-existent or unauthorized file
      const response = await worker.fetch('/api/list_cutter/files/999999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Security Headers', () => {
    it('should include proper security headers', async () => {
      const response = await worker.fetch('/');

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Strict-Transport-Security')).toBeTruthy();
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
    });

    it('should set secure cookie attributes', async () => {
      const response = await worker.fetch('/api/accounts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'cookie_test_user',
          password: 'SecurePass123!',
          email: 'cookie@test.com'
        })
      });

      const cookies = response.headers.get('Set-Cookie');
      if (cookies) {
        expect(cookies).toContain('Secure');
        expect(cookies).toContain('HttpOnly');
        expect(cookies).toContain('SameSite=Strict');
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting on auth endpoints', async () => {
      const requests = [];
      const maxRequests = 10;

      // Make rapid requests to login endpoint
      for (let i = 0; i < maxRequests + 5; i++) {
        requests.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'rate_limit_test',
              password: 'WrongPassword123!'
            })
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should reset rate limits after time window', async () => {
      // Hit rate limit
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          worker.fetch('/api/accounts/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'rate_reset_test',
              password: 'WrongPassword123!'
            })
          })
        );
      }

      await Promise.all(requests);

      // Wait for rate limit window to reset (1 minute)
      await new Promise(resolve => setTimeout(resolve, 61000));

      // Should be able to make requests again
      const resetResponse = await worker.fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'rate_reset_test',
          password: 'WrongPassword123!'
        })
      });

      expect(resetResponse.status).toBe(401); // Unauthorized, not rate limited
    });
  });

  afterEach(async () => {
    await worker.stop();
  });
});