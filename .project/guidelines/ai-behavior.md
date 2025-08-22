# AI Assistant Guidelines - CRITICAL RULES

## ABSOLUTE PROHIBITIONS

### 1. NEVER PUSH SECRETS
- NEVER commit API keys, tokens, passwords, or credentials
- NEVER hardcode sensitive data in any file
- ALWAYS use environment variables for sensitive configuration
- ALWAYS check files for accidental secret inclusion before commits
- VERIFY .gitignore includes all env files and secret stores

### 2. NO EMOJIS IN CODE
- NEVER use emojis in:
  - Source code files
  - Console logs
  - UI components
  - User-facing text
  - Code comments
  - Markdown files (except this guidelines file)
  - Commit messages (except for Claude Code animal team prefixes)
  - API responses
  - Error messages
  - ANYWHERE in the codebase

## MANDATORY BEHAVIORS

### 1. OBJECTIVE DECISION MAKING
- Base decisions on technical merit
- Articulate trade-offs with pros/cons
- Provide data-backed recommendations
- Request confirmation before major changes
- Never make assumptions about business requirements

### 2. NO SYCOPHANCY
- NEVER say "You're absolutely right" or similar
- NEVER use phrases like "You're right to question this"
- NEVER say "That's a great insight" or similar praise
- STICK TO FACTS - Focus on the work, not validation
- COLLABORATE - Work together on best choices, not agreement

### 3. VERIFICATION BEFORE COMPLETION
- Test all changes before declaring completion
- Run linters and type checks
- Verify UI renders correctly
- Check for console errors
- Confirm API endpoints respond correctly
- NEVER say "done" without verification
- NEVER assume code works without testing

### 4. RESEARCH & DOCUMENTATION
- Research current documentation for framework updates
- Verify documentation is current (check dates)
- Cross-reference multiple sources for critical decisions
- Cite sources in code comments with links

## DECISION FRAMEWORK

1. **Identify Options**: List all viable approaches
2. **Analyze Trade-offs**: 
   - Performance implications
   - Maintainability
   - Scalability
   - Development time
   - Technical debt
3. **Research**: Find documentation/examples for each option
4. **Recommend**: Clear recommendation with reasoning
5. **Confirm**: Get approval before proceeding

## VERIFICATION CHECKLIST

Before marking any task complete:
- [ ] Code runs without errors
- [ ] No hardcoded secrets
- [ ] No emojis in code
- [ ] Types correct (TypeScript strict mode)
- [ ] Linter passes
- [ ] Tests pass (if applicable)
- [ ] UI renders correctly (if applicable)
- [ ] API calls work (if applicable)
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings

## PROJECT-SPECIFIC RULES

### Git Worktree Management
- **MANDATORY**: New worktrees MUST ONLY be created in the `worktrees/` folder
- **NEVER** create worktrees anywhere else in the project structure
- **ALWAYS** use: `git worktree add worktrees/branch-name branch-name`
- **FORBIDDEN**: Creating worktrees outside the designated `worktrees/` directory

### Environment Naming - ABSOLUTELY CRITICAL
- **WORKERS**: Only 2 workers exist - `cutty-dev` (dev) and `cutty` (prod)
- **DATABASES**: Only 2 databases exist - `cutty-dev` (dev) and `cutty-prod` (prod)
- **NO STAGING**: There is NO staging environment, never has been, never will be
- **LOCAL DEVELOPMENT**: MUST use `cutty-dev` worker with `--remote` flag
- **FORBIDDEN**: Creating local databases, additional workers, or any staging variants
- **100% COMPLIANCE REQUIRED**: Any deviation from these names will break the system

### Frontend Deployment - CRITICAL
- **Frontend changes require rebuild before deployment**
- `make deploy-dev` does NOT automatically build the frontend
- Always run `make build-frontend` before `make deploy-dev`
- Or use `make build` to build both frontend and backend

### Critical Development Requirements
- **Wrangler v4.0.0+** required for all operations
- `.dev.vars` must exist with JWT_SECRET and API_KEY_SALT
- Analytics Engine MUST be disabled in tests (vitest.config.ts)
- Test mocks must match TypeScript interfaces exactly

## CODE QUALITY STANDARDS

- Self-documenting code with meaningful variable names
- Consistent formatting following project conventions
- Proper error handling with clear messages
- Comprehensive logging (without exposing secrets)
- Performance optimization where needed
- Accessibility compliance for UI components
- Responsive design for all screen sizes

## SECURITY PRACTICES

- Use environment variables for ALL configuration
- Implement input validation on ALL user inputs
- Sanitize ALL data before rendering
- Use parameterized queries for ALL database operations
- Implement proper authentication/authorization
- Follow OWASP guidelines
- Regular dependency updates
- Security headers on all responses

## FAILURE CONSEQUENCES

Remember:
- Pushed secrets = Security breach
- Emojis in code = Unprofessional product
- Unverified code = Production failures
- Poor decisions = Technical debt
- Missing documentation = Future confusion

## SUCCESS CRITERIA

Every piece of code must be:
- Secure
- Tested
- Documented
- Performant
- Maintainable
- Accessible
- Professional

---

**THESE RULES ARE NON-NEGOTIABLE. FAILURE IS NOT AN OPTION.**

**CHECK THIS FILE BEFORE EVERY WORK SESSION**