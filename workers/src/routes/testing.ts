import { Hono } from 'hono';
import type { Env } from '../types';
import { DRTestingService } from '../services/testing/dr-testing';
import { authenticateAdmin, authenticateUser } from '../middleware/auth';
import { ApiError } from '../middleware/error';

const testing = new Hono<{ Bindings: Env }>();

// Middleware to initialize DR Testing Service
testing.use('*', async (c, next) => {
  const drTestingService = new DRTestingService(c.env);
  c.set('drTestingService', drTestingService);
  await next();
});

/**
 * Execute a disaster recovery test scenario
 * POST /api/testing/execute
 */
testing.post('/execute', authenticateAdmin, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const { scenario_name, executed_by, environment } = await c.req.json();

    if (!scenario_name) {
      throw new ApiError(400, 'Scenario name is required');
    }

    const result = await drTestingService.executeTest(
      scenario_name,
      executed_by || 'api',
      environment || 'test'
    );

    return c.json({
      success: true,
      message: 'Test executed successfully',
      data: {
        test_id: result.test.id,
        scenario: result.test.scenario,
        status: result.test.status,
        start_time: result.test.start_time,
        end_time: result.test.end_time,
        rto_actual_ms: result.test.rto_actual_ms,
        rpo_actual_ms: result.test.rpo_actual_ms,
        total_results: result.results.length,
        passed_results: result.results.filter(r => r.passed).length,
        total_logs: result.logs.length,
        total_metrics: result.metrics.length
      }
    });
  } catch (error) {
    console.error('Error executing DR test:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

/**
 * Get available test scenarios
 * GET /api/testing/scenarios
 */
testing.get('/scenarios', authenticateUser, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const scenarios = await drTestingService.getAllTestScenarios();

    return c.json({
      success: true,
      message: 'Test scenarios retrieved successfully',
      data: scenarios
    });
  } catch (error) {
    console.error('Error getting test scenarios:', error);
    return c.json({ success: false, error: 'Failed to retrieve test scenarios' }, 500);
  }
});

/**
 * Get test history
 * GET /api/testing/history
 */
testing.get('/history', authenticateUser, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const limit = Number(c.req.query('limit')) || 50;
    const history = await drTestingService.getTestHistory(limit);

    return c.json({
      success: true,
      message: 'Test history retrieved successfully',
      data: history
    });
  } catch (error) {
    console.error('Error getting test history:', error);
    return c.json({ success: false, error: 'Failed to retrieve test history' }, 500);
  }
});

/**
 * Get test details by ID
 * GET /api/testing/tests/:testId
 */
testing.get('/tests/:testId', authenticateUser, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const testId = Number(c.req.param('testId'));

    if (!testId) {
      throw new ApiError(400, 'Invalid test ID');
    }

    // Get test details
    const test = await drTestingService.getTest(testId);
    if (!test) {
      throw new ApiError(404, 'Test not found');
    }

    // Get test results
    const results = await drTestingService.getTestResults(testId);

    // Get test logs
    const logs = await drTestingService.getTestLogs(testId);

    // Get test metrics
    const metrics = await drTestingService.getTestMetrics(testId);

    return c.json({
      success: true,
      message: 'Test details retrieved successfully',
      data: {
        test,
        results,
        logs,
        metrics
      }
    });
  } catch (error) {
    console.error('Error getting test details:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to retrieve test details' }, 500);
  }
});

/**
 * Get test results by test ID
 * GET /api/testing/tests/:testId/results
 */
testing.get('/tests/:testId/results', authenticateUser, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const testId = Number(c.req.param('testId'));

    if (!testId) {
      throw new ApiError(400, 'Invalid test ID');
    }

    const results = await drTestingService.getTestResults(testId);

    return c.json({
      success: true,
      message: 'Test results retrieved successfully',
      data: results
    });
  } catch (error) {
    console.error('Error getting test results:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to retrieve test results' }, 500);
  }
});

