/**
 * Alert Scheduled Jobs
 * Handles cron-triggered alert evaluation and maintenance tasks
 */

import { Hono } from 'hono';
import { AlertSchedulerService } from '../services/monitoring/alert-scheduler';

export function createAlertJobRoutes(
  db: D1Database,
  analytics: AnalyticsEngineDataset
): Hono {
  const router = new Hono();
  
  const alertScheduler = new AlertSchedulerService(db, analytics);

  /**
   * Main alert evaluation job
   * POST /api/alerts/jobs/evaluate
   * Triggered every 5 minutes via cron
   */
  router.post('/evaluate', async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      console.log('Starting scheduled alert evaluation job...');
      const startTime = Date.now();
      
      const result = await alertScheduler.runAlertEvaluation();
      
      const duration = Date.now() - startTime;
      console.log(`Alert evaluation job completed in ${duration}ms:`, result);
      
      // Store job execution metrics
      await analytics.writeDataPoint({
        blobs: ['alert_job_execution'],
        doubles: [duration],
        indexes: ['alert_evaluation'],
        dimensions: {
          job_type: 'alert_evaluation',
          status: result.errors.length > 0 ? 'partial_success' : 'success',
          evaluated_rules: result.evaluatedRules.toString(),
          triggered_alerts: result.triggeredAlerts.toString(),
          sent_notifications: result.sentNotifications.toString()
        }
      });
      
      return new Response(JSON.stringify({
        success: true,
        duration,
        ...result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Alert evaluation job failed:', error);
      
      // Store failure metrics
      await analytics.writeDataPoint({
        blobs: ['alert_job_execution'],
        doubles: [Date.now()],
        indexes: ['alert_evaluation_failed'],
        dimensions: {
          job_type: 'alert_evaluation',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  /**
   * Notification retry job
   * POST /api/alerts/jobs/retry-notifications
   * Triggered every 15 minutes via cron
   */
  router.post('/retry-notifications', async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      console.log('Starting notification retry job...');
      const startTime = Date.now();
      
      const result = await alertScheduler.retryFailedNotifications();
      
      const duration = Date.now() - startTime;
      console.log(`Notification retry job completed in ${duration}ms:`, result);
      
      // Store job execution metrics
      await analytics.writeDataPoint({
        blobs: ['alert_job_execution'],
        doubles: [duration],
        indexes: ['notification_retry'],
        dimensions: {
          job_type: 'notification_retry',
          status: result.errors.length > 0 ? 'partial_success' : 'success',
          retried_count: result.retriedCount.toString()
        }
      });
      
      return new Response(JSON.stringify({
        success: true,
        duration,
        ...result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Notification retry job failed:', error);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  /**
   * Alert cleanup job
   * POST /api/alerts/jobs/cleanup
   * Triggered daily via cron
   */
  router.post('/cleanup', async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      console.log('Starting alert cleanup job...');
      const startTime = Date.now();
      
      const result = await alertScheduler.cleanupOldAlertData();
      
      const duration = Date.now() - startTime;
      console.log(`Alert cleanup job completed in ${duration}ms:`, result);
      
      // Store job execution metrics
      await analytics.writeDataPoint({
        blobs: ['alert_job_execution'],
        doubles: [duration],
        indexes: ['alert_cleanup'],
        dimensions: {
          job_type: 'alert_cleanup',
          status: 'success',
          deleted_evaluations: result.deletedEvaluations.toString(),
          deleted_deliveries: result.deletedDeliveries.toString()
        }
      });
      
      return new Response(JSON.stringify({
        success: true,
        duration,
        ...result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Alert cleanup job failed:', error);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  /**
   * Alert health check job
   * POST /api/alerts/jobs/health-check
   * Triggered every 5 minutes via cron
   */
  router.post('/health-check', async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      console.log('Starting alert health check job...');
      const startTime = Date.now();
      
      const stats = await alertScheduler.getSchedulerStatistics();
      
      const duration = Date.now() - startTime;
      
      // Check for potential issues
      const issues: string[] = [];
      
      if (stats.failedNotifications > 10) {
        issues.push(`High failed notification count: ${stats.failedNotifications}`);
      }
      
      if (stats.pendingEscalations > 5) {
        issues.push(`High pending escalation count: ${stats.pendingEscalations}`);
      }
      
      if (stats.lastEvaluationTime) {
        const lastEvalTime = new Date(stats.lastEvaluationTime).getTime();
        const timeSinceLastEval = Date.now() - lastEvalTime;
        if (timeSinceLastEval > 10 * 60 * 1000) { // 10 minutes
          issues.push(`Last evaluation was ${Math.round(timeSinceLastEval / 60000)} minutes ago`);
        }
      }
      
      // Store health metrics
      await analytics.writeDataPoint({
        blobs: ['alert_health_check'],
        doubles: [duration, stats.activeAlerts, stats.failedNotifications, stats.pendingEscalations],
        indexes: ['health_check'],
        dimensions: {
          job_type: 'health_check',
          status: issues.length > 0 ? 'warning' : 'healthy',
          active_rules: stats.activeAlertRules.toString(),
          active_alerts: stats.activeAlerts.toString(),
          issues_count: issues.length.toString()
        }
      });
      
      console.log(`Alert health check completed in ${duration}ms. Issues: ${issues.length}`);
      
      return new Response(JSON.stringify({
        success: true,
        duration,
        stats,
        issues,
        healthy: issues.length === 0
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Alert health check job failed:', error);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  /**
   * Manual job trigger (admin only)
   * POST /api/alerts/jobs/trigger/:jobType
   */
  router.post('/trigger/:jobType', async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      const isAdmin = request.headers.get('X-Is-Admin') === 'true';
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const jobType = request.params?.jobType;
      
      if (!jobType) {
        return new Response(JSON.stringify({ error: 'Job type required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`Manually triggering job: ${jobType}`);
      const startTime = Date.now();
      let result: any;
      
      switch (jobType) {
        case 'evaluate':
          result = await alertScheduler.runAlertEvaluation();
          break;
        case 'retry-notifications':
          result = await alertScheduler.retryFailedNotifications();
          break;
        case 'cleanup':
          result = await alertScheduler.cleanupOldAlertData();
          break;
        case 'health-check':
          result = { stats: await alertScheduler.getSchedulerStatistics() };
          break;
        default:
          return new Response(JSON.stringify({ error: 'Unknown job type' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }
      
      const duration = Date.now() - startTime;
      
      // Store manual trigger metrics
      await analytics.writeDataPoint({
        blobs: ['alert_job_manual_trigger'],
        doubles: [duration],
        indexes: ['manual_trigger'],
        dimensions: {
          job_type: jobType,
          status: 'success',
          triggered_by: 'admin'
        }
      });
      
      return new Response(JSON.stringify({
        success: true,
        jobType,
        duration,
        result
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error(`Manual job trigger failed for ${request.params?.jobType}:`, error);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  /**
   * Get job execution history
   * GET /api/alerts/jobs/history
   */
  router.get('/history', async (request: Request, env: Env) => {
    try {
      const isAdmin = request.headers.get('X-Is-Admin') === 'true';
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const url = new URL(request.url);
      const jobType = url.searchParams.get('jobType');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      // Query Analytics Engine for job execution history
      // This is a simplified example - in practice you'd query the Analytics Engine API
      const mockHistory = [
        {
          timestamp: new Date().toISOString(),
          jobType: 'alert_evaluation',
          status: 'success',
          duration: 1250,
          evaluatedRules: 15,
          triggeredAlerts: 2,
          sentNotifications: 4
        },
        {
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          jobType: 'alert_evaluation',
          status: 'success',
          duration: 980,
          evaluatedRules: 15,
          triggeredAlerts: 0,
          sentNotifications: 0
        }
      ];
      
      const filteredHistory = jobType 
        ? mockHistory.filter(job => job.jobType === jobType)
        : mockHistory;
      
      return new Response(JSON.stringify({
        history: filteredHistory.slice(0, limit),
        total: filteredHistory.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  /**
   * Get job statistics
   * GET /api/alerts/jobs/stats
   */
  router.get('/stats', async (request: Request, env: Env) => {
    try {
      const isAdmin = request.headers.get('X-Is-Admin') === 'true';
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const stats = await alertScheduler.getSchedulerStatistics();
      
      // Get additional job performance stats
      // In practice, this would query Analytics Engine for aggregated job metrics
      const jobStats = {
        scheduler: stats,
        performance: {
          evaluationJobs: {
            avgDuration: 1150,
            successRate: 98.5,
            avgRulesEvaluated: 14.2,
            avgAlertsTriggered: 0.8
          },
          notificationJobs: {
            avgDuration: 320,
            successRate: 94.2,
            avgRetriesPerJob: 2.1
          },
          cleanupJobs: {
            avgDuration: 2400,
            successRate: 100,
            avgRecordsDeleted: 1250
          }
        },
        trends: {
          alertVolume: 'increasing',
          notificationReliability: 'stable',
          systemHealth: 'good'
        }
      };
      
      return new Response(JSON.stringify(jobStats), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  return router;
}