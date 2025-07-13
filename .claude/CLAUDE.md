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

## Subagent Archetypes & Workflow
@include .claude/subagents.yml#SubagentArchetypes
@include .claude/subagents.yml#SubagentSelection
@include .claude/project-config.yml#CommitStandards
@include .claude/project-config.yml#SubagentWorkflow

## Debugging Lessons Learned
@include .claude/debugging-lessons.yml#WranglerDeploymentIssues
@include .claude/debugging-lessons.yml#TypeScriptBuildFailures
@include .claude/debugging-lessons.yml#CloudflarePagesVsWorkersDeployment
@include .claude/debugging-lessons.yml#JWTTestTypeConsistency

## Essential Development Commands
@include .claude/development-commands.yml#PreCommitValidation
@include .claude/development-commands.yml#TroubleshootingCommands
@include .claude/development-commands.yml#BuildSuccessCriteria
@include .claude/development-commands.yml#CronTriggerDeployment

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

# Build and validate (automated pre-commit, manual for deployment)
npm run build && npx wrangler versions upload --dry-run

# Deploy to staging
wrangler deploy --env=staging

# Deploy cron triggers (priority triggers)
wrangler triggers deploy --cron "*/5 * * * *"  # Metrics & alerts every 5 min
wrangler triggers deploy --cron "*/1 * * * *"  # Security monitoring every minute  
wrangler triggers deploy --cron "0 2 * * *"    # Daily backup at 2 AM
wrangler triggers deploy --cron "0 6 * * *"    # Storage cleanup at 6 AM
wrangler triggers deploy --cron "0 */6 * * *"  # Cost calculation every 6 hours

# Verify cron triggers
wrangler triggers list
```

## Automated Pre-Commit Validation
- **Husky Integration**: Pre-commit hook automatically runs on `git commit`
- **Validation Steps**: Wrangler v4+ check, TypeScript types, build verification
- **Purpose**: Prevents common issues that cause test failures and deployment problems

## GitHub Issue Management

### Issue Creation Policy
**CRITICAL RULE: When user requests GitHub issue creation:**
- ALWAYS use `gh issue create` command via Bash tool
- NEVER create markdown files for issues
- Use inline body content with HEREDOC for proper formatting
- Include appropriate labels and assignees when specified
- AUTO-CREATE missing labels using fallback commands (see github-config.yml)

### GitHub CLI Commands for Issues
```bash
# Create issue with title and body
gh issue create --title "Issue Title" --body "$(cat <<'EOF'
Issue description here...

## Steps to Reproduce
1. Step one
2. Step two

## Expected Behavior
What should happen

## Actual Behavior  
What actually happens
EOF
)"

# Create issue with labels (auto-creates missing labels)
gh issue create --title "Bug: Description" --label "bug,priority:high" --body "Description" || {
    echo "Creating missing labels..."
    gh label create "bug" --color "d73a4a" --description "Something isn't working" || true
    gh label create "priority:high" --color "b60205" --description "High priority item" || true
    gh issue create --title "Bug: Description" --label "bug,priority:high" --body "Description"
}

# Create issue and assign
gh issue create --title "Feature: Description" --assignee "@me" --body "Description"
```

### Label Auto-Creation Strategy
When issue creation fails due to missing labels, automatically create common labels:
```bash
# Create standard project labels
gh label create "bug" --color "d73a4a" --description "Something isn't working"
gh label create "enhancement" --color "a2eeef" --description "New feature or request"
gh label create "priority:high" --color "b60205" --description "High priority"
gh label create "priority:medium" --color "fbca04" --description "Medium priority"  
gh label create "priority:low" --color "0e8a16" --description "Low priority"
gh label create "wrangler" --color "7057ff" --description "Cloudflare Wrangler related"
gh label create "deployment" --color "1d76db" --description "Deployment related"
```

### GitHub Configuration
@include .claude/github-config.yml#GitHubLabels
@include .claude/github-config.yml#LabelPatterns
