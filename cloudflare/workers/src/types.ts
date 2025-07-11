// Main types export file for Cutty Authentication System
export * from './types/env';
export * from './types/permissions';
export * from './types/errors';
export * from './types/deployment';

// Core authentication types
export interface User {
  id: number;
  username: string;
  email?: string;
  created_at: string;
  password_hash?: string;
  is_active?: boolean;
  last_login?: string;
}

export interface UserJWTPayload {
  user_id: number;
  username: string;
  email?: string;
  token_type: 'access' | 'refresh';
  exp: number;
  iat: number;
  jti: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface RefreshTokenData {
  user_id: number;
  username: string;
  expires_at: number;
}

export interface BlacklistedToken {
  reason: string;
  blacklisted_at: number;
}

// API Key types
export interface APIKey {
  key_id: string;
  user_id: number;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string[];
  created_at: number;
  last_used: number | null;
  expires_at: number | null;
  is_active: boolean;
  rate_limit_override: number | null;
}

export interface APIKeyCreateRequest {
  name: string;
  permissions: string[];
  expires_in_days?: number;
  rate_limit_override?: number;
}

// Environment types with all required bindings
export interface Env {
  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production' | 'test';
  API_VERSION: string;
  CORS_ORIGIN?: string;
  MAX_FILE_SIZE?: string;
  JWT_ISSUER?: string;
  JWT_AUDIENCE?: string;
  
  // Security environment variables
  SECURITY_PERFORMANCE_THRESHOLD?: string;
  SECURITY_ALERT_WEBHOOK?: string;
  SECURITY_METRICS_RETENTION_DAYS?: string;
  SECURITY_ENABLE_REAL_TIME_MONITORING?: string;
  
  // Secrets (from .dev.vars or Wrangler secrets)
  JWT_SECRET: string;
  JWT_REFRESH_SECRET?: string;
  API_KEY_SALT?: string;
  DB_ENCRYPTION_KEY?: string;
  
  // Required bindings
  DB: D1Database;
  FILE_STORAGE?: R2Bucket;
  AUTH_KV?: KVNamespace;
  ANALYTICS?: AnalyticsEngineDataset;
  
  // Security-specific bindings
  CUTTY_SECURITY_CONFIG?: KVNamespace;
  CUTTY_SECURITY_EVENTS?: KVNamespace;
  CUTTY_SECURITY_METRICS?: KVNamespace;
  CUTTY_QUOTA_TRACKING?: KVNamespace;
  
  // Optional bindings
  BACKUP_STORAGE?: R2Bucket;
  BACKUP_DATABASE?: D1Database;
  CACHE_KV?: KVNamespace;
  RATE_LIMITER?: DurableObjectNamespace;
}

// Authentication context types
export interface AuthContext {
  user: User;
  authMethod: 'jwt' | 'api_key';
  apiKey?: APIKey;
  permissions?: string[];
}

// Security event types
export interface SecurityEvent {
  timestamp: number;
  event_type: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

// User registration input type
export interface UserRegistration {
  username: string;
  password: string;
  password2: string;
  email?: string;
}

// Request context types for Hono
export interface HonoContext {
  user?: User;
  authMethod?: 'jwt' | 'api_key';
  apiKey?: APIKey;
  permissions?: string[];
}

// Extend Hono context type
declare module 'hono' {
  interface ContextVariableMap extends HonoContext {}
}

export { CloudflareEnv } from './types/env';
export { APIPermission, PERMISSION_DESCRIPTIONS, PERMISSION_PRESETS } from './types/permissions';