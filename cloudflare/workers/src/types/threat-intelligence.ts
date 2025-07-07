/**
 * Threat Intelligence Types
 * Comprehensive type definitions for advanced threat detection system
 */

// Core threat detection types
export interface ThreatSignature {
  id: string;
  name: string;
  type: ThreatType;
  pattern: string; // Regex pattern or binary signature
  description: string;
  severity: ThreatSeverity;
  confidence: number; // 0-100
  lastUpdated: Date;
  source: string; // Intelligence source
}

export enum ThreatType {
  MALWARE = 'malware',
  VIRUS = 'virus',
  TROJAN = 'trojan',
  RANSOMWARE = 'ransomware',
  SPYWARE = 'spyware',
  ADWARE = 'adware',
  ROOTKIT = 'rootkit',
  WORM = 'worm',
  BACKDOOR = 'backdoor',
  PHISHING = 'phishing',
  SUSPICIOUS_SCRIPT = 'suspicious_script',
  OBFUSCATED_CODE = 'obfuscated_code',
  EMBEDDED_EXECUTABLE = 'embedded_executable',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  PII_EXPOSURE = 'pii_exposure',
  CREDENTIAL_EXPOSURE = 'credential_exposure',
  UNKNOWN = 'unknown'
}

export enum ThreatSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface ThreatDetectionResult {
  fileId: string;
  fileName: string;
  threats: DetectedThreat[];
  riskScore: number; // 0-100
  overallRisk: ThreatSeverity;
  scanDuration: number; // milliseconds
  scanTimestamp: Date;
  scanEngine: string;
  engineVersion: string;
  recommendation: ThreatRecommendation;
}

export interface DetectedThreat {
  id: string;
  signature: ThreatSignature;
  location: ThreatLocation;
  confidence: number;
  context: string; // Surrounding content or metadata
  mitigationSuggestion: string;
}

export interface ThreatLocation {
  offset: number;
  length: number;
  lineNumber?: number;
  columnNumber?: number;
  section?: string; // e.g., 'header', 'body', 'metadata'
}

export enum ThreatRecommendation {
  BLOCK = 'block',
  QUARANTINE = 'quarantine',
  SANITIZE = 'sanitize',
  WARN = 'warn',
  ALLOW = 'allow',
  MANUAL_REVIEW = 'manual_review'
}

// PII Detection Types
export interface PIIDetectionResult {
  fileId: string;
  fileName: string;
  piiFindings: PIIFinding[];
  classificationLevel: DataClassification;
  recommendedHandling: DataHandling;
  scanTimestamp: Date;
  complianceFlags: ComplianceFlag[];
}

export interface PIIFinding {
  id: string;
  type: PIIType;
  value: string; // Masked or redacted value
  confidence: number; // 0-100
  location: ThreatLocation;
  severity: PIISeverity;
  pattern: string; // Pattern that matched
  context: string;
}

export enum PIIType {
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  PHONE_NUMBER = 'phone_number',
  EMAIL = 'email',
  IP_ADDRESS = 'ip_address',
  DRIVERS_LICENSE = 'drivers_license',
  PASSPORT = 'passport',
  DATE_OF_BIRTH = 'date_of_birth',
  BANK_ACCOUNT = 'bank_account',
  MEDICAL_RECORD = 'medical_record',
  BIOMETRIC = 'biometric',
  GOVERNMENT_ID = 'government_id',
  TAX_ID = 'tax_id',
  CUSTOM = 'custom'
}

