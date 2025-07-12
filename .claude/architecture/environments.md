# Environment Configuration

## Environment Overview

### Environment Strategy
- **Development**: Local development and feature testing
- **Staging**: Pre-production testing with production-like data
- **Production**: Live application serving real users

### Naming Conventions
@include ../.claude/project-config.yml#ProjectIdentity

## Environment Details

### Development Environment
```yaml
Environment: development
Purpose: Local development and initial testing
URL: http://localhost:8787
Database: cutty-dev (local D1)
Storage: cutty-files-dev (R2 bucket)
Secrets: Development-safe values
Monitoring: Basic logging
```

#### Development Configuration
```toml
# wrangler.toml - Development
[env.development]
name = "cutty-workers-dev"
compatibility_date = "2024-12-01"

[[env.development.d1_databases]]
binding = "DB"
database_name = "cutty-dev"
database_id = "DEVELOPMENT_DB_ID"

[[env.development.r2_buckets]]
binding = "R2"
bucket_name = "cutty-files-dev"

[env.development.vars]
ENVIRONMENT = "development"
LOG_LEVEL = "debug"
CORS_ORIGINS = "http://localhost:5173,http://localhost:3000"
```

### Staging Environment
```yaml
Environment: staging
Purpose: Pre-production testing and validation
URL: https://cutty-staging.YOUR_ACCOUNT.workers.dev
Database: cutty-staging (D1)
Storage: cutty-files-staging (R2 bucket)
Secrets: Production-like but safe for testing
Monitoring: Full monitoring stack
```

#### Staging Configuration
```toml
# wrangler.toml - Staging
[env.staging]
name = "cutty-workers-staging"
compatibility_date = "2024-12-01"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cutty-staging"
database_id = "STAGING_DB_ID"

[[env.staging.r2_buckets]]
binding = "R2"
bucket_name = "cutty-files-staging"

[env.staging.vars]
ENVIRONMENT = "staging"
LOG_LEVEL = "info"
CORS_ORIGINS = "https://cutty-staging.emilycogsdill.com"
```

### Production Environment
```yaml
Environment: production
Purpose: Live application serving real users
URL: https://cutty.emilycogsdill.com
Database: cutty-prod (D1)
Storage: cutty-files-prod (R2 bucket)
Secrets: Production secrets with rotation
Monitoring: Full observability and alerting
```

#### Production Configuration
```toml
# wrangler.toml - Production
[env.production]
name = "cutty-workers-prod"
compatibility_date = "2024-12-01"
routes = [
  "cutty.emilycogsdill.com/*",
  "list-cutter.emilycogsdill.com/*"
]

[[env.production.d1_databases]]
binding = "DB" 
database_name = "cutty-prod"
database_id = "PRODUCTION_DB_ID"

[[env.production.r2_buckets]]
binding = "R2"
bucket_name = "cutty-files-prod"

[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
CORS_ORIGINS = "https://cutty.emilycogsdill.com"
```

## Secret Management

### Required Secrets by Environment

#### Development Secrets
```bash
# Generate development secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
API_KEY_SALT=$(openssl rand -hex 16)

# Set development secrets
echo $JWT_SECRET | wrangler secret put JWT_SECRET --env=development
echo $ENCRYPTION_KEY | wrangler secret put ENCRYPTION_KEY --env=development
echo $API_KEY_SALT | wrangler secret put API_KEY_SALT --env=development
```

#### Staging Secrets
```bash
# Generate staging secrets (production-strength)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
API_KEY_SALT=$(openssl rand -hex 16)

# Set staging secrets
echo $JWT_SECRET | wrangler secret put JWT_SECRET --env=staging
echo $ENCRYPTION_KEY | wrangler secret put ENCRYPTION_KEY --env=staging
echo $API_KEY_SALT | wrangler secret put API_KEY_SALT --env=staging
```

#### Production Secrets
```bash
# Generate production secrets (high entropy)
JWT_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 64)
API_KEY_SALT=$(openssl rand -hex 32)

# Set production secrets with backup
echo $JWT_SECRET | wrangler secret put JWT_SECRET --env=production
echo $ENCRYPTION_KEY | wrangler secret put ENCRYPTION_KEY --env=production
echo $API_KEY_SALT | wrangler secret put API_KEY_SALT --env=production

# Store backup copies securely
echo "JWT_SECRET=$JWT_SECRET" >> production_secrets_backup.env
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> production_secrets_backup.env
echo "API_KEY_SALT=$API_KEY_SALT" >> production_secrets_backup.env
```

### Secret Rotation Process
```bash
# 1. Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 64)

# 2. Update application with dual secret support
# 3. Deploy new version that accepts both old and new secrets
wrangler deploy --env=production

# 4. Update secret in Cloudflare
echo $NEW_JWT_SECRET | wrangler secret put JWT_SECRET --env=production

# 5. Monitor for issues
# 6. Remove old secret support in next deployment
```