/**
 * Get test logs by test ID
 * GET /api/testing/tests/:testId/logs
 */
testing.get('/tests/:testId/logs', authenticateUser, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const testId = Number(c.req.param('testId'));

    if (!testId) {
      throw new ApiError(400, 'Invalid test ID');
    }

    const logs = await drTestingService.getTestLogs(testId);

    return c.json({
      success: true,
      message: 'Test logs retrieved successfully',
      data: logs
    });
  } catch (error) {
    console.error('Error getting test logs:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to retrieve test logs' }, 500);
  }
});

/**
 * Get test metrics by test ID
 * GET /api/testing/tests/:testId/metrics
 */
testing.get('/tests/:testId/metrics', authenticateUser, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const testId = Number(c.req.param('testId'));

    if (!testId) {
      throw new ApiError(400, 'Invalid test ID');
    }

    const metrics = await drTestingService.getTestMetrics(testId);

    return c.json({
      success: true,
      message: 'Test metrics retrieved successfully',
      data: metrics
    });
  } catch (error) {
    console.error('Error getting test metrics:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to retrieve test metrics' }, 500);
  }
});

/**
 * Generate test report
 * POST /api/testing/reports/generate
 */
testing.post('/reports/generate', authenticateAdmin, async (c) => {
  try {
    const drTestingService = c.get('drTestingService') as DRTestingService;
    const { 
      report_type, 
      period_start, 
      period_end, 
      report_name 
    } = await c.req.json();

    if (!report_type || !period_start || !period_end) {
      throw new ApiError(400, 'Report type, period start, and period end are required');
    }

    const validReportTypes = ['daily', 'weekly', 'monthly', 'custom', 'incident'];
    if (!validReportTypes.includes(report_type)) {
      throw new ApiError(400, 'Invalid report type');
    }

    const report = await drTestingService.generateTestReport(
      report_type,
      period_start,
      period_end,
      report_name
    );

    return c.json({
      success: true,
      message: 'Test report generated successfully',
      data: report
    });
  } catch (error) {
    console.error('Error generating test report:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to generate test report' }, 500);
  }
});

/**
 * Get test reports
 * GET /api/testing/reports
 */
