# R2 Health Monitoring System

This comprehensive R2 health monitoring system provides circuit breaker pattern implementation, continuous health checking, and alerting for Cloudflare R2 storage operations.

## Overview

The monitoring system consists of three main components:

1. **CircuitBreaker** - Implements the circuit breaker pattern to handle service failures gracefully
2. **R2HealthMonitor** - Provides continuous health monitoring and alerting
3. **Health API Endpoints** - RESTful API for monitoring management and status

## Components

### Circuit Breaker (`circuit-breaker.ts`)

The circuit breaker prevents cascading failures by:
- Monitoring operation success/failure rates
- Transitioning between CLOSED, OPEN, and HALF_OPEN states
- Automatically attempting recovery after timeout periods
- Providing detailed metrics and logging

**States:**
- **CLOSED**: Normal operation, all requests allowed
- **OPEN**: Service failure detected, requests rejected immediately
- **HALF_OPEN**: Testing recovery, limited requests allowed

**Configuration:**
```typescript
{
  failureThreshold: 3,        // Failures before opening circuit
  recoveryTimeout: 60000,     // Milliseconds before retry attempt
  monitoringWindow: 300000,   // Window for failure rate calculation
  slowCallThreshold: 2000,    // Milliseconds to consider slow
  serviceName: 'r2'          // Service identifier
}
```

### R2 Health Monitor (`r2-health.ts`)

Provides comprehensive health monitoring:
- Continuous health checks for all R2 operations (GET, PUT, DELETE, LIST, HEAD)
- Configurable check intervals and thresholds
- Automatic alert generation based on error rates and response times
- Health metrics collection and aggregation
- Integration with circuit breaker for protection

**Health Check Operations:**
- **GET**: Tests file retrieval (uses non-existent file)
- **PUT**: Creates and uploads test file (auto-cleanup)
- **DELETE**: Creates file then deletes it
- **LIST**: Lists bucket contents (limited)
- **HEAD**: Tests file metadata retrieval

**Alert Types:**
- `circuit_breaker_open`: Circuit breaker opened due to failures
- `high_error_rate`: Error rate exceeds threshold
- `slow_response`: Average response time too high
- `service_degraded`: Multiple operations failing
- `service_recovered`: Service returned to healthy state

### Health API Endpoints (`health.ts`)

Complete REST API for monitoring management:

#### Core Health Endpoints
- `GET /api/health` - Overall health status
- `POST /api/health/check` - Trigger immediate health check
- `GET /api/health/history` - Recent health check history
- `GET /api/health/metrics` - Aggregated metrics over time period

#### Circuit Breaker Endpoints
- `GET /api/health/circuit-breaker` - Circuit breaker status
- `POST /api/health/circuit-breaker/reset` - Reset circuit breaker

#### Alert Management
- `GET /api/health/alerts` - Active alerts
- `POST /api/health/alerts/{id}/resolve` - Resolve specific alert

#### Configuration Management
- `GET /api/health/config` - Current monitoring configuration
- `PUT /api/health/config` - Update monitoring configuration

#### Control Endpoints
- `POST /api/health/monitoring/start` - Start health monitoring
- `POST /api/health/monitoring/stop` - Stop health monitoring

## Database Schema

The monitoring system uses the following tables:

### `r2_health_checks`
Stores individual health check results with operation details, response times, and error information.

### `circuit_breaker_events`
Logs circuit breaker state transitions with failure counts and metrics.

### `service_alerts`
Manages alert lifecycle including creation, resolution, and notification status.

### `r2_operation_metrics`
Aggregated statistics for performance analysis and reporting.

### `health_check_config`
Configurable monitoring parameters and thresholds.

## Integration

### R2 Service Integration

All R2 operations in `services/storage/r2.ts` are wrapped with circuit breaker protection:

```typescript
export async function saveFileToR2(env: Env, fileName: string, content: ArrayBuffer) {
  const circuitBreaker = getCircuitBreaker(env);
  return await circuitBreaker.execute(async () => {
    // R2 operation implementation
  });
}
```

### Automatic Initialization

