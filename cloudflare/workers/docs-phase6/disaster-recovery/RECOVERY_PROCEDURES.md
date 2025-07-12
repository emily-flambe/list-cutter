# Recovery Procedures

## Overview

This document provides detailed step-by-step procedures for recovering from various disaster scenarios affecting the List Cutter application's R2 storage infrastructure. Each procedure includes prerequisites, detailed steps, validation methods, and rollback procedures.

## Recovery Scenarios

### 1. Complete R2 Outage Recovery

#### Scenario Description
Complete inaccessibility of the primary R2 storage bucket affecting all file operations.

#### Symptoms
- All R2 operations returning 503/504 errors
- Circuit breaker in OPEN state
- High number of queued operations
- No successful file uploads or downloads

#### Prerequisites
- Access to administrative credentials
- Backup system operational
- Monitoring system functional
- Communication channels available

#### Recovery Steps

##### Phase 1: Assessment and Stabilization (0-15 minutes)

**Step 1: Verify Outage Scope**
```bash
# Check overall system health
curl -X GET https://your-worker.example.com/health/status \
  -H "Authorization: Bearer <admin_token>"

# Verify R2 service status
curl -X GET https://your-worker.example.com/health/r2/status \
  -H "Authorization: Bearer <admin_token>"

# Check circuit breaker state
curl -X GET https://your-worker.example.com/health/circuit-breaker \
  -H "Authorization: Bearer <admin_token>"
```

**Expected Response for Complete Outage:**
```json
{
  "success": true,
  "data": {
    "overall_status": "DEGRADED",
    "services": {
      "R2_STORAGE": {
        "status": "OFFLINE",
        "circuit_breaker_state": "OPEN",
        "last_health_check": "2024-01-15T10:30:00Z",
        "error_rate": 100,
        "consecutive_failures": 15
      }
    }
  }
}
```

**Step 2: Activate Emergency Protocols**
```bash
# Ensure degraded mode is active
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/degrade \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Complete R2 outage - emergency protocol activation",
    "mode": "read_only"
  }'
```

**Step 3: Notify Stakeholders**
```bash
# Send internal alert
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CRITICAL_OUTAGE",
    "message": "Complete R2 outage detected. Emergency protocols activated.",
    "severity": "CRITICAL",
    "target": "ops_team"
  }'

# Send user notification
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SERVICE_OUTAGE",
    "message": "File storage temporarily unavailable. Uploads are queued for processing.",
    "severity": "HIGH",
    "target": "all_users"
  }'
```

##### Phase 2: Monitoring and Queue Management (15-30 minutes)

**Step 4: Monitor Queue Buildup**
```bash
# Check current queue status
curl -X GET https://your-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <admin_token>"

# Monitor queue growth every 5 minutes
while true; do
  echo "$(date): Queue Status:"
  curl -s "https://your-worker.example.com/health/queue/status" \
    -H "Authorization: Bearer <admin_token>" | jq ".data"
  sleep 300
done
```

**Step 5: Implement Queue Limits (if needed)**
```bash
# Set queue size limits to prevent overflow
curl -X POST https://your-worker.example.com/health/queue/config \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "max_queue_size": 1000,
    "reject_threshold": 900,
    "priority_threshold": 3
  }'
```

##### Phase 3: Service Recovery (Variable Duration)

**Step 6: Monitor for Service Recovery**
```bash
# Test R2 connectivity every 2 minutes
while true; do
  echo "$(date): Testing R2 connectivity..."
  RESULT=$(curl -s -X POST https://your-worker.example.com/health/r2/test \
    -H "Authorization: Bearer <admin_token>" | jq -r ".data.success")
  
  if [ "$RESULT" = "true" ]; then
    echo "R2 connectivity restored!"
    break
  fi
  
  echo "R2 still unavailable, retrying in 2 minutes..."
  sleep 120
done
```

**Step 7: Validate Service Recovery**
```bash
# Test basic R2 operations
curl -X POST https://your-worker.example.com/health/r2/test \
  -H "Authorization: Bearer <admin_token>"

# Check multiple operations
curl -X POST https://your-worker.example.com/api/files/test-operations \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": ["upload", "download", "list", "delete"],
    "test_duration": 300
  }'
```

##### Phase 4: System Restoration (15-45 minutes)

**Step 8: Reset Circuit Breaker**
```bash
# Reset circuit breaker to closed state
curl -X POST https://your-worker.example.com/health/circuit-breaker/reset \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Service recovery validated - resetting circuit breaker"
  }'
```

**Step 9: Exit Degraded Mode**
```bash
# Return to normal operations
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/restore \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "R2 service restored - returning to normal operations"
  }'
```

