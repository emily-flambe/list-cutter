# Phase 6 Environment Configuration & Deployment Plan

## Target Audience
This document is designed for a Claude subagent responsible for configuring production environments and handling deployment of the authentication and security system.

## Current State Analysis

### ✅ What's Already Done
- Complete authentication implementation in `/workers/src/`
- Wrangler configuration file exists at `/workers/wrangler.toml`
- All required dependencies installed in package.json
- TypeScript configuration properly set up

### ❌ Configuration Gaps
- **Placeholder Values**: wrangler.toml contains placeholder IDs and secrets
- **Missing Environment Variables**: No production secrets configured
- **KV Namespace Setup**: Namespaces not created with real IDs
- **D1 Database Setup**: Database not created with real IDs
- **Domain Configuration**: No custom domain setup

## Implementation Strategy

### Phase 1: Environment Setup (Priority: CRITICAL)

#### 1.1 Cloudflare Account Configuration

**Prerequisites Check:**
- Cloudflare account with Workers access
- Domain configured in Cloudflare
- Workers plan (Paid) for KV and D1 usage
- API tokens with proper permissions

**Required Permissions:**
- Zone:Zone:Read
- Zone:Zone Settings:Edit
- Zone:Zone:Edit
- Account:Cloudflare Workers:Edit
- Account:D1:Edit

#### 1.2 KV Namespace Creation

**Current wrangler.toml Configuration:**
```toml
[[kv_namespaces]]
binding = "AUTH_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-id"
```

**Required Commands:**
```bash
# Create production KV namespace
wrangler kv:namespace create "AUTH_KV"

# Create preview KV namespace  
wrangler kv:namespace create "AUTH_KV" --preview

# Commands will output real IDs to update wrangler.toml
```

#### 1.3 D1 Database Setup

**Current Configuration:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "cutty-db"
database_id = "your-d1-database-id"
```

**Required Commands:**
```bash
# Create D1 database
wrangler d1 create cutty-db

# Apply schema
wrangler d1 execute cutty-db --file=schema.sql

# Verify tables created
wrangler d1 execute cutty-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Phase 2: Production Secrets Configuration (Priority: HIGH)

#### 2.1 Environment Variables Setup

**Required Secrets:**
```bash
# JWT signing secret (256-bit minimum)
wrangler secret put JWT_SECRET

# Encryption key for sensitive data
wrangler secret put ENCRYPTION_KEY

# API key salt for key generation
wrangler secret put API_KEY_SALT

# Optional: Database encryption key
wrangler secret put DB_ENCRYPTION_KEY
```

**Secret Generation Guidelines:**
```bash
# Generate strong JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32

# Generate API key salt
openssl rand -hex 16
```

#### 2.2 Environment-Specific Configuration

**Development Environment:**
```toml
[env.dev]
name = "cutty-dev"
vars = { ENVIRONMENT = "development" }

[[env.dev.kv_namespaces]]
binding = "AUTH_KV"
id = "dev-kv-namespace-id"
preview_id = "dev-preview-kv-id"

[[env.dev.d1_databases]]
binding = "DB"
database_name = "cutty-dev"
database_id = "dev-d1-database-id"
```

**Staging Environment:**
```toml
[env.staging]
name = "cutty-staging"
vars = { ENVIRONMENT = "staging" }

[[env.staging.kv_namespaces]]
binding = "AUTH_KV"
id = "staging-kv-namespace-id"
preview_id = "staging-preview-kv-id"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cutty-staging"
database_id = "staging-d1-database-id"
```

**Production Environment:**
```toml
[env.production]
name = "cutty-prod"
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "AUTH_KV"
id = "prod-kv-namespace-id"
preview_id = "prod-preview-kv-id"

[[env.production.d1_databases]]
binding = "DB"
database_name = "cutty-prod"
database_id = "prod-d1-database-id"
```

### Phase 3: Custom Domain Configuration (Priority: MEDIUM)

#### 3.1 Domain Setup

**Current Domain Configuration:**
- Primary: `cutty.emilycogsdill.com`
- Alternative: `list-cutter.emilycogsdill.com`

