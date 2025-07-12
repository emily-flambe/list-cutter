import { describe, it, expect, beforeEach } from 'vitest';
import { APIKeyService } from '../../src/services/auth/apiKeys';
import { 
  APIKeyError, 
  APIKeyNotFoundError, 
  APIKeyExpiredError, 
  APIKeyInactiveError,
  EnvironmentError,
  ValidationError 
} from '../../src/types/errors';
import { APIPermission } from '../../src/types/permissions';
import type { Env, APIKeyCreateRequest } from '../../src/types';

/**
 * API Key Security Tests
 * 
 * Tests comprehensive API key security scenarios:
 * - API key generation security
 * - Key format validation and tampering
 * - Hash security and salt validation
 * - Permission escalation prevention
 * - Key expiration handling
 * - Key revocation and reactivation
 * - Usage tracking security
 * - Brute force protection
 */

const mockEnv: Env = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  AUTH_KV: {
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
        run: async () => ({ success: true, changes: 1 })
      })
    })
  } as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
} as Env;

describe.skip('API Key Security Tests', () => {
  let apiKeyService: APIKeyService;
  let mockDbResults: Map<string, any>;

  beforeEach(() => {
    apiKeyService = new APIKeyService(mockEnv);
    mockDbResults = new Map();

    // Enhanced DB mock that can store and retrieve data
    mockEnv.DB = {
      prepare: (query: string) => ({
        bind: (...values: any[]) => ({
          first: async () => {
            // Simulate database lookups
            if (query.includes('SELECT')) {
              const keyHash = values[0];
              return mockDbResults.get(keyHash) || null;
            }
            return null;
          },
          all: async () => ({ results: Array.from(mockDbResults.values()) }),
          run: async () => {
            // Simulate INSERT/UPDATE operations
            if (query.includes('INSERT') && values.length >= 8) {
              const [keyId, userId, name, keyHash] = values;
              mockDbResults.set(keyHash, {
                key_id: keyId,
                user_id: userId,
                name,
                key_hash: keyHash,
                key_prefix: 'cutty_',
                permissions: values[5],
                created_at: values[6],
                expires_at: values[7],
                is_active: values[8],
                rate_limit_override: values[9]
              });
            }
            return { success: true, changes: 1 };
          }
        })
      })
    } as any;
  });

  describe.skip('API Key Generation Security', () => {
    it('should generate secure API keys with proper format', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Test API Key',
        permissions: [APIPermission.FILES_READ, APIPermission.FILES_WRITE]
      };

      const result = await apiKeyService.generateAPIKey(1, request);

      expect(result.api_key).toMatch(/^cutty_[A-Za-z0-9]{32}$/);
      expect(result.key_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should generate unique keys for each request', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Test API Key',
        permissions: [APIPermission.FILES_READ]
      };

      const keys = await Promise.all([
        apiKeyService.generateAPIKey(1, request),
        apiKeyService.generateAPIKey(1, request),
        apiKeyService.generateAPIKey(1, request)
      ]);

      const apiKeys = keys.map(k => k.api_key);
      const keyIds = keys.map(k => k.key_id);

      // All keys should be unique
      expect(new Set(apiKeys).size).toBe(3);
      expect(new Set(keyIds).size).toBe(3);
    });

    it('should validate permission requirements', async () => {
      const invalidRequests = [
        {
          name: 'Invalid Permissions',
          permissions: ['invalid_permission' as any]
        },
        {
          name: 'Mixed Valid/Invalid',
          permissions: [APIPermission.FILES_READ, 'invalid_permission' as any]
        },
        {
          name: 'Empty Permissions',
          permissions: []
        }
      ];

      for (const request of invalidRequests) {
        await expect(apiKeyService.generateAPIKey(1, request))
          .rejects.toThrow('Invalid permissions');
      }
    });

    it('should handle expiration validation', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Expiring Key',
        permissions: [APIPermission.FILES_READ],
        expires_in_days: 30
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      expect(result.api_key).toBeDefined();

      // Verify expiration is set correctly in database
      const storedData = Array.from(mockDbResults.values())[0];
      const expectedExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
      expect(storedData.expires_at).toBeCloseTo(expectedExpiry, -3); // Within 1 second
    });
  });

  describe.skip('API Key Format Validation', () => {
    it('should reject keys without proper prefix', async () => {
      const invalidKeys = [
        'invalid_key_without_cutty_prefix_12345',
        'api_key_wrong_prefix_12345',
        'wrong_prefix_12345',
        '12345_cutty_reversed',
        'cutty12345', // Missing underscore
      ];

      for (const key of invalidKeys) {
        const result = await apiKeyService.validateAPIKey(key);
        expect(result).toBeNull();
      }
    });

    it('should reject malformed key structures', async () => {
      const malformedKeys = [
        'cutty_', // Empty key part
        'cutty_short', // Too short
        'cutty_' + 'x'.repeat(100), // Too long
        'cutty_with spaces', // Spaces
        'cutty_with-special!chars', // Special characters
        'cutty_\x00nullbyte', // Null byte
        'cutty_unicode£€¥', // Unicode characters
      ];

      for (const key of malformedKeys) {
        const result = await apiKeyService.validateAPIKey(key);
        expect(result).toBeNull();
      }
    });

    it('should handle key injection attempts', async () => {
      const injectionKeys = [
        'cutty_12345; DROP TABLE api_keys;',
        'cutty_12345<script>alert("xss")</script>',
        'cutty_12345${process.env.SECRET}',
        'cutty_12345\n\rHTTP/1.1 200 OK',
        'cutty_12345%0AHTTP/1.1 200 OK',
      ];

      for (const key of injectionKeys) {
        const result = await apiKeyService.validateAPIKey(key);
        expect(result).toBeNull();
      }
    });
  });

  describe.skip('Hash Security Validation', () => {
    it('should require API_KEY_SALT configuration', async () => {
      const envWithoutSalt = { ...mockEnv, API_KEY_SALT: undefined };
      const serviceWithoutSalt = new APIKeyService(envWithoutSalt as any);

      await expect(serviceWithoutSalt.generateAPIKey(1, {
        name: 'Test Key',
        permissions: [APIPermission.FILES_READ]
      })).rejects.toThrow('API_KEY_SALT environment variable is required');
    });

    it('should reject default salt in production', async () => {
      const envWithDefaultSalt = { 
        ...mockEnv, 
        API_KEY_SALT: 'default-salt-change-in-production' 
      };
      const serviceWithDefaultSalt = new APIKeyService(envWithDefaultSalt);

      await expect(serviceWithDefaultSalt.generateAPIKey(1, {
        name: 'Test Key',
        permissions: [APIPermission.FILES_READ]
      })).rejects.toThrow('Default salt detected');
    });

    it('should require minimum salt length', async () => {
      const envWithShortSalt = { ...mockEnv, API_KEY_SALT: 'short-salt' };
      const serviceWithShortSalt = new APIKeyService(envWithShortSalt);

      await expect(serviceWithShortSalt.generateAPIKey(1, {
        name: 'Test Key',
        permissions: [APIPermission.FILES_READ]
      })).rejects.toThrow('must be at least 32 characters long');
    });

    it('should produce different hashes for same key with different salts', async () => {
      const salt1 = 'test-salt-1-at-least-32-characters-long-for-security';
      const salt2 = 'test-salt-2-at-least-32-characters-long-for-security';

      const env1 = { ...mockEnv, API_KEY_SALT: salt1 };
      const env2 = { ...mockEnv, API_KEY_SALT: salt2 };

      const service1 = new APIKeyService(env1);
      const service2 = new APIKeyService(env2);

      const testKey = 'cutty_sametestkey123456789012345678';

      // Generate with first salt
      await service1.generateAPIKey(1, {
        name: 'Test Key 1',
        permissions: [APIPermission.FILES_READ]
      });

      // Generate with second salt
      await service2.generateAPIKey(1, {
        name: 'Test Key 2', 
        permissions: [APIPermission.FILES_READ]
      });

      // Validation should fail cross-salt
      const result = await service1.validateAPIKey(testKey);
      expect(result).toBeNull(); // Different salt = different hash
    });
  });

  describe.skip('Permission Escalation Prevention', () => {
    it('should not allow permission modification after creation', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Limited Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      
      // Simulate key stored in database
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Limited Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        expires_at: null,
        is_active: 1,
        rate_limit_override: null
      });

      const validatedKey = await apiKeyService.validateAPIKey(result.api_key);
      expect(validatedKey?.permissions).toEqual([APIPermission.FILES_READ]);
      expect(validatedKey?.permissions).not.toContain(APIPermission.ADMIN_ALL);
    });

    it('should prevent permission injection through key manipulation', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Test Key',
        permissions: [APIPermission.FILES_READ]
      };

      // Attempt to inject admin permissions
      const maliciousRequests = [
        {
          ...request,
          permissions: [APIPermission.FILES_READ, 'admin_all' as any]
        },
        {
          ...request,
          permissions: ['["admin_all"]' as any] // JSON injection attempt
        }
      ];

      for (const maliciousRequest of maliciousRequests) {
        await expect(apiKeyService.generateAPIKey(1, maliciousRequest))
          .rejects.toThrow('Invalid permissions');
      }
    });

    it('should validate permissions on each request', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Test Key',
        permissions: [APIPermission.FILES_READ, APIPermission.FILES_WRITE]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Test Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ, APIPermission.FILES_WRITE]),
        created_at: Date.now(),
        expires_at: null,
        is_active: 1,
        rate_limit_override: null
      });

      const apiKey = await apiKeyService.validateAPIKey(result.api_key);
      expect(apiKey).toBeDefined();

      // Test permission checking
      expect(apiKeyService.hasPermission(apiKey!, APIPermission.FILES_READ)).toBe(true);
      expect(apiKeyService.hasPermission(apiKey!, APIPermission.FILES_WRITE)).toBe(true);
      expect(apiKeyService.hasPermission(apiKey!, APIPermission.ADMIN_ALL)).toBe(false);
    });
  });

  describe.skip('Key Expiration Security', () => {
    it('should reject expired keys', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Expired Key',
        permissions: [APIPermission.FILES_READ],
        expires_in_days: 1
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      
      // Set expiration in the past
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Expired Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now() - 86400000,
        expires_at: Date.now() - 3600000, // Expired 1 hour ago
        is_active: 1,
        rate_limit_override: null
      });

      const validatedKey = await apiKeyService.validateAPIKey(result.api_key);
      expect(validatedKey).toBeNull();
    });

    it('should throw specific error for expired keys with enhanced validation', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Expired Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Expired Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        expires_at: Date.now() - 1000, // Expired
        is_active: 1,
        rate_limit_override: null
      });

      await expect(apiKeyService.validateAPIKeyWithErrors(result.api_key))
        .rejects.toThrow(APIKeyExpiredError);
    });

    it('should handle time manipulation attacks', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Future Key',
        permissions: [APIPermission.FILES_READ],
        expires_in_days: 1
      };

      // Test cannot create keys with past creation time or future expiration manipulation
      const result = await apiKeyService.generateAPIKey(1, request);
      const storedData = Array.from(mockDbResults.values())[0];
      
      const now = Date.now();
      expect(storedData.created_at).toBeLessThanOrEqual(now + 1000); // Allow some buffer
      expect(storedData.created_at).toBeGreaterThan(now - 60000); // Not more than 1 minute old
    });
  });

  describe.skip('Key Revocation Security', () => {
    it('should reject inactive keys', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Inactive Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      
      // Set key as inactive
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Inactive Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        expires_at: null,
        is_active: 0, // Inactive
        rate_limit_override: null
      });

      const validatedKey = await apiKeyService.validateAPIKey(result.api_key);
      expect(validatedKey).toBeNull();
    });

    it('should throw specific error for inactive keys', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Inactive Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Inactive Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        expires_at: null,
        is_active: 0,
        rate_limit_override: null
      });

      await expect(apiKeyService.validateAPIKeyWithErrors(result.api_key))
        .rejects.toThrow(APIKeyInactiveError);
    });

    it('should only allow key owner to revoke keys', async () => {
      const request: APIKeyCreateRequest = {
        name: 'User Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      
      // Mock successful revocation by owner
      const ownerRevoke = await apiKeyService.revokeAPIKey(result.key_id, 1);
      expect(ownerRevoke).toBe(true);

      // Mock failed revocation by different user
      const otherUserRevoke = await apiKeyService.revokeAPIKey(result.key_id, 999);
      expect(otherUserRevoke).toBe(false);
    });
  });

  describe.skip('Brute Force Protection', () => {
    it('should handle rapid validation attempts gracefully', async () => {
      const invalidKeys = Array.from({ length: 100 }, (_, i) => 
        `cutty_invalid_key_${i.toString().padStart(20, '0')}`
      );

      const startTime = Date.now();
      const results = await Promise.all(
        invalidKeys.map(key => apiKeyService.validateAPIKey(key))
      );
      const endTime = Date.now();

      // Should handle 100 invalid keys quickly (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(results.every(r => r === null)).toBe(true);
    });

    it('should not leak timing information', async () => {
      const validRequest: APIKeyCreateRequest = {
        name: 'Valid Key',
        permissions: [APIPermission.FILES_READ]
      };

      const validKey = await apiKeyService.generateAPIKey(1, validRequest);
      const keyHash = await apiKeyService['hashAPIKey'](validKey.api_key);
      
      mockDbResults.set(keyHash, {
        key_id: validKey.key_id,
        user_id: 1,
        name: 'Valid Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: Date.now(),
        expires_at: null,
        is_active: 1,
        rate_limit_override: null
      });

      // Time valid key validation
      const validStart = Date.now();
      await apiKeyService.validateAPIKey(validKey.api_key);
      const validTime = Date.now() - validStart;

      // Time invalid key validation
      const invalidStart = Date.now();
      await apiKeyService.validateAPIKey('cutty_invalid_key_12345678901234567890');
      const invalidTime = Date.now() - invalidStart;

      // Timing should be similar (within 50ms difference to prevent timing attacks)
      expect(Math.abs(validTime - invalidTime)).toBeLessThan(50);
    });

    it('should handle malformed key floods', async () => {
      const malformedKeys = [
        '', 'a', 'ab', 'abc', // Short keys
        'x'.repeat(1000), // Very long key
        'cutty_', // Prefix only
        'not_cutty_prefix', // Wrong prefix
        ...Array.from({ length: 50 }, () => Math.random().toString(36)) // Random strings
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        malformedKeys.map(key => apiKeyService.validateAPIKey(key))
      );
      const endTime = Date.now();

      // Should handle malformed keys quickly
      expect(endTime - startTime).toBeLessThan(500);
      expect(results.every(r => r === null)).toBe(true);
    });
  });

  describe.skip('Enhanced Error Handling', () => {
    it('should provide specific error types for validation failures', async () => {
      // Test empty key
      await expect(apiKeyService.validateAPIKeyWithErrors(''))
        .rejects.toThrow(ValidationError);

      // Test invalid format
      await expect(apiKeyService.validateAPIKeyWithErrors('invalid-format'))
        .rejects.toThrow(ValidationError);

      // Test not found
      await expect(apiKeyService.validateAPIKeyWithErrors('cutty_notfound12345678901234567890'))
        .rejects.toThrow(APIKeyNotFoundError);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database failure
      mockEnv.DB = {
        prepare: () => ({
          bind: () => ({
            first: async () => { throw new Error('Database error'); },
            all: async () => { throw new Error('Database error'); },
            run: async () => { throw new Error('Database error'); }
          })
        })
      } as any;

      const failingService = new APIKeyService(mockEnv);

      await expect(failingService.generateAPIKey(1, {
        name: 'Test Key',
        permissions: [APIPermission.FILES_READ]
      })).rejects.toThrow();

      const result = await failingService.validateAPIKey('cutty_somekey12345678901234567890');
      expect(result).toBeNull(); // Should handle gracefully
    });
  });

  describe.skip('Usage Tracking Security', () => {
    it('should update last_used timestamp on validation', async () => {
      const request: APIKeyCreateRequest = {
        name: 'Tracked Key',
        permissions: [APIPermission.FILES_READ]
      };

      const result = await apiKeyService.generateAPIKey(1, request);
      const keyHash = await apiKeyService['hashAPIKey'](result.api_key);
      
      const originalTime = Date.now() - 10000; // 10 seconds ago
      mockDbResults.set(keyHash, {
        key_id: result.key_id,
        user_id: 1,
        name: 'Tracked Key',
        key_hash: keyHash,
        permissions: JSON.stringify([APIPermission.FILES_READ]),
        created_at: originalTime,
        last_used: originalTime,
        expires_at: null,
        is_active: 1,
        rate_limit_override: null
      });

      // Mock UPDATE query to capture timestamp update
      let updatedTimestamp: number | null = null;
      mockEnv.DB = {
        prepare: (query: string) => ({
          bind: (...values: any[]) => ({
            first: async () => {
              if (query.includes('SELECT')) {
                return mockDbResults.get(keyHash);
              }
              return null;
            },
            run: async () => {
              if (query.includes('UPDATE') && query.includes('last_used')) {
                updatedTimestamp = values[0] as number;
              }
              return { success: true, changes: 1 };
            },
            all: async () => ({ results: [] })
          })
        })
      } as any;

      const validatedKey = await apiKeyService.validateAPIKey(result.api_key);
      
      expect(validatedKey).toBeDefined();
      expect(updatedTimestamp).toBeGreaterThan(originalTime);
      expect(updatedTimestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should prevent usage tracking manipulation', async () => {
      // Test that last_used cannot be manipulated through API key content
      const maliciousKeys = [
        'cutty_12345678901234567890; UPDATE api_keys SET last_used=0',
        'cutty_12345678901234567890\x00; DROP TABLE api_keys',
        'cutty_12345678901234567890\'; DELETE FROM api_keys'
      ];

      for (const key of maliciousKeys) {
        const result = await apiKeyService.validateAPIKey(key);
        expect(result).toBeNull();
      }
    });
  });
});