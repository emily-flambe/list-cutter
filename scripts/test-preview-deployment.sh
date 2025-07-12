#!/bin/bash

# Test script for Cloudflare Workers preview deployments

set -e

echo "Testing Cloudflare Workers preview deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: Wrangler CLI is not installed${NC}"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Function to test worker deployment
test_worker() {
    local WORKER_DIR=$1
    local WORKER_NAME=$2
    
    echo -e "${YELLOW}Testing $WORKER_NAME...${NC}"
    
    cd "$WORKER_DIR"
    
    # Install dependencies
    echo "Installing dependencies..."
    npm ci
    
    # Build the worker
    echo "Building..."
    npm run build
    
    # Upload a test version
    echo "Uploading version..."
    VERSION_OUTPUT=$(npx wrangler versions upload --message "Test preview $(date +%s)" 2>&1)
    
    if echo "$VERSION_OUTPUT" | grep -q "Version ID:"; then
        VERSION_ID=$(echo "$VERSION_OUTPUT" | grep -o 'Version ID: [^ ]*' | cut -d' ' -f3)
        echo -e "${GREEN}✓ Successfully uploaded version: $VERSION_ID${NC}"
        
        # Deploy as preview
        echo "Deploying preview..."
        if npx wrangler versions deploy "$VERSION_ID" --percentage 0 --tag test-preview 2>&1; then
            echo -e "${GREEN}✓ Successfully deployed preview${NC}"
            echo -e "${GREEN}Preview URL: https://test-preview.$WORKER_NAME.workers.dev${NC}"
        else
            echo -e "${RED}✗ Failed to deploy preview${NC}"
        fi
    else
        echo -e "${RED}✗ Failed to upload version${NC}"
        echo "$VERSION_OUTPUT"
    fi
    
    cd - > /dev/null
}

# Test backend worker
echo -e "\n${YELLOW}=== Testing Backend Worker ===${NC}"
test_worker "cloudflare/workers" "cutty"

# Test frontend worker
echo -e "\n${YELLOW}=== Testing Frontend Worker ===${NC}"
test_worker "app/frontend" "cutty-frontend"

echo -e "\n${GREEN}Testing complete!${NC}"
echo "If both workers deployed successfully, your preview deployment setup is working correctly."