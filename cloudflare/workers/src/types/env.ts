export interface CloudflareEnv {
  // Environment variables
  ENVIRONMENT: 'development' | 'production';
  API_VERSION: string;
  CORS_ORIGIN: string;
  MAX_FILE_SIZE: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  FRONTEND_URL?: string;
  
  // AI Worker Integration
  AI_WORKER_URL: string;
  AI_WORKER_API_KEY: string;
  
  // Anthropic API Key for AI Agent (Cutty uses Claude)
  ANTHROPIC_API_KEY: string;
  
  // Agent Integration
  AGENT_ENABLED?: string;
  AGENT_URL?: string;
  
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
  
  // Bindings
  DB: D1Database;
  FILE_STORAGE: R2Bucket;
  ASSETS: Fetcher; // Static assets for frontend serving
  AUTH_KV?: KVNamespace; // Optional KV for auth tokens
  AUTH_TOKENS?: KVNamespace; // Optional - commented out in wrangler.toml
  ANALYTICS?: AnalyticsEngineDataset; // Optional - commented out in wrangler.toml
  
  // Security-specific bindings
  CUTTY_SECURITY_CONFIG: KVNamespace;
  CUTTY_SECURITY_EVENTS: KVNamespace;
  CUTTY_SECURITY_METRICS: KVNamespace;
  CUTTY_QUOTA_TRACKING: KVNamespace;
  
  // Temporary file tracking for R2 eventual consistency
  TEMP_FILE_KEYS?: KVNamespace;
  
  // Optional bindings
  RATE_LIMITER?: DurableObjectNamespace;
  
  // AI Agent Durable Object
  CUTTY_AGENT: DurableObjectNamespace;
}

// Alias for backwards compatibility and cleaner imports
export type Env = CloudflareEnv;