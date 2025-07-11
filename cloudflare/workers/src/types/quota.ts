/**
 * Quota Management Types
 * Defines interfaces for comprehensive user quota management system
 */

export interface QuotaTier {
  id: string;
  name: string;
  storageLimit: number; // bytes
  fileCountLimit: number;
  maxFileSize: number; // bytes
  bandwidthLimit: number; // bytes per month
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  features: string[];
  price: number; // cents
  isActive: boolean;
}

export interface UserQuota {
  id: string;
  userId: string;
  tierId: string;
  tier: QuotaTier;
  currentUsage: QuotaUsage;
  overrideSettings?: QuotaOverride;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface QuotaUsage {
  storageUsed: number; // bytes
  fileCount: number;
  bandwidthUsed: number; // bytes this month
  requestsThisMinute: number;
  requestsThisHour: number;
  requestsThisDay: number;
  requestsThisMonth: number;
  lastResetMinute: Date;
  lastResetHour: Date;
  lastResetDay: Date;
  lastResetMonth: Date;
}

export interface QuotaOverride {
  storageLimit?: number;
  fileCountLimit?: number;
  maxFileSize?: number;
  bandwidthLimit?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  reason: string;
  expiresAt?: Date;
  createdBy: string;
}

export interface QuotaCheck {
  isAllowed: boolean;
  quotaType: QuotaType;
  currentUsage: number;
  limit: number;
  remainingQuota: number;
  percentageUsed: number;
  resetTime?: Date;
  errorMessage?: string;
}

export interface QuotaCheckOptions {
  userId: string;
  operationType: QuotaOperationType;
  resourceSize?: number;
  ignoreOverage?: boolean;
}

export interface QuotaUpdate {
  userId: string;
  operationType: QuotaOperationType;
  resourceSize: number;
  metadata?: Record<string, unknown>;
}

export interface QuotaAnalytics {
  userId: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  storageUsage: TimeSeriesData[];
  fileCountUsage: TimeSeriesData[];
  bandwidthUsage: TimeSeriesData[];
  requestsUsage: TimeSeriesData[];
  topFilesBySize: FileUsageData[];
  quotaExceededEvents: QuotaExceededEvent[];
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

export interface FileUsageData {
  fileId: string;
  fileName: string;
  size: number;
  uploadDate: Date;
  lastAccessed: Date;
  accessCount: number;
}

export interface QuotaExceededEvent {
  timestamp: Date;
  quotaType: QuotaType;
  attempted: number;
  limit: number;
  operationType: QuotaOperationType;
  fileId?: string;
  metadata?: Record<string, unknown>;
}

export interface QuotaAlert {
  id: string;
  userId: string;
  alertType: QuotaAlertType;
  quotaType: QuotaType;
  threshold: number;
  currentUsage: number;
  limit: number;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  isActive: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
}

export interface QuotaReport {
  userId: string;
  reportType: 'summary' | 'detailed' | 'trends';
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalStorage: number;
    totalFiles: number;
    totalBandwidth: number;
    totalRequests: number;
    quotaUtilization: Record<QuotaType, number>;
  };
  trends: {
    storageGrowth: number;
    fileGrowth: number;
    bandwidthGrowth: number;
    requestGrowth: number;
  };
  recommendations: QuotaRecommendation[];
  generatedAt: Date;
}

export interface QuotaRecommendation {
  type: 'upgrade' | 'optimize' | 'alert' | 'cleanup';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedSavings?: number;
  actionRequired: boolean;
}

export interface QuotaConfiguration {
  quotaCheckEnabled: boolean;
  quotaEnforcementEnabled: boolean;
  gracePeriodMinutes: number;
  warningThresholds: {
    storage: number; // percentage
    files: number;
    bandwidth: number;
    requests: number;
  };
  alertThresholds: {
    storage: number; // percentage
    files: number;
    bandwidth: number;
    requests: number;
  };
  autoCleanupEnabled: boolean;
  autoCleanupThresholds: {
    unusedFilesAfterDays: number;
    largeFilesAfterDays: number;
    duplicateFilesAfterDays: number;
  };
}

export enum QuotaType {
  STORAGE = 'storage',
  FILE_COUNT = 'file_count',
  FILE_SIZE = 'file_size',
  BANDWIDTH = 'bandwidth',
  REQUESTS_PER_MINUTE = 'requests_per_minute',
  REQUESTS_PER_HOUR = 'requests_per_hour',
  REQUESTS_PER_DAY = 'requests_per_day'
}

export enum QuotaOperationType {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  DELETE = 'delete',
  PROCESS = 'process',
  LIST = 'list',
  METADATA = 'metadata'
}

export enum QuotaAlertType {
  THRESHOLD_WARNING = 'threshold_warning',
  THRESHOLD_CRITICAL = 'threshold_critical',
  QUOTA_EXCEEDED = 'quota_exceeded',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  TIER_UPGRADE_SUGGESTED = 'tier_upgrade_suggested'
}

export enum QuotaTierName {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

// Default quota tiers
export const DEFAULT_QUOTA_TIERS: Record<QuotaTierName, QuotaTier> = {
  [QuotaTierName.FREE]: {
    id: 'free',
    name: 'Free',
    storageLimit: 1024 * 1024 * 1024, // 1GB
    fileCountLimit: 100,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    bandwidthLimit: 5 * 1024 * 1024 * 1024, // 5GB/month
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    features: ['basic_processing', 'csv_cutting'],
    price: 0,
    isActive: true
  },
  [QuotaTierName.BASIC]: {
    id: 'basic',
    name: 'Basic',
    storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
    fileCountLimit: 1000,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    bandwidthLimit: 50 * 1024 * 1024 * 1024, // 50GB/month
    requestsPerMinute: 300,
    requestsPerHour: 5000,
    requestsPerDay: 50000,
    features: ['basic_processing', 'csv_cutting', 'advanced_filters', 'file_lineage'],
    price: 999, // $9.99
    isActive: true
  },
  [QuotaTierName.PREMIUM]: {
    id: 'premium',
    name: 'Premium',
    storageLimit: 100 * 1024 * 1024 * 1024, // 100GB
    fileCountLimit: 10000,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    bandwidthLimit: 500 * 1024 * 1024 * 1024, // 500GB/month
    requestsPerMinute: 1000,
    requestsPerHour: 20000,
    requestsPerDay: 200000,
    features: ['all_basic', 'batch_processing', 'api_access', 'analytics', 'priority_support'],
    price: 2999, // $29.99
    isActive: true
  },
  [QuotaTierName.ENTERPRISE]: {
    id: 'enterprise',
    name: 'Enterprise',
    storageLimit: 1024 * 1024 * 1024 * 1024, // 1TB
    fileCountLimit: 100000,
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    bandwidthLimit: 5 * 1024 * 1024 * 1024 * 1024, // 5TB/month
    requestsPerMinute: 5000,
    requestsPerHour: 100000,
    requestsPerDay: 1000000,
    features: ['all_premium', 'custom_integrations', 'dedicated_support', 'sla_guarantee'],
    price: 9999, // $99.99
    isActive: true
  },
  [QuotaTierName.CUSTOM]: {
    id: 'custom',
    name: 'Custom',
    storageLimit: Number.MAX_SAFE_INTEGER,
    fileCountLimit: Number.MAX_SAFE_INTEGER,
    maxFileSize: Number.MAX_SAFE_INTEGER,
    bandwidthLimit: Number.MAX_SAFE_INTEGER,
    requestsPerMinute: Number.MAX_SAFE_INTEGER,
    requestsPerHour: Number.MAX_SAFE_INTEGER,
    requestsPerDay: Number.MAX_SAFE_INTEGER,
    features: ['unlimited'],
    price: 0, // Contact sales
    isActive: true
  }
};

// Error types for quota management
export class QuotaExceededError extends Error {
  constructor(
    public quotaType: QuotaType,
    public currentUsage: number,
    public limit: number,
    public resetTime?: Date
  ) {
    super(`Quota exceeded for ${quotaType}: ${currentUsage}/${limit}`);
    this.name = 'QuotaExceededError';
  }
}

export class QuotaNotFoundError extends Error {
  constructor(public userId: string) {
    super(`Quota not found for user: ${userId}`);
    this.name = 'QuotaNotFoundError';
  }
}

export class InvalidQuotaOperationError extends Error {
  constructor(public operation: string, public reason: string) {
    super(`Invalid quota operation ${operation}: ${reason}`);
    this.name = 'InvalidQuotaOperationError';
  }
}