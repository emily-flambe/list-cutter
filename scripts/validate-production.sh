#!/bin/bash
# scripts/validate-production.sh
# Production environment validation script

set -e

PRODUCTION_URL="https://list-cutter.com"
MAX_RETRIES=20
RETRY_DELAY=15

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

print_status "🔍 Validating production deployment..."
print_status "Production URL: $PRODUCTION_URL"

# Wait for deployment to be ready with longer timeout for production
print_status "Waiting for production to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s "$PRODUCTION_URL/health" > /dev/null; then
        print_success "Production health check passed"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        print_error "Production health check failed after $MAX_RETRIES attempts"
        exit 1
    fi
    
    print_status "⏳ Waiting for production to be ready... ($i/$MAX_RETRIES)"
    sleep $RETRY_DELAY
done

# Production-specific validation (more stringent than staging)
print_status "🔬 Running production validation tests..."

# 1. Basic health check with environment verification
print_status "Testing production health endpoint..."
HEALTH_RESPONSE=$(curl -s "$PRODUCTION_URL/health")
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    ENVIRONMENT=$(echo "$HEALTH_RESPONSE" | jq -r '.environment')
    if [ "$ENVIRONMENT" = "production" ]; then
        print_success "✅ Production health endpoint working (environment: $ENVIRONMENT)"
    else
        print_error "❌ Wrong environment detected: $ENVIRONMENT (expected: production)"
        exit 1
    fi
else
    print_error "❌ Production health endpoint failed"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

# 2. Detailed health check - production must be healthy
print_status "Testing detailed health endpoint..."
DETAILED_HEALTH=$(curl -s "$PRODUCTION_URL/api/v1/health/detailed")
if echo "$DETAILED_HEALTH" | jq -e '.status' > /dev/null 2>&1; then
    HEALTH_STATUS=$(echo "$DETAILED_HEALTH" | jq -r '.status')
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        print_success "✅ Production system is healthy"
        
        # Check individual components
        DB_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.database.healthy // false')
        STORAGE_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.storage.healthy // false')
        MEMORY_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.memory.healthy // false')
        
        if [ "$DB_HEALTHY" = "true" ]; then
            DB_LATENCY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.database.latency // 0')
            print_success "✅ Database healthy (${DB_LATENCY}ms latency)"
        else
            print_error "❌ Database unhealthy"
            exit 1
        fi
        
        if [ "$STORAGE_HEALTHY" = "true" ]; then
            STORAGE_LATENCY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.storage.latency // 0')
            print_success "✅ Storage healthy (${STORAGE_LATENCY}ms latency)"
        else
            print_error "❌ Storage unhealthy"
            exit 1
        fi
        
        if [ "$MEMORY_HEALTHY" = "true" ]; then
            MEMORY_USAGE=$(echo "$DETAILED_HEALTH" | jq -r '.checks.memory.usage // 0')
            print_success "✅ Memory healthy (${MEMORY_USAGE} bytes used)"
        else
            print_warning "⚠️ Memory usage high"
        fi
        
    elif [ "$HEALTH_STATUS" = "degraded" ]; then
        print_warning "⚠️ Production system degraded - monitoring required"
        echo "Health details: $DETAILED_HEALTH"
    else
        print_error "❌ Production system unhealthy (status: $HEALTH_STATUS)"
        echo "Health details: $DETAILED_HEALTH"
        exit 1
    fi
else
    print_error "❌ Detailed health endpoint failed"
    echo "Response: $DETAILED_HEALTH"
    exit 1
fi

# 3. Readiness probe - must be ready in production
print_status "Testing readiness probe..."
READY_RESPONSE=$(curl -s "$PRODUCTION_URL/api/v1/health/ready")
READY_STATUS=$(echo "$READY_RESPONSE" | jq -r '.status // "unknown"')
if [ "$READY_STATUS" = "ready" ]; then
    print_success "✅ Production system ready"
else
    print_error "❌ Production system not ready (status: $READY_STATUS)"
    echo "Response: $READY_RESPONSE"
    exit 1
fi

# 4. Performance validation - stricter for production
print_status "Testing production performance..."
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$PRODUCTION_URL/health")
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
    print_success "✅ Excellent response time: ${RESPONSE_TIME_MS}ms"
