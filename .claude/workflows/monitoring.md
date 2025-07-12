# Monitoring and Observability

## Monitoring Strategy

### Monitoring Pillars
- **Metrics**: Quantitative measurements of system behavior
- **Logs**: Detailed records of system events
- **Traces**: Request flow through distributed system
- **Alerts**: Proactive notifications of issues

### Monitoring Levels
- **Infrastructure**: Cloudflare Workers, D1, R2 health
- **Application**: Business logic, user flows, performance
- **Business**: User engagement, feature usage, revenue impact
- **Security**: Threat detection, compliance, incidents

## Health Monitoring

### Health Check Endpoints
```typescript
// Basic health check
app.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '1.0.0'
  });
});

// Detailed health check
app.get('/health/detailed', async (c) => {
  const services = await Promise.allSettled([
    checkDatabaseHealth(c),
    checkR2Health(c),
    checkAuthHealth(c)
  ]);

  return c.json({
    status: services.every(s => s.status === 'fulfilled') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: services[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      storage: services[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      auth: services[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
    },
    details: services.map(s => s.status === 'rejected' ? s.reason : null).filter(Boolean)
  });
});
```

### Database Health Monitoring
```typescript
export const checkDatabaseHealth = async (c: Context): Promise<boolean> => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as health_check').first();
    return result?.health_check === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};
```

### R2 Storage Health Monitoring
```typescript
export const checkR2Health = async (c: Context): Promise<boolean> => {
  try {
    // Test bucket access with a lightweight operation
    await c.env.R2.head('health-check-file');
    return true;
  } catch (error) {
    // If health check file doesn't exist, that's still healthy
    if (error.status === 404) return true;
    console.error('R2 health check failed:', error);
    return false;
  }
};
```

## Performance Monitoring

### Response Time Tracking
```typescript
export const performanceMiddleware = async (c: Context, next: Next) => {
  const startTime = Date.now();
  
  await next();
  
  const duration = Date.now() - startTime;
  const endpoint = c.req.path;
  const method = c.req.method;
  const status = c.res.status;
  
  // Log performance metrics
  console.log(JSON.stringify({
    type: 'performance',
    method,
    endpoint,
    duration,
    status,
    timestamp: new Date().toISOString()
  }));
  
  // Set performance headers
  c.res.headers.set('X-Response-Time', `${duration}ms`);
  
  // Alert on slow responses
  if (duration > 5000) { // 5 seconds
    await logSlowResponseAlert(endpoint, duration);
  }
};
```

### Database Performance Monitoring
```typescript
export const monitorDatabaseQuery = async (query: string, params: any[], execution: () => Promise<any>) => {
  const startTime = Date.now();
  
  try {
    const result = await execution();
    const duration = Date.now() - startTime;
    
    // Log query performance
    console.log(JSON.stringify({
      type: 'database_performance',
      query: query.substring(0, 100), // Truncate for privacy
      duration,
      success: true,
      timestamp: new Date().toISOString()
    }));
    
    // Alert on slow queries
    if (duration > 1000) { // 1 second
      await logSlowQueryAlert(query, duration);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(JSON.stringify({
      type: 'database_error',
      query: query.substring(0, 100),
      duration,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    
    throw error;
  }
};
```

## Application Monitoring

### User Activity Tracking
```typescript
interface UserActivity {
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const trackUserActivity = async (activity: UserActivity) => {
  // Store in database for analytics
  await insertUserActivity(activity);
  
  // Real-time monitoring
  console.log(JSON.stringify({
    type: 'user_activity',
    ...activity
  }));
};
```

### File Processing Monitoring
```typescript
export const monitorFileProcessing = async (
  fileId: string,
  operation: string,
  execution: () => Promise<any>
) => {
  const startTime = Date.now();
  
  try {
    const result = await execution();
    const duration = Date.now() - startTime;
    
    await logFileProcessingMetrics({
      fileId,
      operation,
      duration,
      success: true,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logFileProcessingMetrics({
      fileId,
      operation,
      duration,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
};
```

## Error Monitoring

