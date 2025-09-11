// Main types export file for Cutty Authentication System
export * from './types/env';
export * from './types/permissions';
export * from './types/errors';
export * from './types/deployment';

// Core authentication types
export interface User {
  id: string;
  username: string;
  email?: string;
  created_at: string;
  password_hash?: string;
  is_active?: boolean;
  last_login?: string;
}

export interface UserJWTPayload {
  user_id: string;
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
  user_id: string;
  username: string;
  expires_at: number;
}

export interface BlacklistedToken {
  reason: string;
  blacklisted_at: number;
}

// Environment types with all required bindings
export interface Env {
  // Environment variables
  ENVIRONMENT: 'development' | 'production' | 'test';
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
  authMethod: 'jwt';
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
  authMethod?: 'jwt';
}

// Extend Hono context type
declare module 'hono' {
  interface ContextVariableMap extends HonoContext {}
}

// Synthetic Data Generation types
export interface SyntheticDataRequest {
  count: number; // 1-1000
  state?: string; // Optional single state filter (deprecated)
  states?: string[]; // Optional multiple state filters
}

export interface SyntheticVoterRecord {
  voter_id: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

export interface SyntheticDataResponse {
  success: boolean;
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    downloadUrl?: string;
  };
  metadata: {
    recordCount: number;
    generatedAt: string;
    state?: string;
    states?: string[];
  };
}

// Cuttytabs Analysis Types
export interface CrosstabRequest {
  rowVariable: string;
  columnVariable?: string;
  includePercentages?: boolean;
}

export interface CrosstabData {
  crosstab: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  columnTotals: Record<string, number>;
  grandTotal: number;
  rowVariable: string;
  columnVariable: string;
  // Phase 1: Percentage calculations
  rowPercentages: Record<string, Record<string, number>>;
  columnPercentages: Record<string, Record<string, number>>;
  totalPercentages: Record<string, Record<string, number>>;
}

export interface CrosstabResponse {
  success: boolean;
  data: CrosstabData;
  metadata: {
    processedRows: number;
    uniqueRowValues: number;
    uniqueColumnValues: number;
  };
}

export interface FieldsResponse {
  success: boolean;
  fields: string[];
  rowCount: number;
  fileInfo: {
    id: string;
    filename: string;
    size: number;
  };
}

export interface CrosstabExportRequest {
  rowVariable: string;
  columnVariable?: string;
  filename?: string;
}

export interface CrosstabExportResponse {
  success: boolean;
  downloadUrl: string;
  savedFile: {
    id: string;
    filename: string;
    size: number;
    createdAt: string;
  };
  message: string;
}

export interface ExportedCrosstabMetadata {
  source: 'analysis-crosstab';
  originalFileId: string;
  originalFilename: string;
  analysisType: 'crosstab';
  rowVariable: string;
  columnVariable: string;
  generatedAt: string;
  rowCount: number;
  columnCount: number;
}

// CUT Phase 1 Foundation Types
export interface ColumnMetadata {
  name: string;
  dataType: 'integer' | 'decimal' | 'date' | 'boolean' | 'categorical' | 'text';
  confidence: number;
  sampleValues: string[];
  uniqueValueCount: number;
  nullCount: number;
  totalSamples: number;
}

export interface ColumnsAnalysisResponse {
  success: boolean;
  columns: ColumnMetadata[];
  filterSuggestions: Record<string, string[]>;
  fileInfo: {
    id: string;
    filename: string;
    size: number;
    totalRows: number;
    totalColumns: number;
  };
  metadata: {
    rowsAnalyzed: number;
    processingTimeMs: number;
    performance: {
      database_query_ms: number;
      r2_retrieval_ms: number;
      file_read_ms: number;
      analysis_processing_ms: number;
      total_time_ms: number;
      throughput_mbps: number;
    };
  };
}

export interface FilterConfiguration {
  id: string;
  fileId: string;
  userId: string;
  columnName: string;
  dataType: string;
  filterType: string;
  filterValue: string; // JSON-encoded parameters
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// CUT Phase 2: Enhanced Filter Types
export enum FilterType {
  // Text filters
  CONTAINS = 'contains',
  EQUALS = 'equals', 
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX = 'regex',
  IN_LIST = 'in_list',
  NOT_EQUALS = 'not_equals',
  
  // Number filters
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  BETWEEN = 'between',
  NOT_NULL = 'not_null',
  IS_NULL = 'is_null',
  
  // Date filters
  DATE_RANGE = 'date_range',
  BEFORE = 'before',
  AFTER = 'after',
  LAST_N_DAYS = 'last_n_days',
  THIS_MONTH = 'this_month',
  THIS_YEAR = 'this_year',
  
  // Boolean filters
  IS_TRUE = 'is_true',
  IS_FALSE = 'is_false'
}

export interface FilterOperator {
  type: FilterType;
  columnName: string;
  value: any;
  negated?: boolean;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  filters: (FilterOperator | FilterGroup)[];
}

export interface QueryRequest {
  fileId: string;
  filters: FilterOperator[];
  logicalOperator?: 'AND' | 'OR';
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  success: boolean;
  data: {
    rows: Record<string, any>[];
    totalRows: number;
    filteredRows: number;
    columns: string[];
  };
  metadata: {
    processingTimeMs: number;
    filtersApplied: number;
    performance: {
      file_read_ms: number;
      filtering_ms: number;
      total_time_ms: number;
      throughput_mbps: number;
    };
  };
}

export interface FilterRequest {
  columnName: string;
  filterType: string;
  value: any; // Will be JSON encoded
}

export interface CutFilterRequest {
  fileId: string;
  filters: FilterRequest[];
}

export { CloudflareEnv } from './types/env';