# Cutty (List Cutter) - Simplified Claude Configuration

## 🚨 Critical Environment Configuration
- **DEV**: worker cutty-dev → database cutty-dev → cutty-dev.emilycogsdill.com
- **PROD**: worker cutty → database cutty-prod → cutty.emilycogsdill.com
- **NO STAGING ENVIRONMENT**

## Project Overview
Django to Cloudflare Workers migration project with:
- **Backend**: Cloudflare Workers (Hono.js + TypeScript)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 object storage
- **Frontend**: React + Vite (Material-UI)
- **Auth**: JWT + Google OAuth

## Quick Start Commands

```bash
# Development
cd cloudflare/workers && npm run dev
cd app/frontend && npm run dev

# Testing
cd cloudflare/workers && npm test

# Build & Validate
npm run build && npx wrangler versions upload --dry-run

# Deploy
wrangler deploy                          # Development
wrangler deploy --config wrangler.prod.toml  # Production

# OAuth Setup
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REDIRECT_URI
```

## Subagent System
Three core personas for development:

1. **Builder** 🔨 - Architecture, features, implementation
2. **Guardian** 🛡️ - Quality, security, operations
3. **Guide** 📖 - Documentation, communication

Commit format: `[Persona] 🔸 Brief description`

## Key Development Rules

### Critical Requirements
- Wrangler v4.0.0+ required
- `.dev.vars` must exist with JWT_SECRET and API_KEY_SALT
- Analytics Engine MUST be disabled in tests
- Test mocks must match TypeScript interfaces exactly

### GitHub Issues
- Use `gh issue create` directly (no templates)
- Common labels: bug, enhancement, priority:high/medium/low, security, performance

### Testing Philosophy
- Simple, practical, maintainable tests
- Focus on core functionality
- Avoid over-engineering

### File Management
- ALWAYS prefer editing existing files over creating new ones
- NEVER create documentation unless explicitly requested
- Use simple file structures

## Common Troubleshooting

### Deployment Fails
```bash
# Clean install matching CI
rm -rf node_modules package-lock.json && npm ci

# Verify deployment
npx wrangler versions upload --dry-run
```

### OAuth Issues
- Verify secrets: `wrangler secret list | grep GOOGLE`
- Check redirect URI matches Google Console exactly
- Test: `curl 'http://localhost:8787/api/v1/auth/google'`

### TypeScript Errors
- Focus on build success over perfect types
- Use safe conversions: `Number(value) || 0`
- Disable Analytics Engine in vitest.config.ts

## Database Migrations
```bash
# Development
wrangler d1 execute cutty-dev --file=migrations/[file].sql

# Production
wrangler d1 execute cutty-prod --file=migrations/[file].sql
```

## Key Lessons Learned
1. Workers deployment ≠ Pages deployment
2. Always reproduce CI environment locally
3. Multi-layered problems need systematic fixes
4. Build success > type perfection
5. Keep configurations simple and maintainable

---
*Simplified configuration - See additional files for detailed commands and troubleshooting*