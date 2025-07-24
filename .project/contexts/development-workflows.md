# Development Workflows & Commands

## 🚨 CRITICAL: Frontend Deployment Workflow 🚨

### The Frontend Build Trap
**PROBLEM**: `make deploy-dev` does NOT automatically build the frontend!
- This is a common source of confusion when frontend changes don't appear after deployment
- The deploy command only deploys what's already built in `app/frontend/dist/`
- If you don't rebuild the frontend first, your changes won't be deployed

### Correct Frontend Deployment Process
```bash
# ALWAYS do this for frontend changes:
make build-frontend  # Step 1: Build the React app
make deploy-dev      # Step 2: Deploy worker + built assets

# Alternative: Build everything then deploy
make build          # Builds both frontend and backend in parallel
make deploy-dev     # Deploy everything
```

### Quick Verification
After deployment, check the browser console for your changes:
- Look for updated console.log messages
- Check the network tab for new asset hashes (e.g., `ChatBotWebSocket.BRcb6Ovf.js`)
- Hard refresh (Cmd+Shift+R) if needed

## Essential Development Commands

### **Daily Development Startup**
```bash
# Backend (Terminal 1)
cd cloudflare/workers && npm run dev

# Frontend (Terminal 2) 
cd app/frontend && npm run dev

# Logs monitoring (Terminal 3)
wrangler tail
```

### **Pre-Commit Validation (Critical)**
```bash
# Full validation sequence - run before every commit
npx wrangler --version          # Must be 4.0.0+
npx tsc --noEmit               # Type checking
npm run build                  # Build validation
npx wrangler versions upload --dry-run  # Deployment test
npm test                       # Test execution
```

---

## Database Operations

### **Development Database**
```bash
# Run migration
wrangler d1 execute cutty-dev --file=migrations/[filename].sql

# Query database
wrangler d1 execute cutty-dev --command "SELECT * FROM users LIMIT 10"

# List all databases
wrangler d1 list

# Backup development data
wrangler d1 backup create cutty-dev
```

### **Production Database (Use with extreme caution)**
```bash
# Production migration (requires review)
wrangler d1 execute cutty-prod --file=migrations/[filename].sql

# Production backup (always before changes)
wrangler d1 backup create cutty-prod

# Read-only queries
wrangler d1 execute cutty-prod --command "SELECT COUNT(*) FROM users"
```

---

## OAuth Development Setup

### **Initial OAuth Configuration**
```bash
# Set OAuth secrets (run once per environment)
wrangler secret put GOOGLE_CLIENT_ID      # From Google Cloud Console
wrangler secret put GOOGLE_CLIENT_SECRET  # From Google Cloud Console  
wrangler secret put GOOGLE_REDIRECT_URI   # Must match console exactly
wrangler secret put JWT_SECRET            # Generate secure random string
wrangler secret put API_KEY_SALT          # Generate secure random string
```

### **OAuth Testing Commands**
```bash
# Test OAuth endpoint
curl 'http://localhost:8787/api/v1/auth/google'
curl 'https://cutty-dev.emilycogsdill.com/api/v1/auth/google'

# Verify secrets are set
wrangler secret list | grep GOOGLE

# Rate limiting test
for i in {1..35}; do curl 'http://localhost:8787/api/v1/auth/google'; done
```

---

## Build & Deployment

### **Development Deployment**
```bash
# Deploy to development environment
wrangler deploy

# Verify deployment
curl https://cutty-dev.emilycogsdill.com/api/health

# Check worker logs
wrangler tail
```

### **Production Deployment**
```bash
# Pre-production validation
npm run build
npm test
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run --config wrangler.prod.toml

# Deploy to production (requires careful review)
wrangler deploy --config wrangler.prod.toml

# Verify production health
curl https://cutty.emilycogsdill.com/api/health
curl https://cutty.emilycogsdill.com/api/v1/auth/google
```

---

## Testing Workflows

### **Local Testing**
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration  
npm run test:security

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### **Clean Environment Testing**
```bash
# Reproduce CI environment exactly
rm -rf node_modules package-lock.json
npm ci  # NOT npm install

# Verify clean environment works
npm run build
npm test
npx wrangler deploy --dry-run
```

---

## Troubleshooting Workflows

### **Deployment Issues**
```bash
# Step 1: Clean install
rm -rf node_modules package-lock.json && npm ci

# Step 2: Version validation
npx wrangler --version  # Must be 4.0.0+
npx wrangler whoami     # Verify authentication

# Step 3: Configuration check
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run

# Step 4: Build validation
npm run build
npm test
```

