# Claude Code Project Configuration

This file contains project-specific instructions for Claude Code usage.

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

## Testing Philosophy
**CRITICAL: NEVER overengineer tests**
- Create minimal, focused tests that verify basic functionality only
- Use simple mocks that match actual implementations  
- Set realistic expectations appropriate for test environments
- Avoid complex custom error types and elaborate test scenarios
- Write tests that are easy to maintain and don't become a burden
- Focus on core functionality verification rather than comprehensive edge cases
- **Test philosophy: Simple, practical, maintainable**
