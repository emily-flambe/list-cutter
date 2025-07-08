/**
 * Comprehensive type definitions for dashboard API responses
 */

// Base response types
export interface DashboardResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  meta: {
    userId: string;
    timestamp: string;
    endpoint: string;
    cached: boolean;
    processingTime: number;
  };
}

// Admin Dashboard Types
export interface AdminStorageMetrics {
  overview: StorageOverview;
  storageBreakdown: StorageBreakdown[];
  growthTrends: GrowthTrend[];
  topUsers: TopUser[];
  timeRange: string;
  generatedAt: string;
}

export interface AdminPerformanceMetrics {
  performanceOverview: PerformanceOverview;
  operationLatencies: OperationLatency[];
  throughputTrends: ThroughputTrend[];
  errorRates: ErrorRate[];
  timeRange: string;
  generatedAt: string;
}

export interface AdminCostMetrics {
  costOverview: CostOverview;
  costBreakdown: CostBreakdown[];
  costTrends: CostTrend[];
  topCostUsers: TopCostUser[];
  timeRange: string;
  generatedAt: string;
}

export interface AdminAlerts {
  alerts: SystemAlert[];
  alertSummary: AlertSummary;
  generatedAt: string;
}

export interface SystemHealthIndicators {
  healthMetrics: HealthMetric[];
  systemStatus: SystemStatus;
  resourceUtilization: ResourceUtilization;
  generatedAt: string;
}

export interface AdminUserMetrics {
  userMetrics: UserMetric[];
  userGrowth: UserGrowth[];
  quotaViolations: QuotaViolation[];
  generatedAt: string;
}

// User Dashboard Types
export interface UserStorageUsage {
  overview: UserStorageOverview;
  quotaStatus: QuotaStatus;
  recentActivity: RecentActivity[];
  generatedAt: string;
}

export interface UserStorageAnalytics {
  analytics: UserAnalytics;
  insights: UserInsights;
  timeRange: string;
  generatedAt: string;
}

export interface UserStorageTrends {
  trends: UserTrend[];
  projections: StorageProjections;
  timeRange: string;
  generatedAt: string;
}

export interface UserCostAnalytics {
  costs: UserCostBreakdown;
  forecast: CostForecast;
  timeRange: string;
  generatedAt: string;
}

export interface UserPerformanceMetrics {
  performance: UserPerformance;
  recommendations: PerformanceRecommendation[];
  timeRange: string;
  generatedAt: string;
}

export interface UserQuotaStatus {
  quotaDetails: QuotaDetails;
  usageHistory: QuotaUsageHistory[];
  generatedAt: string;
}

// Realtime Types
export interface RealtimeOverview {
  overview: RealtimeMetrics;
  generatedAt: string;
}

export interface RealtimeOperations {
  operations: RealtimeOperationMetric[];
  generatedAt: string;
}

export interface RealtimeErrors {
  errors: RealtimeErrorMetric[];
  generatedAt: string;
}

// Historical Types
export interface HistoricalData<T = unknown> {
  data: T[];
  timeRange: string;
  granularity?: string;
  generatedAt: string;
}

// Core Data Types
export interface StorageOverview {
  totalBytes: number;
  totalFiles: number;
  totalUsers: number;
  totalCost: number;
  storageClasses: {
    standard: {
      bytes: number;
      files: number;
      cost: number;
    };
    infrequentAccess: {
      bytes: number;
      files: number;
      cost: number;
    };
  };
  growth: {
    dailyGrowthBytes: number;
    weeklyGrowthBytes: number;
    monthlyGrowthBytes: number;
    dailyGrowthPercentage: number;
  };
}

export interface StorageBreakdown {
  storage_class: string;
  total_bytes: number;
  users: number;
  operations: number;
}

export interface GrowthTrend {
  date: string;
  total_bytes: number;
  active_users: number;
}

export interface TopUser {
  username: string;
  email: string;
  total_bytes: number;
  metrics_count: number;
}

export interface PerformanceOverview {
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  totalOperations: number;
  operationBreakdown: {
    [operation: string]: {
      count: number;
      averageLatency: number;
      errorRate: number;
    };
  };
}

export interface OperationLatency {
  operation_type: string;
  avg_latency: number;
  min_latency: number;
  max_latency: number;
}

export interface ThroughputTrend {
  date: string;
  operation_type: string;
  total_bytes: number;
  total_operations: number;
  avg_throughput: number;
}

export interface ErrorRate {
  operation_type: string;
  total_operations: number;
  error_count: number;
  error_rate: number;
}

export interface CostOverview {
  total_cost: number;
  users: number;
  avg_cost_per_user: number;
}

export interface CostBreakdown {
  metric_type: string;
  total_cost: number;
  users: number;
}

export interface CostTrend {
  date: string;
  daily_cost: number;
  active_users: number;
}

export interface TopCostUser {
  username: string;
  email: string;
  total_cost: number;
}

export interface SystemAlert {
  type: 'quota_violation' | 'high_error_rate' | 'high_cost' | 'system_error' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  data?: unknown;
  acknowledged?: boolean;
  resolvedAt?: string;
}

export interface AlertSummary {
  quota_violations: number;
  quota_warnings: number;
  total_users: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
}

export interface HealthMetric {
  metric: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  threshold: number;
  unit: string;
}

export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  lastUpdate: string;
  services: {
    database: 'healthy' | 'warning' | 'error';
    storage: 'healthy' | 'warning' | 'error';
    analytics: 'healthy' | 'warning' | 'error';
    workers: 'healthy' | 'warning' | 'error';
  };
  regions: {
    [region: string]: 'healthy' | 'warning' | 'error';
  };
}