testing.get('/reports', authenticateUser, async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 20;
    const reportType = c.req.query('type');

    let query = `
      SELECT * FROM test_reports 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (reportType) {
      query += ` AND report_type = ?`;
      params.push(reportType);
    }

    query += ` ORDER BY generated_at DESC LIMIT ?`;
    params.push(limit);

    const result = await c.env.DB.prepare(query).bind(...params).all();

    const reports = result.results.map(row => ({
      ...row,
      test_summary: JSON.parse(row.test_summary || '{}'),
      recommendations: JSON.parse(row.recommendations || '[]')
    }));

    return c.json({
      success: true,
      message: 'Test reports retrieved successfully',
      data: reports
    });
  } catch (error) {
    console.error('Error getting test reports:', error);
    return c.json({ success: false, error: 'Failed to retrieve test reports' }, 500);
  }
});

/**
 * Get test report by ID
 * GET /api/testing/reports/:reportId
 */
testing.get('/reports/:reportId', authenticateUser, async (c) => {
  try {
    const reportId = Number(c.req.param('reportId'));

    if (!reportId) {
      throw new ApiError(400, 'Invalid report ID');
    }

    const result = await c.env.DB.prepare(`
      SELECT * FROM test_reports WHERE id = ?
    `).bind(reportId).first();

    if (!result) {
      throw new ApiError(404, 'Test report not found');
    }

    const report = {
      ...result,
      test_summary: JSON.parse(result.test_summary || '{}'),
      recommendations: JSON.parse(result.recommendations || '[]')
    };

    return c.json({
      success: true,
      message: 'Test report retrieved successfully',
      data: report
    });
  } catch (error) {
    console.error('Error getting test report:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to retrieve test report' }, 500);
  }
});

/**
 * Schedule automated tests (Placeholder for cron job integration)
 * POST /api/testing/schedule
 */
testing.post('/schedule', authenticateAdmin, async (c) => {
  try {
    const { 
      scenario_id, 
      schedule_name, 
      cron_expression, 
      enabled 
    } = await c.req.json();

    if (!scenario_id || !schedule_name || !cron_expression) {
      throw new ApiError(400, 'Scenario ID, schedule name, and cron expression are required');
    }

    // Validate cron expression (basic validation)
    const cronParts = cron_expression.split(' ');
    if (cronParts.length !== 5) {
      throw new ApiError(400, 'Invalid cron expression format');
    }

    // Calculate next run time (simplified - in production, use a proper cron library)
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1); // Simple: next hour

    const result = await c.env.DB.prepare(`
      INSERT INTO test_schedules (
        scenario_id, schedule_name, cron_expression, enabled, next_run
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      scenario_id,
      schedule_name,
      cron_expression,
      enabled !== false,
      nextRun.toISOString()
    ).run();

    return c.json({
      success: true,
      message: 'Test schedule created successfully',
      data: {
        schedule_id: result.meta.last_row_id,
        next_run: nextRun.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating test schedule:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to create test schedule' }, 500);
  }
});

/**
 * Get test schedules
 * GET /api/testing/schedules
 */
testing.get('/schedules', authenticateUser, async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT 
        ts.*,
        tsc.scenario_name,
        tsc.test_type,
        tsc.description
      FROM test_schedules ts
      JOIN test_scenarios tsc ON ts.scenario_id = tsc.id
      ORDER BY ts.next_run ASC
    `).all();

    return c.json({
      success: true,
      message: 'Test schedules retrieved successfully',
      data: result.results
    });
  } catch (error) {
    console.error('Error getting test schedules:', error);
    return c.json({ success: false, error: 'Failed to retrieve test schedules' }, 500);
  }
});

/**
 * Update test schedule
 * PUT /api/testing/schedules/:scheduleId
 */
testing.put('/schedules/:scheduleId', authenticateAdmin, async (c) => {
  try {
    const scheduleId = Number(c.req.param('scheduleId'));
    const { 
      schedule_name, 
      cron_expression, 
      enabled 
    } = await c.req.json();

    if (!scheduleId) {
      throw new ApiError(400, 'Invalid schedule ID');
    }

    // Check if schedule exists
    const existingSchedule = await c.env.DB.prepare(`
      SELECT * FROM test_schedules WHERE id = ?
    `).bind(scheduleId).first();

    if (!existingSchedule) {
      throw new ApiError(404, 'Test schedule not found');
    }

    // Update schedule
    await c.env.DB.prepare(`
      UPDATE test_schedules 
      SET schedule_name = COALESCE(?, schedule_name),
          cron_expression = COALESCE(?, cron_expression),
          enabled = COALESCE(?, enabled),
          updated_at = ?
      WHERE id = ?
    `).bind(
      schedule_name,
      cron_expression,
      enabled,
      new Date().toISOString(),
      scheduleId
    ).run();

    return c.json({
      success: true,
      message: 'Test schedule updated successfully'
    });
  } catch (error) {
    console.error('Error updating test schedule:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to update test schedule' }, 500);
  }
});

/**
 * Delete test schedule
 * DELETE /api/testing/schedules/:scheduleId
 */
testing.delete('/schedules/:scheduleId', authenticateAdmin, async (c) => {
  try {
    const scheduleId = Number(c.req.param('scheduleId'));

    if (!scheduleId) {
      throw new ApiError(400, 'Invalid schedule ID');
    }

    const result = await c.env.DB.prepare(`
      DELETE FROM test_schedules WHERE id = ?
    `).bind(scheduleId).run();

    if (result.changes === 0) {
      throw new ApiError(404, 'Test schedule not found');
    }

    return c.json({
      success: true,
      message: 'Test schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting test schedule:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to delete test schedule' }, 500);
  }
});

/**
 * Get test statistics
 * GET /api/testing/stats
 */
testing.get('/stats', authenticateUser, async (c) => {
  try {
    const period = c.req.query('period') || '7d'; // Default to last 7 days
    
    let periodStart: Date;
    switch (period) {
      case '24h':
        periodStart = new Date();
        periodStart.setHours(periodStart.getHours() - 24);
        break;
      case '7d':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case '30d':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      default:
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 7);
    }

    // Get overall test statistics
    const overallStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_tests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tests,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tests,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_tests,
        AVG(rto_actual_ms) as avg_rto_ms,
        AVG(rpo_actual_ms) as avg_rpo_ms
      FROM dr_tests 
      WHERE start_time >= ?
    `).bind(periodStart.toISOString()).first();

    // Get test statistics by type
    const typeStats = await c.env.DB.prepare(`
      SELECT 
        test_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM dr_tests 
      WHERE start_time >= ?
      GROUP BY test_type
    `).bind(periodStart.toISOString()).all();

    // Get recent test results
    const recentTests = await c.env.DB.prepare(`
      SELECT 
        id, test_type, scenario, status, start_time, end_time,
        rto_actual_ms, rpo_actual_ms
      FROM dr_tests 
      WHERE start_time >= ?
      ORDER BY start_time DESC 
      LIMIT 10
    `).bind(periodStart.toISOString()).all();

    const successRate = overallStats.total_tests > 0 ? 
      (overallStats.completed_tests / overallStats.total_tests) * 100 : 0;

    return c.json({
      success: true,
      message: 'Test statistics retrieved successfully',
      data: {
        period,
        overall: {
          ...overallStats,
          success_rate: Math.round(successRate * 100) / 100
        },
        by_type: typeStats.results,
        recent_tests: recentTests.results
      }
    });
  } catch (error) {
    console.error('Error getting test statistics:', error);
    return c.json({ success: false, error: 'Failed to retrieve test statistics' }, 500);
  }
});

