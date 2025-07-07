/**
 * Security Event Types and Audit Trail Definitions
 * Comprehensive types for security logging and monitoring
 */

/**
 * Classification of security events by severity and type
 */
export enum SecurityEventType {
  // Access Control Events
  AUTHENTICATION_SUCCESS = 'auth.success',
  AUTHENTICATION_FAILURE = 'auth.failure',
  AUTHORIZATION_DENIED = 'auth.denied',
  SESSION_CREATED = 'auth.session_created',
  SESSION_EXPIRED = 'auth.session_expired',
  SESSION_TERMINATED = 'auth.session_terminated',
  
  // File Access Events
  FILE_UPLOADED = 'file.uploaded',
  FILE_DOWNLOADED = 'file.downloaded',
  FILE_DELETED = 'file.deleted',
  FILE_ACCESS_DENIED = 'file.access_denied',
  FILE_VALIDATION_FAILED = 'file.validation_failed',
  FILE_QUARANTINED = 'file.quarantined',
  
  // Security Violations
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
  MALICIOUS_FILE_DETECTED = 'security.malicious_file_detected',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  BRUTE_FORCE_DETECTED = 'security.brute_force_detected',
  
  // System Events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  CONFIGURATION_CHANGED = 'system.config_changed',
  
  // Compliance Events
  DATA_EXPORT_REQUESTED = 'compliance.data_export_requested',
  DATA_DELETION_REQUESTED = 'compliance.data_deletion_requested',
  PRIVACY_POLICY_ACCEPTED = 'compliance.privacy_policy_accepted',
  CONSENT_WITHDRAWN = 'compliance.consent_withdrawn',
  
  // Administrative Events
  ADMIN_LOGIN = 'admin.login',
  ADMIN_ACTION = 'admin.action',
  USER_CREATED = 'admin.user_created',
  USER_DELETED = 'admin.user_deleted',
  USER_ROLE_CHANGED = 'admin.user_role_changed',
  
  // Monitoring Events
  PERFORMANCE_THRESHOLD_EXCEEDED = 'monitoring.performance_threshold_exceeded',
  STORAGE_QUOTA_EXCEEDED = 'monitoring.storage_quota_exceeded',
  ANOMALY_DETECTED = 'monitoring.anomaly_detected'
}

/**
 * Security event severity levels
 */
export enum SecurityEventSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Security event categories for filtering and reporting
 */
export enum SecurityEventCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  FILE_ACCESS = 'file_access',
  SECURITY_VIOLATION = 'security_violation',
  SYSTEM = 'system',
  COMPLIANCE = 'compliance',
  ADMINISTRATION = 'administration',
  MONITORING = 'monitoring'
}

/**
 * Risk assessment levels for security events
 */
export enum RiskLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Incident response actions
 */
export enum IncidentResponseAction {
  NONE = 'none',
  LOG_ONLY = 'log_only',
  ALERT = 'alert',
  BLOCK_USER = 'block_user',
  QUARANTINE_FILE = 'quarantine_file',
  FORCE_LOGOUT = 'force_logout',
  LOCK_ACCOUNT = 'lock_account',
  ESCALATE = 'escalate',
  NOTIFY_ADMIN = 'notify_admin'
}

/**
 * Compliance framework types
 */
export enum ComplianceFramework {
  GDPR = 'gdpr',
  SOC2 = 'soc2',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  ISO27001 = 'iso27001'
}

/**
 * Core security event interface
 */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  category: SecurityEventCategory;
  riskLevel: RiskLevel;
  
  // Event metadata
  timestamp: Date;
  correlationId?: string;
  sessionId?: string;
  traceId?: string;
  
  // Actor information
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Resource information
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  
  // Event details
  message: string;
  details?: Record<string, unknown>;
  
  // Context information
  requestId?: string;
  operationId?: string;
  source: string;
  sourceVersion?: string;
  
  // Compliance tracking
  complianceFrameworks?: ComplianceFramework[];
  retentionPeriod?: number; // in days
  
  // Incident response
  requiresResponse: boolean;
  responseActions?: IncidentResponseAction[];
  responseStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  // Enrichment data
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  
  deviceFingerprint?: string;
  threatIntelligence?: {
    isKnownThreat: boolean;
    threatScore: number;
    threatCategories: string[];
  };
}

