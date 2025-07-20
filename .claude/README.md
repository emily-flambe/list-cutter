# Claude Configuration Directory

This directory contains Claude-specific configuration that extends the unified AI framework.

## Unified Configuration

The primary configuration for this project is now in the `.project/` directory:
- **Main Config**: `.project/config.md`
- **Architecture**: `.project/contexts/architecture.md`
- **Standards**: `.project/contexts/coding-standards.md`
- **Dependencies**: `.project/contexts/dependencies.md`

## Claude-Specific Files

This directory maintains simplified Claude-specific references:
- `claude_project.json` - Claude project metadata
- Legacy simplified configs (being phased out in favor of `.project/`)

## Migration Notice

We've migrated to a unified project configuration framework that works with:
- Claude Code
- Gemini CLI
- Other AI coding assistants

For the most up-to-date configuration, refer to:
1. `.project/config.md` - Primary configuration
2. `.project/contexts/` - Detailed context files
3. `.project/settings.json` - Unified settings

## Using with Claude Code

Claude Code will automatically read both:
1. The unified `.project/` directory
2. This `.claude/` directory for any Claude-specific overrides

The unified configuration provides better maintainability and consistency across different AI tools.

---
*See [.project/README.md](../.project/README.md) for complete documentation of the unified framework.*