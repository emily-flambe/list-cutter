import type { Env } from '../../types';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'percent' | 'bytes';
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricAggregation {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  timestamp: number;
  labels: Record<string, string>;
}

export class MetricsCollector {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  /**
   * Record a performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    const minuteWindow = Math.floor(metric.timestamp / 60000); // 1-minute windows
    const key = `metric:${metric.name}:${minuteWindow}`;
    
    try {
      const existing = await this.env.AUTH_KV.get(key);
      const data = existing ? JSON.parse(existing) : { 
        values: [], 
        count: 0, 
        sum: 0,
        min: Infinity,
        max: -Infinity
      };
      
      // Add new value
      data.values.push(metric.value);
      data.count += 1;
      data.sum += metric.value;
      data.min = Math.min(data.min, metric.value);
      data.max = Math.max(data.max, metric.value);
      data.labels = metric.labels || {};
      data.unit = metric.unit;
      data.timestamp = metric.timestamp;
      
      // Keep only recent values to prevent excessive memory usage
      if (data.values.length > 1000) {
        data.values = data.values.slice(-1000);
      }
      
      await this.env.AUTH_KV.put(
        key,
        JSON.stringify(data),
        { expirationTtl: 3600 } // 1 hour
      );
      
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }
  
  /**
   * Record multiple metrics at once
   */
  async recordMetrics(metrics: PerformanceMetric[]): Promise<void> {
    await Promise.all(metrics.map(metric => this.recordMetric(metric)));
  }
  
  /**
   * Get metrics for a specific name over time
   */
  async getMetrics(name: string, minutes: number = 60): Promise<MetricAggregation[]> {
    const now = Date.now();
    const aggregations: MetricAggregation[] = [];
    
    for (let i = 0; i < minutes; i++) {
      const timestamp = now - (i * 60000);
      const minuteWindow = Math.floor(timestamp / 60000);
      const key = `metric:${name}:${minuteWindow}`;
      
      try {
        const data = await this.env.AUTH_KV.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const aggregation = this.calculateAggregation(name, parsed, timestamp);
          aggregations.push(aggregation);
        }
      } catch (error) {
        console.error(`Failed to get metrics for ${name}:`, error);
      }
    }
    
