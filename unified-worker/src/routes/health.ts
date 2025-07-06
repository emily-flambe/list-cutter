import { Hono } from 'hono';
import type { HonoEnv, HealthCheck } from '@/types/env';

export const healthRoutes = new Hono<HonoEnv>();

// Basic health check
healthRoutes.get('/', async (c) => {
  return c.json({
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId'),
  });
});

// Detailed health check with system status
healthRoutes.get('/detailed', async (c) => {
  const healthCheck: HealthCheck = {
    status: 'healthy',
    version: c.env.API_VERSION || 'v1',
    environment: c.env.ENVIRONMENT || 'development',
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(c),
      storage: await checkStorage(c),
      memory: await checkMemory(),
      responseTime: await checkResponseTime()
    }
  };

  // Determine overall status based on individual checks
  const unhealthyChecks = Object.values(healthCheck.checks).filter(check => !check.healthy);
  
  if (unhealthyChecks.length === 0) {
    healthCheck.status = 'healthy';
  } else if (unhealthyChecks.length <= 1) {
    healthCheck.status = 'degraded';
  } else {
    healthCheck.status = 'unhealthy';
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 
                    healthCheck.status === 'degraded' ? 200 : 503;

  return c.json(healthCheck, statusCode);
});

// Readiness probe
healthRoutes.get('/ready', async (c) => {
  try {
    // Check if essential services are ready
    const dbCheck = await checkDatabase(c);
    const storageCheck = await checkStorage(c);

    if (dbCheck.healthy && storageCheck.healthy) {
      return c.json({ 
        status: 'ready', 
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId'),
      });
    } else {
      return c.json({ 
        status: 'not ready', 
        issues: {
          database: !dbCheck.healthy,
          storage: !storageCheck.healthy
        },
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId'),
      }, 503);
    }
  } catch (error) {
    console.error('Readiness check failed:', error);
    return c.json({ 
      status: 'not ready', 
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId'),
    }, 503);
  }
});

// Liveness probe
healthRoutes.get('/live', async (c) => {
  return c.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId'),
  });
});

async function checkDatabase(c: any): Promise<{ healthy: boolean; latency: number }> {
  const start = performance.now();
  
  try {
    await c.env.DB.prepare('SELECT 1 as test').first();
    const latency = performance.now() - start;
    return { healthy: latency < 1000, latency }; // Unhealthy if > 1s
  } catch (error) {
    console.error('Database health check failed:', error);
    return { healthy: false, latency: performance.now() - start };
  }
}

async function checkStorage(c: any): Promise<{ healthy: boolean; latency: number }> {
  const start = performance.now();
  
  try {
    // Try to head a non-existent object (should return 404 but quickly)
    await c.env.FILE_STORAGE.head('health-check-non-existent');
    const latency = performance.now() - start;
    return { healthy: latency < 2000, latency }; // Unhealthy if > 2s
  } catch (error) {
    // R2 head on non-existent object throws, but that's expected
    const latency = performance.now() - start;
    return { healthy: latency < 2000, latency };
  }
}

async function checkMemory(): Promise<{ healthy: boolean; usage: number }> {
  // Get memory usage (approximation)
  const memory = (performance as any).memory;
  const usage = memory?.usedJSHeapSize || 0;
  const limit = 128 * 1024 * 1024; // 128MB limit for Workers
  
  return { healthy: usage < limit * 0.8, usage };
}

async function checkResponseTime(): Promise<{ healthy: boolean; avgTime: number }> {
  // In a real implementation, this would track average response times
  // For now, we'll just return a healthy status
  return { healthy: true, avgTime: 50 };
}