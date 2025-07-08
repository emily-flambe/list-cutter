import { EnhancedMetricsService } from '../services/monitoring/enhanced-metrics-service.js';
import { authenticateRequest } from '../middleware/auth.js';

/**
 * Metrics API routes for storage monitoring and cost tracking
 */
export class MetricsRoutes {
  private metricsService: EnhancedMetricsService;

  constructor(
    analytics: AnalyticsEngineDataset,
    db: D1Database,
    config: Record<string, unknown> = {}
  ) {
    this.metricsService = new EnhancedMetricsService(analytics, db, config);
  }

  /**
   * Handle metrics-related API requests
   */
  async handleRequest(request: Request, env: Record<string, unknown>): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    try {
      // Authenticate request
      const authResult = await authenticateRequest(request, env.DB as D1Database);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = authResult.user?.id ?? '';
      const isAdmin = authResult.user?.is_admin ?? false;

      // Route handling
      if (pathname === '/api/metrics/dashboard' && method === 'GET') {
        return await this.getUserDashboard(userId);
      }

      if (pathname === '/api/metrics/admin/dashboard' && method === 'GET') {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await this.getAdminDashboard();
      }

      if (pathname === '/api/metrics/history' && method === 'GET') {
        return await this.getStorageHistory(request, userId);
      }

      if (pathname === '/api/metrics/costs' && method === 'GET') {
        return await this.getCostBreakdown(request, userId);
      }

      if (pathname === '/api/metrics/estimate' && method === 'POST') {
        return await this.estimateOperationCost(request, userId);
      }

      if (pathname === '/api/metrics/errors' && method === 'GET') {
        return await this.getErrorAnalytics(request, userId, isAdmin);
      }

      if (pathname === '/api/metrics/performance' && method === 'GET') {
        return await this.getPerformanceMetrics(request, userId, isAdmin);
      }

      if (pathname === '/api/metrics/quota' && method === 'GET') {
        return await this.getQuotaStatus(userId);
      }

      if (pathname === '/api/metrics/quota' && method === 'PUT') {
        return await this.updateQuota(request, userId, isAdmin);
      }

      if (pathname.startsWith('/api/metrics/admin/') && method === 'GET') {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await this.handleAdminEndpoints(request, pathname);
      }

      if (pathname === '/api/metrics/aggregation' && method === 'POST') {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await this.triggerAggregation(request);
      }

      if (pathname === '/api/metrics/cache' && method === 'DELETE') {
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await this.clearCache(request);
      }

      // Scheduled job endpoints (no auth required - handled by Cloudflare)
      if (pathname.startsWith('/api/metrics/jobs/') && method === 'POST') {
        const jobType = pathname.split('/').pop();
        return await this.metricsService.handleScheduledJob(jobType ?? '', request);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Metrics API error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get user dashboard data
   */
  private async getUserDashboard(userId: string): Promise<Response> {
    const dashboard = await this.metricsService.getUserDashboard(userId);
    
    return new Response(JSON.stringify({
      success: true,
      data: dashboard
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get admin dashboard data
   */
  private async getAdminDashboard(): Promise<Response> {
    const dashboard = await this.metricsService.getAdminDashboard();
    
    return new Response(JSON.stringify({
      success: true,
      data: dashboard
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get storage history
   */
  private async getStorageHistory(request: Request, userId: string): Promise<Response> {
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get('timeRange') as string) ?? '30days';
    const aggregationLevel = (url.searchParams.get('aggregation') as string) ?? 'daily';
    
    const history = await this.metricsService.queryService.getUserStorageHistory(
      userId,
      timeRange,
      aggregationLevel
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: history
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get cost breakdown
   */
  private async getCostBreakdown(request: Request, userId: string): Promise<Response> {
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get('timeRange') as string) ?? '30days';
    
    const costs = await this.metricsService.queryService.getUserCostBreakdown(
      userId,
      timeRange
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: costs
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Estimate operation cost
   */
  private async estimateOperationCost(request: Request, userId: string): Promise<Response> {
    const body = await request.json();
    
    const {
      operation,
      fileSize,
      storageClass = 'Standard'
    } = body;

    if (!operation || fileSize === undefined) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: operation, fileSize'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const estimation = await this.metricsService.estimateOperationCost(
      userId,
      operation,
      fileSize,
      storageClass
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: estimation
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get error analytics
   */
  private async getErrorAnalytics(
    request: Request,
    userId: string,
    isAdmin: boolean
  ): Promise<Response> {
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get('timeRange') as string) ?? '7days';
    const targetUserId = isAdmin ? (url.searchParams.get('userId') ?? userId) : userId;
    
    const errors = await this.metricsService.queryService.getErrorAnalytics(
      targetUserId,
      timeRange
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: errors
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(
    request: Request,
    userId: string,
    isAdmin: boolean
  ): Promise<Response> {
    const url = new URL(request.url);
    const timeRange = (url.searchParams.get('timeRange') as string) ?? '7days';
    const targetUserId = isAdmin ? (url.searchParams.get('userId') ?? userId) : userId;
    
    const performance = await this.metricsService.queryService.getPerformanceMetrics(
      targetUserId,
      timeRange
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: performance
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get quota status
   */
  private async getQuotaStatus(userId: string): Promise<Response> {
    const overview = await this.metricsService.queryService.getUserStorageOverview(userId);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        storage: overview.storage,
        quota: overview.quota,
        costs: overview.costs
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Update user quota
   */
  private async updateQuota(
    request: Request,
    userId: string,
    isAdmin: boolean
  ): Promise<Response> {
    const body = await request.json();
    const targetUserId = isAdmin ? (body.userId ?? userId) : userId;
    
    // Only admins can update other users' quotas or sensitive settings
    if (!isAdmin && (body.userId || body.quotaType || body.maxMonthlyCost)) {
      return new Response(JSON.stringify({
        error: 'Admin access required for this operation'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await this.metricsService.updateUserQuota(targetUserId, body);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Quota updated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle admin-specific endpoints
   */
  private async handleAdminEndpoints(request: Request, pathname: string): Promise<Response> {
    const segments = pathname.split('/');
    const endpoint = segments[segments.length - 1];
    
    switch (endpoint) {
      case 'system-overview': {
        const overview = await this.metricsService.queryService.getSystemMetricsOverview();
        return new Response(JSON.stringify({ success: true, data: overview }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
        
      case 'job-statistics': {
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') ?? '30');
        const stats = await this.metricsService.scheduler.getJobStatistics(days);
        return new Response(JSON.stringify({ success: true, data: stats }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
        
      case 'job-history': {
        const urlHistory = new URL(request.url);
        const jobType = urlHistory.searchParams.get('jobType');
        const limit = parseInt(urlHistory.searchParams.get('limit') ?? '100');
        const history = await this.metricsService.scheduler.getJobHistory(jobType ?? undefined, limit);
        return new Response(JSON.stringify({ success: true, data: history }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
        
      default:
        return new Response(JSON.stringify({ error: 'Admin endpoint not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  }

  /**
   * Trigger manual aggregation
   */
  private async triggerAggregation(request: Request): Promise<Response> {
    const body = await request.json();
    const { type, date } = body;
    
    if (!type || !['daily', 'weekly', 'monthly'].includes(type)) {
      return new Response(JSON.stringify({
        error: 'Invalid aggregation type. Must be: daily, weekly, or monthly'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const targetDate = date ? new Date(date) : undefined;
    const result = await this.metricsService.triggerAggregation(type, targetDate);
    
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Clear metrics cache
   */
  private async clearCache(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pattern = url.searchParams.get('pattern');
    
    this.metricsService.clearCache(pattern ?? undefined);
    
    return new Response(JSON.stringify({
      success: true,
      message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Create a metrics recording middleware for automatic operation tracking
 */
export function createMetricsMiddleware(
  metricsService: EnhancedMetricsService
) {
  return async (
    operation: string,
    fileId: string,
    userId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    additionalData: Record<string, unknown> = {}
  ): { execute<T>(asyncOperation: () => Promise<T>): Promise<T> } => {
    return {
      async execute<T>(asyncOperation: () => Promise<T>): Promise<T> {
        const startTime = Date.now();
        let success = false;
        let errorMessage: string | undefined;

        try {
          const result = await asyncOperation();
          success = true;
          return result;
        } catch (error) {
          success = false;
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw error;
        } finally {
          const duration = Date.now() - startTime;
          
          // Record metrics asynchronously to avoid blocking the operation
          metricsService.recordOperation(
            operation,
            fileId,
            userId,
            fileName,
            fileSize,
            contentType,
            success,
            duration,
            errorMessage,
            additionalData
          ).catch(metricsError => {
            console.error('Failed to record metrics:', metricsError);
          });
        }
      }
    };
  };
}