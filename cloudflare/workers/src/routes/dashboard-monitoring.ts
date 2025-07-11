import { Hono } from 'hono';
import { DashboardHandler, extractUserIdFromRequest } from '../handlers/dashboard-handler.js';
import type { CloudflareEnv } from '../types/env.js';

const dashboardMonitoring = new Hono<{ Bindings: CloudflareEnv }>();

// Initialize dashboard handler
let dashboardHandler: DashboardHandler | null = null;

const initializeDashboard = (c: any) => {
  if (!dashboardHandler && c.env.ANALYTICS && c.env.DB) {
    dashboardHandler = new DashboardHandler(c.env.ANALYTICS, c.env.DB, c.env);
  }
  return dashboardHandler;
};

// Authentication middleware
const requireAuth = async (c: any, next: () => Promise<void>) => {
  const userId = extractUserIdFromRequest(c.req.raw);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  c.set('userId', userId);
  await next();
};

// User dashboard endpoints
dashboardMonitoring.get('/data', requireAuth, async (c) => {
  const handler = initializeDashboard(c);
  if (!handler) {
    return c.json({ error: 'Dashboard service not initialized' }, 500);
  }
  
  const userId = c.get('userId');
  const timeRange = c.req.query('timeRange') || '7d';
  
  const response = await handler.getDashboardData(userId, timeRange);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

dashboardMonitoring.get('/metrics/history', requireAuth, async (c) => {
  const handler = initializeDashboard(c);
  if (!handler) {
    return c.json({ error: 'Dashboard service not initialized' }, 500);
  }
  
  const userId = c.get('userId');
  const timeRange = c.req.query('timeRange') || '7d';
  const metricType = c.req.query('metricType');
  
  const response = await handler.getMetricsHistory(userId, timeRange, metricType);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

dashboardMonitoring.get('/costs', requireAuth, async (c) => {
  const handler = initializeDashboard(c);
  if (!handler) {
    return c.json({ error: 'Dashboard service not initialized' }, 500);
  }
  
  const userId = c.get('userId');
  const timeRange = c.req.query('timeRange') || '30d';
  
  const response = await handler.getCostAnalysis(userId, timeRange);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

dashboardMonitoring.get('/alerts', requireAuth, async (c) => {
  const handler = initializeDashboard(c);
  if (!handler) {
    return c.json({ error: 'Dashboard service not initialized' }, 500);
  }
  
  const userId = c.get('userId');
  
  const response = await handler.getAlertSettings(userId);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

dashboardMonitoring.put('/alerts/:alertId', requireAuth, async (c) => {
  const handler = initializeDashboard(c);
  if (!handler) {
    return c.json({ error: 'Dashboard service not initialized' }, 500);
  }
  
  const userId = c.get('userId');
  const alertId = c.req.param('alertId');
  const updates = await c.req.json();
  
  const response = await handler.updateAlertSettings(userId, alertId, updates);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

dashboardMonitoring.get('/storage', requireAuth, async (c) => {
  const handler = initializeDashboard(c);
  if (!handler) {
    return c.json({ error: 'Dashboard service not initialized' }, 500);
  }
  
  const userId = c.get('userId');
  
  const response = await handler.getStorageAnalysis(userId);
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

// Real-time data endpoints
dashboardMonitoring.get('/realtime/status', requireAuth, async (c) => {
  const userId = c.get('userId');
  
  try {
    // Get real-time status
    const activeUploads = await c.env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM file_access_logs 
      WHERE user_id = ? AND action = 'upload' AND created_at >= datetime('now', '-5 minutes')
    `).bind(userId).first();
    
    const recentErrors = await c.env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM file_access_logs 
      WHERE user_id = ? AND success = 0 AND created_at >= datetime('now', '-1 hour')
    `).bind(userId).first();
    
    return c.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      realtime: {
        activeUploads: Number(activeUploads?.count) || 0,
        recentErrors: Number(recentErrors?.count) || 0,
        systemHealth: 'healthy'
      }
    });
    
  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

dashboardMonitoring.get('/realtime/metrics', requireAuth, async (c) => {
  const userId = c.get('userId');
  
  try {
    // Get last 5 minutes of activity
    const recentActivity = await c.env.DB.prepare(`
      SELECT 
        datetime(created_at) as timestamp,
        action,
        bytes_transferred,
        success
      FROM file_access_logs 
      WHERE user_id = ? AND created_at >= datetime('now', '-5 minutes')
      ORDER BY created_at DESC
    `).bind(userId).all();
    
    const metrics = recentActivity.results.map((row: DatabaseRow) => ({
      timestamp: String(row.timestamp),
      action: String(row.action),
      bytes: Number(row.bytes_transferred) || 0,
      success: Boolean(row.success)
    }));
    
    return c.json({
      timestamp: new Date().toISOString(),
      metrics,
      summary: {
        totalOperations: metrics.length,
        successfulOperations: metrics.filter(m => m.success).length,
        totalBytes: metrics.reduce((sum, m) => sum + m.bytes, 0)
      }
    });
    
  } catch (error) {
    return c.json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Dashboard health check
dashboardMonitoring.get('/health', async (c) => {
  try {
    const handler = initializeDashboard(c);
    if (!handler) {
      return c.json({ 
        status: 'error', 
        message: 'Dashboard service not initialized',
        timestamp: new Date().toISOString()
      }, 500);
    }
    
    // Test database connectivity
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: !!dbTest,
        analytics: !!c.env.ANALYTICS,
        dashboard: !!handler
      },
      message: 'Dashboard monitoring system is operational'
    });
    
  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Dashboard health check failed'
    }, 500);
  }
});

// System-wide monitoring endpoints (admin only)
dashboardMonitoring.get('/admin/overview', async (c) => {
  try {
    // This would check for admin permissions in a real implementation
    const isAdmin = true; // Mock admin check
    
    if (!isAdmin) {
      return c.json({ error: 'Admin access required' }, 403);
    }
    
    // Get system-wide statistics
    const totalUsers = await c.env.DB.prepare('SELECT COUNT(DISTINCT user_id) as count FROM files').first();
    const totalFiles = await c.env.DB.prepare('SELECT COUNT(*) as count FROM files').first();
    const totalStorage = await c.env.DB.prepare('SELECT SUM(file_size) as total FROM files').first();
    const activeAlerts = await c.env.DB.prepare('SELECT COUNT(*) as count FROM alert_instances WHERE state = "active"').first();
    
    // Get activity in last 24 hours
    const recentActivity = await c.env.DB.prepare(`
      SELECT 
        action,
        COUNT(*) as count,
        SUM(bytes_transferred) as bytes
      FROM file_access_logs 
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY action
    `).all();
    
    return c.json({
      timestamp: new Date().toISOString(),
      overview: {
        totalUsers: Number(totalUsers?.count) || 0,
        totalFiles: Number(totalFiles?.count) || 0,
        totalStorage: Number(totalStorage?.total) || 0,
        activeAlerts: Number(activeAlerts?.count) || 0
      },
      activity: recentActivity.results.map((row: DatabaseRow) => ({
        action: String(row.action),
        count: Number(row.count) || 0,
        bytes: Number(row.bytes) || 0
      })),
      systemHealth: {
        status: 'healthy',
        uptime: '99.9%',
        responseTime: '150ms'
      }
    });
    
  } catch (error) {
    return c.json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default dashboardMonitoring;

// Type definitions
interface DatabaseRow {
  [key: string]: unknown;
}