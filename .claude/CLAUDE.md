# Claude Code Project Configuration

# 🚨🚨🚨 CRITICAL ENVIRONMENT CONFIGURATION 🚨🚨🚨
# ⚠️  DEVELOPMENT: worker cutty-dev → database cutty-dev → route cutty-dev.emilycogsdill.com
# ⚠️  PRODUCTION: worker cutty → database cutty-prod → route cutty.emilycogsdill.com
# ⚠️  NO STAGING ENVIRONMENT EXISTS
# 🚨🚨🚨 NEVER FORGET THIS CONFIGURATION 🚨🚨🚨

Comprehensive configuration for the Cutty (List Cutter) application - a Cloudflare Workers application.

## Quick Navigation

### 🚀 Development Workflows
- [Development Commands](.claude/commands/dev.md) - Local setup, build, and dev servers
- [Testing Procedures](.claude/commands/test.md) - Test execution, coverage, and debugging
- [Deployment Processes](.claude/commands/deploy.md) - Environment deployment and validation
- [Troubleshooting Guide](.claude/commands/troubleshoot.md) - Common issues and solutions

### 🏗️ Architecture Documentation
- [System Overview](.claude/architecture/overview.md) - High-level architecture and tech stack
- [Environment Configuration](.claude/architecture/environments.md) - Development/production setup

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
@include .claude/debugging-lessons.yml#GoogleOAuthImplementation

## Essential Development Commands
@include .claude/development-commands.yml#PreCommitValidation
@include .claude/development-commands.yml#TroubleshootingCommands
@include .claude/development-commands.yml#BuildSuccessCriteria
@include .claude/development-commands.yml#CronTriggerDeployment

## Google OAuth Development Commands
@include .claude/development-commands.yml#OAuthDevelopmentCommands
@include .claude/development-commands.yml#OAuthProductionCommands
@include .claude/development-commands.yml#OAuthTroubleshooting

## Git Worktree Management
**CRITICAL: ALL worktrees MUST be created in `worktrees/` directory**
- All debugging and feature worktrees should be created in `worktrees/` directory within this project
- Use naming convention: `worktrees/[purpose]`
- Example: `git worktree add worktrees/debug`
- Example: `git worktree add worktrees/google-oauth-signin`
- This keeps worktrees organized within the project structure
- **NEVER create worktrees outside the worktrees/ folder**

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

## Google OAuth Implementation

### Overview
Complete Google OAuth 2.0 authentication system with security-first design:
- **Backward Compatible**: Maintains existing email/password authentication
- **Account Linking**: Users can link Google accounts to existing profiles
- **Security-First**: Multi-layered rate limiting, CSRF protection, comprehensive logging
- **Production-Ready**: Full error handling, monitoring, and testing coverage

### OAuth Endpoints
```
GET    /api/v1/auth/google              # Initiate OAuth flow
GET    /api/v1/auth/google/callback     # Handle OAuth callback
POST   /api/v1/auth/google/link         # Link Google account (requires auth)
DELETE /api/v1/auth/google/unlink       # Unlink Google account (requires auth)
GET    /api/v1/auth/google/status       # Get OAuth connection status
GET    /api/v1/auth/google/analytics    # OAuth usage analytics (admin)
```

### Required Secrets
```bash
# Google OAuth Configuration (REQUIRED)
wrangler secret put GOOGLE_CLIENT_ID      # From Google Cloud Console
wrangler secret put GOOGLE_CLIENT_SECRET  # From Google Cloud Console  
wrangler secret put GOOGLE_REDIRECT_URI   # OAuth callback URL

# Existing Secrets (must already be configured)
JWT_SECRET      # Used for state token signing
API_KEY_SALT    # For API key functionality
```

### Database Schema Changes
**Migration**: `migrations/0009_google_oauth_support.sql`
- Extends `users` table with OAuth fields (google_id, provider, etc.)
- Creates `oauth_states` table for CSRF protection
- Creates `oauth_security_events` table for comprehensive monitoring
- Creates `oauth_rate_limits` table for multi-layered protection

