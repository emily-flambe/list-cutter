# Claude Configuration Directory

This directory contains Claude-specific configuration that extends the unified AI framework.

## Unified Configuration

The primary configuration for this project is now in the `.ai/` directory:
- **Main Config**: `.ai/config.md`
- **Architecture**: `.ai/contexts/architecture.md`
- **Standards**: `.ai/contexts/coding-standards.md`
- **Dependencies**: `.ai/contexts/dependencies.md`

## Claude-Specific Files

This directory maintains simplified Claude-specific references:
- `claude_project.json` - Claude project metadata
- Legacy simplified configs (being phased out in favor of `.ai/`)

## Migration Notice

We've migrated to a unified AI configuration framework that works with:
- Claude Code
- Gemini CLI
- Other AI coding assistants

For the most up-to-date configuration, refer to:
1. `.ai/config.md` - Primary configuration
2. `.ai/contexts/` - Detailed context files
3. `.ai/settings.json` - Unified settings

## Using with Claude Code

Claude Code will automatically read both:
1. The unified `.ai/` directory
2. This `.claude/` directory for any Claude-specific overrides

The unified configuration provides better maintainability and consistency across different AI tools.

---
*See [.ai/README.md](../.ai/README.md) for complete documentation of the unified framework.*