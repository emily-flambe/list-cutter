# Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for recovering from various disaster scenarios affecting the List Cutter application's R2 storage infrastructure. The document covers complete service recovery, partial degradation handling, and operational procedures for disaster response.

## Service Architecture

### Components
- **Cloudflare R2**: Primary file storage
- **Cloudflare D1**: Application database
- **Cloudflare Workers**: Application runtime
- **Backup System**: Automated backup and restoration
- **Monitoring System**: Health monitoring and alerting
- **Failover System**: Graceful degradation and operation queuing

### Data Flow
1. File uploads → R2 primary storage
2. Metadata → D1 database
3. Monitoring → Continuous health checks
4. Backups → R2 backup bucket (scheduled)
5. Failover → Operation queue during outages

## Recovery Time & Point Objectives

### RTO (Recovery Time Objective)
- **Critical Systems**: 15 minutes
- **Primary R2 Storage**: 30 minutes
- **Full Service Restoration**: 1 hour
- **Backup Restoration**: 2 hours

### RPO (Recovery Point Objective)
- **Database**: 5 minutes (real-time replication)
- **File Storage**: 1 hour (backup frequency)
- **Application State**: 5 minutes (session data)

## Disaster Scenarios

### Scenario 1: Complete R2 Outage
**Symptoms**: All R2 operations failing, circuit breaker open

**Immediate Actions**:
1. Verify outage scope via monitoring dashboard
2. Activate read-only mode
3. Notify users of service degradation
4. Monitor operation queue buildup

**Recovery Steps**:
1. Confirm R2 service restoration
2. Reset circuit breaker
3. Process queued operations
4. Restore full service
5. Verify system integrity

### Scenario 2: Partial R2 Degradation
**Symptoms**: High error rates, slow responses, intermittent failures

**Immediate Actions**:
1. Assess degradation level
2. Adjust monitoring thresholds if needed
3. Enable priority queuing
4. Notify users of potential delays

**Recovery Steps**:
1. Monitor service improvement
2. Gradually increase operation limits
3. Process priority operations first
4. Return to normal operations

### Scenario 3: Data Corruption
**Symptoms**: File integrity failures, checksum mismatches

**Immediate Actions**:
1. Identify scope of corruption
2. Isolate affected files
3. Prevent further corruption
4. Notify affected users

**Recovery Steps**:
1. Restore from latest verified backup
2. Verify restored data integrity
3. Re-sync metadata
4. Validate application functionality

## Emergency Contacts

### Primary Response Team
- **System Administrator**: [Contact Information]
- **Technical Lead**: [Contact Information]
- **Operations Manager**: [Contact Information]

### Escalation Path
1. **Level 1**: Operations Team (0-15 minutes)
2. **Level 2**: Engineering Team (15-30 minutes)
3. **Level 3**: Management Team (30+ minutes)

### External Contacts
- **Cloudflare Support**: [Priority Support Number]
- **Backup Infrastructure**: [Support Contact]

## Communication Templates

### Service Degradation Notice
```
Subject: [URGENT] List Cutter Service Degradation

Dear Users,

We are currently experiencing technical difficulties with our file storage system. 

Current Status:
- File uploads may be delayed or queued
- File downloads remain available
- Existing files are not affected

Actions Taken:
- Technical team is actively investigating
- Backup systems are operational
- Service monitoring is active

Expected Resolution: [Time Estimate]
Next Update: [Time]

We apologize for any inconvenience and will provide updates as they become available.

Best regards,
List Cutter Operations Team
```

### Service Restoration Notice
```
Subject: [RESOLVED] List Cutter Service Fully Restored

Dear Users,

We are pleased to announce that our file storage system has been fully restored.

Resolution Summary:
- All systems are operational
- Queued operations have been processed
- Service monitoring confirms stability

We have implemented additional safeguards to prevent future occurrences.

Thank you for your patience during this incident.

Best regards,
List Cutter Operations Team
```

## Detailed Recovery Procedures

### 1. R2 Complete Outage Recovery