### Security Features
- **State Management**: JWT-signed state tokens with 10-minute expiration
- **Rate Limiting**: Multi-layered (general: 30/15min, failures: 15/15min, burst: 15/1min)
- **Input Validation**: Comprehensive validation of all OAuth parameters
- **Security Logging**: All OAuth events logged for monitoring and analysis
- **Attack Detection**: Automatic detection of suspicious activity patterns
- **CORS Protection**: Proper CORS configuration for OAuth redirects

### Frontend Integration
**Components**:
- `GoogleSignInButton` - Customizable Google Sign-In button with modes (login/signup/link)
- `GoogleOAuthCallback` - Handles OAuth callback processing
- `GoogleAccountStatus` - Shows OAuth connection status and management

**Usage**:
```jsx
import GoogleSignInButton from './components/GoogleSignInButton';

// Login/Signup
<GoogleSignInButton mode="login" onError={handleError} />
<GoogleSignInButton mode="signup" onError={handleError} />

// Account Linking (requires authentication)
<GoogleSignInButton mode="link" onError={handleError} />
```

### Testing Coverage
**Test Files**:
- `tests/auth/google-oauth.test.ts` - OAuth service integration tests
- `tests/routes/google-oauth-routes.test.ts` - API endpoint tests  
- `tests/security/oauth-security.test.ts` - Security validation tests

**Coverage Areas**:
- OAuth flow initiation and callback handling
- State token validation and security
- Rate limiting and security middleware
- Input validation and attack prevention
- Error handling and edge cases

### Development Workflow
1. **Setup**: Configure Google Cloud Console OAuth app
2. **Secrets**: Set required Wrangler secrets for your environment
3. **Migration**: Run OAuth database migration
4. **Testing**: Verify OAuth endpoints with configured secrets
5. **Frontend**: Test Google Sign-In button integration

### Production Checklist
- [ ] Google Cloud Console OAuth app configured with correct redirect URIs
- [ ] All required Wrangler secrets configured for production environment
- [ ] OAuth database migration applied to production database
- [ ] OAuth endpoints tested end-to-end in production environment
- [ ] Security monitoring configured for OAuth events
- [ ] Rate limiting thresholds appropriate for production traffic

**See**: `OAUTH_SECRETS_SETUP.md` for detailed configuration instructions

## Project Architecture

### Technology Stack
- **Backend**: Cloudflare Workers (Hono.js + TypeScript)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Storage**: Cloudflare R2 object storage with global CDN
- **Frontend**: React + Vite (Material-UI)
- **Testing**: Vitest + Playwright with comprehensive coverage
- **Security**: JWT authentication, API keys, comprehensive monitoring

### Key Commands for Daily Development

```bash
# Start development environment
cd cloudflare/workers && npm run dev
cd app/frontend && npm run dev

# Run comprehensive tests (including OAuth tests)
cd cloudflare/workers && npm test

# Build and validate (automated pre-commit, manual for deployment)
npm run build && npx wrangler versions upload --dry-run

# Deploy to production
wrangler deploy --env=production

# Deploy to production (using separate config)
wrangler deploy --config wrangler.prod.toml

# Deploy cron triggers (priority triggers)
wrangler triggers deploy --cron "*/5 * * * *"  # Metrics & alerts every 5 min
wrangler triggers deploy --cron "*/1 * * * *"  # Security monitoring every minute  
wrangler triggers deploy --cron "0 2 * * *"    # Daily backup at 2 AM
wrangler triggers deploy --cron "0 6 * * *"    # Storage cleanup at 6 AM
wrangler triggers deploy --cron "0 */6 * * *"  # Cost calculation every 6 hours

# Verify cron triggers
wrangler triggers list

# Google OAuth Setup Commands
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET  
wrangler secret put GOOGLE_REDIRECT_URI

# OAuth Database Migration (Development)
cd cloudflare/workers && wrangler d1 execute cutty-dev --file=migrations/0009_google_oauth_support.sql

# OAuth Database Migration (Production)  
cd cloudflare/workers && wrangler d1 execute cutty-prod --file=migrations/0009_google_oauth_support.sql
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
