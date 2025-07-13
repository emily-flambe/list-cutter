import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleLogin } from '../../../src/routes/accounts/login';
import type { User } from '../../../src/types';
import { createMockEnv } from '../../fixtures/env';

// Mock dependencies
vi.mock('../../../src/services/storage/d1', () => ({
  authenticateUser: vi.fn()
}));

vi.mock('../../../src/services/auth/jwt', () => ({
  generateTokenPair: vi.fn()
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

import { authenticateUser } from '../../../src/services/storage/d1';
import { generateTokenPair } from '../../../src/services/auth/jwt';

// Mock environment
const mockEnv = createMockEnv();

const mockUser: User = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z'
};

const mockTokens = {
  access_token: 'access.token.here',
  refresh_token: 'refresh.token.here'
};

describe('Login Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should login successfully with valid credentials', async () => {
    // Setup mocks
    vi.mocked(authenticateUser).mockResolvedValue(mockUser);
    vi.mocked(generateTokenPair).mockResolvedValue(mockTokens);

    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'validpassword'
      })
    });

    const response = await handleLogin(request, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Login successful');
    expect(data.user).toEqual({
      id: mockUser.id,
      username: mockUser.username,
      email: mockUser.email
    });
    expect(data.access_token).toBe(mockTokens.access_token);
    expect(data.refresh_token).toBe(mockTokens.refresh_token);

    // Verify dependencies were called correctly
    expect(authenticateUser).toHaveBeenCalledWith(mockEnv, 'testuser', 'validpassword');
    expect(generateTokenPair).toHaveBeenCalledWith(mockUser, mockEnv);
  });

  it('should return 401 for invalid credentials', async () => {
    // Setup mocks - authenticateUser returns null for invalid credentials
    vi.mocked(authenticateUser).mockResolvedValue(null);

    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'wrongpassword'
      })
    });

    await expect(handleLogin(request, mockEnv)).rejects.toThrow();
    
    // Verify authenticateUser was called
    expect(authenticateUser).toHaveBeenCalledWith(mockEnv, 'testuser', 'wrongpassword');
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for missing username', async () => {
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'validpassword'
      })
    });

    await expect(handleLogin(request, mockEnv)).rejects.toThrow();
    
    // Verify no authentication attempt was made
    expect(authenticateUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for missing password', async () => {
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser'
      })
    });

    await expect(handleLogin(request, mockEnv)).rejects.toThrow();
    
    // Verify no authentication attempt was made
    expect(authenticateUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for empty credentials', async () => {
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '',
        password: ''
      })
    });

    await expect(handleLogin(request, mockEnv)).rejects.toThrow();
    
    // Verify no authentication attempt was made
    expect(authenticateUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });

    await expect(handleLogin(request, mockEnv)).rejects.toThrow();
    
    // Verify no authentication attempt was made
    expect(authenticateUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    // Setup mocks - authenticateUser throws an error
    vi.mocked(authenticateUser).mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'validpassword'
      })
    });

    await expect(handleLogin(request, mockEnv)).rejects.toThrow();
    
    // Verify authentication was attempted
    expect(authenticateUser).toHaveBeenCalledWith(mockEnv, 'testuser', 'validpassword');
    expect(generateTokenPair).not.toHaveBeenCalled();
  });
});