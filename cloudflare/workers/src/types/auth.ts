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

// API Key type
export interface APIKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  expires_at?: number;
  created_at: string;
  last_used_at?: string;
}

// API Key creation request
export interface APIKeyCreateRequest {
  name: string;
  permissions: string[];
  expires_in_days?: number;
  rate_limit_override?: number;
}

// Authentication context attached to requests
export interface AuthContext {
  user: User;
  authMethod: 'jwt' | 'api_key';
  apiKey?: APIKey;
  permissions?: string[];
}

// API Key authentication context (used by apiKeyAuth middleware)
export interface APIKeyAuthContext {
  api_key: APIKey;
  user_id: string;
  permissions: string[];
}

// Security event logging
export interface SecurityEvent {
  timestamp: number;
  event_type: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

// User registration data
export interface UserRegistration {
  username: string;
  email?: string;
  password: string;
  password2: string; // confirmation password
}