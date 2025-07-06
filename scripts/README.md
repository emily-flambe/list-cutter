# List Cutter Deployment Scripts

This directory contains all the deployment, validation, and cutover scripts for migrating List Cutter to the unified Cloudflare Workers architecture.

## Overview

The deployment process follows the Phase 8 implementation plan and provides a complete production deployment and cutover solution with comprehensive validation, monitoring, and rollback capabilities.

## Scripts

### 1. Production Deployment
- **`deploy-production.sh`** - Main production deployment script
  - Runs comprehensive pre-deployment checks
  - Deploys to staging for validation
  - Deploys to production with validation
  - Includes automatic rollback on failure

### 2. Environment Validation
- **`validate-staging.sh`** - Staging environment validation
  - Comprehensive health checks
  - API endpoint testing
  - Security header validation
  - Performance monitoring
  
- **`validate-production.sh`** - Production environment validation
  - Stricter validation criteria for production
  - Component health verification
  - SSL/HTTPS validation
  - Extended monitoring

### 3. Cutover Execution
- **`execute-cutover.sh`** - Complete cutover from Django to Workers
  - Pre-cutover checklist verification
  - Staged deployment with validation
  - DNS configuration updates
  - Extended monitoring and validation
  - Automatic rollback on issues

### 4. Emergency Response
- **`rollback-production.sh`** - Emergency production rollback
  - Immediate rollback using Wrangler
  - System verification after rollback
  - Extended monitoring
  - Notification and logging

### 5. DNS Management
- **`setup-dns.sh`** - DNS configuration for unified Workers
  - Configures all domain records
  - Sets up security records (SPF, DMARC)
  - Optimizes Cloudflare settings
  - Verifies DNS propagation

### 6. Notifications
- **`notify-deployment.sh`** - Deployment status notifications
  - Multi-channel notifications (email, Slack, Discord, Teams)
  - Deployment record keeping
  - Status tracking

## Usage

### Prerequisites

1. **Environment Variables**:
   ```bash
   export CLOUDFLARE_API_TOKEN=your_token_here
   export CLOUDFLARE_ZONE_ID=your_zone_id_here
   ```

2. **Optional Notification Configuration**:
   ```bash
   export NOTIFICATION_EMAIL=admin@list-cutter.com
   export SLACK_WEBHOOK_URL=https://hooks.slack.com/...
   export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   export TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
   ```

3. **Required Tools**:
   - `wrangler` CLI
   - `curl`
   - `jq`
   - `bc`
   - `dig`

### Deployment Workflow

#### 1. DNS Setup (One-time)
```bash
./scripts/setup-dns.sh
```

#### 2. Standard Production Deployment
```bash
./scripts/deploy-production.sh
```

#### 3. Complete Cutover (Django → Workers)
```bash
./scripts/execute-cutover.sh
```

#### 4. Emergency Rollback (if needed)
```bash
./scripts/rollback-production.sh
```

### Validation Only

To run validation without deployment:

```bash
# Staging validation
./scripts/validate-staging.sh

# Production validation
./scripts/validate-production.sh
```

## Deployment Strategy

### 1. Development → Staging
- Automated deployment to staging
- Comprehensive validation suite
- Performance benchmarking
- Security testing

### 2. Staging → Production
- Pre-deployment checklist verification
- Staged production deployment
- Real-time monitoring
- Automatic rollback on failure

### 3. Blue-Green Deployment
- Leverages Wrangler's built-in versioning
- Zero-downtime deployments
- Instant rollback capability
- Traffic monitoring

## Monitoring and Validation

### Health Checks
- Basic health endpoints
- Detailed system component checks
- Readiness and liveness probes
- Performance monitoring

### Security Validation
- SSL/HTTPS configuration
- Security headers verification
- CORS validation
- Rate limiting verification

### Performance Testing
- Response time monitoring
- Throughput validation
- Error rate tracking
- System stability testing

## Error Handling and Recovery

### Automatic Rollback Triggers
- Failed health checks
- High error rates (>5%)
- Extended response times (>2s)
- System component failures

### Manual Rollback
- Emergency rollback script
- Immediate system restoration
- Extended post-rollback monitoring
- Incident documentation

### Notification System
- Real-time deployment status
- Multi-channel alerts
- Deployment record keeping
- Team notifications

## File Structure

```
scripts/
├── README.md                    # This file
├── deploy-production.sh         # Main deployment script
├── validate-staging.sh          # Staging validation
├── validate-production.sh       # Production validation
├── execute-cutover.sh           # Complete cutover execution
├── rollback-production.sh       # Emergency rollback
├── setup-dns.sh                 # DNS configuration
├── notify-deployment.sh         # Notification system
└── deployments/                 # Deployment records (auto-created)
    ├── cutover_success_*.txt    # Cutover records
    ├── rollback_*.txt           # Rollback records
    └── dns_config_*.txt         # DNS configuration records
```

## Configuration Files

### Wrangler Configuration
The unified Worker uses environment-specific configuration in `unified-worker/wrangler.toml`:
- Development environment
- Staging environment
- Production environment

### Environment Variables
Required for production deployment:
```bash
# Cloudflare API credentials
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_ID=your_zone_id

# Optional notification settings
NOTIFICATION_EMAIL=admin@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Security Considerations

### Script Security
- All scripts validate input parameters
- Environment variables are required, not hardcoded
- API tokens are masked in logs
- Comprehensive error handling

### Deployment Security
- Pre-deployment security validation
- HTTPS enforcement
- Security header verification
- Rate limiting validation

### Rollback Security
- Immediate rollback capability
- System verification after rollback
- Audit trail maintenance
- Incident documentation

## Troubleshooting

### Common Issues

1. **API Token Issues**
   ```bash
   # Verify token has correct permissions
   curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
   ```

2. **DNS Propagation**
   ```bash
   # Check DNS propagation
   dig +short list-cutter.com
   dig +short www.list-cutter.com
   ```

3. **SSL Certificate Issues**
   ```bash
   # Verify SSL certificate
   curl -I https://list-cutter.com/
   ```

4. **Worker Deployment Issues**
   ```bash
   # Check Wrangler configuration
   cd unified-worker
   wrangler whoami
   wrangler dev --env production --dry-run
   ```

### Log Files

All deployment activities are logged:
- `cutover_YYYYMMDD_HHMMSS.log` - Complete cutover logs
- `deployments/` directory - Deployment records
- Console output with timestamps

### Support Contacts

For deployment issues:
1. Check the deployment logs
2. Review the health check endpoints
3. Verify environment configuration
4. Contact the development team

## Success Criteria

### Deployment Success
- ✅ All pre-deployment checks pass
- ✅ Staging validation successful
- ✅ Production deployment completes
- ✅ Health checks return healthy status
- ✅ All critical endpoints responsive
- ✅ Security validation passes

### Cutover Success
- ✅ Zero-downtime migration
- ✅ All user data preserved
- ✅ Performance meets requirements (<100ms response time)
- ✅ System stability confirmed (10+ minutes monitoring)
- ✅ Rollback capability verified
- ✅ Team notifications sent

## Future Enhancements

- Integration with CI/CD pipelines
- Automated testing integration
- Enhanced monitoring and alerting
- Canary deployment support
- Advanced blue-green deployment features

---

*This deployment system provides production-ready deployment capabilities with comprehensive validation, monitoring, and rollback procedures for the List Cutter unified Cloudflare Workers architecture.*