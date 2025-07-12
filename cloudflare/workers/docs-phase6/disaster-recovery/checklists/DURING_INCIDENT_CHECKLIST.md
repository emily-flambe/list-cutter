# During Incident Response Checklist

## Overview

This checklist provides a structured approach for responding to incidents affecting the List Cutter R2 storage system. Follow these steps in order to ensure a coordinated and effective response.

## Phase 1: Immediate Response (0-5 minutes)

### Initial Assessment
- [ ] **Record Incident Start Time**: ________________
- [ ] **Identify Incident Source**:
  - [ ] Monitoring alert
  - [ ] User report
  - [ ] System observation
  - [ ] External notification

- [ ] **Assign Incident Commander**: ________________
- [ ] **Create Incident ID**: INC-YYYY-MM-DD-XXX

### Quick System Assessment
- [ ] **Check Overall System Health**
```bash
curl -X GET https://your-worker.example.com/health/status \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Verify R2 Service Status**
```bash
curl -X GET https://your-worker.example.com/health/r2/status \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Check Circuit Breaker State**
```bash
curl -X GET https://your-worker.example.com/health/circuit-breaker \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Review Recent Events**
```bash
curl -X GET "https://your-worker.example.com/health/events?limit=50" \
  -H "Authorization: Bearer <admin_token>"
```

### Initial Classification
- [ ] **Determine Incident Severity**:
  - [ ] Severity 1 - Critical (Complete service outage)
  - [ ] Severity 2 - High (Significant degradation)
  - [ ] Severity 3 - Medium (Minor degradation)
  - [ ] Severity 4 - Low (Minimal impact)

- [ ] **Estimate User Impact**:
  - [ ] Number of affected users: ________________
  - [ ] Affected operations: ________________
  - [ ] Business impact: ________________

### Team Notification
- [ ] **Alert Response Team**
```bash
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INCIDENT_ALERT",
    "message": "Incident [ID] detected: [Brief Description]",
    "severity": "[LEVEL]",
    "target": "response_team"
  }'
```

- [ ] **Escalate if Severity 1 or 2**:
  - [ ] Technical Lead notified: ________________
  - [ ] Operations Manager notified: ________________
  - [ ] Management notified (if Severity 1): ________________

## Phase 2: Stabilization (5-15 minutes)

### Prevent Further Damage
- [ ] **Activate Failover Systems (if not already active)**
```bash
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/degrade \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Incident response - preventing further damage"}'
```

- [ ] **Verify Degraded Mode Active**
```bash
curl -X GET https://your-worker.example.com/health/services/R2_STORAGE \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Check Operation Queue Status**
```bash
curl -X GET https://your-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <admin_token>"
```

### Preserve Evidence
- [ ] **Capture System State**
```bash
# Export current system status
curl -X GET https://your-worker.example.com/health/services \
  -H "Authorization: Bearer <admin_token>" > incident_${INCIDENT_ID}_state.json

# Export recent logs
curl -X GET "https://your-worker.example.com/health/events?limit=1000" \
  -H "Authorization: Bearer <admin_token>" > incident_${INCIDENT_ID}_logs.json

# Export metrics
curl -X GET "https://your-worker.example.com/health/metrics?hours=2" \
  -H "Authorization: Bearer <admin_token>" > incident_${INCIDENT_ID}_metrics.json
```

- [ ] **Document Evidence Locations**:
  - System state: incident_${INCIDENT_ID}_state.json
  - Event logs: incident_${INCIDENT_ID}_logs.json
  - Metrics: incident_${INCIDENT_ID}_metrics.json

### Backup Protection
- [ ] **Verify Backup Systems Operational**
```bash
curl -X GET https://your-worker.example.com/api/backup/stats \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Create Emergency Backup (if needed)**
```bash
curl -X POST https://your-worker.example.com/api/backup/create \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "emergency", "reason": "Incident response backup"}'
```

### Communication Updates
- [ ] **Send Initial Status Update**
```bash
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INCIDENT_UPDATE",
    "message": "Incident [ID] - Initial response completed. Investigating cause.",
    "severity": "[LEVEL]",
    "target": "all_stakeholders"
  }'
