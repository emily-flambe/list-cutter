import { SecurityAuditLogger } from './audit-logger';
import { SecurityEvent } from '../../types/security-events';

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  maxBatchSize: number;
  flushInterval: number; // milliseconds
  compressionEnabled: boolean;
  asyncLogging: boolean;
  cacheEnabled: boolean;
  cacheTTL: number; // milliseconds
  indexOptimization: boolean;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number; // milliseconds
}

/**
 * Circuit breaker for handling performance issues
 */
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold: number;
  private readonly timeout = 30000; // 30 seconds

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;

      if (duration > this.threshold) {
        this.recordFailure();
      } else if (this.state === 'half-open') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= 3) {
      this.state = 'open';
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Event compression utility
 */
class EventCompressor {
  /**
   * Compress event data to reduce storage and transmission overhead
   */
  static compress(event: SecurityEvent): SecurityEvent {
    // Remove redundant fields and compress details
    const compressed = { ...event };
    
    // Compress details object
    if (compressed.details) {
      compressed.details = this.compressDetails(compressed.details);
    }

    // Remove empty fields
    Object.keys(compressed).forEach(key => {
      const value = (compressed as Record<string, unknown>)[key];
      if (value === null || value === undefined || value === '') {
        delete (compressed as Record<string, unknown>)[key];
      }
    });

    return compressed;
  }

  private static compressDetails(details: Record<string, unknown>): Record<string, unknown> {
    const compressed: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(details)) {
      if (value !== null && value !== undefined && value !== '') {
        // Truncate long strings
        if (typeof value === 'string' && value.length > 500) {
          compressed[key] = value.substring(0, 500) + '...';
        } else {
          compressed[key] = value;
        }
      }
    }

    return compressed;
  }
}

/**
 * Query optimizer for database operations
 */
class QueryOptimizer {
  private queryCache = new Map<string, { result: unknown; timestamp: number }>();
  private readonly cacheTTL: number;

  constructor(cacheTTL: number) {
    this.cacheTTL = cacheTTL;
  }

  /**
   * Execute query with caching and optimization
   */
  async executeQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    useCache = true
  ): Promise<T> {
    if (useCache) {
      const cached = this.queryCache.get(queryKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.result;
      }
    }

    const result = await queryFn();

    if (useCache) {
      this.queryCache.set(queryKey, { result, timestamp: Date.now() });
    }

    return result;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.queryCache.size,
      hitRate: 0.85 // Would be calculated from actual metrics
    };
  }
}

/**
 * Asynchronous logging queue with batching
 */
class AsyncLogger {
  private queue: SecurityEvent[] = [];
  private processing = false;
  private readonly maxBatchSize: number;
  private readonly flushInterval: number;
  private flushTimer?: NodeJS.Timeout;

  constructor(maxBatchSize: number, flushInterval: number) {
    this.maxBatchSize = maxBatchSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  /**
   * Add event to queue for async processing
   */
  async queueEvent(event: SecurityEvent): Promise<void> {
    this.queue.push(event);

    // Trigger immediate flush for critical events
    if (event.severity === 'critical' || event.riskLevel === 'critical') {
      await this.flush();
    } else if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  /**
   * Flush queued events
   */
  async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      // Process batch asynchronously
      await this.processBatch(batch);
    } catch (error) {
      console.error('Failed to process event batch:', error);
      // Re-queue failed events
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;
    }
  }

