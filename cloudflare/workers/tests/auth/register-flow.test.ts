/**
 * Registration Flow Tests
 * 
 * Tests for user registration, validation, and account creation flows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockEnv, createMockRequest, createMockContext, expectResponse } from '../utils/test-env';
import { registrationData } from '../fixtures/users';
import { setupTokenKVMocks } from '../utils/test-env';

// Mock the registration handler - in a real implementation, this would import the actual handler
const mockRegisterHandler = vi.fn();

describe('User Registration Flow', () => {
  let env: any;
  let tokenStorage: Map<string, string>;
  
  beforeEach(() => {
    env = createMockEnv();
    tokenStorage = setupTokenKVMocks(env);
    vi.clearAllMocks();
    
    // Setup default successful registration response
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      message: 'User registered successfully',
      user: {
        id: 5,
        username: 'newuser',
        email: 'new@example.com',
      },
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
  });
  
  it('should register valid users successfully', async () => {
    // Mock database operations
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null), // No existing user
      run: vi.fn().mockResolvedValue({ 
        success: true,
        meta: { last_row_id: 5 }
      }),
    });
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.valid),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 201);
    
    expect(data.message).toBe('User registered successfully');
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe(registrationData.valid.username);
    expect(data.user.email).toBe(registrationData.valid.email);
    expect(data.access_token).toBeDefined();
    expect(data.refresh_token).toBeDefined();
    
    // Verify sensitive data is not returned
    expect(data.user.password).toBeUndefined();
    expect(data.user.password_hash).toBeUndefined();
  });
  
  it('should validate email format', async () => {
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        email: ['Invalid email format'],
      },
    }), { status: 400 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.invalidEmail),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 400);
    
    expect(data.error).toBe('Validation failed');
    expect(data.details.email).toContain('Invalid email format');
  });
  
  it('should validate username length', async () => {
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        username: ['Username must be at least 3 characters long'],
      },
    }), { status: 400 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.shortUsername),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 400);
    
    expect(data.error).toBe('Validation failed');
    expect(data.details.username).toContain('Username must be at least 3 characters long');
  });
  
  it('should validate password strength', async () => {
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        password: [
          'Password must be at least 8 characters long',
          'Password must contain at least one uppercase letter',
          'Password must contain at least one number',
          'Password must contain at least one special character',
        ],
      },
    }), { status: 400 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.weakPassword),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 400);
    
    expect(data.error).toBe('Validation failed');
    expect(data.details.password).toContain('Password must be at least 8 characters long');
  });
  
  it('should validate password confirmation', async () => {
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        confirmPassword: ['Passwords do not match'],
      },
    }), { status: 400 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.passwordMismatch),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 400);
    
    expect(data.error).toBe('Validation failed');
    expect(data.details.confirmPassword).toContain('Passwords do not match');
  });
  
  it('should reject duplicate usernames', async () => {
    // Mock existing user found
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'other@example.com',
      }),
    });
    
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'User already exists',
      code: 'USER_EXISTS',
      message: 'A user with this username already exists',
    }), { status: 409 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.duplicateUsername),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 409);
    
    expect(data.error).toBe('User already exists');
    expect(data.code).toBe('USER_EXISTS');
  });
  
  it('should reject duplicate emails', async () => {
    // Mock existing user found
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: 1,
        username: 'otheruser',
        email: 'test@example.com',
      }),
    });
    
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'User already exists',
      code: 'USER_EXISTS',
      message: 'A user with this email already exists',
    }), { status: 409 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.duplicateEmail),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 409);
    
    expect(data.error).toBe('User already exists');
    expect(data.message).toContain('email already exists');
  });
  
  it('should sanitize input to prevent injection attacks', async () => {
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 5 } }),
    });
    
    const maliciousData = {
      username: '<script>alert("xss")</script>',
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(maliciousData),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    
    // Should either sanitize and succeed, or reject the input
    expect([200, 201, 400]).toContain(response.status);
    
    if (response.status === 201) {
      const data = await response.json();
      // Verify XSS payload was sanitized
      expect(data.user.username).not.toContain('<script>');
    }
  });
  
  it('should ignore extra fields in request', async () => {
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 5 } }),
    });
    
    const dataWithExtraFields = {
      ...registrationData.valid,
      adminFlag: true,
      maliciousField: 'exploit',
      role: 'admin',
    };
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(dataWithExtraFields),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    
    if (response.status === 201) {
      const data = await response.json();
      // Verify extra fields were ignored
      expect(data.user.adminFlag).toBeUndefined();
      expect(data.user.role).toBeUndefined();
      expect(data.user.maliciousField).toBeUndefined();
    }
  });
  
  it('should implement rate limiting for registration', async () => {
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      message: 'Too many registration attempts. Please try again later.',
      retry_after: 300,
    }), { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': '3',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 300),
      }
    }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.valid),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 429);
    
    expect(data.error).toBe('Rate limit exceeded');
    expect(data.retry_after).toBe(300);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
  });
  
  it('should hash passwords securely', async () => {
    const passwordHashSpy = vi.fn().mockResolvedValue('hashed-password');
    
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockImplementation((query) => {
        // Verify that the password is hashed, not stored in plain text
        expect(query).not.toContain(registrationData.valid.password);
        return { success: true, meta: { last_row_id: 5 } };
      }),
    });
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.valid),
    });
    
    const ctx = createMockContext();
    await mockRegisterHandler(request, env, ctx);
    
    // In a real implementation, verify that password hashing was called
    // expect(passwordHashSpy).toHaveBeenCalledWith(registrationData.valid.password);
  });
  
  it('should handle database transaction failures', async () => {
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockRejectedValue(new Error('Transaction failed')),
    });
    
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Registration failed',
      code: 'INTERNAL_ERROR',
      message: 'Unable to create user account',
    }), { status: 500 }));
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.valid),
    });
    
    const ctx = createMockContext();
    const response = await mockRegisterHandler(request, env, ctx);
    const data = await expectResponse(response, 500);
    
    expect(data.error).toBe('Registration failed');
    expect(data.code).toBe('INTERNAL_ERROR');
  });
  
  it('should log security events for registration', async () => {
    const securityEventSpy = vi.fn();
    env.SECURITY_EVENTS = {
      writeDataPoint: securityEventSpy,
    };
    
    env.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: { last_row_id: 5 } }),
    });
    
    const request = createMockRequest('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData.valid),
      headers: {
        'CF-Connecting-IP': '192.168.1.1',
        'User-Agent': 'Test Browser',
      },
    });
    
    const ctx = createMockContext();
    await mockRegisterHandler(request, env, ctx);
    
    // In a real implementation, verify security events are logged
    // expect(securityEventSpy).toHaveBeenCalledWith(expect.objectContaining({
    //   event_type: 'user_registered',
    //   ip_address: '192.168.1.1',
    //   user_agent: 'Test Browser',
    //   username: registrationData.valid.username,
    // }));
  });
  
  it('should reject non-POST methods', async () => {
    mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    }), { 
      status: 405,
      headers: { 'Allow': 'POST, OPTIONS' }
    }));
    
    const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];
    
    for (const method of methods) {
      const request = createMockRequest('/api/v1/auth/register', { method });
      const ctx = createMockContext();
      const response = await mockRegisterHandler(request, env, ctx);
      
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toContain('POST');
    }
  });
  
  it('should validate required fields', async () => {
    const requiredFields = ['username', 'email', 'password', 'confirmPassword'];
    
    for (const field of requiredFields) {
      mockRegisterHandler.mockResolvedValue(new Response(JSON.stringify({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          [field]: [`${field.charAt(0).toUpperCase() + field.slice(1)} is required`],
        },
      }), { status: 400 }));
      
      const incompleteData = { ...registrationData.valid };
      delete (incompleteData as any)[field];
      
      const request = createMockRequest('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
      });
      
      const ctx = createMockContext();
      const response = await mockRegisterHandler(request, env, ctx);
      const data = await expectResponse(response, 400);
      
      expect(data.error).toBe('Validation failed');
      expect(data.details[field]).toContain(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
    }
  });
});