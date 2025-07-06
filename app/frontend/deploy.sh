#!/bin/bash

# Cloudflare Workers Frontend Deploy Script
# This script ensures proper build and deployment from any directory

set -e

echo "🚀 Starting frontend deployment..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $(pwd)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the frontend
echo "🔨 Building frontend..."
npm run build

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

# Deploy with Wrangler
echo "☁️ Deploying to Cloudflare Workers..."
npx wrangler deploy

echo "✅ Deployment complete!"