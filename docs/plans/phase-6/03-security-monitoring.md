# Phase 6 Security Monitoring & Analytics Implementation Plan

## Target Audience
This document is designed for a Claude subagent responsible for implementing security monitoring, analytics, and observability for the authentication and security system.

## Current State Analysis

### ✅ What's Already Done
- Complete authentication and security system implemented
- Basic error handling and logging in place
- Security headers and middleware operational
- Rate limiting functionality implemented

### ❌ Monitoring Gaps
- **No Security Analytics**: No tracking of authentication events
- **No Audit Logging**: No comprehensive security event logging
- **No Alerting**: No automated alerts for security incidents
- **No Performance Metrics**: No monitoring of authentication performance
- **No Threat Detection**: No automated threat detection or response

## Implementation Strategy

### Phase 1: Security Event Logging (Priority: HIGH)

#### 1.1 Security Event Types

**Authentication Events:**
- User registration attempts
- Login attempts (successful/failed)
- Token refresh events
- Logout events
- Password reset attempts

**Security Events:**
- Rate limit violations
- Invalid token attempts
- Brute force detection
- API key usage
- Suspicious activity patterns

**System Events:**
- Database connection failures
- KV storage issues
- Configuration changes
- Performance anomalies

#### 1.2 Event Logging Infrastructure

**File: `/workers/src/services/security/logger.ts`**
```typescript
export interface SecurityEvent {
  timestamp: number;
  event_type: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  method?: string;
  success: boolean;
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export class SecurityLogger {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async logEvent(event: SecurityEvent): Promise<void> {
    const logEntry = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      id: crypto.randomUUID()
    };
    
    try {
      // Store in KV with TTL for recent events
      await this.env.AUTH_KV.put(
        `security_log:${logEntry.id}`,
        JSON.stringify(logEntry),
        { expirationTtl: 2592000 } // 30 days
      );
      
      // Store in D1 for long-term analysis
      await this.env.DB.prepare(`
        INSERT INTO security_events (
          id, timestamp, event_type, user_id, ip_address, 
          user_agent, endpoint, method, success, error_code, 
          error_message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logEntry.id,
        logEntry.timestamp,
        logEntry.event_type,
        logEntry.user_id,
        logEntry.ip_address,
        logEntry.user_agent,
        logEntry.endpoint,
        logEntry.method,
        logEntry.success ? 1 : 0,
        logEntry.error_code,
        logEntry.error_message,
        JSON.stringify(logEntry.metadata)
      ).run();
      
      // Check for threat patterns
      await this.checkThreatPatterns(logEntry);
      
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
  
  private async checkThreatPatterns(event: SecurityEvent): Promise<void> {
    // Implement threat detection logic
    if (event.event_type === 'login_failed' && event.ip_address) {
      await this.checkBruteForce(event.ip_address);
    }
  }
  
  private async checkBruteForce(ipAddress: string): Promise<void> {
    const window = 300000; // 5 minutes
    const threshold = 5; // 5 failed attempts
    
    const key = `brute_force:${ipAddress}:${Math.floor(Date.now() / window)}`;
    const current = await this.env.AUTH_KV.get(key);
    const count = current ? parseInt(current) + 1 : 1;
    
    await this.env.AUTH_KV.put(
      key,
      count.toString(),
      { expirationTtl: Math.ceil(window / 1000) }
    );
    
    if (count >= threshold) {
      await this.logEvent({
        timestamp: Date.now(),
        event_type: 'brute_force_detected',
        ip_address: ipAddress,
        success: false,
        metadata: { failed_attempts: count }
      });
    }
  }
}
```

#### 1.3 Database Schema Extension

**Add to `/workers/schema.sql`:**
```sql
-- Security events table
CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  endpoint TEXT,
  method TEXT,
  success INTEGER NOT NULL,
  error_code TEXT,
  error_message TEXT,
  metadata TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Indexes for security analysis
CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_ip ON security_events(ip_address);
CREATE INDEX idx_security_events_success ON security_events(success);

-- Analytics aggregation table
CREATE TABLE security_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  success_count INTEGER NOT NULL,
  failure_count INTEGER NOT NULL,
  unique_users INTEGER,
  unique_ips INTEGER,
  avg_response_time REAL,
  created_at TEXT NOT NULL,
  UNIQUE(date, event_type)
);

CREATE INDEX idx_security_analytics_date ON security_analytics(date);
CREATE INDEX idx_security_analytics_type ON security_analytics(event_type);
```

### Phase 2: Real-time Threat Detection (Priority: HIGH)

#### 2.1 Threat Detection Rules

**File: `/workers/src/services/security/threats.ts`**
```typescript
export interface ThreatRule {
  name: string;
  description: string;
  condition: (events: SecurityEvent[]) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'block' | 'alert';
}

