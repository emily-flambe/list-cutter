# Debugging Lessons - Hard-Earned Tribal Knowledge

## Critical Debugging Principles

### **Golden Rule: Multi-Layered Problem Diagnosis**
- Always check for multiple simultaneous issues
- Start by reproducing the exact CI failure locally before making configuration changes
- Never assume a single fix will solve complex deployment issues

---

## Wrangler Deployment Issues (Issue #65)

### **Environment Parity Problems**
**Symptoms**: CI passes, local fails OR CI fails, local works
**Root Cause**: Different dependency resolution

```bash
# WRONG: Local development
npm install  # Uses flexible resolution

# RIGHT: Reproduce CI exactly
rm -rf node_modules package-lock.json
npm ci  # Uses strict lockfile resolution
```

### **Version Dependencies Critical Check**
```bash
# Must be 4.0.0+ or deployment will fail silently
npx wrangler --version

# Pre-deployment validation sequence
npm run build
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run
```

### **Configuration Validation Checklist**
1. **Package.json name**: Must match worker name exactly
2. **Assets directory**: `wrangler.toml` must match frontend build output
3. **Deployment type**: Verify Workers (not Pages) in Cloudflare dashboard
4. **Environment files**: `.dev.vars` must exist with required secrets

---

## TypeScript Build Failures (Issue #67)

### **Progressive Problem-Solving Approach**
**CRITICAL**: Fix syntax errors before type issues

```typescript
// WRONG: Unsafe type assertions
const count = result.count as number;
const user = data as User;

// RIGHT: Runtime-safe conversions  
const count = Number(result?.count) || 0;
const name = String(user?.name) || 'Unknown';
const items = Array.isArray(data) ? data : [];

// Safe enum validation
const severity = (['low','medium','high'].includes(event.severity) 
  ? event.severity 
  : 'medium') as 'low' | 'medium' | 'high';
```

### **D1 Database Safe Patterns**
```typescript
// Database result handling (D1 returns unknown types)
const row = result as Record<string, unknown>;
const safeField = String(row.field_name || '');
const safeId = Number(row.id) || 0;
```

### **Build vs Type-Check Philosophy**
```bash
# PRIORITY 1: Get builds working
npm run build  # Must succeed first

# PRIORITY 2: Validate deployment
npx wrangler versions upload --dry-run

# PRIORITY 3: Improve types gradually
npx tsc --noEmit  # Fix when practical, don't block builds
```

---

## Cloudflare Pages vs Workers (July 2025)

### **Architecture Distinction**
- **Workers**: Serverless functions WITH assets (our architecture)
- **Pages**: Static sites (NOT our architecture)

### **Warning Signs of Misconfiguration**
❌ Complex multi-step builds when simple `wrangler deploy` should work
❌ Asset deployment failures
❌ Dashboard showing "Pages" instead of "Workers"

### **Fix Procedure**
1. Check Cloudflare dashboard: Should show "Workers" deployment type
2. Verify `wrangler.toml` assets directory matches build output
3. Use `wrangler deploy` (not Pages deployment commands)

---

## Google OAuth Implementation (Issue #105)

### **JWT-Signed State Tokens Pattern**
```typescript
// Use existing JWT infrastructure for OAuth state
const stateToken = await jwt.sign(
  { 
    nonce: crypto.randomUUID(),
    returnUrl: sanitizedReturnUrl,
    exp: Math.floor(Date.now() / 1000) + 600  // 10 minutes
  }, 
  JWT_SECRET
);
```

### **Multi-Layered Rate Limiting**
```typescript
const OAUTH_RATE_LIMITS = {
  general: { requests: 30, windowMs: 15 * 60 * 1000 },    // 30/15min
  failures: { requests: 15, windowMs: 15 * 60 * 1000 },   // 15 fails/15min  
  critical: { requests: 10, windowMs: 5 * 60 * 1000 }     // 10 fails/5min
};
```

### **State Validation Critical Checks**
- 10-minute expiration with nonce verification
- Validate return URLs to prevent open redirect attacks
- Check JWT signature before processing callback

---

## Project Naming & JWT Test Consistency

### **Package.json Synchronization**
```json
{
  "name": "cutty",  // Must match worker name exactly
  "scripts": {
    "deploy:dev": "wrangler deploy",
    "deploy:prod": "wrangler deploy --config wrangler.prod.toml"
  }
}
```

