export interface Env {
  R2_BUCKET: R2Bucket;
  DB: D1Database;
  JWT_SECRET: string;
  MAX_FILE_SIZE: string;
  ENVIRONMENT: string;
}

export interface User {
  id: string;
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
  id: string;
  username: string;
  iat: number;
  exp: number;
}