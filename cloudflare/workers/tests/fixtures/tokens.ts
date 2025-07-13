/**
 * Token Test Fixtures
 * 
 * Predefined JWT tokens and payloads for testing authentication flows.
 */

import type { UserJWTPayload, TokenPair, RefreshTokenData, BlacklistedToken } from '../../src/types';

export const tokenPayloads: Record<string, Partial<UserJWTPayload>> = {
  validAccess: {
    user_id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access',
  },
  
  validRefresh: {
    user_id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'refresh',
  },
  
  adminAccess: {
    user_id: 'test-user-2',
    username: 'admin',
    email: 'admin@example.com',
    token_type: 'access',
  },
  
  expiredAccess: {
    user_id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access',
    exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
  },
  
  futureAccess: {
    user_id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
  },
  
  invalidType: {
    user_id: 'test-user-1',
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'invalid' as any,
  },
  
  missingUserId: {
    username: 'testuser',
    email: 'test@example.com',
    token_type: 'access',
  } as any,
  
  missingUsername: {
    user_id: 'test-user-1',
    email: 'test@example.com',
    token_type: 'access',
  } as any,
};

export const malformedTokens = [
  '',
  'invalid.token',
  'invalid.token.format.too.many.parts',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Only header
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ', // Missing signature
  'not.a.jwt.at.all',
  'Bearer token', // Invalid format
  'Bearer ', // Empty token
];

export const tokenPairs: Record<string, TokenPair> = {
  valid: {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
  },
  
  expiredAccess: {
    access_token: 'mock-expired-access-token',
    refresh_token: 'mock-valid-refresh-token',
  },
  
  expiredBoth: {
    access_token: 'mock-expired-access-token',
    refresh_token: 'mock-expired-refresh-token',
  },
};

export const refreshTokenData: Record<string, RefreshTokenData> = {
  valid: {
    user_id: 'test-user-1',
    username: 'testuser',
    expires_at: Date.now() + 86400000, // 24 hours from now
  },
  
  expired: {
    user_id: 'test-user-1',
    username: 'testuser',
    expires_at: Date.now() - 3600000, // 1 hour ago
  },
  
  differentUser: {
    user_id: 'test-user-999',
    username: 'otheruser',
    expires_at: Date.now() + 86400000,
  },
};

export const blacklistedTokens: Record<string, BlacklistedToken> = {
  userLogout: {
    reason: 'user_logout',
    blacklisted_at: Date.now() - 3600000, // 1 hour ago
  },
  
  tokenRotated: {
    reason: 'token_rotated',
    blacklisted_at: Date.now() - 1800000, // 30 minutes ago
  },
  
  securityIncident: {
    reason: 'security_incident',
    blacklisted_at: Date.now() - 7200000, // 2 hours ago
  },
  
  suspiciousActivity: {
    reason: 'suspicious_activity',
    blacklisted_at: Date.now() - 1800000,
  },
  
  compromised: {
    reason: 'token_compromised',
    blacklisted_at: Date.now() - 3600000,
  },
};

export const authorizationHeaders = {
  validBearer: 'Bearer valid-token-here',
  invalidBearer: 'Bearer invalid-token',
  malformedBearer: 'Bearertoken', // No space
  wrongScheme: 'Basic dXNlcjpwYXNz', // Base64 encoded "user:pass"
  empty: '',
  justBearer: 'Bearer',
  doubleBearer: 'Bearer Bearer token',
  withExtraSpaces: '  Bearer   token-with-spaces  ',
};

export const jwtSecrets = {
  valid: 'test-secret-at-least-32-characters-long-for-security',
  short: 'short', // Too short for security
  empty: '',
  different: 'different-secret-32-characters-long-for-security',
  unicode: 'test-secret-with-unicode-字符-32-chars-long',
  special: 'test-secret!@#$%^&*()_+-={}[]|:";\'<>?,./32chars',
};

export const tokenTimings = {
  accessTokenExpiry: '10m',
  refreshTokenExpiry: '1d',
  shortExpiry: '1s',
  longExpiry: '30d',
  invalidExpiry: 'invalid',
  negativeExpiry: '-1h',
  zeroExpiry: '0s',
};