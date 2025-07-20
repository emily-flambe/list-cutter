# Gemini CLI Configuration

This directory contains Gemini CLI specific configuration files required for proper project context loading.

## Files

- `GEMINI.md` - Project context file (required by Gemini CLI)
- `settings.json` - Gemini-specific project settings

## How It Works

### Context Loading
Gemini CLI requires a `GEMINI.md` file for project context. Our approach:

1. **Single Source of Truth**: `.project/config.md` contains the master configuration
2. **Gemini Compatibility**: `GEMINI.md` includes essential content from the unified config
3. **Tool-Specific Additions**: Gemini-specific commands and settings

### Usage Commands
```bash
# Reload project context after changes
/memory refresh

# View current loaded context
/memory show

# Check Gemini CLI status
gemini --version
```

## Integration with Unified Framework

This directory is part of the unified configuration framework:
- **Primary Config**: `.project/config.md` (single source of truth)
- **Gemini Adapter**: `.gemini/GEMINI.md` (tool-specific version)
- **Claude Adapter**: `.claude/` (Claude-specific supplements)

## Maintenance

When updating project configuration:
1. Edit `.project/config.md` (primary source)
2. Update `.gemini/GEMINI.md` if Gemini-specific changes needed
3. Run `/memory refresh` in Gemini CLI to reload context

---
*This approach maintains Gemini CLI compatibility while preserving the unified configuration framework.*