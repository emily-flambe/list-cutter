import type { Env, R2HealthStatus, ServiceAlert, CircuitBreakerStatus } from '../../types';
import { ApiError } from '../../middleware/error';
import { R2HealthMonitor } from '../../services/monitoring/r2-health';

// Global health monitor instance
let globalHealthMonitor: R2HealthMonitor | null = null;

/**
 * Initialize global health monitor
 */
export function initializeHealthMonitor(env: Env): R2HealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new R2HealthMonitor(env);
    // Start monitoring automatically
    globalHealthMonitor.startMonitoring().catch(error => {
      console.error('Failed to start health monitoring:', error);
    });
  }
  return globalHealthMonitor;
}

/**
 * Get health monitor instance
 */
export function getHealthMonitor(): R2HealthMonitor | null {
  return globalHealthMonitor;
}

/**
 * GET /api/health - Get overall health status
 */
export async function getHealthStatus(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    const status = monitor.getHealthStatus();
    const activeAlerts = await monitor.getActiveAlerts();
    
    const response: R2HealthStatus = {
      ...status,
      activeAlerts
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
      status: status.overall === 'healthy' ? 200 : 503
    });
  } catch (error) {
    console.error('Error getting health status:', error);
    throw new ApiError(500, 'Failed to get health status');
  }
}

/**
 * POST /api/health/check - Run immediate health check
 */
export async function runHealthCheck(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    const results = await monitor.performHealthCheck();
    
    return new Response(JSON.stringify({
      success: true,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error running health check:', error);
    throw new ApiError(500, 'Failed to run health check');
  }
}

/**
 * GET /api/health/circuit-breaker - Get circuit breaker status
 */
export async function getCircuitBreakerStatus(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    const circuitBreaker = monitor.getCircuitBreaker();
    
    const status: CircuitBreakerStatus = {
      ...circuitBreaker.getHealthStatus(),
      failureCount: circuitBreaker.getMetrics().failedCalls,
      successCount: circuitBreaker.getMetrics().successfulCalls,
      lastFailureTime: circuitBreaker.getMetrics().lastFailureTime,
      lastSuccessTime: circuitBreaker.getMetrics().lastSuccessTime,
      nextAttempt: circuitBreaker.getTimeUntilNextAttempt() > 0 ? 
        Date.now() + circuitBreaker.getTimeUntilNextAttempt() : undefined
    };

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting circuit breaker status:', error);
    throw new ApiError(500, 'Failed to get circuit breaker status');
  }
}

/**
 * POST /api/health/circuit-breaker/reset - Reset circuit breaker
 */
export async function resetCircuitBreaker(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    const circuitBreaker = monitor.getCircuitBreaker();
    
    await circuitBreaker.reset();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Circuit breaker reset successfully',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error resetting circuit breaker:', error);
    throw new ApiError(500, 'Failed to reset circuit breaker');
  }
}

/**
 * GET /api/health/history - Get recent health check history
 */
export async function getHealthHistory(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    const monitor = initializeHealthMonitor(env);
    const results = await monitor.getRecentHealthChecks(limit);
    
    return new Response(JSON.stringify({
      results: results.slice(offset, offset + limit),
      total: results.length,
      limit,
      offset
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting health history:', error);
    throw new ApiError(500, 'Failed to get health history');
  }
}

/**
 * GET /api/health/alerts - Get active alerts
 */
export async function getActiveAlerts(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    const alerts = await monitor.getActiveAlerts();
    
    return new Response(JSON.stringify({
      alerts,
      count: alerts.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting active alerts:', error);
    throw new ApiError(500, 'Failed to get active alerts');
  }
}

/**
 * POST /api/health/alerts/{id}/resolve - Resolve an alert
 */
export async function resolveAlert(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const alertId = parseInt(url.pathname.split('/').slice(-2)[0]);
    
    if (isNaN(alertId)) {
      throw new ApiError(400, 'Invalid alert ID');
    }

    const body = await request.json();
    const resolutionNotes = body.resolutionNotes || '';
    
    const monitor = initializeHealthMonitor(env);
    await monitor.resolveAlert(alertId, resolutionNotes);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Alert resolved successfully',
      alertId,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to resolve alert');
  }
}

/**
 * GET /api/health/config - Get monitoring configuration
 */
export async function getMonitoringConfig(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    const config = monitor.getConfiguration();
    
    return new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting monitoring config:', error);
    throw new ApiError(500, 'Failed to get monitoring configuration');
  }
}

/**
 * PUT /api/health/config - Update monitoring configuration
 */
export async function updateMonitoringConfig(env: Env, request: Request): Promise<Response> {
  try {
    const updates = await request.json();
    
    const monitor = initializeHealthMonitor(env);
    await monitor.updateConfiguration(updates);
    
    // Restart monitoring with new configuration
    monitor.stopMonitoring();
    await monitor.startMonitoring();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Monitoring configuration updated successfully',
      config: monitor.getConfiguration(),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating monitoring config:', error);
    throw new ApiError(500, 'Failed to update monitoring configuration');
  }
}

/**
 * POST /api/health/monitoring/start - Start health monitoring
 */
export async function startMonitoring(env: Env): Promise<Response> {
  try {
    const monitor = initializeHealthMonitor(env);
    await monitor.startMonitoring();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Health monitoring started successfully',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    throw new ApiError(500, 'Failed to start monitoring');
  }
}

/**
 * POST /api/health/monitoring/stop - Stop health monitoring
 */
export async function stopMonitoring(env: Env): Promise<Response> {
  try {
    const monitor = getHealthMonitor();
    if (monitor) {
      monitor.stopMonitoring();
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Health monitoring stopped successfully',
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    throw new ApiError(500, 'Failed to stop monitoring');
  }
}

/**
 * GET /api/health/metrics - Get aggregated metrics
 */
export async function getHealthMetrics(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get('hours') || '24');
    
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const results = await env.DB.prepare(`
      SELECT 
        operation_type,
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy_checks,
        SUM(CASE WHEN status = 'unhealthy' THEN 1 ELSE 0 END) as unhealthy_checks,
        SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded_checks,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time
      FROM r2_health_checks 
      WHERE timestamp > ?
      GROUP BY operation_type
    `).bind(cutoffTime).all();
    
    const metrics = results.results.map(row => ({
      operationType: row.operation_type,
      totalChecks: row.total_checks,
      healthyChecks: row.healthy_checks,
      unhealthyChecks: row.unhealthy_checks,
      degradedChecks: row.degraded_checks,
      averageResponseTime: row.avg_response_time,
      minResponseTime: row.min_response_time,
      maxResponseTime: row.max_response_time,
      healthRate: (row.healthy_checks / row.total_checks) * 100,
      errorRate: ((row.unhealthy_checks + row.degraded_checks) / row.total_checks) * 100
    }));
    
    return new Response(JSON.stringify({
      metrics,
      timeRange: `${hours} hours`,
      generatedAt: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting health metrics:', error);
    throw new ApiError(500, 'Failed to get health metrics');
  }
}