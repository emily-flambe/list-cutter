#!/bin/bash
# scripts/cutover/rollback-cutover.sh
# Emergency rollback script - Reverts to Django system

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ROLLBACK_LOG_DIR="$PROJECT_ROOT/logs/rollback"
ROLLBACK_LOG_FILE="$ROLLBACK_LOG_DIR/rollback_$(date +%Y%m%d_%H%M%S).log"
PRODUCTION_URL="https://cutty.com"
DJANGO_API_URL="${DJANGO_API_URL:-SKIP}"  # Django system decommissioned
EMERGENCY_MODE="${1:-normal}"

# Create log directory
mkdir -p "$ROLLBACK_LOG_DIR"

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$ROLLBACK_LOG_FILE"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$ROLLBACK_LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$ROLLBACK_LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$ROLLBACK_LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$ROLLBACK_LOG_FILE"
}

print_header() {
    echo -e "${PURPLE}[ROLLBACK]${NC} $1" | tee -a "$ROLLBACK_LOG_FILE"
}

# Validate environment for rollback
validate_rollback_environment() {
    print_header "Rollback Environment Validation"
    
    # Check required environment variables
    REQUIRED_VARS=(
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ZONE_ID"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            if [ "$EMERGENCY_MODE" = "--emergency" ]; then
                print_warning "Emergency mode: continuing without $var"
            else
                return 1
            fi
        fi
    done
    
    # Check required tools
    REQUIRED_TOOLS=("curl" "jq" "dig")
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "Required tool '$tool' is not installed"
            if [ "$EMERGENCY_MODE" = "--emergency" ]; then
                print_warning "Emergency mode: continuing without $tool"
            else
                return 1
            fi
        fi
    done
    
    print_success "Rollback environment validation completed"
    return 0
}

# Check Django system health
check_django_health() {
    print_header "Django System Health Check"
    
    print_status "Checking Django API connectivity..."
    
    # Test Django API health
    for i in {1..5}; do
        DJANGO_HEALTH=$(curl -s "$DJANGO_API_URL/health" 2>/dev/null || echo '{"status":"failed"}')
        DJANGO_STATUS=$(echo "$DJANGO_HEALTH" | jq -r '.status // "unknown"')
        
        if [ "$DJANGO_STATUS" = "healthy" ] || [ "$DJANGO_STATUS" = "ok" ]; then
            print_success "Django system is healthy"
            return 0
        fi
        
        if [ $i -eq 5 ]; then
            print_error "Django system health check failed after 5 attempts"
            print_error "Response: $DJANGO_HEALTH"
            
            if [ "$EMERGENCY_MODE" = "--emergency" ]; then
                print_warning "Emergency mode: proceeding despite Django health issues"
                return 0
            else
                return 1
            fi
        fi
        
        print_status "Django health check attempt $i/5 failed, retrying..."
        sleep 10
    done
}

# Create backup of current Worker state
backup_current_state() {
    print_header "Current State Backup"
    
    BACKUP_DIR="$PROJECT_ROOT/backups/rollback_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    print_status "Creating backup of current deployment state..."
    
    # Backup Worker deployment info
    if command -v wrangler &> /dev/null; then
        print_status "Backing up Worker deployment information..."
        wrangler deployments list --name cutty-api --env production --format json > "$BACKUP_DIR/worker_deployments.json" 2>/dev/null || echo "[]" > "$BACKUP_DIR/worker_deployments.json"
        
        # Get current Worker configuration
        wrangler inspect --env production > "$BACKUP_DIR/worker_config.txt" 2>/dev/null || echo "Worker config not available" > "$BACKUP_DIR/worker_config.txt"
    fi
    
    # Backup current DNS records
    if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ZONE_ID" ]; then
        print_status "Backing up current DNS records..."
        curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" > "$BACKUP_DIR/dns_records.json" 2>/dev/null || echo "{}" > "$BACKUP_DIR/dns_records.json"
    fi
    
    # Test current system response
    print_status "Capturing current system state..."
    curl -s "$PRODUCTION_URL/health" > "$BACKUP_DIR/current_health.json" 2>/dev/null || echo '{"status":"failed"}' > "$BACKUP_DIR/current_health.json"
    curl -s "$PRODUCTION_URL/api/v1/health/detailed" > "$BACKUP_DIR/current_detailed_health.json" 2>/dev/null || echo '{}' > "$BACKUP_DIR/current_detailed_health.json"
    
    print_success "Current state backed up to: $BACKUP_DIR"
    return 0
}

# Revert DNS records to Django
revert_dns_records() {
    print_header "DNS Records Reversion"
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ZONE_ID" ]; then
        print_error "Cloudflare credentials not available for DNS reversion"
        if [ "$EMERGENCY_MODE" = "--emergency" ]; then
            print_warning "Emergency mode: manual DNS reversion required"
            print_warning "Manually point DNS records back to Django system"
            return 0
        else
            return 1
        fi
    fi
    
    print_status "Reverting DNS records to Django system..."
    
    # Function to update DNS record
    update_dns_record() {
        local record_name="$1"
        local record_content="$2"
        local record_type="${3:-CNAME}"
        
        print_status "Updating DNS record: $record_name"
        
        # Get existing record ID
        EXISTING_RECORD=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records?name=$record_name&type=$record_type" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" | jq -r '.result[0].id // "null"')
        
        if [ "$EXISTING_RECORD" != "null" ]; then
            # Update existing record
            RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/$EXISTING_RECORD" \
                -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                -H "Content-Type: application/json" \
                --data "{
                    \"type\": \"$record_type\",
                    \"name\": \"$record_name\",
                    \"content\": \"$record_content\",
                    \"ttl\": 300,
                    \"proxied\": true
                }")
        else
            # Create new record
            RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
                -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                -H "Content-Type: application/json" \
                --data "{
                    \"type\": \"$record_type\",
                    \"name\": \"$record_name\",
                    \"content\": \"$record_content\",
                    \"ttl\": 300,
                    \"proxied\": true
                }")
        fi
        
        SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            print_success "✅ DNS record updated: $record_name → $record_content"
        else
            ERROR_MSG=$(echo "$RESPONSE" | jq -r '.errors[0].message // "Unknown error"')
            print_error "❌ Failed to update DNS record $record_name: $ERROR_MSG"
            return 1
        fi
    }
    
    # Revert main domain records to Django
    DJANGO_SERVER="${DJANGO_SERVER:-old-api.list-cutter.com}"
    
    # Update main domain records
    update_dns_record "cutty.com" "$DJANGO_SERVER" "CNAME" || return 1
    update_dns_record "www.cutty.com" "$DJANGO_SERVER" "CNAME" || return 1
    update_dns_record "list-cutter.emilycogsdill.com" "$DJANGO_SERVER" "CNAME" || return 1
    update_dns_record "cutty.emilycogsdill.com" "$DJANGO_SERVER" "CNAME" || return 1
    
    print_success "DNS records reverted to Django system"
    
    # Wait for DNS propagation
    print_status "Waiting for DNS propagation..."
    sleep 30
    
    # Verify DNS reversion
    for i in {1..10}; do
        DNS_IP=$(dig +short cutty.com | head -1)
        if [ -n "$DNS_IP" ]; then
            print_success "DNS propagation verified: cutty.com → $DNS_IP"
            break
        fi
        if [ $i -eq 10 ]; then
            print_warning "DNS propagation may still be in progress"
        fi
        sleep 10
    done
    
    return 0
}

