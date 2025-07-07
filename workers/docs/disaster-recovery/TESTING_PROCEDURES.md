# Disaster Recovery Testing Procedures

## Overview

This document outlines comprehensive testing procedures for the List Cutter disaster recovery system. Regular testing ensures that recovery procedures work as expected and that the team is prepared to respond effectively to real incidents.

## Testing Schedule

### Quarterly Testing Calendar

#### Q1 Testing Focus: Basic Failover Testing
- **January**: Circuit breaker testing
- **February**: Degraded mode testing  
- **March**: Queue processing testing

#### Q2 Testing Focus: Data Recovery Testing
- **April**: Backup verification testing
- **May**: Partial data restoration testing
- **June**: Complete backup restoration testing

#### Q3 Testing Focus: Full Disaster Simulation
- **July**: Complete R2 outage simulation
- **August**: Multi-service failure testing
- **September**: Communication and escalation testing

#### Q4 Testing Focus: Performance and Optimization
- **October**: Load testing under degraded conditions
- **November**: Recovery time optimization testing
- **December**: Year-end comprehensive testing

### Annual Testing Requirements

- **Semi-annual**: Full disaster recovery exercise
- **Annual**: Complete business continuity test
- **Ongoing**: Monthly component testing

## Test Categories

### 1. Component Testing (Monthly)

#### Circuit Breaker Testing

**Objective**: Verify circuit breaker functionality and state transitions

**Prerequisites**:
- Test environment access
- Administrative credentials
- Monitoring systems operational

**Test Procedure**:

```bash
# Step 1: Verify initial state
curl -X GET https://test-worker.example.com/health/circuit-breaker \
  -H "Authorization: Bearer <test_token>"

# Expected: Circuit breaker in CLOSED state
# {
#   "success": true,
#   "data": {
#     "state": "CLOSED",
#     "failure_count": 0,
#     "last_failure": null
#   }
# }

# Step 2: Simulate failures to trigger circuit breaker
for i in {1..5}; do
  echo "Simulating failure $i/5"
  curl -X POST https://test-worker.example.com/health/simulate-failure \
    -H "Authorization: Bearer <test_token>" \
    -H "Content-Type: application/json" \
    -d '{"service": "R2_STORAGE", "error_type": "TIMEOUT"}'
  sleep 5
done

# Step 3: Verify circuit breaker opened
curl -X GET https://test-worker.example.com/health/circuit-breaker \
  -H "Authorization: Bearer <test_token>"

# Expected: Circuit breaker in OPEN state
# {
#   "success": true,
#   "data": {
#     "state": "OPEN",
#     "failure_count": 5,
#     "opened_at": "2024-01-15T10:30:00Z"
#   }
# }

# Step 4: Wait for recovery timeout and test HALF_OPEN state
sleep 65  # Wait for 60-second recovery timeout

curl -X POST https://test-worker.example.com/health/r2/test \
  -H "Authorization: Bearer <test_token>"

curl -X GET https://test-worker.example.com/health/circuit-breaker \
  -H "Authorization: Bearer <test_token>"

# Expected: Circuit breaker in HALF_OPEN state

# Step 5: Successful operation should close circuit breaker
curl -X POST https://test-worker.example.com/health/simulate-success \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"service": "R2_STORAGE"}'

curl -X GET https://test-worker.example.com/health/circuit-breaker \
  -H "Authorization: Bearer <test_token>"

# Expected: Circuit breaker back to CLOSED state

# Step 6: Reset for next test
curl -X POST https://test-worker.example.com/health/circuit-breaker/reset \
  -H "Authorization: Bearer <test_token>"
```

**Success Criteria**:
- Circuit breaker opens after configured failure threshold
- Recovery timeout period observed correctly
- HALF_OPEN state allows limited testing
- Successful operations close the circuit breaker
- All state transitions logged correctly

**Validation Commands**:
```bash
# Check circuit breaker events log
curl -X GET "https://test-worker.example.com/health/events?type=CIRCUIT_BREAKER" \
  -H "Authorization: Bearer <test_token>"

# Verify metrics collection
curl -X GET "https://test-worker.example.com/health/metrics?hours=1" \
  -H "Authorization: Bearer <test_token>"
```

#### Degraded Mode Testing

