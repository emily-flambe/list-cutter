/**
 * Alert Management API Routes
 * Provides REST endpoints for alert system management
 */

import { Hono } from 'hono';
import { AlertManagementService } from '../services/monitoring/alert-management-service';
import { AlertEvaluationService } from '../services/monitoring/alert-evaluation-service';
import { NotificationService } from '../services/monitoring/notification-service';
import {
  AlertCreateRequest,
  AlertUpdateRequest,
  AlertAcknowledgeRequest,
  AlertResolveRequest,
  AlertTestRequest,
  AlertBulkOperationRequest,
  NotificationChannelCreateRequest,
  NotificationChannelUpdateRequest,
  AlertMetricsQuery
} from '../types/alerts';

export function createAlertRoutes(
  db: D1Database,
  analytics: AnalyticsEngineDataset
): Hono {
  const router = new Hono();
  
  const alertManagement = new AlertManagementService(db, analytics);
  const alertEvaluation = new AlertEvaluationService(db, analytics);
  const notificationService = new NotificationService(db);

  // ============================================================================
  // Alert Rule Management
  // ============================================================================

  /**
   * Create alert rule
   * POST /api/alerts/rules
   */
  router.post('/rules', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: AlertCreateRequest = await request.json();
      
      // Validate required fields
      if (!body.name || !body.alertType || !body.metricType || !body.thresholdValue || !body.thresholdOperator) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: name, alertType, metricType, thresholdValue, thresholdOperator' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const alertRule = await alertManagement.createAlertRule(userId, body);
      
      return new Response(JSON.stringify(alertRule), {
        status: 201,
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
   * List alert rules
   * GET /api/alerts/rules
   */
  router.get('/rules', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const url = new URL(request.url);
      
      const query: AlertMetricsQuery = {
        alertType: url.searchParams.get('alertType') as any,
        severity: url.searchParams.get('severity') as any,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined
      };

      const rules = await alertManagement.listAlertRules(userId || undefined, query);
      
      return new Response(JSON.stringify(rules), {
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
   * Get alert rule by ID
   * GET /api/alerts/rules/:id
   */
  router.get('/rules/:id', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const ruleId = request.params?.id;
      
      if (!ruleId) {
        return new Response(JSON.stringify({ error: 'Rule ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const rule = await alertManagement.getAlertRule(ruleId, userId || undefined);
      
      if (!rule) {
        return new Response(JSON.stringify({ error: 'Alert rule not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(rule), {
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
   * Update alert rule
   * PUT /api/alerts/rules/:id
   */
  router.put('/rules/:id', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const ruleId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!ruleId) {
        return new Response(JSON.stringify({ error: 'Rule ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: AlertUpdateRequest = await request.json();
      const rule = await alertManagement.updateAlertRule(ruleId, userId, body);
      
      return new Response(JSON.stringify(rule), {
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
   * Delete alert rule
   * DELETE /api/alerts/rules/:id
   */
  router.delete('/rules/:id', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const ruleId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!ruleId) {
        return new Response(JSON.stringify({ error: 'Rule ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await alertManagement.deleteAlertRule(ruleId, userId);
      
      return new Response(JSON.stringify({ success: true }), {
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
   * Test alert rule
   * POST /api/alerts/rules/:id/test
   */
  router.post('/rules/:id/test', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const ruleId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!ruleId) {
        return new Response(JSON.stringify({ error: 'Rule ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: AlertTestRequest = { ...await request.json(), alertRuleId: ruleId };
      const result = await alertManagement.testAlertRule(ruleId, userId, body);
      
      return new Response(JSON.stringify(result), {
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

  // ============================================================================
  // Alert Instance Management
  // ============================================================================

  /**
   * List alert instances
   * GET /api/alerts/instances
   */
  router.get('/instances', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const url = new URL(request.url);
      
      const query: AlertMetricsQuery = {
        state: url.searchParams.get('state') as any,
        severity: url.searchParams.get('severity') as any,
        alertType: url.searchParams.get('alertType') as any,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined
      };

      if (url.searchParams.get('startTime') && url.searchParams.get('endTime')) {
        query.timeRange = {
          startTime: url.searchParams.get('startTime')!,
          endTime: url.searchParams.get('endTime')!
        };
      }

      const instances = await alertManagement.listAlertInstances(userId || undefined, query);
      
      return new Response(JSON.stringify(instances), {
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
   * Get alert instance by ID
   * GET /api/alerts/instances/:id
   */
  router.get('/instances/:id', async (request: Request, env: Env) => {
    try {
      const alertId = request.params?.id;
      
      if (!alertId) {
        return new Response(JSON.stringify({ error: 'Alert ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const alert = await alertManagement.getAlertInstance(alertId);
      
      if (!alert) {
        return new Response(JSON.stringify({ error: 'Alert not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(alert), {
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
   * Acknowledge alert
   * POST /api/alerts/instances/:id/acknowledge
   */
  router.post('/instances/:id/acknowledge', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const alertId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!alertId) {
        return new Response(JSON.stringify({ error: 'Alert ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: AlertAcknowledgeRequest = await request.json();
      const alert = await alertManagement.acknowledgeAlert(alertId, userId, body);
      
      return new Response(JSON.stringify(alert), {
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
   * Resolve alert
   * POST /api/alerts/instances/:id/resolve
   */
  router.post('/instances/:id/resolve', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const alertId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!alertId) {
        return new Response(JSON.stringify({ error: 'Alert ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: AlertResolveRequest = await request.json();
      const alert = await alertManagement.resolveAlert(alertId, userId, body);
      
      return new Response(JSON.stringify(alert), {
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
   * Bulk operations on alerts
   * POST /api/alerts/instances/bulk
   */
  router.post('/instances/bulk', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: AlertBulkOperationRequest = await request.json();
      
      if (!body.alertInstanceIds || body.alertInstanceIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Alert instance IDs required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await alertManagement.bulkOperateAlerts(userId, body);
      
      return new Response(JSON.stringify(result), {
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

  // ============================================================================
  // Notification Channel Management
  // ============================================================================

  /**
   * Create notification channel
   * POST /api/alerts/channels
   */
  router.post('/channels', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: NotificationChannelCreateRequest = await request.json();
      
      if (!body.name || !body.channelType || !body.configuration) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: name, channelType, configuration' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const channel = await alertManagement.createNotificationChannel(userId, body);
      
      return new Response(JSON.stringify(channel), {
        status: 201,
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
   * List notification channels
   * GET /api/alerts/channels
   */
  router.get('/channels', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const channels = await alertManagement.listNotificationChannels(userId || undefined);
      
      return new Response(JSON.stringify(channels), {
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
   * Get notification channel by ID
   * GET /api/alerts/channels/:id
   */
  router.get('/channels/:id', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const channelId = request.params?.id;
      
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'Channel ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const channel = await alertManagement.getNotificationChannel(channelId, userId || undefined);
      
      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(channel), {
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
   * Update notification channel
   * PUT /api/alerts/channels/:id
   */
  router.put('/channels/:id', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const channelId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'Channel ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body: NotificationChannelUpdateRequest = await request.json();
      const channel = await alertManagement.updateNotificationChannel(channelId, userId, body);
      
      return new Response(JSON.stringify(channel), {
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
   * Delete notification channel
   * DELETE /api/alerts/channels/:id
   */
  router.delete('/channels/:id', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const channelId = request.params?.id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!channelId) {
        return new Response(JSON.stringify({ error: 'Channel ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await alertManagement.deleteNotificationChannel(channelId, userId);
      
      return new Response(JSON.stringify({ success: true }), {
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
   * Associate channel with alert rule
   * POST /api/alerts/rules/:ruleId/channels/:channelId
   */
  router.post('/rules/:ruleId/channels/:channelId', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const ruleId = request.params?.ruleId;
      const channelId = request.params?.channelId;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!ruleId || !channelId) {
        return new Response(JSON.stringify({ error: 'Rule ID and Channel ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await alertManagement.associateChannelWithRule(ruleId, channelId);
      
      return new Response(JSON.stringify({ success: true }), {
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
   * Dissociate channel from alert rule
   * DELETE /api/alerts/rules/:ruleId/channels/:channelId
   */
  router.delete('/rules/:ruleId/channels/:channelId', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const ruleId = request.params?.ruleId;
      const channelId = request.params?.channelId;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'User ID required' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (!ruleId || !channelId) {
        return new Response(JSON.stringify({ error: 'Rule ID and Channel ID required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await alertManagement.dissociateChannelFromRule(ruleId, channelId);
      
      return new Response(JSON.stringify({ success: true }), {
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

  // ============================================================================
  // Dashboard and Analytics
  // ============================================================================

  /**
   * Get alert dashboard
   * GET /api/alerts/dashboard
   */
  router.get('/dashboard', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const dashboard = await alertManagement.getAlertDashboard(userId || undefined);
      
      return new Response(JSON.stringify(dashboard), {
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
   * Get alert history
   * GET /api/alerts/history
   */
  router.get('/history', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const url = new URL(request.url);
      
      const query: AlertMetricsQuery = {
        alertType: url.searchParams.get('alertType') as any,
        severity: url.searchParams.get('severity') as any,
        state: url.searchParams.get('state') as any,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined
      };

      if (url.searchParams.get('startTime') && url.searchParams.get('endTime')) {
        query.timeRange = {
          startTime: url.searchParams.get('startTime')!,
          endTime: url.searchParams.get('endTime')!
        };
      }

      const history = await alertManagement.getAlertHistory(userId || undefined, query);
      
      return new Response(JSON.stringify(history), {
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

  // ============================================================================
  // System Operations (Admin only)
  // ============================================================================

  /**
   * Evaluate all alerts (manual trigger)
   * POST /api/alerts/evaluate
   */
  router.post('/evaluate', async (request: Request, env: Env) => {
    try {
      const isAdmin = request.headers.get('X-Is-Admin') === 'true';
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const evaluations = await alertEvaluation.evaluateAllAlerts();
      
      return new Response(JSON.stringify({
        success: true,
        evaluationsCount: evaluations.length,
        triggeredAlerts: evaluations.filter(e => e.alertTriggered).length
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
   * Retry failed notifications
   * POST /api/alerts/notifications/retry
   */
  router.post('/notifications/retry', async (request: Request, env: Env) => {
    try {
      const isAdmin = request.headers.get('X-Is-Admin') === 'true';
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      await notificationService.retryFailedDeliveries();
      
      return new Response(JSON.stringify({ success: true }), {
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