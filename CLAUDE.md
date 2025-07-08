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

### TypeScript Build Failures & D1 Database Issues (Issue #67)

**Problem**: Cloudflare Worker build failing with TypeScript errors, TOML syntax issues, and D1 database type casting problems.

**Root Cause**: Accumulation of technical debt across multiple systems:
1. TOML configuration syntax errors (unterminated arrays)
2. Binding name mismatches between TypeScript interfaces and Wrangler config  
3. Unsafe D1 database result type casting without proper validation
4. Overly strict TypeScript configuration causing build failures

**Key Lessons**:

#### 🎯 Progressive Problem Solving Strategy
- **Start with Critical Blockers**: Fix syntax errors before type issues
- **Layer-by-Layer Resolution**: Configuration → Build → Types → Tests
- **Permissive-to-Strict Approach**: Get builds working first, then tighten constraints
- **User Requirements Priority**: Focus on essential functionality over perfect types

#### 🔧 TypeScript & Build Configuration
- **Graceful Degradation**: Make TypeScript permissive when strict checking blocks progress
- **Essential vs Nice-to-Have**: Distinguish between critical type safety and perfectionist checking
- **Exclude Problematic Areas**: Use TypeScript `exclude` to temporarily bypass complex modules
- **Build vs Type-Check**: Separate concerns - builds can succeed while types are imperfect

#### 🗃️ D1 Database Type Safety Best Practices
- **Never use unsafe `as Type` casting** on database results
- **Always use `Number()`, `String()` conversions** instead of direct casting
- **Check for null/undefined** before type conversion: `Number(result?.field) || 0`
- **Use `Record<string, unknown>`** for database row typing, then convert explicitly
- **Validate enum values** before casting: `['low','medium','high'].includes(value) ? value : 'default'`
- **Handle optional chaining** for meta properties: `result.meta?.changes`

#### 📋 Cloudflare Workers Development
- **TOML Syntax Validation**: Use proper table format instead of inline objects for complex configs
- **Binding Name Consistency**: Ensure TypeScript env interfaces match wrangler.toml exactly
- **Environment Prefixing**: Use consistent naming like `CUTTY_*` for all bindings
- **Version Management**: Keep Wrangler versions consistent between package.json and CI

#### 🔍 Debugging Methodology
- **Research Phase**: Use Task tool for comprehensive codebase analysis
- **Systematic Fixes**: One category at a time (config → build → types)
- **User Feedback Integration**: Adjust strictness based on user priorities
- **Verification Loops**: Test builds after each major change

#### ✅ Proven Resolution Pattern
```bash
# 1. Fix configuration syntax first
npm run build  # Should pass after TOML fixes

# 2. Verify deployment works  
npx wrangler versions upload  # Should succeed

# 3. Address TypeScript incrementally
npx tsc --noEmit  # Identify remaining issues

# 4. Make TypeScript permissive for complex areas
# Use exclude patterns for problematic service directories
```

#### 🎓 D1 Database Code Patterns
```typescript
// ❌ Unsafe pattern
const count = result.count as number;

// ✅ Safe pattern  
const count = Number(result?.count) || 0;

// ❌ Direct enum casting
severity: event.severity as 'low' | 'medium'

// ✅ Validated enum casting
severity: (['low','medium','high'].includes(event.severity) ? event.severity : 'medium') as 'low' | 'medium' | 'high'

// ❌ Unsafe record typing
const row = result as DatabaseRow;

// ✅ Safe record typing
const row = result as Record<string, unknown>;
const safeField = String(row.field_name);
```

**Next Time**: Begin with configuration validation, separate build success from type perfection, and prioritize user requirements over theoretical type safety.

## Essential Development Commands

### Pre-commit Validation
```bash
cd cloudflare/workers

# Essential build check
npm run build

# Deployment validation  
npx wrangler versions upload --dry-run
npx wrangler deploy --dry-run

# Type checking (when needed)
npx tsc --noEmit
```

### Troubleshooting Commands
```bash
# Clean environment test (matches CI)
rm -rf node_modules package-lock.json
npm ci

# Wrangler configuration check
npx wrangler whoami
npx wrangler tail --version
npx wrangler d1 list

# TypeScript configuration testing
npx tsc --showConfig
npx tsc --noEmit --incremental false
```

### Build Success Criteria
1. ✅ `npm run build` completes successfully
2. ✅ `npx wrangler versions upload --dry-run` passes
3. ✅ Bundle size is reasonable (< 200kb typical)
4. ✅ No critical runtime errors in essential flows

**Note**: TypeScript strict checking is secondary to functional builds. Focus on build success and runtime safety over perfect type compliance.