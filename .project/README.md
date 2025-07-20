# Unified Project Configuration Framework

This directory contains a unified configuration framework that works seamlessly with Claude Code, Gemini CLI, and other AI coding assistants.

## Directory Structure

```
.project/
├── config.md              # Main configuration file
├── settings.json          # Unified settings
├── .env.example          # Environment variables template
├── database-schema.json  # Database schema definition
├── contexts/             # Modular context files
│   ├── architecture.md
│   ├── coding-standards.md
│   └── dependencies.md
├── scripts/              # Utility scripts
│   └── generate-d1-schema.js
└── README.md             # This file
```

## Quick Start

1. **Set up environment variables:**
   ```bash
   cp .project/.env.example .project/.env
   # Edit .project/.env with your values
   ```

2. **Customize for your project:**
   - Edit `.project/config.md` with project overview
   - Update context files in `.project/contexts/`
   - Modify `.project/settings.json` as needed

## Tool Compatibility

### Claude Code
- Automatically reads `.project/` directory
- Additional Claude-specific config in `.claude/`
- Uses unified context from `.project/config.md`

### Gemini CLI
- Reads project context from `.gemini/GEMINI.md` (required by Gemini CLI)
- GEMINI.md includes content from `.project/config.md` for consistency
- Project settings in `.gemini/settings.json`
- Use `/memory refresh` to reload context after changes

### Other AI Agents
- Point to `.project/config.md` as primary context
- Use `.project/settings.json` for tool configuration
- Follow guidelines in context files

## Configuration Files

### config.md
Main instruction file containing:
- Project overview
- References to modular contexts
- AI assistant guidelines
- Tool-specific instructions

### settings.json
Unified settings including:
- Project metadata
- AI model preferences
- Code formatting rules
- Tool configurations

### Context Files
Modular documentation:
- `architecture.md` - System design and tech stack
- `coding-standards.md` - Code style and conventions
- `dependencies.md` - Package versions and requirements

## Best Practices

1. **Version Control**
   - Commit entire `.project/` directory
   - Exclude `.env` (but include `.env.example`)
   - Track changes to configurations

2. **🚨 CRITICAL: Git Worktree Management**
   - **MANDATORY**: All new worktrees MUST be created in `worktrees/` folder ONLY
   - **COMMAND**: `git worktree add worktrees/branch-name branch-name`
   - **FORBIDDEN**: Creating worktrees anywhere else in project structure
   - **RATIONALE**: Maintains clean organization and prevents conflicts
   - **NO EXCEPTIONS**: This rule applies to all AI assistants and developers

3. **Team Collaboration**
   - Document AI usage in main README
   - Keep configurations up to date
   - Share context improvements

4. **Maintenance**
   - Review configurations regularly
   - Update dependencies and versions
   - Refine AI instructions based on usage

## Customization

### Adding New Context Files
1. Create new file in `.project/contexts/`
2. Reference in `.project/config.md`
3. Update relevant tools to use new context

### Tool-Specific Overrides
- Claude: Use `.claude/` for Claude-only settings
- Gemini: Add Gemini-specific files to `.gemini/`
- Keep core configuration in `.project/` unified

## Troubleshooting

### Configuration Not Loading
- Ensure `.project/config.md` exists
- Check file permissions
- Verify all tools reference `.project/` directory directly

### Tool-Specific Issues
- Claude: Check `.claude/` directory
- Gemini: Reference `.project/config.md` directly
- Others: Point directly to `.project/config.md`

---
*Unified Project Configuration Framework v1.0.0*