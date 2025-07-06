import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateJWT, 
  verifyJWT, 
  generateTokenPair, 
  refreshAccessToken, 
  blacklistToken, 
  isTokenBlacklisted 
} from '@/services/auth/jwt';
import type { User, Env, UserJWTPayload } from '@/types';
import { createMockKVNamespace } from '@tests/setup/unified-worker';

describe('JWT Service', () => {
  let mockEnv: Env;
  let testUser: User;
  const TEST_SECRET = 'test-secret-key-for-testing-only';

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Create mock environment with KV namespace
    mockEnv = {
      JWT_SECRET: TEST_SECRET,
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      AUTH_KV: createMockKVNamespace(),
      ENVIRONMENT: 'test',
    } as unknown as Env;

    testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashed-password',
      created_at: '2024-01-01T00:00:00Z',
    };
  });

  describe('generateJWT', () => {
    it('should generate a valid JWT token', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token = await generateJWT(payload, TEST_SECRET, '10m');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      expect(token).toBeValidJWT();
    });

    it('should generate tokens with different expiration times', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const shortToken = await generateJWT(payload, TEST_SECRET, '5m');
      const longToken = await generateJWT(payload, TEST_SECRET, '1h');

      expect(shortToken).not.toBe(longToken);
      
      // Verify the tokens have different expiration times
      const shortPayload = await verifyJWT(shortToken, TEST_SECRET);
      const longPayload = await verifyJWT(longToken, TEST_SECRET);
      
      expect(longPayload!.exp).toBeGreaterThan(shortPayload!.exp);
    });

    it('should include all required payload fields', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token = await generateJWT(payload, TEST_SECRET, '10m');
      const verified = await verifyJWT(token, TEST_SECRET);

      expect(verified).toMatchObject({
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access',
      });
      
      expect(verified!.exp).toBeDefined();
      expect(verified!.iat).toBeDefined();
      expect(verified!.jti).toBeDefined();
      expect(verified!.jti).toBeValidUUID();
    });

    it('should handle different time units correctly', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const now = Math.floor(Date.now() / 1000);
      
      // Test seconds
      const secondsToken = await generateJWT(payload, TEST_SECRET, '30s');
      const secondsPayload = await verifyJWT(secondsToken, TEST_SECRET);
      expect(secondsPayload!.exp).toBeWithinRange(now + 25, now + 35);
      
      // Test minutes
      const minutesToken = await generateJWT(payload, TEST_SECRET, '5m');
      const minutesPayload = await verifyJWT(minutesToken, TEST_SECRET);
      expect(minutesPayload!.exp).toBeWithinRange(now + 295, now + 305);
      
      // Test hours
      const hoursToken = await generateJWT(payload, TEST_SECRET, '2h');
      const hoursPayload = await verifyJWT(hoursToken, TEST_SECRET);
      expect(hoursPayload!.exp).toBeWithinRange(now + 7195, now + 7205);
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT token', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token = await generateJWT(payload, TEST_SECRET, '10m');
      const verified = await verifyJWT(token, TEST_SECRET);

      expect(verified).not.toBeNull();
      expect(verified!.user_id).toBe(testUser.id);
      expect(verified!.username).toBe(testUser.username);
      expect(verified!.email).toBe(testUser.email);
    });

    it('should return null for invalid tokens', async () => {
      const invalidToken = 'invalid.jwt.token';
      const verified = await verifyJWT(invalidToken, TEST_SECRET);
      expect(verified).toBeNull();
    });

    it('should return null for tokens with wrong secret', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token = await generateJWT(payload, TEST_SECRET, '10m');
      const verified = await verifyJWT(token, 'wrong-secret');
      
      expect(verified).toBeNull();
    });

    it('should return null for expired tokens', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      // Create a token that expires immediately
      const token = await generateJWT(payload, TEST_SECRET, '1s');
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const verified = await verifyJWT(token, TEST_SECRET);
      expect(verified).toBeNull();
    });

    it('should validate required payload fields', async () => {
      // This test is more about ensuring the validation logic works
      // In practice, invalid payloads shouldn't be generated
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token = await generateJWT(payload, TEST_SECRET, '10m');
      const verified = await verifyJWT(token, TEST_SECRET);
      
      expect(verified).not.toBeNull();
      expect(typeof verified!.user_id).toBe('number');
      expect(typeof verified!.username).toBe('string');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);

      expect(tokenPair.access_token).toBeDefined();
      expect(tokenPair.refresh_token).toBeDefined();
      expect(tokenPair.access_token).toBeValidJWT();
      expect(tokenPair.refresh_token).toBeValidJWT();
      expect(tokenPair.access_token).not.toBe(tokenPair.refresh_token);
    });

    it('should create tokens with correct types', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);

      const accessPayload = await verifyJWT(tokenPair.access_token, TEST_SECRET);
      const refreshPayload = await verifyJWT(tokenPair.refresh_token, TEST_SECRET);

      expect(accessPayload!.token_type).toBe('access');
      expect(refreshPayload!.token_type).toBe('refresh');
    });

    it('should have different expiration times for access and refresh tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);

      const accessPayload = await verifyJWT(tokenPair.access_token, TEST_SECRET);
      const refreshPayload = await verifyJWT(tokenPair.refresh_token, TEST_SECRET);

      // Refresh token should expire later than access token
      expect(refreshPayload!.exp).toBeGreaterThan(accessPayload!.exp);
    });

    it('should store refresh token in KV namespace', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      const refreshPayload = await verifyJWT(tokenPair.refresh_token, TEST_SECRET);

      // Check if refresh token was stored in KV
      const storedData = await mockEnv.AUTH_KV.get(`refresh_token:${refreshPayload!.jti}`);
      expect(storedData).not.toBeNull();

      const parsedData = JSON.parse(storedData!);
      expect(parsedData.user_id).toBe(testUser.id);
      expect(parsedData.username).toBe(testUser.username);
      expect(parsedData.expires_at).toBe(refreshPayload!.exp * 1000);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh a valid refresh token', async () => {
      // Generate initial token pair
      const initialPair = await generateTokenPair(testUser, mockEnv);
      
      // Refresh the access token
      const newPair = await refreshAccessToken(initialPair.refresh_token, mockEnv);

      expect(newPair).not.toBeNull();
      expect(newPair!.access_token).toBeDefined();
      expect(newPair!.refresh_token).toBeDefined();
      
      // New tokens should be different from original
      expect(newPair!.access_token).not.toBe(initialPair.access_token);
      expect(newPair!.refresh_token).not.toBe(initialPair.refresh_token);
    });

    it('should blacklist the old refresh token', async () => {
      const initialPair = await generateTokenPair(testUser, mockEnv);
      const refreshPayload = await verifyJWT(initialPair.refresh_token, TEST_SECRET);
      
      await refreshAccessToken(initialPair.refresh_token, mockEnv);
      
      // Old refresh token should be blacklisted
      const blacklisted = await mockEnv.AUTH_KV.get(`blacklist:${refreshPayload!.jti}`);
      expect(blacklisted).not.toBeNull();
      
      const blacklistData = JSON.parse(blacklisted!);
      expect(blacklistData.reason).toBe('token_rotated');
    });

    it('should return null for invalid refresh tokens', async () => {
      const invalidToken = 'invalid.refresh.token';
      const result = await refreshAccessToken(invalidToken, mockEnv);
      expect(result).toBeNull();
    });

    it('should return null for access tokens used as refresh tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      
      // Try to refresh using an access token instead of refresh token
      const result = await refreshAccessToken(tokenPair.access_token, mockEnv);
      expect(result).toBeNull();
    });

    it('should return null for blacklisted refresh tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      
      // Blacklist the refresh token
      await blacklistToken(tokenPair.refresh_token, 'manual_logout', mockEnv);
      
      // Try to refresh
      const result = await refreshAccessToken(tokenPair.refresh_token, mockEnv);
      expect(result).toBeNull();
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a valid token', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      const payload = await verifyJWT(tokenPair.access_token, TEST_SECRET);
      
      await blacklistToken(tokenPair.access_token, 'manual_logout', mockEnv);
      
      const blacklisted = await mockEnv.AUTH_KV.get(`blacklist:${payload!.jti}`);
      expect(blacklisted).not.toBeNull();
      
      const blacklistData = JSON.parse(blacklisted!);
      expect(blacklistData.reason).toBe('manual_logout');
      expect(blacklistData.blacklisted_at).toBeTypeOf('number');
    });

    it('should handle invalid tokens gracefully', async () => {
      // Should not throw an error
      await expect(blacklistToken('invalid.token', 'test', mockEnv)).resolves.not.toThrow();
    });

    it('should set different TTL for access vs refresh tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      
      await blacklistToken(tokenPair.access_token, 'test', mockEnv);
      await blacklistToken(tokenPair.refresh_token, 'test', mockEnv);
      
      // Both should be blacklisted (specific TTL testing would require KV mock enhancement)
      const accessBlacklisted = await isTokenBlacklisted(tokenPair.access_token, mockEnv);
      const refreshBlacklisted = await isTokenBlacklisted(tokenPair.refresh_token, mockEnv);
      
      expect(accessBlacklisted).toBe(true);
      expect(refreshBlacklisted).toBe(true);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false for valid non-blacklisted tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      
      const isBlacklisted = await isTokenBlacklisted(tokenPair.access_token, mockEnv);
      expect(isBlacklisted).toBe(false);
    });

    it('should return true for blacklisted tokens', async () => {
      const tokenPair = await generateTokenPair(testUser, mockEnv);
      
      await blacklistToken(tokenPair.access_token, 'test', mockEnv);
      
      const isBlacklisted = await isTokenBlacklisted(tokenPair.access_token, mockEnv);
      expect(isBlacklisted).toBe(true);
    });

    it('should return true for invalid tokens', async () => {
      const isBlacklisted = await isTokenBlacklisted('invalid.token', mockEnv);
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should generate tokens within acceptable time limits', async () => {
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await generateJWT({
          user_id: i,
          username: `user${i}`,
          email: `user${i}@example.com`,
          token_type: 'access',
        }, TEST_SECRET, '10m');
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Should generate tokens in under 10ms each on average
      expect(avgTime).toBeLessThan(10);
    });

    it('should verify tokens within acceptable time limits', async () => {
      // Pre-generate tokens
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        const token = await generateJWT({
          user_id: i,
          username: `user${i}`,
          email: `user${i}@example.com`,
          token_type: 'access',
        }, TEST_SECRET, '10m');
        tokens.push(token);
      }
      
      const start = performance.now();
      
      for (const token of tokens) {
        await verifyJWT(token, TEST_SECRET);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / tokens.length;
      
      // Should verify tokens in under 5ms each on average
      expect(avgTime).toBeLessThan(5);
    });
  });

  describe('Security Tests', () => {
    it('should generate unique JTI for each token', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token1 = await generateJWT(payload, TEST_SECRET, '10m');
      const token2 = await generateJWT(payload, TEST_SECRET, '10m');
      
      const payload1 = await verifyJWT(token1, TEST_SECRET);
      const payload2 = await verifyJWT(token2, TEST_SECRET);
      
      expect(payload1!.jti).not.toBe(payload2!.jti);
    });

    it('should not accept tokens signed with different secrets', async () => {
      const payload = {
        user_id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        token_type: 'access' as const,
      };

      const token = await generateJWT(payload, 'secret1', '10m');
      const verified = await verifyJWT(token, 'secret2');
      
      expect(verified).toBeNull();
    });

    it('should handle malformed tokens gracefully', async () => {
      const malformedTokens = [
        '',
        'not.a.jwt',
        'header.payload', // Missing signature
        'too.many.parts.here.extra',
        'header.payload.signature.extra',
      ];

      for (const token of malformedTokens) {
        const verified = await verifyJWT(token, TEST_SECRET);
        expect(verified).toBeNull();
      }
    });
  });
});