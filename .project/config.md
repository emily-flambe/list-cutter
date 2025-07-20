# Project: Cutty (List Cutter)

## Overview
A modern web application for list management and CSV processing built on Cloudflare's edge computing platform. Features Cloudflare Workers backend, D1 database, R2 storage, and React frontend.

## Architecture
<!-- See detailed architecture documentation -->
See: .project/contexts/architecture.md

## Coding Standards
<!-- Language-specific guidelines and conventions -->
See: .project/contexts/coding-standards.md

## Dependencies & Versions
<!-- Framework versions and package requirements -->
See: .project/contexts/dependencies.md

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
- NO STAGING ENVIRONMENT - only dev and production

### Tool-Specific Instructions

#### Claude Code
- Use the simplified 3-persona system (Builder 🔨, Guardian 🛡️, Guide 📖)
- Commit format: `[Persona] 🔸 Brief description`
- Reference `.project/config.md` for project context
- Leverage artifacts for substantial code generation

#### Gemini CLI
- Use GEMINI.md symlink for automatic context loading
- Leverage MCP servers when available
- Use built-in tools for file operations
- Reference unified settings.json for consistency

#### Other Agents
- Follow the unified configuration in `.project/`
- Respect project-specific conventions
- Use modular context files for detailed information

## Environment Configuration

### Development
- Worker: `cutty-dev`
- Database: `cutty-dev`
- Domain: `cutty-dev.emilycogsdill.com`

### Production
- Worker: `cutty`
- Database: `cutty-prod`
- Domain: `cutty.emilycogsdill.com`

## Security & Authentication
- JWT-based authentication (24h expiry)
- Google OAuth integration
- API key support for programmatic access
- Multi-layered rate limiting

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

## Project Philosophy
1. **Simplicity**: Keep configurations minimal and maintainable
2. **Pragmatism**: Build success > type perfection
3. **Consistency**: Follow established patterns
4. **Security**: Defense-in-depth approach
5. **Performance**: Edge-first architecture

---
*Unified AI configuration for Cutty project - Version 1.0.0*