import { vi } from 'vitest';
import type { Env } from '../../src/types';

/**
 * Standard mock environment for tests
 * Includes all required environment variables and proper mocks for bindings
 */
export const createMockEnv = (overrides: Partial<Env> = {}): Env => ({
  // Required environment variables
  ENVIRONMENT: 'test',
  API_VERSION: 'v1',
  CORS_ORIGIN: 'http://localhost:5173',
  MAX_FILE_SIZE: '52428800',
  JWT_ISSUER: 'cutty',
  JWT_AUDIENCE: 'cutty',
  
  // Secrets
  JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
  API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
  DB_ENCRYPTION_KEY: 'test-encryption-key-at-least-32-characters-long',
  
  // Bindings
  DB: {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue([])
      })
    })
  } as any,
  FILE_STORAGE: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false })
  } as any,
  ASSETS: {
    fetch: vi.fn().mockResolvedValue(new Response('test'))
  } as any,
  
  // Optional KV bindings
  AUTH_KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  } as any,
  ANALYTICS: {
    writeDataPoint: vi.fn().mockResolvedValue(undefined)
  } as any,
  CUTTY_SECURITY_CONFIG: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  } as any,
  CUTTY_SECURITY_EVENTS: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  } as any,
  CUTTY_SECURITY_METRICS: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  } as any,
  CUTTY_QUOTA_TRACKING: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  } as any,
  
  // Apply any overrides
  ...overrides
});

/**
 * Create a mock environment with specific database responses
 */
export const createMockEnvWithDB = (dbMocks: any = {}) => {
  return createMockEnv({
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(dbMocks.first || null),
          run: vi.fn().mockResolvedValue(dbMocks.run || { success: true }),
          all: vi.fn().mockResolvedValue(dbMocks.all || [])
        })
      })
    } as any
  });
};