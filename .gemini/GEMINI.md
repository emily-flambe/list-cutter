# Cutty (List Cutter) - Project Configuration

<!-- 
Include unified configuration from .project/config.md
This maintains single source of truth while providing Gemini CLI with required GEMINI.md file
-->

## Project Overview
Modern web application for list management and CSV processing built on Cloudflare's edge computing platform. Features Cloudflare Workers backend, D1 database, R2 storage, and React frontend.

## Architecture
- **Frontend**: React 18 (Vite)
- **Backend**: Cloudflare Workers + Hono.js  
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 (S3-compatible object storage)

## 🚨 CRITICAL: Environment Configuration
- **DEV**: worker `cutty-dev` → database `cutty-dev` → `cutty-dev.emilycogsdill.com`
- **PROD**: worker `cutty` → database `cutty-prod` → `cutty.emilycogsdill.com`
- **NO STAGING**: There is no staging environment, never has been, never will be
- **LOCAL DEV**: MUST use `wrangler dev --remote` with cutty-dev worker

## Quick Start Commands

### Development
```bash
# Backend (Cloudflare Workers)
cd cloudflare/workers && npm run dev

# Frontend (React)
cd app/frontend && npm run dev

# Testing
cd cloudflare/workers && npm test
```

### Deployment
```bash
# Development environment
wrangler deploy

# Production environment  
wrangler deploy --config wrangler.prod.toml
```

## 🚨 CRITICAL: Git Worktree Management
- **MANDATORY**: New worktrees MUST ONLY be created in the `worktrees/` folder
- **COMMAND**: `git worktree add worktrees/branch-name branch-name`
- **FORBIDDEN**: Creating worktrees anywhere else in the project structure

## AI Assistant Guidelines

### For All Assistants
- Follow TypeScript strict mode and type safety
- Prioritize build success over perfect type compliance
- Use simple, maintainable test patterns
- Prefer editing existing files over creating new ones
- Keep configurations simple and focused
- Include comprehensive error handling
- Use safe type conversions: `Number(value) || 0`

### Critical Requirements
- **Wrangler v4.0.0+** required for all operations
- `.dev.vars` must exist with JWT_SECRET and API_KEY_SALT
- Analytics Engine MUST be disabled in tests (vitest.config.ts)
- Test mocks must match TypeScript interfaces exactly

## Gemini CLI Specific

### Memory Management
- Use `/memory refresh` to reload project context after changes
- Use `/memory show` to view current loaded context
- Context is loaded hierarchically from global → project → local

### MCP Integration
- Leverage MCP servers when available for enhanced functionality
- Use built-in tools for file operations when possible

### Settings
- Project-specific settings in `.gemini/settings.json`
- Global settings in `~/.gemini/settings.json`

## Common Troubleshooting

### Deployment Issues
```bash
# Clean install matching CI
rm -rf node_modules package-lock.json && npm ci

# Verify deployment
npx wrangler versions upload --dry-run
```

### OAuth Problems
- Verify all OAuth secrets are set
- Check redirect URI matches Google Console
- Ensure JWT_SECRET is configured

### TypeScript Errors
- Focus on build success first
- Use safe conversions over type assertions
- Disable Analytics Engine in test config

## Security & Authentication
- JWT-based authentication (24h expiry)
- Google OAuth integration
- API key support for programmatic access
- Multi-layered rate limiting

---
*For detailed technical specifications, see: `.project/config.md` and `.project/contexts/`*