export const THREAT_RULES: ThreatRule[] = [
  {
    name: 'brute_force_login',
    description: 'Multiple failed login attempts from same IP',
    condition: (events) => {
      const failedLogins = events.filter(e => 
        e.event_type === 'login_failed' && 
        Date.now() - e.timestamp < 300000 // 5 minutes
      );
      return failedLogins.length >= 5;
    },
    severity: 'high',
    action: 'block'
  },
  {
    name: 'token_manipulation',
    description: 'Multiple invalid token attempts',
    condition: (events) => {
      const invalidTokens = events.filter(e => 
        e.event_type === 'invalid_token' && 
        Date.now() - e.timestamp < 300000
      );
      return invalidTokens.length >= 10;
    },
    severity: 'medium',
    action: 'alert'
  },
  {
    name: 'account_enumeration',
    description: 'Systematic username enumeration attempt',
    condition: (events) => {
      const registrationAttempts = events.filter(e => 
        e.event_type === 'registration_failed' && 
        Date.now() - e.timestamp < 600000 // 10 minutes
      );
      return registrationAttempts.length >= 20;
    },
    severity: 'medium',
    action: 'alert'
  },
  {
    name: 'rate_limit_bypass',
    description: 'Attempts to bypass rate limiting',
    condition: (events) => {
      const rateLimitHits = events.filter(e => 
        e.event_type === 'rate_limit_exceeded' && 
        Date.now() - e.timestamp < 60000 // 1 minute
      );
      return rateLimitHits.length >= 10;
    },
    severity: 'high',
    action: 'block'
  }
];

export class ThreatDetector {
  private env: Env;
  private logger: SecurityLogger;
  
  constructor(env: Env, logger: SecurityLogger) {
    this.env = env;
    this.logger = logger;
  }
  
  async analyzeEvent(event: SecurityEvent): Promise<void> {
    const ipAddress = event.ip_address;
    if (!ipAddress) return;
    
    // Get recent events for this IP
    const recentEvents = await this.getRecentEvents(ipAddress);
    recentEvents.push(event);
    
    // Check each threat rule
    for (const rule of THREAT_RULES) {
      if (rule.condition(recentEvents)) {
        await this.handleThreat(rule, event, recentEvents);
      }
    }
  }
  
  private async getRecentEvents(ipAddress: string): Promise<SecurityEvent[]> {
    const hourAgo = Date.now() - 3600000; // 1 hour
    
    const results = await this.env.DB.prepare(`
      SELECT * FROM security_events 
      WHERE ip_address = ? AND timestamp > ?
      ORDER BY timestamp DESC
      LIMIT 100
    `).bind(ipAddress, hourAgo).all();
    
    return results.results.map(row => ({
      timestamp: row.timestamp as number,
      event_type: row.event_type as string,
      user_id: row.user_id as number,
      ip_address: row.ip_address as string,
      user_agent: row.user_agent as string,
      endpoint: row.endpoint as string,
      method: row.method as string,
      success: Boolean(row.success),
      error_code: row.error_code as string,
      error_message: row.error_message as string,
      metadata: JSON.parse(row.metadata as string || '{}')
    }));
  }
  
  private async handleThreat(
    rule: ThreatRule, 
    event: SecurityEvent, 
    events: SecurityEvent[]
  ): Promise<void> {
    // Log the threat
    await this.logger.logEvent({
      timestamp: Date.now(),
      event_type: 'threat_detected',
      ip_address: event.ip_address,
      success: false,
      metadata: {
        rule_name: rule.name,
        rule_description: rule.description,
        severity: rule.severity,
        action: rule.action,
        triggering_events: events.length
      }
    });
    
    // Take action based on rule
    switch (rule.action) {
      case 'block':
        await this.blockIP(event.ip_address!, rule.severity);
        break;
      case 'alert':
        await this.sendAlert(rule, event);
        break;
    }
  }
  
  private async blockIP(ipAddress: string, severity: string): Promise<void> {
    const blockDuration = severity === 'critical' ? 86400 : 
                         severity === 'high' ? 3600 : 
                         severity === 'medium' ? 900 : 300;
    
    await this.env.AUTH_KV.put(
      `blocked_ip:${ipAddress}`,
      JSON.stringify({
        blocked_at: Date.now(),
        severity,
        expires_at: Date.now() + (blockDuration * 1000)
      }),
      { expirationTtl: blockDuration }
    );
  }
  