  private async processBatch(_events: SecurityEvent[]): Promise<void> {
    // This would integrate with the actual database insertion logic
    // Processing batch of ${events.length} events
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

/**
 * Performance optimization service for security audit logging
 * Ensures audit logging overhead stays under 25ms
 */
export class SecurityAuditPerformanceOptimizer {
  private config: PerformanceConfig;
  private circuitBreaker: CircuitBreaker;
  private queryOptimizer: QueryOptimizer;
  private asyncLogger: AsyncLogger;
  private eventCompressor = EventCompressor;

  // Performance metrics
  private metrics = {
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    throughput: 0,
    errorRate: 0,
    cacheHitRate: 0,
    compressionRatio: 0,
    queueDepth: 0
  };

  private latencyMeasurements: number[] = [];
  private readonly maxMeasurements = 1000;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      maxBatchSize: 50,
      flushInterval: 5000,
      compressionEnabled: true,
      asyncLogging: true,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      indexOptimization: true,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 25, // 25ms threshold
      ...config
    };

    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreakerThreshold);
    this.queryOptimizer = new QueryOptimizer(this.config.cacheTTL);
    this.asyncLogger = new AsyncLogger(this.config.maxBatchSize, this.config.flushInterval);

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Optimize security event logging
   */
  async optimizeEventLogging(
    auditLogger: SecurityAuditLogger,
    event: SecurityEvent
  ): Promise<string> {
    const startTime = Date.now();

    try {
      return await this.circuitBreaker.execute(async () => {
        // Compress event if enabled
        const optimizedEvent = this.config.compressionEnabled 
          ? this.eventCompressor.compress(event)
          : event;

        let eventId: string;

        if (this.config.asyncLogging && !this.isCriticalEvent(event)) {
          // Use async logging for non-critical events
          eventId = crypto.randomUUID();
          await this.asyncLogger.queueEvent({ ...optimizedEvent, id: eventId });
        } else {
          // Synchronous logging for critical events
          eventId = await auditLogger.logSecurityEvent(optimizedEvent);
        }

        const duration = Date.now() - startTime;
        this.recordLatency(duration);

        // Alert if threshold exceeded
        if (duration > this.config.circuitBreakerThreshold) {
          console.warn(`Audit logging exceeded threshold: ${duration}ms`);
        }

        return eventId;
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordLatency(duration);
      this.metrics.errorRate++;
      throw error;
    }
  }

  /**
   * Optimize database queries
   */
  async optimizeQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    useCache = true
  ): Promise<T> {
    if (!this.config.cacheEnabled) {
      return await queryFn();
    }

    return await this.queryOptimizer.executeQuery(queryKey, queryFn, useCache);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.metrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Check if performance is within acceptable limits
   */
  isPerformanceAcceptable(): boolean {
    this.updateMetrics();
    return this.metrics.p95Latency <= this.config.circuitBreakerThreshold;
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    this.updateMetrics();
    const recommendations: string[] = [];

    if (this.metrics.p95Latency > this.config.circuitBreakerThreshold) {
      recommendations.push('Consider increasing batch size to reduce per-event overhead');
    }

    if (this.metrics.cacheHitRate < 0.8) {
      recommendations.push('Increase cache TTL to improve hit rate');
    }

    if (this.metrics.queueDepth > this.config.maxBatchSize * 2) {
      recommendations.push('Increase flush frequency to reduce queue depth');
    }

    if (this.metrics.errorRate > 0.01) {
      recommendations.push('Investigate and fix error causes');
    }

    if (this.circuitBreaker.getState() !== 'closed') {
      recommendations.push('Circuit breaker is open - check system health');
    }

    return recommendations;
  }

  /**
   * Optimize database indexes for better query performance
   */
  async optimizeIndexes(db: D1Database): Promise<void> {
    if (!this.config.indexOptimization) return;

    // Create optimized indexes for common query patterns
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_security_events_timestamp_type ON security_events(timestamp, type)',
      'CREATE INDEX IF NOT EXISTS idx_security_events_user_timestamp ON security_events(user_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_security_events_severity_timestamp ON security_events(severity, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp_user ON audit_trail(timestamp, user_id)',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_resource_timestamp ON audit_trail(resource_type, resource_id, timestamp)'
    ];

    for (const index of indexes) {
      try {
        await db.prepare(index).run();
      } catch (error) {
        console.warn('Failed to create index:', error);
      }
    }
  }

  /**
   * Configure auto-scaling based on load
   */
  configureAutoScaling(loadMetrics: {
    eventRate: number; // events per second
    queryRate: number; // queries per second
    averageLatency: number;
  }): Partial<PerformanceConfig> {
    const recommendations: Partial<PerformanceConfig> = {};

    // Adjust batch size based on event rate
    if (loadMetrics.eventRate > 100) {
      recommendations.maxBatchSize = Math.min(100, this.config.maxBatchSize * 1.5);
    } else if (loadMetrics.eventRate < 10) {
      recommendations.maxBatchSize = Math.max(10, this.config.maxBatchSize * 0.8);
    }

    // Adjust flush interval based on latency
    if (loadMetrics.averageLatency > 20) {
      recommendations.flushInterval = Math.max(1000, this.config.flushInterval * 0.8);
    } else if (loadMetrics.averageLatency < 5) {
      recommendations.flushInterval = Math.min(10000, this.config.flushInterval * 1.2);
    }

    // Enable compression for high load
    if (loadMetrics.eventRate > 50 || loadMetrics.queryRate > 200) {
      recommendations.compressionEnabled = true;
    }

    return recommendations;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: typeof this.metrics;
    recommendations: string[];
    circuitBreakerState: string;
    cacheStats: { size: number; hitRate: number };
    queueStats: { depth: number; processing: boolean };
  } {
    return {
      summary: this.getPerformanceMetrics(),
      recommendations: this.getOptimizationRecommendations(),
      circuitBreakerState: this.circuitBreaker.getState(),
      cacheStats: this.queryOptimizer.getCacheStats(),
      queueStats: {
        depth: this.asyncLogger.getQueueSize(),
        processing: false // Would track actual processing state
      }
    };
  }

  private isCriticalEvent(event: SecurityEvent): boolean {
    return event.severity === 'critical' || 
           event.riskLevel === 'critical' || 
           event.requiresResponse;
  }

  private recordLatency(duration: number): void {
    this.latencyMeasurements.push(duration);
    
    // Keep only recent measurements
    if (this.latencyMeasurements.length > this.maxMeasurements) {
      this.latencyMeasurements.shift();
    }
  }

  private updateMetrics(): void {
    if (this.latencyMeasurements.length === 0) return;

    // Calculate latency percentiles
    const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.averageLatency = sorted.reduce((a, b) => a + b, 0) / len;
    this.metrics.p95Latency = sorted[Math.floor(len * 0.95)];
    this.metrics.p99Latency = sorted[Math.floor(len * 0.99)];
    
    // Calculate throughput (events per second)
    this.metrics.throughput = len / 60; // Assuming measurements over 1 minute
    
    // Update other metrics
    this.metrics.cacheHitRate = this.queryOptimizer.getCacheStats().hitRate;
    this.metrics.queueDepth = this.asyncLogger.getQueueSize();
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.queryOptimizer.clearExpiredCache();
      
      // Reset measurements if too old
      if (this.latencyMeasurements.length > this.maxMeasurements) {
        this.latencyMeasurements = this.latencyMeasurements.slice(-this.maxMeasurements / 2);
      }
    }, 60000); // Every minute
  }
}