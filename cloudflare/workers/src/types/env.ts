export interface CloudflareEnv {
  // Environment variables
  ENVIRONMENT: 'development' | 'production';
  API_VERSION: string;
  CORS_ORIGIN: string;
  MAX_FILE_SIZE: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  FRONTEND_URL?: string;
  
  
  // Security environment variables
  SECURITY_PERFORMANCE_THRESHOLD?: string;
  SECURITY_ALERT_WEBHOOK?: string;
  SECURITY_METRICS_RETENTION_DAYS?: string;
  SECURITY_ENABLE_REAL_TIME_MONITORING?: string;
  
  // Secrets (from .dev.vars or Wrangler secrets)
  JWT_SECRET: string;
  JWT_REFRESH_SECRET?: string;
  DB_ENCRYPTION_KEY?: string;
  API_KEY_SALT?: string;
  
  // Google OAuth secrets
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  
  // AutoRAG configuration
  AUTORAG_INSTANCE_NAME?: string;
  AUTORAG_API_KEY?: string;
  AUTORAG_TIMEOUT_MS?: string;
  AUTORAG_MAX_SOURCES?: string;
  AUTORAG_MIN_CONFIDENCE?: string;
  AUTORAG_RATE_LIMIT?: string;
  AUTORAG_BURST_LIMIT?: string;
  
  // Bindings
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  ASSETS: Fetcher; // Static assets for frontend serving
  AUTH_KV?: KVNamespace; // Optional KV for auth tokens
  AUTH_TOKENS?: KVNamespace; // Optional - commented out in wrangler.toml
  ANALYTICS?: AnalyticsEngineDataset; // Optional - commented out in wrangler.toml
  
  // Backup and Recovery Bindings
  BACKUP_STORAGE?: R2Bucket; // Cross-region backup storage (optional - not yet created)
  BACKUP_STORAGE_SECONDARY?: R2Bucket; // Secondary backup storage for redundancy
  BACKUP_DATABASE?: D1Database; // Cross-region backup database (optional - not yet created)
  BACKUP_CONFIG?: KVNamespace; // Backup configuration and metadata (optional - not yet created)
  
  // Security-specific bindings
  CUTTY_SECURITY_CONFIG: KVNamespace;
  CUTTY_SECURITY_EVENTS: KVNamespace;
  CUTTY_SECURITY_METRICS: KVNamespace;
  CUTTY_QUOTA_TRACKING: KVNamespace;
  
  // Temporary file tracking for R2 eventual consistency
  TEMP_FILE_KEYS?: KVNamespace;
  
  // Performance Optimization Bindings - Issue #69
  CACHE_KV?: KVNamespace; // Multi-layer caching for performance optimization (optional - not yet created)
  
  // Deployment Bindings - Phase 8
  DEPLOYMENT_KV?: KVNamespace; // Blue-green deployment state and configuration (optional - not yet created)
  
  // Optional bindings
  RATE_LIMITER?: DurableObjectNamespace;
  
}

// Alias for backwards compatibility and cleaner imports
export type Env = CloudflareEnv;