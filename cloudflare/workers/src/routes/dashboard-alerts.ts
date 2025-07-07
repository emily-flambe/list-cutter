/**
 * Alert Dashboard Integration
 * Provides enhanced dashboard endpoints with alert data
 */

import { Hono } from 'hono';
import { AlertManagementService } from '../services/monitoring/alert-management-service.js';
import { AlertSchedulerService } from '../services/monitoring/alert-scheduler.js';
import { EnhancedMetricsService } from '../services/monitoring/enhanced-metrics-service.js';

export function createAlertDashboardRoutes(
  db: D1Database,
  analytics: AnalyticsEngineDataset
): Hono {
  const router = new Hono();
  
  const alertManagement = new AlertManagementService(db, analytics);
  const alertScheduler = new AlertSchedulerService(db, analytics);
  const metricsService = new EnhancedMetricsService(db, analytics);

  /**
   * Get enhanced dashboard with alert data
   * GET /api/dashboard/enhanced
   */
  router.get('/enhanced', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      
      // Get base dashboard data
      const dashboardData = await metricsService.getUserDashboard(userId || '');
      
      // Get alert dashboard data
      const alertData = await alertManagement.getAlertDashboard(userId || undefined);
      
      // Get scheduler statistics
      const schedulerStats = await alertScheduler.getSchedulerStatistics();
      
      // Combine all data
      const enhancedDashboard = {
        ...dashboardData,
        alerts: {
          summary: {
            totalAlerts: alertData.totalAlerts,
            activeAlerts: alertData.activeAlerts,
            acknowledgedAlerts: alertData.acknowledgedAlerts,
            resolvedAlerts: alertData.resolvedAlerts
          },
          breakdown: {
            byType: alertData.alertsByType,
            bySeverity: alertData.alertsBySeverity,
            byState: alertData.alertsByState
          },
          recent: alertData.recentAlerts.slice(0, 5), // Top 5 recent alerts
          notifications: alertData.notificationStats,
          system: {
            activeRules: schedulerStats.activeAlertRules,
            pendingEscalations: schedulerStats.pendingEscalations,
            failedNotifications: schedulerStats.failedNotifications,
            lastEvaluationTime: schedulerStats.lastEvaluationTime
          }
        },
        healthStatus: await this.calculateHealthStatus(alertData, schedulerStats)
      };
      
      return new Response(JSON.stringify(enhancedDashboard), {
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
   * Get alert widget data for dashboard
   * GET /api/dashboard/alerts/widget
   */
  router.get('/alerts/widget', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      
      const alertData = await alertManagement.getAlertDashboard(userId || undefined);
      
      const widget = {
        summary: {
          active: alertData.activeAlerts,
          total: alertData.totalAlerts,
          critical: alertData.alertsBySeverity['critical'] || 0,
          high: alertData.alertsBySeverity['high'] || 0
        },
        recentAlerts: alertData.recentAlerts.slice(0, 3).map(alert => ({
          id: alert.id,
          ruleName: alert.alertRuleId, // Would need to join with rule name
          severity: 'high', // Would get from rule
          state: alert.state,
          startedAt: alert.startedAt,
          currentValue: alert.currentValue,
          thresholdValue: alert.thresholdValue
        })),
        trends: {
          alertsToday: await this.getAlertsInPeriod(userId, '1d'),
          alertsThisWeek: await this.getAlertsInPeriod(userId, '7d'),
          changeFromLastWeek: await this.getAlertTrendChange(userId)
        }
      };
      
      return new Response(JSON.stringify(widget), {
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
   * Get alert metrics for charts
   * GET /api/dashboard/alerts/metrics
   */
  router.get('/alerts/metrics', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const url = new URL(request.url);
      const timeRange = url.searchParams.get('timeRange') || '7d';
      
      const metrics = await this.getAlertMetricsForTimeRange(userId, timeRange);
      
      return new Response(JSON.stringify(metrics), {
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
   * Get alert heatmap data
   * GET /api/dashboard/alerts/heatmap
   */
  router.get('/alerts/heatmap', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const url = new URL(request.url);
      const days = parseInt(url.searchParams.get('days') || '30');
      
      const heatmapData = await this.generateAlertHeatmap(userId, days);
      
      return new Response(JSON.stringify(heatmapData), {
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
   * Get notification delivery status
   * GET /api/dashboard/alerts/notifications
   */
  router.get('/alerts/notifications', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      const url = new URL(request.url);
      const timeRange = url.searchParams.get('timeRange') || '24h';
      
      const notificationStats = await this.getNotificationDeliveryStats(userId, timeRange);
      
      return new Response(JSON.stringify(notificationStats), {
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
   * Get alert rule performance
   * GET /api/dashboard/alerts/rules/performance
   */
  router.get('/alerts/rules/performance', async (request: Request, env: Env) => {
    try {
      const userId = request.headers.get('X-User-ID');
      
      const performance = await this.getAlertRulePerformance(userId);
      
      return new Response(JSON.stringify(performance), {
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
   * Get system health dashboard (admin only)
   * GET /api/dashboard/alerts/system
   */
  router.get('/alerts/system', async (request: Request, env: Env) => {
    try {
      const isAdmin = request.headers.get('X-Is-Admin') === 'true';
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const systemHealth = await this.getSystemHealthDashboard();
      
      return new Response(JSON.stringify(systemHealth), {
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
  // Helper Methods
  // ============================================================================

  async function calculateHealthStatus(alertData: any, schedulerStats: any): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    factors: Array<{ name: string; status: string; weight: number }>;
  }> {
    const factors = [
      {
        name: 'Active Alerts',
        status: alertData.activeAlerts === 0 ? 'good' : alertData.activeAlerts < 5 ? 'warning' : 'critical',
        weight: 0.3
      },
      {
        name: 'Failed Notifications',
        status: schedulerStats.failedNotifications === 0 ? 'good' : schedulerStats.failedNotifications < 3 ? 'warning' : 'critical',
        weight: 0.2
      },
      {
        name: 'Notification Delivery Rate',
        status: alertData.notificationStats.deliveryRate > 95 ? 'good' : alertData.notificationStats.deliveryRate > 85 ? 'warning' : 'critical',
        weight: 0.2
      },
      {
        name: 'Alert Escalations',
        status: schedulerStats.pendingEscalations === 0 ? 'good' : schedulerStats.pendingEscalations < 3 ? 'warning' : 'critical',
        weight: 0.15
      },
      {
        name: 'System Responsiveness',
        status: schedulerStats.lastEvaluationTime && 
                (Date.now() - new Date(schedulerStats.lastEvaluationTime).getTime()) < 10 * 60 * 1000 ? 'good' : 'warning',
        weight: 0.15
      }
    ];

    let totalScore = 0;
    factors.forEach(factor => {
      const score = factor.status === 'good' ? 100 : factor.status === 'warning' ? 70 : 30;
      totalScore += score * factor.weight;
    });

    const overallScore = Math.round(totalScore);
    let status: 'healthy' | 'warning' | 'critical';
    
    if (overallScore >= 85) status = 'healthy';
    else if (overallScore >= 60) status = 'warning';
    else status = 'critical';

    return { status, score: overallScore, factors };
  }

  async function getAlertsInPeriod(userId: string | null, period: string): Promise<number> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];
    
    const intervalMap: Record<string, string> = {
      '1d': '-1 day',
      '7d': '-7 days',
      '30d': '-30 days'
    };
    
    const interval = intervalMap[period] || '-1 day';
    
    const result = await db.prepare(`
      SELECT COUNT(*) as count
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= datetime('now', '${interval}') ${userFilter}
    `).bind(...params).first();
    
    return result?.count || 0;
  }

  async function getAlertTrendChange(userId: string | null): Promise<number> {
    const thisWeek = await getAlertsInPeriod(userId, '7d');
    
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];
    
    const lastWeekResult = await db.prepare(`
      SELECT COUNT(*) as count
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= datetime('now', '-14 days')
      AND ai.started_at < datetime('now', '-7 days') ${userFilter}
    `).bind(...params).first();
    
    const lastWeek = lastWeekResult?.count || 0;
    
    if (lastWeek === 0) return thisWeek > 0 ? 100 : 0;
    
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  }

  async function getAlertMetricsForTimeRange(userId: string | null, timeRange: string): Promise<any> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];
    
    const intervalMap: Record<string, string> = {
      '1d': '-1 day',
      '7d': '-7 days',
      '30d': '-30 days'
    };
    
    const interval = intervalMap[timeRange] || '-7 days';
    
    // Get hourly alert counts for the time range
    const alertCounts = await db.prepare(`
      SELECT 
        date(ai.started_at) as date,
        strftime('%H', ai.started_at) as hour,
        COUNT(*) as count,
        ar.severity
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= datetime('now', '${interval}') ${userFilter}
      GROUP BY date(ai.started_at), strftime('%H', ai.started_at), ar.severity
      ORDER BY ai.started_at
    `).bind(...params).all();
    
    // Get evaluation metrics
    const evaluationMetrics = await db.prepare(`
      SELECT 
        date(ae.evaluation_time) as date,
        COUNT(*) as evaluations,
        COUNT(CASE WHEN ae.alert_triggered = 1 THEN 1 END) as triggered,
        AVG(ae.evaluation_duration_ms) as avg_duration
      FROM alert_evaluations ae
      JOIN alert_rules ar ON ae.alert_rule_id = ar.id
      WHERE ae.evaluation_time >= datetime('now', '${interval}') ${userFilter}
      GROUP BY date(ae.evaluation_time)
      ORDER BY ae.evaluation_time
    `).bind(...params).all();
    
    return {
      alertCounts: alertCounts.results,
      evaluationMetrics: evaluationMetrics.results,
      timeRange,
      generatedAt: new Date().toISOString()
    };
  }

  async function generateAlertHeatmap(userId: string | null, days: number): Promise<any> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [days, userId] : [days];
    
    const heatmapData = await db.prepare(`
      SELECT 
        date(ai.started_at) as date,
        strftime('%H', ai.started_at) as hour,
        COUNT(*) as alert_count,
        ar.severity,
        ar.alert_type
      FROM alert_instances ai
      JOIN alert_rules ar ON ai.alert_rule_id = ar.id
      WHERE ai.started_at >= datetime('now', '-' || ? || ' days') ${userFilter}
      GROUP BY date(ai.started_at), strftime('%H', ai.started_at), ar.severity, ar.alert_type
      ORDER BY ai.started_at
    `).bind(...params).all();
    
    // Process into 24x7 grid format
    const grid: any[][] = [];
    for (let day = 0; day < days; day++) {
      const dayData: any[] = [];
      for (let hour = 0; hour < 24; hour++) {
        dayData.push({ hour, alerts: 0, severity: 'none' });
      }
      grid.push(dayData);
    }
    
    // Fill grid with actual data
    heatmapData.results.forEach((row: any) => {
      const date = new Date(row.date);
      const dayIndex = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      const hour = parseInt(row.hour);
      
      if (dayIndex >= 0 && dayIndex < days && hour >= 0 && hour < 24) {
        grid[dayIndex][hour].alerts += row.alert_count;
        // Set highest severity
        if (row.severity === 'critical' || grid[dayIndex][hour].severity === 'none') {
          grid[dayIndex][hour].severity = row.severity;
        }
      }
    });
    
    return {
      grid,
      days,
      maxAlerts: Math.max(...grid.flat().map(cell => cell.alerts)),
      generatedAt: new Date().toISOString()
    };
  }

  async function getNotificationDeliveryStats(userId: string | null, timeRange: string): Promise<any> {
    const userFilter = userId ? 'AND nc.user_id = ?' : '';
    const params = userId ? [userId] : [];
    
    const intervalMap: Record<string, string> = {
      '1h': '-1 hour',
      '24h': '-24 hours',
      '7d': '-7 days'
    };
    
    const interval = intervalMap[timeRange] || '-24 hours';
    
    const deliveryStats = await db.prepare(`
      SELECT 
        nc.channel_type,
        nd.delivery_status,
        COUNT(*) as count,
        AVG(
          CASE WHEN nd.delivered_at IS NOT NULL AND nd.sent_at IS NOT NULL
          THEN (julianday(nd.delivered_at) - julianday(nd.sent_at)) * 24 * 60 * 60
          END
        ) as avg_delivery_time_seconds
      FROM notification_deliveries nd
      JOIN notification_channels nc ON nd.notification_channel_id = nc.id
      WHERE nd.created_at >= datetime('now', '${interval}') ${userFilter}
      GROUP BY nc.channel_type, nd.delivery_status
    `).bind(...params).all();
    
    const channelPerformance = await db.prepare(`
      SELECT 
        nc.channel_type,
        nc.name,
        COUNT(nd.id) as total_deliveries,
        COUNT(CASE WHEN nd.delivery_status IN ('sent', 'delivered') THEN 1 END) as successful_deliveries,
        COUNT(CASE WHEN nd.delivery_status = 'failed' THEN 1 END) as failed_deliveries
      FROM notification_channels nc
      LEFT JOIN notification_deliveries nd ON nc.id = nd.notification_channel_id
        AND nd.created_at >= datetime('now', '${interval}')
      WHERE 1=1 ${userFilter}
      GROUP BY nc.id, nc.channel_type, nc.name
    `).bind(...params).all();
    
    return {
      deliveryStats: deliveryStats.results,
      channelPerformance: channelPerformance.results,
      timeRange,
      generatedAt: new Date().toISOString()
    };
  }

  async function getAlertRulePerformance(userId: string | null): Promise<any> {
    const userFilter = userId ? 'AND ar.user_id = ?' : '';
    const params = userId ? [userId] : [];
    
    const rulePerformance = await db.prepare(`
      SELECT 
        ar.id,
        ar.name,
        ar.alert_type,
        ar.severity,
        ar.enabled,
        COUNT(DISTINCT ae.id) as total_evaluations,
        COUNT(DISTINCT CASE WHEN ae.alert_triggered = 1 THEN ae.id END) as triggered_evaluations,
        COUNT(DISTINCT ai.id) as total_alerts,
        COUNT(DISTINCT CASE WHEN ai.state = 'resolved' THEN ai.id END) as resolved_alerts,
        AVG(ae.evaluation_duration_ms) as avg_evaluation_time,
        AVG(
          CASE WHEN ai.resolved_at IS NOT NULL
          THEN (julianday(ai.resolved_at) - julianday(ai.started_at)) * 24 * 60
          END
        ) as avg_resolution_time_minutes,
        MAX(ai.started_at) as last_triggered
      FROM alert_rules ar
      LEFT JOIN alert_evaluations ae ON ar.id = ae.alert_rule_id
        AND ae.created_at >= datetime('now', '-30 days')
      LEFT JOIN alert_instances ai ON ar.id = ai.alert_rule_id
        AND ai.created_at >= datetime('now', '-30 days')
      WHERE 1=1 ${userFilter}
      GROUP BY ar.id, ar.name, ar.alert_type, ar.severity, ar.enabled
      ORDER BY ar.name
    `).bind(...params).all();
    
    return {
      rules: rulePerformance.results.map((rule: any) => ({
        ...rule,
        triggerRate: rule.total_evaluations > 0 ? (rule.triggered_evaluations / rule.total_evaluations) * 100 : 0,
        resolutionRate: rule.total_alerts > 0 ? (rule.resolved_alerts / rule.total_alerts) * 100 : 0
      })),
      generatedAt: new Date().toISOString()
    };
  }

  async function getSystemHealthDashboard(): Promise<any> {
    const systemStats = await alertScheduler.getSchedulerStatistics();
    
    const globalAlertStats = await db.prepare(`
      SELECT 
        COUNT(DISTINCT ar.id) as total_rules,
        COUNT(DISTINCT ar.user_id) as users_with_alerts,
        COUNT(DISTINCT ai.id) as total_alerts_30d,
        COUNT(DISTINCT CASE WHEN ai.state = 'active' THEN ai.id END) as active_alerts,
        COUNT(DISTINCT nc.id) as total_channels
      FROM alert_rules ar
      LEFT JOIN alert_instances ai ON ar.id = ai.alert_rule_id
        AND ai.created_at >= datetime('now', '-30 days')
      LEFT JOIN notification_channels nc ON 1=1
    `).first();
    
    const evaluationStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_evaluations_24h,
        COUNT(CASE WHEN alert_triggered = 1 THEN 1 END) as triggered_evaluations_24h,
        AVG(evaluation_duration_ms) as avg_evaluation_time,
        MAX(evaluation_time) as last_evaluation
      FROM alert_evaluations
      WHERE created_at >= datetime('now', '-1 day')
    `).first();
    
    const notificationStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_notifications_24h,
        COUNT(CASE WHEN delivery_status IN ('sent', 'delivered') THEN 1 END) as successful_notifications_24h,
        COUNT(CASE WHEN delivery_status = 'failed' THEN 1 END) as failed_notifications_24h
      FROM notification_deliveries
      WHERE created_at >= datetime('now', '-1 day')
    `).first();
    
    return {
      overview: {
        ...systemStats,
        ...globalAlertStats,
        ...evaluationStats,
        ...notificationStats
      },
      health: await calculateHealthStatus({ 
        activeAlerts: systemStats.activeAlerts,
        notificationStats: { 
          deliveryRate: notificationStats?.total_notifications_24h > 0 
            ? (notificationStats.successful_notifications_24h / notificationStats.total_notifications_24h) * 100 
            : 100 
        }
      }, systemStats),
      generatedAt: new Date().toISOString()
    };
  }

  return router;
}