**Step 10: Process Queued Operations**
```bash
# Check queue processing status
curl -X GET https://your-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <admin_token>"

# Force queue processing if needed
curl -X POST https://your-worker.example.com/health/queue/process \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_size": 50,
    "max_concurrent": 10
  }'

# Monitor queue processing
while true; do
  QUEUE_SIZE=$(curl -s "https://your-worker.example.com/health/queue/status" \
    -H "Authorization: Bearer <admin_token>" | jq -r ".data.total_queued")
  
  echo "$(date): Queue size: $QUEUE_SIZE"
  
  if [ "$QUEUE_SIZE" -eq 0 ]; then
    echo "Queue processing complete!"
    break
  fi
  
  sleep 60
done
```

##### Phase 5: Validation and Notification (15-30 minutes)

**Step 11: Comprehensive System Validation**
```bash
# Full health check
curl -X POST https://your-worker.example.com/health/check \
  -H "Authorization: Bearer <admin_token>"

# Verify all services operational
curl -X GET https://your-worker.example.com/health/services \
  -H "Authorization: Bearer <admin_token>"

# Monitor system stability for 15 minutes
for i in {1..15}; do
  echo "$(date): Stability check $i/15"
  curl -s "https://your-worker.example.com/health/status" \
    -H "Authorization: Bearer <admin_token>" | jq ".data.overall_status"
  sleep 60
done
```

**Step 12: Notify Service Restoration**
```bash
# Send restoration notification
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SERVICE_RESTORED",
    "message": "File storage service fully restored. All operations normal.",
    "severity": "INFO",
    "target": "all_users"
  }'
```

### 2. Partial R2 Service Degradation Recovery

#### Scenario Description
Intermittent R2 service issues with elevated error rates but not complete failure.

#### Symptoms
- Error rates between 10-50%
- Slow response times
- Some operations succeeding, others failing
- Circuit breaker in HALF_OPEN state

#### Recovery Steps

##### Phase 1: Assessment (0-10 minutes)

**Step 1: Analyze Service Metrics**
```bash
# Get detailed R2 metrics
curl -X GET "https://your-worker.example.com/health/metrics?hours=1&service=R2_STORAGE" \
  -H "Authorization: Bearer <admin_token>"

# Check error rate trends
curl -X GET "https://your-worker.example.com/health/metrics?hours=2&metric=error_rate" \
  -H "Authorization: Bearer <admin_token>"
```

**Step 2: Determine Degradation Level**
```bash
# Assess current performance
curl -X GET https://your-worker.example.com/health/r2/status \
  -H "Authorization: Bearer <admin_token>"

# Check recent failures
curl -X GET https://your-worker.example.com/health/events?level=error&limit=50 \
  -H "Authorization: Bearer <admin_token>"
```

##### Phase 2: Optimization (10-30 minutes)

**Step 3: Implement Degradation Controls**
```bash
# Reduce operation frequency
curl -X POST https://your-worker.example.com/health/config \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "checkInterval": 60000,
    "timeout": 10000,
    "slowResponseThreshold": 5000
  }'

# Enable priority queuing
curl -X POST https://your-worker.example.com/health/queue/config \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "priority_mode": true,
    "high_priority_threshold": 3
  }'
```

**Step 4: Monitor Recovery Progress**
```bash
# Watch error rate improvement
while true; do
  ERROR_RATE=$(curl -s "https://your-worker.example.com/health/metrics?hours=0.5&metric=error_rate" \
    -H "Authorization: Bearer <admin_token>" | jq -r ".data.error_rate")
  
  echo "$(date): Error rate: $ERROR_RATE%"
  
  if (( $(echo "$ERROR_RATE < 5" | bc -l) )); then
    echo "Error rate normalized!"
    break
  fi
  
  sleep 120
done
```

##### Phase 3: Restoration (15-30 minutes)

**Step 5: Gradual Service Restoration**
```bash
# Increase operation limits gradually
curl -X POST https://your-worker.example.com/health/config \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "checkInterval": 30000,
    "timeout": 5000,
    "slowResponseThreshold": 2000
  }'

# Monitor for 10 minutes
for i in {1..10}; do
  echo "$(date): Monitoring restoration $i/10"
  curl -s "https://your-worker.example.com/health/r2/status" \
    -H "Authorization: Bearer <admin_token>" | jq ".data.service_status"
  sleep 60
done
```

### 3. Data Corruption Recovery

#### Scenario Description
Detected data corruption in R2 storage requiring selective or complete restoration.

#### Symptoms
- File integrity check failures
- Checksum mismatches
- Corrupted file downloads
- User reports of invalid files

#### Recovery Steps

##### Phase 1: Damage Assessment (0-30 minutes)

