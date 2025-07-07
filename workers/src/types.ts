export interface Env {
  R2_BUCKET: R2Bucket;
  R2_BACKUP_BUCKET: R2Bucket;
  DB: D1Database;
  AUTH_KV: KVNamespace;
  RATE_LIMITER: any; // Rate limiting binding (beta)
  JWT_SECRET: string;
  MAX_FILE_SIZE: string;
  ENVIRONMENT: string;
  
  // Backup Configuration
  BACKUP_RETENTION_DAYS: string;
  BACKUP_SCHEDULE: string;
  BACKUP_INCREMENTAL_ENABLED: string;
  BACKUP_COMPRESSION_ENABLED: string;
  BACKUP_ENCRYPTION_ENABLED: string;
}

export interface User {
  id: number;
  username: string;
  email?: string;
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
  user_id: number;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  system_tags: string[];
  user_tags: string[];
  metadata?: Record<string, unknown>;
}

export interface SavedFileCreate {
  user_id: number;
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

// Data Export Types
export type DataExportFormat = 'json' | 'csv' | 'xml';
export type DataExportType = 'user_data' | 'bulk_data' | 'system_data';
export type DataExportScope = 'user' | 'admin' | 'system';
export type DataExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export interface DataExportMetadata {
  id: string;
  userId?: number;
  exportType: DataExportType;
  format: DataExportFormat;
  scope: DataExportScope;
  status: DataExportStatus;
  filePath: string;
  fileName: string;
  fileSize: number;
  recordCount: number;
  compressionRatio?: number;
  checksum: string;
  parameters: string; // JSON string of export parameters
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  errorMessage?: string;
  downloadCount: number;
  lastDownloadedAt?: string;
}

export interface DataExportRequest {
  id: string;
  userId: number;
  requestType: DataExportType;
  format: DataExportFormat;
  scope: DataExportScope;
  parameters: string; // JSON string
  status: DataExportStatus;
  priority: number;
  scheduledAt?: string;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface DataExportLog {
  id: number;
  exportId: string;
  timestamp: string;
  eventType: 'start' | 'progress' | 'complete' | 'error' | 'download' | 'expire';
  message: string;
  level: 'info' | 'warn' | 'error';
  details?: string; // JSON string
}

export interface DataExportOptions {
  includeMetadata?: boolean;
  includeSystemFields?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, any>;
  fieldSelection?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  compression?: boolean;
  encryption?: boolean;
}

export interface DataExportConfig {
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  maxExportSize: number;
  retentionDays: number;
  allowedFormats: DataExportFormat[];
}

export interface UserDataExportResult {
  files: Array<{
    fileId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: string;
    systemTags: string[];
    userTags: string[];
    metadata?: Record<string, any>;
  }>;
  userData: {
    userId: number;
    username: string;
    email?: string;
    createdAt: string;
    fileCount: number;
    totalStorageUsed: number;
    lastLoginAt?: string;
  };
  exportMetadata: {
    exportId: string;
    exportDate: string;
    exportType: DataExportType;
    format: DataExportFormat;
    totalRecords: number;
    checksum: string;
  };
}

export interface BulkDataExportResult {
  users: Array<{
    userId: number;
    username: string;
    email?: string;
    createdAt: string;
    fileCount: number;
    totalStorageUsed: number;
    lastLoginAt?: string;
  }>;
  files: Array<{
    fileId: string;
    userId: number;
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: string;
    systemTags: string[];
    userTags: string[];
    metadata?: Record<string, any>;
  }>;
  statistics: {
    totalUsers: number;
    totalFiles: number;
    totalStorageUsed: number;
    exportDate: string;
    exportId: string;
    checksum: string;
  };
}

export interface DataExportVerificationResult {
  success: boolean;
  checksumMatch: boolean;
  fileExists: boolean;
  fileSizeMatch: boolean;
  recordCountMatch: boolean;
  formatValid: boolean;
  errorDetails?: string[];
}

export interface ExportPermission {
  id: number;
  userId: number;
  exportType: DataExportType;
  scope: DataExportScope;
  canCreate: boolean;
  canDownload: boolean;
  canViewLogs: boolean;
  canManage: boolean;
  grantedBy?: number;
  grantedAt: string;
  expiresAt?: string;
}

export interface ExportTemplate {
  id: number;
  name: string;
  description?: string;
  exportType: DataExportType;
  format: DataExportFormat;
  scope: DataExportScope;
  parameters: string; // JSON string
  isActive: boolean;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportSchedule {
  id: number;
  name: string;
  description?: string;
  userId: number;
  exportType: DataExportType;
  format: DataExportFormat;
  scope: DataExportScope;
  parameters: string; // JSON string
  schedulePattern: string; // Cron-like pattern or 'daily', 'weekly', 'monthly'
  nextRunTime?: string;
  lastRunTime?: string;
  lastExportId?: string;
  status: 'active' | 'paused' | 'disabled' | 'error';
  failureCount: number;
  maxFailures: number;
  lastError?: string;
  retentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportAnalytics {
  id: number;
  date: string; // YYYY-MM-DD format
  exportType: DataExportType;
  format: DataExportFormat;
  scope: DataExportScope;
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  totalSizeBytes: number;
  totalRecords: number;
  averageProcessingTimeMs: number;
  totalDownloads: number;
  uniqueUsers: number;
}

export interface ExportStats {
  totalExports: number;
  completedExports: number;
  failedExports: number;
  totalSize: number;
  averageSize: number;
  lastExportDate?: string;
  successRate: number;
  healthMetrics?: any[];
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

// Monitoring Types
export interface MonitoringConfig {
  healthCheckInterval: number;
  circuitBreakerEnabled: boolean;
  alertingEnabled: boolean;
  slowResponseThreshold: number;
  failureThreshold: number;
  recoveryTimeout: number;
}

export interface HealthCheckResult {
  id?: number;
  timestamp: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  errorMessage?: string;
  operationType: 'get' | 'put' | 'delete' | 'list' | 'head';
  bucketName: string;
  testFileKey?: string;
  successCount: number;
  failureCount: number;
  metadata?: Record<string, unknown>;
}

export interface CircuitBreakerStatus {
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttempt?: number;
  isHealthy: boolean;
  failureRate: number;
  successRate: number;
  averageResponseTime: number;
  totalCalls: number;
  timeUntilNextAttempt?: number;
}

export interface ServiceAlert {
  id?: number;
  timestamp: string;
  alertType: 'circuit_breaker_open' | 'high_error_rate' | 'slow_response' | 'service_degraded' | 'service_recovered';
  severity: 'low' | 'medium' | 'high' | 'critical';
  serviceName: string;
  message: string;
  details?: Record<string, unknown>;
  resolvedAt?: string;
  resolutionNotes?: string;
  notificationSent: boolean;
  createdBy: string;
}

export interface R2HealthStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  circuitBreakerState: 'closed' | 'open' | 'half_open';
  metrics: {
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    averageResponseTime: number;
    errorRate: number;
    slowCheckRate: number;
    uptimePercentage: number;
    lastCheckTime: string;
    lastSuccessTime?: string;
    lastFailureTime?: string;
  };
  isMonitoring: boolean;
  activeAlerts: ServiceAlert[];
}

// Failover and disaster recovery types
export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type OperationType = 'UPLOAD' | 'DELETE' | 'GET' | 'METADATA_UPDATE';
export type OperationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type NotificationType = 'SERVICE_DEGRADED' | 'OPERATION_QUEUED' | 'OPERATION_COMPLETED' | 'OPERATION_FAILED';
export type EventSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type EventCategory = 'FAILOVER' | 'HEALTH' | 'SECURITY' | 'PERFORMANCE';

export interface OperationQueueItem {
  id: number;
  operation_type: OperationType;
  operation_id: string;
  payload: string; // JSON string
  priority: number;
  user_id?: number;
  file_id?: string;
  created_at: string;
  retry_count: number;
  max_retries: number;
  status: OperationStatus;
  error_message?: string;
  scheduled_at?: string;
  completed_at?: string;
}

export interface OperationPayload {
  fileName?: string;
  content?: string; // Base64 encoded
  contentType?: string;
  metadata?: Record<string, unknown>;
  originalRequest?: Record<string, unknown>;
}

export interface ServiceStatusRecord {
  id: number;
  service_name: string;
  status: ServiceStatus;
  last_check: string;
  last_success?: string;
  last_failure?: string;
  failure_count: number;
  degradation_reason?: string;
  recovery_actions?: string; // JSON array
  circuit_breaker_state: CircuitBreakerState;
  circuit_breaker_opened_at?: string;
  health_metrics?: string; // JSON object
}

export interface UserNotification {
  id: number;
  user_id: number;
  notification_type: NotificationType;
  message: string;
  severity: EventSeverity;
  read_status: number;
  metadata?: string; // JSON object
  created_at: string;
  delivered_at?: string;
  acknowledged_at?: string;
}

export interface SystemEvent {
  id: number;
  event_type: string;
  event_category: EventCategory;
  service_name?: string;
  user_id?: number;
  event_data: string; // JSON object
  severity: EventSeverity;
  created_at: string;
}

export interface FailoverConfig {
  id: number;
  service_name: string;
  config_key: string;
  config_value: string;
  config_type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  description?: string;
  updated_at: string;
  updated_by?: number;
}

export interface HealthMetrics {
  response_time_ms: number;
  error_rate: number;
  success_rate: number;
  last_error?: string;
  consecutive_failures: number;
  last_health_check: string;
}

export interface DegradationOptions {
  enableReadOnlyMode?: boolean;
  queueOperations?: boolean;
  notifyUsers?: boolean;
  enableCircuitBreaker?: boolean;
  maxQueueSize?: number;
  retryDelayMs?: number;
}

export interface FailoverResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  degraded: boolean;
  queued: boolean;
  retryAfter?: number;
}

export interface R2OperationOptions {
  skipFailover?: boolean;
  priority?: number;
  maxRetries?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}