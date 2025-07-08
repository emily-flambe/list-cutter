# Claude Code Project Configuration

This file contains project-specific instructions for Claude Code usage.

## Project Identity

**Important**: While this GitHub repository is named "list-cutter", the **preferred identity** for all Cloudflare deployments, resources, and references is **"cutty"**.

### Naming Convention

- **GitHub Repository**: `list-cutter` (historical name)
- **Cloudflare Resources**: `cutty-*` (preferred naming)
- **Domains**: `cutty.com`, `api.cutty.com`, `staging.cutty.com`
- **Worker Names**: `cutty-api`, `cutty-workers`, `cutty-frontend`
- **Database Names**: `cutty-db`, `cutty-dev`, `cutty-staging`, `cutty-production`
- **R2 Buckets**: `cutty-files-dev`, `cutty-files-staging`, `cutty-files-production`

### Wrangler Commands

When working with Cloudflare Wrangler commands, always use the "cutty" naming convention:

```bash
# Database operations
wrangler d1 create cutty-db
wrangler d1 execute cutty-db --file=schema.sql

# R2 storage operations
wrangler r2 bucket create cutty-files-dev
wrangler r2 bucket cors put cutty-files-dev --file cors.json

# Pages deployment
wrangler pages deploy dist --project-name cutty-frontend
```

## Project Structure

This is a Django + React application being migrated to Cloudflare Workers with D1 database and R2 storage. The project includes comprehensive file migration tools for transitioning from traditional filesystem storage to Cloudflare R2.

## Development Notes

- Main application: Django backend with React frontend
- Target deployment: Cloudflare Workers with D1 + R2
- Migration tools: Comprehensive Python scripts for file migration
- Identity: Use "cutty" for all new Cloudflare resources

## Debugging Lessons Learned

### Wrangler Deployment Issues (Issue #65)

**Problem**: CI deployment failing with "binding should have a string binding field" error.

**Root Cause**: Multi-layered issue combining:
1. Package-lock.json mismatch (v3 lockfile, v4 package.json)
2. Complex commented TOML binding configurations causing parsing errors

**Key Lessons**:

#### 🎯 Root Cause Analysis
- **Multi-layered Problems**: Always check for multiple simultaneous issues
- **Environment Parity**: CI uses `npm ci` (strict) vs local `npm install` (flexible)
- **Version Dependencies**: Regenerate lockfiles after major version changes
- **Configuration Comments**: Even commented TOML syntax can break parsers

#### 🔧 Technical Debugging
- **Test Exact CI Commands**: Use `npm ci` and exact wrangler commands locally
- **Transitive Dependencies**: Check for conflicting sub-dependencies
- **Error Message Validity**: "binding field" error pointed to config, but root cause was version mismatch
- **Incremental Changes**: Simplify configuration → working deployment → add complexity back

#### 📋 Process Improvements
- **Local Testing First**: Always reproduce CI environment exactly before pushing
- **Systematic Approach**: Reproduce → Isolate → Document → Verify → Validate
- **Test Scripts**: Create validation scripts for consistent testing
- **Version Specificity**: Use exact versions in package.json for critical dependencies

#### 🚀 Wrangler-Specific
- **Version Compatibility**: v3 vs v4 have different binding syntax requirements
- **Configuration Validation**: Use `wrangler deploy --dry-run` and `wrangler versions upload --dry-run`
- **Clean Configuration**: Remove complex commented binding examples that cause parsing issues

#### ✅ Resolution Commands
```bash
# Test exact CI environment locally
cd cloudflare/workers
rm -rf node_modules package-lock.json
npm ci  # This should match CI exactly

# Test the failing commands
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run
npm run build
```

**Next Time**: Always start by reproducing the exact CI failure locally before making any configuration changes.