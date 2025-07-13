# Troubleshooting Guide

## Prerequisites Check

### Wrangler Version Validation
```bash
# Check Wrangler version (must be 4.0.0 or higher)
npx wrangler --version

# If below v4, update to latest
npm install wrangler@latest

# Verify installation
npx wrangler --version
```

**Critical**: Wrangler v4+ is required for proper binding syntax and deployment features. Versions below 4.0.0 will cause deployment failures.

## Common Issues & Solutions

### Wrangler Deployment Issues
@include ../.claude/debugging-lessons.yml#WranglerDeploymentIssues

### TypeScript Build Failures  
@include ../.claude/debugging-lessons.yml#TypeScriptBuildFailures

## Quick Diagnostic Commands

### Environment Check
```bash
cd cloudflare/workers

# Check versions
node --version
npm --version
wrangler --version  # Must be 4.0.0+

# Check authentication
wrangler whoami

# Check project bindings
wrangler d1 list
wrangler r2 bucket list
```

### Build Troubleshooting
@include ../.claude/development-commands.yml#TroubleshootingCommands

### Clean Environment Reset
```bash
cd cloudflare/workers

# Clean install (matches CI)
rm -rf node_modules package-lock.json
npm ci

# Verify build
npm run build

# Test deployment
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run
```

## Application-Specific Issues

### Database Connection Problems
```bash
# Check database existence
wrangler d1 list

# Test database connection
wrangler d1 execute cutty-dev --command="SELECT 1;"

# Check database schema
wrangler d1 execute cutty-dev --command="SELECT name FROM sqlite_master WHERE type='table';"

# Run missing migrations
wrangler d1 execute cutty-dev --file=migrations/0001_initial_schema.sql
```

### R2 Storage Issues
```bash
# Check bucket existence
wrangler r2 bucket list

# Test bucket access
wrangler r2 object list cutty-files-dev

# Check CORS configuration
wrangler r2 bucket cors get cutty-files-dev

# Fix CORS if needed
wrangler r2 bucket cors put cutty-files-dev --file=../cors.json
```

### Authentication Problems
```bash
# Check JWT secret
wrangler secret list --env=development

# Test auth endpoints
curl -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Check security middleware
npm test tests/security/jwt-security.test.ts
```

### Performance Issues
```bash
# Run performance tests
npm run test:performance

# Check cache performance
npm test tests/performance/concurrent-operations.test.ts

# Monitor resource usage
wrangler tail --env=development

# Benchmark critical paths
npm run test:benchmark
```

## Development Environment Issues

### Port Conflicts
```bash
# Check port usage
lsof -i :8787  # Wrangler default
lsof -i :5173  # Vite default

# Kill processes if needed
kill -9 $(lsof -t -i:8787)
```

### Module Resolution Problems
```bash
# Check TypeScript configuration
npx tsc --showConfig

# Verify imports
npx tsc --noEmit

# Check for missing dependencies
npm ls
```

### Hot Reload Issues
```bash
# Restart development servers
pkill -f "wrangler dev"
pkill -f "vite"

# Clear development cache
rm -rf .wrangler/
rm -rf node_modules/.vite/
```

## Testing Issues

### Test Failures
```bash
# Run single test file
npx vitest run tests/specific-test.test.ts

# Debug with verbose output
npx vitest run --reporter=verbose

# Check test environment
NODE_ENV=test npm test

# Clear test cache
npx vitest run --no-cache
```

### E2E Test Problems
```bash
# Install Playwright browsers
npx playwright install

# Run in headed mode for debugging
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug

# Check test environment setup
npx playwright test --list
```

### Mock Issues
```bash
# Clear Vitest cache
npx vitest run --no-cache

# Check mock implementations
# Ensure mocks match actual service interfaces

# Verify test isolation
# Check for test state bleeding between tests
```

## Production Issues

### Health Check Failures
```bash
# Test health endpoints
curl https://cutty.emilycogsdill.com/health
curl https://cutty.emilycogsdill.com/health/auth

# Check worker logs
wrangler tail --env=production

# Check metrics
wrangler analytics --env=production
```

### File Upload Problems
```bash
# Test file upload endpoint
curl -X POST https://cutty.emilycogsdill.com/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.csv"

# Check R2 bucket permissions
wrangler r2 bucket cors get cutty-files-prod

# Monitor file processing
wrangler tail --env=production --grep="file"
```

### Security Incidents
```bash
# Check security logs
wrangler tail --env=production --grep="security"

# Review failed authentication attempts
curl https://cutty.emilycogsdill.com/dashboard/security

# Check rate limiting
curl -I https://cutty.emilycogsdill.com/api/files/upload

# Emergency: Block IP if needed
# Update security middleware with IP blocks
```

## Emergency Procedures

### Immediate Rollback
```bash
# List recent deployments
wrangler deployments list --env=production

# Rollback to last known good version
wrangler rollback --env=production

# Verify rollback success
curl https://cutty.emilycogsdill.com/health
```

### Maintenance Mode
```bash
# Deploy maintenance page
# Update worker to return 503 with maintenance message

# Notify users
# Update status page or send notifications

# Monitor for resolution
# Continue troubleshooting while in maintenance
```

### Data Recovery
```bash
# List available backups
wrangler d1 backup list cutty-prod

# Restore from backup if needed
wrangler d1 backup restore cutty-prod --backup-id=BACKUP_ID

# Export critical data
wrangler d1 execute cutty-prod --output=csv --command="SELECT * FROM users;"
```

## Getting Help

### Internal Resources
- Check recent commit messages for similar issues
- Review deployment logs in GitHub Actions
- Consult phase documentation in `docs/`

### External Resources
- Cloudflare Workers documentation
- Wrangler CLI documentation  
- Hono.js framework documentation
- Vitest testing framework docs

### Escalation Path
1. Check this troubleshooting guide
2. Review relevant debugging lessons
3. Test in clean environment
4. Document new issues for future reference