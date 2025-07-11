// Performance Monitoring Service - Performance Optimization Issue #69
// Implements comprehensive performance monitoring, analysis, and optimization recommendations

import { 
  FileOperation, 
  PerformanceMetrics, 
  PerformanceReport, 
  PerformanceRecommendation,
  TrendData 
} from '../types/cache';
import { EnhancedMetricsService } from './monitoring/enhanced-metrics-service';
import { AlertService } from './monitoring/alert-management-service';
import { CacheService } from '../types/cache';

export interface PerformanceThresholds {
  maxResponseTime: number; // milliseconds
  minCacheHitRate: number; // percentage (0-1)
  maxErrorRate: number; // percentage (0-1)
  maxCompressionTime: number; // milliseconds
  minCompressionRatio: number; // minimum compression benefit (0-1)
}

export interface OptimizationTarget {
  metric: 'response_time' | 'cache_hit_rate' | 'compression_efficiency' | 'error_rate';
  currentValue: number;
  targetValue: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PerformanceAlert {
  type: 'performance_degradation' | 'cache_performance_issue' | 'compression_issue' | 'error_rate_spike';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  currentValue: number;
  threshold: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

export class PerformanceMonitoringService {
  private performanceData: Map<string, PerformanceMetrics[]> = new Map();
  private currentThresholds: PerformanceThresholds = {
    maxResponseTime: 5000, // 5 seconds
    minCacheHitRate: 0.8,   // 80%
    maxErrorRate: 0.05,     // 5%
    maxCompressionTime: 2000, // 2 seconds
    minCompressionRatio: 0.1  // 10% minimum compression benefit
  };
  
  constructor(
    private metricsService: EnhancedMetricsService,
    private alertService: AlertService,
    private cacheService: CacheService
  ) {}
  
  async recordFileOperation(operation: FileOperation): Promise<void> {
    const performanceMetrics: PerformanceMetrics = {
      operation: operation.type,
      fileSize: operation.fileSize,
      duration: operation.duration,
      cacheHit: operation.cacheHit,
      compressionRatio: operation.compressionRatio,
      timestamp: new Date().toISOString(),
      userId: operation.userId
    };
    
    try {
      // 1. Store detailed metrics
      await this.recordPerformanceMetrics(performanceMetrics);
      
      // 2. Check for performance issues
      await this.checkPerformanceThresholds(performanceMetrics);
      
      // 3. Update performance baselines
      await this.updatePerformanceBaselines(performanceMetrics);
      
      // 4. Store in memory for trend analysis
      this.storeMetricsInMemory(performanceMetrics);
      
    } catch (error) {
      console.error('Failed to record file operation metrics:', error);
    }
  }
  
  async generatePerformanceReport(
    timeRange: { start: Date; end: Date } = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    }
  ): Promise<PerformanceReport> {
    try {
      // 1. Retrieve metrics for the specified time range
      const metrics = await this.getPerformanceMetrics(timeRange.start, timeRange.end);
      
      // 2. Calculate summary statistics
      const summary = this.calculateSummaryStatistics(metrics);
      
      // 3. Analyze trends
      const trends = await this.analyzeTrends(metrics);
      
      // 4. Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(metrics, summary);
      
      const report: PerformanceReport = {
        period: timeRange,
        summary,
        trends,
        recommendations
      };
      
      // 5. Cache the report for quick access
      await this.cachePerformanceReport(report);
      
      return report;
      
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      throw error;
    }
  }
  
  async getOptimizationTargets(): Promise<OptimizationTarget[]> {
    const metrics = await this.getRecentMetrics(60); // Last 60 minutes
    const targets: OptimizationTarget[] = [];
    
    if (metrics.length === 0) {
      return targets;
    }
    
    // Calculate current performance metrics
    const avgResponseTime = this.calculateAverage(metrics.map(m => m.duration));
    const cacheHitRate = this.calculateCacheHitRate(metrics);
    const compressionEfficiency = this.calculateCompressionEfficiency(metrics);
    const errorRate = this.calculateErrorRate(metrics);
    
    // Identify optimization targets
    if (avgResponseTime > this.currentThresholds.maxResponseTime) {
      targets.push({
        metric: 'response_time',
        currentValue: avgResponseTime,
        targetValue: this.currentThresholds.maxResponseTime * 0.8, // Target 20% below threshold
        priority: avgResponseTime > this.currentThresholds.maxResponseTime * 1.5 ? 'high' : 'medium'
      });
    }
    
    if (cacheHitRate < this.currentThresholds.minCacheHitRate) {
      targets.push({
        metric: 'cache_hit_rate',
        currentValue: cacheHitRate,
        targetValue: this.currentThresholds.minCacheHitRate,
        priority: cacheHitRate < 0.5 ? 'high' : 'medium'
      });
    }
    
    if (compressionEfficiency < this.currentThresholds.minCompressionRatio) {
      targets.push({
        metric: 'compression_efficiency',
        currentValue: compressionEfficiency,
        targetValue: this.currentThresholds.minCompressionRatio,
        priority: 'low'
      });
    }
    
    if (errorRate > this.currentThresholds.maxErrorRate) {
      targets.push({
        metric: 'error_rate',
        currentValue: errorRate,
        targetValue: this.currentThresholds.maxErrorRate,
        priority: errorRate > 0.1 ? 'high' : 'medium'
      });
    }
    
    return targets.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
  
  async triggerOptimizationActions(targets: OptimizationTarget[]): Promise<void> {
    for (const target of targets) {
      try {
        switch (target.metric) {
          case 'response_time':
            await this.optimizeResponseTime();
            break;
          case 'cache_hit_rate':
            await this.optimizeCachePerformance();
            break;
          case 'compression_efficiency':
            await this.optimizeCompression();
            break;
          case 'error_rate':
            await this.optimizeErrorHandling();
            break;
        }
      } catch (error) {
        console.error(`Failed to optimize ${target.metric}:`, error);
      }
    }
  }
  
  private async recordPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await this.metricsService.recordCustomMetric('performance_operation', {
        operation: metrics.operation,
        duration: metrics.duration,
        fileSize: metrics.fileSize || 0,
        cacheHit: metrics.cacheHit,
        compressionRatio: metrics.compressionRatio || 1,
        userId: metrics.userId,
        timestamp: metrics.timestamp
      });
    } catch (error) {
      console.error('Failed to record performance metrics:', error);
    }
  }
  
