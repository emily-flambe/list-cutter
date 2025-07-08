# Disaster Recovery Testing Framework

## Overview

The Disaster Recovery (DR) Testing Framework provides comprehensive automated testing capabilities for validating the resilience and recovery capabilities of the R2 storage system. This framework ensures that disaster recovery mechanisms work as expected and meet Recovery Time Objective (RTO) and Recovery Point Objective (RPO) requirements.

## Architecture

### Core Components

1. **DRTestingService** - Main service class for test execution and management
2. **TestScenarios** - Comprehensive test scenario implementations
3. **Database Schema** - Structured storage for test data, results, and metrics
4. **API Endpoints** - RESTful interface for test management and reporting

### Integration Points

- **Health Monitor** - Monitors service health during tests
- **Circuit Breaker** - Tests failure detection and recovery
- **Backup System** - Validates backup and restore operations
- **Failover System** - Tests automatic failover mechanisms
- **Operation Queue** - Validates operation queueing during outages

## Test Scenarios

### 1. Complete R2 Outage Simulation

**Purpose**: Tests system behavior during complete R2 service outage

**Steps**:
- Block all R2 operations
- Trigger circuit breaker
- Verify operation queueing
- Test user notifications
- Restore R2 service
- Verify service recovery
- Process queued operations

**Target Metrics**:
- RTO: 5 minutes (300,000ms)
- RPO: 1 minute (60,000ms)

### 2. Partial Service Degradation

**Purpose**: Tests system behavior under partial service degradation

**Steps**:
- Introduce 50% operation failure rate
- Monitor circuit breaker behavior
- Verify retry mechanisms
- Test performance alerts
- Gradually restore service

**Target Metrics**:
- RTO: 3 minutes (180,000ms)
- RPO: 30 seconds (30,000ms)

### 3. Circuit Breaker Functionality

**Purpose**: Tests circuit breaker behavior under various conditions

**Steps**:
- Test failure threshold trigger
- Verify circuit breaker opens
- Test fail-fast behavior
- Test half-open state
- Verify recovery process
- Test multiple failure scenarios

**Target Metrics**:
- Response Time: 1 minute (60,000ms)

### 4. Backup and Restore

**Purpose**: Tests backup creation and restoration processes

**Steps**:
- Create test data
- Perform full backup
- Verify backup integrity
- Simulate data loss
- Restore from backup
- Verify data integrity
- Test incremental backup

**Target Metrics**:
- Backup RTO: 5 minutes (300,000ms)
- Restore RTO: 15 minutes (900,000ms)

### 5. Failover Mechanism

**Purpose**: Tests automated failover and recovery mechanisms

**Steps**:
- Simulate primary service failure
- Trigger automatic failover
- Verify secondary operations
- Test read-only mode
- Test failback process
- Verify data consistency

**Target Metrics**:
- Failover RTO: 2 minutes (120,000ms)
- Failback RTO: 2 minutes (120,000ms)

### 6. Performance Benchmark

**Purpose**: Tests system performance under normal and stress conditions

**Steps**:
- Establish baseline metrics
- Run concurrent operations test
- Test large file operations
- Stress test with high load
- Test memory and resource usage
- Verify performance thresholds

## Database Schema

### Core Tables

#### `dr_tests`
Stores main test execution records
```sql
- id: Test identifier
- test_type: Type of test scenario
- scenario: Scenario name
- status: Test execution status
- start_time/end_time: Execution timeframe
- rto_actual_ms/rpo_actual_ms: Measured metrics
- test_config: Test configuration
```

#### `test_results`
Stores detailed test component results
```sql
- test_id: Reference to dr_tests
- component: Component being tested
- test_name: Specific test name
- expected_result/actual_result: Test outcomes
- passed: Success/failure indicator
- execution_time_ms: Performance metrics
```

#### `test_logs`
Stores detailed execution logs
```sql
- test_id: Reference to dr_tests
- timestamp: Log entry time
- event_type: Type of event
- message: Log message
- level: Log level (debug, info, warn, error)
```

#### `test_metrics`
Stores performance and reliability metrics
```sql
- test_id: Reference to dr_tests
- metric_name: Name of metric
- metric_type: Type (rto, rpo, throughput, etc.)
- value: Metric value
- threshold: Target threshold
- passed: Whether threshold was met
```

#### `test_scenarios`
Stores test scenario templates
```sql
- scenario_name: Unique scenario identifier
- test_type: Category of test
- description: Scenario description
- test_steps: JSON array of steps
- expected_outcomes: JSON array of outcomes
- prerequisites: JSON object with requirements
```

#### `test_schedules`
Manages automated test scheduling
```sql
- scenario_id: Reference to test_scenarios
- schedule_name: Schedule identifier
- cron_expression: Scheduling pattern
- enabled: Whether schedule is active
- last_run/next_run: Execution timing
```

## API Endpoints

### Test Execution

