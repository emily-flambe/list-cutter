import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIKeyService } from '../../../src/services/auth/apiKeys';
import { APIPermission } from '../../../src/types/permissions';
import type { Env, APIKeyCreateRequest } from '../../../src/types';

// Mock environment for testing
const mockDB = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({ changes: 1 }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] })
    })
  })
};

const mockEnv: Env = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  AUTH_KV: {
    get: async (key: string) => null,
    put: async (key: string, value: string, options?: any) => {},
    delete: async (key: string) => {},
    list: async (options?: any) => ({ keys: [], list_complete: true }),
  },
  DB: mockDB as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
} as Env;

const mockUserId = 1;

describe('APIKeyService', () => {
  let apiKeyService: APIKeyService;

  beforeEach(() => {
    vi.clearAllMocks();
    apiKeyService = new APIKeyService(mockEnv);
  });

  describe('generateAPIKey', () => {
    const validRequest: APIKeyCreateRequest = {
      name: 'Test API Key',
      permissions: [APIPermission.FILES_READ, APIPermission.FILES_WRITE],
      expires_in_days: 30,
      rate_limit_override: 1000
    };

    it('should generate API key successfully', async () => {
      const result = await apiKeyService.generateAPIKey(mockUserId, validRequest);

      expect(result).toBeDefined();
      expect(result.key_id).toBeDefined();
      expect(result.api_key).toBeDefined();
      expect(result.api_key).toMatch(/^cutty_/);
      expect(mockDB.prepare).toHaveBeenCalled();
    });

    it('should generate API key without expiration', async () => {
      const requestWithoutExpiry = {
        name: 'Test API Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(mockUserId, requestWithoutExpiry);

      expect(result).toBeDefined();
      expect(result.api_key).toMatch(/^cutty_/);
    });

    it('should throw error for invalid permissions', async () => {
      const invalidRequest = {
        name: 'Test API Key',
        permissions: ['invalid_permission']
      };

      await expect(
        apiKeyService.generateAPIKey(mockUserId, invalidRequest as any)
      ).rejects.toThrow('Invalid permissions specified');
    });

    it('should throw error for missing API_KEY_SALT', async () => {
      const envWithoutSalt = { ...mockEnv, API_KEY_SALT: undefined };
      const serviceWithoutSalt = new APIKeyService(envWithoutSalt as any);

      await expect(
        serviceWithoutSalt.generateAPIKey(mockUserId, validRequest)
      ).rejects.toThrow('API_KEY_SALT environment variable is required');
    });

    it('should throw error for default salt', async () => {
      const envWithDefaultSalt = { ...mockEnv, API_KEY_SALT: 'default-salt-change-in-production' };
      const serviceWithDefaultSalt = new APIKeyService(envWithDefaultSalt);

      await expect(
        serviceWithDefaultSalt.generateAPIKey(mockUserId, validRequest)
      ).rejects.toThrow('Default salt detected');
    });

    it('should throw error for short salt', async () => {
      const envWithShortSalt = { ...mockEnv, API_KEY_SALT: 'short' };
      const serviceWithShortSalt = new APIKeyService(envWithShortSalt);

      await expect(
        serviceWithShortSalt.generateAPIKey(mockUserId, validRequest)
      ).rejects.toThrow('at least 32 characters long');
    });
  });

  describe('validateAPIKey', () => {
    it('should return null for invalid prefix', async () => {
      const result = await apiKeyService.validateAPIKey('invalid_prefix_key');
      expect(result).toBeNull();
    });

    it('should return null for empty API key', async () => {
      const result = await apiKeyService.validateAPIKey('');
      expect(result).toBeNull();
    });

    it('should return null when key not found in database', async () => {
      mockDB.prepare().bind().first.mockResolvedValueOnce(null);
      
      const result = await apiKeyService.validateAPIKey('cutty_validformat123');
      expect(result).toBeNull();
    });

    it('should return API key data for valid key', async () => {
      const mockApiKeyData = {
        key_id: 'test-key-id',
        user_id: mockUserId,
        name: 'Test Key',
        key_hash: 'hash123',
        key_prefix: 'cutty_',
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        last_used: Date.now(),
        expires_at: null,
        is_active: 1,
        rate_limit_override: null
      };

      mockDB.prepare().bind().first.mockResolvedValueOnce(mockApiKeyData);
      
      const result = await apiKeyService.validateAPIKey('cutty_validkey123');

      expect(result).toBeDefined();
      expect(result?.key_id).toBe('test-key-id');
      expect(result?.user_id).toBe(mockUserId);
      expect(result?.permissions).toEqual([APIPermission.FILES_READ]);
      expect(result?.is_active).toBe(true);
    });

    it('should handle expired keys', async () => {
      const expiredKeyData = {
        key_id: 'expired-key-id',
        user_id: mockUserId,
        name: 'Expired Key',
        key_hash: 'hash123',
        key_prefix: 'cutty_',
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now() - 86400000, // 1 day ago
        last_used: Date.now() - 86400000,
        expires_at: Date.now() - 1000, // Expired 1 second ago
        is_active: 1,
        rate_limit_override: null
      };

      // Should not return expired key
      mockDB.prepare().bind().first.mockResolvedValueOnce(null);
      
      const result = await apiKeyService.validateAPIKey('cutty_expiredkey123');
      expect(result).toBeNull();
    });
  });

  describe('revokeAPIKey', () => {
    it('should revoke API key successfully', async () => {
      mockDB.prepare().bind().run.mockResolvedValueOnce({ changes: 1 });

      const result = await apiKeyService.revokeAPIKey('test-key-id', mockUserId);
      expect(result).toBe(true);
      expect(mockDB.prepare).toHaveBeenCalled();
    });

    it('should return false when key not found', async () => {
      mockDB.prepare().bind().run.mockResolvedValueOnce({ changes: 0 });

      const result = await apiKeyService.revokeAPIKey('nonexistent-key', mockUserId);
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockDB.prepare().bind().run.mockRejectedValueOnce(new Error('Database error'));

      const result = await apiKeyService.revokeAPIKey('test-key-id', mockUserId);
      expect(result).toBe(false);
    });
  });

  describe('listAPIKeys', () => {
    it('should return list of API keys for user', async () => {
      const mockKeys = [
        {
          key_id: 'key1',
          name: 'Key 1',
          permissions: JSON.stringify([APIPermission.FILES_READ]),
          created_at: Date.now(),
          last_used: Date.now(),
          expires_at: null,
          is_active: 1,
          rate_limit_override: null
        },
        {
          key_id: 'key2',
          name: 'Key 2',
          permissions: JSON.stringify([APIPermission.FILES_WRITE]),
          created_at: Date.now(),
          last_used: null,
          expires_at: Date.now() + 86400000,
          is_active: 1,
          rate_limit_override: 500
        }
      ];

      mockDB.prepare().bind().all.mockResolvedValueOnce({ results: mockKeys });

      const result = await apiKeyService.listAPIKeys(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].key_id).toBe('key1');
      expect(result[0].permissions).toEqual([APIPermission.FILES_READ]);
      expect(result[1].key_id).toBe('key2');
      expect(result[1].rate_limit_override).toBe(500);
    });

    it('should return empty list when user has no keys', async () => {
      mockDB.prepare().bind().all.mockResolvedValueOnce({ results: [] });

      const result = await apiKeyService.listAPIKeys(mockUserId);
      expect(result).toEqual([]);
    });
  });

  describe('permission methods', () => {
    const mockApiKey = {
      key_id: 'test-key',
      user_id: mockUserId,
      name: 'Test Key',
      key_hash: 'hash123',
      key_prefix: 'cutty_',
      permissions: [APIPermission.FILES_READ, APIPermission.FILES_WRITE],
      created_at: Date.now(),
      last_used: Date.now(),
      expires_at: null,
      is_active: true,
      rate_limit_override: null
    };

    describe('hasPermission', () => {
      it('should return true for granted permission', () => {
        const result = apiKeyService.hasPermission(mockApiKey, APIPermission.FILES_READ);
        expect(result).toBe(true);
      });

      it('should return false for missing permission', () => {
        const result = apiKeyService.hasPermission(mockApiKey, APIPermission.ADMIN_USERS);
        expect(result).toBe(false);
      });
    });

    describe('hasAllPermissions', () => {
      it('should return true when all permissions are granted', () => {
        const result = apiKeyService.hasAllPermissions(
          mockApiKey, 
          [APIPermission.FILES_READ, APIPermission.FILES_WRITE]
        );
        expect(result).toBe(true);
      });

      it('should return false when some permissions are missing', () => {
        const result = apiKeyService.hasAllPermissions(
          mockApiKey, 
          [APIPermission.FILES_READ, APIPermission.ADMIN_USERS]
        );
        expect(result).toBe(false);
      });

      it('should return true for empty permission list', () => {
        const result = apiKeyService.hasAllPermissions(mockApiKey, []);
        expect(result).toBe(true);
      });
    });
  });

  describe('getAPIKey', () => {
    it('should return API key data for valid key and user', async () => {
      const mockKeyData = {
        key_id: 'test-key-id',
        name: 'Test Key',
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        last_used: Date.now(),
        expires_at: null,
        is_active: 1,
        rate_limit_override: null
      };

      mockDB.prepare().bind().first.mockResolvedValueOnce(mockKeyData);

      const result = await apiKeyService.getAPIKey('test-key-id', mockUserId);

      expect(result).toBeDefined();
      expect(result?.key_id).toBe('test-key-id');
      expect(result?.name).toBe('Test Key');
    });

    it('should return null for nonexistent key', async () => {
      mockDB.prepare().bind().first.mockResolvedValueOnce(null);

      const result = await apiKeyService.getAPIKey('nonexistent-key', mockUserId);
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockDB.prepare().bind().first.mockRejectedValueOnce(new Error('Database error'));

      const result = await apiKeyService.getAPIKey('test-key-id', mockUserId);
      expect(result).toBeNull();
    });
  });
});