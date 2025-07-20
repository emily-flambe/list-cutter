# Unified Project Configuration Framework

This directory contains a unified configuration framework that works seamlessly with Claude Code, Gemini CLI, and other AI coding assistants.

## Directory Structure

```
.project/
├── config.md           # Main configuration file
├── settings.json       # Unified settings
├── .env.example       # Environment variables template
├── contexts/          # Modular context files
│   ├── architecture.md
│   ├── coding-standards.md
│   └── dependencies.md
├── scripts/           # Utility scripts
└── README.md          # This file
```

## Quick Start

1. **Initialize the configuration:**
   ```bash
   ./init-project-config.sh
   ```

2. **Set up environment variables:**
   ```bash
   cp .project/.env.example .project/.env
   # Edit .project/.env with your values
   ```

3. **Customize for your project:**
   - Edit `.project/config.md` with project overview
   - Update context files in `.project/contexts/`
   - Modify `.project/settings.json` as needed

## Tool Compatibility

### Claude Code
- Automatically reads `.project/` directory
- Additional Claude-specific config in `.claude/`
- Uses unified context from `.project/config.md`

### Gemini CLI
- Reads configuration via symlinks:
  - `.gemini/GEMINI.md` → `.project/config.md`
  - `.gemini/settings.json` → `.project/settings.json`
- Fully compatible with unified framework

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

2. **Team Collaboration**
   - Document AI usage in main README
   - Keep configurations up to date
   - Share context improvements

3. **Maintenance**
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

### Symlinks Not Working
```bash
# Recreate symlinks
rm -f .gemini/GEMINI.md .gemini/settings.json
ln -sf ../.project/config.md .gemini/GEMINI.md
ln -sf ../.project/settings.json .gemini/settings.json
```

### Configuration Not Loading
- Ensure `.project/config.md` exists
- Check file permissions
- Verify symlinks point correctly

### Tool-Specific Issues
- Claude: Check `.claude/` directory
- Gemini: Verify `.gemini/` symlinks
- Others: Point directly to `.project/config.md`

---
*Unified Project Configuration Framework v1.0.0*