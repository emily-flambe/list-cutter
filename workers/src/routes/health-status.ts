import { Hono } from 'hono';
import type { Env } from '../types';
import { errorHandler } from '../middleware/error';
import { HealthMonitor } from '../services/failover/health-monitor';
import { R2FailoverService } from '../services/storage/r2-failover';
import { NotificationService } from '../services/failover/notification';

const healthStatusRouter = new Hono<{ Bindings: Env }>();

/**
 * Get overall system health status
 */
healthStatusRouter.get('/status', async (c) => {
  try {
    const healthMonitor = new HealthMonitor(c.env);
    const summary = await healthMonitor.getSystemHealthSummary();
    
    return c.json({
      success: true,
      data: summary
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get detailed service statuses
 */
healthStatusRouter.get('/services', async (c) => {
  try {
    const healthMonitor = new HealthMonitor(c.env);
    const statuses = await healthMonitor.getAllServiceStatuses();
    
    return c.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get health metrics for a specific service
 */
healthStatusRouter.get('/services/:serviceName', async (c) => {
  try {
    const serviceName = c.req.param('serviceName');
    const healthMonitor = new HealthMonitor(c.env);
    
    const [status, metrics] = await Promise.all([
      healthMonitor.getServiceStatus(serviceName),
      healthMonitor.checkServiceHealth(serviceName)
    ]);
    
    if (!status) {
      return c.json({
        success: false,
        error: 'Service not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: {
        status,
        current_metrics: metrics
      }
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Trigger health check for all services
 */
healthStatusRouter.post('/check', async (c) => {
  try {
    const healthMonitor = new HealthMonitor(c.env);
    const results = await healthMonitor.checkAllServicesHealth();
    
    return c.json({
      success: true,
      data: results,
      message: 'Health check completed'
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get recent system events
 */
healthStatusRouter.get('/events', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const healthMonitor = new HealthMonitor(c.env);
    const events = await healthMonitor.getRecentSystemEvents(limit);
    
    return c.json({
      success: true,
      data: events
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get R2 failover service status
 */
healthStatusRouter.get('/r2/status', async (c) => {
  try {
    const r2Service = new R2FailoverService(c.env);
    const [serviceStatus, healthMetrics, isReadOnly] = await Promise.all([
      r2Service.getServiceStatus(),
      r2Service.getHealthMetrics(),
      r2Service.isReadOnlyMode()
    ]);
    
    return c.json({
      success: true,
      data: {
        service_status: serviceStatus,
        health_metrics: healthMetrics,
        read_only_mode: isReadOnly
      }
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Test R2 connectivity
 */
healthStatusRouter.post('/r2/test', async (c) => {
  try {
    const r2Service = new R2FailoverService(c.env);
    const result = await r2Service.checkHealth();
    
    return c.json({
      success: true,
      data: result,
      message: result.success ? 'R2 connectivity test passed' : 'R2 connectivity test failed'
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get user notifications (requires authentication in real implementation)
 */
healthStatusRouter.get('/notifications/:userId', async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const unreadOnly = c.req.query('unread') === 'true';
    const limit = parseInt(c.req.query('limit') || '50');
    
    const notificationService = new NotificationService(c.env);
    const [notifications, unreadCount, stats] = await Promise.all([
      notificationService.getUserNotifications(userId, { unreadOnly, limit }),
      notificationService.getUnreadCount(userId),
      notificationService.getNotificationStats(userId)
    ]);
    
    return c.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount,
        stats
      }
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Mark notification as read
 */
healthStatusRouter.post('/notifications/:notificationId/read', async (c) => {
  try {
    const notificationId = parseInt(c.req.param('notificationId'));
    const body = await c.req.json();
    const userId = body.userId; // In real implementation, get from auth context
    
    const notificationService = new NotificationService(c.env);
    const success = await notificationService.markAsRead(notificationId, userId);
    
    if (!success) {
      return c.json({
        success: false,
        error: 'Notification not found or already read'
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Send test notification (admin endpoint)
 */
healthStatusRouter.post('/notifications/test', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, type, message, severity } = body;
    
    const notificationService = new NotificationService(c.env);
    const notificationId = await notificationService.sendUserNotification(
      userId,
      type,
      message,
      severity || 'INFO'
    );
    
    return c.json({
      success: true,
      data: { notificationId },
      message: 'Test notification sent'
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get operation queue status
 */
healthStatusRouter.get('/queue/status', async (c) => {
  try {
    const env = c.env;
    
    // Get queue statistics
    const [queueSize, pendingOps, processingOps, failedOps] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM operation_queue WHERE status IN (?, ?)').bind('PENDING', 'PROCESSING').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM operation_queue WHERE status = ?').bind('PENDING').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM operation_queue WHERE status = ?').bind('PROCESSING').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM operation_queue WHERE status = ?').bind('FAILED').first()
    ]);
    
    return c.json({
      success: true,
      data: {
        total_queued: queueSize?.count || 0,
        pending: pendingOps?.count || 0,
        processing: processingOps?.count || 0,
        failed: failedOps?.count || 0
      }
    });
  } catch (error) {
    return errorHandler(error);
  }
});

/**
 * Get recent operations in queue
 */
healthStatusRouter.get('/queue/operations', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const status = c.req.query('status') || 'PENDING';
    
    const result = await c.env.DB.prepare(`
      SELECT * FROM operation_queue 
      WHERE status = ? 
      ORDER BY priority ASC, created_at ASC 
      LIMIT ?
    `).bind(status, limit).all();
    
    return c.json({
      success: true,
      data: result.results
    });
  } catch (error) {
    return errorHandler(error);
  }
});

export { healthStatusRouter };