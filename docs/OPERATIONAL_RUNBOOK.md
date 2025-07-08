# R2 Storage Monitoring Operational Runbook

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Deployment and Setup](#deployment-and-setup)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Performance Optimization](#performance-optimization)
8. [Security Procedures](#security-procedures)
9. [Disaster Recovery](#disaster-recovery)
10. [Escalation Procedures](#escalation-procedures)

## Overview

### Purpose
This operational runbook provides comprehensive procedures for administering the R2 Storage Monitoring system, including deployment, maintenance, troubleshooting, and emergency response procedures.

### System Components
- **Cloudflare Workers**: Main application logic and API endpoints
- **D1 Database**: Storage for metrics, user data, and configuration
- **Analytics Engine**: Real-time metrics collection and analysis
- **R2 Storage**: File storage and monitoring target
- **Frontend Dashboard**: User interface for monitoring
- **Alert System**: Notifications and warning system

### Key Responsibilities
- System health monitoring
- Performance optimization
- User support and troubleshooting
- Data backup and recovery
- Security maintenance
- Capacity planning

## System Architecture

### Component Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  Cloudflare     │    │   D1 Database   │
│   Dashboard     │◄──►│   Workers       │◄──►│   (Metrics)     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Analytics      │    │   R2 Storage    │
                       │   Engine        │    │   (Files)       │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
```

### Data Flow
1. **Metrics Collection**: Workers collect R2 operation metrics
2. **Analytics Processing**: Analytics Engine processes real-time data
3. **Database Storage**: Aggregated metrics stored in D1
4. **Dashboard Display**: Frontend retrieves and displays metrics
5. **Alert Generation**: System generates alerts based on thresholds

### Key Endpoints
- **Dashboard API**: `/api/user/storage/*`
- **Admin API**: `/api/admin/metrics/*`
- **Health Check**: `/api/health`
- **Metrics Jobs**: `/api/metrics/jobs/*`

## Deployment and Setup

### Initial Deployment

#### Prerequisites
- Cloudflare account with Workers and D1 access
- Domain configured with Cloudflare
- Git repository access
- Node.js 18+ and npm installed

#### Step 1: Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd r2-storage-monitoring

# Install dependencies
npm install

# Configure environment
cp .env.example .env.production
```

#### Step 2: Database Setup
```bash
# Create D1 database
wrangler d1 create storage-monitoring-prod

# Update wrangler.toml with database ID
# Run migrations
wrangler d1 migrations apply storage-monitoring-prod --remote

# Verify tables
wrangler d1 execute storage-monitoring-prod --command "SELECT name FROM sqlite_master WHERE type='table';"
```

#### Step 3: Analytics Engine Setup
```bash
# Create Analytics Engine dataset
wrangler analytics-engine create cutty-metrics

# Update wrangler.toml with dataset binding
```

#### Step 4: Worker Deployment
```bash
# Deploy to production
wrangler deploy --env production

# Verify deployment
curl https://your-domain.com/api/health
```

#### Step 5: DNS Configuration
```bash
# Set up custom domain (if needed)
wrangler pages project create storage-monitoring
wrangler pages domain add storage-monitoring your-domain.com
```

### Environment Configuration

#### Production Environment Variables
```bash
# Required Variables
ENVIRONMENT=production
DATABASE_ID=your-d1-database-id
ANALYTICS_DATASET=cutty-metrics
JWT_SECRET=your-jwt-secret

# Optional Variables
ENABLE_METRICS=true
ENABLE_DETAILED_METRICS=false
SUCCESS_SAMPLING_RATE=0.1
ERROR_SAMPLING_RATE=1.0
RAW_METRICS_RETENTION_DAYS=30
AGGREGATED_METRICS_RETENTION_DAYS=365

# Alert Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
EMAIL_SERVICE_API_KEY=your-email-service-key
ADMIN_EMAIL=admin@company.com

# Performance Settings
CACHE_TTL=300
BATCH_SIZE=50
FLUSH_INTERVAL=30000
```

#### Development Environment
```bash
# Copy production settings
cp .env.production .env.local

# Update for development
ENVIRONMENT=development
ENABLE_DETAILED_METRICS=true
SUCCESS_SAMPLING_RATE=1.0
```

### Scaling Considerations

#### Horizontal Scaling
- Workers auto-scale based on traffic
- D1 database handles up to 100k operations/day
- Analytics Engine scales automatically

#### Vertical Scaling
- Increase Worker memory for large datasets
- Optimize database queries for performance
- Implement caching for frequently accessed data

## Monitoring and Alerting

### System Health Checks

#### Automated Health Monitoring
```bash
# Health check endpoint
curl -f https://your-domain.com/api/health || exit 1

# Response should include:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "healthy",
    "analytics": "healthy",
    "storage": "healthy"
  },
  "metrics": {
    "uptime": "99.9%",
    "response_time": "150ms",
    "error_rate": "0.1%"
  }
}
```

#### Manual Health Verification
```bash
# Check database connectivity
wrangler d1 execute storage-monitoring-prod --command "SELECT COUNT(*) FROM storage_metrics;"

# Check Analytics Engine
curl -X POST https://your-domain.com/api/metrics/jobs/health-check \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify scheduled jobs
curl https://your-domain.com/api/admin/metrics/job-statistics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Key Metrics to Monitor

#### System Performance
- **Response Time**: API endpoint latency
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second
- **Worker CPU Usage**: CPU utilization percentage
- **Memory Usage**: Memory consumption

#### Storage Metrics
- **Database Size**: D1 database storage usage
- **Query Performance**: Database query execution time
- **Analytics Volume**: Events processed per hour
- **Storage Operations**: R2 operations per minute

#### User Metrics
- **Active Users**: Users accessing the system
- **Storage Usage**: Total storage consumed
- **Cost Trends**: Monthly cost changes
- **Alert Frequency**: Number of alerts generated

### Alert Configuration

#### Critical Alerts (Immediate Response)
```yaml
# System Down
condition: response_time > 5000ms OR error_rate > 50%
severity: critical
notification: slack + email + pager
escalation: 5 minutes

# Database Failure
condition: database_health != "healthy"
severity: critical
notification: slack + email + pager
escalation: immediate

# Storage Quota Exceeded
condition: user_storage_usage > quota_limit
severity: high
notification: slack + email
escalation: 15 minutes
```

#### Warning Alerts (Monitor and Plan)
```yaml
# High Response Time
condition: response_time > 1000ms
severity: medium
notification: slack
escalation: 30 minutes

# High Error Rate
condition: error_rate > 5%
severity: medium
notification: slack
escalation: 30 minutes

# Storage Growth
condition: storage_growth_rate > 50% monthly
severity: low
notification: email
escalation: daily review
```

#### Alert Channels
```bash
# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#ops-alerts

# Email Alerts
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=SG.xxx
ADMIN_EMAIL=admin@company.com

# PagerDuty (Critical Only)
PAGERDUTY_API_KEY=your-pagerduty-key
PAGERDUTY_SERVICE_ID=your-service-id
```

## Maintenance Procedures

### Routine Maintenance Tasks

#### Daily Tasks
```bash
#!/bin/bash
# daily-maintenance.sh

echo "Starting daily maintenance..."

# Check system health
curl -f https://your-domain.com/api/health

# Review error logs
wrangler tail --format pretty | grep ERROR

# Check storage usage trends
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-domain.com/api/admin/metrics/storage

# Verify backup completion
check_backup_status.sh

echo "Daily maintenance completed."
```

#### Weekly Tasks
```bash
#!/bin/bash
# weekly-maintenance.sh

echo "Starting weekly maintenance..."

# Database optimization
wrangler d1 execute storage-monitoring-prod --command "VACUUM;"
wrangler d1 execute storage-monitoring-prod --command "ANALYZE;"

# Review performance metrics
generate_weekly_report.sh

# Update dependencies (dev environment first)
npm audit
npm update

# Capacity planning review
check_capacity_trends.sh

echo "Weekly maintenance completed."
```

#### Monthly Tasks
```bash
#!/bin/bash
# monthly-maintenance.sh

echo "Starting monthly maintenance..."

# Archive old metrics data
run_data_archival.sh

# Security review
audit_user_access.sh
review_api_keys.sh

# Performance optimization
optimize_database_indexes.sh

# Disaster recovery test
test_backup_restore.sh

# Update documentation
update_runbook.sh

echo "Monthly maintenance completed."
```

### Database Maintenance

#### Data Retention Management
```sql
-- Clean up old raw metrics (older than 30 days)
DELETE FROM storage_metrics 
WHERE metric_date < date('now', '-30 days') 
  AND aggregation_level = 'raw';

-- Archive old aggregated data (older than 1 year)
INSERT INTO archived_metrics 
SELECT * FROM storage_metrics 
WHERE metric_date < date('now', '-365 days');

DELETE FROM storage_metrics 
WHERE metric_date < date('now', '-365 days');

-- Update statistics
ANALYZE storage_metrics;
```

#### Index Optimization
```sql
-- Check index usage
EXPLAIN QUERY PLAN 
SELECT * FROM storage_metrics 
WHERE user_id = ? AND metric_date >= ?;

-- Rebuild indexes if needed
REINDEX idx_storage_metrics_user_date;
REINDEX idx_storage_metrics_type_date;
```

#### Database Backup
```bash
#!/bin/bash
# backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="storage_monitoring_backup_$DATE.sql"

# Export database
wrangler d1 backup storage-monitoring-prod > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to backup storage
aws s3 cp ${BACKUP_FILE}.gz s3://your-backup-bucket/database/

# Clean up local files
rm ${BACKUP_FILE}.gz

echo "Database backup completed: ${BACKUP_FILE}.gz"
```

### Performance Monitoring

#### Query Performance Analysis
```sql
-- Slow query detection
SELECT 
  sql,
  avg_duration,
  call_count,
  total_duration
FROM sqlite_stat4 
WHERE avg_duration > 1000  -- Queries slower than 1 second
ORDER BY avg_duration DESC;

-- Index effectiveness
SELECT 
  name,
  tbl,
  stat
FROM sqlite_stat1
WHERE stat NOT LIKE '% 0 %';  -- Unused indexes
```

#### Worker Performance Monitoring
```javascript
// worker-performance.js
export async function monitorPerformance(request) {
  const start = Date.now();
  
  try {
    const response = await handleRequest(request);
    const duration = Date.now() - start;
    
    // Log performance metrics
    console.log(`Request processed in ${duration}ms`);
    
    // Alert on slow requests
    if (duration > 5000) {
      await sendAlert({
        type: 'performance',
        message: `Slow request detected: ${duration}ms`,
        request: request.url
      });
    }
    
    return response;
  } catch (error) {
    const duration = Date.now() - start;
    await sendAlert({
      type: 'error',
      message: `Request failed after ${duration}ms: ${error.message}`,
      request: request.url
    });
    throw error;
  }
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: High Response Times
**Symptoms:**
- API responses slower than 1 second
- User complaints about slow loading
- Monitoring alerts for latency

**Diagnosis:**
```bash
# Check Worker performance
wrangler tail --format pretty | grep "duration"

# Check database query performance
wrangler d1 execute storage-monitoring-prod --command "
  SELECT sql, avg(duration) as avg_duration 
  FROM query_log 
  WHERE timestamp > datetime('now', '-1 hour')
  GROUP BY sql 
  ORDER BY avg_duration DESC;"

# Check Analytics Engine status
curl https://your-domain.com/api/admin/metrics/system-health
```

**Solutions:**
1. **Optimize Database Queries:**
   ```sql
   -- Add missing indexes
   CREATE INDEX IF NOT EXISTS idx_metrics_user_date_type 
   ON storage_metrics(user_id, metric_date, metric_type);
   
   -- Update table statistics
   ANALYZE storage_metrics;
   ```

2. **Implement Caching:**
   ```javascript
   // Add caching layer
   const cache = new Map();
   const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
   
   async function getCachedData(key, fetchFunction) {
     const cached = cache.get(key);
     if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
       return cached.data;
     }
     
     const data = await fetchFunction();
     cache.set(key, { data, timestamp: Date.now() });
     return data;
   }
   ```

3. **Optimize Worker Code:**
   ```javascript
   // Use parallel requests where possible
   const [usage, costs, performance] = await Promise.all([
     fetchUsage(userId),
     fetchCosts(userId),
     fetchPerformance(userId)
   ]);
   ```

#### Issue: Database Connection Errors
**Symptoms:**
- "Database unavailable" errors
- Failed metric collection
- Empty dashboard data

**Diagnosis:**
```bash
# Test database connectivity
wrangler d1 execute storage-monitoring-prod --command "SELECT 1;"

# Check D1 service status
curl https://www.cloudflarestatus.com/api/v2/status.json

# Review error logs
wrangler tail --format pretty | grep "database"
```

**Solutions:**
1. **Retry Logic:**
   ```javascript
   async function executeWithRetry(query, params, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await db.prepare(query).bind(...params).all();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
       }
     }
   }
   ```

2. **Connection Pooling:**
   ```javascript
   // Implement connection management
   class DatabaseManager {
     constructor() {
       this.connections = new Map();
     }
     
     async getConnection(env) {
       if (!this.connections.has(env.DB)) {
         this.connections.set(env.DB, env.DB);
       }
       return this.connections.get(env.DB);
     }
   }
   ```

#### Issue: Analytics Engine Data Loss
**Symptoms:**
- Missing metrics data
- Gaps in charts and reports
- Analytics ingestion errors

**Diagnosis:**
```bash
# Check Analytics Engine status
curl -X POST https://your-domain.com/api/metrics/jobs/health-check

# Review analytics logs
wrangler tail --format pretty | grep "analytics"

# Check data ingestion rate
curl https://your-domain.com/api/admin/metrics/ingestion-stats
```

**Solutions:**
1. **Implement Data Recovery:**
   ```javascript
   // Backfill missing data
   async function backfillAnalytics(startDate, endDate) {
     const metrics = await db.prepare(`
       SELECT * FROM storage_metrics 
       WHERE metric_date BETWEEN ? AND ?
     `).bind(startDate, endDate).all();
     
     for (const metric of metrics.results) {
       await analytics.writeDataPoint({
         blobs: [metric],
         indexes: [metric.user_id, metric.metric_date]
       });
     }
   }
   ```

2. **Improve Error Handling:**
   ```javascript
   async function writeAnalyticsData(data) {
     try {
       await analytics.writeDataPoint(data);
     } catch (error) {
       // Store failed writes for retry
       await storeFailedWrite(data, error);
       console.error('Analytics write failed:', error);
     }
   }
   ```

#### Issue: User Quota Exceeded
**Symptoms:**
- Users unable to upload files
- "Quota exceeded" error messages
- Support tickets about storage limits

**Diagnosis:**
```bash
# Check user quota status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.com/api/admin/users/quota-violations"

# Review storage usage patterns
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://your-domain.com/api/admin/metrics/storage?includeUsers=true"
```

**Solutions:**
1. **Automatic Cleanup:**
   ```javascript
   // Implement automatic file cleanup
   async function cleanupUserFiles(userId) {
     const oldFiles = await db.prepare(`
       SELECT file_id FROM saved_files 
       WHERE user_id = ? 
         AND created_at < date('now', '-90 days')
         AND tags LIKE '%temporary%'
     `).bind(userId).all();
     
     for (const file of oldFiles.results) {
       await deleteFile(file.file_id);
     }
   }
   ```

2. **Quota Management:**
   ```javascript
   // Increase quota for active users
   async function adjustQuota(userId, newQuota) {
     await db.prepare(`
       UPDATE user_storage_quotas 
       SET max_storage_bytes = ? 
       WHERE user_id = ?
     `).bind(newQuota, userId).run();
     
     // Log quota change
     await logQuotaChange(userId, newQuota);
   }
   ```

### Emergency Procedures

#### Complete System Outage
```bash
#!/bin/bash
# emergency-response.sh

echo "EMERGENCY: System outage detected"

# Step 1: Assess scope
check_cloudflare_status.sh
check_worker_status.sh
check_database_status.sh

# Step 2: Notify stakeholders
send_outage_notification.sh

# Step 3: Attempt automated recovery
restart_workers.sh
clear_cache.sh

# Step 4: Manual intervention if needed
echo "Escalating to on-call engineer..."
page_oncall.sh

# Step 5: Status page update
update_status_page.sh "investigating"
```

#### Data Corruption Recovery
```bash
#!/bin/bash
# data-recovery.sh

echo "Data corruption detected - starting recovery"

# Step 1: Stop writes
enable_readonly_mode.sh

# Step 2: Assess damage
run_data_integrity_check.sh

# Step 3: Restore from backup
if [ "$CORRUPTION_LEVEL" = "high" ]; then
  restore_from_backup.sh
else
  repair_corrupted_data.sh
fi

# Step 4: Verify recovery
run_data_validation.sh

# Step 5: Resume normal operations
disable_readonly_mode.sh
```

## Performance Optimization

### Database Optimization

#### Query Optimization
```sql
-- Optimize common queries with proper indexes
CREATE INDEX IF NOT EXISTS idx_storage_metrics_composite 
ON storage_metrics(user_id, metric_date DESC, metric_type);

-- Optimize aggregation queries
CREATE INDEX IF NOT EXISTS idx_storage_metrics_aggregation 
ON storage_metrics(metric_date, metric_type, user_id);

-- Partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_storage_metrics_recent 
ON storage_metrics(user_id, metric_date) 
WHERE metric_date >= date('now', '-30 days');
```

#### Data Partitioning Strategy
```sql
-- Create partitioned tables for large datasets
CREATE TABLE storage_metrics_2024_01 (
  LIKE storage_metrics INCLUDING ALL
);

-- Implement automatic partitioning
CREATE TRIGGER partition_storage_metrics 
BEFORE INSERT ON storage_metrics 
FOR EACH ROW 
WHEN NEW.metric_date >= '2024-01-01' AND NEW.metric_date < '2024-02-01'
BEGIN
  INSERT INTO storage_metrics_2024_01 VALUES (NEW.*);
END;
```

#### Aggregation Optimization
```javascript
// Optimize aggregation jobs
async function optimizedAggregation(startDate, endDate) {
  // Use batch processing
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const batch = await db.prepare(`
      SELECT user_id, metric_type, 
             SUM(total_bytes) as total_bytes,
             SUM(total_operations) as total_operations,
             AVG(avg_latency) as avg_latency
      FROM storage_metrics 
      WHERE metric_date BETWEEN ? AND ?
      GROUP BY user_id, metric_type
      LIMIT ? OFFSET ?
    `).bind(startDate, endDate, batchSize, offset).all();
    
    if (batch.results.length === 0) break;
    
    // Process batch
    await processBatch(batch.results);
    offset += batchSize;
  }
}
```

### Worker Performance Optimization

#### Memory Usage Optimization
```javascript
// Implement streaming for large datasets
async function streamLargeDataset(query, processor) {
  const cursor = await db.prepare(query).raw();
  
  while (true) {
    const batch = await cursor.next(100); // Process 100 rows at a time
    if (!batch.length) break;
    
    await processor(batch);
    
    // Allow garbage collection
    if (batch.length < 100) break;
  }
}
```

#### Caching Strategy
```javascript
// Multi-level caching
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.edgeCache = new Map();
  }
  
  async get(key, fetchFn, ttl = 300000) {
    // Check memory cache first
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult && Date.now() - memoryResult.timestamp < ttl) {
      return memoryResult.data;
    }
    
    // Check edge cache
    const edgeResult = await caches.default.match(key);
    if (edgeResult) {
      const data = await edgeResult.json();
      this.memoryCache.set(key, { data, timestamp: Date.now() });
      return data;
    }
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Store in both caches
    this.memoryCache.set(key, { data, timestamp: Date.now() });
    await caches.default.put(key, new Response(JSON.stringify(data), {
      headers: { 'Cache-Control': `max-age=${ttl / 1000}` }
    }));
    
    return data;
  }
}
```

### Frontend Performance

#### Chart Optimization
```javascript
// Optimize chart rendering for large datasets
function optimizeChartData(data, maxPoints = 100) {
  if (data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, index) => index % step === 0);
}

// Use web workers for heavy calculations
const worker = new Worker('/js/chart-worker.js');
worker.postMessage({ data: rawData, type: 'aggregate' });
worker.onmessage = (e) => {
  updateChart(e.data);
};
```

#### Lazy Loading
```javascript
// Implement lazy loading for dashboard components
const LazyComponent = React.lazy(() => import('./ExpensiveComponent'));

function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <LazyComponent />
    </Suspense>
  );
}
```

## Security Procedures

### Access Control Management

#### User Authentication
```javascript
// JWT token validation
async function validateToken(token) {
  try {
    const payload = await jwt.verify(token, JWT_SECRET);
    
    // Check token expiration
    if (payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    
    // Verify user still exists and is active
    const user = await db.prepare(`
      SELECT id, is_active, role FROM users WHERE id = ?
    `).bind(payload.sub).first();
    
    if (!user || !user.is_active) {
      throw new Error('User inactive or not found');
    }
    
    return { user, payload };
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

#### Role-Based Access Control
```javascript
// Permission checking middleware
function requirePermission(permission) {
  return async (request, env, ctx) => {
    const { user } = await authenticateRequest(request, env);
    
    if (!hasPermission(user.role, permission)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    return ctx.next();
  };
}

function hasPermission(role, permission) {
  const permissions = {
    admin: ['read', 'write', 'delete', 'admin'],
    user: ['read', 'write'],
    readonly: ['read']
  };
  
  return permissions[role]?.includes(permission) || false;
}
```

### Data Protection

#### Encryption at Rest
```javascript
// Encrypt sensitive data before storage
async function encryptSensitiveData(data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  
  return {
    data: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  };
}
```

#### Data Anonymization
```javascript
// Anonymize user data for analytics
function anonymizeUserData(userData) {
  return {
    userId: hashUserId(userData.userId),
    metrics: userData.metrics,
    timestamp: userData.timestamp,
    // Remove PII
    email: undefined,
    name: undefined,
    ip: undefined
  };
}

function hashUserId(userId) {
  return crypto.createHash('sha256')
    .update(userId + HASH_SALT)
    .digest('hex')
    .substring(0, 16);
}
```

### Security Monitoring

#### Intrusion Detection
```javascript
// Monitor for suspicious activity
async function detectSuspiciousActivity(request, user) {
  const clientIP = request.headers.get('CF-Connecting-IP');
  const userAgent = request.headers.get('User-Agent');
  
  // Check for unusual access patterns
  const recentRequests = await getRecentRequests(user.id, '1 hour');
  
  if (recentRequests.length > 1000) {
    await logSecurityEvent({
      type: 'excessive_requests',
      userId: user.id,
      ip: clientIP,
      count: recentRequests.length
    });
  }
  
  // Check for geo-location anomalies
  const userLocation = await getUserLocation(clientIP);
  const previousLocations = await getPreviousLocations(user.id);
  
  if (isLocationAnomalous(userLocation, previousLocations)) {
    await logSecurityEvent({
      type: 'location_anomaly',
      userId: user.id,
      ip: clientIP,
      location: userLocation
    });
  }
}
```

#### Audit Logging
```javascript
// Comprehensive audit logging
async function logAuditEvent(event) {
  const auditRecord = {
    timestamp: new Date().toISOString(),
    eventType: event.type,
    userId: event.userId,
    action: event.action,
    resource: event.resource,
    result: event.result,
    ip: event.ip,
    userAgent: event.userAgent,
    metadata: event.metadata
  };
  
  // Store in secure audit log
  await db.prepare(`
    INSERT INTO audit_log (
      timestamp, event_type, user_id, action, 
      resource, result, ip, user_agent, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    auditRecord.timestamp,
    auditRecord.eventType,
    auditRecord.userId,
    auditRecord.action,
    auditRecord.resource,
    auditRecord.result,
    auditRecord.ip,
    auditRecord.userAgent,
    JSON.stringify(auditRecord.metadata)
  ).run();
}
```

### Incident Response

#### Security Incident Playbook
```bash
#!/bin/bash
# security-incident.sh

INCIDENT_TYPE=$1
SEVERITY=$2

echo "Security incident detected: $INCIDENT_TYPE (Severity: $SEVERITY)"

case $INCIDENT_TYPE in
  "unauthorized_access")
    # Lock affected accounts
    lock_user_accounts.sh
    
    # Invalidate all sessions
    invalidate_all_sessions.sh
    
    # Collect evidence
    collect_access_logs.sh
    ;;
    
  "data_breach")
    # Stop all data access
    enable_emergency_mode.sh
    
    # Notify authorities
    notify_data_protection_officer.sh
    
    # Begin containment
    isolate_affected_systems.sh
    ;;
    
  "ddos_attack")
    # Enable rate limiting
    enable_aggressive_rate_limiting.sh
    
    # Activate DDoS protection
    activate_ddos_protection.sh
    
    # Monitor for mitigation
    monitor_attack_mitigation.sh
    ;;
esac

# Always notify security team
notify_security_team.sh "$INCIDENT_TYPE" "$SEVERITY"

# Begin incident documentation
create_incident_report.sh "$INCIDENT_TYPE" "$SEVERITY"
```

## Disaster Recovery

### Backup Strategy

#### Automated Backup Procedures
```bash
#!/bin/bash
# backup-procedure.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/backups/$DATE"
mkdir -p $BACKUP_DIR

# Database backup
echo "Backing up database..."
wrangler d1 backup storage-monitoring-prod > $BACKUP_DIR/database.sql

# Configuration backup
echo "Backing up configuration..."
cp wrangler.toml $BACKUP_DIR/
cp .env.production $BACKUP_DIR/env.backup

# Code backup
echo "Creating code snapshot..."
git archive --format=tar.gz --prefix=code/ HEAD > $BACKUP_DIR/code.tar.gz

# Compress and encrypt
echo "Compressing and encrypting backup..."
tar -czf - $BACKUP_DIR | gpg --encrypt --recipient backup@company.com > backup_$DATE.tar.gz.gpg

# Upload to secure storage
echo "Uploading to secure storage..."
aws s3 cp backup_$DATE.tar.gz.gpg s3://disaster-recovery-bucket/storage-monitoring/

# Clean up local files
rm -rf $BACKUP_DIR backup_$DATE.tar.gz.gpg

echo "Backup completed: backup_$DATE.tar.gz.gpg"
```

#### Backup Verification
```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE=$1

echo "Verifying backup: $BACKUP_FILE"

# Download from secure storage
aws s3 cp s3://disaster-recovery-bucket/storage-monitoring/$BACKUP_FILE .

# Decrypt and extract
gpg --decrypt $BACKUP_FILE | tar -xzf -

# Verify database integrity
sqlite3 backup/database.sql ".schema" > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Database backup verified"
else
  echo "✗ Database backup corrupted"
  exit 1
fi

# Verify configuration files
if [ -f backup/wrangler.toml ] && [ -f backup/env.backup ]; then
  echo "✓ Configuration files verified"
else
  echo "✗ Configuration files missing"
  exit 1
fi

# Verify code archive
tar -tzf backup/code.tar.gz > /dev/null
if [ $? -eq 0 ]; then
  echo "✓ Code archive verified"
else
  echo "✗ Code archive corrupted"
  exit 1
fi

echo "Backup verification completed successfully"
```

### Recovery Procedures

#### Complete System Recovery
```bash
#!/bin/bash
# disaster-recovery.sh

BACKUP_DATE=$1
RECOVERY_ENV=${2:-production}

echo "Starting disaster recovery from backup: $BACKUP_DATE"
echo "Target environment: $RECOVERY_ENV"

# Step 1: Download and verify backup
./verify-backup.sh "backup_${BACKUP_DATE}.tar.gz.gpg"

# Step 2: Create new D1 database
wrangler d1 create storage-monitoring-recovery-$RECOVERY_ENV

# Step 3: Restore database
wrangler d1 execute storage-monitoring-recovery-$RECOVERY_ENV --file=backup/database.sql

# Step 4: Update configuration
cp backup/wrangler.toml wrangler-recovery.toml
sed -i "s/storage-monitoring-prod/storage-monitoring-recovery-$RECOVERY_ENV/g" wrangler-recovery.toml

# Step 5: Deploy workers
wrangler deploy --config wrangler-recovery.toml --env $RECOVERY_ENV

# Step 6: Update DNS (manual step)
echo "Manual step required: Update DNS to point to recovered environment"
echo "New worker URL: $(wrangler subdomain --config wrangler-recovery.toml)"

# Step 7: Verify recovery
./verify-recovery.sh $RECOVERY_ENV

echo "Disaster recovery completed"
```

#### Verification Procedures
```bash
#!/bin/bash
# verify-recovery.sh

ENV=$1
BASE_URL="https://storage-monitoring-recovery-$ENV.your-domain.workers.dev"

echo "Verifying recovery for environment: $ENV"

# Test health endpoint
echo "Testing health endpoint..."
curl -f $BASE_URL/api/health
if [ $? -eq 0 ]; then
  echo "✓ Health check passed"
else
  echo "✗ Health check failed"
  exit 1
fi

# Test database connectivity
echo "Testing database connectivity..."
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  $BASE_URL/api/admin/metrics/system-health
if [ $? -eq 0 ]; then
  echo "✓ Database connectivity verified"
else
  echo "✗ Database connectivity failed"
  exit 1
fi

# Test user functionality
echo "Testing user functionality..."
curl -f -H "Authorization: Bearer $USER_TOKEN" \
  $BASE_URL/api/user/storage/usage
if [ $? -eq 0 ]; then
  echo "✓ User functionality verified"
else
  echo "✗ User functionality failed"
  exit 1
fi

echo "Recovery verification completed successfully"
```

### Recovery Time Objectives

#### RTO/RPO Targets
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 15 minutes
- **Maximum Tolerable Downtime**: 8 hours

#### Recovery Scenarios
| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Worker Failure | 15 minutes | 0 | Automatic failover |
| Database Corruption | 2 hours | 15 minutes | Database restore |
| Complete Outage | 4 hours | 1 hour | Full disaster recovery |
| Data Center Failure | 6 hours | 15 minutes | Cross-region recovery |

## Escalation Procedures

### Support Tiers

#### Tier 1 Support (Initial Response)
**Responsibilities:**
- Monitor alerts and dashboards
- Handle routine user questions
- Perform basic troubleshooting
- Escalate complex issues

**Response Times:**
- Critical: 15 minutes
- High: 1 hour
- Medium: 4 hours
- Low: 24 hours

**Common Tasks:**
```bash
# Reset user password
reset_user_password.sh user@company.com

# Clear user cache
clear_user_cache.sh user_id

# Restart monitoring jobs
restart_monitoring_jobs.sh

# Check system status
check_system_status.sh
```

#### Tier 2 Support (Technical Issues)
**Responsibilities:**
- Database troubleshooting
- Performance optimization
- Complex user issues
- Security incidents

**Escalation Criteria:**
- Database performance issues
- Authentication problems
- Data inconsistencies
- Security alerts

**Common Tasks:**
```bash
# Optimize database performance
optimize_database.sh

# Investigate security alerts
investigate_security_alert.sh alert_id

# Resolve data sync issues
resolve_data_sync.sh

# Performance tuning
tune_performance.sh
```

#### Tier 3 Support (Engineering)
**Responsibilities:**
- Code-level debugging
- Architecture decisions
- Major outages
- System design changes

**Escalation Criteria:**
- System-wide outages
- Data corruption
- Security breaches
- Performance degradation > 50%

### On-Call Procedures

#### On-Call Schedule
```yaml
# on-call-schedule.yml
schedule:
  week1:
    primary: engineer1@company.com
    secondary: engineer2@company.com
  week2:
    primary: engineer2@company.com
    secondary: engineer3@company.com
  week3:
    primary: engineer3@company.com
    secondary: engineer1@company.com
```

#### Escalation Matrix
```yaml
# escalation-matrix.yml
escalation_rules:
  critical:
    immediate: [primary_oncall, manager]
    5_minutes: [secondary_oncall]
    15_minutes: [director, cto]
    
  high:
    immediate: [primary_oncall]
    30_minutes: [secondary_oncall, manager]
    2_hours: [director]
    
  medium:
    immediate: [primary_oncall]
    4_hours: [manager]
    
  low:
    immediate: [primary_oncall]
    business_hours: [manager]
```

#### Communication Procedures
```bash
#!/bin/bash
# incident-communication.sh

SEVERITY=$1
INCIDENT_TYPE=$2
DESCRIPTION=$3

# Create incident channel
create_slack_channel.sh "incident-$(date +%Y%m%d-%H%M%S)"

# Notify stakeholders based on severity
case $SEVERITY in
  "critical")
    notify_executives.sh "$INCIDENT_TYPE" "$DESCRIPTION"
    update_status_page.sh "major_outage" "$DESCRIPTION"
    send_customer_notification.sh "service_disruption"
    ;;
  "high")
    notify_management.sh "$INCIDENT_TYPE" "$DESCRIPTION"
    update_status_page.sh "partial_outage" "$DESCRIPTION"
    ;;
  "medium")
    notify_team.sh "$INCIDENT_TYPE" "$DESCRIPTION"
    update_internal_status.sh "$DESCRIPTION"
    ;;
esac

# Start incident documentation
create_incident_report.sh "$SEVERITY" "$INCIDENT_TYPE" "$DESCRIPTION"
```

### Post-Incident Procedures

#### Post-Mortem Process
```bash
#!/bin/bash
# post-mortem.sh

INCIDENT_ID=$1

echo "Starting post-mortem for incident: $INCIDENT_ID"

# Collect incident data
collect_incident_data.sh $INCIDENT_ID

# Generate timeline
generate_incident_timeline.sh $INCIDENT_ID

# Create post-mortem document
create_postmortem_document.sh $INCIDENT_ID

# Schedule post-mortem meeting
schedule_postmortem_meeting.sh $INCIDENT_ID

echo "Post-mortem process initiated for incident: $INCIDENT_ID"
```

#### Lessons Learned
```markdown
# Post-Mortem Template

## Incident Summary
- **Date**: 
- **Duration**: 
- **Severity**: 
- **Impact**: 

## Timeline
- **Detection**: 
- **Response**: 
- **Resolution**: 

## Root Cause Analysis
- **Primary Cause**: 
- **Contributing Factors**: 

## Action Items
- [ ] Immediate fixes
- [ ] Process improvements
- [ ] Monitoring enhancements
- [ ] Documentation updates

## Prevention Measures
- **Technical Changes**: 
- **Process Changes**: 
- **Training Requirements**: 
```

---

This operational runbook provides comprehensive procedures for managing the R2 Storage Monitoring system. It should be updated regularly based on operational experience and system changes.