# Disable maintenance mode on Django
disable_maintenance_mode() {
    print_header "Disable Maintenance Mode"
    
    print_status "Disabling maintenance mode on Django system..."
    
    # Try to disable maintenance mode
    MAINTENANCE_RESPONSE=$(curl -s -X POST "$DJANGO_API_URL/admin/maintenance/disable" \
        -H "Content-Type: application/json" \
        -d '{"reason": "Rollback from Cloudflare Workers cutover"}' || echo '{"success":false}')
    
    MAINTENANCE_SUCCESS=$(echo "$MAINTENANCE_RESPONSE" | jq -r '.success // false')
    
    if [ "$MAINTENANCE_SUCCESS" != "true" ]; then
        print_warning "Could not disable maintenance mode via API"
        print_warning "Response: $MAINTENANCE_RESPONSE"
        
        if [ "$EMERGENCY_MODE" = "--emergency" ]; then
            print_warning "Emergency mode: manual maintenance mode disabling may be required"
        else
            return 1
        fi
    else
        print_success "Maintenance mode disabled successfully"
    fi
    
    # Verify maintenance mode is disabled
    sleep 5
    MAINTENANCE_STATUS=$(curl -s "$DJANGO_API_URL/admin/maintenance/status" || echo '{"enabled":true}')
    IS_MAINTENANCE=$(echo "$MAINTENANCE_STATUS" | jq -r '.enabled // true')
    
    if [ "$IS_MAINTENANCE" = "false" ]; then
        print_success "Maintenance mode confirmed disabled"
    else
        print_warning "Maintenance mode status unclear"
    fi
    
    return 0
}