**Step 1: Identify Corruption Scope**
```bash
# Run comprehensive integrity check
curl -X POST https://your-worker.example.com/api/files/integrity-check \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_scan": true,
    "parallel_checks": 10
  }'

# Get corruption report
curl -X GET https://your-worker.example.com/api/files/corruption-report \
  -H "Authorization: Bearer <admin_token>"
```

**Step 2: Isolate Corrupted Files**
```bash
# Mark corrupted files as unavailable
curl -X POST https://your-worker.example.com/api/files/quarantine \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["file1", "file2", "file3"],
    "reason": "Data corruption detected"
  }'

# Notify affected users
curl -X POST https://your-worker.example.com/health/notifications/targeted \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DATA_CORRUPTION",
    "message": "Some of your files are temporarily unavailable due to data integrity issues.",
    "severity": "HIGH",
    "users": [123, 456, 789]
  }'
```

##### Phase 2: Backup Selection (10-20 minutes)

**Step 3: Identify Suitable Backup**
```bash
# List recent backups
curl -X GET "https://your-worker.example.com/api/backup/list?status=completed&limit=10" \
  -H "Authorization: Bearer <admin_token>"

# Find backup before corruption
curl -X GET "https://your-worker.example.com/api/backup/find-by-date" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "before_date": "2024-01-15T08:00:00Z",
    "verified": true
  }'
```

**Step 4: Verify Backup Integrity**
```bash
# Verify selected backup
BACKUP_ID="backup_20240115_060000"
curl -X POST "https://your-worker.example.com/api/backup/verify/$BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>"

# Check verification results
curl -X GET "https://your-worker.example.com/api/backup/status/$BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>"
```

##### Phase 3: Selective Restoration (30-120 minutes)

**Step 5: Restore Corrupted Files**
```bash
# Restore specific corrupted files
curl -X POST "https://your-worker.example.com/api/backup/restore/$BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "selective": true,
    "file_ids": ["file1", "file2", "file3"],
    "overwrite_existing": true,
    "verify_after_restore": true
  }'

# Monitor restoration progress
while true; do
  STATUS=$(curl -s "https://your-worker.example.com/api/backup/status/$BACKUP_ID" \
    -H "Authorization: Bearer <admin_token>" | jq -r ".data.restore_status")
  
  echo "$(date): Restore status: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo "Restoration complete!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Restoration failed!"
    exit 1
  fi
  
  sleep 30
done
```

**Step 6: Validate Restored Data**
```bash
# Verify restored files
curl -X POST https://your-worker.example.com/api/files/verify-restored \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["file1", "file2", "file3"],
    "checksum_verification": true
  }'

# Remove quarantine status
curl -X POST https://your-worker.example.com/api/files/unquarantine \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_ids": ["file1", "file2", "file3"]
  }'
```

### 4. Complete Backup Restoration

#### Scenario Description
Complete loss of R2 data requiring full restoration from backup.

#### Recovery Steps

##### Phase 1: Preparation (0-30 minutes)

**Step 1: Verify Backup Availability**
```bash
# Find latest complete backup
curl -X GET "https://your-worker.example.com/api/backup/list?type=full&status=completed&limit=5" \
  -H "Authorization: Bearer <admin_token>"

# Verify backup integrity
BACKUP_ID="full_backup_20240115_020000"
curl -X POST "https://your-worker.example.com/api/backup/verify/$BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>"
```

**Step 2: Prepare for Restoration**
```bash
# Clear R2 bucket (if needed)
curl -X POST https://your-worker.example.com/api/files/clear-bucket \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": true,
    "reason": "Preparing for complete restoration"
  }'

# Notify users of extended downtime
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "EXTENDED_MAINTENANCE",
    "message": "System undergoing complete restoration. Extended downtime expected.",
    "severity": "CRITICAL",
    "target": "all_users"
  }'
```

##### Phase 2: Full Restoration (1-4 hours)

**Step 3: Initiate Complete Restoration**
```bash
# Start full restoration
curl -X POST "https://your-worker.example.com/api/backup/restore/$BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_restore": true,
    "overwrite_existing": true,
    "verify_after_restore": true,
    "parallel_operations": 20
  }'
```

**Step 4: Monitor Restoration Progress**
```bash
# Monitor restoration (runs for hours)
while true; do
  RESPONSE=$(curl -s "https://your-worker.example.com/api/backup/status/$BACKUP_ID" \
    -H "Authorization: Bearer <admin_token>")
  
  STATUS=$(echo "$RESPONSE" | jq -r ".data.restore_status")
  PROGRESS=$(echo "$RESPONSE" | jq -r ".data.restore_progress")
  
  echo "$(date): Status: $STATUS, Progress: $PROGRESS%"
  
  if [ "$STATUS" = "completed" ]; then
    echo "Full restoration complete!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Restoration failed!"
    exit 1
  fi
  
  sleep 300  # Check every 5 minutes
done
```