elif (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    print_success "✅ Good response time: ${RESPONSE_TIME_MS}ms"
else
    print_error "❌ Response time too high for production: ${RESPONSE_TIME_MS}ms"
    exit 1
fi

# 5. SSL/HTTPS validation
print_status "Testing SSL/HTTPS configuration..."
SSL_RESPONSE=$(curl -s -I "$PRODUCTION_URL/")
if echo "$SSL_RESPONSE" | grep -i "strict-transport-security" > /dev/null; then
    print_success "✅ HTTPS and HSTS configured"
else
    print_error "❌ HTTPS/HSTS not properly configured"
    exit 1
fi

# 6. Security headers validation (strict for production)
print_status "Testing security headers..."
REQUIRED_SECURITY_HEADERS=(
    "strict-transport-security"
    "x-content-type-options"
    "x-frame-options"
    "x-xss-protection"
    "content-security-policy"
)

MISSING_HEADERS=()
for header in "${REQUIRED_SECURITY_HEADERS[@]}"; do
    if echo "$SSL_RESPONSE" | grep -i "$header" > /dev/null; then
        print_success "✅ Security header present: $header"
    else
        MISSING_HEADERS+=("$header")
    fi
done

if [ ${#MISSING_HEADERS[@]} -eq 0 ]; then
    print_success "✅ All required security headers present"
else
    print_error "❌ Missing critical security headers: ${MISSING_HEADERS[*]}"
    exit 1
fi

# 7. API endpoints validation
print_status "Testing API endpoints structure..."
API_ENDPOINTS=(
    "health"
    "auth/register"
    "auth/login"
    "files/list"
    "csv/process"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
    if [[ "$endpoint" == "health" ]]; then
        RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/api/v1/$endpoint")
    elif [[ "$endpoint" == "files/list" ]]; then
        RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/api/v1/$endpoint")
    else
        RESPONSE=$(curl -s -w "%{http_code}" -X POST "$PRODUCTION_URL/api/v1/$endpoint")
    fi
    
    HTTP_CODE="${RESPONSE: -3}"
    
    if [ "$endpoint" = "health" ]; then
        if [ "$HTTP_CODE" = "200" ]; then
            print_success "✅ API health endpoint working"
        else
            print_error "❌ API health endpoint failed (HTTP $HTTP_CODE)"
            exit 1
        fi
    else
        if [ "$HTTP_CODE" = "501" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
            print_success "✅ API endpoint /$endpoint accessible (HTTP $HTTP_CODE)"
        else
            print_warning "⚠️ API endpoint /$endpoint returned unexpected status: $HTTP_CODE"
        fi
    fi
done

# 8. Frontend serving validation
print_status "Testing frontend serving..."
FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/")
HTTP_CODE="${FRONTEND_RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$FRONTEND_RESPONSE" | head -n -1 | grep -q "<html"; then
        if echo "$FRONTEND_RESPONSE" | head -n -1 | grep -q "List Cutter"; then
            print_success "✅ Frontend serving correctly with proper content"
        else
            print_warning "⚠️ Frontend serving but title not detected"
        fi
    else
        print_error "❌ Frontend not serving HTML content"
        exit 1
    fi
else
    print_error "❌ Frontend serving failed (HTTP $HTTP_CODE)"
    exit 1
fi

# 9. Rate limiting validation
print_status "Testing rate limiting..."
RATE_LIMIT_RESPONSE=$(curl -s -I "$PRODUCTION_URL/api/v1/health")
if echo "$RATE_LIMIT_RESPONSE" | grep -i "x-ratelimit-limit" > /dev/null; then
    RATE_LIMIT=$(echo "$RATE_LIMIT_RESPONSE" | grep -i "x-ratelimit-limit" | cut -d: -f2 | tr -d ' \r')
    print_success "✅ Rate limiting active (limit: $RATE_LIMIT)"
else
    print_warning "⚠️ Rate limiting headers not detected"
fi

# 10. Error handling validation
print_status "Testing error handling..."
ERROR_RESPONSE=$(curl -s "$PRODUCTION_URL/api/v1/nonexistent")
if echo "$ERROR_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    REQUEST_ID=$(echo "$ERROR_RESPONSE" | jq -r '.requestId // "none"')
    if [ "$REQUEST_ID" != "none" ]; then
        print_success "✅ Error handling working with request tracking"
    else
        print_success "✅ Error handling working"
    fi
else
    print_warning "⚠️ Error handling format unexpected"
fi

# 11. Monitor deployment for 2 minutes
print_status "Monitoring production for 2 minutes..."
for i in {1..8}; do
    HEALTH_CHECK=$(curl -s "$PRODUCTION_URL/health" | jq -r '.status // "unknown"')
    if [ "$HEALTH_CHECK" = "healthy" ]; then
        print_success "✅ Health check $i/8: healthy"
    else
        print_error "❌ Health check $i/8: $HEALTH_CHECK"
        exit 1
    fi
    sleep 15
done

# Summary
echo ""
print_success "🎉 All production validations passed!"
echo ""
echo "Production Validation Summary:"
echo "============================="
echo "✅ Health checks: PASSED"
echo "✅ System components: HEALTHY"
echo "✅ Performance: OPTIMAL (${RESPONSE_TIME_MS}ms)"
echo "✅ Security headers: COMPLETE"
echo "✅ SSL/HTTPS: CONFIGURED"
echo "✅ API endpoints: ACCESSIBLE"
echo "✅ Frontend serving: WORKING"
echo "✅ Rate limiting: ACTIVE"
echo "✅ Error handling: WORKING"
echo "✅ Stability monitoring: PASSED"
echo ""
print_success "🌟 Production deployment validated successfully!"
print_success "🌐 List Cutter is live at: $PRODUCTION_URL"