**Required wrangler.toml Updates:**
```toml
[env.production]
routes = [
  { pattern = "cutty.emilycogsdill.com/*", zone_name = "emilycogsdill.com" },
  { pattern = "list-cutter.emilycogsdill.com/*", zone_name = "emilycogsdill.com" }
]
```

#### 3.2 DNS Configuration

**Required DNS Records:**
```
cutty.emilycogsdill.com CNAME cutty-prod.emilycogsdill.workers.dev
list-cutter.emilycogsdill.com CNAME cutty-prod.emilycogsdill.workers.dev
```

### Phase 4: Database Migration (Priority: HIGH)

#### 4.1 Schema Deployment

**Current Schema Location:** `/workers/schema.sql`

**Deployment Commands:**
```bash
# Deploy to development
wrangler d1 execute cutty-dev --file=schema.sql

# Deploy to staging
wrangler d1 execute cutty-staging --file=schema.sql --env=staging

# Deploy to production
wrangler d1 execute cutty-prod --file=schema.sql --env=production
```

#### 4.2 Data Migration from Django

**Migration Strategy:**
1. **Export Django User Data:**
   ```sql
   -- Django PostgreSQL export
   SELECT id, username, email, password, date_joined, last_login
   FROM auth_user
   WHERE is_active = true;
   ```

2. **Transform Data for D1:**
   ```sql
   -- D1 import format
   INSERT INTO users (id, username, email, password, created_at, last_login, is_active)
   VALUES (?, ?, ?, ?, ?, ?, 1);
   ```

3. **Migration Script:**
   ```bash
   # Create migration SQL file
   # Execute via wrangler d1 execute
   wrangler d1 execute cutty-prod --file=migration.sql --env=production
   ```

### Phase 5: Deployment Pipeline (Priority: MEDIUM)

#### 5.1 CI/CD Configuration

**GitHub Actions Workflow:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: workers/package-lock.json
    
    - name: Install dependencies
      run: |
        cd workers
        npm ci
    
    - name: Run tests
      run: |
        cd workers
        npm test
    
    - name: Deploy to staging
      if: github.ref == 'refs/heads/main'
      run: |
        cd workers
        npx wrangler deploy --env=staging
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    
    - name: Deploy to production
      if: github.ref == 'refs/heads/main' && github.event_name == 'push'
      run: |
        cd workers
        npx wrangler deploy --env=production
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

#### 5.2 Deployment Verification

**Health Check Endpoints:**
```typescript
// Add to main worker
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'unknown'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/health/auth') {
      // Test database connection
      try {
        await env.DB.prepare('SELECT 1').first();
        return new Response(JSON.stringify({
          status: 'healthy',
          database: 'connected',
          kv: 'available'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'unhealthy',
          error: 'Database connection failed'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ... rest of routes
  }
};
```

## Configuration File Templates

### Complete wrangler.toml Template
```toml
name = "cutty"
main = "src/index.ts"
compatibility_date = "2024-12-30"
node_compat = true

[build]
command = "npm run build"

# Production Environment
[env.production]
name = "cutty-prod"
vars = { ENVIRONMENT = "production" }
routes = [
  { pattern = "cutty.emilycogsdill.com/*", zone_name = "emilycogsdill.com" },
  { pattern = "list-cutter.emilycogsdill.com/*", zone_name = "emilycogsdill.com" }
]

[[env.production.kv_namespaces]]
binding = "AUTH_KV"
id = "REPLACE_WITH_ACTUAL_PROD_KV_ID"

[[env.production.d1_databases]]
binding = "DB"
database_name = "cutty-prod"
database_id = "REPLACE_WITH_ACTUAL_PROD_DB_ID"

# Staging Environment
[env.staging]
name = "cutty-staging"
vars = { ENVIRONMENT = "staging" }

[[env.staging.kv_namespaces]]
binding = "AUTH_KV"
id = "REPLACE_WITH_ACTUAL_STAGING_KV_ID"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cutty-staging"
database_id = "REPLACE_WITH_ACTUAL_STAGING_DB_ID"

# Development Environment
[env.dev]
name = "cutty-dev"
vars = { ENVIRONMENT = "development" }

[[env.dev.kv_namespaces]]
binding = "AUTH_KV"
id = "REPLACE_WITH_ACTUAL_DEV_KV_ID"

[[env.dev.d1_databases]]
binding = "DB"
database_name = "cutty-dev"
database_id = "REPLACE_WITH_ACTUAL_DEV_DB_ID"
```

