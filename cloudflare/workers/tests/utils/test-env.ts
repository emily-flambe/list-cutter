/**
 * Test Environment Utilities
 * 
 * Provides utilities for creating mock environments, bindings, and contexts
 * for testing Cloudflare Workers functionality.
 */

import { vi } from 'vitest';
import type { Env } from '../../src/types';

/**
 * Create a mock Cloudflare environment for testing
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  const mockKV = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [] }),
  };

  const mockDB = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    batch: vi.fn().mockResolvedValue([]),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    exec: vi.fn().mockResolvedValue({ results: [] }),
  };

  const mockR2 = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({ key: 'test', etag: 'test-etag' }),
    delete: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ objects: [] }),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  };

  // const mockAnalytics = {
  //   writeDataPoint: vi.fn().mockResolvedValue(undefined),
  // };

  return {
    ENVIRONMENT: 'test',
    API_VERSION: 'v1',
    CORS_ORIGIN: '*',
    MAX_FILE_SIZE: '10485760',
    JWT_ISSUER: 'cutty-test',
    JWT_AUDIENCE: 'cutty-test',
    JWT_SECRET: 'test-secret-at-least-32-characters-long-for-security',
    JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long-for-security',
    API_KEY_SALT: 'test-api-key-salt-at-least-32-characters-long-for-security',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
    AI_WORKER_URL: 'https://ai.example.com',
    AI_WORKER_API_KEY: 'test-ai-worker-key',
    SECURITY_PERFORMANCE_THRESHOLD: '100',
    SECURITY_METRICS_RETENTION_DAYS: '30',
    SECURITY_ENABLE_REAL_TIME_MONITORING: 'true',
    AUTH_KV: mockKV as any,
    CUTTY_SECURITY_CONFIG: mockKV as any,
    CUTTY_SECURITY_EVENTS: mockKV as any,
    CUTTY_SECURITY_METRICS: mockKV as any,
    CUTTY_QUOTA_TRACKING: mockKV as any,
    DB: mockDB as any,
    FILE_STORAGE: mockR2 as any,
    ASSETS: { fetch: vi.fn() } as any,
    // ANALYTICS: mockAnalytics as any,
    ...overrides,
  };
}

/**
 * Create a mock request for testing
 */
export function createMockRequest(
  url: string = 'https://test.example.com/',
  init: RequestInit = {}
): Request {
  return new Request(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    ...init,
  });
}

/**
 * Create a mock execution context for testing
 */
export function createMockContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

/**
 * Helper to extract JSON from response
 */
export async function getResponseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Helper to assert response status and get JSON
 */
export async function expectResponse(
  response: Response,
  expectedStatus: number
): Promise<any> {
  expect(response.status).toBe(expectedStatus);
  return getResponseJson(response);
}

/**
 * Create mock user data for testing
 */
export function createMockUser(overrides: any = {}) {
  return {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock JWT payload for testing
 */
export function createMockJWTPayload(overrides: any = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    user_id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access',
    exp: now + 600, // 10 minutes from now
    iat: now,
    jti: crypto.randomUUID(),
    ...overrides,
  };
}

/**
 * Sleep utility for testing timing-sensitive operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that a function throws with a specific error
 */
export async function expectThrows(
  fn: () => Promise<any> | any,
  expectedError?: string | RegExp
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error).toHaveProperty('message', expectedError);
      } else {
        expect(error).toHaveProperty('message');
        expect((error as Error).message).toMatch(expectedError);
      }
    }
    return error as Error;
  }
}