  private async checkPerformanceThresholds(metrics: PerformanceMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = [];
    
    // Check response time threshold
    if (metrics.duration > this.currentThresholds.maxResponseTime) {
      alerts.push({
        type: 'performance_degradation',
        severity: metrics.duration > this.currentThresholds.maxResponseTime * 2 ? 'critical' : 'high',
        message: `Response time exceeded threshold: ${metrics.duration}ms (threshold: ${this.currentThresholds.maxResponseTime}ms)`,
        currentValue: metrics.duration,
        threshold: this.currentThresholds.maxResponseTime,
        metadata: {
          operation: metrics.operation,
          fileSize: metrics.fileSize,
          userId: metrics.userId
        },
        timestamp: new Date()
      });
    }
    
    // Check cache performance (require recent data for context)
    const recentCacheHitRate = await this.getRecentCacheHitRate();
    if (recentCacheHitRate < this.currentThresholds.minCacheHitRate) {
      alerts.push({
        type: 'cache_performance_issue',
        severity: recentCacheHitRate < 0.5 ? 'high' : 'medium',
        message: `Cache hit rate below threshold: ${(recentCacheHitRate * 100).toFixed(1)}% (threshold: ${(this.currentThresholds.minCacheHitRate * 100).toFixed(1)}%)`,
        currentValue: recentCacheHitRate,
        threshold: this.currentThresholds.minCacheHitRate,
        metadata: {
          operation: metrics.operation,
          cacheHit: metrics.cacheHit
        },
        timestamp: new Date()
      });
    }
    
    // Check compression efficiency
    if (metrics.compressionRatio && (1 - metrics.compressionRatio) < this.currentThresholds.minCompressionRatio) {
      alerts.push({
        type: 'compression_issue',
        severity: 'low',
        message: `Compression efficiency below threshold: ${((1 - metrics.compressionRatio) * 100).toFixed(1)}% (threshold: ${(this.currentThresholds.minCompressionRatio * 100).toFixed(1)}%)`,
        currentValue: 1 - metrics.compressionRatio,
        threshold: this.currentThresholds.minCompressionRatio,
        metadata: {
          operation: metrics.operation,
          fileSize: metrics.fileSize,
          compressionRatio: metrics.compressionRatio
        },
        timestamp: new Date()
      });
    }
    
    // Trigger alerts
    for (const alert of alerts) {
      await this.triggerPerformanceAlert(alert);
    }
  }
  
