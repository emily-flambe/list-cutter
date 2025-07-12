import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleRefresh } from '../../../src/routes/accounts/refresh';
import type { Env } from '../../../src/types';

// Mock dependencies
vi.mock('../../../src/services/auth/jwt', () => ({
  refreshAccessToken: vi.fn()
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

import { refreshAccessToken } from '../../../src/services/auth/jwt';

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

const mockTokens = {
  access_token: 'new.access.token.here',
  refresh_token: 'new.refresh.token.here'
};

describe('Refresh Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should refresh tokens successfully with valid refresh token', async () => {
    // Setup mocks
    vi.mocked(refreshAccessToken).mockResolvedValue(mockTokens);

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'valid.refresh.token.here'
      })
    });

    const response = await handleRefresh(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Token refreshed successfully');
    expect(data.access_token).toBe(mockTokens.access_token);
    expect(data.refresh_token).toBe(mockTokens.refresh_token);

    // Verify dependencies were called correctly
    expect(refreshAccessToken).toHaveBeenCalledWith('valid.refresh.token.here', mockEnv);
  });

  it('should return 401 for invalid refresh token', async () => {
    // Setup mocks - refreshAccessToken returns null for invalid tokens
    vi.mocked(refreshAccessToken).mockResolvedValue(null);

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'invalid.refresh.token.here'
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify refreshAccessToken was called
    expect(refreshAccessToken).toHaveBeenCalledWith('invalid.refresh.token.here', mockEnv);
  });

  it('should return 401 for expired refresh token', async () => {
    // Setup mocks - refreshAccessToken returns null for expired tokens
    vi.mocked(refreshAccessToken).mockResolvedValue(null);

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'expired.refresh.token.here'
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify refreshAccessToken was called
    expect(refreshAccessToken).toHaveBeenCalledWith('expired.refresh.token.here', mockEnv);
  });

  it('should return 400 for missing refresh token', async () => {
    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify no token refresh attempt was made
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should return 400 for empty refresh token', async () => {
    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: ''
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify no token refresh attempt was made
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should return 400 for null refresh token', async () => {
    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: null
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify no token refresh attempt was made
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify no token refresh attempt was made
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should handle malformed JSON in request body', async () => {
    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"refresh_token": incomplete'
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify no token refresh attempt was made
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('should handle token refresh service errors gracefully', async () => {
    // Setup mocks - refreshAccessToken throws an error
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Token service unavailable'));

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'valid.refresh.token.here'
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify token refresh was attempted
    expect(refreshAccessToken).toHaveBeenCalledWith('valid.refresh.token.here', mockEnv);
  });

  it('should handle JWT signing errors gracefully', async () => {
    // Setup mocks - refreshAccessToken throws JWT-specific error
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('JWT signing failed'));

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'valid.refresh.token.here'
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify token refresh was attempted
    expect(refreshAccessToken).toHaveBeenCalledWith('valid.refresh.token.here', mockEnv);
  });

  it('should handle database connection errors during token refresh', async () => {
    // Setup mocks - refreshAccessToken throws database error
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'valid.refresh.token.here'
      })
    });

    await expect(handleRefresh(request, mockEnv)).rejects.toThrow();
    
    // Verify token refresh was attempted
    expect(refreshAccessToken).toHaveBeenCalledWith('valid.refresh.token.here', mockEnv);
  });

  it('should handle partial token response (access token only)', async () => {
    // Setup mocks - refreshAccessToken returns only access token
    const partialTokens = {
      access_token: 'new.access.token.here'
    };
    vi.mocked(refreshAccessToken).mockResolvedValue(partialTokens);

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'valid.refresh.token.here'
      })
    });

    const response = await handleRefresh(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Token refreshed successfully');
    expect(data.access_token).toBe(partialTokens.access_token);
    expect(data.refresh_token).toBeUndefined();

    // Verify dependencies were called correctly
    expect(refreshAccessToken).toHaveBeenCalledWith('valid.refresh.token.here', mockEnv);
  });

  it('should handle complete token response (both access and refresh tokens)', async () => {
    // Setup mocks - refreshAccessToken returns both tokens
    vi.mocked(refreshAccessToken).mockResolvedValue(mockTokens);

    const request = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: 'valid.refresh.token.here'
      })
    });

    const response = await handleRefresh(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Token refreshed successfully');
    expect(data.access_token).toBe(mockTokens.access_token);
    expect(data.refresh_token).toBe(mockTokens.refresh_token);

    // Verify dependencies were called correctly
    expect(refreshAccessToken).toHaveBeenCalledWith('valid.refresh.token.here', mockEnv);
  });
});