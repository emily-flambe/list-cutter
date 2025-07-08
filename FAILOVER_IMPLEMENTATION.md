# R2 Disaster Recovery Failover Implementation

This document describes the comprehensive failover system implemented for R2 disaster recovery, providing graceful degradation and operation queuing during R2 outages.

## Overview

The failover system implements multiple layers of protection:

1. **Circuit Breaker Pattern** - Prevents cascading failures
2. **Graceful Degradation** - Maintains read-only functionality during outages
3. **Operation Queuing** - Queues failed operations for retry
4. **Health Monitoring** - Continuous service health assessment
5. **User Notifications** - Keeps users informed of system status

## Architecture

### Core Components

#### 1. DegradationHandler (`workers/src/services/failover/degradation-handler.ts`)
Coordinates failover responses and manages system degradation state.

**Key Features:**
- Circuit breaker management
- Read-only mode activation
- Fallback operation execution
- Service status tracking

**Usage:**
```typescript
const handler = new DegradationHandler(env);
await handler.initialize();

const result = await handler.executeWithFailover(
  'R2_STORAGE',
  () => env.R2_BUCKET.put(fileName, content),
  () => queueUploadOperation(fileName, content)
);
```

#### 2. OperationQueue (`workers/src/services/failover/operation-queue.ts`)
Manages queuing and retry logic for failed operations.

**Key Features:**
- Priority-based queuing
- Exponential backoff retry
- Automatic operation processing
- Batch processing capabilities

**Usage:**
```typescript
const queue = new OperationQueue(env);
const operationId = await queue.enqueue('UPLOAD', payload, {
  priority: 5,
  userId: 123,
  maxRetries: 3
});
```

#### 3. R2FailoverService (`workers/src/services/storage/r2-failover.ts`)
Enhanced R2 service with built-in failover capabilities.

**Key Features:**
- Transparent failover for all R2 operations
- Automatic operation queuing
- Health check integration
- Backward compatibility with existing R2 calls

**Usage:**
```typescript
const r2Service = new R2FailoverService(env);
const result = await r2Service.saveFileToR2(fileName, content, {
  priority: 5,
  timeoutMs: 30000
});

if (result.success) {
  console.log('Upload successful:', result.data);
} else if (result.queued) {
  console.log('Upload queued for retry');
} else {
  console.error('Upload failed:', result.error);
}
```

#### 4. HealthMonitor (`workers/src/services/failover/health-monitor.ts`)
Continuous monitoring of service health with automatic status updates.

**Key Features:**
- Automated health checks
- Metrics collection
- Status change detection
- Event logging

**Usage:**
```typescript
const monitor = new HealthMonitor(env);
await monitor.startMonitoring();

const summary = await monitor.getSystemHealthSummary();
console.log('System health:', summary);
```

#### 5. NotificationService (`workers/src/services/failover/notification.ts`)
User notification system for service status and operation updates.

**Key Features:**
- Targeted user notifications
- Bulk system notifications
- Notification management
- Read/unread tracking

**Usage:**
```typescript
const notificationService = new NotificationService(env);
await notificationService.sendUserNotification(
  userId,
  'SERVICE_DEGRADED',
  'R2 storage is experiencing issues',
  'WARNING'
);
```

### Database Schema

The failover system adds several tables to track operations and status:

#### operation_queue
Stores queued operations for retry processing.

```sql
CREATE TABLE operation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    operation_id TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    -- ... additional fields
);
```

#### service_status
Tracks the health status of each service.

```sql
CREATE TABLE service_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'HEALTHY',
    circuit_breaker_state TEXT NOT NULL DEFAULT 'CLOSED',
    health_metrics TEXT DEFAULT '{}',
    -- ... additional fields
);
```

#### user_notifications
Stores user notifications about system events.

```sql
CREATE TABLE user_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    -- ... additional fields
);
```

## Integration Guide

### Step 1: Initialize Failover Services

```typescript
import { FailoverCoordinator } from './services/failover/integration-example';

const coordinator = new FailoverCoordinator(env);
await coordinator.initialize();
```

### Step 2: Replace Direct R2 Calls

**Before:**
```typescript
await env.R2_BUCKET.put(fileName, content);
```

**After:**
```typescript
const result = await coordinator.uploadFile(fileName, content, userId);
if (!result.success) {
  if (result.queued) {
    return { message: 'Upload queued due to service issues' };
  } else {
    throw new Error(result.error);
  }
}
```

### Step 3: Add Health Check Endpoints

```typescript
import { healthStatusRouter } from './routes/health-status';

app.route('/health', healthStatusRouter);
```

### Step 4: Handle Degraded Mode

```typescript
if (coordinator.isDegraded()) {
  // Show read-only mode message to users
  // Disable upload buttons
  // Display queue status
}
```

## Configuration

The system uses configurable parameters stored in the `failover_config` table:

| Service | Key | Default | Description |
|---------|-----|---------|-------------|
| R2_STORAGE | max_retries | 3 | Maximum retry attempts |
| R2_STORAGE | retry_delay_ms | 1000 | Initial retry delay |
| R2_STORAGE | circuit_breaker_threshold | 5 | Failures before circuit opens |
| OPERATION_QUEUE | max_queue_size | 1000 | Maximum queued operations |
| NOTIFICATIONS | max_notifications_per_user | 100 | Per-user notification limit |

