/**
 * Security Metrics Collector Service
 * 
 * This service provides comprehensive metrics collection for security components:
 * - Performance metrics aggregation
 * - Security event analytics
 * - Trend analysis and reporting
 * - Dashboard data preparation
 * - Alerting integration
 */

import { SecurityConfigManager } from '../../config/security-config';
import { SecurityMonitorService, SecurityEvent } from './security-monitor';

// File validation results interface
interface FileValidationResults {
  passed: boolean;
  checks: {
    fileType: boolean;
    fileSize: boolean;
    virusScan: boolean;
    contentAnalysis: boolean;
  };
  warnings: string[];
  errors: string[];
  threats?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  securityScan?: {
    risk: 'low' | 'medium' | 'high' | 'critical';
    score: number;
  };
}

export interface MetricsCollectionConfig {
  enabled: boolean;
  batchSize: number;
  flushIntervalSeconds: number;
  retentionDays: number;
  aggregationWindows: number[]; // Minutes
  enabledMetrics: string[];
  alertThresholds: Record<string, number>;
}

export interface SecurityMetricPoint {
  timestamp: string;
  metric: string;
  value: number;
  tags: Record<string, string>;
  dimensions: Record<string, string>;
}

export interface MetricsAggregation {
  timestamp: string;
  window: number; // Minutes
  metrics: {
    [key: string]: {
      count: number;
      sum: number;
      min: number;
      max: number;
      avg: number;
      p95: number;
      p99: number;
    };
  };
}

export interface SecurityDashboardData {
  overview: {
    timestamp: string;
    timeRange: string;
    totalEvents: number;
    totalAlerts: number;
    averageResponseTime: number;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    systemHealth: 'healthy' | 'degraded' | 'critical';
  };
  performance: {
    authLatency: MetricTimeSeries;
    fileValidationLatency: MetricTimeSeries;
    rateLimitLatency: MetricTimeSeries;
    totalSecurityOverhead: MetricTimeSeries;
  };
  security: {
    authFailures: MetricTimeSeries;
    fileUploadFailures: MetricTimeSeries;
    rateLimitViolations: MetricTimeSeries;
    threatDetections: MetricTimeSeries;
  };
  trends: {
    authFailureRate: TrendData;
    fileUploadRate: TrendData;
    threatDetectionRate: TrendData;
    performanceTrend: TrendData;
  };
  topThreats: ThreatSummary[];
  topIPs: IPSummary[];
  recentAlerts: AlertSummary[];
}