export enum PIISeverity {
  CRITICAL = 'critical', // SSN, Credit Card, etc.
  HIGH = 'high',         // Driver's License, Passport
  MEDIUM = 'medium',     // Phone, Email with context
  LOW = 'low'            // Generic patterns
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

export enum DataHandling {
  ALLOW = 'allow',
  ENCRYPT = 'encrypt',
  REDACT = 'redact',
  REJECT = 'reject',
  SECURE_STORAGE = 'secure_storage'
}

export interface ComplianceFlag {
  regulation: ComplianceRegulation;
  requirement: string;
  violated: boolean;
  severity: ThreatSeverity;
  remediation: string;
}

export enum ComplianceRegulation {
  GDPR = 'gdpr',
  CCPA = 'ccpa',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  SOX = 'sox',
  GLBA = 'glba',
  FERPA = 'ferpa',
  COPPA = 'coppa'
}

// Threat Intelligence Database Types
export interface ThreatIntelligenceDatabase {
  signatures: ThreatSignature[];
  piiPatterns: PIIPattern[];
  malwareHashes: MalwareHash[];
  suspiciousIPs: SuspiciousIP[];
  lastUpdated: Date;
  version: string;
  source: string;
}

export interface PIIPattern {
  id: string;
  type: PIIType;
  pattern: string; // Regex pattern
  description: string;
  severity: PIISeverity;
  locale?: string; // US, EU, etc.
  validation?: string; // Additional validation logic
  examples: string[];
  falsePositives: string[];
}

export interface MalwareHash {
  hash: string;
  hashType: 'md5' | 'sha1' | 'sha256' | 'sha512';
  malwareFamily: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  firstSeen: Date;
  lastSeen: Date;
  source: string;
  description: string;
}

export interface SuspiciousIP {
  ip: string;
  threatType: ThreatType;
  severity: ThreatSeverity;
  firstSeen: Date;
  lastSeen: Date;
  source: string;
  description: string;
  confidence: number;
}

// Automated Response Types
export interface ThreatResponse {
  threatId: string;
  action: ThreatAction;
  timestamp: Date;
  automated: boolean;
  userId?: string;
  reason: string;
  details: ThreatResponseDetails;
}

export enum ThreatAction {
  BLOCK = 'block',
  QUARANTINE = 'quarantine',
  DELETE = 'delete',
  SANITIZE = 'sanitize',
  NOTIFY = 'notify',
  LOG = 'log',
  ESCALATE = 'escalate'
}

export interface ThreatResponseDetails {
  originalFile: {
    name: string;
    size: number;
    hash: string;
    location: string;
  };
  processedFile?: {
    name: string;
    size: number;
    hash: string;
    location: string;
    modifications: string[];
  };
  notifications: NotificationRecord[];
  quarantineInfo?: QuarantineInfo;
}

export interface NotificationRecord {
  recipient: string;
  method: 'email' | 'sms' | 'webhook' | 'dashboard';
  timestamp: Date;
  status: 'sent' | 'failed' | 'pending';
  message: string;
}

export interface QuarantineInfo {
  location: string;
  expiryDate: Date;
  accessLevel: 'admin' | 'security' | 'user';
  reviewRequired: boolean;
  reviewDeadline?: Date;
}

// Security Audit and Logging Types
export interface SecurityAuditEvent {
  id: string;
  timestamp: Date;
  eventType: SecurityEventType;
  severity: ThreatSeverity;
  userId?: string;
  fileId?: string;
  ipAddress: string;
  userAgent: string;
  details: SecurityEventDetails;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  notes?: string;
}

export enum SecurityEventType {
  THREAT_DETECTED = 'threat_detected',
  PII_DETECTED = 'pii_detected',
  MALWARE_BLOCKED = 'malware_blocked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  FILE_QUARANTINED = 'file_quarantined',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  SYSTEM_ALERT = 'system_alert'
}

export interface SecurityEventDetails {
  description: string;
  affectedResources: string[];
  threatData?: ThreatDetectionResult;
  piiData?: PIIDetectionResult;
  responseActions: ThreatAction[];
  additionalContext: Record<string, any>;
}

// Configuration Types
export interface ThreatDetectionConfig {
  enableMalwareDetection: boolean;
  enablePIIDetection: boolean;
  enableBehaviorAnalysis: boolean;
  enableRealTimeScanning: boolean;
  maxScanSize: number; // bytes
  scanTimeoutMs: number;
  confidenceThreshold: number; // 0-100
  autoQuarantineThreshold: number; // 0-100
  enableNotifications: boolean;
  notificationSettings: NotificationSettings;
  complianceMode: ComplianceMode;
}

export interface NotificationSettings {
  email?: {
    enabled: boolean;
    recipients: string[];
    template: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers: Record<string, string>;
  };
  dashboard?: {
    enabled: boolean;
    realTimeUpdates: boolean;
  };
}

export enum ComplianceMode {
  STRICT = 'strict',     // Block all potential violations
  BALANCED = 'balanced', // Warn and log violations
  PERMISSIVE = 'permissive' // Log only
}

// Statistics and Metrics Types
export interface ThreatStatistics {
  period: {
    start: Date;
    end: Date;
  };
  totalScans: number;
  threatsDetected: number;
  piiDetected: number;
  filesBlocked: number;
  filesQuarantined: number;
  avgScanTime: number;
  topThreats: ThreatCount[];
  topPIITypes: PIICount[];
  riskDistribution: RiskDistribution;
  complianceStatus: ComplianceStatus;
}

export interface ThreatCount {
  type: ThreatType;
  count: number;
  percentage: number;
}

export interface PIICount {
  type: PIIType;
  count: number;
  percentage: number;
}

export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ComplianceStatus {
  regulation: ComplianceRegulation;
  compliant: boolean;
  violations: number;
  lastAudit: Date;
  nextAudit: Date;
}

// API Response Types
export interface ThreatDetectionResponse {
  success: boolean;
  fileId: string;
  results: ThreatDetectionResult;
  piiResults?: PIIDetectionResult;
  responseActions: ThreatResponse[];
  message: string;
  timestamp: Date;
}

export interface ThreatIntelligenceUpdateResponse {
  success: boolean;
  updatedSignatures: number;
  updatedPatterns: number;
  updatedHashes: number;
  version: string;
  timestamp: Date;
  errors?: string[];
}

// Error Types
export interface ThreatDetectionError {
  code: ThreatErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  fileId?: string;
  retryable: boolean;
}

export enum ThreatErrorCode {
  SCAN_TIMEOUT = 'scan_timeout',
  INVALID_FILE = 'invalid_file',
  SIGNATURE_OUTDATED = 'signature_outdated',
  INSUFFICIENT_RESOURCES = 'insufficient_resources',
  CONFIGURATION_ERROR = 'configuration_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_DENIED = 'permission_denied',
  UNKNOWN_ERROR = 'unknown_error'
}