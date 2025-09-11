/**
 * Authentication and JWT related types
 */

// User type definition
export interface User {
  id: string;
  username: string;
  email?: string;
  password_hash?: string;
  google_id?: string;
  role?: 'admin' | 'user'; // Role-based access control
  created_at: string;
  updated_at?: string;
  is_active?: boolean;
  last_login?: string;
}

// JWT payload structure
export interface UserJWTPayload {
  user_id: string;
  username: string;
  email?: string;
  role?: 'admin' | 'user'; // Include role in JWT payload
  token_type: 'access' | 'refresh';
  exp: number;
  iat: number;
  jti: string;
}

// Token pair returned from authentication
export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

// Refresh token data stored in KV
export interface RefreshTokenData {
  user_id: string;
  username: string;
  expires_at: number;
}

// Blacklisted token data
export interface BlacklistedToken {
  reason: string;
  blacklisted_at: number;
}

// User registration data
export interface UserRegistration {
  username: string;
  email?: string;
  password: string;
  password2: string; // confirmation password
}