    return aggregations.reverse(); // Return in chronological order
  }
  
  /**
   * Get current performance summary
   */
  async getPerformanceSummary(): Promise<{
    response_times: MetricAggregation[];
    error_rates: MetricAggregation[];
    request_counts: MetricAggregation[];
    active_users: MetricAggregation[];
  }> {
    const [responseTimes, errorRates, requestCounts, activeUsers] = await Promise.all([
      this.getMetrics('response_time', 30),
      this.getMetrics('error_rate', 30),
      this.getMetrics('request_count', 30),
      this.getMetrics('active_users', 30)
    ]);
    
    return {
      response_times: responseTimes,
      error_rates: errorRates,
      request_counts: requestCounts,
      active_users: activeUsers
    };
  }
  
  /**
   * Record authentication performance metrics
   */
  async recordAuthMetrics(
    operation: 'login' | 'register' | 'refresh' | 'logout',
    duration: number,
    success: boolean,
    userId?: number
  ): Promise<void> {
    const timestamp = Date.now();
    const labels = { 
      operation, 
      success: success.toString(),
      ...(userId && { user_id: userId.toString() })
    };
    
    await this.recordMetrics([
      {
        name: 'auth_duration',
        value: duration,
        unit: 'ms',
        timestamp,
        labels
      },
      {
        name: 'auth_requests',
        value: 1,
        unit: 'count',
        timestamp,
        labels
      }
    ]);
    
    if (!success) {
      await this.recordMetric({
        name: 'auth_errors',
        value: 1,
        unit: 'count',
        timestamp,
        labels
      });
    }
  }
  
  /**
   * Record API request metrics
   */
  async recordAPIMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    userId?: number
  ): Promise<void> {
    const timestamp = Date.now();
    const success = statusCode < 400;
    const labels = {
      endpoint,
      method,
      status_code: statusCode.toString(),
      success: success.toString(),
      ...(userId && { user_id: userId.toString() })
    };
    
    await this.recordMetrics([
      {
        name: 'api_duration',
        value: duration,
        unit: 'ms',
        timestamp,
        labels
      },
      {
        name: 'api_requests',
        value: 1,
        unit: 'count',
        timestamp,
        labels
      }
    ]);
    
    if (!success) {
      await this.recordMetric({
        name: 'api_errors',
        value: 1,
        unit: 'count',
        timestamp,
        labels: { ...labels, error_type: this.getErrorType(statusCode) }
      });
    }
  }
  
  /**
   * Record system resource metrics
   */
  async recordSystemMetrics(memoryUsage?: number, cpuUsage?: number): Promise<void> {
    const timestamp = Date.now();
    const metrics: PerformanceMetric[] = [];
    
    if (memoryUsage !== undefined) {
      metrics.push({
        name: 'memory_usage',
        value: memoryUsage,
        unit: 'bytes',
        timestamp
      });
    }
    
    if (cpuUsage !== undefined) {
      metrics.push({
        name: 'cpu_usage',
        value: cpuUsage,
        unit: 'percent',
        timestamp
      });
    }
    
    if (metrics.length > 0) {
      await this.recordMetrics(metrics);
    }
  }
  
  /**
   * Track active users
   */
  async trackActiveUser(userId: number): Promise<void> {
    const hourWindow = Math.floor(Date.now() / 3600000); // 1-hour windows
    const key = `active_users:${hourWindow}`;
    
    try {
      const existing = await this.env.AUTH_KV.get(key);
      const userSet = existing ? new Set(JSON.parse(existing)) : new Set();
      
      userSet.add(userId);
      
      await this.env.AUTH_KV.put(
        key,
        JSON.stringify([...userSet]),
        { expirationTtl: 7200 } // 2 hours
      );
      
      // Record the active user count as a metric
      await this.recordMetric({
        name: 'active_users',
        value: userSet.size,
        unit: 'count',
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Failed to track active user:', error);
    }
  }
  
  /**
   * Get error rate for a time period
   */
  async getErrorRate(minutes: number = 60): Promise<number> {
    try {
      const [errors, requests] = await Promise.all([
        this.getMetrics('api_errors', minutes),
        this.getMetrics('api_requests', minutes)
      ]);
      
      const totalErrors = errors.reduce((sum, metric) => sum + metric.sum, 0);
      const totalRequests = requests.reduce((sum, metric) => sum + metric.sum, 0);
      
      return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
      
    } catch (error) {
      console.error('Failed to calculate error rate:', error);
      return 0;
    }
  }
  
  /**
   * Get average response time
   */
  async getAverageResponseTime(minutes: number = 60): Promise<number> {
    try {
      const metrics = await this.getMetrics('api_duration', minutes);
      
      if (metrics.length === 0) return 0;
      
      const totalDuration = metrics.reduce((sum, metric) => sum + metric.sum, 0);
      const totalRequests = metrics.reduce((sum, metric) => sum + metric.count, 0);
      
      return totalRequests > 0 ? totalDuration / totalRequests : 0;
      
    } catch (error) {
      console.error('Failed to calculate average response time:', error);
      return 0;
    }
  }
  
  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * Calculate aggregation statistics
   */
  private calculateAggregation(
    name: string, 
    data: any, 
    timestamp: number
  ): MetricAggregation {
    const values = data.values || [];
    const avg = data.count > 0 ? data.sum / data.count : 0;
    const p95 = this.calculatePercentile(values, 95);
    
    return {
      name,
      count: data.count || 0,
      sum: data.sum || 0,
      avg,
      min: data.min === Infinity ? 0 : data.min || 0,
      max: data.max === -Infinity ? 0 : data.max || 0,
      p95,
      timestamp,
      labels: data.labels || {}
    };
  }
  
  /**
   * Get error type from status code
   */
  private getErrorType(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    } else if (statusCode >= 500) {
      return 'server_error';
    }
    return 'unknown_error';
  }
}

/**
 * Performance monitoring middleware wrapper
 */
export function withMetrics<T>(
  name: string,
  metrics: MetricsCollector,
  labels?: Record<string, string>
) {
  return async (fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    let success = false;
    let error: Error | null = null;
    
    try {
      const result = await fn();
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error('Unknown error');
      throw err;
    } finally {
      const duration = Date.now() - start;
      
      await metrics.recordMetric({
        name: `${name}_duration`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        labels: { 
          ...labels, 
          success: success.toString(),
          ...(error && { error_type: error.constructor.name })
        }
      });
    }
  };
}

/**
 * Request timing middleware
 */
export class RequestTimer {
  private startTime: number;
  private metrics: MetricsCollector;
  
  constructor(metrics: MetricsCollector) {
    this.startTime = Date.now();
    this.metrics = metrics;
  }
  
  /**
   * Mark timing and record metrics
   */
  async finish(
    request: Request, 
    response: Response, 
    userId?: number
  ): Promise<void> {
    const duration = Date.now() - this.startTime;
    const url = new URL(request.url);
    
    await this.metrics.recordAPIMetrics(
      url.pathname,
      request.method,
      response.status,
      duration,
      userId
    );
  }
}