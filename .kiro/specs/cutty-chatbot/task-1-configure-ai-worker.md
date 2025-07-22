# Task 1: Configure External AI Worker Connection

## Overview
Set up environment variables and secrets to enable communication between the Cutty app and the external AI worker service.

## Configuration Steps

### 1. Update wrangler.toml
Add the AI worker URL to the development configuration:

```toml
# In cloudflare/workers/wrangler.toml
name = "cutty-dev"
main = "src/index.ts"

[vars]
AI_WORKER_URL = "https://ai.emilycogsdill.com"
```

### 2. Update wrangler.prod.toml
Add the same configuration for production:

```toml
# In cloudflare/workers/wrangler.prod.toml
name = "cutty"
main = "src/index.ts"

[vars]
AI_WORKER_URL = "https://ai.emilycogsdill.com"
```

### 3. Create/Update .dev.vars
Add the API key for local development:

```bash
# In cloudflare/workers/.dev.vars
JWT_SECRET=dev-secret-key-for-local-testing-only-never-use-in-production
API_KEY_SALT=dev-salt-for-api-keys-local-testing-only
AI_WORKER_API_KEY=dev-ai-worker-key-for-testing
```

### 4. Add Production Secret
```bash
# Run from cloudflare/workers directory
wrangler secret put AI_WORKER_API_KEY --env production
# When prompted, enter the production API key
```

### 5. Update TypeScript Types
Add the new environment variables to the type definitions:

```typescript
// In cloudflare/workers/src/types/env.ts
export interface Env {
  // Existing types...
  JWT_SECRET: string;
  API_KEY_SALT: string;
  
  // Add new AI worker config
  AI_WORKER_URL: string;
  AI_WORKER_API_KEY: string;
}
```

## Verification Steps

1. **Check local config**: 
   ```bash
   cd cloudflare/workers
   cat .dev.vars | grep AI_WORKER
   ```

2. **Check wrangler config**:
   ```bash
   grep AI_WORKER wrangler.toml
   ```

3. **Test in development**:
   ```bash
   npm run dev
   # The worker should start without errors
   ```

## Common Issues & Solutions

### Issue: Missing .dev.vars file
**Solution**: Create the file if it doesn't exist:
```bash
cd cloudflare/workers
touch .dev.vars
# Add all required variables
```

### Issue: Secret not available in production
**Solution**: Make sure to deploy after adding the secret:
```bash
wrangler deploy --env production
```

## Security Notes
- Never commit .dev.vars to git (should be in .gitignore)
- Use different API keys for dev and production
- Rotate API keys periodically
- Store production keys in password manager