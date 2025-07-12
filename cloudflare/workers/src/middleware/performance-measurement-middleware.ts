// Performance Measurement Middleware - Performance Optimization Issue #69
// Comprehensive request/response timing and performance analytics

import { Context, Next } from 'hono';
import { PerformanceMetrics } from '../types/cache';

export interface PerformanceMeasurementOptions {
  enableDetailedTiming?: boolean;
  enableMemoryTracking?: boolean;
  enableDatabaseTiming?: boolean;
  enableCacheTiming?: boolean;
  sampleRate?: number; // 0.0 to 1.0
  slowRequestThreshold?: number; // milliseconds
  metricsService?: any;
  onSlowRequest?: (metrics: PerformanceMetrics) => void;
  enableRealUserMonitoring?: boolean;
}

export interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  userAgent?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // Timing breakdowns
  timings: {
    dns?: number;
    tcp?: number;
    tls?: number;
    request?: number;
    response?: number;
    processing?: number;
    total?: number;
  };
  
  // Resource usage
  resources: {
    memoryUsed?: number;
    cpuTime?: number;
    databaseQueries?: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
  
  // Response info
  response: {
    status?: number;
    size?: number;
    cached?: boolean;
    compressed?: boolean;
  };
  
  // Performance marks
  marks: Array<{
    name: string;
    timestamp: number;
    duration?: number;
  }>;
  
  // User context
  user?: {
    id?: string;
    region?: string;
    connection?: string;
  };
}

export class PerformanceMeasurementMiddleware {
  private readonly options: Required<PerformanceMeasurementOptions>;
  private activeRequests = new Map<string, RequestMetrics>();
  private performanceBuffer: RequestMetrics[] = [];
  private readonly maxBufferSize = 1000;

  constructor(options: PerformanceMeasurementOptions = {}) {
    this.options = {
      enableDetailedTiming: true,
      enableMemoryTracking: true,
      enableDatabaseTiming: true,
      enableCacheTiming: true,
      sampleRate: 1.0, // Sample all requests by default
      slowRequestThreshold: 2000, // 2 seconds
      metricsService: null,
      onSlowRequest: () => {},
      enableRealUserMonitoring: true,
      ...options
    };
  }

  // Main performance measurement middleware
  middleware() {
    return async (c: Context, next: Next) => {
      // Sample requests based on configured rate
      if (Math.random() > this.options.sampleRate) {
        await next();
        return;
      }

      const requestId = this.generateRequestId();
      const startTime = performance.now();
      
      // Initialize request metrics
      const metrics: RequestMetrics = {
        requestId,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        userAgent: c.req.header('User-Agent'),
        startTime,
        timings: {},
        resources: {},
        response: {},
        marks: [],
        user: this.extractUserContext(c)
      };

      // Store active request
      this.activeRequests.set(requestId, metrics);
      
      // Add request ID to context for use in other middleware
      c.set('requestId', requestId);
      c.set('performanceMetrics', metrics);

      try {
        // Mark processing start
        this.addPerformanceMark(requestId, 'processing_start');
        
        // Track memory usage before processing
        if (this.options.enableMemoryTracking) {
          metrics.resources.memoryUsed = this.getMemoryUsage();
        }

        // Execute the request
        await next();

        // Mark processing end
        this.addPerformanceMark(requestId, 'processing_end');
        
        // Complete metrics collection
        await this.completeMetrics(requestId, c);

      } catch (error) {
        // Record error metrics
        this.addPerformanceMark(requestId, 'error_occurred');
        metrics.response.status = 500;
        
        // Still complete metrics collection for error analysis
        await this.completeMetrics(requestId, c);
        
        throw error; // Re-throw the error
      }
    };
  }

  // Database timing middleware
  databaseTimingMiddleware() {
    return async (c: Context, next: Next) => {
      if (!this.options.enableDatabaseTiming) {
        await next();
        return;
      }

      const requestId = c.get('requestId');
      if (!requestId) {
        await next();
        return;
      }

      const dbStartTime = performance.now();
      let queryCount = 0;

      // Wrap database operations (this would integrate with your DB service)
      const originalNext = next;
      const wrappedNext = async () => {
        // This is where you'd wrap your database calls
        // For now, we'll just track that DB operations occurred
        const startMark = performance.now();
        await originalNext();
        const endMark = performance.now();
        
        queryCount++; // This would be incremented by actual DB wrapper
        
        const metrics = this.activeRequests.get(requestId);
        if (metrics) {
          metrics.resources.databaseQueries = (metrics.resources.databaseQueries || 0) + queryCount;
          metrics.timings.request = endMark - startMark;
        }
      };

      this.addPerformanceMark(requestId, 'database_start');
      await wrappedNext();
      this.addPerformanceMark(requestId, 'database_end');
    };
  }