The monitoring system automatically initializes when the worker starts:
- Health monitor starts on first request
- Scheduled health checks run via cron triggers
- Circuit breaker protects all R2 operations immediately

### Error Handling

The system provides graceful degradation:
- Circuit breaker prevents cascading failures
- Health monitoring continues even if individual checks fail
- Alerts notify of issues without blocking operations
- Recovery testing automatically attempts service restoration

## Configuration

### Default Settings

```typescript
{
  serviceName: 'r2',
  checkInterval: 30000,        // 30 seconds
  timeout: 5000,              // 5 seconds
  failureThreshold: 3,        // 3 failures
  recoveryTimeout: 60000,     // 1 minute
  slowResponseThreshold: 2000, // 2 seconds
  enabled: true,
  testOperations: ['get', 'put', 'delete'],
  alertOnFailure: true,
  alertOnRecovery: true
}
```

### Runtime Configuration

Configuration can be updated via API:

```bash
curl -X PUT /api/health/config \
  -H "Content-Type: application/json" \
  -d '{
    "checkInterval": 15000,
    "failureThreshold": 5,
    "slowResponseThreshold": 1000
  }'
```

## Monitoring and Alerting

### Health Status Levels
- **HEALTHY**: All operations successful, normal response times
- **DEGRADED**: Some failures or slow responses, but service functional
- **UNHEALTHY**: High failure rates or circuit breaker open

### Alert Severity Levels
- **LOW**: Minor issues, informational
- **MEDIUM**: Service degradation detected
- **HIGH**: Significant service issues
- **CRITICAL**: Service unavailable (circuit breaker open)

### Metrics Collection

The system collects comprehensive metrics:
- Total/successful/failed operation counts
- Average/min/max response times
- Error rates by operation type
- Circuit breaker state changes
- Alert frequency and resolution times

## Usage Examples

### Check Current Health Status
```bash
curl /api/health
```

### Trigger Manual Health Check
```bash
curl -X POST /api/health/check
```

### View Recent Health History
```bash
curl /api/health/history?limit=100
```

### Get Performance Metrics
```bash
curl /api/health/metrics?hours=24
```

### Reset Circuit Breaker
```bash
curl -X POST /api/health/circuit-breaker/reset
```

### Resolve Alert
```bash
curl -X POST /api/health/alerts/123/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolutionNotes": "Issue resolved by restarting service"}'
```

## Advanced Features

### Circuit Breaker Recovery Testing
- Automatic transition to HALF_OPEN state after timeout
- Limited request testing during recovery
- Automatic closure on successful recovery
- Exponential backoff for repeated failures

### Health Check Test File Management
- Automatic creation and cleanup of test files
- Unique file names to prevent conflicts
- Minimal storage impact with immediate cleanup
- Safe testing without affecting production data

### Performance Optimization
- Efficient database queries with proper indexing
- Configurable monitoring intervals to balance accuracy vs. performance
- Automatic cleanup of old monitoring data
- View-based queries for common operations

### Extensibility
- Pluggable alert mechanisms
- Configurable test operations
- Extensible metrics collection
- Integration points for external monitoring systems

## Troubleshooting

### Common Issues

1. **Circuit Breaker Stuck Open**
   - Check R2 bucket permissions and connectivity
   - Verify network connectivity to Cloudflare
   - Reset circuit breaker via API if needed

2. **High False Positive Alerts**
   - Adjust failure thresholds in configuration
   - Increase slow response threshold if needed
   - Review and tune monitoring intervals

3. **Missing Health Checks**
   - Verify monitoring is enabled in configuration
   - Check worker scheduled event configuration
   - Review worker logs for initialization errors

4. **Database Performance Issues**
   - Monitor query performance on large datasets
   - Consider adjusting cleanup retention periods
   - Review database connection limits

### Debugging

Enable detailed logging by checking:
- Worker console logs for circuit breaker events
- Database query performance metrics
- Health check operation timing and errors
- Alert generation and resolution patterns

## Security Considerations

- Health endpoints should be protected with appropriate authentication
- Sensitive configuration data is stored securely in environment variables
- Test file operations use secure, unique identifiers
- Database access follows principle of least privilege
- Circuit breaker state transitions are logged for audit trails