  private async updatePerformanceBaselines(metrics: PerformanceMetrics): Promise<void> {
    try {
      // Update rolling averages and baselines
      const baselineKey = `baseline:${metrics.operation}`;
      const cachedBaseline = await this.cacheService.getCachedMetadata(baselineKey);
      
      const baseline = cachedBaseline || {
        avgDuration: metrics.duration,
        avgFileSize: metrics.fileSize || 0,
        cacheHitRate: metrics.cacheHit ? 1 : 0,
        sampleCount: 0
      };
      
      // Update baseline with exponential moving average
      const alpha = 0.1; // Smoothing factor
      baseline.avgDuration = baseline.avgDuration * (1 - alpha) + metrics.duration * alpha;
      baseline.avgFileSize = baseline.avgFileSize * (1 - alpha) + (metrics.fileSize || 0) * alpha;
      baseline.cacheHitRate = baseline.cacheHitRate * (1 - alpha) + (metrics.cacheHit ? 1 : 0) * alpha;
      baseline.sampleCount++;
      
      // Cache updated baseline
      await this.cacheService.cacheMetadata(baselineKey, baseline, 3600); // 1 hour TTL
      
    } catch (error) {
      console.error('Failed to update performance baselines:', error);
    }
  }
  
  private storeMetricsInMemory(metrics: PerformanceMetrics): void {
    const operationKey = metrics.operation;
    const operationMetrics = this.performanceData.get(operationKey) || [];
    
    operationMetrics.push(metrics);
    
    // Keep only last 1000 entries per operation
    if (operationMetrics.length > 1000) {
      operationMetrics.splice(0, operationMetrics.length - 1000);
    }
    
    this.performanceData.set(operationKey, operationMetrics);
  }
  
  private async getPerformanceMetrics(start: Date, end: Date): Promise<PerformanceMetrics[]> {
    try {
      // Get metrics from the metrics service
      const metricsData = await this.metricsService.getMetricsInRange('performance_operation', start, end);
      
      return metricsData.map(data => ({
        operation: String(data.operation),
        duration: Number(data.duration),
        fileSize: Number(data.fileSize),
        cacheHit: Boolean(data.cacheHit),
        compressionRatio: Number(data.compressionRatio),
        timestamp: String(data.timestamp),
        userId: String(data.userId)
      }));
      
    } catch (error) {
      console.error('Failed to retrieve performance metrics:', error);
      return [];
    }
  }
  
  private async getRecentMetrics(minutes: number): Promise<PerformanceMetrics[]> {
    const end = new Date();
    const start = new Date(end.getTime() - minutes * 60 * 1000);
    return this.getPerformanceMetrics(start, end);
  }
  