## API Endpoints

### Health Status
- `GET /health/status` - System health summary
- `GET /health/services` - Detailed service statuses
- `GET /health/services/:serviceName` - Specific service metrics
- `POST /health/check` - Trigger health check

### R2 Failover
- `GET /health/r2/status` - R2 service status
- `POST /health/r2/test` - Test R2 connectivity

### Notifications
- `GET /health/notifications/:userId` - User notifications
- `POST /health/notifications/:notificationId/read` - Mark as read

### Operation Queue
- `GET /health/queue/status` - Queue statistics
- `GET /health/queue/operations` - Recent operations

## Monitoring and Alerting

### Health Metrics

The system tracks various health metrics:

```typescript
interface HealthMetrics {
  response_time_ms: number;
  error_rate: number;
  success_rate: number;
  consecutive_failures: number;
  last_health_check: string;
}
```

### System Events

All significant events are logged:

- Service status changes
- Circuit breaker state changes
- Operation queue events
- Failover activations

### Availability Calculation

The system can calculate service availability over time:

```typescript
const availability = await HealthMonitoringUtils.calculateAvailability(
  env,
  'R2_STORAGE',
  24 // hours
);
console.log(`R2 availability: ${availability}%`);
```

## Testing Failover

### Manual Testing

Force degradation for testing:

```typescript
await coordinator.forceDegradation('R2_STORAGE', 'Testing failover');
// Test operations...
await coordinator.forceRecovery('R2_STORAGE');
```

### Health Check Testing

```typescript
const result = await r2Service.checkHealth();
console.log('Health check:', result.success ? 'PASS' : 'FAIL');
```

## Best Practices

### 1. Error Handling
Always handle both successful and failed operations:

```typescript
const result = await coordinator.uploadFile(fileName, content, userId);
if (result.success) {
  // Handle success
} else if (result.queued) {
  // Handle queued operation
} else {
  // Handle failure
}
```

### 2. User Experience
Provide clear feedback about system status:

```typescript
const health = await coordinator.getHealthSummary();
const message = FailoverUtils.getStatusMessage(
  health.overall_status !== 'HEALTHY',
  queueStatus.total_size
);
```

### 3. Resource Management
Clean up resources properly:

```typescript
// In application shutdown
await coordinator.shutdown();
```

### 4. Monitoring
Regularly check system health:

```typescript
// In scheduled job
const health = await coordinator.getHealthSummary();
if (health.overall_status === 'OFFLINE') {
  // Alert administrators
}
```

## Performance Considerations

### Database Indexes
The schema includes optimized indexes for all query patterns:

```sql
CREATE INDEX idx_operation_queue_status ON operation_queue(status);
CREATE INDEX idx_operation_queue_priority ON operation_queue(priority);
CREATE INDEX idx_service_status_service_name ON service_status(service_name);
```

### Queue Processing
Operations are processed in batches to optimize performance:

```typescript
const batchSize = 10;
const operations = await queue.getReadyOperations(batchSize);
```

### Memory Management
Health monitoring uses efficient in-memory caching:

```typescript
private healthMetrics: Map<string, HealthMetrics> = new Map();
private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
```

## Security Considerations

### Access Control
- User notifications are filtered by user ID
- Admin endpoints require proper authentication
- Operation queue access is controlled

### Data Protection
- Sensitive data in operation payloads is base64 encoded
- Database queries use parameterized statements
- Error messages don't expose internal details

## Migration Guide

### From Existing R2 Code

1. Install the failover services
2. Replace direct R2 calls with failover service calls
3. Add health check endpoints
4. Update error handling to support queued operations
5. Add user notification handling

### Database Migration

Run the failover schema to add required tables:

```sql
-- Apply workers/src/db/schema/failover.sql
-- Or update workers/schema.sql with failover tables
```

## Troubleshooting

### Common Issues

1. **Circuit Breaker Stuck Open**
   - Check service health
   - Manually close circuit breaker if needed
   - Review failure threshold configuration

2. **Queue Not Processing**
   - Verify queue processing is enabled
   - Check for database connectivity
   - Review operation payloads for errors

3. **Notifications Not Delivered**
   - Check user ID validity
   - Verify notification limits
   - Review database constraints

### Debug Commands

```typescript
// Check service status
const status = await coordinator.getHealthSummary();

// View queue operations
const queueStatus = await coordinator.getQueueStatus();

// Check circuit breaker state
const r2Status = await r2Service.getServiceStatus();
```

## Future Enhancements

1. **Multi-Region Failover** - Automatic failover to backup regions
2. **Predictive Degradation** - ML-based failure prediction
3. **Advanced Metrics** - More detailed performance monitoring
4. **External Alerting** - Integration with monitoring services
5. **Automated Recovery** - Self-healing capabilities

## Conclusion

This failover implementation provides comprehensive protection against R2 outages while maintaining user experience through graceful degradation and transparent operation queuing. The modular design allows for easy integration into existing applications with minimal code changes.