  // Cache timing middleware
  cacheTimingMiddleware() {
    return async (c: Context, next: Next) => {
      if (!this.options.enableCacheTiming) {
        await next();
        return;
      }

      const requestId = c.get('requestId');
      if (!requestId) {
        await next();
        return;
      }

      this.addPerformanceMark(requestId, 'cache_check_start');
      
      // Track cache operations
      const metrics = this.activeRequests.get(requestId);
      if (metrics) {
        // This would be set by cache middleware
        const cacheResult = c.get('cacheResult');
        if (cacheResult === 'hit') {
          metrics.resources.cacheHits = (metrics.resources.cacheHits || 0) + 1;
          metrics.response.cached = true;
        } else if (cacheResult === 'miss') {
          metrics.resources.cacheMisses = (metrics.resources.cacheMisses || 0) + 1;
        }
      }

      await next();
      
      this.addPerformanceMark(requestId, 'cache_check_end');
    };
  }

  // Real User Monitoring (RUM) middleware
  rumMiddleware() {
    return async (c: Context, next: Next) => {
      if (!this.options.enableRealUserMonitoring) {
        await next();
        return;
      }

      // Extract RUM data from headers (sent by client-side monitoring)
      const rumData = this.extractRUMData(c.req);
      
      if (rumData) {
        const requestId = c.get('requestId');
        const metrics = this.activeRequests.get(requestId);
        
        if (metrics) {
          // Merge client-side timing with server-side metrics
          metrics.timings.dns = rumData.dns;
          metrics.timings.tcp = rumData.tcp;
          metrics.timings.tls = rumData.tls;
          metrics.user.connection = rumData.connection;
        }
      }

      await next();
    };
  }

  // Add a performance mark for detailed timing analysis
  addPerformanceMark(requestId: string, markName: string): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    const timestamp = performance.now();
    const mark = {
      name: markName,
      timestamp,
      duration: undefined as number | undefined
    };

    // Calculate duration from previous mark
    if (metrics.marks.length > 0) {
      const previousMark = metrics.marks[metrics.marks.length - 1];
      mark.duration = timestamp - previousMark.timestamp;
    }