```

- [ ] **Update Status Page** (if applicable):
  - [ ] Status: Investigating
  - [ ] Description: [Brief incident description]
  - [ ] Timestamp: [Current time]

## Phase 3: Investigation (15-60 minutes)

### Root Cause Analysis
- [ ] **Analyze Error Patterns**
```bash
curl -X GET "https://your-worker.example.com/health/metrics?hours=2&metric=error_rate" \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Review Circuit Breaker History**
```bash
curl -X GET https://your-worker.example.com/health/circuit-breaker/history \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Check External Dependencies**:
  - [ ] Cloudflare status page reviewed
  - [ ] Network connectivity tested
  - [ ] Third-party services checked

- [ ] **Analyze Performance Metrics**
```bash
curl -X GET "https://your-worker.example.com/health/metrics?hours=1&metric=response_time" \
  -H "Authorization: Bearer <admin_token>"
```

### Impact Assessment
- [ ] **Assess Data Integrity**
```bash
curl -X POST https://your-worker.example.com/api/files/integrity-check \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"quick_scan": true}'
```

- [ ] **Count Affected Operations**
```bash
curl -X GET "https://your-worker.example.com/health/queue/operations?status=FAILED" \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Identify Affected Users**
```bash
curl -X GET "https://your-worker.example.com/api/users/affected?since=[INCIDENT_START_TIME]" \
  -H "Authorization: Bearer <admin_token>"
```

### Document Findings
- [ ] **Root Cause Identified**: ________________
- [ ] **Contributing Factors**: ________________
- [ ] **Data Impact**: ________________
- [ ] **User Impact**: ________________

### Communication Updates
- [ ] **Send Investigation Update**
```bash
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INCIDENT_UPDATE",
    "message": "Incident [ID] - Root cause identified: [CAUSE]. Working on resolution.",
    "severity": "[LEVEL]",
    "target": "all_stakeholders"
  }'
```

## Phase 4: Resolution (Variable Duration)

### Apply Fixes
- [ ] **Implement Solution**: ________________
  - [ ] Configuration changes made
  - [ ] Code fixes deployed
  - [ ] External issues resolved
  - [ ] Workarounds implemented

- [ ] **Test Solution**
```bash
curl -X POST https://your-worker.example.com/health/r2/test \
  -H "Authorization: Bearer <admin_token>"
```

### Gradual Recovery
- [ ] **Test Service Connectivity**
```bash
# Test multiple operations
curl -X POST https://your-worker.example.com/api/files/test-operations \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"operations": ["upload", "download", "list"]}'
```

- [ ] **Reset Circuit Breaker (when ready)**
```bash
curl -X POST https://your-worker.example.com/health/circuit-breaker/reset \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Service restored - manual reset"}'
```

- [ ] **Exit Degraded Mode**
```bash
curl -X POST https://your-worker.example.com/health/services/R2_STORAGE/restore \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Incident resolved - returning to normal operations"}'
```

### Monitor Recovery
- [ ] **Monitor System Stability (15 minutes)**
```bash
# Monitor for 15 minutes
for i in {1..15}; do
  echo "$(date): Stability check $i/15"
  curl -s "https://your-worker.example.com/health/status" \
    -H "Authorization: Bearer <admin_token>" | jq ".data.overall_status"
  sleep 60
done
```

- [ ] **Verify Queue Processing**
```bash
curl -X GET https://your-worker.example.com/health/queue/status \
  -H "Authorization: Bearer <admin_token>"
```

### Communication Updates
- [ ] **Send Resolution Update**
```bash
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INCIDENT_RESOLVED",
    "message": "Incident [ID] - Resolution implemented. Monitoring for stability.",
    "severity": "INFO",
    "target": "all_stakeholders"
  }'
```

## Phase 5: Validation (15-30 minutes)

### System Validation
- [ ] **Comprehensive Health Check**
```bash
curl -X POST https://your-worker.example.com/health/check \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Verify All Services Operational**
```bash
curl -X GET https://your-worker.example.com/health/services \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Test User Operations**
```bash
# Test file upload
curl -X POST https://your-worker.example.com/api/list_cutter/upload \
  -H "Authorization: Bearer <test_token>" \
  -F "file=@test_file.csv"

# Test file download
curl -X GET https://your-worker.example.com/api/list_cutter/download/test_file.csv \
  -H "Authorization: Bearer <test_token>"
```

### Queue Processing
- [ ] **Monitor Queue Completion**
```bash
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

- [ ] **Verify Queue Processing Results**
```bash
curl -X GET "https://your-worker.example.com/health/queue/operations?status=COMPLETED&since=[INCIDENT_START_TIME]" \
  -H "Authorization: Bearer <admin_token>"