#### Step 1: Outage Verification
```bash
# Check R2 health via API
curl -X GET https://your-worker.example.com/health/r2/status \
  -H "Authorization: Bearer <admin_token>"

# Expected response for outage:
{
  "success": true,
  "data": {
    "service_status": "OFFLINE",
    "circuit_breaker_state": "OPEN",
    "read_only_mode": true
  }
}
```

#### Step 2: Activate Emergency Mode
```bash
# Verify degradation mode is active
curl -X GET https://your-worker.example.com/health/status \
  -H "Authorization: Bearer <admin_token>"

# If not in degraded mode, force activation
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/degrade \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual activation due to R2 outage"}'
```

#### Step 3: Monitor Queue Buildup
```bash
# Check operation queue status
curl -X GET https://your-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <admin_token>"

# Monitor queue growth
watch -n 30 'curl -s "https://your-worker.example.com/health/queue/status" | jq ".data.total_queued"'
```

#### Step 4: User Communication
```bash
# Send system notification to all users
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SERVICE_DEGRADED",
    "message": "File storage temporarily unavailable. Operations are being queued.",
    "severity": "HIGH"
  }'
```

#### Step 5: Service Restoration
```bash
# Test R2 connectivity
curl -X POST https://your-worker.example.com/health/r2/test \
  -H "Authorization: Bearer <admin_token>"

# Reset circuit breaker when service is restored
curl -X POST https://your-worker.example.com/health/circuit-breaker/reset \
  -H "Authorization: Bearer <admin_token>"

# Exit degraded mode
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/restore \
  -H "Authorization: Bearer <admin_token>"
```

#### Step 6: Queue Processing
```bash
# Monitor queue processing
curl -X GET https://your-worker.example.com/health/queue/operations?status=PROCESSING \
  -H "Authorization: Bearer <admin_token>"

# Force queue processing if needed
curl -X POST https://your-worker.example.com/health/queue/process \
  -H "Authorization: Bearer <admin_token>"
```

### 2. Backup Restoration Procedure

#### Step 1: Identify Latest Backup
```bash
# List available backups
curl -X GET "https://your-worker.example.com/api/backup/list?status=completed&limit=10" \
  -H "Authorization: Bearer <admin_token>"

# Get backup details
curl -X GET "https://your-worker.example.com/api/backup/status/<backup_id>" \
  -H "Authorization: Bearer <admin_token>"
```

#### Step 2: Verify Backup Integrity
```bash
# Verify backup before restoration
curl -X POST "https://your-worker.example.com/api/backup/verify/<backup_id>" \
  -H "Authorization: Bearer <admin_token>"

# Check verification results
curl -X GET "https://your-worker.example.com/api/backup/status/<backup_id>" \
  -H "Authorization: Bearer <admin_token>"
```

#### Step 3: Restore from Backup
```bash
# Full restoration
curl -X POST "https://your-worker.example.com/api/backup/restore/<backup_id>" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "overwriteExisting": true,
    "verifyAfterRestore": true
  }'
```

#### Step 4: Verify Restoration
```bash
# Check restoration status
curl -X GET "https://your-worker.example.com/api/backup/status/<backup_id>" \
  -H "Authorization: Bearer <admin_token>"

# Verify file integrity
curl -X POST "https://your-worker.example.com/health/r2/test" \
  -H "Authorization: Bearer <admin_token>"
```

### 3. Data Corruption Recovery

#### Step 1: Identify Corruption Scope
```bash
# Check for failed file operations
curl -X GET "https://your-worker.example.com/health/events?type=FILE_CORRUPTION" \
  -H "Authorization: Bearer <admin_token>"

# List files with checksum failures
curl -X GET "https://your-worker.example.com/api/files/integrity-check" \
  -H "Authorization: Bearer <admin_token>"
```

#### Step 2: Isolate Affected Files
```bash
# Mark corrupted files
curl -X POST "https://your-worker.example.com/api/files/mark-corrupted" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"fileIds": ["file1", "file2", "file3"]}'
```

#### Step 3: Selective Restoration
```bash
# Restore specific files from backup
curl -X POST "https://your-worker.example.com/api/backup/restore/<backup_id>" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "overwriteExisting": true,
    "verifyAfterRestore": true,
    "filters": {
      "fileIds": ["file1", "file2", "file3"]
    }
  }'
```

