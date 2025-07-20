# Troubleshooting Guide

## Systematic Debugging Approach

### **Step 1: Reproduce the Issue**
1. **Document exact error message** (screenshot if necessary)
2. **Identify environment** (local, dev, prod)
3. **Note recent changes** (deployments, config changes, dependencies)
4. **Reproduce in clean environment** if possible

### **Step 2: Check the Basics**
```bash
# Version validation
npx wrangler --version  # Must be 4.0.0+
node --version
npm --version

# Authentication check
npx wrangler whoami

# Configuration validation
npx wrangler deploy --dry-run
```

---

## Common Issues & Solutions

### **🚨 Deployment Failures**

#### **"Internal Server Error" / "Binding field error"**
**Symptoms**: Deployment fails with vague error messages
**Root Cause**: Usually configuration or dependency mismatch

**Solution**:
```bash
# 1. Clean install (matches CI exactly)
rm -rf node_modules package-lock.json
npm ci

# 2. Verify configuration
cat wrangler.toml  # Check assets directory matches build output
npx wrangler versions upload --dry-run

# 3. Check deployment type in Cloudflare dashboard
# Should show "Workers" not "Pages"

# 4. Validate build
npm run build
ls -la app/frontend/dist  # Verify assets exist
```

#### **"Wrangler is out of date"**
**Solution**:
```bash
npm install -g wrangler@latest
npx wrangler --version  # Verify 4.0.0+
```

---

### **🔐 OAuth Issues**

#### **"Invalid redirect_uri"**
**Symptoms**: OAuth flow fails at Google redirect
**Root Cause**: URL mismatch between code and Google Cloud Console

**Solution**:
```bash
# 1. Check current configuration
wrangler secret list | grep GOOGLE

# 2. Verify redirect URI exactly matches Google Console
# Local: http://localhost:8787/api/v1/auth/google/callback
# Dev: https://cutty-dev.emilycogsdill.com/api/v1/auth/google/callback
# Prod: https://cutty.emilycogsdill.com/api/v1/auth/google/callback

# 3. Update if needed
wrangler secret put GOOGLE_REDIRECT_URI

# 4. Test endpoint
curl 'http://localhost:8787/api/v1/auth/google'
```

#### **"State parameter mismatch"**
**Symptoms**: OAuth callback fails with state validation error
**Root Cause**: JWT_SECRET missing or system time sync issues

**Solution**:
```bash
# 1. Check JWT_SECRET exists
wrangler secret list | grep JWT

# 2. Set if missing
wrangler secret put JWT_SECRET

# 3. Check system time (OAuth is time-sensitive)
date
ntpdate -s time.nist.gov  # Sync if needed

# 4. Clear OAuth state table
wrangler d1 execute cutty-dev --command "DELETE FROM oauth_states WHERE expires_at < datetime('now')"
```

#### **OAuth Rate Limiting**
**Symptoms**: Too many OAuth requests blocked
**Solution**:
```bash
# Check rate limiting table
wrangler d1 execute cutty-dev --command "
SELECT ip_address, COUNT(*) as attempts, MAX(created_at) as last_attempt 
FROM oauth_rate_limits 
WHERE created_at > datetime('now', '-15 minutes') 
GROUP BY ip_address
"

# Clear rate limits if needed (development only)
wrangler d1 execute cutty-dev --command "DELETE FROM oauth_rate_limits WHERE created_at < datetime('now', '-15 minutes')"
```

---

### **📝 TypeScript Build Issues**

#### **Build Fails with Type Errors**
**Philosophy**: Build success > type perfection

**Solution**:
```bash
# 1. Focus on build success first
npm run build  # Must succeed

# 2. If build fails, check common issues:
# - Analytics Engine in vitest.config.ts (comment out)
# - Type assertions vs safe conversions
# - Test mock interfaces

# 3. Use safe type conversions
# WRONG: const count = result.count as number;
# RIGHT: const count = Number(result?.count) || 0;

# 4. Fix types gradually
npx tsc --noEmit  # Shows type issues without blocking builds
```

#### **Test Failures with Type Mismatches**
**Symptoms**: Tests fail with unexpected type errors
**Root Cause**: Mock data doesn't match TypeScript interfaces

**Solution**:
```typescript
// WRONG: Type mismatches
const mockUser = { id: 1, name: 'test' };  // number vs string

// RIGHT: Exact interface match
const mockUser = { id: '1', name: 'test' };  // string as expected

// Analytics Engine issue (comment out in vitest.config.ts)
// analyticsEngineDatasets: { ... }  // COMMENT THIS OUT
```

---

### **🗄️ Database Issues**

#### **Database Connection Failures**
**Symptoms**: D1 queries timeout or fail
**Solution**:
```bash
# 1. Check database exists
wrangler d1 list

# 2. Test connection
wrangler d1 execute cutty-dev --command "SELECT 1"

# 3. Check binding in wrangler.toml
cat wrangler.toml | grep -A5 "\[\[d1_databases\]\]"

# 4. Verify database name matches environment
# Dev: cutty-dev
# Prod: cutty-prod
```

