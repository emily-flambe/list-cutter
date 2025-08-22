# Troubleshooting Guide

## Quick Diagnostics

### Check These First
1. [ ] Correct Node version? (v18.0.0+)
2. [ ] Dependencies installed? (`npm install`)
3. [ ] Environment variables set? (`.dev.vars` file exists)
4. [ ] Correct Wrangler version? (v4.0.0+)
5. [ ] Database/services running? (`wrangler dev --remote`)

## Common Issues

### Build/Installation Problems

#### Issue: Wrangler version errors
**Symptoms**: "Wrangler is out of date" or binding errors
**Solution**: 
```bash
npm install -g wrangler@latest
npx wrangler --version  # Must be 4.0.0+
```
**Root Cause**: Wrangler v3 incompatible with current D1 bindings

#### Issue: Dependency installation fails
**Symptoms**: npm install errors, module resolution failures
**Solution**:
```bash
# Clean install matching CI
rm -rf node_modules package-lock.json
npm ci
```
**Root Cause**: Lock file inconsistencies or version conflicts

### Runtime Errors

#### Issue: "Internal Server Error" on deployment
**Symptoms**: Deployment succeeds but worker returns 500 errors
**Solution**:
```bash
# Verify configuration
npx wrangler deploy --dry-run

# Check logs
wrangler tail

# Verify secrets are set
wrangler secret list
```
**Root Cause**: Missing environment variables or configuration issues

#### Issue: Database connection errors
**Symptoms**: "D1_ERROR" or "database not found"
**Solution**:
```bash
# Use remote database for local dev
wrangler dev --remote

# Never use --local for D1 databases
```
**Prevention**: Always use `cutty-dev` database with `--remote` flag

### Development Environment

#### Issue: Dev server won't start
**Common Causes**:
1. Port already in use (8787 for backend, 5173 for frontend)
2. Missing environment variables
3. Incorrect Node version

**Solutions**:
```bash
# Kill process on port
lsof -ti:8787 | xargs kill
lsof -ti:5173 | xargs kill

# Copy environment template
cp .project/.env.example .dev.vars

# Use correct Node version
nvm use 18
```

#### Issue: Frontend changes not showing
**Symptoms**: Made changes but browser shows old version
**Solution**:
```bash
# Frontend requires explicit build before deploy
make build-frontend  # Build React app
make deploy-dev      # Then deploy

# For local development, ensure Vite is running
cd app/frontend && npm run dev
```
**Root Cause**: Frontend assets must be built before deployment

### Authentication Issues

#### Issue: OAuth "Invalid redirect_uri"
**Symptoms**: Google OAuth fails with redirect error
**Solution**:
1. Verify redirect URI in Google Console matches exactly:
   - Local: `http://localhost:8787/api/v1/auth/google/callback`
   - Dev: `https://cutty-dev.emilycogsdill.com/api/v1/auth/google/callback`
   - Prod: `https://cutty.emilycogsdill.com/api/v1/auth/google/callback`
2. Update secret if needed:
   ```bash
   wrangler secret put GOOGLE_REDIRECT_URI
   ```

#### Issue: JWT authentication failures
**Symptoms**: 401 errors after login
**Check**:
1. JWT_SECRET is set in environment
2. Token expiry (24 hours)
3. Correct Authorization header format: `Bearer [token]`

### Performance Issues

#### Issue: Slow API responses
**Diagnosis**:
```bash
# Check worker metrics
wrangler tail --format pretty

# Monitor CPU time
# Should be < 10ms per request
```
**Solutions**:
1. Implement caching for repeated queries
2. Optimize database queries (add indexes)
3. Use KV for session storage instead of D1

### Deployment Issues

#### Issue: Production deploy fails
**Check**:
```bash
# Verify production config
cat wrangler.prod.toml

# Test deployment dry-run
wrangler deploy --config wrangler.prod.toml --dry-run

# Check production secrets
wrangler secret list --config wrangler.prod.toml
```

#### Issue: Assets not deploying
**Symptoms**: API works but frontend shows 404
**Solution**:
```bash
# Verify assets built
ls -la app/frontend/dist/

# Check wrangler.toml assets config
# Should have:
# [site]
# bucket = "./app/frontend/dist"

# Rebuild and deploy
make build
make deploy-dev
```

### Database Issues

#### Issue: Migration failures
**Symptoms**: "table already exists" or "no such table"
**Solution**:
```bash
# List applied migrations
wrangler d1 migrations list cutty-dev

# Apply pending migrations
wrangler d1 migrations apply cutty-dev

# For production (careful!)
wrangler d1 migrations apply cutty-prod
```

#### Issue: Data not persisting
**Check**:
1. Using correct database (`cutty-dev` or `cutty-prod`)
2. Transactions committing properly
3. No errors in wrangler tail logs

## Debug Commands

```bash
# View real-time logs
wrangler tail

# Check worker status
curl https://cutty-dev.emilycogsdill.com/api/v1/health

# Test database connection
wrangler d1 execute cutty-dev --command="SELECT 1"

# View secret list (not values)
wrangler secret list

# Validate deployment
npx wrangler versions upload --dry-run
```

## Known Issues

### Issue #133: Duplicate File Content
**Status**: Open
**Symptoms**: Multiple synthetic data generations produce identical content
**Workaround**: Refresh page between generations
**Tracking**: See `.project/known_issues/issue-133-duplicate-file-content.md`

## Getting Help

If not resolved:
1. Check GitHub issues: https://github.com/[your-repo]/issues
2. Review recent commits for changes
3. Provide when asking for help:
   - Exact error message
   - Steps to reproduce
   - Environment (local/dev/prod)
   - Recent changes made
   - Output of `wrangler tail`

## Prevention Tips

1. **Always use `--remote` for local development**
2. **Build frontend before deploying**
3. **Keep Wrangler at v4.0.0+**
4. **Test locally before deploying**
5. **Check logs with `wrangler tail` when debugging**
6. **Verify secrets are set for each environment**
7. **Use exact environment names (cutty-dev, cutty-prod)**

---

*When in doubt, check the logs: `wrangler tail`*