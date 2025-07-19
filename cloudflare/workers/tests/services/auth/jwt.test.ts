import { describe, it, expect, beforeEach } from 'vitest';
import { 
  generateJWT, 
  verifyJWT, 
  generateTokenPair, 
  refreshAccessToken,
  blacklistToken,
  isTokenBlacklisted
} from '../../../src/services/auth/jwt';
import type { User, Env } from '../../../src/types';

// Mock environment for testing
const mockEnv: Env = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  AUTH_KV: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  DB: {} as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
} as Env;

// Mock user for testing
const mockUser: User = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z'
};

// Mock admin user for testing
const mockAdminUser: User = {
  id: '2',
  username: 'adminuser',
  email: 'admin@example.com',
  role: 'admin',
  created_at: '2024-01-01T00:00:00Z'
};

describe('JWT Service', () => {
  describe('generateJWT', () => {
    it('should generate a valid JWT token', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        token_type: 'access' as const
      };

      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '10m');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should throw error for missing JWT secret', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      };

      await expect(generateJWT(payload, '', '10m')).rejects.toThrow('JWT_SECRET is required');
    });

    it('should throw error for short JWT secret', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      };

      await expect(generateJWT(payload, 'short', '10m')).rejects.toThrow('at least 32 characters');
    });

    it('should throw error for missing user_id', async () => {
      const payload = {
        user_id: 0,
        username: mockUser.username,
        token_type: 'access' as const
      };

      await expect(generateJWT(payload, mockEnv.JWT_SECRET, '10m')).rejects.toThrow('must include user_id');
    });

    it('should throw error for missing username', async () => {
      const payload = {
        user_id: mockUser.id,
        username: '',
        token_type: 'access' as const
      };

      await expect(generateJWT(payload, mockEnv.JWT_SECRET, '10m')).rejects.toThrow('must include user_id and username');
    });

    it('should include role in JWT token when provided', async () => {
      const payload = {
        user_id: mockAdminUser.id,
        username: mockAdminUser.username,
        email: mockAdminUser.email,
        role: mockAdminUser.role,
        token_type: 'access' as const
      };

      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '10m');
      const verified = await verifyJWT(token, mockEnv.JWT_SECRET);
      
      expect(verified).toBeDefined();
      expect(verified?.role).toBe('admin');
    });

    it('should generate token without role for regular users', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        token_type: 'access' as const
      };

      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '10m');
      const verified = await verifyJWT(token, mockEnv.JWT_SECRET);
      
      expect(verified).toBeDefined();
      expect(verified?.role).toBeUndefined();
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT token', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        token_type: 'access' as const
      };

      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '10m');
      const verified = await verifyJWT(token, mockEnv.JWT_SECRET);

      expect(verified).toBeDefined();
      expect(verified?.user_id).toBe(mockUser.id);
      expect(verified?.username).toBe(mockUser.username);
      expect(verified?.token_type).toBe('access');
    });

    it('should return null for invalid token', async () => {
      const verified = await verifyJWT('invalid.token.here', mockEnv.JWT_SECRET);
      expect(verified).toBeNull();
    });

    it('should return null for empty token', async () => {
      const verified = await verifyJWT('', mockEnv.JWT_SECRET);
      expect(verified).toBeNull();
    });

    it('should return null for empty secret', async () => {
      const token = await generateJWT({
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      }, mockEnv.JWT_SECRET, '10m');

      const verified = await verifyJWT(token, '');
      expect(verified).toBeNull();
    });

    it('should return null for short secret', async () => {
      const token = await generateJWT({
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      }, mockEnv.JWT_SECRET, '10m');

      const verified = await verifyJWT(token, 'short');
      expect(verified).toBeNull();
    });

    it('should return null for token signed with different secret', async () => {
      const token = await generateJWT({
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      }, mockEnv.JWT_SECRET, '10m');

      const verified = await verifyJWT(token, 'different-secret-at-least-32-characters-long');
      expect(verified).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh token pair', async () => {
      const tokenPair = await generateTokenPair(mockUser, mockEnv);

      expect(tokenPair).toBeDefined();
      expect(tokenPair.access_token).toBeDefined();
      expect(tokenPair.refresh_token).toBeDefined();
      expect(typeof tokenPair.access_token).toBe('string');
      expect(typeof tokenPair.refresh_token).toBe('string');
    });

    it('should throw error for missing JWT_SECRET', async () => {
      const envWithoutSecret = { ...mockEnv, JWT_SECRET: undefined };
      await expect(generateTokenPair(mockUser, envWithoutSecret as any)).rejects.toThrow('JWT_SECRET environment variable is required');
    });

    it('should throw error for missing AUTH_KV', async () => {
      const envWithoutKV = { ...mockEnv, AUTH_KV: undefined };
      await expect(generateTokenPair(mockUser, envWithoutKV as any)).rejects.toThrow('AUTH_KV binding is required');
    });

    it('should include role in token pair for admin users', async () => {
      const tokenPair = await generateTokenPair(mockAdminUser, mockEnv);
      
      const accessPayload = await verifyJWT(tokenPair.access_token, mockEnv.JWT_SECRET);
      const refreshPayload = await verifyJWT(tokenPair.refresh_token, mockEnv.JWT_SECRET);
      
      expect(accessPayload?.role).toBe('admin');
      expect(refreshPayload?.role).toBe('admin');
    });

    it('should not include role in token pair for regular users', async () => {
      const tokenPair = await generateTokenPair(mockUser, mockEnv);
      
      const accessPayload = await verifyJWT(tokenPair.access_token, mockEnv.JWT_SECRET);
      const refreshPayload = await verifyJWT(tokenPair.refresh_token, mockEnv.JWT_SECRET);
      
      expect(accessPayload?.role).toBeUndefined();
      expect(refreshPayload?.role).toBeUndefined();
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist a valid token', async () => {
      const token = await generateJWT({
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      }, mockEnv.JWT_SECRET, '10m');

      // Should not throw
      await expect(blacklistToken(token, 'test_reason', mockEnv)).resolves.toBeUndefined();
    });

    it('should handle invalid token gracefully', async () => {
      // Should not throw
      await expect(blacklistToken('invalid.token', 'test_reason', mockEnv)).resolves.toBeUndefined();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for invalid token', async () => {
      const isBlacklisted = await isTokenBlacklisted('invalid.token', mockEnv);
      expect(isBlacklisted).toBe(true);
    });

    it('should return false for valid non-blacklisted token', async () => {
      const token = await generateJWT({
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      }, mockEnv.JWT_SECRET, '10m');

      const isBlacklisted = await isTokenBlacklisted(token, mockEnv);
      expect(isBlacklisted).toBe(false);
    });
  });

  describe('token expiration handling', () => {
    it('should generate token with correct expiration', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      };

      const token = await generateJWT(payload, mockEnv.JWT_SECRET, '1m');
      const verified = await verifyJWT(token, mockEnv.JWT_SECRET);

      expect(verified?.exp).toBeDefined();
      expect(verified?.iat).toBeDefined();
      expect(verified?.jti).toBeDefined();
      
      // Token should expire in about 1 minute (60 seconds)
      const expectedExp = Math.floor(Date.now() / 1000) + 60;
      expect(verified?.exp).toBeCloseTo(expectedExp, 5); // Allow 5 second variance
    });

    it('should handle different expiration formats', async () => {
      const payload = {
        user_id: mockUser.id,
        username: mockUser.username,
        token_type: 'access' as const
      };

      // Test various expiration formats
      const formats = ['30s', '5m', '1h', '1d'];
      
      for (const format of formats) {
        const token = await generateJWT(payload, mockEnv.JWT_SECRET, format);
        const verified = await verifyJWT(token, mockEnv.JWT_SECRET);
        expect(verified).toBeDefined();
        expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      }
    });
  });
});