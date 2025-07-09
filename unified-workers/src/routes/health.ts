/**
 * Health Check and Monitoring Routes
 * Provides comprehensive health status and performance metrics
 */

import type { Env } from '../types';
import { MetricsCollector, PerformanceMonitor } from '../middleware/metrics';

/**
 * Basic health check endpoint
 */
export async function handleHealthCheck(env: Env): Promise<Response> {
  try {
    const metrics = new MetricsCollector(env);
    const healthStatus = await metrics.healthCheck();

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': healthStatus.status,
        'X-Environment': env.ENVIRONMENT || 'unknown',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}

/**
 * Detailed health check with component status
 */
export async function handleDetailedHealthCheck(env: Env): Promise<Response> {
  try {
    const metrics = new MetricsCollector(env);
    const healthStatus = await metrics.healthCheck();
    const performanceMetrics = metrics.getMetrics();
    const businessMetrics = await metrics.getBusinessMetrics();

    const detailedStatus = {
      ...healthStatus,
      performance: performanceMetrics,
      business: businessMetrics,
      system: {
        worker_version: env.API_VERSION || 'unknown',
        environment: env.ENVIRONMENT || 'unknown',
        region: env.CF_RAY?.split('-')[1] || 'unknown',
        colo: env.CF_IPCOUNTRY || 'unknown',
        timestamp: new Date().toISOString(),
      },
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(detailedStatus, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': healthStatus.status,
        'X-Response-Time': Date.now().toString(),
      },
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}

/**
 * Performance metrics endpoint
 */
export async function handleMetrics(request: Request, env: Env): Promise<Response> {
  try {
    const metrics = new MetricsCollector(env);
    const performanceMetrics = metrics.getMetrics();
    const businessMetrics = await metrics.getBusinessMetrics();

    const response = {
      timestamp: new Date().toISOString(),
      metrics: {
        performance: performanceMetrics,
        business: businessMetrics,
      },
      metadata: {
        collection_period: '5m',
        worker_id: env.CF_RAY || 'unknown',
        environment: env.ENVIRONMENT || 'unknown',
      },
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30', // Cache for 30 seconds
        'X-Metrics-Version': '1.0',
      },
    });
  } catch (error) {
    console.error('Metrics endpoint failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Prometheus-compatible metrics endpoint
 */
export async function handlePrometheusMetrics(env: Env): Promise<Response> {
  try {
    const metrics = new MetricsCollector(env);
    const data = metrics.getMetrics();
    const businessMetrics = await metrics.getBusinessMetrics();

    let output = '';
    
    // Add help and type information
    output += '# HELP request_duration_seconds Request duration in seconds\n';
    output += '# TYPE request_duration_seconds histogram\n';
    
    // Add counter metrics
    for (const [name, value] of Object.entries(data.counters)) {
      const metricName = name.replace(/\./g, '_');
      output += `# HELP ${metricName} ${name} counter\n`;
      output += `# TYPE ${metricName} counter\n`;
      output += `${metricName} ${value}\n`;
    }

    // Add gauge metrics
    for (const [name, value] of Object.entries(data.gauges)) {
      const metricName = name.replace(/\./g, '_');
      output += `# HELP ${metricName} ${name} gauge\n`;
      output += `# TYPE ${metricName} gauge\n`;
      output += `${metricName} ${value}\n`;
    }

    // Add percentile metrics
    for (const [name, percentiles] of Object.entries(data.percentiles)) {
      const metricName = name.replace(/\./g, '_');
      output += `# HELP ${metricName}_percentile ${name} percentiles\n`;
      output += `# TYPE ${metricName}_percentile gauge\n`;
      output += `${metricName}_percentile{quantile="0.5"} ${percentiles.p50}\n`;
      output += `${metricName}_percentile{quantile="0.95"} ${percentiles.p95}\n`;
      output += `${metricName}_percentile{quantile="0.99"} ${percentiles.p99}\n`;
    }

    // Add business metrics
    output += '# HELP active_users Number of active users\n';
    output += '# TYPE active_users gauge\n';
    output += `active_users ${businessMetrics.activeUsers}\n`;

    output += '# HELP total_files Total number of files uploaded\n';
    output += '# TYPE total_files counter\n';
    output += `total_files ${businessMetrics.totalFiles}\n`;

    output += '# HELP error_rate Error rate percentage\n';
    output += '# TYPE error_rate gauge\n';
    output += `error_rate ${businessMetrics.errorRate}\n`;

    output += '# HELP uptime_seconds Worker uptime in seconds\n';
    output += '# TYPE uptime_seconds counter\n';
    output += `uptime_seconds ${data.uptime / 1000}\n`;

    return new Response(output, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Prometheus metrics endpoint failed:', error);
    
    return new Response('# Error generating metrics\n', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}

/**
 * Core Web Vitals endpoint
 */
export async function handleCoreWebVitals(request: Request, env: Env): Promise<Response> {
  try {
    const metrics = new MetricsCollector(env);
    const data = metrics.getMetrics();

    // Extract Web Vitals related metrics
    const webVitals = {
      lcp: data.percentiles['core_web_vitals.estimated_lcp'] || { p50: 0, p95: 0, p99: 0 },
      fid: data.percentiles['request.duration'] || { p50: 0, p95: 0, p99: 0 },
      cls: data.gauges['core_web_vitals.cls'] || 0,
      fcp: data.percentiles['core_web_vitals.server_response_time'] || { p50: 0, p95: 0, p99: 0 },
      ttfb: data.percentiles['request.duration'] || { p50: 0, p95: 0, p99: 0 },
    };

    const scores = {
      lcp_score: webVitals.lcp.p75 <= 2500 ? 'good' : webVitals.lcp.p75 <= 4000 ? 'needs-improvement' : 'poor',
      fid_score: webVitals.fid.p75 <= 100 ? 'good' : webVitals.fid.p75 <= 300 ? 'needs-improvement' : 'poor',
      cls_score: webVitals.cls <= 0.1 ? 'good' : webVitals.cls <= 0.25 ? 'needs-improvement' : 'poor',
    };

    const response = {
      timestamp: new Date().toISOString(),
      core_web_vitals: webVitals,
      scores,
      recommendations: generateWebVitalsRecommendations(webVitals, scores),
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('Core Web Vitals endpoint failed:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to retrieve Core Web Vitals',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * System status page endpoint
 */
export async function handleStatusPage(env: Env): Promise<Response> {
  try {
    const metrics = new MetricsCollector(env);
    const healthStatus = await metrics.healthCheck();
    const performanceMetrics = metrics.getMetrics();

    const html = generateStatusPageHTML(healthStatus, performanceMetrics, env);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Status page failed:', error);
    
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>System Status - Error</title></head>
        <body>
          <h1>System Status Unavailable</h1>
          <p>Unable to retrieve system status: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
      </html>
    `;

    return new Response(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
}

/**
 * Generate Web Vitals recommendations
 */
function generateWebVitalsRecommendations(
  vitals: any,
  scores: any
): string[] {
  const recommendations = [];

  if (scores.lcp_score !== 'good') {
    recommendations.push('Optimize Largest Contentful Paint by reducing server response times and optimizing critical resources');
  }

  if (scores.fid_score !== 'good') {
    recommendations.push('Improve First Input Delay by reducing JavaScript execution time and optimizing event handlers');
  }

  if (scores.cls_score !== 'good') {
    recommendations.push('Fix Cumulative Layout Shift by ensuring proper image dimensions and avoiding dynamic content insertion');
  }

  if (vitals.ttfb.p95 > 600) {
    recommendations.push('Optimize Time to First Byte by improving server response times and using edge caching');
  }

  return recommendations;
}

/**
 * Generate status page HTML
 */
function generateStatusPageHTML(
  healthStatus: any,
  performanceMetrics: any,
  env: Env
): string {
  const statusColor = healthStatus.status === 'healthy' ? '#22c55e' : 
                     healthStatus.status === 'degraded' ? '#f59e0b' : '#ef4444';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>List Cutter - System Status</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f9fafb; }
          .container { max-width: 1200px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 40px; }
          .status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; background: ${statusColor}; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .metric { display: flex; justify-content: space-between; margin: 10px 0; }
          .metric-name { font-weight: 500; }
          .metric-value { font-family: monospace; }
          .healthy { color: #22c55e; }
          .degraded { color: #f59e0b; }
          .unhealthy { color: #ef4444; }
          .refresh { margin: 20px 0; text-align: center; }
          .refresh button { padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
        </style>
        <script>
          function refreshPage() { location.reload(); }
          setTimeout(refreshPage, 30000); // Auto-refresh every 30 seconds
        </script>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1><span class="status-indicator"></span>List Cutter System Status</h1>
            <p>Environment: ${env.ENVIRONMENT || 'unknown'} | Version: ${env.API_VERSION || 'unknown'}</p>
            <p>Last updated: ${new Date().toISOString()}</p>
          </div>

          <div class="grid">
            <div class="card">
              <h3>Overall Health</h3>
              <div class="metric">
                <span class="metric-name">Status</span>
                <span class="metric-value ${healthStatus.status}">${healthStatus.status.toUpperCase()}</span>
              </div>
              <div class="metric">
                <span class="metric-name">Uptime</span>
                <span class="metric-value">${Math.round(healthStatus.uptime / 1000)}s</span>
              </div>
            </div>

            <div class="card">
              <h3>Database</h3>
              <div class="metric">
                <span class="metric-name">Status</span>
                <span class="metric-value ${healthStatus.checks.database.status}">${healthStatus.checks.database.status}</span>
              </div>
              <div class="metric">
                <span class="metric-name">Latency</span>
                <span class="metric-value">${healthStatus.checks.database.latency}ms</span>
              </div>
            </div>

            <div class="card">
              <h3>Storage</h3>
              <div class="metric">
                <span class="metric-name">Status</span>
                <span class="metric-value ${healthStatus.checks.storage.status}">${healthStatus.checks.storage.status}</span>
              </div>
              <div class="metric">
                <span class="metric-name">Latency</span>
                <span class="metric-value">${healthStatus.checks.storage.latency}ms</span>
              </div>
            </div>

            <div class="card">
              <h3>Performance Metrics</h3>
              <div class="metric">
                <span class="metric-name">Avg Response Time</span>
                <span class="metric-value">${performanceMetrics.percentiles['request.duration']?.p50?.toFixed(2) || 0}ms</span>
              </div>
              <div class="metric">
                <span class="metric-name">95th Percentile</span>
                <span class="metric-value">${performanceMetrics.percentiles['request.duration']?.p95?.toFixed(2) || 0}ms</span>
              </div>
              <div class="metric">
                <span class="metric-name">Total Requests</span>
                <span class="metric-value">${performanceMetrics.counters['requests.total'] || 0}</span>
              </div>
              <div class="metric">
                <span class="metric-name">Error Rate</span>
                <span class="metric-value">${((performanceMetrics.counters['requests.error'] || 0) / Math.max(1, performanceMetrics.counters['requests.total'] || 1) * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div class="refresh">
            <button onclick="refreshPage()">Refresh Status</button>
            <p><small>Page automatically refreshes every 30 seconds</small></p>
          </div>
        </div>
      </body>
    </html>
  `;
}