/**
 * Cancel running test
 * POST /api/testing/tests/:testId/cancel
 */
testing.post('/tests/:testId/cancel', authenticateAdmin, async (c) => {
  try {
    const testId = Number(c.req.param('testId'));

    if (!testId) {
      throw new ApiError(400, 'Invalid test ID');
    }

    // Check if test is running
    const test = await c.env.DB.prepare(`
      SELECT * FROM dr_tests WHERE id = ? AND status = 'running'
    `).bind(testId).first();

    if (!test) {
      throw new ApiError(404, 'Running test not found');
    }

    // Update test status to cancelled
    await c.env.DB.prepare(`
      UPDATE dr_tests 
      SET status = 'cancelled', end_time = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), testId).run();

    // Log cancellation
    await c.env.DB.prepare(`
      INSERT INTO test_logs (test_id, event_type, message, level)
      VALUES (?, 'warning', 'Test cancelled by user', 'warn')
    `).bind(testId).run();

    return c.json({
      success: true,
      message: 'Test cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling test:', error);
    if (error instanceof ApiError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    return c.json({ success: false, error: 'Failed to cancel test' }, 500);
  }
});

/**
 * Health check for testing service
 * GET /api/testing/health
 */
testing.get('/health', async (c) => {
  try {
    // Check database connectivity
    const dbCheck = await c.env.DB.prepare('SELECT 1 as test').first();
    
    // Check if any tests are currently running
    const runningTests = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM dr_tests WHERE status = 'running'
    `).first();

    return c.json({
      success: true,
      message: 'DR Testing service is healthy',
      data: {
        database_connected: !!dbCheck,
        running_tests: runningTests?.count || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking testing service health:', error);
    return c.json({ 
      success: false, 
      error: 'Testing service health check failed',
      data: {
        database_connected: false,
        running_tests: 0,
        timestamp: new Date().toISOString()
      }
    }, 500);
  }
});

export default testing;