## Database Setup

### Development Database
```bash
# Create development database
wrangler d1 create cutty-dev

# Update wrangler.toml with returned database_id
# Run initial schema
wrangler d1 execute cutty-dev --file=migrations/0001_initial_schema.sql

# Seed with test data
wrangler d1 execute cutty-dev --file=migrations/seed_test_data.sql
```

### Staging Database
```bash
# Create staging database
wrangler d1 create cutty-staging

# Run all migrations
for migration in migrations/*.sql; do
  echo "Running $migration on staging..."
  wrangler d1 execute cutty-staging --file="$migration"
done

# Import production-like test data
wrangler d1 execute cutty-staging --file=migrations/seed_staging_data.sql
```

### Production Database
```bash
# Create production database
wrangler d1 create cutty-prod

# Run migrations with backup
for migration in migrations/*.sql; do
  echo "Backing up before $migration..."
  wrangler d1 backup create cutty-prod
  
  echo "Running $migration on production..."
  wrangler d1 execute cutty-prod --file="$migration"
  
  echo "Verifying migration..."
  # Add verification queries here
done
```

## Storage Setup

### R2 Bucket Configuration

#### Development Storage
```bash
# Create development bucket
wrangler r2 bucket create cutty-files-dev

# Configure CORS for local development
wrangler r2 bucket cors put cutty-files-dev --file=cors.json

# Test bucket access
echo "test file" | wrangler r2 object put cutty-files-dev/test.txt
```

#### Staging Storage
```bash
# Create staging bucket
wrangler r2 bucket create cutty-files-staging

# Configure CORS for staging domain
wrangler r2 bucket cors put cutty-files-staging --file=cors.json

# Set up bucket notifications (if needed)
# Configure lifecycle policies
```

#### Production Storage
```bash
# Create production bucket
wrangler r2 bucket create cutty-files-prod

# Configure CORS for production domains
wrangler r2 bucket cors put cutty-files-prod --file=cors.json

# Configure backup policies
# Set up monitoring and alerting
# Configure lifecycle management
```

### CORS Configuration
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://cutty.emilycogsdill.com"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## Environment Variables

### Common Variables
```bash
# Application configuration
ENVIRONMENT=development|staging|production
LOG_LEVEL=debug|info|warn|error
NODE_ENV=development|production

# CORS configuration
CORS_ORIGINS=comma,separated,origins

# Feature flags
ENABLE_ANALYTICS=true|false
ENABLE_DEBUG_LOGS=true|false
ENABLE_RATE_LIMITING=true|false
```

### Environment-Specific Variables
```bash
# Development
DEBUG=true
ENABLE_MOCK_AUTH=true
BYPASS_RATE_LIMITING=true

# Staging  
STAGING_MODE=true
LOAD_TEST_MODE=true
ENABLE_VERBOSE_LOGGING=true

# Production
PRODUCTION_MODE=true
STRICT_SECURITY=true
ENABLE_MONITORING=true
```

## Deployment Commands

### Development Deployment
```bash
cd cloudflare/workers

# Start local development
npm run dev

# Deploy to development environment
wrangler deploy --env=development

# Test deployment
curl https://cutty-workers-dev.YOUR_ACCOUNT.workers.dev/health
```

### Staging Deployment
```bash
# Build and test locally first
npm run build
npm run test

# Deploy to staging
wrangler deploy --env=staging

# Run staging validation
./validate-staging.sh

# Test critical flows
npm run test:e2e --env=staging
```

### Production Deployment
```bash
# Final validation
npm run build
npm run test:ci
npm run test:security

# Deploy to production
wrangler deploy --env=production

# Validate production deployment
./validate-production.sh

# Monitor deployment
wrangler tail --env=production
```

## Monitoring and Alerts

### Environment-Specific Monitoring

#### Development
- Basic console logging
- Local error reporting
- Simple health checks

#### Staging
- Full monitoring stack
- Performance testing
- Load testing validation
- Security scanning

#### Production
- Real-time monitoring
- Comprehensive alerting
- Performance tracking
- Security monitoring
- Business metrics

### Health Check Endpoints
```bash
# Basic health check
curl https://cutty.emilycogsdill.com/health

# Detailed health check
curl https://cutty.emilycogsdill.com/health/auth

# Monitoring dashboard
curl https://cutty.emilycogsdill.com/dashboard/monitoring
```

## Environment Promotion

### Development → Staging
1. Code review and approval
2. Automated testing passes
3. Security scan completion
4. Deployment to staging
5. Integration testing
6. Performance validation

### Staging → Production
1. Staging validation complete
2. Load testing passes
3. Security audit approval
4. Business stakeholder sign-off
5. Deployment window scheduled
6. Production deployment
7. Post-deployment validation
8. Monitoring confirmation