**Objective**: Verify system behavior in degraded mode

**Test Procedure**:

```bash
# Step 1: Activate degraded mode
curl -X POST https://test-worker.example.com/health/services/R2_STORAGE/degrade \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing degraded mode functionality"}'

# Step 2: Verify read-only mode active
curl -X GET https://test-worker.example.com/health/services/R2_STORAGE \
  -H "Authorization: Bearer <test_token>"

# Expected: Service in DEGRADED state with read_only_mode: true

# Step 3: Test operations during degraded mode
# Upload should be queued
curl -X POST https://test-worker.example.com/api/list_cutter/upload \
  -H "Authorization: Bearer <test_token>" \
  -F "file=@test_file.csv"

# Download should still work
curl -X GET https://test-worker.example.com/api/list_cutter/download/existing_file.csv \
  -H "Authorization: Bearer <test_token>"

# Step 4: Verify operation queuing
curl -X GET https://test-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <test_token>"

# Expected: Queued operations present

# Step 5: Exit degraded mode
curl -X POST https://test-worker.example.com/health/services/R2_STORAGE/restore \
  -H "Authorization: Bearer <test_token>"

# Step 6: Verify queue processing
curl -X GET https://test-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <test_token>"

# Wait for queue to process
while true; do
  QUEUE_SIZE=$(curl -s "https://test-worker.example.com/health/queue/status" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data.total_queued")
  
  if [ "$QUEUE_SIZE" -eq 0 ]; then
    echo "Queue processing complete"
    break
  fi
  
  echo "Queue size: $QUEUE_SIZE, waiting..."
  sleep 10
done
```

**Success Criteria**:
- System correctly enters degraded mode
- Read operations continue to function
- Write operations are queued
- Queue processing works upon restoration
- User notifications sent appropriately

### 2. Integration Testing (Quarterly)

#### Backup and Restore Testing

**Objective**: Verify complete backup and restoration process

**Test Procedure**:

```bash
# Step 1: Create test data
curl -X POST https://test-worker.example.com/api/test/generate-data \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_count": 50,
    "file_sizes": ["1KB", "10KB", "100KB", "1MB"],
    "users": 5
  }'

# Step 2: Create baseline checksum
curl -X POST https://test-worker.example.com/api/test/create-checksum \
  -H "Authorization: Bearer <test_token>"

BASELINE_CHECKSUM=$(curl -s "https://test-worker.example.com/api/test/get-checksum" \
  -H "Authorization: Bearer <test_token>" | jq -r ".data.checksum")

echo "Baseline checksum: $BASELINE_CHECKSUM"

# Step 3: Create backup
curl -X POST https://test-worker.example.com/api/backup/create \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "full", "test_mode": true}'

# Wait for backup completion
while true; do
  BACKUP_STATUS=$(curl -s "https://test-worker.example.com/api/backup/list?limit=1" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data[0].status")
  
  if [ "$BACKUP_STATUS" = "completed" ]; then
    echo "Backup completed"
    BACKUP_ID=$(curl -s "https://test-worker.example.com/api/backup/list?limit=1" \
      -H "Authorization: Bearer <test_token>" | jq -r ".data[0].id")
    break
  fi
  
  echo "Backup status: $BACKUP_STATUS, waiting..."
  sleep 30
done

echo "Backup ID: $BACKUP_ID"

# Step 4: Simulate data loss
curl -X POST https://test-worker.example.com/api/test/simulate-data-loss \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"percentage": 30}'

# Step 5: Verify backup integrity
curl -X POST "https://test-worker.example.com/api/backup/verify/$BACKUP_ID" \
  -H "Authorization: Bearer <test_token>"

# Wait for verification
while true; do
  VERIFY_STATUS=$(curl -s "https://test-worker.example.com/api/backup/status/$BACKUP_ID" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data.verification_status")
  
  if [ "$VERIFY_STATUS" = "verified" ]; then
    echo "Backup verification completed"
    break
  fi
  
  echo "Verification status: $VERIFY_STATUS, waiting..."
  sleep 10
done

# Step 6: Restore from backup
curl -X POST "https://test-worker.example.com/api/backup/restore/$BACKUP_ID" \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "overwrite_existing": true,
    "verify_after_restore": true,
    "test_mode": true
  }'

# Wait for restoration
while true; do
  RESTORE_STATUS=$(curl -s "https://test-worker.example.com/api/backup/status/$BACKUP_ID" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data.restore_status")
  
  if [ "$RESTORE_STATUS" = "completed" ]; then
    echo "Restoration completed"
    break
  fi
  
  echo "Restore status: $RESTORE_STATUS, waiting..."
  sleep 30
done

# Step 7: Verify restoration
curl -X POST https://test-worker.example.com/api/test/verify-restoration \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"baseline_checksum": "'$BASELINE_CHECKSUM'"}'

RESTORATION_RESULT=$(curl -s "https://test-worker.example.com/api/test/verify-restoration" \
  -H "Authorization: Bearer <test_token>" | jq -r ".data.verification_result")

echo "Restoration verification: $RESTORATION_RESULT"

# Step 8: Cleanup test data
curl -X POST https://test-worker.example.com/api/test/cleanup \
  -H "Authorization: Bearer <test_token>"
```

