# Deployment Processes

## Deployment Overview

### Environments
- **Development**: Local development and testing
- **Staging**: Pre-production testing environment
- **Production**: Live production environment

### Deployment Strategy
- **Blue-Green Deployment**: Zero-downtime deployments
- **Environment Promotion**: Dev → Staging → Production
- **Rollback Capability**: Quick rollback on issues

## Pre-Deployment Checklist

### Code Quality
```bash
cd cloudflare/workers

# Build verification
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Test suite
npm run test:ci

# Security tests
npm test tests/security/

# Performance benchmarks
npm run test:benchmark
```

### Configuration Validation
```bash
# Wrangler configuration check
npx wrangler versions upload --dry-run

# Deployment dry run
npx wrangler deploy --dry-run

# Environment validation
./validate-deployment.sh
```

## Deployment Commands

### Environment Setup (One-time)
```bash
cd cloudflare/workers

# Run automated setup
./setup-environment.sh

# Configure secrets for all environments
./scripts/setup-secrets.sh
```

### Development Deployment
```bash
cd cloudflare/workers

# Deploy to development
npm run dev
# or
wrangler dev

# Deploy development version
wrangler deploy --env=development
```

### Staging Deployment
```bash
cd cloudflare/workers

# Build and deploy to staging
npm run build
wrangler deploy --env=staging

# Validate staging deployment
curl https://cutty-staging.YOUR_ACCOUNT.workers.dev/health
./validate-staging.sh
```

### Production Deployment
```bash
cd cloudflare/workers

# Final pre-production checks
npm run build
npm run test:ci
npx wrangler versions upload --dry-run

# Deploy to production
npm run deploy:production
# or
wrangler deploy --env=production

# Validate production deployment
curl https://cutty.emilycogsdill.com/health
./validate-production.sh
```

## Secret Management

### Required Secrets
```bash
# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
API_KEY_SALT=$(openssl rand -hex 16)

# Set for all environments
for env in development staging production; do
  echo $JWT_SECRET | wrangler secret put JWT_SECRET --env=$env
  echo $ENCRYPTION_KEY | wrangler secret put ENCRYPTION_KEY --env=$env
  echo $API_KEY_SALT | wrangler secret put API_KEY_SALT --env=$env
done
```

### Environment-Specific Secrets
```bash
# Database URLs (if needed)
wrangler secret put DATABASE_URL --env=production

# External API keys
wrangler secret put EXTERNAL_API_KEY --env=production

# List all secrets
wrangler secret list --env=production
```

## Database Migrations

### Development Database
```bash
# Create development database
wrangler d1 create cutty-dev

# Run initial schema
wrangler d1 execute cutty-dev --file=migrations/0001_initial_schema.sql

# Run additional migrations
wrangler d1 execute cutty-dev --file=migrations/0002_phase5_r2_enhancements.sql
```

### Production Database
```bash
# Create production database
wrangler d1 create cutty-prod

# Run all migrations in order
for migration in migrations/*.sql; do
  echo "Running $migration..."
  wrangler d1 execute cutty-prod --file="$migration"
done

# Verify database structure
wrangler d1 execute cutty-prod --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## R2 Storage Setup

### Create Buckets
```bash
# Development
wrangler r2 bucket create cutty-files-dev
wrangler r2 bucket cors put cutty-files-dev --file=../cors.json

# Staging  
wrangler r2 bucket create cutty-files-staging
wrangler r2 bucket cors put cutty-files-staging --file=../cors.json

# Production
wrangler r2 bucket create cutty-files-prod
wrangler r2 bucket cors put cutty-files-prod --file=../cors.json
```

## Monitoring and Validation

### Health Checks
```bash
# Basic health
curl https://cutty.emilycogsdill.com/health

# Authentication health
curl https://cutty.emilycogsdill.com/health/auth

# Monitoring dashboard
curl https://cutty.emilycogsdill.com/dashboard/monitoring
```

### Post-Deployment Validation
```bash
# Run validation script
./validate-deployment.sh

# Test critical endpoints
./validate-endpoints.js

# Monitor logs
wrangler tail --env=production

# Check metrics
wrangler r2 bucket list
wrangler d1 list
```

## Rollback Procedures

### Quick Rollback
```bash
# List recent deployments
wrangler deployments list --env=production

# Rollback to previous version
wrangler rollback --env=production

# Verify rollback
curl https://cutty.emilycogsdill.com/health
```

### Database Rollback
```bash
# Backup current database
wrangler d1 backup create cutty-prod

# Restore from backup if needed
wrangler d1 backup restore cutty-prod --backup-id=BACKUP_ID
```

## Troubleshooting Deployment Issues

### Common Problems
@include ../.claude/debugging-lessons.yml#WranglerDeploymentIssues

### Debug Commands
```bash
# Check Wrangler authentication
wrangler whoami

# Validate configuration
wrangler tail --version

# Check bindings
wrangler d1 list
wrangler r2 bucket list

# Clean build
rm -rf node_modules package-lock.json
npm ci
npm run build
```

### Emergency Procedures
```bash
# Emergency rollback
wrangler rollback --env=production

# Emergency maintenance mode
# Update worker to return maintenance page

# Contact procedures
# Notify stakeholders via designated channels
```