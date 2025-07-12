/**
 * Blue-Green deployment types for Cloudflare Workers infrastructure
 */

export type DeploymentEnvironment = 'blue' | 'green';

export type DeploymentStatus = 'pending' | 'deploying' | 'deployed' | 'active' | 'failed' | 'rollback';

export type DeploymentType = 'initial' | 'update' | 'rollback' | 'hotfix';

export interface DeploymentVersion {
  id: string;
  version: string;
  environment: DeploymentEnvironment;
  status: DeploymentStatus;
  deploymentType: DeploymentType;
  commitHash?: string;
  deployedAt: string;
  deployedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface DeploymentHealthCheck {
  endpoint: string;
  expectedStatus: number;
  timeout: number;
  retries: number;
}

export interface DeploymentValidation {
  healthChecks: DeploymentHealthCheck[];
  smokeTests: SmokeTest[];
  performanceThresholds: PerformanceThresholds;
}

export interface SmokeTest {
  name: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  validator?: (response: Response) => boolean;
}

export interface PerformanceThresholds {
  maxResponseTime: number; // milliseconds
  maxErrorRate: number; // percentage
  minSuccessRate: number; // percentage
}

export interface DeploymentResult {
  success: boolean;
  version: string;
  environment: DeploymentEnvironment;
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
  errors?: string[];
  warnings?: string[];
  rollbackPerformed?: boolean;
}

export interface CutoverResult {
  success: boolean;
  fromEnvironment: DeploymentEnvironment;
  toEnvironment: DeploymentEnvironment;
  cutoverTime: string;
  validationResults: ValidationResult[];
  rollbackTrigger?: string;
}

export interface ValidationResult {
  name: string;
  type: 'health_check' | 'smoke_test' | 'performance_test';
  success: boolean;
  duration: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface MonitoringResult {
  healthy: boolean;
  errorRate: number;
  avgResponseTime: number;
  successfulChecks: number;
  totalChecks: number;
  startTime: string;
  endTime: string;
  issues?: MonitoringIssue[];
}

export interface MonitoringIssue {
  type: 'error_rate' | 'response_time' | 'availability' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface DeploymentConfiguration {
  // Validation settings
  enableValidation: boolean;
  validationTimeout: number;
  monitoringDuration: number;
  
  // Rollback settings
  enableAutoRollback: boolean;
  rollbackThresholds: {
    maxErrorRate: number;
    maxResponseTime: number;
    minSuccessRate: number;
  };
  
  // DNS settings
  dnsConfig: {
    domain: string;
    recordType: string;
    ttl: number;
  };
  
  // Custom health checks
  customHealthChecks: DeploymentHealthCheck[];
  customSmokeTests: SmokeTest[];
}

export interface BlueGreenState {
  currentActive: DeploymentEnvironment;
  currentInactive: DeploymentEnvironment;
  lastCutover: string;
  deploymentHistory: DeploymentVersion[];
  isDeploymentInProgress: boolean;
  isCutoverInProgress: boolean;
}

export interface DeploymentMetrics {
  deploymentsTotal: number;
  deploymentsSuccessful: number;
  deploymentsFailed: number;
  averageDeploymentTime: number;
  cutoversTotal: number;
  cutoversSuccessful: number;
  rollbacksTotal: number;
  averageCutoverTime: number;
  successRate: number;
}

export interface DeploymentRequest {
  version: string;
  deploymentType: DeploymentType;
  commitHash?: string;
  metadata?: Record<string, unknown>;
  skipValidation?: boolean;
  customValidation?: DeploymentValidation;
}

export interface CutoverRequest {
  targetVersion: string;
  skipValidation?: boolean;
  monitoringDuration?: number;
  customValidation?: DeploymentValidation;
}

export interface RollbackRequest {
  reason: string;
  targetVersion?: string;
  emergencyRollback?: boolean;
}

export interface DeploymentHistory {
  deployments: DeploymentVersion[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
}

export interface DeploymentStatusResponse {
  currentState: BlueGreenState;
  activeVersion: DeploymentVersion;
  inactiveVersion?: DeploymentVersion;
  metrics: DeploymentMetrics;
  ongoingOperations: OngoingOperation[];
}

export interface OngoingOperation {
  id: string;
  type: 'deployment' | 'cutover' | 'rollback' | 'validation';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string;
  estimatedCompletion?: string;
  progress?: number; // percentage
  currentStep?: string;
}

export interface DeploymentLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  operation: string;
  environment?: DeploymentEnvironment;
  metadata?: Record<string, unknown>;
}

export interface DeploymentAlert {
  id: string;
  type: 'deployment_failed' | 'cutover_failed' | 'validation_failed' | 'performance_degraded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  environment: DeploymentEnvironment;
  triggeredAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MigrationResult {
  usersMigrated: number;
  filesMigrated: number;
  filtersMigrated: number;
  success: boolean;
  errors: string[];
  startTime: string;
  endTime: string;
  duration: number;
}

export interface MaintenanceMode {
  enabled: boolean;
  enabledAt?: string;
  enabledBy?: string;
  reason?: string;
  estimatedDuration?: number;
  customMessage?: string;
}

export interface ValidationContext {
  environment: DeploymentEnvironment;
  version: string;
  baseUrl: string;
  userAgent: string;
  timeout: number;
  retries: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  concurrentUsers?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface CutoverMonitoringConfig {
  duration: number; // milliseconds
  checkInterval: number; // milliseconds
  thresholds: {
    maxErrorRate: number;
    maxResponseTime: number;
    minSuccessRate: number;
  };
  endpoints: string[];
  alerting: {
    enabled: boolean;
    channels: string[];
  };
}

export interface DNSUpdateResult {
  success: boolean;
  recordsUpdated: DNSRecord[];
  errors?: string[];
  propagationTime?: number;
}

export interface DNSRecord {
  name: string;
  type: string;
  value: string;
  ttl: number;
  updatedAt: string;
}