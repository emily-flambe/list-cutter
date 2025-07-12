import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleRegister } from '../../../src/routes/accounts/register';
import type { Env, User } from '../../../src/types';
import { ApiError } from '../../../src/middleware/error';

// Define UserRegistration interface for tests (inferred from register handler usage)
interface UserRegistration {
  username: string;
  password: string;
  password2: string;
  email?: string;
}

// Mock dependencies
vi.mock('../../../src/services/storage/d1', () => ({
  createUser: vi.fn()
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

import { createUser } from '../../../src/services/storage/d1';
import { generateTokenPair } from '../../../src/services/auth/jwt';

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

const mockUser: User = {
  id: 1,
  username: 'newuser',
  email: 'newuser@example.com',
  created_at: '2024-01-01T00:00:00Z'
};

const mockTokens = {
  access_token: 'access.token.here',
  refresh_token: 'refresh.token.here'
};

describe('Register Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register successfully with valid data', async () => {
    // Setup mocks
    vi.mocked(createUser).mockResolvedValue(mockUser);
    vi.mocked(generateTokenPair).mockResolvedValue(mockTokens);

    const registrationData: UserRegistration = {
      username: 'newuser',
      password: 'validpassword123',
      password2: 'validpassword123',
      email: 'newuser@example.com'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    const response = await handleRegister(request, mockEnv);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.message).toBe('User created successfully');
    expect(data.user).toEqual({
      id: mockUser.id,
      username: mockUser.username,
      email: mockUser.email
    });
    expect(data.access_token).toBe(mockTokens.access_token);
    expect(data.refresh_token).toBe(mockTokens.refresh_token);

    // Verify dependencies were called correctly
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).toHaveBeenCalledWith(mockUser, mockEnv);
  });

  it('should register successfully without email', async () => {
    // Setup mocks
    vi.mocked(createUser).mockResolvedValue({ ...mockUser, email: undefined });
    vi.mocked(generateTokenPair).mockResolvedValue(mockTokens);

    const registrationData: UserRegistration = {
      username: 'newuser',
      password: 'validpassword123',
      password2: 'validpassword123'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    const response = await handleRegister(request, mockEnv);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.user.email).toBeUndefined();
    
    // Verify dependencies were called correctly
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).toHaveBeenCalledWith({ ...mockUser, email: undefined }, mockEnv);
  });

  it('should return 400 for missing username', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'validpassword123',
        password2: 'validpassword123'
      })
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for missing password', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        password2: 'validpassword123'
      })
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for missing password confirmation', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        password: 'validpassword123'
      })
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for empty username', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '',
        password: 'validpassword123',
        password2: 'validpassword123'
      })
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for empty password', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        password: '',
        password2: ''
      })
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for duplicate username', async () => {
    // Setup mocks - createUser throws an error for duplicate username
    vi.mocked(createUser).mockRejectedValue(new ApiError(400, 'Username already exists'));

    const registrationData: UserRegistration = {
      username: 'existinguser',
      password: 'validpassword123',
      password2: 'validpassword123'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify user creation was attempted
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should return 400 for duplicate email', async () => {
    // Setup mocks - createUser throws an error for duplicate email
    vi.mocked(createUser).mockRejectedValue(new ApiError(400, 'Email already exists'));

    const registrationData: UserRegistration = {
      username: 'newuser',
      password: 'validpassword123',
      password2: 'validpassword123',
      email: 'existing@example.com'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify user creation was attempted
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle password validation errors', async () => {
    // Setup mocks - createUser throws a password validation error
    vi.mocked(createUser).mockRejectedValue(new ApiError(400, 'Password must be at least 8 characters long'));

    const registrationData: UserRegistration = {
      username: 'newuser',
      password: 'short',
      password2: 'short'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify user creation was attempted
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON in request body', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow();
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    // Setup mocks - createUser throws a database error
    vi.mocked(createUser).mockRejectedValue(new Error('Database connection failed'));

    const registrationData: UserRegistration = {
      username: 'newuser',
      password: 'validpassword123',
      password2: 'validpassword123'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify user creation was attempted
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle JWT generation errors gracefully', async () => {
    // Setup mocks - createUser succeeds but generateTokenPair fails
    vi.mocked(createUser).mockResolvedValue(mockUser);
    vi.mocked(generateTokenPair).mockRejectedValue(new Error('JWT generation failed'));

    const registrationData: UserRegistration = {
      username: 'newuser',
      password: 'validpassword123',
      password2: 'validpassword123'
    };

    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify both functions were called
    expect(createUser).toHaveBeenCalledWith(mockEnv, registrationData);
    expect(generateTokenPair).toHaveBeenCalledWith(mockUser, mockEnv);
  });

  it('should handle all required fields missing', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });

  it('should handle partial field data', async () => {
    const request = new Request('http://localhost/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'newuser',
        email: 'test@example.com'
        // missing password and password2
      })
    });

    await expect(handleRegister(request, mockEnv)).rejects.toThrow(ApiError);
    
    // Verify no user creation attempt was made
    expect(createUser).not.toHaveBeenCalled();
    expect(generateTokenPair).not.toHaveBeenCalled();
  });
});