**Success Criteria**:
- Backup creates successfully
- Backup verification passes
- Restoration completes without errors
- Data integrity maintained after restoration
- All test data properly cleaned up

### 3. End-to-End Testing (Semi-Annual)

#### Complete Disaster Simulation

**Objective**: Simulate a complete R2 outage and test full recovery procedures

**Test Procedure**:

```bash
#!/bin/bash
# Complete Disaster Recovery Test Script

echo "=== DISASTER RECOVERY TEST STARTING ==="
echo "Test ID: DR-$(date +%Y%m%d-%H%M%S)"

# Step 1: Pre-test setup
echo "Step 1: Pre-test setup and baseline creation"

curl -X POST https://test-worker.example.com/api/test/setup-disaster-test \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "test_users": 10,
    "test_files": 100,
    "test_duration": 3600
  }'

# Create pre-disaster backup
echo "Creating pre-disaster backup..."
curl -X POST https://test-worker.example.com/api/backup/create \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "full", "tag": "pre_disaster_test"}'

# Wait for backup completion
while true; do
  BACKUP_STATUS=$(curl -s "https://test-worker.example.com/api/backup/list?tag=pre_disaster_test&limit=1" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data[0].status")
  
  if [ "$BACKUP_STATUS" = "completed" ]; then
    PRE_DISASTER_BACKUP=$(curl -s "https://test-worker.example.com/api/backup/list?tag=pre_disaster_test&limit=1" \
      -H "Authorization: Bearer <test_token>" | jq -r ".data[0].id")
    echo "Pre-disaster backup created: $PRE_DISASTER_BACKUP"
    break
  fi
  
  sleep 30
done

# Step 2: Simulate disaster
echo "Step 2: Simulating complete R2 outage"

curl -X POST https://test-worker.example.com/api/test/simulate-r2-outage \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{"outage_type": "complete", "duration": 1800}'

# Verify disaster state
echo "Verifying disaster state..."
sleep 10

HEALTH_STATUS=$(curl -s "https://test-worker.example.com/health/status" \
  -H "Authorization: Bearer <test_token>" | jq -r ".data.overall_status")

if [ "$HEALTH_STATUS" != "DEGRADED" ]; then
  echo "ERROR: System not in degraded state. Status: $HEALTH_STATUS"
  exit 1
fi

echo "Disaster simulation successful. System in degraded state."

# Step 3: Test system behavior during outage
echo "Step 3: Testing system behavior during outage"

# Test upload queueing
echo "Testing upload queueing..."
curl -X POST https://test-worker.example.com/api/list_cutter/upload \
  -H "Authorization: Bearer <test_token>" \
  -F "file=@test_file.csv" \
  -F "test_mode=true"

# Test download availability
echo "Testing download availability..."
curl -X GET https://test-worker.example.com/api/list_cutter/download/existing_file.csv \
  -H "Authorization: Bearer <test_token>"

# Check queue buildup
QUEUE_SIZE=$(curl -s "https://test-worker.example.com/health/queue/status" \
  -H "Authorization: Bearer <test_token>" | jq -r ".data.total_queued")

echo "Operations queued during outage: $QUEUE_SIZE"

# Step 4: Simulate service recovery
echo "Step 4: Simulating service recovery"

curl -X POST https://test-worker.example.com/api/test/restore-r2-service \
  -H "Authorization: Bearer <test_token>"

echo "Waiting for service recovery detection..."
sleep 30

# Step 5: Test recovery procedures
echo "Step 5: Testing recovery procedures"

# Reset circuit breaker
curl -X POST https://test-worker.example.com/health/circuit-breaker/reset \
  -H "Authorization: Bearer <test_token>"

# Exit degraded mode
curl -X POST https://test-worker.example.com/health/services/R2_STORAGE/restore \
  -H "Authorization: Bearer <test_token>"

# Monitor queue processing
echo "Monitoring queue processing..."
while true; do
  QUEUE_SIZE=$(curl -s "https://test-worker.example.com/health/queue/status" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data.total_queued")
  
  echo "Remaining queue size: $QUEUE_SIZE"
  
  if [ "$QUEUE_SIZE" -eq 0 ]; then
    echo "Queue processing complete"
    break
  fi
  
  sleep 30
done

# Step 6: Validate recovery
echo "Step 6: Validating complete recovery"

# Health check
curl -X POST https://test-worker.example.com/health/check \
  -H "Authorization: Bearer <test_token>"

FINAL_HEALTH=$(curl -s "https://test-worker.example.com/health/status" \
  -H "Authorization: Bearer <test_token>" | jq -r ".data.overall_status")

if [ "$FINAL_HEALTH" = "HEALTHY" ]; then
  echo "✅ Recovery successful - System healthy"
else
  echo "❌ Recovery failed - System status: $FINAL_HEALTH"
  exit 1
fi

# Test operations
echo "Testing post-recovery operations..."
curl -X POST https://test-worker.example.com/api/list_cutter/upload \
  -H "Authorization: Bearer <test_token>" \
  -F "file=@test_file.csv" \
  -F "test_mode=true"

curl -X GET https://test-worker.example.com/api/list_cutter/download/test_file.csv \
  -H "Authorization: Bearer <test_token>"

# Step 7: Cleanup
echo "Step 7: Test cleanup"

curl -X POST https://test-worker.example.com/api/test/cleanup-disaster-test \
  -H "Authorization: Bearer <test_token>"

echo "=== DISASTER RECOVERY TEST COMPLETED SUCCESSFULLY ==="
```

