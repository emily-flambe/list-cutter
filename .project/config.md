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

## Debugging & Troubleshooting
<!-- Hard-earned tribal knowledge and debugging procedures -->
See: .project/contexts/debugging-lessons.md
See: .project/contexts/troubleshooting.md
See: .project/contexts/development-workflows.md

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

### 🚨 CRITICAL: Git Worktree Management 🚨
- **MANDATORY**: New worktrees MUST ONLY be created in the `worktrees/` folder
- **NEVER** create worktrees anywhere else in the project structure
- **ALWAYS** use: `git worktree add worktrees/branch-name branch-name`
- **FORBIDDEN**: Creating worktrees outside the designated `worktrees/` directory
- This ensures clean project organization and prevents conflicts

### Critical Requirements
- **Wrangler v4.0.0+** required for all operations
- `.dev.vars` must exist with JWT_SECRET and API_KEY_SALT
- Analytics Engine MUST be disabled in tests (vitest.config.ts)
- Test mocks must match TypeScript interfaces exactly

### 🚨 DEPLOYMENT NAMING - ABSOLUTELY CRITICAL 🚨
- **WORKERS**: Only 2 workers exist - `cutty-dev` (dev) and `cutty` (prod)
- **DATABASES**: Only 2 databases exist - `cutty-dev` (dev) and `cutty-prod` (prod)
- **NO STAGING**: There is NO staging environment, never has been, never will be
- **LOCAL DEVELOPMENT**: MUST use `cutty-dev` worker with `--remote` flag
- **FORBIDDEN**: Creating local databases, additional workers, or any staging variants
- **DEPLOYMENT COMMANDS**:
  - DEV: `wrangler deploy` (uses cutty-dev worker)
  - PROD: `wrangler deploy --config wrangler.prod.toml` (uses cutty worker)
- **100% COMPLIANCE REQUIRED**: Any deviation from these names will break the system

### Tool-Specific Instructions

#### Claude Code
- Use the simplified 3-persona system (Builder 🔨, Guardian 🛡️, Guide 📖)
- Commit format: `[Persona] 🔸 Brief description`
- Reference `.project/config.md` for project context
- Leverage artifacts for substantial code generation

##### Subagent Usage (Claude Code Specific)
- **Deploy subagents liberally** - Use them frequently for complex tasks
- **Cute animal names required** - Always give subagents adorable animal names
- **Emojis mandatory** - Include relevant animal emojis with names
- **Examples**: "🐸 Freddy the Frog", "🦝 Ranger the Raccoon", "🐿️ Squirrel Scout"
- **When to use**: Multi-step tasks, research, complex debugging, file searches

#### Gemini CLI
- Use GEMINI.md symlink for automatic context loading
- Leverage MCP servers when available
- Use built-in tools for file operations
- Reference unified settings.json for consistency

#### Other Agents
- Follow the unified configuration in `.project/`
- Respect project-specific conventions
- Use modular context files for detailed information

## 🚨 ENVIRONMENT CONFIGURATION - CRITICAL COMPLIANCE 🚨

### Development Environment
- **Worker**: `cutty-dev` (EXACT NAME - NO VARIATIONS)
- **Database**: `cutty-dev` (EXACT NAME - NO VARIATIONS)
- **Domain**: `cutty-dev.emilycogsdill.com`
- **Local Dev**: MUST use `--remote` with `cutty-dev` worker

### Production Environment
- **Worker**: `cutty` (EXACT NAME - NO VARIATIONS)
- **Database**: `cutty-prod` (EXACT NAME - NO VARIATIONS)
- **Domain**: `cutty.emilycogsdill.com`

### 🚫 FORBIDDEN ENVIRONMENTS
- **NO STAGING**: There is no staging environment
- **NO LOCAL DB**: Never create local databases
- **NO VARIANTS**: No staging, test, local, or other environment names
- **NO EXCEPTIONS**: These are the ONLY 2 environments that exist

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