### **JWT Test Mock Patterns**
```typescript
// WRONG: Type mismatches cause test failures
const mockUser = { id: 1, name: 'test' };  

// RIGHT: Match TypeScript interfaces exactly
const mockUser = { id: '1', name: 'test' };
```

---

## Essential Pre-Commit Commands

### **Critical Validation Sequence**
```bash
# 1. Version check (MUST be 4.0.0+)
npx wrangler --version

# 2. Type checking
npx tsc --noEmit

# 3. Build validation
npm run build

# 4. Deployment validation
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run

# 5. Test execution
npm test
```

### **OAuth Development Setup**
```bash
# Secret management (run once per environment)
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET  
wrangler secret put GOOGLE_REDIRECT_URI
wrangler secret put JWT_SECRET
wrangler secret put API_KEY_SALT

# Database migration
wrangler d1 execute cutty-dev --file=migrations/[latest].sql

# Rate limiting testing
for i in {1..35}; do curl 'http://localhost:8787/api/v1/auth/google'; done
```

---

## Common Issue Patterns

### **"Internal Server Error" (Deployment)**
**Cause**: Usually binding or configuration mismatch
**Fix**: Clean install + dry-run validation
```bash
rm -rf node_modules package-lock.json && npm ci
npx wrangler versions upload --dry-run
```

### **"Invalid redirect_uri" (OAuth)**
**Cause**: URL mismatch between code and Google Console
**Fix**: Exact URL verification
```bash
# Check current configuration
wrangler secret list | grep GOOGLE

# Test endpoint locally
curl 'http://localhost:8787/api/v1/auth/google'
```

### **"State parameter mismatch" (OAuth)**
**Cause**: JWT_SECRET missing or system time sync issues
**Fix**: Verify JWT configuration and system time

### **TypeScript Build Sudden Failures**
**Cause**: Analytics Engine in test config or dependency version mismatch
**Fix**: 
1. Comment out Analytics Engine in vitest.config.ts
2. Use safe type conversions instead of assertions
3. Clean install dependencies

---

## Visual Debugging with Screenshots

### **MCP Screenshot Tool for Frontend Debugging**
Use the `mcp__screenshot-website-fast__take_screenshot` tool to capture visual state for debugging:

```bash
# Local development debugging
# URL: http://localhost:5173
# Use when: Frontend issues, styling problems, component rendering issues

# Dev deployment debugging  
# URL: https://cutty-dev.emilycogsdill.com
# Use when: Environment-specific issues, deployment verification
```

### **Screenshot Debugging Workflow**
1. **Before/After Comparisons**: Take screenshots before implementing changes
2. **Cross-Environment Validation**: Compare local vs dev deployment rendering
3. **Bug Report Documentation**: Include screenshots when reporting frontend issues
4. **Responsive Testing**: Capture different viewport sizes using width parameter

### **Common Screenshot Use Cases**
- **Authentication Flow**: Capture OAuth login/callback pages
- **Dashboard Rendering**: Verify chart and data visualization display
- **Mobile Responsiveness**: Test layout at different screen sizes
- **Error States**: Document how errors appear to users
- **Component Styling**: Debug CSS issues across environments

### **Local Authentication Testing**
For local development and testing:
```
Username: test
Password: aoeusnth
```
**Use when**: Testing authentication flows, user-specific features, or any functionality requiring login during local development.

---

## Emergency Procedures

### **Rollback Procedure**
```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

### **Health Check Sequence**
```bash
# API health
curl https://cutty.emilycogsdill.com/api/health
curl https://cutty-dev.emilycogsdill.com/api/health

# OAuth health  
curl https://cutty.emilycogsdill.com/api/v1/auth/google

# Database connectivity
wrangler d1 execute cutty-dev --command "SELECT COUNT(*) FROM users"
```

---

## Key Lessons Learned

1. **Always reproduce CI environment locally** before debugging
2. **Workers deployment ≠ Pages deployment** (different build commands)
3. **Test mocks must match TypeScript interfaces exactly**
4. **Multi-layered problems require systematic layer-by-layer fixes**
5. **Build success > type perfection** during development
6. **Package.json name must match worker name** for consistency
7. **Analytics Engine MUST be disabled in tests** (no exceptions)
8. **JWT_SECRET is critical** for OAuth and authentication functionality

---

*This knowledge represents debugging experience gained through multiple production issues and should be consulted before major changes.*