**Success Criteria**:
- System correctly detects and responds to outage
- Degraded mode activates automatically
- Operations are queued during outage
- Recovery procedures execute correctly
- Queue processing completes successfully
- System returns to healthy state
- Post-recovery operations function normally

### 4. Performance Testing (Quarterly)

#### Load Testing Under Degraded Conditions

**Objective**: Verify system performance during degraded mode operations

**Test Procedure**:

```bash
# Step 1: Activate degraded mode
curl -X POST https://test-worker.example.com/health/services/R2_STORAGE/degrade \
  -H "Authorization: Bearer <test_token>"

# Step 2: Generate load
curl -X POST https://test-worker.example.com/api/test/load-test \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "concurrent_users": 50,
    "operations_per_minute": 100,
    "test_duration": 600,
    "operation_mix": {
      "upload": 40,
      "download": 50,
      "list": 10
    }
  }'

# Step 3: Monitor performance
while true; do
  METRICS=$(curl -s "https://test-worker.example.com/health/metrics?minutes=5" \
    -H "Authorization: Bearer <test_token>")
  
  RESPONSE_TIME=$(echo "$METRICS" | jq -r ".data.avg_response_time")
  ERROR_RATE=$(echo "$METRICS" | jq -r ".data.error_rate")
  QUEUE_SIZE=$(curl -s "https://test-worker.example.com/health/queue/status" \
    -H "Authorization: Bearer <test_token>" | jq -r ".data.total_queued")
  
  echo "$(date): Response Time: ${RESPONSE_TIME}ms, Error Rate: ${ERROR_RATE}%, Queue: $QUEUE_SIZE"
  
  sleep 60
done
```

**Success Criteria**:
- Queue size remains manageable (< 1000 operations)
- Error rates stay below 5%
- Response times for successful operations < 10 seconds
- System remains stable throughout test
- No memory or resource leaks detected

## Test Result Documentation