export interface MetricTimeSeries {
  name: string;
  data: Array<{
    timestamp: string;
    value: number;
  }>;
  unit: string;
  change: number; // Percentage change from previous period
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ThreatSummary {
  type: string;
  count: number;
  severity: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface IPSummary {
  ip: string;
  events: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  lastActivity: string;
}

export interface AlertSummary {
  id: string;
  type: string;
  severity: string;
  timestamp: string;
  description: string;
  status: 'active' | 'resolved';
}

export interface MetricsCollectorOptions {
  configManager: SecurityConfigManager;
  monitor: SecurityMonitorService;
  analytics: AnalyticsEngineDataset;
  kvStorage: KVNamespace;
  config: MetricsCollectionConfig;
}

/**
 * Security Metrics Collector Service
 * 
 * Collects, aggregates, and provides security metrics for monitoring and alerting
 */
export class SecurityMetricsCollector {
  private configManager: SecurityConfigManager;
  private monitor: SecurityMonitorService;
  private analytics: AnalyticsEngineDataset;
  private kvStorage: KVNamespace;
  private config: MetricsCollectionConfig;
  
  // Metrics buffer for batching
  private metricsBuffer: SecurityMetricPoint[] = [];
  private lastFlushTime: number = Date.now();
  
  // Aggregation cache
  private aggregationCache: Map<string, MetricsAggregation> = new Map();
  
  constructor(options: MetricsCollectorOptions) {
    this.configManager = options.configManager;
    this.monitor = options.monitor;
    this.analytics = options.analytics;
    this.kvStorage = options.kvStorage;
    this.config = options.config;
  }
  
  /**
   * Collect a security metric point
   */
  async collectMetric(
    metric: string,
    value: number,
    tags: Record<string, string> = {},
    dimensions: Record<string, string> = {}
  ): Promise<void> {
    if (!this.config.enabled || !this.config.enabledMetrics.includes(metric)) {
      return;
    }
    
    const metricPoint: SecurityMetricPoint = {
      timestamp: new Date().toISOString(),
      metric,
      value,
      tags,
      dimensions
    };
    
    // Add to buffer
    this.metricsBuffer.push(metricPoint);
    
    // Check if we need to flush
    if (this.shouldFlush()) {
      await this.flushMetrics();
    }
  }
  
  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics(
    operation: string,
    duration: number,
    success: boolean,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.collectMetric(
      'security.performance.duration',
      duration,
      {
        operation,
        success: success.toString()
      },
      metadata
    );
    
    await this.collectMetric(
      'security.performance.operations',
      1,
      {
        operation,
        success: success.toString()
      },
      metadata
    );
  }
  
  /**
   * Collect security event metrics
   */
  async collectSecurityEventMetrics(event: SecurityEvent): Promise<void> {
    // Count events by type
    await this.collectMetric(
      'security.events.count',
      1,
      {
        type: event.type,
        severity: event.severity,
        source: event.source
      },
      {
        userId: event.userId || 'anonymous',
        ipAddress: event.ipAddress || 'unknown'
      }
    );
    
    // Response time if available
    if (event.responseTime) {
      await this.collectMetric(
        'security.events.response_time',
        event.responseTime,
        {
          type: event.type,
          severity: event.severity
        }
      );
    }
    
    // Failure metrics
    if (!event.resolved) {
      await this.collectMetric(
        'security.events.failures',
        1,
        {
          type: event.type,
          severity: event.severity
        }
      );
    }
  }
  
  /**
   * Collect authentication metrics
   */
  async collectAuthMetrics(
    success: boolean,
    method: string,
    duration: number,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.collectMetric(
      'security.auth.attempts',
      1,
      {
        success: success.toString(),
        method
      },
      {
        userId: userId || 'anonymous',
        ipAddress: ipAddress || 'unknown'
      }
    );
    
    await this.collectMetric(
      'security.auth.duration',
      duration,
      {
        success: success.toString(),
        method
      }
    );
    
    if (!success) {
      await this.collectMetric(
        'security.auth.failures',
        1,
        {
          method,
          reason: 'invalid_credentials'
        },
        {
          userId: userId || 'anonymous',
          ipAddress: ipAddress || 'unknown'
        }
      );
    }
  }
  
  /**
   * Collect file validation metrics
   */
  async collectFileValidationMetrics(
    success: boolean,
    fileSize: number,
    fileType: string,
    validationDuration: number,
    validationResults?: FileValidationResults
  ): Promise<void> {
    await this.collectMetric(
      'security.file.validations',
      1,
      {
        success: success.toString(),
        fileType
      }
    );
    
    await this.collectMetric(
      'security.file.validation_duration',
      validationDuration,
      {
        success: success.toString(),
        fileType
      }
    );
    
    await this.collectMetric(
      'security.file.size',
      fileSize,
      {
        success: success.toString(),
        fileType
      }
    );
    
    if (validationResults) {
      if (validationResults.threats?.length > 0) {
        await this.collectMetric(
          'security.file.threats',
          validationResults.threats.length,
          {
            fileType,
            riskLevel: validationResults.securityScan?.risk || 'low'
          }
        );
      }
      
      if (validationResults.errors?.length > 0) {
        await this.collectMetric(
          'security.file.validation_errors',
          validationResults.errors.length,
          {
            fileType
          }
        );
      }
    }
  }
  
  /**
   * Collect rate limiting metrics
   */
  async collectRateLimitMetrics(
    blocked: boolean,
    limit: number,
    current: number,
    ipAddress?: string,
    userId?: string
  ): Promise<void> {
    await this.collectMetric(
      'security.rate_limit.checks',
      1,
      {
        blocked: blocked.toString(),
        usage: this.calculateUsageCategory(current, limit)
      },
      {
        userId: userId || 'anonymous',
        ipAddress: ipAddress || 'unknown'
      }
    );
    
    await this.collectMetric(
      'security.rate_limit.usage',
      current / limit,
      {
        blocked: blocked.toString()
      }
    );
    
    if (blocked) {
      await this.collectMetric(
        'security.rate_limit.violations',
        1,
        {},
        {
          userId: userId || 'anonymous',
          ipAddress: ipAddress || 'unknown'
        }
      );
    }
  }
  
  /**
   * Get aggregated metrics for a time period
   */
  async getAggregatedMetrics(
    metricName: string,
    windowMinutes: number,
    hoursBack: number = 24
  ): Promise<MetricsAggregation> {
    const cacheKey = `${metricName}-${windowMinutes}-${hoursBack}`;
    
    // Check cache first
    if (this.aggregationCache.has(cacheKey)) {
      const cached = this.aggregationCache.get(cacheKey);
      if (cached) {
        const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
        if (cacheAge < windowMinutes * 60 * 1000) {
          return cached;
        }
      }
    }
    
    // Calculate aggregation
    const aggregation = await this.calculateAggregation(metricName, windowMinutes, hoursBack);
    
    // Cache result
    this.aggregationCache.set(cacheKey, aggregation);
    
    return aggregation;
  }
  
  /**
   * Generate security dashboard data
   */
  async generateDashboardData(timeRange: string = '24h'): Promise<SecurityDashboardData> {
    const hoursBack = this.parseTimeRange(timeRange);
    
    // Get overview data
    const overview = await this.generateOverviewData(hoursBack);
    
    // Get performance metrics
    const performance = await this.generatePerformanceData(hoursBack);
    
    // Get security metrics
    const security = await this.generateSecurityData(hoursBack);
    
    // Get trends
    const trends = await this.generateTrendsData(hoursBack);
    
    // Get top threats and IPs
    const [topThreats, topIPs] = await Promise.all([
      this.getTopThreats(hoursBack),
      this.getTopIPs(hoursBack)
    ]);
    
    // Get recent alerts
    const recentAlerts = await this.getRecentAlerts(hoursBack);
    
    return {
      overview,
      performance,
      security,
      trends,
      topThreats,
      topIPs,
      recentAlerts
    };
  }
  
  /**
   * Export metrics data for external analysis
   */
  async exportMetrics(
    startTime: string,
    endTime: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const metrics = await this.getMetricsInRange(startTime, endTime);
    
    if (format === 'csv') {
      return this.formatMetricsAsCSV(metrics);
    }
    
    return JSON.stringify(metrics, null, 2);
  }
  
  /**
   * Get metrics summary for reporting
   */
  async getMetricsSummary(hoursBack: number = 24): Promise<{
    totalMetrics: number;
    uniqueMetricTypes: number;
    averageValue: number;
    maxValue: number;
    minValue: number;
    timeRange: string;
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);
    
    const metrics = await this.getMetricsInRange(
      startTime.toISOString(),
      endTime.toISOString()
    );
    
    const values = metrics.map(m => m.value);
    const uniqueTypes = new Set(metrics.map(m => m.metric));
    
    return {
      totalMetrics: metrics.length,
      uniqueMetricTypes: uniqueTypes.size,
      averageValue: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      maxValue: values.length > 0 ? Math.max(...values) : 0,
      minValue: values.length > 0 ? Math.min(...values) : 0,
      timeRange: `${startTime.toISOString()} to ${endTime.toISOString()}`
    };
  }
  
  /**
   * Flush metrics buffer
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;
    
    try {
      // Send to analytics engine
      for (const metric of this.metricsBuffer) {
        this.analytics.writeDataPoint({
          blobs: [metric.metric, ...Object.values(metric.tags)],
          doubles: [metric.value],
          indexes: [metric.timestamp, ...Object.values(metric.dimensions)]
        });
      }
      
      // Store in KV for aggregation
      const today = new Date().toISOString().split('T')[0];
      const metricsKey = `metrics-${today}`;
      
      const existingMetrics = await this.kvStorage.get(metricsKey);
      const allMetrics = existingMetrics ? 
        JSON.parse(existingMetrics).concat(this.metricsBuffer) : 
        this.metricsBuffer;
      
      await this.kvStorage.put(metricsKey, JSON.stringify(allMetrics));
      
      // Clear buffer
      this.metricsBuffer = [];
      this.lastFlushTime = Date.now();
      
    } catch (error) {
      console.error('Failed to flush metrics:', error);
    }
  }
  
  /**
   * Check if we should flush the metrics buffer
   */
  private shouldFlush(): boolean {
    return this.metricsBuffer.length >= this.config.batchSize ||
           Date.now() - this.lastFlushTime >= this.config.flushIntervalSeconds * 1000;
  }
  
  /**
   * Calculate usage category for rate limiting
   */
  private calculateUsageCategory(current: number, limit: number): string {
    const ratio = current / limit;
    if (ratio >= 1) return 'exceeded';
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * Parse time range string to hours
   */
  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/(\d+)([hdw])/);
    if (!match) return 24;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'h': return value;
      case 'd': return value * 24;
      case 'w': return value * 24 * 7;
      default: return 24;
    }
  }
  
  /**
   * Calculate aggregation for a metric
   */
  private async calculateAggregation(
    metricName: string,
    windowMinutes: number,
    hoursBack: number
  ): Promise<MetricsAggregation> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);
    
    const metrics = await this.getMetricsInRange(
      startTime.toISOString(),
      endTime.toISOString()
    );
    
    const relevantMetrics = metrics.filter(m => m.metric === metricName);
    const values = relevantMetrics.map(m => m.value).sort((a, b) => a - b);
    
    if (values.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        window: windowMinutes,
        metrics: {}
      };
    }
    
    const aggregation = {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p95: values[Math.floor(values.length * 0.95)] || 0,
      p99: values[Math.floor(values.length * 0.99)] || 0
    };
    
    return {
      timestamp: new Date().toISOString(),
      window: windowMinutes,
      metrics: {
        [metricName]: aggregation
      }
    };
  }
  
  /**
   * Get metrics in a time range
   */
  private async getMetricsInRange(startTime: string, endTime: string): Promise<SecurityMetricPoint[]> {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const allMetrics: SecurityMetricPoint[] = [];
    
    // Get metrics for each day in range
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      const metricsKey = `metrics-${dateKey}`;
      
      try {
        const metricsData = await this.kvStorage.get(metricsKey);
        if (metricsData) {
          const dayMetrics = JSON.parse(metricsData) as SecurityMetricPoint[];
          allMetrics.push(...dayMetrics);
        }
      } catch (error) {
        console.error(`Failed to get metrics for ${dateKey}:`, error);
      }
    }
    
    // Filter by time range
    return allMetrics.filter(metric => {
      const metricTime = new Date(metric.timestamp);
      return metricTime >= start && metricTime <= end;
    });
  }
  
  /**
   * Generate overview data
   */
  private async generateOverviewData(hoursBack: number): Promise<SecurityDashboardData['overview']> {
    const dashboard = await this.monitor.getSecurityDashboard();
    
    return {
      timestamp: new Date().toISOString(),
      timeRange: `${hoursBack}h`,
      totalEvents: dashboard.summary.totalEvents,
      totalAlerts: dashboard.summary.openAlerts,
      averageResponseTime: dashboard.summary.averageResponseTime,
      threatLevel: dashboard.summary.threatLevel,
      systemHealth: dashboard.summary.systemHealth
    };
  }
  
  /**
   * Generate performance data
   */
  private async generatePerformanceData(hoursBack: number): Promise<SecurityDashboardData['performance']> {
    const authLatency = await this.generateMetricTimeSeries('security.auth.duration', hoursBack);
    const fileValidationLatency = await this.generateMetricTimeSeries('security.file.validation_duration', hoursBack);
    const rateLimitLatency = await this.generateMetricTimeSeries('security.rate_limit.duration', hoursBack);
    
    return {
      authLatency,
      fileValidationLatency,
      rateLimitLatency,
      totalSecurityOverhead: {
        name: 'Total Security Overhead',
        data: authLatency.data.map((point, i) => ({
          timestamp: point.timestamp,
          value: point.value + 
                 (fileValidationLatency.data[i]?.value || 0) + 
                 (rateLimitLatency.data[i]?.value || 0)
        })),
        unit: 'ms',
        change: 0
      }
    };
  }
  
  /**
   * Generate security data
   */
  private async generateSecurityData(hoursBack: number): Promise<SecurityDashboardData['security']> {
    const authFailures = await this.generateMetricTimeSeries('security.auth.failures', hoursBack);
    const fileUploadFailures = await this.generateMetricTimeSeries('security.file.validation_errors', hoursBack);
    const rateLimitViolations = await this.generateMetricTimeSeries('security.rate_limit.violations', hoursBack);
    const threatDetections = await this.generateMetricTimeSeries('security.file.threats', hoursBack);
    
    return {
      authFailures,
      fileUploadFailures,
      rateLimitViolations,
      threatDetections
    };
  }
  
  /**
   * Generate trends data
   */
  private async generateTrendsData(_hoursBack: number): Promise<SecurityDashboardData['trends']> {
    // This would compare current period with previous period
    // For now, return placeholder data
    return {
      authFailureRate: { current: 0.05, previous: 0.03, change: 66.7, trend: 'up' },
      fileUploadRate: { current: 0.95, previous: 0.97, change: -2.1, trend: 'down' },
      threatDetectionRate: { current: 0.01, previous: 0.02, change: -50, trend: 'down' },
      performanceTrend: { current: 45, previous: 50, change: -10, trend: 'down' }
    };
  }
  
  /**
   * Generate metric time series
   */
  private async generateMetricTimeSeries(metricName: string, hoursBack: number): Promise<MetricTimeSeries> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 60 * 60 * 1000);
    
    const metrics = await this.getMetricsInRange(startTime.toISOString(), endTime.toISOString());
    const relevantMetrics = metrics.filter(m => m.metric === metricName);
    
    // Group by hour
    const hourlyData = new Map<string, number[]>();
    
    for (const metric of relevantMetrics) {
      const hour = new Date(metric.timestamp).toISOString().substring(0, 13);
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      const hourValues = hourlyData.get(hour);
      if (hourValues) {
        hourValues.push(metric.value);
      }
    }
    
    // Convert to time series
    const data = Array.from(hourlyData.entries()).map(([hour, values]) => ({
      timestamp: hour + ':00:00.000Z',
      value: values.reduce((a, b) => a + b, 0) / values.length
    }));
    
    return {
      name: metricName,
      data,
      unit: this.getMetricUnit(metricName),
      change: 0 // Would calculate based on comparison with previous period
    };
  }
  
  /**
   * Get top threats
   */
  private async getTopThreats(_hoursBack: number): Promise<ThreatSummary[]> {
    // This would analyze threat patterns from metrics
    // For now, return placeholder data
    return [
      { type: 'suspicious_file', count: 5, severity: 'medium', trend: 'stable' },
      { type: 'rate_limit_violation', count: 12, severity: 'low', trend: 'decreasing' },
      { type: 'auth_failure', count: 8, severity: 'medium', trend: 'increasing' }
    ];
  }
  
  /**
   * Get top IPs
   */
  private async getTopIPs(_hoursBack: number): Promise<IPSummary[]> {
    // This would analyze IP patterns from metrics
    // For now, return placeholder data
    return [
      { ip: '192.168.1.100', events: 45, threatLevel: 'low', lastActivity: new Date().toISOString() },
      { ip: '10.0.0.50', events: 23, threatLevel: 'medium', lastActivity: new Date().toISOString() }
    ];
  }
  
  /**
   * Get recent alerts
   */
  private async getRecentAlerts(_hoursBack: number): Promise<AlertSummary[]> {
    const alerts = await this.monitor.getActiveAlerts();
    return alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      timestamp: alert.timestamp,
      description: alert.description,
      status: alert.resolved ? 'resolved' : 'active'
    }));
  }
  
  /**
   * Format metrics as CSV
   */
  private formatMetricsAsCSV(metrics: SecurityMetricPoint[]): string {
    const headers = ['timestamp', 'metric', 'value', 'tags', 'dimensions'];
    const rows = metrics.map(metric => [
      metric.timestamp,
      metric.metric,
      metric.value.toString(),
      JSON.stringify(metric.tags),
      JSON.stringify(metric.dimensions)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
  
  /**
   * Get metric unit
   */
  private getMetricUnit(metricName: string): string {
    if (metricName.includes('duration') || metricName.includes('latency')) {
      return 'ms';
    }
    if (metricName.includes('size')) {
      return 'bytes';
    }
    if (metricName.includes('rate') || metricName.includes('usage')) {
      return '%';
    }
    return 'count';
  }
  
  /**
   * Cleanup old metrics
   */
  async cleanup(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    const dateKey = cutoffDate.toISOString().split('T')[0];
    
    try {
      await this.kvStorage.delete(`metrics-${dateKey}`);
      // Cleaned up metrics for ${dateKey}
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error);
    }
  }
}

/**
 * Security Metrics Collector Factory
 */
export class SecurityMetricsCollectorFactory {
  static create(options: MetricsCollectorOptions): SecurityMetricsCollector {
    return new SecurityMetricsCollector(options);
  }
  
  static createWithDefaults(
    configManager: SecurityConfigManager,
    monitor: SecurityMonitorService,
    analytics: AnalyticsEngineDataset,
    kvStorage: KVNamespace
  ): SecurityMetricsCollector {
    const config: MetricsCollectionConfig = {
      enabled: true,
      batchSize: 100,
      flushIntervalSeconds: 60,
      retentionDays: 30,
      aggregationWindows: [5, 15, 60, 1440], // 5min, 15min, 1hour, 1day
      enabledMetrics: [
        'security.auth.attempts',
        'security.auth.failures',
        'security.auth.duration',
        'security.file.validations',
        'security.file.validation_duration',
        'security.file.threats',
        'security.rate_limit.checks',
        'security.rate_limit.violations',
        'security.events.count',
        'security.events.response_time',
        'security.performance.duration'
      ],
      alertThresholds: {
        'security.auth.failures': 10,
        'security.file.threats': 5,
        'security.rate_limit.violations': 100,
        'security.performance.duration': 1000
      }
    };
    
    return new SecurityMetricsCollector({
      configManager,
      monitor,
      analytics,
      kvStorage,
      config
    });
  }
}