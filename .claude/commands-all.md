# All Commands Reference

## Development

### Start Development
```bash
# Backend
cd cloudflare/workers && npm run dev

# Frontend  
cd app/frontend && npm run dev
```

### Testing
```bash
# Run all tests
cd cloudflare/workers && npm test

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance

# With coverage
npm run test:coverage
```

## Deployment

### Pre-deployment Validation
```bash
# Build and validate
npm run build
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run
```

### Deploy to Environments
```bash
# Development
wrangler deploy

# Production
wrangler deploy --config wrangler.prod.toml
```

### Post-deployment
```bash
# Verify deployment
curl https://cutty.emilycogsdill.com/api/health
curl https://cutty-dev.emilycogsdill.com/api/health

# Check logs
wrangler tail
```

## Database Operations

### Migrations
```bash
# Development
wrangler d1 execute cutty-dev --file=migrations/[migration].sql

# Production
wrangler d1 execute cutty-prod --file=migrations/[migration].sql

# List databases
wrangler d1 list
```

### Queries
```bash
# Execute query
wrangler d1 execute cutty-dev --command "SELECT * FROM users LIMIT 10"

# Backup database
wrangler d1 backup create cutty-prod
```

## OAuth Management

### Setup Secrets
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET  
wrangler secret put GOOGLE_REDIRECT_URI
wrangler secret put JWT_SECRET
wrangler secret put API_KEY_SALT
```

### Verify OAuth
```bash
# List secrets
wrangler secret list

# Test OAuth flow
curl 'http://localhost:8787/api/v1/auth/google'
curl 'https://cutty.emilycogsdill.com/api/v1/auth/google'
```

## Troubleshooting

### Clean Environment
```bash
rm -rf node_modules package-lock.json
npm ci
```

### Check Versions
```bash
npx wrangler --version  # Must be 4.0.0+
node --version
npm --version
```

### Debug Deployment
```bash
# Verbose deploy
wrangler deploy --verbose

# Check worker status
wrangler deployments list

# View logs
wrangler tail --format json
```

## Monitoring

### Health Checks
```bash
# API health
curl /api/health
curl /api/monitoring/metrics
curl /api/monitoring/dashboard

# Database health
curl /api/monitoring/database-health
```

### Performance
```bash
# Run performance tests
npm run test:performance

# Check metrics
curl /api/monitoring/metrics/performance
```

## Emergency Procedures

### Rollback
```bash
# List deployments
wrangler deployments list

# Rollback to previous
wrangler rollback [deployment-id]
```

### Maintenance Mode
```bash
# Enable
wrangler secret put MAINTENANCE_MODE --value "true"

# Disable
wrangler secret put MAINTENANCE_MODE --value "false"
```