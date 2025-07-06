export interface Env {
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  AUTH_KV: KVNamespace;
  RATE_LIMITER: any; // Rate limiting binding (beta)
  JWT_SECRET: string;
  MAX_FILE_SIZE: string;
  ENVIRONMENT: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface UserRegistration {
  username: string;
  email?: string;
  password: string;
  password2: string;
}

export interface SavedFile {
  file_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  system_tags: string[];
  user_tags: string[];
  metadata?: Record<string, unknown>;
}

export interface SavedFileCreate {
  user_id: string;
  file_name: string;
  file_path: string;
  system_tags: string[];
  metadata?: Record<string, unknown>;
}

export interface UploadResponse {
  columns?: string[];
  file_path: string;
  file_id?: string;
  file_name?: string;
}

export interface ExportRequest {
  columns: string[];
  file_path: string;
  filters?: Record<string, string>;
}

export interface FileLineage {
  nodes: Array<{
    file_id: string;
    file_name: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export interface UserJWTPayload {
  user_id: number;
  username: string;
  email?: string;
  iat: number;
  exp: number;
  jti: string;  // JWT ID for token tracking
  token_type: 'access' | 'refresh';
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