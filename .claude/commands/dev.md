# Development Workflows

## Local Development Commands

### Start Development Environment
```bash
# Backend (Cloudflare Workers)
cd cloudflare/workers
npm install
npm run dev

# Frontend (React)
cd app/frontend
npm install
npm run dev

# Legacy Django (if needed)
cd app
poetry install
poetry run python manage.py runserver
```

### Pre-Commit Validation
@include ../.claude/development-commands.yml#PreCommitValidation

## Build Verification
@include ../.claude/development-commands.yml#BuildSuccessCriteria

## Testing Commands
```bash
cd cloudflare/workers

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:auth
npm run test:performance
npm run test:e2e

# Run security tests
npm test tests/security/

# Performance benchmarks
npm run test:benchmark
```

## Development Server Health Checks
```bash
# Workers health
curl http://localhost:8787/health

# Workers auth health  
curl http://localhost:8787/health/auth

# Frontend (typically port 5173)
curl http://localhost:5173
```

## Common Development Tasks

### Database Operations
```bash
cd cloudflare/workers

# Create database
wrangler d1 create cutty-dev

# Run migrations
wrangler d1 execute cutty-dev --file=migrations/0001_initial_schema.sql

# Check database
wrangler d1 list
```

### R2 Storage Operations
```bash
# Create bucket
wrangler r2 bucket create cutty-files-dev

# Configure CORS
wrangler r2 bucket cors put cutty-files-dev --file=../cors.json

# List buckets
wrangler r2 bucket list
```

### Troubleshooting
@include ../.claude/development-commands.yml#TroubleshootingCommands