### **OAuth Issues Diagnosis**
```bash
# Check secret configuration
wrangler secret list | grep GOOGLE

# Test endpoints
curl 'http://localhost:8787/api/v1/auth/google'
curl 'https://cutty-dev.emilycogsdill.com/api/v1/auth/google'

# Check database OAuth tables
wrangler d1 execute cutty-dev --command "SELECT * FROM oauth_states ORDER BY created_at DESC LIMIT 5"
wrangler d1 execute cutty-dev --command "SELECT * FROM oauth_security_events ORDER BY created_at DESC LIMIT 5"
```

### **TypeScript Issues**
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Common fixes
# 1. Comment out Analytics Engine in vitest.config.ts
# 2. Use safe type conversions: Number(value) || 0
# 3. Check test mocks match interfaces

# Build without type perfection
npm run build  # Should succeed even with type issues
```

---

## Performance Monitoring

### **Health Checks**
```bash
# Basic health endpoints
curl https://cutty.emilycogsdill.com/api/health
curl https://cutty-dev.emilycogsdill.com/api/health

# Auth system health
curl https://cutty.emilycogsdill.com/api/v1/auth/google

# Database connectivity
wrangler d1 execute cutty-dev --command "SELECT 1"
```

### **Performance Metrics**
```bash
# Response time testing
time curl https://cutty.emilycogsdill.com/api/health

# Load testing (use with caution)
for i in {1..10}; do time curl https://cutty-dev.emilycogsdill.com/api/health; done
```

---

## File Operations

### **File Upload Testing**
```bash
# Test file upload endpoint
curl -X POST -F "file=@test.csv" https://cutty-dev.emilycogsdill.com/api/v1/files/upload

# Check R2 storage
wrangler r2 object list cutty-files-dev

# Test file download
curl https://cutty-dev.emilycogsdill.com/api/v1/files/[file-id]
```

---

## Environment Management

### **Environment Variable Check**
```bash
# Verify .dev.vars exists (critical for local development)
ls -la cloudflare/workers/.dev.vars

# Sample .dev.vars content (never commit actual values)
# JWT_SECRET=dev-secret-key-for-local-testing-only
# API_KEY_SALT=dev-salt-for-api-keys-local-testing-only
```

### **Secret Management**
```bash
# List all secrets
wrangler secret list

# Update secret
wrangler secret put SECRET_NAME

# Delete secret (use with caution)
wrangler secret delete SECRET_NAME
```

---

## Emergency Procedures

### **Quick Rollback**
```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]

# Verify rollback succeeded
curl https://cutty.emilycogsdill.com/api/health
```

### **System Status Check**
```bash
# Full system health validation
echo "=== API Health ==="
curl https://cutty.emilycogsdill.com/api/health

echo "=== Auth Health ==="  
curl https://cutty.emilycogsdill.com/api/v1/auth/google

echo "=== Database Health ==="
wrangler d1 execute cutty-prod --command "SELECT COUNT(*) as user_count FROM users"

echo "=== Worker Status ==="
wrangler deployments list | head -5
```

---

## Productivity Tips

### **Shell Aliases (Optional)**
```bash
# Add to ~/.bashrc or ~/.zshrc
alias wdev="cd cloudflare/workers && npm run dev"
alias wdeploy="wrangler deploy"
alias wprod="wrangler deploy --config wrangler.prod.toml"
alias wlogs="wrangler tail"
alias wdb="wrangler d1 execute cutty-dev --command"
```

### **VS Code Tasks (Optional)**
Create `.vscode/tasks.json`:
```json
{
  "tasks": [
    {
      "label": "Deploy Dev",
      "type": "shell", 
      "command": "wrangler deploy",
      "group": "build"
    },
    {
      "label": "Validate Deployment", 
      "type": "shell",
      "command": "npm run build && npx wrangler deploy --dry-run",
      "group": "test"
    }
  ]
}
```

---

## Key Development Principles

1. **Always use `npm ci` for CI reproduction** (not `npm install`)
2. **Run full validation sequence before commits**
3. **Test OAuth endpoints after any auth changes**
4. **Keep `.dev.vars` file for local development**
5. **Use `--dry-run` flags for deployment validation**
6. **Monitor logs during development with `wrangler tail`**
7. **Clean install when deployment issues occur**
8. **Verify Wrangler version 4.0.0+ regularly**

---

*These workflows have been refined through daily development and production incident response.*