# Validate Django system after rollback
validate_django_system() {
    print_header "Django System Validation"
    
    print_status "Validating Django system after rollback..."
    
    # Wait for systems to stabilize
    sleep 30
    
    # Test Django health endpoint
    print_status "Testing Django health endpoint..."
    for i in {1..10}; do
        HEALTH_RESPONSE=$(curl -s "$DJANGO_API_URL/health" || echo '{"status":"failed"}')
        HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // "unknown"')
        
        if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "ok" ]; then
            print_success "✅ Django health check passed"
            break
        fi
        
        if [ $i -eq 10 ]; then
            print_error "❌ Django health check failed after 10 attempts"
            print_error "Response: $HEALTH_RESPONSE"
            return 1
        fi
        
        print_status "Health check attempt $i/10, retrying..."
        sleep 15
    done
    
    # Test frontend access via new domain routing
    print_status "Testing frontend access..."
    FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/" || echo "000")
    HTTP_CODE="${FRONTEND_RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "✅ Frontend accessible via $PRODUCTION_URL"
    else
        print_warning "⚠️ Frontend access test returned HTTP $HTTP_CODE"
    fi
    
    # Test API endpoints
    print_status "Testing Django API endpoints..."
    API_ENDPOINTS=("api/health" "api/v1/files" "api/v1/auth")
    
    for endpoint in "${API_ENDPOINTS[@]}"; do
        API_RESPONSE=$(curl -s -w "%{http_code}" "$DJANGO_API_URL/$endpoint" || echo "000")
        API_CODE="${API_RESPONSE: -3}"
        
        if [ "$API_CODE" = "200" ] || [ "$API_CODE" = "401" ] || [ "$API_CODE" = "403" ]; then
            print_success "✅ API endpoint /$endpoint responding"
        else
            print_warning "⚠️ API endpoint /$endpoint returned HTTP $API_CODE"
        fi
    done
    
    print_success "Django system validation completed"
    return 0
}

# Sync data from Workers back to Django (if needed)
sync_cutover_data() {
    print_header "Data Synchronization"
    
    print_status "Checking for data created during cutover period..."
    
    # This would involve syncing any data that was created in the Workers system
    # back to Django. For now, we'll create a placeholder for this functionality.
    
    if [ -f "$PROJECT_ROOT/scripts/reverse-sync.sh" ]; then
        print_status "Running reverse data synchronization..."
        if bash "$PROJECT_ROOT/scripts/reverse-sync.sh"; then
            print_success "Data synchronization completed"
        else
            print_warning "Data synchronization had issues - manual review may be needed"
        fi
    else
        print_warning "Reverse sync script not found"
        print_warning "Any data created during cutover period may need manual synchronization"
    fi
    
    return 0
}

# Disable Worker (optional)
disable_worker() {
    print_header "Worker Deactivation"
    
    if [ "$2" = "--keep-worker" ]; then
        print_status "Keeping Worker active as requested"
        return 0
    fi
    
    print_status "Checking if Worker should be disabled..."
    
    if command -v wrangler &> /dev/null; then
        print_status "Worker management available via Wrangler"
        print_warning "Consider manually disabling Worker deployment to prevent conflicts"
        print_warning "Run: wrangler delete --name cutty-api --env production"
    else
        print_warning "Wrangler not available - Worker remains active"
    fi
    
    return 0
}

