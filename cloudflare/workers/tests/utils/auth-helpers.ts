/**
 * Authentication Test Helpers
 * 
 * Utilities for testing authentication flows, JWT tokens, and auth middleware.
 */

import { generateJWT, verifyJWT } from '../../src/services/auth/jwt';
import type { Env, User, UserJWTPayload } from '../../src/types';
import { createMockEnv, createMockUser } from './test-env';

/**
 * Generate a valid test JWT token
 */
export async function createTestToken(
  payload: Partial<UserJWTPayload> = {},
  env: Env = createMockEnv()
): Promise<string> {
  const defaultPayload = {
    user_id: 1,
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access' as const,
  };

  return generateJWT(
    { ...defaultPayload, ...payload },
    env.JWT_SECRET,
    '10m'
  );
}

/**
 * Generate an expired test JWT token
 */
export async function createExpiredToken(
  payload: Partial<UserJWTPayload> = {},
  env: Env = createMockEnv()
): Promise<string> {
  const defaultPayload = {
    user_id: 1,
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access' as const,
  };

  // Create token that expired 1 hour ago
  return generateJWT(
    { ...defaultPayload, ...payload },
    env.JWT_SECRET,
    '-1h'
  );
}

/**
 * Generate a malformed token for testing
 */
export function createMalformedToken(): string {
  return 'invalid.jwt.token';
}

/**
 * Create valid authentication headers for requests
 */
export async function createAuthHeaders(
  payload: Partial<UserJWTPayload> = {},
  env: Env = createMockEnv()
): Promise<Headers> {
  const token = await createTestToken(payload, env);
  return new Headers({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  });
}

/**
 * Create a test request with authentication
 */
export async function createAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
  tokenPayload: Partial<UserJWTPayload> = {},
  env: Env = createMockEnv()
): Promise<Request> {
  const headers = await createAuthHeaders(tokenPayload, env);
  
  // Merge with existing headers
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    for (const [key, value] of headers.entries()) {
      existingHeaders.set(key, value);
    }
    options.headers = existingHeaders;
  } else {
    options.headers = headers;
  }

  return new Request(url, options);
}

/**
 * Mock successful user authentication
 */
export function mockUserAuthentication(env: Env, user: User = createMockUser()) {
  // Mock DB user lookup
  env.DB.prepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(user),
    all: vi.fn().mockResolvedValue({ results: [user] }),
    run: vi.fn().mockResolvedValue({ success: true }),
  });

  return user;
}

/**
 * Mock password verification for testing
 */
export function mockPasswordVerification(isValid: boolean = true) {
  // This would typically mock bcrypt or similar password hashing
  return vi.fn().mockResolvedValue(isValid);
}

/**
 * Setup KV mocks for token storage and blacklisting
 */
export function setupTokenKVMocks(env: Env) {
  const tokenStorage = new Map<string, string>();

  env.AUTH_KV.get = vi.fn().mockImplementation((key: string) => {
    return Promise.resolve(tokenStorage.get(key) || null);
  });

  env.AUTH_KV.put = vi.fn().mockImplementation((key: string, value: string) => {
    tokenStorage.set(key, value);
    return Promise.resolve();
  });

  env.AUTH_KV.delete = vi.fn().mockImplementation((key: string) => {
    tokenStorage.delete(key);
    return Promise.resolve();
  });

  return tokenStorage;
}

/**
 * Verify that a token is properly blacklisted
 */
export async function expectTokenBlacklisted(
  token: string, 
  env: Env
): Promise<void> {
  const payload = await verifyJWT(token, env.JWT_SECRET);
  expect(payload).toBeTruthy();
  
  const blacklistKey = `blacklist:${payload!.jti}`;
  expect(env.AUTH_KV.get).toHaveBeenCalledWith(blacklistKey);
}

/**
 * Assert that proper security headers are present
 */
export function expectSecurityHeaders(response: Response): void {
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
}

/**
 * Test different authentication scenarios
 */
export const authScenarios = {
  validToken: async (env: Env = createMockEnv()) => ({
    token: await createTestToken({}, env),
    env,
    expectedStatus: 200,
  }),
  
  expiredToken: async (env: Env = createMockEnv()) => ({
    token: await createExpiredToken({}, env),
    env,
    expectedStatus: 401,
  }),
  
  malformedToken: () => ({
    token: createMalformedToken(),
    env: createMockEnv(),
    expectedStatus: 401,
  }),
  
  noToken: () => ({
    token: null,
    env: createMockEnv(),
    expectedStatus: 401,
  }),
  
  invalidSecret: async () => {
    const env = createMockEnv();
    const token = await createTestToken({}, env);
    
    // Change the secret to make token invalid
    env.JWT_SECRET = 'different-secret-that-makes-token-invalid';
    
    return {
      token,
      env,
      expectedStatus: 401,
    };
  },
};

/**
 * Helper to test rate limiting
 */
export async function simulateRateLimit(
  makeRequest: () => Promise<Response>,
  maxRequests: number = 10
): Promise<Response[]> {
  const responses: Response[] = [];
  
  for (let i = 0; i < maxRequests + 1; i++) {
    responses.push(await makeRequest());
  }
  
  return responses;
}