### Error Tracking
```typescript
interface ErrorEvent {
  type: 'application_error' | 'system_error' | 'user_error';
  message: string;
  stack?: string;
  userId?: string;
  endpoint: string;
  method: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const trackError = async (error: Error, context: Context) => {
  const errorEvent: ErrorEvent = {
    type: 'application_error',
    message: error.message,
    stack: error.stack,
    userId: context.get('user')?.id,
    endpoint: context.req.path,
    method: context.req.method,
    timestamp: new Date().toISOString(),
    metadata: {
      userAgent: context.req.header('User-Agent'),
      ipAddress: context.req.header('CF-Connecting-IP')
    }
  };
  
  // Log error
  console.error(JSON.stringify(errorEvent));
  
  // Store in database
  await insertErrorEvent(errorEvent);
  
  // Send alert for critical errors
  if (isCriticalError(error)) {
    await sendErrorAlert(errorEvent);
  }
};
```

### Error Rate Monitoring
```typescript
export const monitorErrorRate = async () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const errorCount = await getErrorCount(oneHourAgo, now);
  const totalRequests = await getRequestCount(oneHourAgo, now);
  
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  
  console.log(JSON.stringify({
    type: 'error_rate_metrics',
    errorCount,
    totalRequests,
    errorRate,
    timestamp: now.toISOString()
  }));
  
  // Alert on high error rate
  if (errorRate > 5) { // 5% error rate threshold
    await sendHighErrorRateAlert(errorRate, errorCount, totalRequests);
  }
};
```

## Security Monitoring

### Authentication Monitoring
```typescript
export const monitorAuthentication = async (
  event: 'login_attempt' | 'login_success' | 'login_failure' | 'logout',
  userId?: string,
  context?: Context
) => {
  const securityEvent = {
    type: 'auth_event',
    event,
    userId,
    ipAddress: context?.req.header('CF-Connecting-IP'),
    userAgent: context?.req.header('User-Agent'),
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(securityEvent));
  
  // Store security event
  await insertSecurityEvent(securityEvent);
  
  // Check for suspicious patterns
  if (event === 'login_failure') {
    await checkForBruteForceAttack(securityEvent.ipAddress);
  }
};
```

### File Access Monitoring
```typescript
export const monitorFileAccess = async (
  action: 'upload' | 'download' | 'delete' | 'view',
  fileId: string,
  userId: string,
  success: boolean,
  context: Context
) => {
  const accessEvent = {
    type: 'file_access',
    action,
    fileId,
    userId,
    success,
    ipAddress: context.req.header('CF-Connecting-IP'),
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(accessEvent));
  
  // Store access event
  await insertFileAccessEvent(accessEvent);
  
  // Check for suspicious file access patterns
  if (!success || await isFileAccessSuspicious(userId, action)) {
    await sendFileAccessAlert(accessEvent);
  }
};
```

## Business Metrics Monitoring

### Usage Analytics
```typescript
export const trackUsageMetrics = async (
  userId: string,
  feature: string,
  action: string,
  metadata?: Record<string, any>
) => {
  const usageEvent = {
    type: 'usage_metrics',
    userId,
    feature,
    action,
    timestamp: new Date().toISOString(),
    metadata
  };
  
  console.log(JSON.stringify(usageEvent));
  
  // Store for analytics
  await insertUsageMetrics(usageEvent);
};
```

### Resource Usage Monitoring
```typescript
export const monitorResourceUsage = async () => {
  const metrics = {
    type: 'resource_usage',
    timestamp: new Date().toISOString(),
    storage: await getStorageUsage(),
    database: await getDatabaseUsage(),
    requests: await getRequestCount()
  };
  
  console.log(JSON.stringify(metrics));
  
  // Alert on resource limits
  if (metrics.storage.usage > 0.8) { // 80% storage usage
    await sendStorageAlert(metrics.storage);
  }
};
```

## Alerting System