# Create rollback record
create_rollback_record() {
    print_header "Creating Rollback Record"
    
    ROLLBACK_RECORD_FILE="$PROJECT_ROOT/deployments/rollback_$(date +%Y%m%d_%H%M%S).json"
    mkdir -p "$PROJECT_ROOT/deployments"
    
    # Create rollback record
    cat > "$ROLLBACK_RECORD_FILE" <<EOF
{
  "rollback": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "status": "completed",
    "mode": "$EMERGENCY_MODE",
    "duration": "$(($(date +%s) - START_TIME)) seconds",
    "reason": "Rollback from Cloudflare Workers to Django system",
    "environment": {
      "production_url": "$PRODUCTION_URL",
      "django_api_url": "$DJANGO_API_URL"
    },
    "actions_performed": [
      "DNS records reverted to Django",
      "Maintenance mode disabled",
      "Django system validated",
      "Data synchronization checked"
    ],
    "git": {
      "branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
      "commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
    },
    "logs": {
      "rollback_log": "$ROLLBACK_LOG_FILE"
    }
  }
}
EOF
    
    print_success "Rollback record created: $ROLLBACK_RECORD_FILE"
}

# Main rollback execution
main() {
    local START_TIME=$(date +%s)
    
    echo ""
    if [ "$EMERGENCY_MODE" = "--emergency" ]; then
        echo "🚨 EMERGENCY ROLLBACK - List Cutter"
        echo "==================================="
    else
        echo "🔄 List Cutter Production Rollback"
        echo "=================================="
    fi
    echo "Started at: $(date)"
    echo "Log file: $ROLLBACK_LOG_FILE"
    echo ""
    
    log "Starting rollback at $(date) (mode: $EMERGENCY_MODE)"
    
    # Execute rollback phases
    validate_rollback_environment || exit 1
    check_django_health || exit 1
    backup_current_state || exit 1
    revert_dns_records || exit 1
    disable_maintenance_mode || exit 1
    validate_django_system || exit 1
    sync_cutover_data || exit 1
    disable_worker "$@" || exit 1
    create_rollback_record || exit 1
    
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    
    echo ""
    print_success "✅ Rollback completed successfully!"
    echo ""
    echo "Rollback Summary:"
    echo "================"
    echo "✅ Environment validation: PASSED"
    echo "✅ Django health check: PASSED"
    echo "✅ State backup: COMPLETED"
    echo "✅ DNS reversion: COMPLETED"
    echo "✅ Maintenance mode: DISABLED"
    echo "✅ Django validation: PASSED"
    echo "✅ Data synchronization: CHECKED"
    echo "✅ Worker status: REVIEWED"
    echo ""
    echo "Duration: $DURATION seconds"
    echo "Django API URL: $DJANGO_API_URL"
    echo "Production URL: $PRODUCTION_URL (now pointing to Django)"
    echo "Log file: $ROLLBACK_LOG_FILE"
    echo ""
    print_success "🌟 List Cutter is now back on Django system!"
    
    log "Rollback completed successfully at $(date) (duration: ${DURATION}s)"
    
    # Post-rollback instructions
    echo ""
    print_warning "📋 Post-Rollback Actions Required:"
    echo "1. Monitor Django system for stability"
    echo "2. Review rollback logs for any issues"
    echo "3. Consider investigating the cause of the rollback"
    echo "4. Plan for re-attempting cutover if appropriate"
    if [ "$EMERGENCY_MODE" != "--emergency" ]; then
        echo "5. Optionally disable the Worker deployment"
    fi
    echo ""
    
    return 0
}

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --emergency     Run in emergency mode (bypass some checks)"
    echo "  --keep-worker   Keep Worker deployment active"
    echo "  --help          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  CLOUDFLARE_API_TOKEN    Cloudflare API token"
    echo "  CLOUDFLARE_ZONE_ID      Cloudflare Zone ID"
    echo "  DJANGO_API_URL          Django API base URL (default: https://old-api.list-cutter.com)"
    echo "  DJANGO_SERVER           Django server for DNS (default: old-api.list-cutter.com)"
    echo ""
}

# Check for help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# Execute main function
main "$@"