/**
 * Authentication event specific data
 */
export interface AuthenticationEvent extends SecurityEvent {
  type: SecurityEventType.AUTHENTICATION_SUCCESS | SecurityEventType.AUTHENTICATION_FAILURE;
  authMethod: 'password' | 'token' | 'oauth' | 'api_key';
  failureReason?: string;
  loginAttempts?: number;
  accountLocked?: boolean;
}

/**
 * File access event specific data
 */
export interface FileAccessEvent extends SecurityEvent {
  type: SecurityEventType.FILE_UPLOADED | SecurityEventType.FILE_DOWNLOADED | SecurityEventType.FILE_DELETED;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum?: string;
  storageLocation: string;
  accessPattern?: 'normal' | 'bulk' | 'suspicious';
  bytesTransferred?: number;
  transferDuration?: number;
  compressionUsed?: boolean;
  encryptionUsed?: boolean;
}

/**
 * Security violation event specific data
 */
export interface SecurityViolationEvent extends SecurityEvent {
  type: SecurityEventType.RATE_LIMIT_EXCEEDED | SecurityEventType.MALICIOUS_FILE_DETECTED | SecurityEventType.SUSPICIOUS_ACTIVITY;
  violationType: string;
  threshold?: number;
  actualValue?: number;
  blockingAction?: string;
  automaticResponse?: boolean;
  falsePositiveRisk?: 'low' | 'medium' | 'high';
}

/**
 * Compliance event specific data
 */
export interface ComplianceEvent extends SecurityEvent {
  type: SecurityEventType.DATA_EXPORT_REQUESTED | SecurityEventType.DATA_DELETION_REQUESTED | SecurityEventType.PRIVACY_POLICY_ACCEPTED;
  complianceType: ComplianceFramework;
  dataCategories: string[];
  requestMethod: 'user_portal' | 'email' | 'api' | 'admin';
  processingStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  completionDeadline?: Date;
  verificationRequired?: boolean;
}

/**
 * System event specific data
 */
export interface SystemEvent extends SecurityEvent {
  type: SecurityEventType.SYSTEM_ERROR | SecurityEventType.SYSTEM_MAINTENANCE | SecurityEventType.CONFIGURATION_CHANGED;
  component: string;
  version?: string;
  errorCode?: string;
  stackTrace?: string;
  performanceMetrics?: {
    duration: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Audit trail entry for compliance reporting
 */
export interface AuditTrailEntry {
  id: string;
  eventId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  outcome: 'success' | 'failure' | 'partial';
  complianceFrameworks: ComplianceFramework[];
  retentionPeriod: number;
  checksum: string; // For integrity verification
}

/**
 * Security metrics aggregation
 */
export interface SecurityMetrics {
  timeframe: {
    start: Date;
    end: Date;
  };
  eventCounts: Record<SecurityEventType, number>;
  severityCounts: Record<SecurityEventSeverity, number>;
  categoryCounts: Record<SecurityEventCategory, number>;
  riskLevelCounts: Record<RiskLevel, number>;
  
  // Specific metrics
  authenticationMetrics: {
    successCount: number;
    failureCount: number;
    failureRate: number;
    uniqueUsers: number;
    suspiciousLogins: number;
  };
  
  fileAccessMetrics: {
    uploadsCount: number;
    downloadsCount: number;
    deletionsCount: number;
    totalBytesTransferred: number;
    maliciousFilesBlocked: number;
    averageFileSize: number;
  };
  
  securityViolationMetrics: {
    rateLimitViolations: number;
    maliciousFileDetections: number;
    suspiciousActivityCount: number;
    blockedRequests: number;
    falsePositiveRate: number;
  };
  
  complianceMetrics: {
    dataExportRequests: number;
    dataDeletionRequests: number;
    averageResponseTime: number;
    complianceViolations: number;
  };
  
  performanceMetrics: {
    averageResponseTime: number;
    slowQueriesCount: number;
    errorRate: number;
    availabilityPercentage: number;
  };
}

/**
 * Security alert configuration
 */
export interface SecurityAlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Trigger conditions
  eventTypes: SecurityEventType[];
  severityThreshold: SecurityEventSeverity;
  conditions: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
    value: string | number | boolean;
  }[];
  