  private async sendAlert(rule: ThreatRule, event: SecurityEvent): Promise<void> {
    // In a real implementation, this would send to monitoring system
    console.warn(`SECURITY ALERT: ${rule.name} - ${rule.description}`, {
      ip_address: event.ip_address,
      severity: rule.severity,
      timestamp: new Date(event.timestamp).toISOString()
    });
  }
}
```

### Phase 3: Performance Monitoring (Priority: MEDIUM)

#### 3.1 Authentication Performance Metrics

**File: `/workers/src/services/security/metrics.ts`**
```typescript
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'percent';
  timestamp: number;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    const key = `metric:${metric.name}:${Math.floor(metric.timestamp / 60000)}`;
    
    try {
      const existing = await this.env.AUTH_KV.get(key);
      const data = existing ? JSON.parse(existing) : { values: [], count: 0 };
      
      data.values.push(metric.value);
      data.count += 1;
      data.labels = metric.labels || {};
      
      await this.env.AUTH_KV.put(
        key,
        JSON.stringify(data),
        { expirationTtl: 3600 } // 1 hour
      );
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }
  
  async getMetrics(name: string, minutes: number = 60): Promise<PerformanceMetric[]> {
    const now = Date.now();
    const metrics: PerformanceMetric[] = [];
    
    for (let i = 0; i < minutes; i++) {
      const timestamp = now - (i * 60000);
      const key = `metric:${name}:${Math.floor(timestamp / 60000)}`;
      
      const data = await this.env.AUTH_KV.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        const avg = parsed.values.reduce((a: number, b: number) => a + b, 0) / parsed.values.length;
        
        metrics.push({
          name,
          value: avg,
          unit: 'ms',
          timestamp,
          labels: parsed.labels
        });
      }
    }
    
    return metrics.reverse();
  }
}

