import { Hono } from 'hono';
import { CutoverMonitoring } from '../../services/deployment/cutover-monitoring.js';
import { 
  CutoverMonitoringConfig,
  DeploymentEnvironment,
  MonitoringResult
} from '../../types/deployment.js';
import { Env } from '../../types/env.js';

/**
 * Routes for deployment monitoring operations
 * Provides endpoints to start, stop, and query cutover monitoring
 */
export function createMonitoringRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * Start cutover monitoring
   * POST /api/deployment/monitoring/start
   */
  app.post('/start', async (c) => {
    try {
      const { environment, config } = await c.req.json();

      // Validate environment
      if (!environment || !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      // Validate and set default config
      const monitoringConfig: CutoverMonitoringConfig = {
        duration: config?.duration || 300000, // 5 minutes default
        checkInterval: config?.checkInterval || 10000, // 10 seconds default
        thresholds: {
          maxErrorRate: config?.thresholds?.maxErrorRate || 5,
          maxResponseTime: config?.thresholds?.maxResponseTime || 2000,
          minSuccessRate: config?.thresholds?.minSuccessRate || 95
        },
        endpoints: config?.endpoints || [
          `/api/health`,
          `/api/auth/validate`,
          `/api/files`
        ],
        alerting: {
          enabled: config?.alerting?.enabled ?? true,
          channels: config?.alerting?.channels || ['database']
        }
      };

      // Create monitoring service
      const monitoring = new CutoverMonitoring(c.env.ANALYTICS, c.env.DB);

      // Start monitoring (runs in background)
      const monitoringPromise = monitoring.monitorCutover(environment, monitoringConfig);

      // Return immediately with monitoring info
      return c.json({
        success: true,
        message: 'Cutover monitoring started',
        environment,
        config: monitoringConfig,
        estimatedCompletion: new Date(Date.now() + monitoringConfig.duration).toISOString()
      });

    } catch (error) {
      console.error('Failed to start cutover monitoring:', error);
      return c.json({ 
        error: 'Failed to start cutover monitoring',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Stop cutover monitoring
   * POST /api/deployment/monitoring/stop
   */
  app.post('/stop', async (c) => {
    try {
      const monitoring = new CutoverMonitoring(c.env.ANALYTICS, c.env.DB);
      monitoring.stopMonitoring();

      return c.json({
        success: true,
        message: 'Cutover monitoring stopped'
      });

    } catch (error) {
      console.error('Failed to stop cutover monitoring:', error);
      return c.json({ 
        error: 'Failed to stop cutover monitoring',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get monitoring status
   * GET /api/deployment/monitoring/status
   */
  app.get('/status', async (c) => {
    try {
      const monitoring = new CutoverMonitoring(c.env.ANALYTICS, c.env.DB);
      const status = monitoring.getMonitoringStatus();

      return c.json({
        success: true,
        status: {
          active: status.active,
          hasActiveMonitoring: status.promise !== null
        }
      });

    } catch (error) {
      console.error('Failed to get monitoring status:', error);
      return c.json({ 
        error: 'Failed to get monitoring status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get monitoring history
   * GET /api/deployment/monitoring/history
   */
  app.get('/history', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const limit = parseInt(c.req.query('limit') || '50');

      if (limit > 100) {
        return c.json({ error: 'Limit cannot exceed 100' }, 400);
      }

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const monitoring = new CutoverMonitoring(c.env.ANALYTICS, c.env.DB);
      const history = await monitoring.getMonitoringHistory(environment, limit);

      return c.json({
        success: true,
        history,
        totalCount: history.length,
        environment,
        limit
      });

    } catch (error) {
      console.error('Failed to get monitoring history:', error);
      return c.json({ 
        error: 'Failed to get monitoring history',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get monitoring results for specific time range
   * GET /api/deployment/monitoring/results
   */
  app.get('/results', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const startTime = c.req.query('startTime');
      const endTime = c.req.query('endTime');

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      let query = `
        SELECT * FROM deployment_monitoring_results 
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (environment) {
        query += ` AND environment = ?`;
        params.push(environment);
      }

      if (startTime) {
        query += ` AND start_time >= ?`;
        params.push(startTime);
      }

      if (endTime) {
        query += ` AND end_time <= ?`;
        params.push(endTime);
      }

      query += ` ORDER BY start_time DESC LIMIT 100`;

      const results = await c.env.DB
        .prepare(query)
        .bind(...params)
        .all();

      const monitoringResults = results.results.map((row: any) => ({
        environment: row.environment,
        startTime: row.start_time,
        endTime: row.end_time,
        healthy: Boolean(row.healthy),
        errorRate: row.error_rate,
        avgResponseTime: row.avg_response_time,
        successfulChecks: row.successful_checks,
        totalChecks: row.total_checks,
        issuesCount: row.issues_count
      }));

      return c.json({
        success: true,
        results: monitoringResults,
        totalCount: monitoringResults.length,
        filters: {
          environment,
          startTime,
          endTime
        }
      });

    } catch (error) {
      console.error('Failed to get monitoring results:', error);
      return c.json({ 
        error: 'Failed to get monitoring results',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get monitoring issues
   * GET /api/deployment/monitoring/issues
   */
  app.get('/issues', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const severity = c.req.query('severity');
      const limit = parseInt(c.req.query('limit') || '100');

      if (limit > 500) {
        return c.json({ error: 'Limit cannot exceed 500' }, 400);
      }

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      if (severity && !['low', 'medium', 'high', 'critical'].includes(severity)) {
        return c.json({ error: 'Invalid severity. Must be one of: low, medium, high, critical' }, 400);
      }

      let query = `
        SELECT * FROM deployment_monitoring_issues 
        WHERE 1=1
      `;
      const params: unknown[] = [];

      if (environment) {
        query += ` AND environment = ?`;
        params.push(environment);
      }

      if (severity) {
        query += ` AND severity = ?`;
        params.push(severity);
      }

      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const results = await c.env.DB
        .prepare(query)
        .bind(...params)
        .all();

      const issues = results.results.map((row: any) => ({
        environment: row.environment,
        timestamp: row.timestamp,
        issueType: row.issue_type,
        severity: row.severity,
        message: row.message,
        value: row.value,
        threshold: row.threshold
      }));

      return c.json({
        success: true,
        issues,
        totalCount: issues.length,
        filters: {
          environment,
          severity,
          limit
        }
      });

    } catch (error) {
      console.error('Failed to get monitoring issues:', error);
      return c.json({ 
        error: 'Failed to get monitoring issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Get monitoring metrics summary
   * GET /api/deployment/monitoring/metrics
   */
  app.get('/metrics', async (c) => {
    try {
      const environment = c.req.query('environment') as DeploymentEnvironment;
      const hours = parseInt(c.req.query('hours') || '24');

      if (hours > 168) { // Max 1 week
        return c.json({ error: 'Hours cannot exceed 168 (1 week)' }, 400);
      }

      if (environment && !['blue', 'green'].includes(environment)) {
        return c.json({ error: 'Invalid environment. Must be "blue" or "green"' }, 400);
      }

      const timeFilter = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

      // Get monitoring statistics
      let statsQuery = `
        SELECT 
          COUNT(*) as total_monitoring_sessions,
          COUNT(CASE WHEN healthy = 1 THEN 1 END) as healthy_sessions,
          AVG(error_rate) as avg_error_rate,
          AVG(avg_response_time) as avg_response_time,
          AVG(CAST(successful_checks AS REAL) / CAST(total_checks AS REAL) * 100) as avg_success_rate
        FROM deployment_monitoring_results 
        WHERE start_time >= ?
      `;
      const params: unknown[] = [timeFilter];

      if (environment) {
        statsQuery += ` AND environment = ?`;
        params.push(environment);
      }

      const stats = await c.env.DB
        .prepare(statsQuery)
        .bind(...params)
        .first();

      // Get issue counts by severity
      let issuesQuery = `
        SELECT 
          severity,
          COUNT(*) as count
        FROM deployment_monitoring_issues 
        WHERE timestamp >= ?
      `;
      const issueParams: unknown[] = [timeFilter];

      if (environment) {
        issuesQuery += ` AND environment = ?`;
        issueParams.push(environment);
      }

      issuesQuery += ` GROUP BY severity`;

      const issueResults = await c.env.DB
        .prepare(issuesQuery)
        .bind(...issueParams)
        .all();

      const issuesBySeverity = issueResults.results.reduce((acc: Record<string, number>, row: any) => {
        acc[row.severity] = row.count;
        return acc;
      }, {});

      return c.json({
        success: true,
        metrics: {
          totalMonitoringSessions: stats?.total_monitoring_sessions || 0,
          healthySessions: stats?.healthy_sessions || 0,
          healthyPercentage: stats?.total_monitoring_sessions 
            ? ((stats.healthy_sessions / stats.total_monitoring_sessions) * 100).toFixed(2)
            : '0',
          averageErrorRate: stats?.avg_error_rate ? parseFloat(stats.avg_error_rate.toFixed(2)) : 0,
          averageResponseTime: stats?.avg_response_time ? parseFloat(stats.avg_response_time.toFixed(2)) : 0,
          averageSuccessRate: stats?.avg_success_rate ? parseFloat(stats.avg_success_rate.toFixed(2)) : 0,
          issuesBySeverity: {
            low: issuesBySeverity.low || 0,
            medium: issuesBySeverity.medium || 0,
            high: issuesBySeverity.high || 0,
            critical: issuesBySeverity.critical || 0
          }
        },
        timeRange: {
          hours,
          since: timeFilter,
          environment
        }
      });

    } catch (error) {
      console.error('Failed to get monitoring metrics:', error);
      return c.json({ 
        error: 'Failed to get monitoring metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  /**
   * Health check for monitoring service
   * GET /api/deployment/monitoring/health
   */
  app.get('/health', async (c) => {
    try {
      // Test database connectivity
      const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
      const dbHealthy = dbTest?.test === 1;

      // Test analytics connectivity (simplified)
      let analyticsHealthy = true;
      try {
        await c.env.ANALYTICS.writeDataPoint({
          blobs: ['health_check', 'monitoring_service'],
          doubles: [Date.now()],
          indexes: ['health']
        });
      } catch (error) {
        analyticsHealthy = false;
      }

      const healthy = dbHealthy && analyticsHealthy;

      return c.json({
        success: true,
        healthy,
        components: {
          database: dbHealthy,
          analytics: analyticsHealthy
        },
        timestamp: new Date().toISOString()
      }, healthy ? 200 : 503);

    } catch (error) {
      console.error('Monitoring health check failed:', error);
      return c.json({ 
        healthy: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 503);
    }
  });

  return app;
}