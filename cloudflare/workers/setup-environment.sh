#!/bin/bash

# List Cutter Workers Environment Setup Script
# This script creates the necessary Cloudflare resources for all environments

set -e  # Exit on any error

echo "🚀 Setting up List Cutter Workers environments..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if logged in to Wrangler
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Wrangler. Please run:"
    echo "   wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI is ready"
echo ""

# Function to create resources for an environment
create_environment() {
    local env=$1
    local suffix=$2
    
    echo "📦 Creating resources for $env environment..."
    
    # Create KV namespace
    echo "  Creating KV namespace..."
    KV_OUTPUT=$(wrangler kv:namespace create "AUTH_KV" --env=$env 2>&1)
    KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    
    if [ -z "$KV_ID" ]; then
        echo "  ⚠️  Failed to extract KV namespace ID. Output:"
        echo "  $KV_OUTPUT"
    else
        echo "  ✅ KV namespace created: $KV_ID"
    fi
    
    # Create D1 database
    echo "  Creating D1 database..."
    DB_OUTPUT=$(wrangler d1 create "list-cutter-db$suffix" 2>&1)
    DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    
    if [ -z "$DB_ID" ]; then
        echo "  ⚠️  Failed to extract D1 database ID. Output:"
        echo "  $DB_OUTPUT"
    else
        echo "  ✅ D1 database created: $DB_ID"
    fi
    
    # Deploy schema
    echo "  Deploying database schema..."
    if wrangler d1 execute "list-cutter-db$suffix" --file=schema.sql --env=$env > /dev/null 2>&1; then
        echo "  ✅ Database schema deployed"
    else
        echo "  ⚠️  Failed to deploy schema to $env database"
    fi
    
    echo ""
    echo "📋 $env Environment Summary:"
    echo "  KV Namespace ID: $KV_ID"
    echo "  D1 Database ID: $DB_ID"
    echo "  Database Name: list-cutter-db$suffix"
    echo ""
}

# Create development environment
create_environment "development" "-dev"

# Create staging environment  
create_environment "staging" "-staging"

# Create production environment
create_environment "production" "-prod"

echo "🎉 Environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update wrangler.toml with the actual resource IDs shown above"
echo "2. Set production secrets:"
echo "   wrangler secret put JWT_SECRET --env=production"
echo "   wrangler secret put ENCRYPTION_KEY --env=production"
echo "   wrangler secret put API_KEY_SALT --env=production"
echo "3. Set staging and development secrets using the same commands"
echo "4. Deploy using: wrangler deploy --env=ENVIRONMENT"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"