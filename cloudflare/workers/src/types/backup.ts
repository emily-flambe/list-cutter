// Backup and Disaster Recovery Type Definitions
export interface BackupResult {
  backupId: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'completed' | 'failed' | 'in_progress';
  duration: number;
  size: number;
  itemCount: number;
  metadata: BackupMetadata;
  verification: VerificationResult;
  error?: string;
}

export interface BackupMetadata {
  timestamp: string;
  version: string;
  environment: string;
  createdBy: string;
  retention: RetentionPolicy;
  encryption: EncryptionMetadata;
  compression: CompressionMetadata;
}

export interface RetentionPolicy {
  dailyRetentionDays: number;
  weeklyRetentionWeeks: number;
  monthlyRetentionMonths: number;
  yearlyRetentionYears: number;
}

export interface EncryptionMetadata {
  algorithm: string;
  keyVersion: string;
  encrypted: boolean;
}

export interface CompressionMetadata {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface DatabaseBackupResult {
  backupKey: string;
  size: number;
  itemCount: number;
  checksum: string;
  tables: BackupTableInfo[];
}

export interface BackupTableInfo {
  name: string;
  rowCount: number;
  size: number;
  checksum: string;
}

export interface FileBackupResult {
  manifestKey: string;
  fileCount: number;
  totalSize: number;
  copiedFiles: BackupFileInfo[];
}

export interface BackupFileInfo {
  originalKey: string;
  backupKey: string;
  size: number;
  checksum: string;
  lastModified: string;
}

export interface ConfigBackupResult {
  configKey: string;
  size: number;
  checksum: string;
  settings: ConfigurationSettings;
}

export interface ConfigurationSettings {
  environment: Record<string, string>;
  bindings: Record<string, unknown>;
  secrets: string[]; // Just the keys, not values
  crons: CronConfiguration[];
}

export interface CronConfiguration {
  schedule: string;
  route: string;
  enabled: boolean;
}

export interface BackupManifest {
  backupId: string;
  timestamp: string;
  type: 'full' | 'incremental' | 'differential';
  database: DatabaseBackupResult;
  files: FileBackupResult;
  config: ConfigBackupResult;
  metadata: BackupMetadata;
}

export interface VerificationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    database: ComponentVerification | null;
    files: ComponentVerification | null;
    config: ComponentVerification | null;
  };
}