## Monitoring and Validation

### Health Check Commands
```bash
# System health overview
curl -X GET https://your-worker.example.com/health/status

# Service-specific health
curl -X GET https://your-worker.example.com/health/services/R2_STORAGE

# Circuit breaker status
curl -X GET https://your-worker.example.com/health/circuit-breaker

# Recent system events
curl -X GET https://your-worker.example.com/health/events?limit=100
```

### Validation Procedures
1. **File Upload Test**: Verify new uploads work correctly
2. **File Download Test**: Confirm existing files are accessible
3. **Metadata Consistency**: Check database synchronization
4. **Backup Verification**: Ensure backups are current and valid
5. **Monitoring Alerts**: Confirm alerting is functional

## Post-Incident Procedures

### Immediate Actions (0-1 hours)
1. Verify full service restoration
2. Clear operation queue
3. Validate data integrity
4. Update monitoring thresholds
5. Document incident timeline

### Short-term Actions (1-24 hours)
1. Conduct post-incident review
2. Update procedures based on lessons learned
3. Test backup and recovery procedures
4. Communicate with stakeholders
5. Update documentation

### Long-term Actions (1-7 days)
1. Implement preventive measures
2. Enhance monitoring capabilities
3. Review and update disaster recovery plans
4. Conduct team training
5. Schedule regular disaster recovery testing

## Preventive Measures

### Regular Maintenance
- **Weekly**: Review monitoring alerts and thresholds
- **Monthly**: Test backup and recovery procedures
- **Quarterly**: Full disaster recovery simulation
- **Annually**: Review and update disaster recovery plans

### Monitoring Configuration
- **Error Rate Threshold**: 10% (triggers degradation)
- **Response Time Threshold**: 5 seconds (triggers alerts)
- **Queue Size Threshold**: 100 operations (triggers alerts)
- **Backup Frequency**: Every 24 hours
- **Health Check Frequency**: Every 30 seconds

### Capacity Planning
- **Storage Growth**: Monitor monthly growth patterns
- **Operation Queue**: Size limits and processing capacity
- **Backup Retention**: Balance between storage cost and recovery needs
- **Monitoring Data**: Retention policies for metrics and logs

## Testing and Validation

### Disaster Recovery Testing Schedule
- **Monthly**: Basic failover testing
- **Quarterly**: Complete disaster recovery simulation
- **Semi-annually**: Multi-scenario testing
- **Annually**: Full-scale disaster recovery exercise

### Testing Procedures
1. **Planned Outage Simulation**: Test system behavior during controlled outages
2. **Backup Restoration Testing**: Verify backup integrity and restoration procedures
3. **Communication Testing**: Validate notification systems and escalation procedures
4. **Performance Testing**: Ensure system performance under degraded conditions

### Success Criteria
- **RTO Achievement**: System restored within target timeframes
- **RPO Achievement**: Data loss within acceptable limits
- **Communication Effectiveness**: Stakeholders informed promptly
- **Process Adherence**: Procedures followed correctly
- **System Stability**: No secondary incidents during recovery

## Documentation Maintenance

### Regular Updates
- **Monthly**: Review and update contact information
- **Quarterly**: Update procedures based on system changes
- **Semi-annually**: Review RTO/RPO objectives
- **Annually**: Complete documentation review

### Change Management
- All procedure changes must be reviewed and approved
- Updated procedures must be tested before implementation
- Team training required for significant changes
- Version control for all documentation

## Appendices

### Appendix A: System Architecture Diagram
[Include detailed system architecture diagram showing all components and data flows]

### Appendix B: Network Topology
[Include network topology diagram showing connections and dependencies]

### Appendix C: Recovery Time Estimates
[Include detailed breakdown of recovery time estimates for different scenarios]

### Appendix D: Emergency Contact List
[Include complete contact information for all personnel and vendors]

---

*This runbook should be reviewed and updated regularly to ensure accuracy and effectiveness. Last updated: [Date]*