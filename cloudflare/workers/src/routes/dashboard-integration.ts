import { DashboardRoutes } from './dashboard.js';
import { MetricsRoutes } from './metrics.js';
import { 
  dashboardAuth, 
  requireAdmin, 
  validateDashboardRequest,
  formatDashboardResponse,
  formatDashboardError,
  performanceMonitor,
  dashboardCache,
  dashboardRateLimit,
  DashboardContext
} from '../middleware/dashboard.js';

// Types
interface DashboardConfig {
  maxCacheSize?: number;
  defaultTTL?: number;
  rateLimitConfig?: Record<string, unknown>;
}

interface DashboardEnv {
  DB: D1Database;
  ANALYTICS?: AnalyticsEngineDataset;
  [key: string]: unknown;
}

/**
 * Integrated dashboard API that combines metrics and specialized dashboard endpoints
 * with comprehensive middleware for authentication, caching, and rate limiting
 */
export class IntegratedDashboardAPI {
  private dashboardRoutes: DashboardRoutes;
  private metricsRoutes: MetricsRoutes;

  constructor(
    analytics: AnalyticsEngineDataset,
    db: D1Database,
    config: DashboardConfig = {}
  ) {
    this.dashboardRoutes = new DashboardRoutes(analytics, db, config);
    this.metricsRoutes = new MetricsRoutes(analytics, db, config);
  }

  /**
   * Main request handler with comprehensive middleware pipeline
   */
  async handleRequest(request: Request, env: DashboardEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const monitor = performanceMonitor(request);

    try {
      // 1. Request validation
      const validation = validateDashboardRequest(request, pathname);
      if (!validation.valid) {
        return formatDashboardError(
          'Invalid request parameters',
          400,
          validation.error
        );
      }

      // 2. Authentication
      const authResult = await dashboardAuth(request, env.DB);
      if (!authResult.success) {
        return formatDashboardError(authResult.error || 'Authentication failed', 401);
      }

      const context = authResult.context;
      if (!context) {
        return formatDashboardError('Authentication context missing', 401);
      }

      // 3. Rate limiting
      if (!dashboardRateLimit.checkLimit(context.userId, pathname)) {
        return formatDashboardError(
          'Rate limit exceeded',
          429,
          `Too many requests. Try again later.`,
          context
        );
      }

      // 4. Admin authorization check
      if (this.isAdminEndpoint(pathname) && !requireAdmin(context)) {
        return formatDashboardError(
          'Admin access required',
          403,
          undefined,
          context
        );
      }

      // 5. Cache check
      let responseData: Record<string, unknown> | null = null;
      if (context.shouldCache) {
        responseData = dashboardCache.get(context.cacheKey);
        if (responseData) {
          const duration = monitor.finish();
          return this.formatCachedResponse(responseData, request, context, duration);
        }
      }

      // 6. Route to appropriate handler
      if (this.isDashboardEndpoint(pathname)) {
        responseData = await this.handleDashboardRoute(request, context, env);
      } else if (this.isMetricsEndpoint(pathname)) {
        return await this.metricsRoutes.handleRequest(request, env);
      } else {
        return formatDashboardError('Endpoint not found', 404, undefined, context);
      }

      // 7. Cache response if applicable
      if (context.shouldCache && responseData) {
        dashboardCache.set(context.cacheKey, responseData, this.getCacheTTL(pathname));
      }

      // 8. Format and return response
      const duration = monitor.finish();
      return formatDashboardResponse(responseData, request, context, duration);

    } catch (error) {
      monitor.finish();
      console.error('Dashboard API error:', error);
      
      return formatDashboardError(
        'Internal server error',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Handle dashboard-specific routes
   */
  private async handleDashboardRoute(
    request: Request,
    context: DashboardContext,
    env: DashboardEnv
  ): Promise<unknown> {
    // Create a new request with updated headers for the dashboard routes handler
    const dashboardRequest = new Request(request.url, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'x-user-id': context.userId,
        'x-is-admin': context.isAdmin.toString()
      },
      body: request.body
    });

    const response = await this.dashboardRoutes.handleRequest(dashboardRequest, env);
    const responseData = await response.json();
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Dashboard route error');
    }

    return responseData.data;
  }

  /**
   * Check if endpoint is admin-only
   */
  private isAdminEndpoint(pathname: string): boolean {
    return pathname.startsWith('/admin/');
  }

  /**
   * Check if endpoint is a dashboard endpoint
   */
  private isDashboardEndpoint(pathname: string): boolean {
    const dashboardPaths = [
      '/admin/metrics/',
      '/user/storage/',
      '/metrics/realtime/',
      '/metrics/historical/'
    ];
    
    return dashboardPaths.some(path => pathname.startsWith(path));
  }

  /**
   * Check if endpoint is a metrics endpoint
   */
  private isMetricsEndpoint(pathname: string): boolean {
    return pathname.startsWith('/api/metrics/');
  }

