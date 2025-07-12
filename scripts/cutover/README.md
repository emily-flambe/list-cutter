# Cutover Scripts - List Cutter Phase 8

This directory contains the production cutover scripts for migrating from the Django system to the unified Cloudflare Workers deployment.

## Scripts Overview

### 1. `execute-cutover.sh` - Main Production Cutover
The primary script that orchestrates the complete production cutover process.

**Features:**
- Pre-flight environment validation
- Staging system verification
- Worker deployment to production
- Django maintenance mode enablement
- Data migration execution
- DNS records update
- Comprehensive system validation
- Stability monitoring
- Automatic rollback on failure

**Usage:**
```bash
# Full production cutover
./execute-cutover.sh

# Dry run to see what would happen
./execute-cutover.sh --dry-run
```

**Environment Variables:**
- `CLOUDFLARE_API_TOKEN` - Required for deployment and DNS
- `CLOUDFLARE_ZONE_ID` - Required for DNS updates  
- `CLOUDFLARE_ACCOUNT_ID` - Required for Worker deployment
- `DJANGO_API_URL` - Django API base URL (default: https://old-api.list-cutter.com)
- `CUTOVER_TIMEOUT` - Migration timeout in seconds (default: 1800)

### 2. `rollback-cutover.sh` - Emergency Rollback
Emergency rollback script that reverts the system back to Django.

**Features:**
- DNS reversion to Django system
- Maintenance mode disabling
- Django system validation
- Data synchronization checks
- Current state backup before rollback
- Emergency mode for critical situations

**Usage:**
```bash
# Normal rollback
./rollback-cutover.sh

# Emergency rollback (bypasses some safety checks)
./rollback-cutover.sh --emergency

# Rollback but keep Worker active
./rollback-cutover.sh --keep-worker
```

**Environment Variables:**
- `CLOUDFLARE_API_TOKEN` - Required for DNS reversion
- `CLOUDFLARE_ZONE_ID` - Required for DNS reversion
- `DJANGO_API_URL` - Django API base URL
- `DJANGO_SERVER` - Django server for DNS (default: old-api.list-cutter.com)

### 3. `validate-cutover.sh` - Post-Cutover Validation
Comprehensive validation script that verifies the cutover was successful.

**Features:**
- Basic connectivity tests
- Health endpoint validation
- Authentication endpoint testing
- File management endpoint testing
- CSV processing endpoint testing
- Security features validation
- Performance testing
- Migration integrity checks
- Frontend serving validation
- Detailed JSON reporting

**Usage:**
```bash
# Full validation suite
./validate-cutover.sh
```

**Environment Variables:**
- `PRODUCTION_URL` - Production URL (default: https://cutty.com)
- `MAX_RESPONSE_TIME` - Max acceptable response time in ms (default: 2000)
- `MIN_HEALTH_SCORE` - Minimum health score percentage (default: 85)

### 4. `monitor-cutover.sh` - Real-time Monitoring
Continuous monitoring script that provides real-time system health monitoring.

**Features:**
- Continuous health checks
- Real-time dashboard display
- Performance metrics tracking
- Error rate monitoring
- Resource usage monitoring
- Alert notifications
- Detailed logging and reporting

**Usage:**
```bash
# Monitor for 30 minutes (default)
./monitor-cutover.sh

# Monitor for specific duration
./monitor-cutover.sh --duration 1800

# Monitor with 5-second intervals
./monitor-cutover.sh --interval 5

# Continuous monitoring
./monitor-cutover.sh --continuous

# Enable alert notifications
./monitor-cutover.sh --alerts
```

## Execution Flow

The recommended execution flow for production cutover:

1. **Pre-Cutover Preparation:**
   ```bash
   # Validate staging environment
   ../validate-staging.sh
   
   # Optionally run dry-run
   ./execute-cutover.sh --dry-run
   ```

2. **Execute Cutover:**
   ```bash
   # Start monitoring in background
   ./monitor-cutover.sh --duration 3600 --alerts &
   
   # Execute cutover
   ./execute-cutover.sh
   ```

3. **Post-Cutover Validation:**
   ```bash
   # Comprehensive validation
   ./validate-cutover.sh
   
   # Continue monitoring
   ./monitor-cutover.sh --continuous
   ```

4. **Emergency Rollback (if needed):**
   ```bash
   # Normal rollback
   ./rollback-cutover.sh
   
   # Emergency rollback
   ./rollback-cutover.sh --emergency
   ```

## Safety Features

### Automatic Rollback
The main cutover script includes automatic rollback functionality:
- Triggered on any critical failure
- Preserves system state before changes
- Comprehensive error logging
- Graceful cleanup on interruption

### Error Handling
All scripts include comprehensive error handling:
- Detailed logging to timestamped log files
- Color-coded status messages
- Validation checkpoints
- Timeout protection

### Monitoring Integration
Built-in integration with existing validation scripts:
- Uses existing `validate-staging.sh` and `validate-production.sh`
- Integrates with API endpoints from Phases 6-7
- Leverages disaster recovery and migration APIs

## Logging and Reporting

### Log Files
All scripts create detailed log files in:
- `logs/cutover/` - Cutover execution logs
- `logs/rollback/` - Rollback execution logs  
- `logs/validation/` - Validation test logs
- `logs/monitoring/` - Monitoring session logs

### Reports
Scripts generate JSON reports in:
- `reports/` - Validation and monitoring summary reports
- `deployments/` - Cutover and rollback records

### Monitoring Data
Real-time monitoring data stored in:
- `logs/monitoring/metrics.log` - Time-series metrics data

## Prerequisites

### Required Tools
- `curl` - HTTP requests
- `jq` - JSON processing
- `wrangler` - Cloudflare Workers deployment
- `dig` - DNS resolution testing
- `bc` - Arithmetic calculations

### Required Environment
- Authenticated Wrangler CLI (`wrangler login`)
- Cloudflare API credentials
- Access to Django admin API
- Network connectivity to production systems

### Repository State
- Clean Git working directory (or acknowledged uncommitted changes)
- Latest code on appropriate branch (main or phase8)
- Successful staging validation

## Recovery Procedures

### Partial Failure Recovery
If cutover fails partway through:
1. Check logs for specific failure point
2. Run rollback script: `./rollback-cutover.sh`
3. Investigate and fix issues
4. Re-attempt cutover when ready

### Emergency Situations
For critical production issues:
1. Run emergency rollback: `./rollback-cutover.sh --emergency`
2. Verify Django system health
3. Contact team for incident response

### Data Synchronization
If data was created during cutover:
1. Review rollback logs for data sync status
2. Manually sync any missed data if needed
3. Verify data integrity in Django system

## Testing and Validation

### Pre-Production Testing
Before running in production:
1. Test all scripts in staging environment
2. Verify environment variables are set correctly
3. Run dry-run mode to validate execution plan
4. Ensure rollback procedures work correctly

### Monitoring Validation
Monitor key metrics during cutover:
- Response times < 2 seconds
- Error rate < 5%
- Health score > 85%
- All critical endpoints responding

## Support and Troubleshooting

### Common Issues
1. **DNS Propagation Delays:** Normal, may take up to 30 minutes
2. **Worker Deployment Timeouts:** Retry with Wrangler directly
3. **Migration Timeouts:** Increase `CUTOVER_TIMEOUT` value
4. **Certificate Provisioning:** May take 5-10 minutes for SSL

### Emergency Contacts
- Review incident response procedures
- Escalate to senior team members if needed
- Document all actions taken during incident

### Log Analysis
Check logs for detailed error information:
```bash
# Most recent cutover log
tail -f logs/cutover/cutover_*.log

# Most recent rollback log  
tail -f logs/rollback/rollback_*.log

# Real-time monitoring
tail -f logs/monitoring/cutover_monitor_*.log
```

## Security Considerations

### Credential Management
- Store API tokens securely
- Use environment variables, not hardcoded values
- Rotate credentials after successful cutover

### Access Control
- Limit access to production cutover scripts
- Require approval for emergency rollback
- Log all cutover activities

### Data Protection
- Verify encryption in transit
- Validate data integrity checks
- Backup critical data before cutover

---

These scripts implement the comprehensive cutover strategy outlined in the Phase 8 deployment plan, providing robust automation with comprehensive safety measures and monitoring capabilities.