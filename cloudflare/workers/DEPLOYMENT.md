# List Cutter Workers Deployment Guide

This guide provides step-by-step instructions for setting up and deploying the List Cutter Workers authentication system to Cloudflare Workers.

## Prerequisites

Before starting, ensure you have:

1. **Cloudflare Account**: With Workers Paid plan for KV and D1 usage
2. **Domain**: Configured in Cloudflare (emilycogsdill.com)
3. **API Permissions**: Cloudflare API token with the following permissions:
   - Zone:Zone:Read
   - Zone:Zone Settings:Edit
   - Zone:Zone:Edit
   - Account:Cloudflare Workers:Edit
   - Account:D1:Edit
4. **Wrangler CLI**: Installed and authenticated (`npm install -g wrangler`)

## Environment Setup

### Step 1: Create Resource Infrastructure

Run these commands to create the required Cloudflare resources:

#### Development Environment

```bash
# Create KV namespace for development
wrangler kv:namespace create "AUTH_KV" --env=development

# Create D1 database for development
wrangler d1 create list-cutter-db-dev

# Deploy database schema
wrangler d1 execute list-cutter-db-dev --file=schema.sql --env=development
```

#### Staging Environment

```bash
# Create KV namespace for staging
wrangler kv:namespace create "AUTH_KV" --env=staging

# Create D1 database for staging
wrangler d1 create list-cutter-db-staging

# Deploy database schema
wrangler d1 execute list-cutter-db-staging --file=schema.sql --env=staging
```

#### Production Environment

```bash
# Create KV namespace for production
wrangler kv:namespace create "AUTH_KV" --env=production

# Create D1 database for production
wrangler d1 create list-cutter-db-prod

# Deploy database schema
wrangler d1 execute list-cutter-db-prod --file=schema.sql --env=production
```

### Step 2: Update wrangler.toml with Real IDs

After running the above commands, you'll receive actual resource IDs. Update `/workers/wrangler.toml` by replacing:

- `REPLACE_WITH_ACTUAL_DEV_KV_ID` with the development KV namespace ID
- `REPLACE_WITH_ACTUAL_STAGING_KV_ID` with the staging KV namespace ID  
- `REPLACE_WITH_ACTUAL_PROD_KV_ID` with the production KV namespace ID
- `REPLACE_WITH_ACTUAL_DEV_DB_ID` with the development D1 database ID
- `REPLACE_WITH_ACTUAL_STAGING_DB_ID` with the staging D1 database ID
- `REPLACE_WITH_ACTUAL_PROD_DB_ID` with the production D1 database ID

### Step 3: Configure Production Secrets

Generate and set secure secrets for the production environment:

```bash
# Generate strong secrets (run locally)
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
openssl rand -hex 16  # For API_KEY_SALT

# Set production secrets
wrangler secret put JWT_SECRET --env=production
wrangler secret put ENCRYPTION_KEY --env=production  
wrangler secret put API_KEY_SALT --env=production

# Optional: Database encryption key
wrangler secret put DB_ENCRYPTION_KEY --env=production
```

### Step 4: Configure Staging Secrets

```bash
# Set staging secrets (can use different values than production)
wrangler secret put JWT_SECRET --env=staging
wrangler secret put ENCRYPTION_KEY --env=staging
wrangler secret put API_KEY_SALT --env=staging
```

### Step 5: Configure Development Secrets

```bash
# Set development secrets (can use simpler values for testing)
wrangler secret put JWT_SECRET --env=development
wrangler secret put ENCRYPTION_KEY --env=development
wrangler secret put API_KEY_SALT --env=development
```

## Deployment Commands

### Build and Deploy

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to development
wrangler deploy --env=development

# Deploy to staging
wrangler deploy --env=staging

# Deploy to production
wrangler deploy --env=production
```

### Verify Deployment

Test the health check endpoints after deployment:

```bash
# Check basic health
curl https://list-cutter-workers-dev.YOUR_ACCOUNT.workers.dev/health

# Check authentication services health
curl https://list-cutter-workers-dev.YOUR_ACCOUNT.workers.dev/health/auth
```

Expected healthy response:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-30T10:00:00.000Z",
  "environment": "development",
  "services": {
    "database": "connected",
    "kv": "available",
    "r2": "available"
  }
}
```

## Custom Domain Setup

### DNS Configuration

Add these DNS records in your Cloudflare dashboard:

```
cutty.emilycogsdill.com CNAME list-cutter-workers-prod.YOUR_ACCOUNT.workers.dev
list-cutter.emilycogsdill.com CNAME list-cutter-workers-prod.YOUR_ACCOUNT.workers.dev
```

### Test Custom Domain

After DNS propagation (may take a few minutes):

```bash
curl https://cutty.emilycogsdill.com/health
curl https://list-cutter.emilycogsdill.com/health
```

## Database Verification

### Check Database Schema

```bash
# Verify tables exist in production
wrangler d1 execute list-cutter-db-prod --command="SELECT name FROM sqlite_master WHERE type='table';" --env=production

# Expected output: users, saved_files, file_relationships
```

### Test Database Operations

```bash
# Test a simple query
wrangler d1 execute list-cutter-db-prod --command="SELECT COUNT(*) FROM users;" --env=production
```

## Troubleshooting

### Common Issues

1. **"Namespace not found" error**
   - Verify KV namespace IDs in wrangler.toml are correct
   - Ensure namespaces were created successfully

2. **"Database not found" error**
   - Verify D1 database IDs in wrangler.toml are correct
   - Ensure databases were created successfully

3. **"Secrets not found" error**
   - Verify all required secrets are set for the environment
   - Use `wrangler secret list --env=ENVIRONMENT` to check

4. **Health check fails**
   - Check the `/health/auth` endpoint for specific service errors
   - Verify database schema was deployed correctly

### Debug Commands

```bash
# List KV namespaces
wrangler kv:namespace list

# List D1 databases
wrangler d1 list

# List secrets for an environment
wrangler secret list --env=production

# View worker logs
wrangler tail --env=production
```

## Security Notes

- **Never commit secrets to version control**
- **Use strong, unique secrets for production**
- **Regularly rotate JWT secrets and encryption keys**
- **Monitor worker logs for suspicious activity**
- **Keep wrangler.toml template with placeholder IDs in version control**

## Maintenance

### Updating Schemas

To update the database schema:

```bash
# Apply schema changes to each environment
wrangler d1 execute list-cutter-db-dev --file=schema.sql --env=development
wrangler d1 execute list-cutter-db-staging --file=schema.sql --env=staging
wrangler d1 execute list-cutter-db-prod --file=schema.sql --env=production
```

### Secret Rotation

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# Update secret
echo $NEW_SECRET | wrangler secret put JWT_SECRET --env=production
```

## Support

For deployment issues:
1. Check the health endpoints first
2. Review worker logs with `wrangler tail`
3. Verify resource IDs and secrets are correctly configured
4. Ensure all prerequisites are met