#### Execute Test
```http
POST /api/testing/execute
Content-Type: application/json

{
  "scenario_name": "Complete R2 Outage Simulation",
  "executed_by": "admin",
  "environment": "test"
}
```

#### Cancel Test
```http
POST /api/testing/tests/{testId}/cancel
```

### Test Management

#### Get Test Scenarios
```http
GET /api/testing/scenarios
```

#### Get Test History
```http
GET /api/testing/history?limit=50
```

#### Get Test Details
```http
GET /api/testing/tests/{testId}
```

#### Get Test Results
```http
GET /api/testing/tests/{testId}/results
```

#### Get Test Logs
```http
GET /api/testing/tests/{testId}/logs
```

#### Get Test Metrics
```http
GET /api/testing/tests/{testId}/metrics
```

### Reporting

#### Generate Report
```http
POST /api/testing/reports/generate
Content-Type: application/json

{
  "report_type": "weekly",
  "period_start": "2024-01-01T00:00:00Z",
  "period_end": "2024-01-07T23:59:59Z",
  "report_name": "Weekly DR Test Report"
}
```

#### Get Reports
```http
GET /api/testing/reports?limit=20&type=weekly
```

### Scheduling

#### Schedule Automated Test
```http
POST /api/testing/schedule
Content-Type: application/json

{
  "scenario_id": 1,
  "schedule_name": "Daily Circuit Breaker Test",
  "cron_expression": "0 3 * * *",
  "enabled": true
}
```

#### Get Test Schedules
```http
GET /api/testing/schedules
```

#### Update Schedule
```http
PUT /api/testing/schedules/{scheduleId}
Content-Type: application/json

{
  "enabled": false
}
```

### Statistics

#### Get Test Statistics
```http
GET /api/testing/stats?period=7d
```

Response:
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "overall": {
      "total_tests": 25,
      "completed_tests": 23,
      "failed_tests": 2,
      "success_rate": 92.0,
      "avg_rto_ms": 145000,
      "avg_rpo_ms": 45000
    },
    "by_type": [
      {
        "test_type": "circuit_breaker",
        "total": 10,
        "completed": 10,
        "failed": 0
      }
    ],
    "recent_tests": [...]
  }
}
```

## Usage Examples

### Manual Test Execution

```javascript
// Execute a complete outage test
const response = await fetch('/api/testing/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    scenario_name: 'Complete R2 Outage Simulation',
    executed_by: 'admin',
    environment: 'test'
  })
});

const result = await response.json();
console.log('Test ID:', result.data.test_id);
```

### Monitor Test Progress

```javascript
// Get test details and logs
const testId = 123;
const [details, logs] = await Promise.all([
  fetch(`/api/testing/tests/${testId}`).then(r => r.json()),
  fetch(`/api/testing/tests/${testId}/logs`).then(r => r.json())
]);

console.log('Test Status:', details.data.test.status);
console.log('Latest Log:', logs.data[logs.data.length - 1]);
```

### Generate Weekly Report

```javascript
// Generate and retrieve weekly report
const reportResponse = await fetch('/api/testing/reports/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    report_type: 'weekly',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-07T23:59:59Z',
    report_name: 'Weekly DR Test Report'
  })
});

const report = await reportResponse.json();
console.log('Success Rate:', report.data.success_rate);
console.log('Recommendations:', report.data.recommendations);
```

## Configuration

### Environment Variables

```bash
# Enable/disable testing features
DR_TESTING_ENABLED=true

# Test execution limits
DR_MAX_CONCURRENT_TESTS=1
DR_TEST_TIMEOUT_MS=1800000  # 30 minutes

# Notification settings
DR_ALERT_WEBHOOK_URL=https://your-webhook.com/alerts
DR_NOTIFICATION_ENABLED=true
```

### Default Test Scenarios

The framework comes pre-configured with 6 comprehensive test scenarios:

1. **Complete R2 Outage Simulation** - Weekly schedule
2. **Partial Service Degradation** - Daily schedule
3. **Circuit Breaker Functionality** - Every 6 hours
4. **Backup and Restore** - Weekly schedule
5. **Failover Mechanism** - As needed
6. **Performance Benchmark** - Daily schedule

### Customization

#### Adding Custom Test Scenarios

```sql
INSERT INTO test_scenarios (
  scenario_name,
  test_type,
  description,
  test_steps,
  expected_outcomes,
  rto_target_ms,
  rpo_target_ms,
  prerequisites,
  cleanup_steps
) VALUES (
  'Custom Network Partition Test',
  'failover_mechanism',
  'Tests behavior during network partition',
  '["Simulate network partition", "Test split-brain prevention", "Verify recovery"]',
  '["No data corruption", "Service availability maintained", "Recovery within RTO"]',
  180000,
  60000,
  '{"network_monitoring": true}',
  '["Restore network connectivity", "Verify system state"]'
);
```

#### Custom Test Implementation

Extend the `TestScenarios` class to add custom test logic:

```typescript
class CustomTestScenarios extends TestScenarios {
  async executeCustomNetworkPartitionTest(testId: number): Promise<{
    results: TestResult[];
    logs: TestLog[];
    metrics: TestMetric[];
  }> {
    // Custom test implementation
    const results: TestResult[] = [];
    const logs: TestLog[] = [];
    const metrics: TestMetric[] = [];

    // Your custom test logic here

    return { results, logs, metrics };
  }
}
```

## Monitoring and Alerting

### Test Failure Alerts

Failed tests automatically generate alerts in the system:

```sql
INSERT INTO service_alerts (
  alert_type,
  severity,
  service_name,
  message,
  details
) VALUES (
  'dr_test_failed',
  'high',
  'dr_testing',
  'Disaster Recovery test failed: Complete R2 Outage Simulation',
  '{"test_id": 123, "failure_reason": "Circuit breaker did not open", "rto_exceeded": true}'
);
```

### Metrics Collection

Key metrics are automatically collected:

- **RTO (Recovery Time Objective)** - Time to recover from failure
- **RPO (Recovery Point Objective)** - Maximum acceptable data loss
- **Test Success Rate** - Percentage of tests passing
- **Component Reliability** - Individual component test results
- **Performance Metrics** - Response times, throughput, error rates

### Dashboard Integration

Test results can be integrated with monitoring dashboards:

```javascript
// Get metrics for dashboard
const metrics = await fetch('/api/testing/stats?period=30d');
const data = await metrics.json();

