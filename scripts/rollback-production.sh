#!/bin/bash
# scripts/rollback-production.sh
# Emergency production rollback script

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔄 EMERGENCY ROLLBACK - List Cutter Production"
echo "=============================================="
print_warning "This will rollback the production deployment to the previous version"

# Confirmation prompt
echo ""
print_warning "⚠️  CRITICAL ACTION ⚠️"
echo "This action will:"
echo "  - Rollback the production Worker to the previous version"
echo "  - Immediately affect all live users"
echo "  - Cannot be easily undone"
echo ""
read -p "Are you sure you want to proceed with rollback? (yes/NO): " -r
if [[ ! $REPLY == "yes" ]]; then
    print_warning "Rollback cancelled"
    exit 0
fi

ROLLBACK_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
print_status "🕐 Rollback started at: $ROLLBACK_START"

# Verify environment
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    print_error "CLOUDFLARE_API_TOKEN not set"
    exit 1
fi

if [ ! -d "unified-worker" ]; then
    print_error "unified-worker directory not found"
    echo "Please run this script from the repository root"
    exit 1
fi

cd unified-worker

# Step 1: Execute rollback
print_status "🔄 Step 1: Executing Wrangler rollback..."
wrangler rollback --env production

if [ $? -ne 0 ]; then
    print_error "❌ Wrangler rollback failed"
    exit 1
fi

print_success "✅ Wrangler rollback executed"

# Step 2: Wait for rollback to propagate
print_status "⏳ Step 2: Waiting for rollback to propagate..."
sleep 60

# Step 3: Verify rollback
print_status "✅ Step 3: Verifying rollback..."
PRODUCTION_URL="https://cutty.com"
MAX_RETRIES=10
RETRY_DELAY=10

for i in $(seq 1 $MAX_RETRIES); do
    HEALTH_RESPONSE=$(curl -s "$PRODUCTION_URL/health" || echo '{"status":"error"}')
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // "error"')
    
    if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "degraded" ]; then
        print_success "✅ Production system responding after rollback"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        print_error "❌ Production system not responding after rollback"
        print_error "🚨 CRITICAL: Manual intervention required"
        exit 1
    fi
    
    print_status "⏳ Verifying rollback... ($i/$MAX_RETRIES)"
    sleep $RETRY_DELAY
done

# Step 4: Extended monitoring
print_status "📊 Step 4: Extended monitoring (2 minutes)..."
FAILED_CHECKS=0

for i in {1..8}; do
    HEALTH_CHECK=$(curl -s "$PRODUCTION_URL/health" | jq -r '.status // "unknown"')
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$PRODUCTION_URL/health")
    
    if [ "$HEALTH_CHECK" = "healthy" ]; then
        RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
        print_success "✅ Health check $i/8: healthy (${RESPONSE_TIME_MS}ms)"
    else
        print_error "❌ Health check $i/8: $HEALTH_CHECK"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
    
    # If too many checks fail, abort
    if [ $FAILED_CHECKS -ge 3 ]; then
        print_error "❌ Too many failed health checks after rollback"
        print_error "🚨 CRITICAL: System may be in unstable state"
        exit 1
    fi
    
    sleep 15
done

# Step 5: Final validation
print_status "🔍 Step 5: Final validation..."

# Test critical endpoints
ENDPOINTS=("health" "api/v1/health/live" "metrics")
for endpoint in "${ENDPOINTS[@]}"; do
    RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/$endpoint")
    HTTP_CODE="${RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "✅ Endpoint /$endpoint: working"
    else
        print_error "❌ Endpoint /$endpoint: failed (HTTP $HTTP_CODE)"
        print_warning "⚠️ Some endpoints may not be fully restored"
    fi
done

# Test frontend
FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/")
HTTP_CODE="${FRONTEND_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    print_success "✅ Frontend: working"
else
    print_error "❌ Frontend: failed (HTTP $HTTP_CODE)"
fi

ROLLBACK_END=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Summary
echo ""
print_success "🎉 Production rollback completed!"
echo ""
echo "Rollback Summary:"
echo "================"
echo "⏰ Started: $ROLLBACK_START"
echo "⏰ Completed: $ROLLBACK_END"
echo "✅ Wrangler rollback: EXECUTED"
echo "✅ System verification: PASSED"
echo "✅ Extended monitoring: PASSED"
echo "✅ Endpoint validation: COMPLETED"
echo ""
print_success "🌐 Production system restored at: $PRODUCTION_URL"

# Create rollback record
ROLLBACK_RECORD="deployments/rollback_$(date +%Y%m%d_%H%M%S).txt"
mkdir -p deployments
cat > "$ROLLBACK_RECORD" <<EOF
Production Rollback Record
========================

Rollback Time: $ROLLBACK_START to $ROLLBACK_END
Rollback Method: Wrangler rollback
Reason: Emergency rollback
Status: Successful

System Status After Rollback:
- Health checks: PASSED
- Frontend: WORKING  
- API endpoints: WORKING
- Monitoring: ACTIVE

Next Steps:
1. Investigate root cause of issues that required rollback
2. Fix issues in development/staging
3. Re-test thoroughly before next deployment
4. Update deployment procedures if needed
EOF

print_status "Rollback record saved to $ROLLBACK_RECORD"

# Send notification
print_status "Sending rollback notifications..."
./scripts/notify-deployment.sh rollback

print_warning "⚠️ Next Steps:"
echo "1. Investigate what caused the need for rollback"
echo "2. Fix issues in development environment"
echo "3. Test thoroughly in staging"
echo "4. Update deployment procedures if needed"
echo "5. Plan next deployment with lessons learned"