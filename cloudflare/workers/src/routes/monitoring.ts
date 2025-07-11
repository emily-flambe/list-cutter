import { Hono } from 'hono';
import { MonitoringHandler } from '../handlers/monitoring-handler.js';
import type { CloudflareEnv } from '../types/env.js';

const monitoring = new Hono<{ Bindings: CloudflareEnv }>();

// Initialize monitoring handler
let monitoringHandler: MonitoringHandler | null = null;

const initializeMonitoring = (c: any) => {
  if (!monitoringHandler && c.env.ANALYTICS && c.env.DB) {
    monitoringHandler = new MonitoringHandler(c.env.ANALYTICS, c.env.DB, c.env);
  }
  return monitoringHandler;
};

// Monitoring cron job endpoints
monitoring.post('/collect-metrics', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  const response = await handler.handleMetricsCollection();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/calculate-costs', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  const response = await handler.handleCostCalculation();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/check-alerts', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  const response = await handler.handleAlertChecking();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/generate-daily-report', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  const response = await handler.handleDailyReport();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/generate-monthly-report', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  const response = await handler.handleMonthlyReport();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/cleanup-old-metrics', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  const response = await handler.handleCleanupOldMetrics();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

// Health check endpoint for monitoring system
monitoring.get('/health', async (c) => {
  try {
    const handler = initializeMonitoring(c);
    if (!handler) {
      return c.json({ 
        status: 'error', 
        message: 'Monitoring service not initialized',
        timestamp: new Date().toISOString()
      }, 500);
    }
    
    // Check database connectivity
    const dbCheck = await c.env.DB.prepare('SELECT 1').first();
    
    // Check analytics engine availability
    const analyticsCheck = !!c.env.ANALYTICS;
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: !!dbCheck,
        analytics: analyticsCheck,
        monitoring: !!handler
      },
      message: 'Monitoring system is operational'
    });
  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Monitoring system health check failed'
    }, 500);
  }
});

// Manual trigger endpoints for testing
monitoring.post('/trigger/collect-metrics', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  console.log('Manual trigger: metrics collection');
  const response = await handler.handleMetricsCollection();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/trigger/calculate-costs', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  console.log('Manual trigger: cost calculation');
  const response = await handler.handleCostCalculation();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

monitoring.post('/trigger/check-alerts', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  console.log('Manual trigger: alert checking');
  const response = await handler.handleAlertChecking();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

// Status endpoint for monitoring overview
monitoring.get('/status', async (c) => {
  try {
    const handler = initializeMonitoring(c);
    if (!handler) {
      return c.json({ error: 'Monitoring service not initialized' }, 500);
    }
    
    // Get basic statistics
    const totalFiles = await c.env.DB.prepare('SELECT COUNT(*) as count FROM files').first();
    const totalUsers = await c.env.DB.prepare('SELECT COUNT(DISTINCT user_id) as count FROM files').first();
    const activeAlerts = await c.env.DB.prepare('SELECT COUNT(*) as count FROM alert_instances WHERE state = "active"').first();
    const todayUploads = await c.env.DB.prepare('SELECT COUNT(*) as count FROM files WHERE DATE(created_at) = DATE("now")').first();
    
    return c.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      statistics: {
        totalFiles: Number(totalFiles?.count) || 0,
        totalUsers: Number(totalUsers?.count) || 0,
        activeAlerts: Number(activeAlerts?.count) || 0,
        todayUploads: Number(todayUploads?.count) || 0
      },
      monitoring: {
        metricsCollection: 'active',
        costCalculation: 'active',
        alerting: 'active',
        cleanup: 'active'
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

// Alert initialization endpoint (for setup)
monitoring.post('/initialize-alerts', async (c) => {
  const handler = initializeMonitoring(c);
  if (!handler) {
    return c.json({ error: 'Monitoring service not initialized' }, 500);
  }
  
  console.log('Manual trigger: initialize default alerts');
  const response = await handler.initializeDefaultAlerts();
  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
});

export default monitoring;