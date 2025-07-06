/**
 * Metrics Collection and Monitoring for Unified Workers
 * Implements comprehensive performance and business metrics tracking
 */

import type { Env } from '../types';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  unit?: 'ms' | 'count' | 'bytes' | 'percent' | 'rate';
}

export interface PerformanceMetrics {
  // Response time metrics
  responseTime: number;
  dbQueryTime: number;
  cacheHitRate: number;
  
  // Resource utilization
  memoryUsage: number;
  cpuTime: number;
  
  // Business metrics
  requestCount: number;
  errorCount: number;
  userCount: number;
  fileUploadCount: number;
  csvProcessingTime: number;
}

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    storage: HealthCheck;
    cache: HealthCheck;
    memory: HealthCheck;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class MetricsCollector {
  private metrics = new Map<string, MetricPoint[]>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private startTime = Date.now();

  constructor(
    private env: Env,
    private options: {
      maxMetricPoints?: number;
      flushInterval?: number;
      enableAnalytics?: boolean;
    } = {}
  ) {
    this.options.maxMetricPoints = options.maxMetricPoints || 1000;
    this.options.flushInterval = options.flushInterval || 60000; // 1 minute
    this.options.enableAnalytics = options.enableAnalytics !== false;

    // Start periodic flush if analytics is enabled
    if (this.options.enableAnalytics && this.env.ANALYTICS) {
      this.startPeriodicFlush();
    }
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    
    this.addMetricPoint({
      name,
      value: current + value,
      timestamp: Date.now(),
      tags,
      unit: 'count',
    });
  }

  /**
   * Set a gauge metric (current value)
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauges.set(name, value);
    
    this.addMetricPoint({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  /**
   * Record a timing metric
   */
  timing(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetricPoint({
      name,
      value,
      timestamp: Date.now(),
      tags,
      unit: 'ms',
    });

    // Also add to histogram for percentile calculations
    const histogram = this.histograms.get(name) || [];
    histogram.push(value);
    this.histograms.set(name, histogram);

    // Keep histogram size manageable
    if (histogram.length > 100) {
      histogram.splice(0, histogram.length - 100);
    }
  }

  /**
   * Measure execution time of a function
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.timing(name, duration, tags);
      this.increment(`${name}.success`, 1, tags);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.timing(name, duration, { ...tags, error: 'true' });
      this.increment(`${name}.error`, 1, tags);
      
      throw error;
    }
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const histogram = this.histograms.get(name) || [];
    histogram.push(value);
    this.histograms.set(name, histogram);

    this.addMetricPoint({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  /**
   * Get percentile from histogram
   */
  getPercentile(name: string, percentile: number): number | undefined {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.length === 0) {
      return undefined;
    }

    const sorted = [...histogram].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current metrics summary
   */
  getMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    percentiles: Record<string, { p50: number; p95: number; p99: number }>;
    uptime: number;
  } {
    const percentiles: Record<string, { p50: number; p95: number; p99: number }> = {};
    
    for (const [name] of this.histograms.entries()) {
      percentiles[name] = {
        p50: this.getPercentile(name, 50) || 0,
        p95: this.getPercentile(name, 95) || 0,
        p99: this.getPercentile(name, 99) || 0,
      };
    }

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      percentiles,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Perform comprehensive health check
   */
  async healthCheck(): Promise<HealthMetrics> {
    const checks = {
      database: await this.checkDatabase(),
      storage: await this.checkStorage(),
      cache: await this.checkCache(),
      memory: await this.checkMemory(),
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    const anyDegraded = Object.values(checks).some(check => check.status === 'degraded');

    const status = allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy';

    return {
      status,
      uptime: Date.now() - this.startTime,
      version: this.env.API_VERSION || 'unknown',
      environment: this.env.ENVIRONMENT || 'unknown',
      checks,
    };
  }

  /**
   * Middleware for automatic request metrics collection
   */
  middleware() {
    return async (
      request: Request,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const start = performance.now();
      const url = new URL(request.url);
      const route = this.normalizeRoute(url.pathname);
      
      // Track request start
      this.increment('requests.total');
      this.increment(`requests.${request.method.toLowerCase()}`);
      this.increment(`routes.${route}`);

      try {
        const response = await next();
        const duration = performance.now() - start;

        // Track successful response
        this.timing('request.duration', duration, {
          method: request.method,
          route,
          status: response.status.toString(),
        });

        this.increment('requests.success');
        this.increment(`response.${response.status}`);

        // Track response size if available
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          this.histogram('response.size', parseInt(contentLength), {
            route,
            method: request.method,
          });
        }

        return response;
      } catch (error) {
        const duration = performance.now() - start;
        
        this.timing('request.duration', duration, {
          method: request.method,
          route,
          error: 'true',
        });

        this.increment('requests.error');
        this.increment('errors.total');

        // Track error types
        if (error instanceof Error) {
          this.increment(`errors.${error.constructor.name}`, 1, {
            route,
            method: request.method,
          });
        }

        throw error;
      }
    };
  }

  /**
   * Create performance monitoring decorator
   */
  monitor(metricName: string, tags?: Record<string, string>) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        return await this.time(
          metricName || `${target.constructor.name}.${propertyKey}`,
          () => originalMethod.apply(this, args),
          tags
        );
      }.bind(this);

      return descriptor;
    };
  }

  /**
   * Flush metrics to Analytics Engine
   */
  async flush(): Promise<void> {
    if (!this.options.enableAnalytics || !this.env.ANALYTICS) {
      return;
    }

    try {
      const points = Array.from(this.metrics.values()).flat();
      
      if (points.length === 0) {
        return;
      }

      // Batch write to Analytics Engine
      const writes = points.map(point => ({
        blobs: [point.name],
        doubles: [point.value],
        indexes: [point.tags?.route || '', point.tags?.method || ''],
      }));

      await this.env.ANALYTICS.writeDataPoint(writes);

      // Clear flushed metrics
      this.metrics.clear();
      
      console.log(`Flushed ${points.length} metric points to Analytics Engine`);
    } catch (error) {
      console.error('Failed to flush metrics to Analytics Engine:', error);
    }
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(): Promise<{
    activeUsers: number;
    totalFiles: number;
    totalProcessingTime: number;
    errorRate: number;
    avgResponseTime: number;
  }> {
    // These would typically come from database queries
    const totalRequests = this.counters.get('requests.total') || 0;
    const totalErrors = this.counters.get('requests.error') || 0;
    const avgResponseTime = this.getPercentile('request.duration', 50) || 0;

    return {
      activeUsers: this.gauges.get('users.active') || 0,
      totalFiles: this.counters.get('files.uploaded') || 0,
      totalProcessingTime: this.counters.get('csv.processing.total_time') || 0,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      avgResponseTime,
    };
  }

  private addMetricPoint(point: MetricPoint): void {
    const points = this.metrics.get(point.name) || [];
    points.push(point);
    
    // Keep only recent points
    const maxPoints = this.options.maxMetricPoints || 1000;
    if (points.length > maxPoints) {
      points.splice(0, points.length - maxPoints);
    }
    
    this.metrics.set(point.name, points);
  }

  private normalizeRoute(pathname: string): string {
    // Normalize routes to remove IDs and make them groupable
    return pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/[^a-zA-Z0-9\/:_-]/g, '_');
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      await this.env.DB.prepare('SELECT 1').first();
      const latency = performance.now() - start;
      
      return {
        status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy',
        latency: Math.round(latency),
        lastCheck: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: 0,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkStorage(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      await this.env.FILE_STORAGE.head('health-check-non-existent');
      const latency = performance.now() - start;
      
      return {
        status: latency < 200 ? 'healthy' : latency < 1000 ? 'degraded' : 'unhealthy',
        latency: Math.round(latency),
        lastCheck: Date.now(),
      };
    } catch (error) {
      const latency = performance.now() - start;
      
      // R2 returns 404 for non-existent files, which is expected
      if (error instanceof Error && error.message.includes('404')) {
        return {
          status: latency < 200 ? 'healthy' : latency < 1000 ? 'degraded' : 'unhealthy',
          latency: Math.round(latency),
          lastCheck: Date.now(),
        };
      }
      
      return {
        status: 'unhealthy',
        latency: Math.round(latency),
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkCache(): Promise<HealthCheck> {
    const start = performance.now();
    
    try {
      await this.env.CACHE?.get('health-check');
      const latency = performance.now() - start;
      
      return {
        status: latency < 50 ? 'healthy' : latency < 200 ? 'degraded' : 'unhealthy',
        latency: Math.round(latency),
        lastCheck: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: 0,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Cache unavailable',
      };
    }
  }

  private checkMemory(): HealthCheck {
    try {
      // Workers don't expose direct memory usage, so we'll use proxy metrics
      const metricCount = this.metrics.size;
      const counterCount = this.counters.size;
      const totalMetrics = metricCount + counterCount;
      
      const status = totalMetrics < 500 ? 'healthy' : 
                    totalMetrics < 1000 ? 'degraded' : 'unhealthy';
      
      return {
        status,
        latency: 0,
        lastCheck: Date.now(),
        metadata: {
          metricCount,
          counterCount,
          totalMetrics,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: 0,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Memory check failed',
      };
    }
  }

  private startPeriodicFlush(): void {
    // Note: In Workers, we can't use setInterval, so this would need to be
    // triggered by external scheduled events or request-based timing
    console.log('Periodic flush would be configured via Cloudflare Cron Triggers');
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static metrics: MetricsCollector;

  static initialize(env: Env, options?: any): void {
    this.metrics = new MetricsCollector(env, options);
  }

  static getMetrics(): MetricsCollector {
    if (!this.metrics) {
      throw new Error('PerformanceMonitor not initialized');
    }
    return this.metrics;
  }

  /**
   * Monitor Core Web Vitals
   */
  static async measureCoreWebVitals(
    request: Request,
    response: Response
  ): Promise<void> {
    if (!this.metrics) return;

    // Server-side timing metrics
    const responseTime = response.headers.get('X-Response-Time');
    if (responseTime) {
      this.metrics.timing('core_web_vitals.server_response_time', parseInt(responseTime));
    }

    // Estimate LCP based on content size
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength);
      // Rough estimate: 1KB = 1ms on good connection
      const estimatedLCP = size / 1024;
      this.metrics.gauge('core_web_vitals.estimated_lcp', estimatedLCP);
    }
  }

  /**
   * Track business KPIs
   */
  static trackBusinessKPI(
    event: 'user_registered' | 'file_uploaded' | 'csv_processed' | 'user_login',
    metadata?: Record<string, string>
  ): void {
    if (!this.metrics) return;

    this.metrics.increment(`business.${event}`, 1, metadata);
    
    // Update business gauges
    switch (event) {
      case 'user_registered':
        const currentUsers = this.metrics.counters.get('business.user_registered') || 0;
        this.metrics.gauge('business.total_users', currentUsers);
        break;
      
      case 'file_uploaded':
        const currentFiles = this.metrics.counters.get('business.file_uploaded') || 0;
        this.metrics.gauge('business.total_files', currentFiles);
        break;
    }
  }
}