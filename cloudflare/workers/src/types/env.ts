export interface CloudflareEnv {
  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_VERSION: string;
  CORS_ORIGIN: string;
  MAX_FILE_SIZE: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  
  // Secrets (from .dev.vars or Wrangler secrets)
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  DB_ENCRYPTION_KEY: string;
  
  // Bindings
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  AUTH_TOKENS: KVNamespace;
  CSV_QUEUE: Queue;
  ANALYTICS: AnalyticsEngineDataset;
  
  // Optional bindings
  RATE_LIMITER?: DurableObjectNamespace;
}