// Performance monitoring middleware
export function withMetrics<T>(
  name: string,
  metrics: MetricsCollector
) {
  return async (fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    let success = false;
    
    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - start;
      
      await metrics.recordMetric({
        name: `${name}_duration`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
        labels: { success: success.toString() }
      });
    }
  };
}
```

### Phase 4: Analytics Dashboard (Priority: MEDIUM)

#### 4.1 Security Analytics API

**File: `/workers/src/routes/analytics/security.ts`**
```typescript
export async function getSecurityAnalytics(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '7');
  const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  
  try {
    // Get authentication metrics
    const authMetrics = await env.DB.prepare(`
      SELECT 
        date,
        event_type,
        count,
        success_count,
        failure_count,
        unique_users,
        unique_ips
      FROM security_analytics
      WHERE date >= ? AND event_type IN ('login', 'registration', 'token_refresh')
      ORDER BY date ASC
    `).bind(startDate.toISOString().split('T')[0]).all();
    
    // Get threat detection summary
    const threatMetrics = await env.DB.prepare(`
      SELECT 
        event_type,
        COUNT(*) as count,
        MAX(timestamp) as last_occurrence
      FROM security_events
      WHERE timestamp >= ? AND event_type LIKE '%threat%'
      GROUP BY event_type
      ORDER BY count DESC
    `).bind(startDate.getTime()).all();
    
    // Get performance metrics
    const performanceMetrics = await env.DB.prepare(`
      SELECT 
        date,
        avg_response_time
      FROM security_analytics
      WHERE date >= ? AND avg_response_time IS NOT NULL
      ORDER BY date ASC
    `).bind(startDate.toISOString().split('T')[0]).all();
    
    return new Response(JSON.stringify({
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days
      },
      authentication: authMetrics.results,
      threats: threatMetrics.results,
      performance: performanceMetrics.results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch analytics data' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### 4.2 Analytics Aggregation

**File: `/workers/src/services/security/aggregator.ts`**
```typescript
export class SecurityAnalyticsAggregator {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  async aggregateDaily(date: string): Promise<void> {
    const startOfDay = new Date(date + 'T00:00:00.000Z').getTime();
    const endOfDay = new Date(date + 'T23:59:59.999Z').getTime();
    
    // Get all events for the day
    const events = await this.env.DB.prepare(`
      SELECT * FROM security_events
      WHERE timestamp >= ? AND timestamp <= ?
    `).bind(startOfDay, endOfDay).all();
    
    // Group by event type
    const eventsByType = new Map<string, SecurityEvent[]>();
    
    events.results.forEach(event => {
      const eventType = event.event_type as string;
      if (!eventsByType.has(eventType)) {
        eventsByType.set(eventType, []);
      }
      eventsByType.get(eventType)!.push(event as any);
    });
    
    // Calculate aggregations
    for (const [eventType, eventList] of eventsByType) {
      const successCount = eventList.filter(e => e.success).length;
      const failureCount = eventList.length - successCount;
      const uniqueUsers = new Set(eventList.map(e => e.user_id).filter(Boolean)).size;
      const uniqueIps = new Set(eventList.map(e => e.ip_address).filter(Boolean)).size;
      
      // Calculate average response time if available
      const responseTimes = eventList
        .map(e => e.metadata?.response_time)
        .filter(Boolean) as number[];
      
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : null;
      
      // Store aggregation
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO security_analytics (
          date, event_type, count, success_count, failure_count,
          unique_users, unique_ips, avg_response_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        date,
        eventType,
        eventList.length,
        successCount,
        failureCount,
        uniqueUsers,
        uniqueIps,
        avgResponseTime,
        new Date().toISOString()
      ).run();
    }
  }
  
  async runDailyAggregation(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = yesterday.toISOString().split('T')[0];
    
    await this.aggregateDaily(dateString);
  }
}
```

### Phase 5: Integration with Existing System (Priority: HIGH)

#### 5.1 Middleware Integration

**Update `/workers/src/middleware/auth.ts`:**
```typescript
import { SecurityLogger } from '../services/security/logger';
import { ThreatDetector } from '../services/security/threats';
import { MetricsCollector } from '../services/security/metrics';

export async function authMiddleware(
  request: Request,
  env: Env,
  next: () => Promise<Response>
): Promise<Response> {
  const logger = new SecurityLogger(env);
  const threatDetector = new ThreatDetector(env, logger);
  const metrics = new MetricsCollector(env);
  
  const url = new URL(request.url);
  const ipAddress = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
  
  const startTime = Date.now();
  
  try {
    // Check if IP is blocked
    const blocked = await env.AUTH_KV.get(`blocked_ip:${ipAddress}`);
    if (blocked) {
      await logger.logEvent({
        timestamp: Date.now(),
        event_type: 'blocked_ip_attempt',
        ip_address: ipAddress,
        endpoint: url.pathname,
        method: request.method,
        success: false,
        error_code: 'IP_BLOCKED'
      });
      
      return new Response(JSON.stringify({ 
        error: 'Access denied' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Continue with existing auth logic
    const response = await next();
    
    // Log successful request
    await logger.logEvent({
      timestamp: Date.now(),
      event_type: 'api_request',
      ip_address: ipAddress,
      endpoint: url.pathname,
      method: request.method,
      success: response.status < 400,
      metadata: {
        status_code: response.status,
        response_time: Date.now() - startTime
      }
    });
    
    return response;
    
  } catch (error) {
    // Log error
    await logger.logEvent({
      timestamp: Date.now(),
      event_type: 'api_error',
      ip_address: ipAddress,
      endpoint: url.pathname,
      method: request.method,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}
```

## Implementation Checklist

### Phase 1: Security Logging (Day 1-2)
- [ ] Implement SecurityLogger class
- [ ] Add security_events table to schema
- [ ] Integrate logging into authentication routes
- [ ] Test event logging functionality

### Phase 2: Threat Detection (Day 3-4)
- [ ] Implement ThreatDetector class
- [ ] Define threat detection rules
- [ ] Add IP blocking functionality
- [ ] Test threat detection scenarios

### Phase 3: Performance Monitoring (Day 5-6)
- [ ] Implement MetricsCollector class
- [ ] Add performance monitoring middleware
- [ ] Create metrics aggregation system
- [ ] Test performance tracking

### Phase 4: Analytics Dashboard (Day 7-8)
- [ ] Create analytics API endpoints
- [ ] Implement daily aggregation
- [ ] Add analytics database tables
- [ ] Test analytics functionality

### Phase 5: Integration (Day 9-10)
- [ ] Integrate with existing middleware
- [ ] Add monitoring to all routes
- [ ] Create monitoring dashboard
- [ ] Test complete monitoring system

## Success Criteria

### Security Monitoring
- [ ] All authentication events logged
- [ ] Threat detection operational
- [ ] IP blocking functional
- [ ] Security analytics available

### Performance Monitoring
- [ ] Response time tracking
- [ ] Error rate monitoring
- [ ] User activity analytics
- [ ] System health metrics

### Operational Readiness
- [ ] Automated threat response
- [ ] Security event alerting
- [ ] Performance baseline established
- [ ] Analytics dashboard functional

## Critical Notes for Subagent

- **Security Focus**: All monitoring must not impact performance
- **Privacy**: Ensure no sensitive data is logged
- **Scalability**: Design for high-volume logging
- **Reliability**: Monitoring failures should not break auth
- **Compliance**: Follow security logging best practices

This monitoring implementation will provide comprehensive security visibility and threat detection capabilities for the authentication system.