```

### Final Validation
- [ ] **Data Integrity Check**
```bash
curl -X POST https://your-worker.example.com/api/files/integrity-check \
  -H "Authorization: Bearer <admin_token>"
```

- [ ] **Performance Validation**
```bash
curl -X GET "https://your-worker.example.com/health/metrics?minutes=30" \
  -H "Authorization: Bearer <admin_token>"
```

### Final Communications
- [ ] **Send Resolution Confirmation**
```bash
curl -X POST https://your-worker.example.com/health/notifications/broadcast \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SERVICE_RESTORED",
    "message": "Incident [ID] - Service fully restored. All systems operational.",
    "severity": "INFO",
    "target": "all_users"
  }'
```

- [ ] **Update Status Page** (if applicable):
  - [ ] Status: Resolved
  - [ ] Description: [Resolution summary]
  - [ ] Timestamp: [Current time]

## Phase 6: Incident Closure (30-60 minutes)

### Documentation
- [ ] **Complete Incident Timeline**:
  - Detection time: ________________
  - Response time: ________________
  - Resolution time: ________________
  - Validation time: ________________
  - Total duration: ________________

- [ ] **Record Impact Metrics**:
  - Users affected: ________________
  - Operations failed: ________________
  - Data loss: ________________
  - Revenue impact: ________________

- [ ] **Document Actions Taken**:
  - [ ] All commands executed documented
  - [ ] Configuration changes recorded
  - [ ] Code changes documented
  - [ ] Communication log maintained

### Immediate Post-Incident
- [ ] **Schedule Post-Incident Review**:
  - [ ] Meeting scheduled for: ________________
  - [ ] Attendees identified: ________________
  - [ ] Agenda prepared: ________________

- [ ] **Collect Feedback**:
  - [ ] Team feedback gathered
  - [ ] User feedback collected
  - [ ] Stakeholder input obtained

- [ ] **Identify Immediate Improvements**:
  - [ ] Process improvements identified
  - [ ] Technical improvements noted
  - [ ] Training needs assessed

### Final Notifications
- [ ] **Notify Stakeholders of Closure**:
  - [ ] Management notification sent
  - [ ] Customer communication sent
  - [ ] Team notification sent

- [ ] **Update Incident Tracking**:
  - [ ] Incident marked as resolved
  - [ ] Final status updated
  - [ ] Post-mortem scheduled

## Continuous Monitoring

### Post-Incident Monitoring (24-48 hours)
- [ ] **Enhanced Monitoring**:
  - [ ] Increased monitoring frequency
  - [ ] Additional metrics tracking
  - [ ] Extended alert sensitivity

- [ ] **Stability Verification**:
  - [ ] Daily health checks
  - [ ] Performance monitoring
  - [ ] User experience tracking

## Incident Metrics

### Response Metrics
- **Detection to Response**: ________________
- **Response to Stabilization**: ________________
- **Stabilization to Resolution**: ________________
- **Resolution to Validation**: ________________
- **Total Incident Duration**: ________________

### Impact Metrics
- **Users Affected**: ________________
- **Operations Lost**: ________________
- **Operations Queued**: ________________
- **Data Recovery Required**: ________________

### Communication Metrics
- **First Notification Time**: ________________
- **Update Frequency**: ________________
- **Resolution Notification Time**: ________________
- **Stakeholder Satisfaction**: ________________

## Escalation Triggers

### Automatic Escalation Conditions
- [ ] **15 minutes**: No progress on Severity 1
- [ ] **30 minutes**: No progress on Severity 2
- [ ] **2 hours**: No progress on Severity 3
- [ ] **Multiple failures**: Different services affected
- [ ] **Data integrity**: Data corruption detected

### Manual Escalation Decisions
- [ ] **Technical complexity**: Expertise needed
- [ ] **Business impact**: Revenue/customer impact
- [ ] **External dependencies**: Vendor involvement needed
- [ ] **Resource constraints**: Additional help required

## Sign-off

### Incident Commander Certification
- **Incident ID**: ________________
- **Commander**: ________________
- **Start Time**: ________________
- **End Time**: ________________
- **Total Duration**: ________________
- **Final Status**: ✅ RESOLVED / ❌ ESCALATED

### Checklist Completion
- [ ] All phases completed
- [ ] All actions documented
- [ ] All communications sent
- [ ] All validations passed
- [ ] Post-incident review scheduled

**Signature**: ________________  
**Date**: ________________  
**Time**: ________________

---

*This checklist should be followed during all incidents and updated based on lessons learned and process improvements.*