export interface ComponentVerification {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

// Disaster Recovery Types
export interface DisasterScenario {
  type: 'database_corruption' | 'file_storage_failure' | 'complete_system_failure' | 'partial_outage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedServices: string[];
  estimatedDowntime: number;
  description: string;
}

export interface DisasterAssessment {
  type: DisasterScenario['type'];
  severity: DisasterScenario['severity'];
  affectedServices: string[];
  dataIntegrity: DataIntegrityStatus;
  recoveryRequirements: RecoveryRequirements;
}

export interface DataIntegrityStatus {
  database: IntegrityCheck;
  files: IntegrityCheck;
  config: IntegrityCheck;
}

export interface IntegrityCheck {
  status: 'healthy' | 'degraded' | 'corrupted' | 'unavailable';
  lastVerified: string;
  issues: string[];
}

export interface RecoveryRequirements {
  rto: number; // Recovery Time Objective in milliseconds
  rpo: number; // Recovery Point Objective in milliseconds
  dataRecoveryNeeded: boolean;
  serviceRecoveryNeeded: boolean;
  configRecoveryNeeded: boolean;
}

export interface RecoveryStrategy {
  type: 'database_restore' | 'file_restore' | 'full_system_restore' | 'partial_restore';
  steps: string[];
  estimatedTime: number;
  prerequisites: string[];
}

export interface RecoveryResult {
  recoveryId: string;
  scenario: DisasterScenario;
  strategy: RecoveryStrategy;
  duration: number;
  status: 'completed' | 'failed' | 'in_progress';
  verification: RecoveryVerification;
  metadata: RecoveryMetadata;
  error?: string;
}

export interface RecoveryVerification {
  isSuccessful: boolean;
  systemHealth: SystemHealthStatus;
  functionalTests: FunctionalTestResult[];
  dataIntegrity: DataIntegrityStatus;
}

export interface SystemHealthStatus {
  database: ServiceHealthStatus;
  fileStorage: ServiceHealthStatus;
  api: ServiceHealthStatus;
  monitoring: ServiceHealthStatus;
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unavailable';
  responseTime: number;
  errorRate: number;
  lastChecked: string;
}

export interface FunctionalTestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export interface RecoveryMetadata {
  dataRecovered: number;
  servicesRestored: string[];
  degradedServices: string[];
  rollbackRequired: boolean;
}

export interface RecoveryExecution {
  strategy: RecoveryStrategy;
  steps: RecoveryStepResult[];
  dataRecovered: number;
  servicesRestored: string[];
  degradedServices: string[];
}

export interface RecoveryStepResult {
  step: string;
  success: boolean;
  duration: number;
  dataRecovered?: number;
  servicesRestored?: string[];
  error?: string;
}

// Data Export Types
export interface ExportResult {
  exportId: string;
  userId: string;
  duration: number;
  size: number;
  recordCount: number;
  fileCount: number;
  downloadUrl: string;
  expiresAt: Date;
  format: ExportFormat;
}

export interface SystemExportResult {
  exportId: string;
  timestamp: string;
  formats: ExportFormatResult[];
  totalSize: number;
  metadata: SystemExportMetadata;
}

export interface ExportFormatResult {
  format: ExportFormat;
  size: number;
  downloadUrl: string;
  checksum: string;
}

export interface SystemExportMetadata {
  databaseTables: number;
  totalRecords: number;
  fileCount: number;
  configurationItems: number;
}

export interface ExportFormat {
  type: 'json' | 'csv' | 'sql' | 'xml' | 'parquet';
  compression: 'none' | 'gzip' | 'brotli' | 'zstd';
  encrypted: boolean;
}

export interface FileExportInfo {
  filename: string;
  r2_key: string;
  size: number;
  mime_type: string;
  created_at: string;
  content: ArrayBuffer;
  checksum: string;
}

export interface UserExportData {
  userId: string;
  timestamp: string;
  data: UserDatabaseRecords;
  files: FileExportInfo[];
  metadata: UserExportMetadata;
}

export interface UserDatabaseRecords {
  tables: {
    [tableName: string]: Record<string, unknown>[];
  };
}

export interface UserExportMetadata {
  totalRecords: number;
  totalFiles: number;
  totalSize: number;
  exportReason: string;
  requestedBy: string;
}

// Business Continuity Types
export interface BusinessContinuityPlan {
  rto: number; // Recovery Time Objective in milliseconds
  rpo: number; // Recovery Point Objective in milliseconds
  criticalSystems: CriticalSystem[];
  disasterScenarios: DisasterScenarioDefinition[];
  recoveryProcedures: Record<string, RecoveryProcedure>;
}

export interface CriticalSystem {
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  recoveryProcedure: string;
  rto: number;
  rpo: number;
}

export interface DisasterScenarioDefinition {
  name: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  responseTime: string;
  recoveryProcedure: string;
}

export interface RecoveryProcedure {
  steps: string[];
  estimatedTime: string;
  prerequisites: string[];
  contacts: EmergencyContact[];
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  email: string;
  availability: string;
}

// Degraded Mode Types
export interface DegradedModeConfig {
  enabledFeatures: string[];
  disabledFeatures: string[];
  readOnlyMode: boolean;
  performanceThresholds: PerformanceThresholds;
  alertThresholds: AlertThresholds;
}

export interface PerformanceThresholds {
  maxResponseTime: number;
  maxErrorRate: number;
  maxConcurrentRequests: number;
}

export interface AlertThresholds {
  responseTimeWarning: number;
  errorRateWarning: number;
  storageUsageWarning: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  details: ServiceHealthStatus[];
  timestamp: string;
  overallScore: number;
}

// Testing Types
export interface TestResult {
  testId: string;
  timestamp: string;
  results: TestComponentResult[];
  overallStatus: 'passed' | 'failed' | 'pending';
  error?: string;
}

export interface TestComponentResult {
  component: string;
  passed: boolean;
  duration: number;
  details: string;
  error?: string;
}

// Compression and Encryption Services
export interface CompressionService {
  compress(data: unknown): Promise<Uint8Array>;
  decompress(data: Uint8Array): Promise<unknown>;
  calculateCompressionRatio(original: number, compressed: number): number;
}

export interface EncryptionService {
  encrypt(data: Uint8Array): Promise<Uint8Array>;
  decrypt(data: Uint8Array): Promise<Uint8Array>;
  generateKey(): Promise<string>;
  rotateKey(oldKey: string): Promise<string>;
}

// Monitoring Integration
export interface BackupMonitoringMetrics {
  backupDuration: number;
  backupSize: number;
  backupSuccess: boolean;
  verificationSuccess: boolean;
  compressionRatio: number;
  encryptionTime: number;
}

export interface RecoveryMonitoringMetrics {
  recoveryDuration: number;
  dataRecovered: number;
  servicesRestored: number;
  rtoAchieved: boolean;
  rpoAchieved: boolean;
  testsPassed: number;
  testsFailed: number;
}