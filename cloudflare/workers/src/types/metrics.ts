/**
 * Comprehensive metrics collection interfaces for R2 storage monitoring
 */

export interface StorageMetrics {
  // Operation timing
  timestamp: number;
  operation: StorageOperation;
  duration: number;
  
  // File information
  fileId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  
  // Operation results
  success: boolean;
  errorCategory?: ErrorCategory;
  errorMessage?: string;
  
  // Operation-specific data
  operationData: OperationData;
  
  // Performance metrics
  throughput?: number; // bytes per second
  latency?: number;    // milliseconds
  
  // Context
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  region?: string;
}

export type StorageOperation = 
  | 'upload_single'
  | 'upload_multipart'
  | 'upload_part'
  | 'download'
  | 'delete'
  | 'list'
  | 'head'
  | 'abort_multipart'
  | 'complete_multipart';

export type ErrorCategory = 
  | 'network_error'
  | 'permission_denied'
  | 'quota_exceeded'
  | 'file_not_found'
  | 'invalid_request'
  | 'server_error'
  | 'timeout'
  | 'checksum_mismatch'
  | 'rate_limit_exceeded'
  | 'storage_limit_exceeded'
  | 'unknown_error';

export interface OperationData {
  // Upload-specific
  uploadType?: 'single' | 'multipart';
  partNumber?: number;
  totalParts?: number;
  partsCompleted?: number;
  storageClass?: string;
  
  // Download-specific
  rangeRequest?: boolean;
  rangeStart?: number;
  rangeEnd?: number;
  cacheHit?: boolean;
  
  // Multipart-specific
  multipartUploadId?: string;
  concurrentParts?: number;
  averagePartSize?: number;
  
  // General
  retryCount?: number;
  bytesTransferred?: number;
  compressionRatio?: number;
  
  // Additional context
  metadata?: Record<string, unknown>;
}

export interface UserStorageMetrics {
  userId: string;
  timestamp: number;
  
  // Storage usage
  totalFiles: number;
  totalSizeBytes: number;
  quotaUsagePercentage: number;
  
  // Daily activity
  dailyUploads: number;
  dailyDownloads: number;
  dailyDeletes: number;
  dailyBandwidthBytes: number;
  
  // Performance metrics
  averageUploadSpeed: number;
  averageDownloadSpeed: number;
  successRate: number;
  
  // Storage breakdown
  storageByType: Record<string, number>;
  storageByClass: Record<string, number>;
  
  // Trending data
  weeklyGrowth: number;
  monthlyGrowth: number;
}

export interface MultipartUploadMetrics {
  uploadId: string;
  fileId: string;
  userId: string;
  
  // Timing
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // Progress
  totalParts: number;
  completedParts: number;
  failedParts: number;
  
  // Performance
  totalBytes: number;
  averagePartSize: number;
  concurrentParts: number;
  overallThroughput: number;
  
  // Status
  status: 'active' | 'completed' | 'failed' | 'aborted';
  errorDetails?: {
    category: ErrorCategory;
    message: string;
    failedParts: number[];
  };
}

export interface SystemMetrics {
  timestamp: number;
  
  // Overall system performance
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  
  // Resource utilization
  activeConnections: number;
  queueDepth: number;
  memoryUsage: number;
  
  // Error distribution
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByUser: Record<string, number>;
  
  // Throughput metrics
  totalBytesTransferred: number;
  totalBandwidthUsed: number;
  peakThroughput: number;
  
  // Storage metrics
  totalStorageUsed: number;
  totalFiles: number;
  averageFileSize: number;
  
  // Geographic distribution
  requestsByRegion: Record<string, number>;
  latencyByRegion: Record<string, number>;
}

export interface AlertThresholds {
  // Performance thresholds
  maxResponseTime: number;
  maxErrorRate: number;
  maxQueueDepth: number;
  
  // Storage thresholds
  maxStorageUsage: number;
  maxDailyBandwidth: number;
  maxFilesPerUser: number;
  
  // System thresholds
  maxConcurrentUploads: number;
  maxFailedOperationsPerMinute: number;
  
  // Custom thresholds
  customThresholds: Record<string, number>;
}

export interface MetricsAggregation {
  timeWindow: 'minute' | 'hour' | 'day' | 'week' | 'month';
  startTime: number;
  endTime: number;
  
  // Aggregated metrics
  totalOperations: number;
  successRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Error metrics
  errorCount: number;
  errorRate: number;
  errorsByCategory: Record<ErrorCategory, number>;
  
  // Throughput metrics
  totalBytesTransferred: number;
  averageThroughput: number;
  peakThroughput: number;
  
  // User metrics
  activeUsers: number;
  newUsers: number;
  topUsersByUsage: Array<{ userId: string; usage: number }>;
  
  // File metrics
  filesUploaded: number;
  filesDownloaded: number;
  filesDeleted: number;
  averageFileSize: number;
}

export interface MetricsConfiguration {
  // Collection settings
  enableMetrics: boolean;
  enableDetailedMetrics: boolean;
  enableUserMetrics: boolean;
  enableSystemMetrics: boolean;
  
  // Sampling rates
  successMetricsSamplingRate: number;
  errorMetricsSamplingRate: number;
  detailedMetricsSamplingRate: number;
  
  // Retention settings
  rawMetricsRetentionDays: number;
  aggregatedMetricsRetentionDays: number;
  
  // Alert settings
  enableAlerts: boolean;
  alertThresholds: AlertThresholds;
  
  // Analytics Engine settings
  analyticsDataset: string;
  batchSize: number;
  flushInterval: number;
  
  // Performance settings
  asyncMetrics: boolean;
  metricsQueueSize: number;
  
  // Custom settings
  customDimensions: string[];
  customMetrics: string[];
}