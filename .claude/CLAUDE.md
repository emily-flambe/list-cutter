# Claude Code Project Configuration

Comprehensive configuration for the Cutty (List Cutter) application - a Django to Cloudflare Workers migration project.

## Quick Navigation

### 🚀 Development Workflows
- [Development Commands](.claude/commands/dev.md) - Local setup, build, and dev servers
- [Testing Procedures](.claude/commands/test.md) - Test execution, coverage, and debugging
- [Deployment Processes](.claude/commands/deploy.md) - Environment deployment and validation
- [Troubleshooting Guide](.claude/commands/troubleshoot.md) - Common issues and solutions

### 🏗️ Architecture Documentation
- [System Overview](.claude/architecture/overview.md) - High-level architecture and tech stack
- [Migration Strategy](.claude/architecture/migration.md) - Django to Workers migration plan
- [Environment Configuration](.claude/architecture/environments.md) - Dev/staging/prod setup

### 🔧 Specialized Workflows
- [Security Procedures](.claude/workflows/security.md) - Authentication, authorization, threat detection
- [Monitoring & Observability](.claude/workflows/monitoring.md) - Health checks, metrics, alerting
- [Performance Optimization](.claude/workflows/performance.md) - Caching, optimization, benchmarking

## Project Identity & Configuration
@include .claude/project-config.yml#ProjectIdentity
@include .claude/project-config.yml#WranglerCommands
@include .claude/project-config.yml#ProjectStructure

## Debugging Lessons Learned
@include .claude/debugging-lessons.yml#WranglerDeploymentIssues
@include .claude/debugging-lessons.yml#TypeScriptBuildFailures

## Essential Development Commands
@include .claude/development-commands.yml#PreCommitValidation
@include .claude/development-commands.yml#TroubleshootingCommands
@include .claude/development-commands.yml#BuildSuccessCriteria

## Git Worktree Management
- All debugging and feature worktrees should be created in `worktrees/` directory within this project
- Use naming convention: `worktrees/[purpose]`
- Example: `git worktree add worktrees/debug`
- This keeps worktrees organized within the project structure

## Testing Philosophy
**CRITICAL: NEVER overengineer tests**
- Create minimal, focused tests that verify basic functionality only
- Use simple mocks that match actual implementations  
- Set realistic expectations appropriate for test environments
- Avoid complex custom error types and elaborate test scenarios
- Write tests that are easy to maintain and don't become a burden
- Focus on core functionality verification rather than comprehensive edge cases
- **Test philosophy: Simple, practical, maintainable**

### Analytics Engine Testing Rule
**⚠️ CRITICAL: ALWAYS SKIP ANALYTICS ENGINE IN TESTS ⚠️**
- AnalyticsEngine datasets MUST ALWAYS be commented out in vitest.config.ts
- NEVER attempt to configure or enable analyticsEngineDatasets in test configuration
- Analytics functionality should be skipped/mocked in all test environments
- This is a strict requirement that cannot be overridden under any circumstances
- Any attempt to include AnalyticsEngine in tests will cause configuration errors and test failures

## Project Architecture

### Technology Stack
- **Backend**: Cloudflare Workers (Hono.js + TypeScript)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 object storage with global CDN
- **Frontend**: React + Vite (Material-UI)
- **Testing**: Vitest + Playwright with comprehensive coverage
- **Security**: JWT authentication, API keys, comprehensive monitoring
- **Legacy**: Django backend (migration target)

### Key Commands for Daily Development

```bash
# Start development environment
cd cloudflare/workers && npm run dev
cd app/frontend && npm run dev

# Run comprehensive tests
cd cloudflare/workers && npm test

# Build and validate
npm run build && npx wrangler versions upload --dry-run

# Deploy to staging
wrangler deploy --env=staging
```