### Environment Setup Script
```bash
#!/bin/bash
# setup-environments.sh

echo "Setting up Cloudflare Workers environments..."

# Create KV namespaces
echo "Creating KV namespaces..."
wrangler kv:namespace create "AUTH_KV" --env=production
wrangler kv:namespace create "AUTH_KV" --env=staging
wrangler kv:namespace create "AUTH_KV" --env=dev

# Create D1 databases
echo "Creating D1 databases..."
wrangler d1 create cutty-prod
wrangler d1 create cutty-staging
wrangler d1 create cutty-dev

# Deploy schemas
echo "Deploying database schemas..."
wrangler d1 execute cutty-prod --file=schema.sql --env=production
wrangler d1 execute cutty-staging --file=schema.sql --env=staging
wrangler d1 execute cutty-dev --file=schema.sql --env=dev

echo "Environment setup complete!"
echo "Don't forget to:"
echo "1. Update wrangler.toml with the actual IDs"
echo "2. Set production secrets with 'wrangler secret put'"
echo "3. Configure DNS records for custom domains"
```

## Implementation Checklist

### Phase 1: Infrastructure Setup (Day 1)
- [ ] Verify Cloudflare account and permissions
- [ ] Create production KV namespace
- [ ] Create staging KV namespace
- [ ] Create development KV namespace
- [ ] Create production D1 database
- [ ] Create staging D1 database
- [ ] Create development D1 database

### Phase 2: Configuration (Day 2)
- [ ] Update wrangler.toml with real IDs
- [ ] Generate and set JWT_SECRET
- [ ] Generate and set ENCRYPTION_KEY
- [ ] Generate and set API_KEY_SALT
- [ ] Configure environment-specific variables
- [ ] Set up custom domain routes

### Phase 3: Database Setup (Day 3)
- [ ] Deploy schema to development
- [ ] Deploy schema to staging
- [ ] Deploy schema to production
- [ ] Verify database connectivity
- [ ] Test basic database operations

### Phase 4: Deployment Pipeline (Day 4)
- [ ] Set up GitHub Actions workflow
- [ ] Configure Cloudflare API token
- [ ] Test deployment to staging
- [ ] Verify health check endpoints
- [ ] Test deployment to production

### Phase 5: Production Validation (Day 5)
- [ ] Test authentication endpoints
- [ ] Verify custom domain access
- [ ] Test database operations
- [ ] Validate security headers
- [ ] Performance testing

## Success Criteria

### Infrastructure Validation
- [ ] All KV namespaces created and accessible
- [ ] All D1 databases created and schemas deployed
- [ ] Custom domains properly configured
- [ ] All secrets properly set and secure

### Deployment Validation
- [ ] Staging environment fully functional
- [ ] Production environment fully functional
- [ ] CI/CD pipeline operational
- [ ] Health checks passing

### Security Validation
- [ ] JWT tokens working correctly
- [ ] Password hashing functional
- [ ] Rate limiting operational
- [ ] Security headers applied

## Critical Notes for Subagent

- **Security First**: Never commit real secrets to version control
- **Validation**: Test each environment after setup
- **Backup**: Keep record of all created resource IDs
- **Documentation**: Update configuration documentation with real values
- **Monitoring**: Set up basic monitoring after deployment

## Next Steps After Implementation

1. **Environment Testing**: Verify all environments work correctly
2. **Security Audit**: Test authentication and security features
3. **Performance Testing**: Load test the production environment
4. **Monitoring Setup**: Configure alerts and logging
5. **Documentation**: Update deployment procedures

This configuration will provide a complete, production-ready deployment pipeline for the authentication and security system.