### Alert Configuration
```typescript
interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  cooldown: number; // minutes
}

const ALERT_RULES: AlertRule[] = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > threshold',
    threshold: 5, // 5%
    severity: 'high',
    channels: ['email', 'slack'],
    cooldown: 15
  },
  {
    name: 'Slow Response Time',
    condition: 'avg_response_time > threshold',
    threshold: 2000, // 2 seconds
    severity: 'medium',
    channels: ['slack'],
    cooldown: 30
  },
  {
    name: 'Database Unavailable',
    condition: 'database_health == false',
    threshold: 1,
    severity: 'critical',
    channels: ['email', 'slack', 'sms'],
    cooldown: 5
  }
];
```

### Alert Processing
```typescript
export const processAlert = async (alert: AlertRule, value: number) => {
  // Check cooldown
  if (await isInCooldown(alert.name)) {
    return;
  }
  
  // Send notifications
  for (const channel of alert.channels) {
    await sendNotification(channel, {
      rule: alert.name,
      severity: alert.severity,
      value,
      threshold: alert.threshold,
      timestamp: new Date().toISOString()
    });
  }
  
  // Set cooldown
  await setCooldown(alert.name, alert.cooldown);
};
```

## Monitoring Dashboard

### Dashboard Endpoints
```typescript
// Real-time metrics endpoint
app.get('/dashboard/metrics', async (c) => {
  const metrics = await getCurrentMetrics();
  return c.json(metrics);
});

// Historical data endpoint
app.get('/dashboard/history', async (c) => {
  const timeRange = c.req.query('range') || '24h';
  const metrics = await getHistoricalMetrics(timeRange);
  return c.json(metrics);
});

// System status endpoint
app.get('/dashboard/status', async (c) => {
  const status = await getSystemStatus();
  return c.json(status);
});
```

### Metrics Collection
```typescript
export const getCurrentMetrics = async () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  return {
    requests: {
      total: await getRequestCount(oneHourAgo, now),
      errors: await getErrorCount(oneHourAgo, now),
      avgResponseTime: await getAverageResponseTime(oneHourAgo, now)
    },
    users: {
      active: await getActiveUserCount(oneHourAgo, now),
      new: await getNewUserCount(oneHourAgo, now)
    },
    files: {
      uploads: await getFileUploadCount(oneHourAgo, now),
      downloads: await getFileDownloadCount(oneHourAgo, now),
      storage: await getStorageUsage()
    },
    system: {
      health: await getSystemHealth(),
      uptime: await getSystemUptime()
    }
  };
};
```

## Log Management

### Structured Logging
```typescript
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

export const log = (level: LogEntry['level'], message: string, context?: Record<string, any>) => {
  const logEntry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context
  };
  
  console.log(JSON.stringify(logEntry));
};
```

### Log Analysis
```bash
# Search logs with wrangler
wrangler tail --env=production --grep="error"

# Filter by log level
wrangler tail --env=production --grep="\"level\":\"error\""

# Monitor specific user
wrangler tail --env=production --grep="\"userId\":\"user123\""

# Real-time monitoring
wrangler tail --env=production --format=pretty
```

## Monitoring Tools Integration

### Cloudflare Analytics
```typescript
// Send custom analytics events
export const sendAnalyticsEvent = async (event: string, data: Record<string, any>) => {
  // Use Cloudflare Workers Analytics Engine
  await fetch('https://cloudflare-analytics-endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, data, timestamp: Date.now() })
  });
};
```

### External Monitoring Services
```typescript
// Integration with external monitoring services
export const sendToMonitoringService = async (metrics: any) => {
  if (process.env.MONITORING_WEBHOOK_URL) {
    await fetch(process.env.MONITORING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics)
    });
  }
};
```

## Monitoring Maintenance

### Regular Monitoring Tasks
- **Daily**: Review error rates and performance metrics
- **Weekly**: Analyze user behavior and system trends
- **Monthly**: Review alert rules and thresholds
- **Quarterly**: Audit monitoring coverage and effectiveness

### Monitoring Optimization
```bash
# Review monitoring configuration
npm run monitoring:review

# Test alert systems
npm run monitoring:test-alerts

# Optimize monitoring queries
npm run monitoring:optimize

# Generate monitoring reports
npm run monitoring:report
```