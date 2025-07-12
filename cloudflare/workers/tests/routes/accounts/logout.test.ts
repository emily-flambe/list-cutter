import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleLogout } from '../../../src/routes/accounts/logout';
import type { Env } from '../../../src/types';

// Mock dependencies
vi.mock('../../../src/services/auth/jwt', () => ({
  blacklistToken: vi.fn(),
  verifyJWT: vi.fn()
}));

vi.mock('../../../src/services/security/logger', () => ({
  SecurityLogger: vi.fn().mockImplementation(() => ({
    logAuthEvent: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../../../src/services/security/metrics', () => ({
  MetricsCollector: vi.fn().mockImplementation(() => ({
    recordAuthMetrics: vi.fn().mockResolvedValue(undefined)
  }))
}));

import { blacklistToken, verifyJWT } from '../../../src/services/auth/jwt';

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
  DB: {} as any,
  FILE_STORAGE: {} as any,
  ANALYTICS: {} as any,
  ENVIRONMENT: 'test'
} as Env;

const mockAccessToken = 'valid.access.token';
const mockRefreshToken = 'valid.refresh.token';

describe('Logout Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should logout successfully with access token in header', async () => {
    // Setup mocks
    vi.mocked(verifyJWT).mockResolvedValue({ user_id: 1, exp: Date.now() / 1000 + 3600 });
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify access token was blacklisted
    expect(blacklistToken).toHaveBeenCalledWith(mockAccessToken, 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(1);
    expect(verifyJWT).toHaveBeenCalledWith(mockAccessToken, mockEnv.JWT_SECRET);
  });

  it('should logout successfully with refresh token in body', async () => {
    // Setup mocks
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: mockRefreshToken
      })
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify refresh token was blacklisted
    expect(blacklistToken).toHaveBeenCalledWith(mockRefreshToken, 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(1);
    expect(verifyJWT).not.toHaveBeenCalled();
  });

  it('should logout successfully with both tokens', async () => {
    // Setup mocks
    vi.mocked(verifyJWT).mockResolvedValue({ user_id: 1, exp: Date.now() / 1000 + 3600 });
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: mockRefreshToken
      })
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify both tokens were blacklisted
    expect(blacklistToken).toHaveBeenCalledWith(mockAccessToken, 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledWith(mockRefreshToken, 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(2);
    expect(verifyJWT).toHaveBeenCalledWith(mockAccessToken, mockEnv.JWT_SECRET);
  });

  it('should logout successfully with no tokens (graceful handling)', async () => {
    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify no tokens were blacklisted
    expect(blacklistToken).not.toHaveBeenCalled();
    expect(verifyJWT).not.toHaveBeenCalled();
  });

  it('should logout successfully with invalid access token (graceful handling)', async () => {
    // Setup mocks - verifyJWT fails but logout still succeeds
    vi.mocked(verifyJWT).mockRejectedValue(new Error('Invalid token'));
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid.token.here',
        'Content-Type': 'application/json'
      }
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify token was still blacklisted despite being invalid
    expect(blacklistToken).toHaveBeenCalledWith('invalid.token.here', 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(1);
    expect(verifyJWT).toHaveBeenCalledWith('invalid.token.here', mockEnv.JWT_SECRET);
  });

  it('should logout successfully with invalid refresh token (graceful handling)', async () => {
    // Setup mocks
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'invalid.refresh.token'
      })
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify token was blacklisted even if invalid
    expect(blacklistToken).toHaveBeenCalledWith('invalid.refresh.token', 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(1);
  });

  it('should handle malformed Authorization header gracefully', async () => {
    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': 'NotBearer invalid-format',
        'Content-Type': 'application/json'
      }
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify no blacklisting occurred for malformed header
    expect(blacklistToken).not.toHaveBeenCalled();
    expect(verifyJWT).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON in request body gracefully', async () => {
    // Setup mocks
    vi.mocked(verifyJWT).mockResolvedValue({ user_id: 1, exp: Date.now() / 1000 + 3600 });
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify only access token was blacklisted (body parsing failed gracefully)
    expect(blacklistToken).toHaveBeenCalledWith(mockAccessToken, 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(1);
    expect(verifyJWT).toHaveBeenCalledWith(mockAccessToken, mockEnv.JWT_SECRET);
  });

  it('should handle blacklistToken failure by throwing error', async () => {
    // Setup mocks - blacklistToken fails
    vi.mocked(verifyJWT).mockResolvedValue({ user_id: 1, exp: Date.now() / 1000 + 3600 });
    vi.mocked(blacklistToken).mockRejectedValue(new Error('Blacklist service unavailable'));

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    await expect(handleLogout(request, mockEnv)).rejects.toThrow();

    // Verify blacklistToken was attempted
    expect(blacklistToken).toHaveBeenCalledWith(mockAccessToken, 'user_logout', mockEnv);
    expect(verifyJWT).toHaveBeenCalledWith(mockAccessToken, mockEnv.JWT_SECRET);
  });

  it('should handle empty request body gracefully', async () => {
    // Setup mocks
    vi.mocked(verifyJWT).mockResolvedValue({ user_id: 1, exp: Date.now() / 1000 + 3600 });
    vi.mocked(blacklistToken).mockResolvedValue(undefined);

    const request = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: ''
    });

    const response = await handleLogout(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Verify only access token was blacklisted
    expect(blacklistToken).toHaveBeenCalledWith(mockAccessToken, 'user_logout', mockEnv);
    expect(blacklistToken).toHaveBeenCalledTimes(1);
    expect(verifyJWT).toHaveBeenCalledWith(mockAccessToken, mockEnv.JWT_SECRET);
  });
});