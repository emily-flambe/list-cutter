#!/bin/bash

# List Cutter Workers Deployment Validation Script
# This script validates that all environments are properly configured and healthy

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to test health endpoint
test_health_endpoint() {
    local url=$1
    local env_name=$2
    
    echo ""
    print_status "INFO" "Testing health endpoints for $env_name environment..."
    
    # Test basic health endpoint
    if curl -s -f "$url/health" > /dev/null; then
        print_status "SUCCESS" "Basic health check passed"
        
        # Get and display health info
        HEALTH_INFO=$(curl -s "$url/health" | jq -r '.environment // "unknown"')
        print_status "INFO" "Environment: $HEALTH_INFO"
    else
        print_status "ERROR" "Basic health check failed"
        return 1
    fi
    
    # Test auth health endpoint
    if curl -s -f "$url/health/auth" > /dev/null; then
        print_status "SUCCESS" "Auth health check passed"
        
        # Get and display service status
        AUTH_HEALTH=$(curl -s "$url/health/auth")
        DB_STATUS=$(echo "$AUTH_HEALTH" | jq -r '.services.database // "unknown"')
        KV_STATUS=$(echo "$AUTH_HEALTH" | jq -r '.services.kv // "unknown"')
        R2_STATUS=$(echo "$AUTH_HEALTH" | jq -r '.services.r2 // "unknown"')
        
        print_status "INFO" "Database: $DB_STATUS"
        print_status "INFO" "KV Store: $KV_STATUS"
        print_status "INFO" "R2 Storage: $R2_STATUS"
    else
        print_status "ERROR" "Auth health check failed"
        return 1
    fi
}

# Function to validate wrangler configuration
validate_wrangler_config() {
    print_status "INFO" "Validating wrangler.toml configuration..."
    
    if [ ! -f "wrangler.toml" ]; then
        print_status "ERROR" "wrangler.toml not found"
        return 1
    fi
    
    # Check for placeholder values
    if grep -q "REPLACE_WITH_ACTUAL" wrangler.toml; then
        print_status "WARNING" "Found placeholder values in wrangler.toml"
        grep -n "REPLACE_WITH_ACTUAL" wrangler.toml
        return 1
    else
        print_status "SUCCESS" "No placeholder values found in wrangler.toml"
    fi
}

# Function to validate secrets
validate_secrets() {
    local env=$1
    print_status "INFO" "Validating secrets for $env environment..."
    
    # List secrets for the environment
    SECRETS=$(wrangler secret list --env=$env 2>/dev/null || echo "")
    
    if echo "$SECRETS" | grep -q "JWT_SECRET"; then
        print_status "SUCCESS" "JWT_SECRET is configured"
    else
        print_status "WARNING" "JWT_SECRET is missing"
    fi
    
    if echo "$SECRETS" | grep -q "ENCRYPTION_KEY"; then
        print_status "SUCCESS" "ENCRYPTION_KEY is configured"
    else
        print_status "WARNING" "ENCRYPTION_KEY is missing (optional)"
    fi
    
    if echo "$SECRETS" | grep -q "API_KEY_SALT"; then
        print_status "SUCCESS" "API_KEY_SALT is configured"
    else
        print_status "WARNING" "API_KEY_SALT is missing (optional)"
    fi
}

# Function to validate database
validate_database() {
    local env=$1
    local db_name=$2
    
    print_status "INFO" "Validating database for $env environment..."
    
    # Test database connection
    if wrangler d1 execute "$db_name" --command="SELECT 1 as test;" --env=$env > /dev/null 2>&1; then
        print_status "SUCCESS" "Database connection successful"
        
        # Check if tables exist
        TABLES=$(wrangler d1 execute "$db_name" --command="SELECT name FROM sqlite_master WHERE type='table';" --env=$env 2>/dev/null | tail -n +2)
        
        if echo "$TABLES" | grep -q "users"; then
            print_status "SUCCESS" "Users table exists"
        else
            print_status "ERROR" "Users table missing"
        fi
        
        if echo "$TABLES" | grep -q "saved_files"; then
            print_status "SUCCESS" "Saved files table exists"
        else
            print_status "ERROR" "Saved files table missing"
        fi
        
        if echo "$TABLES" | grep -q "file_relationships"; then
            print_status "SUCCESS" "File relationships table exists"
        else
            print_status "ERROR" "File relationships table missing"
        fi
    else
        print_status "ERROR" "Database connection failed"
        return 1
    fi
}

# Main validation function
main() {
    echo "🔍 List Cutter Workers Deployment Validation"
    echo "=============================================="
    
    # Check if jq is available for JSON parsing
    if ! command -v jq &> /dev/null; then
        print_status "WARNING" "jq not found. Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
        echo "Some tests will be skipped."
        echo ""
    fi
    
    # Validate wrangler configuration
    validate_wrangler_config
    echo ""
    
    # Get worker subdomain (you'll need to replace YOUR_ACCOUNT with actual account)
    print_status "INFO" "Note: Replace YOUR_ACCOUNT with your actual Cloudflare account subdomain in URLs"
    echo ""
    
    # Test environments
    ENVIRONMENTS=("development:cutty:cutty-dev" 
                  "production:cutty:cutty-production")
    
    for env_config in "${ENVIRONMENTS[@]}"; do
        IFS=':' read -r env_name worker_name db_name <<< "$env_config"
        
        echo "🧪 Testing $env_name Environment"
        echo "================================"
        
        # Validate secrets
        validate_secrets "$env_name"
        echo ""
        
        # Validate database
        validate_database "$env_name" "$db_name"
        echo ""
        
        # Test health endpoints (if URLs are accessible)
        WORKER_URL="https://$worker_name.YOUR_ACCOUNT.workers.dev"
        print_status "INFO" "Worker URL: $WORKER_URL"
        print_status "INFO" "To test manually: curl $WORKER_URL/health"
        
        # Note: Uncomment the following line if you want to test live endpoints
        # test_health_endpoint "$WORKER_URL" "$env_name"
        
        echo ""
    done
    
    # Test custom domains (production only)
    echo "🌐 Custom Domain Tests"
    echo "====================="
    print_status "INFO" "Production domains:"
    print_status "INFO" "  - https://cutty.emilycogsdill.com/health"
    print_status "INFO" "  - https://list-cutter.emilycogsdill.com/health"
    print_status "INFO" "Test these manually after DNS propagation"
    echo ""
    
    echo "✨ Validation complete!"
    echo ""
    echo "📋 Summary:"
    echo "- Check that all placeholder values in wrangler.toml are replaced"
    echo "- Ensure all required secrets are configured for each environment"
    echo "- Verify database tables exist and are accessible"
    echo "- Test health endpoints manually using provided URLs"
    echo ""
    echo "🚀 If all checks pass, your deployment is ready!"
}

# Run main function
main "$@"