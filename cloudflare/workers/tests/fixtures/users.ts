/**
 * User Test Fixtures
 * 
 * Predefined user data for consistent testing.
 */

import type { User } from '../../src/types';

export const testUsers: Record<string, User> = {
  validUser: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  
  adminUser: {
    id: 2,
    username: 'admin',
    email: 'admin@example.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  
  premiumUser: {
    id: 3,
    username: 'premium',
    email: 'premium@example.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  
  inactiveUser: {
    id: 4,
    username: 'inactive',
    email: 'inactive@example.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  
  newUser: {
    id: 5,
    username: 'newuser',
    email: 'new@example.com',
    created_at: new Date().toISOString(),
  },
};

export const userCredentials = {
  validUser: {
    username: 'testuser',
    password: 'ValidPassword123!',
    email: 'test@example.com',
  },
  
  adminUser: {
    username: 'admin',
    password: 'AdminPassword123!',
    email: 'admin@example.com',
  },
  
  premiumUser: {
    username: 'premium',
    password: 'PremiumPassword123!',
    email: 'premium@example.com',
  },
};

export const registrationData = {
  valid: {
    username: 'newuser',
    email: 'new@example.com',
    password: 'NewPassword123!',
    confirmPassword: 'NewPassword123!',
  },
  
  invalidEmail: {
    username: 'user',
    email: 'invalid-email',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  },
  
  shortUsername: {
    username: 'ab',
    email: 'short@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  },
  
  weakPassword: {
    username: 'weakuser',
    email: 'weak@example.com',
    password: 'weak',
    confirmPassword: 'weak',
  },
  
  passwordMismatch: {
    username: 'mismatch',
    email: 'mismatch@example.com',
    password: 'Password123!',
    confirmPassword: 'DifferentPassword123!',
  },
  
  duplicateUsername: {
    username: 'testuser', // Already exists
    email: 'duplicate@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  },
  
  duplicateEmail: {
    username: 'duplicate',
    email: 'test@example.com', // Already exists
    password: 'Password123!',
    confirmPassword: 'Password123!',
  },
};

export const loginData = {
  valid: {
    username: 'testuser',
    password: 'ValidPassword123!',
  },
  
  invalidUsername: {
    username: 'nonexistent',
    password: 'ValidPassword123!',
  },
  
  invalidPassword: {
    username: 'testuser',
    password: 'WrongPassword123!',
  },
  
  missingUsername: {
    password: 'ValidPassword123!',
  },
  
  missingPassword: {
    username: 'testuser',
  },
  
  emptyCredentials: {},
  
  sqlInjection: {
    username: "'; DROP TABLE users; --",
    password: 'password',
  },
  
  xssAttempt: {
    username: '<script>alert("xss")</script>',
    password: 'password',
  },
};