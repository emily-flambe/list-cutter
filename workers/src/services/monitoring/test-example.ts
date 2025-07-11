/**
 * Example usage of the R2 Health Monitoring System
 * This file demonstrates how to use the monitoring components
 */

import type { Env } from '../../types';
import { R2HealthMonitor } from './r2-health';
import { createR2CircuitBreaker } from './circuit-breaker';

/**
 * Example: Basic health monitoring setup
 */
export async function exampleBasicMonitoring(env: Env) {
  // Create and start health monitor
  const monitor = new R2HealthMonitor(env);
  await monitor.startMonitoring();
  
  // Get current health status
  const status = monitor.getHealthStatus();
  console.log('Current health status:', status);
  
  // Run a manual health check
  const results = await monitor.performHealthCheck();
  console.log('Health check results:', results);
  
  // Stop monitoring when done
  monitor.stopMonitoring();
}

/**
 * Example: Circuit breaker usage
 */
export async function exampleCircuitBreaker(env: Env) {
  // Create circuit breaker with custom config
  const circuitBreaker = createR2CircuitBreaker(env, {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    slowCallThreshold: 1000
  });
  
  try {
    // Execute R2 operation with circuit breaker protection
    const result = await circuitBreaker.execute(async () => {
      return await env.R2_BUCKET.get('test-file.txt');
    });
    
    console.log('Operation successful:', result !== null);
  } catch (error) {
    console.error('Operation failed:', error);
  }
  
  // Check circuit breaker status
  const status = circuitBreaker.getHealthStatus();
  console.log('Circuit breaker status:', status);
}

/**
 * Example: Custom monitoring configuration
 */
export async function exampleCustomConfig(env: Env) {
  const monitor = new R2HealthMonitor(env, {
    checkInterval: 15000,    // Check every 15 seconds
    timeout: 3000,          // 3 second timeout
    failureThreshold: 2,    // Open circuit after 2 failures
    slowResponseThreshold: 1500  // Consider > 1.5s as slow
  });
  
  // Update configuration at runtime
  await monitor.updateConfiguration({
    enabled: true,
    alertOnFailure: true,
    testOperations: ['get', 'put']  // Only test GET and PUT operations
  });
  
  await monitor.startMonitoring();
  
  // Monitor will now use updated configuration
  console.log('Monitoring started with custom configuration');
}

/**
 * Example: Alert handling
 */
export async function exampleAlertHandling(env: Env) {
  const monitor = new R2HealthMonitor(env);
  
  // Get active alerts
  const alerts = await monitor.getActiveAlerts();
  console.log(`Found ${alerts.length} active alerts`);
  
  // Resolve alerts
  for (const alert of alerts) {
    if (alert.id && alert.severity === 'low') {
      await monitor.resolveAlert(alert.id, 'Automatically resolved low severity alert');
      console.log(`Resolved alert: ${alert.message}`);
    }
  }
  
  // Get recent health check history
  const history = await monitor.getRecentHealthChecks(10);
  console.log(`Recent health checks: ${history.length} entries`);
}

/**
 * Example: Integration with existing R2 service
 */
export async function exampleR2Integration(env: Env) {
  // The existing R2 service functions now automatically use circuit breaker protection
  const { saveFileToR2, getFileFromR2, deleteFileFromR2 } = await import('../storage/r2');
  
  try {
    // These operations are now protected by circuit breaker
    const fileName = await saveFileToR2(env, 'test.txt', new TextEncoder().encode('Hello World'));
    console.log('File saved:', fileName);
    
    const file = await getFileFromR2(env, fileName);
    console.log('File retrieved:', file !== null);
    
    await deleteFileFromR2(env, fileName);
    console.log('File deleted');
    
  } catch (error) {
    // Circuit breaker will prevent cascading failures
    console.error('R2 operation failed (circuit breaker may be open):', error);
  }
}

/**
 * Example: Metrics collection and analysis
 */
export async function exampleMetricsAnalysis(env: Env) {
  // Query health metrics from database
  const metricsQuery = `
    SELECT 
      operation_type,
      COUNT(*) as total_checks,
      AVG(response_time_ms) as avg_response_time,
      SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy_count,
      SUM(CASE WHEN status = 'unhealthy' THEN 1 ELSE 0 END) as unhealthy_count
    FROM r2_health_checks 
    WHERE timestamp > datetime('now', '-1 hour')
    GROUP BY operation_type
  `;
  
  const results = await env.DB.prepare(metricsQuery).all();
  
  console.log('Hourly metrics by operation:');
  for (const row of results.results) {
    const healthRate = (row.healthy_count / row.total_checks) * 100;
    console.log(`${row.operation_type}: ${healthRate.toFixed(1)}% healthy, ${row.avg_response_time.toFixed(0)}ms avg`);
  }
  
  // Get circuit breaker events
  const eventsQuery = `
    SELECT state, reason, timestamp 
    FROM circuit_breaker_events 
    WHERE timestamp > datetime('now', '-1 hour')
    ORDER BY timestamp DESC
  `;
  
  const events = await env.DB.prepare(eventsQuery).all();
  console.log(`Circuit breaker events in last hour: ${events.results.length}`);
}

/**
 * Example: Monitoring dashboard data
 */
export async function exampleDashboardData(env: Env) {
  const monitor = new R2HealthMonitor(env);
  
  // Get comprehensive status for dashboard
  const status = monitor.getHealthStatus();
  const alerts = await monitor.getActiveAlerts();
  const recentChecks = await monitor.getRecentHealthChecks(20);
  
  const dashboardData = {
    overall_status: status.overall,
    circuit_breaker_state: status.circuitBreakerState,
    metrics: status.metrics,
    active_alerts: alerts.length,
    critical_alerts: alerts.filter(a => a.severity === 'critical').length,
    recent_checks: recentChecks.slice(0, 5),
    uptime_percentage: status.metrics.uptimePercentage,
    avg_response_time: status.metrics.averageResponseTime,
    last_check: status.metrics.lastCheckTime
  };
  
  console.log('Dashboard data:', JSON.stringify(dashboardData, null, 2));
  return dashboardData;
}