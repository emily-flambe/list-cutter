export interface CloudflareEnv {
  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_VERSION: string;
  CORS_ORIGIN: string;
  MAX_FILE_SIZE: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  
  // Security environment variables
  SECURITY_PERFORMANCE_THRESHOLD?: string;
  SECURITY_ALERT_WEBHOOK?: string;
  SECURITY_METRICS_RETENTION_DAYS?: string;
  SECURITY_ENABLE_REAL_TIME_MONITORING?: string;
  
  // Secrets (from .dev.vars or Wrangler secrets)
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  DB_ENCRYPTION_KEY: string;
  
  // Bindings
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  AUTH_TOKENS?: KVNamespace; // Optional - commented out in wrangler.toml
  ANALYTICS?: AnalyticsEngineDataset; // Optional - commented out in wrangler.toml
  
  // Backup and Recovery Bindings
  BACKUP_STORAGE: R2Bucket; // Cross-region backup storage
  BACKUP_STORAGE_SECONDARY?: R2Bucket; // Secondary backup storage for redundancy
  BACKUP_DATABASE?: D1Database; // Cross-region backup database (optional - not yet created)
  BACKUP_CONFIG?: KVNamespace; // Backup configuration and metadata (optional - not yet created)
  
  // Security-specific bindings
  CUTTY_SECURITY_CONFIG: KVNamespace;
  CUTTY_SECURITY_EVENTS: KVNamespace;
  CUTTY_SECURITY_METRICS: KVNamespace;
  CUTTY_QUOTA_TRACKING: KVNamespace;
  
  // Performance Optimization Bindings - Issue #69
  CACHE_KV?: KVNamespace; // Multi-layer caching for performance optimization (optional - not yet created)
  
  // Optional bindings
  RATE_LIMITER?: DurableObjectNamespace;
}