##### Phase 3: Validation and Recovery (30-60 minutes)

**Step 5: Comprehensive Validation**
```bash
# Verify all restored data
curl -X POST https://your-worker.example.com/api/files/verify-all \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "checksum_verification": true,
    "metadata_verification": true,
    "sample_download_test": true
  }'

# Validate system integrity
curl -X POST https://your-worker.example.com/health/check \
  -H "Authorization: Bearer <admin_token>"
```

**Step 6: Return to Service**
```bash
# Exit maintenance mode
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/restore \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Complete restoration successful"
  }'

# Notify users of service restoration
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SERVICE_RESTORED",
    "message": "Complete system restoration successful. All files restored.",
    "severity": "INFO",
    "target": "all_users"
  }'
```

## Rollback Procedures

### When to Rollback
- Restoration process fails
- Restored data shows issues
- System becomes unstable after restoration
- User data integrity concerns

### Rollback Steps

**Step 1: Stop Current Operations**
```bash
# Stop any ongoing restoration
curl -X POST https://your-worker.example.com/api/backup/stop \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Rollback required"
  }'
```

**Step 2: Assess Rollback Options**
```bash
# Check for previous backup
curl -X GET "https://your-worker.example.com/api/backup/list?before_backup=$BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>"

# Verify rollback target
curl -X POST "https://your-worker.example.com/api/backup/verify/$ROLLBACK_BACKUP_ID" \
  -H "Authorization: Bearer <admin_token>"
```

**Step 3: Execute Rollback**
```bash
# Rollback to previous state
curl -X POST "https://your-worker.example.com/api/backup/rollback" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_backup": "$ROLLBACK_BACKUP_ID",
    "reason": "Restoration rollback"
  }'
```

## Validation Procedures

### Post-Recovery Validation Checklist

#### System Health Validation
- [ ] All services show HEALTHY status
- [ ] Circuit breakers in CLOSED state
- [ ] Error rates below 5%
- [ ] Response times within normal range
- [ ] No active alerts

#### Data Integrity Validation
- [ ] File checksums match expected values
- [ ] Metadata consistency verified
- [ ] User file counts match pre-incident
- [ ] Sample downloads successful
- [ ] Upload/download operations functional

#### User Experience Validation
- [ ] File upload successful
- [ ] File download successful
- [ ] File listing functional
- [ ] User notifications working
- [ ] No user-reported issues

### Validation Commands

```bash
# Comprehensive health check
curl -X POST https://your-worker.example.com/health/check \
  -H "Authorization: Bearer <admin_token>"

# Data integrity verification
curl -X POST https://your-worker.example.com/api/files/integrity-check \
  -H "Authorization: Bearer <admin_token>"

# User experience test
curl -X POST https://your-worker.example.com/api/files/test-user-operations \
  -H "Authorization: Bearer <admin_token>"
```

## Recovery Time Estimates

### Complete R2 Outage Recovery
- **Detection**: 5 minutes
- **Stabilization**: 15 minutes  
- **Service Recovery**: Variable (depends on Cloudflare)
- **Queue Processing**: 30-60 minutes
- **Validation**: 30 minutes
- **Total**: 1-2 hours

### Partial Degradation Recovery
- **Detection**: 5 minutes
- **Optimization**: 30 minutes
- **Monitoring**: 30 minutes
- **Restoration**: 30 minutes
- **Total**: 1-2 hours

### Data Corruption Recovery
- **Assessment**: 30 minutes
- **Backup Selection**: 20 minutes
- **Selective Restore**: 1-2 hours
- **Validation**: 30 minutes
- **Total**: 2-3 hours

### Complete Backup Restoration
- **Preparation**: 30 minutes
- **Full Restore**: 2-4 hours
- **Validation**: 1 hour
- **Total**: 3-5 hours

## Best Practices

### Before Recovery
- Document current system state
- Notify all stakeholders
- Prepare rollback plans
- Validate backup integrity

### During Recovery
- Monitor progress continuously
- Maintain communication channels
- Document all actions taken
- Prepare for contingencies

### After Recovery
- Validate system thoroughly
- Process queued operations
- Communicate resolution
- Conduct post-incident review

## Emergency Contacts

### Internal Team
- **Operations Manager**: [Contact]
- **Technical Lead**: [Contact]
- **Database Administrator**: [Contact]

### External Vendors
- **Cloudflare Support**: [Contact]
- **Backup Service**: [Contact]

---

*These procedures should be tested regularly and updated based on system changes and lessons learned from actual incidents.*