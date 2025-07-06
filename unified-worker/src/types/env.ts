export interface CloudflareEnv {
  // Environment variables
  ENVIRONMENT: string;
  API_VERSION: string;
  CORS_ORIGIN: string;
  MAX_FILE_SIZE: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  LOG_LEVEL: string;
  SENTRY_ENVIRONMENT?: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  JWT_REFRESH_SECRET?: string;
  DB_ENCRYPTION_KEY?: string;
  SENTRY_DSN?: string;
  SENDGRID_API_KEY?: string;

  // Cloudflare bindings
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  AUTH_TOKENS: KVNamespace;
  ASSETS: Fetcher;
  
  // Optional bindings
  CSV_QUEUE?: Queue;
  ANALYTICS?: AnalyticsEngineDataset;
  RATE_LIMITER?: RateLimit;
}

export interface RequestContext {
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
}

export interface HonoEnv {
  Bindings: CloudflareEnv;
  Variables: {
    user?: AuthUser;
    requestId?: string;
  };
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FileRecord {
  id: number;
  userId: number;
  fileId: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  r2Key: string;
  uploadStatus: 'uploading' | 'completed' | 'error';
  processingError?: string;
  rowCount?: number;
  columnCount?: number;
  columnsMetadata?: string;
  tags?: string;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

export interface SavedFilter {
  id: number;
  userId: number;
  fileId: string;
  name: string;
  description?: string;
  filterConfig: string;
  resultCount?: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  timestamp: string;
  checks: {
    database: {
      healthy: boolean;
      latency: number;
    };
    storage: {
      healthy: boolean;
      latency: number;
    };
    memory: {
      healthy: boolean;
      usage: number;
    };
    responseTime: {
      healthy: boolean;
      avgTime: number;
    };
  };
}