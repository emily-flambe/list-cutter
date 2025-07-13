# Worker Deployment Guide

This document explains how to deploy the Cutty workers with the new simplified naming convention.

## Worker Configuration

### Development Worker
- **Worker Name**: `cutty-dev`
- **Domain**: `cutty-dev.emilycogsdill.com`
- **Config File**: `wrangler.toml` (default)
- **Environment**: `ENVIRONMENT = "development"`

### Production Worker
- **Worker Name**: `cutty`
- **Domain**: `cutty.emilycogsdill.com`
- **Config File**: `wrangler.prod.toml`
- **Environment**: `ENVIRONMENT = "production"`

## Deployment Commands

### Deploy Development
```bash
# Deploy to cutty-dev worker serving cutty-dev.emilycogsdill.com
npm run deploy:dev
# or
wrangler deploy
```

### Deploy Production
```bash
# Deploy to cutty worker serving cutty.emilycogsdill.com
npm run deploy:production
# or
wrangler deploy --config wrangler.prod.toml
```

### Deploy Staging (if needed)
```bash
# Deploy to cutty-dev worker with staging environment
npm run deploy:staging
# or
wrangler deploy --env staging
```

## One-Time Setup

### 1. Rename Workers in Cloudflare Dashboard
- Rename current `cutty` worker to `cutty-dev`
- Rename current `cutty-production` worker to `cutty`

### 2. Set Secrets for Both Workers
```bash
# Development worker secrets
wrangler secret put JWT_SECRET --name cutty-dev
wrangler secret put API_KEY_SALT --name cutty-dev

# Production worker secrets
wrangler secret put JWT_SECRET --name cutty
wrangler secret put API_KEY_SALT --name cutty
```

## Benefits of New Approach

✅ **Clear naming**: Worker names match domain names  
✅ **No confusion**: `cutty-dev` serves dev, `cutty` serves prod  
✅ **Separate configurations**: Each worker has its own config file  
✅ **Independent deployments**: Deploy dev and prod separately  
✅ **Easier debugging**: Clear separation of environments