  // Time-based conditions
  timeWindow?: number; // in minutes
  eventCountThreshold?: number;
  
  // Response actions
  actions: IncidentResponseAction[];
  escalationRules?: {
    delay: number; // in minutes
    escalateTo: string;
    condition: string;
  }[];
  
  // Notification settings
  notificationChannels: string[];
  suppressionRules?: {
    duration: number; // in minutes
    conditions: string[];
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;
}

/**
 * Security incident record
 */
export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: SecurityEventSeverity;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  
  // Incident details
  eventIds: string[];
  affectedUsers: string[];
  affectedResources: string[];
  rootCause?: string;
  impactAssessment?: string;
  
  // Timeline
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  
  // Response
  assignedTo?: string;
  responseTeam?: string[];
  actionsTaken: string[];
  preventiveMeasures?: string[];
  
  // Compliance
  reportingRequired: boolean;
  reportedToAuthorities?: Date;
  complianceFrameworks: ComplianceFramework[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  externalTicketId?: string;
}

/**
 * Security dashboard widget configuration
 */
export interface SecurityDashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert' | 'map';
  title: string;
  description?: string;
  
  // Data configuration
  dataSource: 'security_events' | 'audit_trail' | 'metrics' | 'incidents';
  query: {
    filters: Record<string, unknown>;
    aggregation?: string;
    timeRange: {
      start: Date;
      end: Date;
    };
  };
  
  // Display configuration
  refreshInterval: number; // in seconds
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  displayOptions: Record<string, unknown>;
  
  // Position and size
  position: { x: number; y: number };
  size: { width: number; height: number };
  
  // Permissions
  visibleToRoles: string[];
  createdBy: string;
  createdAt: Date;
}

/**
 * Event processing pipeline configuration
 */
export interface EventProcessingPipeline {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Processing stages
  stages: {
    id: string;
    name: string;
    type: 'filter' | 'transform' | 'enrich' | 'validate' | 'route';
    configuration: Record<string, unknown>;
    order: number;
  }[];
  
  // Input/output
  inputSources: string[];
  outputDestinations: string[];
  
  // Error handling
  errorHandling: {
    retryCount: number;
    retryDelay: number;
    deadLetterQueue: string;
  };
  
  // Monitoring
  metricsEnabled: boolean;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Export all event types as a union type
 */
export type SecurityEventUnion = 
  | AuthenticationEvent
  | FileAccessEvent
  | SecurityViolationEvent
  | ComplianceEvent
  | SystemEvent
  | SecurityEvent;

/**
 * Security event factory function type
 */
export type SecurityEventFactory<T extends SecurityEvent = SecurityEvent> = (
  baseEvent: Omit<T, 'id' | 'timestamp'>,
  context?: Record<string, unknown>
) => T;

/**
 * Security event handler function type
 */
export type SecurityEventHandler<T extends SecurityEvent = SecurityEvent> = (
  event: T,
  context?: Record<string, unknown>
) => Promise<void>;

/**
 * Security event filter function type
 */
export type SecurityEventFilter<T extends SecurityEvent = SecurityEvent> = (
  event: T
) => boolean;

/**
 * Security event transformer function type
 */
export type SecurityEventTransformer<T extends SecurityEvent = SecurityEvent> = (
  event: T
) => T | Promise<T>;