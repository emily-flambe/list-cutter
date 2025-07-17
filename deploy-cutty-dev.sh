#!/bin/bash
set -e

echo "Deploying to cutty-dev worker..."
cd /Users/emilycogsdill/Documents/GitHub/list-cutter/worktrees/fix-google-oauth/cloudflare/workers

# Run the deploy command
npm run deploy

echo "Deployment completed!"