    metrics.marks.push(mark);
  }

  // Public method for custom timing
  markEvent(requestId: string, eventName: string, data?: any): void {
    this.addPerformanceMark(requestId, eventName);
    
    // Optionally store additional data
    if (data) {
      const metrics = this.activeRequests.get(requestId);
      if (metrics) {
        if (!metrics.marks[metrics.marks.length - 1]) return;
        (metrics.marks[metrics.marks.length - 1] as any).data = data;
      }
    }
  }

  private async completeMetrics(requestId: string, c: Context): Promise<void> {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    const endTime = performance.now();
    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;

    // Complete response metrics
    metrics.response.status = c.res.status;
    metrics.response.size = this.getResponseSize(c.res);
    metrics.response.compressed = this.isResponseCompressed(c.res);

    // Calculate timing breakdown
    this.calculateTimingBreakdown(metrics);

    // Check for slow requests
    if (metrics.duration > this.options.slowRequestThreshold) {
      await this.handleSlowRequest(metrics);
    }

    // Buffer metrics for batch processing
    this.bufferMetrics(metrics);

    // Send to metrics service if available
    if (this.options.metricsService) {
      await this.sendMetricsToService(metrics);
    }

    // Clean up
    this.activeRequests.delete(requestId);
  }

  private calculateTimingBreakdown(metrics: RequestMetrics): void {
    const marks = metrics.marks;
    
    // Processing time
    const processingStart = marks.find(m => m.name === 'processing_start');
    const processingEnd = marks.find(m => m.name === 'processing_end');
    if (processingStart && processingEnd) {
      metrics.timings.processing = processingEnd.timestamp - processingStart.timestamp;
    }

    // Database time
    const dbStart = marks.find(m => m.name === 'database_start');
    const dbEnd = marks.find(m => m.name === 'database_end');
    if (dbStart && dbEnd) {
      metrics.timings.request = dbEnd.timestamp - dbStart.timestamp;
    }

    // Total time
    metrics.timings.total = metrics.duration;
  }

  private async handleSlowRequest(metrics: RequestMetrics): Promise<void> {
    console.warn(`Slow request detected: ${metrics.method} ${metrics.path} - ${metrics.duration}ms`);
    
    // Call custom handler if provided
    if (this.options.onSlowRequest) {
      try {
        this.options.onSlowRequest(this.convertToPerformanceMetrics(metrics));
      } catch (error) {
        console.error('Error in slow request handler:', error);
      }
    }

    // Generate detailed performance report for slow requests
    const report = this.generateDetailedReport(metrics);
    console.log('Slow request details:', report);
  }

  private bufferMetrics(metrics: RequestMetrics): void {
    this.performanceBuffer.push(metrics);
    
    // Keep buffer size manageable
    if (this.performanceBuffer.length > this.maxBufferSize) {
      this.performanceBuffer.shift(); // Remove oldest metrics
    }
  }

  private async sendMetricsToService(metrics: RequestMetrics): Promise<void> {
    try {
      const performanceMetrics = this.convertToPerformanceMetrics(metrics);
      await this.options.metricsService.recordPerformanceMetrics(performanceMetrics);
    } catch (error) {
      console.error('Failed to send metrics to service:', error);
    }
  }

  private convertToPerformanceMetrics(metrics: RequestMetrics): PerformanceMetrics {
    return {
      operation: `${metrics.method} ${metrics.path}`,
      duration: metrics.duration || 0,
      cacheHit: metrics.response.cached || false,
      timestamp: new Date(Date.now() - (metrics.duration || 0)).toISOString(),
      userId: metrics.user?.id
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUserContext(c: Context): RequestMetrics['user'] {
    return {
      id: c.req.header('X-User-ID'),
      region: c.req.header('CF-IPCountry'),
      connection: c.req.header('CF-RAY')
    };
  }

  private extractRUMData(request: Request): any {
    const rumHeader = request.headers.get('X-RUM-Data');
    if (!rumHeader) return null;

    try {
      return JSON.parse(rumHeader);
    } catch {
      return null;
    }
  }

  private getMemoryUsage(): number {
    // In a real Cloudflare Worker, memory usage is limited and not directly accessible
    // This is a placeholder for memory tracking
    return 0;
  }

  private getResponseSize(response: Response): number {
    const contentLength = response.headers.get('Content-Length');
    return contentLength ? parseInt(contentLength) : 0;
  }

  private isResponseCompressed(response: Response): boolean {
    const encoding = response.headers.get('Content-Encoding');
    return !!(encoding && (encoding.includes('gzip') || encoding.includes('br')));
  }

  private generateDetailedReport(metrics: RequestMetrics): any {
    return {
      summary: {
        requestId: metrics.requestId,
        method: metrics.method,
        path: metrics.path,
        duration: metrics.duration,
        status: metrics.response.status
      },
      timingBreakdown: metrics.timings,
      resourceUsage: metrics.resources,
      performanceMarks: metrics.marks,
      userContext: metrics.user
    };
  }

  // Public methods for monitoring and analysis
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  getBufferedMetrics(): RequestMetrics[] {
    return [...this.performanceBuffer];
  }

  getSlowRequests(threshold?: number): RequestMetrics[] {
    const slowThreshold = threshold || this.options.slowRequestThreshold;
    return this.performanceBuffer.filter(m => (m.duration || 0) > slowThreshold);
  }

  getAverageResponseTime(minutes?: number): number {
    const cutoff = minutes ? Date.now() - (minutes * 60 * 1000) : 0;
    const recentMetrics = this.performanceBuffer.filter(m => 
      m.startTime > cutoff && m.duration !== undefined
    );
    
    if (recentMetrics.length === 0) return 0;
    
    const totalTime = recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    return totalTime / recentMetrics.length;
  }

  getCacheHitRate(minutes?: number): number {
    const cutoff = minutes ? Date.now() - (minutes * 60 * 1000) : 0;
    const recentMetrics = this.performanceBuffer.filter(m => m.startTime > cutoff);
    
    if (recentMetrics.length === 0) return 0;
    
    const cacheHits = recentMetrics.filter(m => m.response.cached).length;
    return cacheHits / recentMetrics.length;
  }

  getPerformanceSummary(): any {
    const now = Date.now();
    const last5Minutes = now - (5 * 60 * 1000);
    const last1Hour = now - (60 * 60 * 1000);

    return {
      activeRequests: this.getActiveRequestCount(),
      averageResponseTime: {
        last5Minutes: this.getAverageResponseTime(5),
        lastHour: this.getAverageResponseTime(60)
      },
      cacheHitRate: {
        last5Minutes: this.getCacheHitRate(5),
        lastHour: this.getCacheHitRate(60)
      },
      slowRequestCount: {
        last5Minutes: this.getSlowRequests().filter(m => 
          m.startTime > last5Minutes
        ).length,
        lastHour: this.getSlowRequests().filter(m => 
          m.startTime > last1Hour
        ).length
      },
      totalRequestsTracked: this.performanceBuffer.length
    };
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.activeRequests.clear();
    this.performanceBuffer.length = 0;
  }
}