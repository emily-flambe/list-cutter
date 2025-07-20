#!/bin/bash
# Initialize or update project configuration framework
# This script sets up the unified configuration for Claude Code, Gemini CLI, and other AI agents

set -e

echo "🚀 Initializing Project Configuration Framework..."

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p .project/contexts
mkdir -p .project/scripts
mkdir -p .claude
mkdir -p .gemini

# Check if config already exists
if [ -f ".project/config.md" ]; then
    echo "⚠️  Configuration already exists. Updating symlinks only..."
else
    echo "📝 Creating default configuration..."
    cat > .project/config.md << 'EOF'
# Project: [Your Project Name]

## Overview
[Brief project description]

## Architecture
See: .project/contexts/architecture.md

## Coding Standards
See: .project/contexts/coding-standards.md

## Dependencies & Versions
See: .project/contexts/dependencies.md

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
if [ ! -f ".project/settings.json" ]; then
    echo "⚙️  Creating settings.json..."
    cat > .project/settings.json << 'EOF'
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
if [ ! -f ".project/.env.example" ]; then
    echo "🔐 Creating .env.example..."
    cat > .project/.env.example << 'EOF'
# Environment Variables
PROJECT_ENV=development
DEBUG_MODE=false
EOF
fi

# Create symlinks for Gemini
echo "🔗 Creating symlinks for Gemini CLI..."
ln -sf ../.project/config.md .gemini/GEMINI.md 2>/dev/null || true
ln -sf ../.project/settings.json .gemini/settings.json 2>/dev/null || true

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
if [ ! -f ".project/contexts/architecture.md" ]; then
    echo "📐 Creating architecture context template..."
    cat > .project/contexts/architecture.md << 'EOF'
# Architecture

## Technology Stack
- Frontend: [Your frontend tech]
- Backend: [Your backend tech]
- Database: [Your database]

## Design Patterns
[Your patterns]
EOF
fi

if [ ! -f ".project/contexts/coding-standards.md" ]; then
    echo "📏 Creating coding standards template..."
    cat > .project/contexts/coding-standards.md << 'EOF'
# Coding Standards

## Language Guidelines
[Your standards]

## Code Style
[Your style guide]
EOF
fi

if [ ! -f ".project/contexts/dependencies.md" ]; then
    echo "📦 Creating dependencies template..."
    cat > .project/contexts/dependencies.md << 'EOF'
# Dependencies & Versions

## Runtime Requirements
[Your requirements]

## Package Versions
[Your packages]
EOF
fi

# Make script executable
chmod +x "$0"

echo "✅ Project Configuration Framework initialized successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .project/config.md to add your project details"
echo "2. Update context files in .project/contexts/"
echo "3. Copy .project/.env.example to .project/.env and add your keys"
echo "4. Commit the .project directory to version control"
echo ""
echo "The configuration is now available to:"
echo "- Claude Code (reads .project/ and .claude/)"
echo "- Gemini CLI (reads .gemini/ symlinks)"
echo "- Other AI agents (reads .project/ directly)"