### Test Report Template

```markdown
# Disaster Recovery Test Report

## Test Information
- **Test ID**: DR-YYYY-MM-DD-XXX
- **Test Date**: [Date]
- **Test Type**: [Component/Integration/End-to-End/Performance]
- **Test Duration**: [Duration]
- **Tester**: [Name]

## Test Objectives
[List of objectives being tested]

## Test Environment
- **Environment**: [Test/Staging/Production-like]
- **System Version**: [Version]
- **Infrastructure**: [Details]

## Test Results Summary
- **Overall Result**: ✅ PASS / ❌ FAIL
- **Tests Executed**: [Number]
- **Tests Passed**: [Number]
- **Tests Failed**: [Number]

## Detailed Results

### Test Case 1: [Name]
- **Objective**: [Description]
- **Result**: ✅ PASS / ❌ FAIL
- **Duration**: [Time]
- **Notes**: [Details]

### Test Case 2: [Name]
- **Objective**: [Description]
- **Result**: ✅ PASS / ❌ FAIL
- **Duration**: [Time]
- **Notes**: [Details]

## Performance Metrics
- **RTO Achieved**: [Time]
- **RPO Achieved**: [Time]
- **Recovery Success Rate**: [Percentage]
- **Queue Processing Rate**: [Operations/minute]

## Issues Identified
1. **Issue**: [Description]
   - **Severity**: [High/Medium/Low]
   - **Impact**: [Description]
   - **Recommendation**: [Action needed]

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Next Steps
- [ ] Address identified issues
- [ ] Update procedures based on findings
- [ ] Schedule follow-up testing
- [ ] Update documentation

## Appendices
- A: Detailed test logs
- B: Performance metrics
- C: Error logs
- D: System state snapshots
```

### Test Validation Checklist

#### Pre-Test Validation
- [ ] Test environment ready
- [ ] Backup systems functional
- [ ] Monitoring systems operational
- [ ] Test data prepared
- [ ] Team notified of testing

#### During Test Validation
- [ ] All test steps executed
- [ ] Results documented
- [ ] Performance metrics collected
- [ ] Issues identified and recorded
- [ ] Emergency procedures available

#### Post-Test Validation
- [ ] System restored to normal state
- [ ] Test data cleaned up
- [ ] Results analyzed
- [ ] Report generated
- [ ] Recommendations documented

## Continuous Improvement

### Test Process Evolution

#### Monthly Reviews
- Review test results and trends
- Update test procedures based on findings
- Adjust testing schedule if needed
- Train team on new procedures

#### Quarterly Assessments
- Evaluate testing effectiveness
- Compare actual vs. target RTO/RPO
- Update test scenarios based on system changes
- Review and update success criteria

#### Annual Planning
- Plan next year's testing calendar
- Assess resource requirements
- Update disaster recovery strategies
- Set new performance targets

### Automation Opportunities

#### Automated Testing Components
```bash
# Automated circuit breaker testing
#!/bin/bash
# automated_circuit_breaker_test.sh

curl -X POST https://test-worker.example.com/api/test/automated-circuit-breaker-test \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "test_type": "circuit_breaker",
    "failure_threshold": 3,
    "recovery_timeout": 60,
    "iterations": 5
  }'
```

#### Continuous Monitoring Integration
```bash
# Integration with monitoring for automatic test triggers
curl -X POST https://test-worker.example.com/api/test/schedule-automated-test \
  -H "Authorization: Bearer <test_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "test_type": "health_check",
    "schedule": "0 2 * * 0",
    "conditions": {
      "health_status": "HEALTHY",
      "load_level": "LOW"
    }
  }'
```

## Compliance and Auditing

### Audit Trail Requirements
- All test executions logged
- Results retained for compliance
- Access controls for test systems
- Change management for test procedures

### Compliance Reporting
```bash
# Generate compliance report
curl -X GET "https://test-worker.example.com/api/test/compliance-report?period=quarterly" \
  -H "Authorization: Bearer <admin_token>"
```

### Documentation Requirements
- Test procedures version controlled
- Results archived for audit
- Team training records maintained
- Continuous improvement documented

---

*This testing procedure document should be updated regularly to reflect system changes and testing improvements. All team members should be trained on these procedures and their execution.*