export interface ResourceUtilization {
  active_users: number;
  total_storage: number;
  total_operations: number;
  bandwidth: {
    ingress: number;
    egress: number;
  };
  requests: {
    classA: number;
    classB: number;
  };
}

export interface UserMetric {
  username: string;
  email: string;
  user_since: string;
  total_bytes: number;
  total_files: number;
  storage_usage_percentage: number;
  quota_type: string;
  total_cost: number;
}

export interface UserGrowth {
  date: string;
  new_users: number;
}

export interface QuotaViolation {
  username: string;
  email: string;
  storage_usage_percentage: number;
  quota_type: string;
}

export interface UserStorageOverview {
  storage: {
    totalBytes: number;
    totalFiles: number;
    usagePercentage: number;
    byStorageClass: {
      standard: number;
      infrequentAccess: number;
    };
    byFileType: {
      [type: string]: number;
    };
  };
  quota: {
    maxStorageBytes: number;
    maxObjects: number;
    quotaType: string;
    billingEnabled: boolean;
  };
  costs: {
    currentMonthCost: number;
    lastMonthCost: number;
    projectedMonthCost: number;
    costBreakdown: {
      storage: number;
      requests: number;
      bandwidth: number;
    };
  };
  activity: {
    dailyOperations: number;
    weeklyOperations: number;
    monthlyOperations: number;
    lastActivity: string;
  };
}

export interface QuotaStatus {
  status: 'ok' | 'warning' | 'violated' | 'suspended';
  warnings: string[];
  violations: string[];
  quotaType: string;
  billingEnabled: boolean;
  limits: {
    storage: {
      used: number;
      limit: number;
      percentage: number;
    };
    cost: {
      used: number;
      limit: number;
      percentage: number;
    };
    operations: {
      used: number;
      limit: number;
      percentage: number;
    };
  };
}

export interface RecentActivity {
  date: string;
  operation_type: string;
  operations: number;
  bytes: number;
}

export interface UserAnalytics {
  date: string;
  metric_type: string;
  bytes: number;
  operations: number;
  cost: number;
}

export interface UserInsights {
  mostActiveDay: string;
  averageDailyUploads: number;
  costOptimizationTips: string[];
  usagePatterns: {
    peakHours: string[];
    fileTypes: string[];
    averageFileSize: number;
  };
  efficiency: {
    storageEfficiency: number;
    costEfficiency: number;
    performanceScore: number;
  };
}

export interface UserTrend {
  date: string;
  total_bytes: number;
  operation_types: number;
}

export interface StorageProjections {
  projectedStorageIn30Days: string;
  projectedCostIn30Days: string;
  growthRate: string;
  recommendedQuota: string;
  projectionAccuracy: number;
  trendsAnalysis: {
    direction: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
    seasonality: boolean;
  };
}

export interface UserCostBreakdown {
  totalCost: number;
  breakdown: {
    storage: {
      cost: number;
      percentage: number;
      bytes: number;
    };
    requests: {
      cost: number;
      percentage: number;
      classA: number;
      classB: number;
    };
    bandwidth: {
      cost: number;
      percentage: number;
      bytes: number;
    };
  };
  timeline: {
    date: string;
    cost: number;
  }[];
  freeTierUsage: {
    storage: {
      used: number;
      limit: number;
      percentage: number;
    };
    requests: {
      classA: {
        used: number;
        limit: number;
        percentage: number;
      };
      classB: {
        used: number;
        limit: number;
        percentage: number;
      };
    };
    bandwidth: {
      used: number;
      limit: number;
      percentage: number;
    };
  };
}

export interface CostForecast {
  currentMonthEstimate: string;
  nextMonthForecast: string;
  annualForecast: string;
  optimizationPotential: string;
  recommendations: {
    type: 'storage_class' | 'file_lifecycle' | 'usage_pattern';
    description: string;
    estimatedSavings: string;
  }[];
  confidence: number;
}

export interface UserPerformance {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    upload: number;
    download: number;
  };
  reliability: {
    successRate: number;
    errorRate: number;
    retryRate: number;
  };
  operationBreakdown: {
    [operation: string]: {
      count: number;
      averageLatency: number;
      successRate: number;
    };
  };
}

export interface PerformanceRecommendation {
  type: 'optimization' | 'best_practice' | 'warning';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category: 'upload' | 'download' | 'storage' | 'cost' | 'reliability';
}

export interface QuotaDetails {
  user_id: string;
  email: string;
  username: string;
  total_files: number;
  total_bytes: number;
  standard_bytes: number;
  ia_bytes: number;
  max_storage_bytes: number;
  max_objects: number;
  quota_type: string;
  billing_enabled: boolean;
  storage_usage_percentage: number;
}

export interface QuotaUsageHistory {
  date: string;
  storage_used: number;
}

export interface RealtimeMetrics {
  total_operations: number;
  total_bytes: number;
  total_errors: number;
  avg_throughput: number;
  timestamp: string;
}

export interface RealtimeOperationMetric {
  operation_type: string;
  operations: number;
  bytes: number;
  avg_throughput: number;
}

export interface RealtimeErrorMetric {
  operation_type: string;
  errors: number;
  total_operations: number;
  error_rate: number;
}

// Dashboard Configuration Types
export interface DashboardConfig {
  refreshInterval: number;
  defaultTimeRange: string;
  maxDataPoints: number;
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
  features: {
    realtime: boolean;
    alerts: boolean;
    forecasting: boolean;
    recommendations: boolean;
  };
}

// Filter and Query Types
export interface DashboardFilters {
  timeRange?: '24hours' | '7days' | '30days' | '90days';
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  users?: string[];
  operations?: string[];
  storageClasses?: string[];
  regions?: string[];
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeMetadata?: boolean;
  aggregateData?: boolean;
}