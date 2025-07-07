# Cloudflare Setup Guide for Cutty File Migration

This guide documents the correct Cloudflare object naming conventions and setup commands for the Cutty file migration system.

## Naming Conventions

All Cloudflare objects use "cutty" instead of "list-cutter" for consistency:

### Worker Names
- Development: `cutty-api` (cutty-api-dev)
- Staging: `cutty-api-staging` 
- Production: `cutty-api-production`

### Database Names  
- Development: `cutty-dev`
- Staging: `cutty-staging`
- Production: `cutty-production`

### R2 Bucket Names
- Development: `cutty-files-dev`
- Staging: `cutty-files-staging`  
- Production: `cutty-files-prod`

## Setup Commands

### 1. R2 Bucket Creation

Create environment-specific R2 buckets:

```bash
# Development environment
wrangler r2 bucket create cutty-files-dev

# Staging environment  
wrangler r2 bucket create cutty-files-staging

# Production environment
wrangler r2 bucket create cutty-files-prod
```

### 2. CORS Configuration

Apply CORS configuration to all buckets:

```bash
# Development
wrangler r2 bucket cors put cutty-files-dev --file cors.json

# Staging
wrangler r2 bucket cors put cutty-files-staging --file cors.json

# Production  
wrangler r2 bucket cors put cutty-files-prod --file cors.json
```

### 3. Database Setup

Create D1 databases:

```bash
# Development (if not exists)
wrangler d1 create cutty-dev

# Staging
wrangler d1 create cutty-staging

# Production
wrangler d1 create cutty-production
```

Apply schema to all environments:

```bash
# Development
wrangler d1 execute cutty-dev --file cloudflare/workers/migrations/0001_initial_schema.sql
wrangler d1 execute cutty-dev --file cloudflare/workers/migrations/0002_phase5_r2_enhancements.sql

# Staging
wrangler d1 execute cutty-staging --file cloudflare/workers/migrations/0001_initial_schema.sql
wrangler d1 execute cutty-staging --file cloudflare/workers/migrations/0002_phase5_r2_enhancements.sql

# Production
wrangler d1 execute cutty-production --file cloudflare/workers/migrations/0001_initial_schema.sql
wrangler d1 execute cutty-production --file cloudflare/workers/migrations/0002_phase5_r2_enhancements.sql
```

### 4. Workers Deployment

Deploy to different environments:

```bash
# Development
cd cloudflare/workers
wrangler deploy

# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

### 5. Environment Variables

Set required secrets for each environment:

```bash
# Development secrets
wrangler secret put JWT_SECRET --env development
wrangler secret put DB_ENCRYPTION_KEY --env development  
wrangler secret put MIGRATION_API_TOKEN --env development

# Staging secrets  
wrangler secret put JWT_SECRET --env staging
wrangler secret put DB_ENCRYPTION_KEY --env staging
wrangler secret put MIGRATION_API_TOKEN --env staging

# Production secrets
wrangler secret put JWT_SECRET --env production  
wrangler secret put DB_ENCRYPTION_KEY --env production
wrangler secret put MIGRATION_API_TOKEN --env production
```

## Environment Configuration

Each environment uses appropriate bucket names:

### Development (.env.migration)
```bash
R2_BUCKET_NAME=cutty-files-dev
WORKER_API_URL=https://cutty-api.your-subdomain.workers.dev
```

### Staging
```bash  
R2_BUCKET_NAME=cutty-files-staging
WORKER_API_URL=https://cutty-api-staging.your-subdomain.workers.dev
```

### Production
```bash
R2_BUCKET_NAME=cutty-files-prod  
WORKER_API_URL=https://cutty-api-production.your-subdomain.workers.dev
```

## Verification Commands

Verify setup for each environment:

```bash
# Check R2 buckets
wrangler r2 bucket list

# Check D1 databases  
wrangler d1 list

# Check Workers
wrangler list

# Verify CORS configuration
wrangler r2 bucket cors get cutty-files-dev
wrangler r2 bucket cors get cutty-files-staging  
wrangler r2 bucket cors get cutty-files-prod
```

## Migration Tool Configuration

When using the migration tools, ensure the correct environment variables:

```bash
# For development migrations
export R2_BUCKET_NAME=cutty-files-dev
export WORKER_API_URL=https://cutty-api.your-subdomain.workers.dev

# For staging migrations
export R2_BUCKET_NAME=cutty-files-staging
export WORKER_API_URL=https://cutty-api-staging.your-subdomain.workers.dev

# For production migrations  
export R2_BUCKET_NAME=cutty-files-prod
export WORKER_API_URL=https://cutty-api-production.your-subdomain.workers.dev
```

This ensures all objects follow the "cutty" naming convention and use environment-specific bucket names (dev/staging/prod).