# List Cutter Workers - Quick Start Guide

## 🚀 Fast Deployment Commands

### 1. One-Time Setup
```bash
# Run the automated setup script
./setup-environment.sh

# Update wrangler.toml with the resource IDs from script output
# Replace all "REPLACE_WITH_ACTUAL_*" placeholders with real IDs
```

### 2. Configure Secrets
```bash
# Generate secrets locally
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

### 3. Deploy
```bash
# Build and deploy to all environments
npm run build
wrangler deploy --env=development
wrangler deploy --env=staging  
wrangler deploy --env=production
```

### 4. Validate
```bash
# Run validation script
./validate-deployment.sh

# Test health endpoints manually
curl https://list-cutter-workers-dev.YOUR_ACCOUNT.workers.dev/health
curl https://list-cutter-workers-prod.YOUR_ACCOUNT.workers.dev/health/auth
```

## 📁 Files Updated

### Configuration Files
- **`/workers/wrangler.toml`** - Complete environment configuration with dev/staging/prod
- **`/workers/src/types.ts`** - Added optional environment variables

### New Worker Features  
- **`/workers/src/index.ts`** - Added `/health` and `/health/auth` endpoints

### Documentation & Scripts
- **`/workers/DEPLOYMENT.md`** - Complete deployment guide
- **`/workers/setup-environment.sh`** - Automated resource creation
- **`/workers/validate-deployment.sh`** - Deployment validation
- **`/workers/QUICK-START.md`** - This quick reference

## 🔗 Health Check Endpoints

### `/health`
Basic health check returning:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-30T10:00:00.000Z", 
  "environment": "production",
  "version": "1.0.0"
}
```

### `/health/auth`
Authentication services health check:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-30T10:00:00.000Z",
  "environment": "production", 
  "services": {
    "database": "connected",
    "kv": "available", 
    "r2": "available"
  }
}
```

## 🌐 Environment URLs

After deployment, your workers will be available at:

- **Development**: `https://list-cutter-workers-dev.YOUR_ACCOUNT.workers.dev`
- **Staging**: `https://list-cutter-workers-staging.YOUR_ACCOUNT.workers.dev`  
- **Production**: `https://list-cutter-workers-prod.YOUR_ACCOUNT.workers.dev`

Custom production domains:
- `https://cutty.emilycogsdill.com`
- `https://list-cutter.emilycogsdill.com`

## ⚡ Key Features Configured

✅ **Multi-environment setup** (dev/staging/prod)  
✅ **Health check endpoints** for monitoring  
✅ **Custom domain routing** for production  
✅ **Environment-specific rate limiting**  
✅ **Secure secret management**  
✅ **Database schema deployment**  
✅ **Automated setup scripts**  
✅ **Deployment validation**  

## 🔧 Troubleshooting

**Issue**: Placeholder values in wrangler.toml  
**Fix**: Run `./setup-environment.sh` and update with real IDs

**Issue**: Health checks fail  
**Fix**: Check secrets are set and databases deployed  

**Issue**: Authentication not working  
**Fix**: Verify JWT_SECRET is configured properly

See `/workers/DEPLOYMENT.md` for detailed troubleshooting guide.