#### **Migration Failures**
**Solution**:
```bash
# 1. Check migration file syntax
cat migrations/[filename].sql

# 2. Run migration manually
wrangler d1 execute cutty-dev --file=migrations/[filename].sql

# 3. Check schema version
wrangler d1 execute cutty-dev --command "SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 5"
```

---

### **📁 File Upload Issues**

#### **File Upload Fails**
**Symptoms**: 500 error on file upload
**Solution**:
```bash
# 1. Check R2 bucket exists
wrangler r2 bucket list

# 2. Test R2 connection
wrangler r2 object list cutty-files-dev

# 3. Check file size limits (default 10MB)
# 4. Verify content type headers
```

---

### **🌐 Environment Issues**

#### **Local Development Not Working**
**Symptoms**: Local server starts but endpoints fail
**Solution**:
```bash
# 1. Check .dev.vars exists (CRITICAL)
ls -la cloudflare/workers/.dev.vars

# 2. If missing, create with required secrets
cat > cloudflare/workers/.dev.vars << 'EOF'
JWT_SECRET=dev-secret-key-for-local-testing-only
API_KEY_SALT=dev-salt-for-api-keys-local-testing-only
EOF

# 3. Restart development server
cd cloudflare/workers && npm run dev

# 4. Test health endpoint
curl http://localhost:8787/api/health
```

#### **Wrong Environment Deployment**
**Symptoms**: Deployed to wrong environment (dev instead of prod)
**Solution**:
```bash
# Check current deployment
wrangler deployments list

# Deploy to correct environment
# Dev: wrangler deploy
# Prod: wrangler deploy --config wrangler.prod.toml

# Verify deployment
curl https://cutty-dev.emilycogsdill.com/api/health  # Dev
curl https://cutty.emilycogsdill.com/api/health      # Prod
```

---

## Performance Issues

### **Slow Response Times**
**Symptoms**: API endpoints taking >1000ms
**Diagnostic Steps**:
```bash
# 1. Test response times
time curl https://cutty.emilycogsdill.com/api/health

# 2. Check database query performance
wrangler d1 execute cutty-dev --command "
SELECT COUNT(*) as total_users, 
       AVG(LENGTH(username)) as avg_username_length
FROM users
"

# 3. Monitor logs for slow queries
wrangler tail
```

**Common Solutions**:
- Add database indexes for frequent queries
- Implement caching for repeated data
- Optimize large file processing
- Use prepared statements for database queries

---

## Security Issues

### **Suspicious Authentication Activity**
**Symptoms**: Unusual login patterns or failed attempts
**Investigation**:
```bash
# Check security events
wrangler d1 execute cutty-dev --command "
SELECT event_type, COUNT(*) as count, ip_address, MAX(created_at) as latest
FROM oauth_security_events 
WHERE created_at > datetime('now', '-24 hours')
GROUP BY event_type, ip_address
ORDER BY count DESC
"

# Check rate limiting effectiveness
wrangler d1 execute cutty-dev --command "
SELECT ip_address, COUNT(*) as attempts
FROM oauth_rate_limits 
WHERE created_at > datetime('now', '-1 hour')
GROUP BY ip_address
HAVING attempts > 10
"
```

---

## Emergency Procedures

### **Service Down - Quick Recovery**
```bash
# 1. Check service health
curl https://cutty.emilycogsdill.com/api/health

# 2. Check recent deployments
wrangler deployments list | head -5

# 3. Rollback if needed
wrangler rollback [previous-deployment-id]

# 4. Verify recovery
curl https://cutty.emilycogsdill.com/api/health
```

### **Database Emergency**
```bash
# 1. Create immediate backup
wrangler d1 backup create cutty-prod

# 2. Check database health
wrangler d1 execute cutty-prod --command "SELECT COUNT(*) FROM users"

# 3. If corruption suspected, check recent migrations
wrangler d1 execute cutty-prod --command "SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 3"
```

---

## Debug Information Collection

### **For Bug Reports**
```bash
# System information
echo "=== Environment ==="
npx wrangler --version
node --version
npm --version
uname -a

echo "=== Configuration ==="
cat package.json | grep -E '"name"|"version"'
cat wrangler.toml | grep -E 'name|compatibility_date'

echo "=== Recent Deployments ==="
wrangler deployments list | head -5

echo "=== Health Check ==="
curl -s https://cutty.emilycogsdill.com/api/health || echo "Health check failed"
```

### **For OAuth Issues**
```bash
echo "=== OAuth Configuration ==="
wrangler secret list | grep GOOGLE

echo "=== Recent OAuth Events ==="
wrangler d1 execute cutty-dev --command "
SELECT event_type, severity, ip_address, created_at 
FROM oauth_security_events 
ORDER BY created_at DESC 
LIMIT 10
"
```

---

## Contact & Escalation

### **When to Escalate**
- Data corruption or loss
- Security breaches or suspicious activity
- Extended service outages (>15 minutes)
- Payment or billing issues

### **Information to Include**
1. **Environment**: Local, dev, or prod
2. **Timestamp**: When issue started
3. **Error messages**: Exact text or screenshots
4. **Recent changes**: Deployments, config changes
5. **Impact**: User-facing or internal
6. **Debug output**: From collection commands above

---

*This guide is updated based on real production incidents and should be the first reference for debugging issues.*