// Display on dashboard
updateDashboard({
  successRate: data.overall.success_rate,
  avgRTO: data.overall.avg_rto_ms,
  avgRPO: data.overall.avg_rpo_ms,
  recentTests: data.recent_tests
});
```

## Best Practices

### Test Execution

1. **Run tests in isolation** - Ensure no concurrent critical operations
2. **Monitor resource usage** - Avoid overwhelming the system
3. **Validate prerequisites** - Check system state before testing
4. **Document failures** - Capture detailed logs for analysis
5. **Regular scheduling** - Automate routine DR testing

### Security Considerations

1. **Admin-only execution** - Restrict test execution to administrators
2. **Audit logging** - Log all test activities
3. **Data protection** - Ensure test data doesn't contain sensitive information
4. **Access control** - Implement proper authentication for test APIs
5. **Environment isolation** - Use separate test environments when possible

### Performance Optimization

1. **Cleanup procedures** - Implement thorough cleanup after tests
2. **Resource limits** - Set appropriate timeouts and limits
3. **Parallel execution** - Avoid running conflicting tests simultaneously
4. **Data retention** - Implement automatic cleanup of old test data
5. **Efficient querying** - Use database indexes for better performance

## Troubleshooting

### Common Issues

#### Test Execution Failures

1. **Prerequisite check failures**
   - Verify system components are available
   - Check database connectivity
   - Ensure backup systems are operational

2. **Timeout errors**
   - Increase test timeout settings
   - Check system performance
   - Verify network connectivity

3. **Circuit breaker issues**
   - Reset circuit breaker state
   - Check failure thresholds
   - Verify monitoring configuration

#### Database Issues

1. **Schema not found**
   ```sql
   -- Ensure testing schema is applied
   .read workers/src/db/schema/testing.sql
   ```

2. **Missing test scenarios**
   ```sql
   -- Check if scenarios are loaded
   SELECT COUNT(*) FROM test_scenarios;
   ```

3. **Foreign key constraints**
   ```sql
   -- Verify referential integrity
   PRAGMA foreign_key_check;
   ```

### Debug Mode

Enable debug logging for detailed troubleshooting:

```typescript
// Set debug mode in test execution
const result = await drTestingService.executeTest(
  'Complete R2 Outage Simulation',
  'admin',
  'test',
  { debug: true }
);
```

### Log Analysis

Monitor test logs for issues:

```sql
-- Get error logs for failed test
SELECT * FROM test_logs 
WHERE test_id = ? AND level IN ('error', 'fatal')
ORDER BY timestamp;
```

## Future Enhancements

### Planned Features

1. **Advanced Scheduling** - Cron-based scheduling with timezone support
2. **Test Templates** - Reusable test configurations
3. **Real-time Monitoring** - Live test execution monitoring
4. **Integration Tests** - End-to-end system testing
5. **Load Testing** - Performance testing under load
6. **Chaos Engineering** - Random failure injection
7. **Recovery Verification** - Automated recovery validation
8. **Compliance Reporting** - Regulatory compliance reports

### Extensibility

The framework is designed for extensibility:

- **Plugin Architecture** - Add custom test types
- **Event Hooks** - React to test events
- **Custom Metrics** - Define application-specific metrics
- **Integration APIs** - Connect with external systems
- **Notification Channels** - Multiple alert destinations

## Support

For issues or questions regarding the DR Testing Framework:

1. Check the troubleshooting section above
2. Review test logs for error details
3. Verify system prerequisites are met
4. Consult the API documentation for usage examples
5. Contact the development team for assistance