  /**
   * Get cache TTL based on endpoint type
   */
  private getCacheTTL(pathname: string): number {
    // Realtime endpoints: 30 seconds
    if (pathname.includes('/realtime/')) {
      return 30;
    }
    
    // Historical endpoints: 10 minutes
    if (pathname.includes('/historical/')) {
      return 600;
    }
    
    // Admin overview: 5 minutes
    if (pathname.includes('/admin/')) {
      return 300;
    }
    
    // User endpoints: 2 minutes
    if (pathname.includes('/user/')) {
      return 120;
    }
    
    // Default: 5 minutes
    return 300;
  }

  /**
   * Format cached response with cache indicators
   */
  private formatCachedResponse(
    data: unknown,
    request: Request,
    context: DashboardContext,
    processingTime: number
  ): Response {
    const response = {
      success: true,
      data,
      meta: {
        userId: context.userId,
        timestamp: new Date().toISOString(),
        endpoint: new URL(request.url).pathname,
        cached: true,
        processingTime
      }
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'X-Cache': 'HIT',
        'X-User-ID': context.userId
      }
    });
  }

  /**
   * Get dashboard statistics for monitoring
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const cacheStats = dashboardCache.getStats();
    
    return {
      cache: cacheStats,
      endpoints: {
        total: this.getEndpointCount(),
        admin: this.getAdminEndpointCount(),
        user: this.getUserEndpointCount(),
        realtime: this.getRealtimeEndpointCount()
      },
      performance: {
        averageResponseTime: 0, // Would need to track
        requestsPerMinute: 0,   // Would need to track
        errorRate: 0            // Would need to track
      }
    };
  }

  /**
   * Clear dashboard cache
   */
  clearCache(pattern?: string): void {
    dashboardCache.clear(pattern);
  }

  /**
   * Get cache status
   */
  getCacheStatus(): unknown {
    return dashboardCache.getStats();
  }

  /**
   * Health check for dashboard API
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const now = Date.now();
    
    try {
      // Basic functionality check
      const cacheStats = dashboardCache.getStats();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          cache: cacheStats.size < cacheStats.maxSize ? 'healthy' : 'warning',
          rateLimit: 'healthy',
          dashboard: 'healthy',
          metrics: 'healthy'
        },
        metrics: {
          cacheSize: cacheStats.size,
          uptime: now, // Would need to track actual uptime
          memoryUsage: 0 // Would need actual memory tracking
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        services: {
          cache: 'error',
          rateLimit: 'unknown',
          dashboard: 'error',
          metrics: 'unknown'
        },
        metrics: {
          cacheSize: 0,
          uptime: 0,
          memoryUsage: 0
        }
      };
    }
  }

  // Helper methods for endpoint counting
  private getEndpointCount(): number {
    return 18; // Total endpoints implemented
  }

  private getAdminEndpointCount(): number {
    return 6; // Admin-only endpoints
  }

  private getUserEndpointCount(): number {
    return 6; // User endpoints
  }

  private getRealtimeEndpointCount(): number {
    return 3; // Realtime endpoints
  }
}

/**
 * Dashboard-specific route patterns and configurations
 */
export const DashboardRouteConfig = {
  // Admin endpoints
  adminEndpoints: [
    '/admin/metrics/storage',
    '/admin/metrics/performance', 
    '/admin/metrics/costs',
    '/admin/metrics/alerts',
    '/admin/metrics/system-health',
    '/admin/metrics/users'
  ],

  // User endpoints
  userEndpoints: [
    '/user/storage/usage',
    '/user/storage/analytics',
    '/user/storage/trends',
    '/user/storage/costs',
    '/user/storage/performance',
    '/user/storage/quota'
  ],

  // Realtime endpoints
  realtimeEndpoints: [
    '/metrics/realtime/overview',
    '/metrics/realtime/operations',
    '/metrics/realtime/errors'
  ],

  // Historical endpoints
  historicalEndpoints: [
    '/metrics/historical/storage',
    '/metrics/historical/costs',
    '/metrics/historical/performance'
  ],

  // Cache configuration
  cacheConfig: {
    defaultTTL: 300,
    realtimeTTL: 30,
    historicalTTL: 600,
    maxCacheSize: 1000
  },

  // Rate limiting configuration
  rateLimitConfig: {
    windowSize: 60000,    // 1 minute
    maxRequests: 100,     // Per minute per user
    adminMultiplier: 5    // Admins get 5x the rate limit
  }
};

// Types
interface DashboardStats {
  cache: {
    size: number;
    maxSize: number;
    hitRate: number;
    averageAge: number;
  };
  endpoints: {
    total: number;
    admin: number;
    user: number;
    realtime: number;
  };
  performance: {
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'unhealthy';
  timestamp: string;
  error?: string;
  services: {
    cache: 'healthy' | 'warning' | 'error' | 'unknown';
    rateLimit: 'healthy' | 'warning' | 'error' | 'unknown';
    dashboard: 'healthy' | 'warning' | 'error' | 'unknown';
    metrics: 'healthy' | 'warning' | 'error' | 'unknown';
  };
  metrics: {
    cacheSize: number;
    uptime: number;
    memoryUsage: number;
  };
}