  private calculateSummaryStatistics(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        compressionEfficiency: 0,
        throughput: 0
      };
    }
    
    const totalOperations = metrics.length;
    const averageResponseTime = this.calculateAverage(metrics.map(m => m.duration));
    const cacheHitRate = this.calculateCacheHitRate(metrics);
    const compressionEfficiency = this.calculateCompressionEfficiency(metrics);
    const throughput = this.calculateThroughput(metrics);
    
    return {
      totalOperations,
      averageResponseTime,
      cacheHitRate,
      compressionEfficiency,
      throughput
    };
  }
  
  private async analyzeTrends(metrics: PerformanceMetrics[]): Promise<{
    responseTimetrend: TrendData;
    cacheHitTrend: TrendData;
    errorRateTrend: TrendData;
  }> {
    // Simple trend analysis - compare first half vs second half
    const halfPoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, halfPoint);
    const secondHalf = metrics.slice(halfPoint);
    
    const responseTimetrend = this.analyzeTrend(
      this.calculateAverage(firstHalf.map(m => m.duration)),
      this.calculateAverage(secondHalf.map(m => m.duration))
    );
    
    const cacheHitTrend = this.analyzeTrend(
      this.calculateCacheHitRate(firstHalf),
      this.calculateCacheHitRate(secondHalf)
    );
    
    const errorRateTrend = this.analyzeTrend(
      this.calculateErrorRate(firstHalf),
      this.calculateErrorRate(secondHalf)
    );
    
    return {
      responseTimetrend,
      cacheHitTrend,
      errorRateTrend
    };
  }
  
  private analyzeTrend(oldValue: number, newValue: number): TrendData {
    if (oldValue === 0) {
      return { direction: 'stable', percentage: 0, confidence: 0 };
    }
    
    const change = (newValue - oldValue) / oldValue;
    const percentage = Math.abs(change) * 100;
    
    let direction: 'improving' | 'degrading' | 'stable';
    if (Math.abs(change) < 0.05) { // Less than 5% change
      direction = 'stable';
    } else if (change > 0) {
      direction = 'degrading'; // Assuming higher values are worse for most metrics
    } else {
      direction = 'improving';
    }
    
    const confidence = Math.min(percentage / 50, 1); // Max confidence at 50% change
    
    return { direction, percentage, confidence };
  }
  
  private async generateOptimizationRecommendations(
    metrics: PerformanceMetrics[],
    summary: any
  ): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];
    
    // Response time recommendations
    if (summary.averageResponseTime > this.currentThresholds.maxResponseTime) {
      recommendations.push({
        type: 'response_time',
        priority: 'high',
        message: 'Consider implementing additional caching layers or optimizing database queries',
        details: `Average response time is ${summary.averageResponseTime.toFixed(0)}ms, which exceeds the ${this.currentThresholds.maxResponseTime}ms threshold`,
        estimatedImpact: '30-50% reduction in response time'
      });
    }
    
    // Cache hit rate recommendations
    if (summary.cacheHitRate < this.currentThresholds.minCacheHitRate) {
      recommendations.push({
        type: 'cache_optimization',
        priority: 'medium',
        message: 'Optimize caching strategy, increase TTL values, or implement cache warming',
        details: `Cache hit rate is ${(summary.cacheHitRate * 100).toFixed(1)}%, target is ${(this.currentThresholds.minCacheHitRate * 100).toFixed(1)}%`,
        estimatedImpact: '15-25% improvement in response time'
      });
    }
    
    // Compression recommendations
    if (summary.compressionEfficiency < this.currentThresholds.minCompressionRatio) {
      recommendations.push({
        type: 'compression',
        priority: 'low',
        message: 'Review compression algorithms, thresholds, and file type handling',
        details: `Compression efficiency is ${(summary.compressionEfficiency * 100).toFixed(1)}%, consider algorithm optimization`,
        estimatedImpact: '10-20% reduction in storage costs'
      });
    }
    
    // Database optimization recommendations
    const dbMetrics = metrics.filter(m => m.operation.includes('query') || m.operation.includes('database'));
    if (dbMetrics.length > 0) {
      const avgDbTime = this.calculateAverage(dbMetrics.map(m => m.duration));
      if (avgDbTime > 1000) { // > 1 second
        recommendations.push({
          type: 'database',
          priority: 'high',
          message: 'Database queries are slow - consider adding indexes or optimizing query structure',
          details: `Average database operation time is ${avgDbTime.toFixed(0)}ms`,
          estimatedImpact: '40-60% reduction in database query time'
        });
      }
    }
    
    // Network optimization recommendations
    const uploadMetrics = metrics.filter(m => m.operation === 'upload');
    if (uploadMetrics.length > 0) {
      const avgUploadTime = this.calculateAverage(uploadMetrics.map(m => m.duration));
      const avgFileSize = this.calculateAverage(uploadMetrics.map(m => m.fileSize || 0));
      
      if (avgFileSize > 0 && avgUploadTime / avgFileSize > 0.1) { // > 0.1ms per byte
        recommendations.push({
          type: 'network',
          priority: 'medium',
          message: 'Network transfer speeds are suboptimal - consider implementing streaming uploads or optimizing compression',
          details: `Upload performance is ${(avgUploadTime / avgFileSize).toFixed(3)}ms per byte`,
          estimatedImpact: '20-30% improvement in upload speeds'
        });
      }
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
  
  private async cachePerformanceReport(report: PerformanceReport): Promise<void> {
    try {
      const cacheKey = `performance_report:${report.period.start.toISOString()}:${report.period.end.toISOString()}`;
      await this.cacheService.cacheMetadata(cacheKey, report, 1800); // 30 minutes TTL
    } catch (error) {
      console.error('Failed to cache performance report:', error);
    }
  }
  
  private async triggerPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      await this.alertService.triggerAlert({
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        metadata: {
          ...alert.metadata,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          timestamp: alert.timestamp.toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to trigger performance alert:', error);
    }
  }
  
  private async getRecentCacheHitRate(): Promise<number> {
    const recentMetrics = await this.getRecentMetrics(15); // Last 15 minutes
    return this.calculateCacheHitRate(recentMetrics);
  }
  
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculateCacheHitRate(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    return cacheHits / metrics.length;
  }
  
  private calculateCompressionEfficiency(metrics: PerformanceMetrics[]): number {
    const compressedMetrics = metrics.filter(m => m.compressionRatio && m.compressionRatio < 1);
    if (compressedMetrics.length === 0) return 0;
    
    const avgCompressionRatio = compressedMetrics.reduce((sum, m) => sum + (m.compressionRatio || 1), 0) / compressedMetrics.length;
    return 1 - avgCompressionRatio; // Convert to efficiency (higher is better)
  }
  
  private calculateErrorRate(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    const errors = metrics.filter(m => m.errors && m.errors > 0).length;
    return errors / metrics.length;
  }
  
  private calculateThroughput(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    // Calculate operations per minute
    const timeSpan = new Date(metrics[metrics.length - 1].timestamp).getTime() - 
                    new Date(metrics[0].timestamp).getTime();
    const minutes = timeSpan / (1000 * 60);
    
    return minutes > 0 ? metrics.length / minutes : 0;
  }
  
  // Optimization action methods
  private async optimizeResponseTime(): Promise<void> {
    console.log('Triggering response time optimization...');
    // Implementation could include cache warming, query optimization, etc.
  }
  
  private async optimizeCachePerformance(): Promise<void> {
    console.log('Triggering cache performance optimization...');
    // Implementation could include cache warming, TTL adjustments, etc.
  }
  
  private async optimizeCompression(): Promise<void> {
    console.log('Triggering compression optimization...');
    // Implementation could include algorithm adjustments, threshold tuning, etc.
  }
  
  private async optimizeErrorHandling(): Promise<void> {
    console.log('Triggering error handling optimization...');
    // Implementation could include retry logic, fallback mechanisms, etc.
  }
  
  // Update thresholds dynamically
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.currentThresholds = { ...this.currentThresholds, ...newThresholds };
  }
  
  getThresholds(): PerformanceThresholds {
    return { ...this.currentThresholds };
  }
}