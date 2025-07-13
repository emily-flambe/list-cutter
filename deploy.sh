#!/bin/bash

set -e

echo "🚀 Deploying cutty worker..."

# Change to workers directory
WORKERS_DIR="/Users/emilycogsdill/Documents/GitHub/list-cutter/worktrees/issue-65-r2-monitoring/cloudflare/workers"
CONFIG_FILE="/Users/emilycogsdill/Documents/GitHub/list-cutter/worktrees/issue-65-r2-monitoring/deploy-config.toml"

echo "📦 Installing dependencies..."
(cd "$WORKERS_DIR" && npm install)

echo "🔧 Deploying worker..."
wrangler deploy --config "$CONFIG_FILE"

echo "✅ Deployment complete!"
echo "🌐 Worker should be available at: https://cutty.emilycogsdill.com"