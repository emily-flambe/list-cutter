#!/bin/bash
# Initialize or update AI configuration framework
# This script sets up the unified configuration for Claude Code, Gemini CLI, and other AI agents

set -e

echo "🚀 Initializing AI Configuration Framework..."

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p .ai/contexts
mkdir -p .ai/scripts
mkdir -p .claude
mkdir -p .gemini

# Check if config already exists
if [ -f ".ai/config.md" ]; then
    echo "⚠️  Configuration already exists. Updating symlinks only..."
else
    echo "📝 Creating default configuration..."
    cat > .ai/config.md << 'EOF'
# Project: [Your Project Name]

## Overview
[Brief project description]

## Architecture
See: .ai/contexts/architecture.md

## Coding Standards
See: .ai/contexts/coding-standards.md

## Dependencies & Versions
See: .ai/contexts/dependencies.md

## AI Assistant Guidelines

### For All Assistants
- Follow the coding standards strictly
- Prioritize readability and maintainability
- Include comprehensive error handling
- Write tests for new functionality

### Tool-Specific Instructions
#### Claude Code
- Use artifacts for substantial code generation

#### Gemini CLI
- Use built-in tools for file operations
- Leverage MCP servers when available
EOF
fi

# Create settings.json if it doesn't exist
if [ ! -f ".ai/settings.json" ]; then
    echo "⚙️  Creating settings.json..."
    cat > .ai/settings.json << 'EOF'
{
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "type": "application"
  }
}
EOF
fi

# Create .env.example if it doesn't exist
if [ ! -f ".ai/.env.example" ]; then
    echo "🔐 Creating .env.example..."
    cat > .ai/.env.example << 'EOF'
# Environment Variables
PROJECT_ENV=development
DEBUG_MODE=false
EOF
fi

# Create symlinks for Gemini
echo "🔗 Creating symlinks for Gemini CLI..."
ln -sf ../.ai/config.md .gemini/GEMINI.md 2>/dev/null || true
ln -sf ../.ai/settings.json .gemini/settings.json 2>/dev/null || true

# Create Claude project file if it doesn't exist
if [ ! -f ".claude/claude_project.json" ]; then
    echo "📋 Creating Claude project file..."
    cat > .claude/claude_project.json << 'EOF'
{
  "name": "My Project",
  "config_version": "2.0"
}
EOF
fi

# Create context templates if they don't exist
if [ ! -f ".ai/contexts/architecture.md" ]; then
    echo "📐 Creating architecture context template..."
    cat > .ai/contexts/architecture.md << 'EOF'
# Architecture

## Technology Stack
- Frontend: [Your frontend tech]
- Backend: [Your backend tech]
- Database: [Your database]

## Design Patterns
[Your patterns]
EOF
fi

if [ ! -f ".ai/contexts/coding-standards.md" ]; then
    echo "📏 Creating coding standards template..."
    cat > .ai/contexts/coding-standards.md << 'EOF'
# Coding Standards

## Language Guidelines
[Your standards]

## Code Style
[Your style guide]
EOF
fi

if [ ! -f ".ai/contexts/dependencies.md" ]; then
    echo "📦 Creating dependencies template..."
    cat > .ai/contexts/dependencies.md << 'EOF'
# Dependencies & Versions

## Runtime Requirements
[Your requirements]

## Package Versions
[Your packages]
EOF
fi

# Make script executable
chmod +x "$0"

echo "✅ AI Configuration Framework initialized successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .ai/config.md to add your project details"
echo "2. Update context files in .ai/contexts/"
echo "3. Copy .ai/.env.example to .ai/.env and add your keys"
echo "4. Commit the .ai directory to version control"
echo ""
echo "The configuration is now available to:"
echo "- Claude Code (reads .ai/ and .claude/)"
echo "- Gemini CLI (reads .gemini/ symlinks)"
echo "- Other AI agents (reads .ai/ directly)"