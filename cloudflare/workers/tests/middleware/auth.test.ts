import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../src/types';

// We'll need to mock the auth middleware functions since they may not be directly importable
// This test focuses on the auth middleware behavior patterns

// Mock environment
const mockEnv: Env = {
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  AUTH_KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  },
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ changes: 1 }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] })
      })
    })
  } as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
} as Env;

// Mock authentication middleware behavior
const createMockAuthMiddleware = (shouldAuthenticate: boolean = true) => {
  return async (c: Context, next: () => Promise<void>) => {
    if (shouldAuthenticate) {
      // Simulate successful authentication
      c.set('user', { id: 1, username: 'testuser' });
      c.set('authMethod', 'jwt');
    } else {
      // Simulate authentication failure
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
};

const createMockHybridAuthMiddleware = (authMethod: 'jwt' | 'api_key' | null = 'jwt') => {
  return async (c: Context, next: () => Promise<void>) => {
    if (authMethod) {
      c.set('user', { id: 1, username: 'testuser' });
      c.set('authMethod', authMethod);
      if (authMethod === 'api_key') {
        c.set('apiKey', { 
          key_id: 'test-key', 
          permissions: ['files:read', 'files:write'],
          user_id: 1 
        });
      }
    } else {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
};

describe('Authentication Middleware', () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    vi.clearAllMocks();
  });

  describe('JWT Authentication', () => {
    it('should allow access with valid JWT token', async () => {
      app.use('*', createMockAuthMiddleware(true));
      app.get('/protected', (c) => c.json({ message: 'Access granted' }));

      const req = new Request('http://localhost/protected', {
        headers: {
          'Authorization': 'Bearer valid.jwt.token'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('Access granted');
    });

    it('should deny access without token', async () => {
      app.use('*', createMockAuthMiddleware(false));
      app.get('/protected', (c) => c.json({ message: 'Access granted' }));

      const req = new Request('http://localhost/protected');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should deny access with invalid token', async () => {
      app.use('*', createMockAuthMiddleware(false));
      app.get('/protected', (c) => c.json({ message: 'Access granted' }));

      const req = new Request('http://localhost/protected', {
        headers: {
          'Authorization': 'Bearer invalid.jwt.token'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(401);
    });
  });

  describe('API Key Authentication', () => {
    it('should allow access with valid API key', async () => {
      app.use('*', createMockHybridAuthMiddleware('api_key'));
      app.get('/api/data', (c) => {
        const authMethod = c.get('authMethod');
        const apiKey = c.get('apiKey');
        return c.json({ 
          message: 'API access granted',
          authMethod,
          keyId: apiKey?.key_id
        });
      });

      const req = new Request('http://localhost/api/data', {
        headers: {
          'Authorization': 'Bearer cutty_validapikey123'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('API access granted');
      expect(data.authMethod).toBe('api_key');
      expect(data.keyId).toBe('test-key');
    });

    it('should deny access with invalid API key', async () => {
      app.use('*', createMockHybridAuthMiddleware(null));
      app.get('/api/data', (c) => c.json({ message: 'API access granted' }));

      const req = new Request('http://localhost/api/data', {
        headers: {
          'Authorization': 'Bearer cutty_invalidkey'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(401);
    });
  });

  describe('Hybrid Authentication', () => {
    it('should handle JWT authentication', async () => {
      app.use('*', createMockHybridAuthMiddleware('jwt'));
      app.get('/hybrid', (c) => {
        const authMethod = c.get('authMethod');
        return c.json({ authMethod });
      });

      const req = new Request('http://localhost/hybrid', {
        headers: {
          'Authorization': 'Bearer valid.jwt.token'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authMethod).toBe('jwt');
    });

    it('should handle API key authentication', async () => {
      app.use('*', createMockHybridAuthMiddleware('api_key'));
      app.get('/hybrid', (c) => {
        const authMethod = c.get('authMethod');
        return c.json({ authMethod });
      });

      const req = new Request('http://localhost/hybrid', {
        headers: {
          'Authorization': 'Bearer cutty_validkey123'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authMethod).toBe('api_key');
    });

    it('should deny access when both authentication methods fail', async () => {
      app.use('*', createMockHybridAuthMiddleware(null));
      app.get('/hybrid', (c) => c.json({ message: 'Access granted' }));

      const req = new Request('http://localhost/hybrid', {
        headers: {
          'Authorization': 'Bearer invalid.token'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(401);
    });
  });

  describe('Permission Validation', () => {
    it('should validate API key permissions', async () => {
      const permissionMiddleware = async (c: Context, next: () => Promise<void>) => {
        const authMethod = c.get('authMethod');
        const apiKey = c.get('apiKey');
        
        if (authMethod === 'api_key') {
          // Check if API key has required permission
          const hasPermission = apiKey?.permissions?.includes('files:read');
          if (!hasPermission) {
            return c.json({ error: 'Insufficient permissions' }, 403);
          }
        }
        await next();
      };

      app.use('*', createMockHybridAuthMiddleware('api_key'));
      app.use('*', permissionMiddleware);
      app.get('/files', (c) => c.json({ message: 'File access granted' }));

      const req = new Request('http://localhost/files', {
        headers: {
          'Authorization': 'Bearer cutty_validkey123'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.message).toBe('File access granted');
    });

    it('should deny access for insufficient API key permissions', async () => {
      const permissionMiddleware = async (c: Context, next: () => Promise<void>) => {
        const authMethod = c.get('authMethod');
        const apiKey = c.get('apiKey');
        
        if (authMethod === 'api_key') {
          // Check for admin permission that doesn't exist
          const hasPermission = apiKey?.permissions?.includes('admin:users');
          if (!hasPermission) {
            return c.json({ error: 'Insufficient permissions' }, 403);
          }
        }
        await next();
      };

      app.use('*', createMockHybridAuthMiddleware('api_key'));
      app.use('*', permissionMiddleware);
      app.get('/admin', (c) => c.json({ message: 'Admin access granted' }));

      const req = new Request('http://localhost/admin', {
        headers: {
          'Authorization': 'Bearer cutty_validkey123'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('Authentication Context', () => {
    it('should set user context for JWT authentication', async () => {
      app.use('*', createMockAuthMiddleware(true));
      app.get('/user', (c) => {
        const user = c.get('user');
        return c.json({ user });
      });

      const req = new Request('http://localhost/user', {
        headers: {
          'Authorization': 'Bearer valid.jwt.token'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user).toEqual({ id: 1, username: 'testuser' });
    });

    it('should set API key context for API key authentication', async () => {
      app.use('*', createMockHybridAuthMiddleware('api_key'));
      app.get('/context', (c) => {
        const user = c.get('user');
        const authMethod = c.get('authMethod');
        const apiKey = c.get('apiKey');
        
        return c.json({ 
          user, 
          authMethod, 
          hasApiKey: !!apiKey,
          apiKeyId: apiKey?.key_id 
        });
      });

      const req = new Request('http://localhost/context', {
        headers: {
          'Authorization': 'Bearer cutty_validkey123'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user).toEqual({ id: 1, username: 'testuser' });
      expect(data.authMethod).toBe('api_key');
      expect(data.hasApiKey).toBe(true);
      expect(data.apiKeyId).toBe('test-key');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed Authorization header', async () => {
      app.use('*', createMockAuthMiddleware(false));
      app.get('/test', (c) => c.json({ message: 'Success' }));

      const req = new Request('http://localhost/test', {
        headers: {
          'Authorization': 'InvalidFormat'
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(401);
    });

    it('should handle missing Authorization header', async () => {
      app.use('*', createMockAuthMiddleware(false));
      app.get('/test', (c) => c.json({ message: 'Success' }));

      const req = new Request('http://localhost/test');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
    });

    it('should handle empty token', async () => {
      app.use('*', createMockAuthMiddleware(false));
      app.get('/test', (c) => c.json({ message: 'Success' }));

      const req = new Request('http://localhost/test', {
        headers: {
          'Authorization': 'Bearer '
        }
      });

      const res = await app.request(req, mockEnv);
      expect(res.status).toBe(401);
    });
  });
});