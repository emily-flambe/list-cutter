#!/bin/bash
# scripts/cutover/validate-cutover.sh
# Post-cutover validation script - Comprehensive system validation after cutover

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
VALIDATION_LOG_DIR="$PROJECT_ROOT/logs/validation"
VALIDATION_LOG_FILE="$VALIDATION_LOG_DIR/cutover_validation_$(date +%Y%m%d_%H%M%S).log"
PRODUCTION_URL="https://cutty.com"
STAGING_URL="https://staging.cutty.com"
API_BASE="$PRODUCTION_URL/api/v1"

# Validation thresholds
MAX_RESPONSE_TIME=2000  # milliseconds
MIN_HEALTH_SCORE=85     # percentage
MAX_ERROR_RATE=5        # percentage

# Create log directory
mkdir -p "$VALIDATION_LOG_DIR"

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$VALIDATION_LOG_FILE"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$VALIDATION_LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$VALIDATION_LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$VALIDATION_LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$VALIDATION_LOG_FILE"
}

print_header() {
    echo -e "${PURPLE}[VALIDATION]${NC} $1" | tee -a "$VALIDATION_LOG_FILE"
}

# Validation results tracking
VALIDATION_RESULTS=()
FAILED_VALIDATIONS=()

# Add validation result
add_validation_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    VALIDATION_RESULTS+=("$test_name:$result:$details")
    
    if [ "$result" = "FAILED" ]; then
        FAILED_VALIDATIONS+=("$test_name")
    fi
}

# Test basic connectivity
test_basic_connectivity() {
    print_header "Basic Connectivity Tests"
    
    # Test production URL
    print_status "Testing production URL connectivity..."
    if curl -f -s --max-time 10 "$PRODUCTION_URL/health" > /dev/null; then
        print_success "✅ Production URL accessible"
        add_validation_result "basic_connectivity" "PASSED" "Production URL responds"
    else
        print_error "❌ Production URL not accessible"
        add_validation_result "basic_connectivity" "FAILED" "Production URL timeout or error"
        return 1
    fi
    
    # Test API base URL
    print_status "Testing API base URL..."
    API_RESPONSE=$(curl -s --max-time 10 "$API_BASE/health" || echo '{"status":"failed"}')
    API_STATUS=$(echo "$API_RESPONSE" | jq -r '.status // "unknown"')
    
    if [ "$API_STATUS" = "healthy" ] || [ "$API_STATUS" = "ok" ]; then
        print_success "✅ API base URL responding correctly"
        add_validation_result "api_connectivity" "PASSED" "API status: $API_STATUS"
    else
        print_error "❌ API base URL not responding correctly"
        add_validation_result "api_connectivity" "FAILED" "API status: $API_STATUS"
        return 1
    fi
    
    return 0
}

# Test health endpoints
test_health_endpoints() {
    print_header "Health Endpoints Validation"
    
    # Test basic health
    print_status "Testing basic health endpoint..."
    HEALTH_RESPONSE=$(curl -s "$PRODUCTION_URL/health")
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // "unknown"')
    ENVIRONMENT=$(echo "$HEALTH_RESPONSE" | jq -r '.environment // "unknown"')
    
    if [ "$HEALTH_STATUS" = "healthy" ] && [ "$ENVIRONMENT" = "production" ]; then
        print_success "✅ Basic health endpoint working (status: $HEALTH_STATUS, env: $ENVIRONMENT)"
        add_validation_result "basic_health" "PASSED" "Status: $HEALTH_STATUS, Environment: $ENVIRONMENT"
    else
        print_error "❌ Basic health endpoint failed"
        add_validation_result "basic_health" "FAILED" "Status: $HEALTH_STATUS, Environment: $ENVIRONMENT"
    fi
    
    # Test detailed health
    print_status "Testing detailed health endpoint..."
    DETAILED_HEALTH=$(curl -s "$API_BASE/health/detailed")
    if echo "$DETAILED_HEALTH" | jq -e '.status' > /dev/null 2>&1; then
        DETAILED_STATUS=$(echo "$DETAILED_HEALTH" | jq -r '.status')
        OVERALL_SCORE=$(echo "$DETAILED_HEALTH" | jq -r '.overallScore // 0')
        
        if [ "$DETAILED_STATUS" = "healthy" ] && (( $(echo "$OVERALL_SCORE >= $MIN_HEALTH_SCORE" | bc -l) )); then
            print_success "✅ Detailed health endpoint working (status: $DETAILED_STATUS, score: $OVERALL_SCORE)"
            add_validation_result "detailed_health" "PASSED" "Status: $DETAILED_STATUS, Score: $OVERALL_SCORE"
            
            # Check individual components
            DB_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.database.healthy // false')
            STORAGE_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.storage.healthy // false')
            MEMORY_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.memory.healthy // false')
            
            if [ "$DB_HEALTHY" = "true" ]; then
                print_success "  ✅ Database component healthy"
            else
                print_warning "  ⚠️ Database component unhealthy"
            fi
            
            if [ "$STORAGE_HEALTHY" = "true" ]; then
                print_success "  ✅ Storage component healthy"
            else
                print_warning "  ⚠️ Storage component unhealthy"
            fi
            
            if [ "$MEMORY_HEALTHY" = "true" ]; then
                print_success "  ✅ Memory component healthy"
            else
                print_warning "  ⚠️ Memory component degraded"
            fi
            
        else
            print_error "❌ Detailed health endpoint unhealthy (status: $DETAILED_STATUS, score: $OVERALL_SCORE)"
            add_validation_result "detailed_health" "FAILED" "Status: $DETAILED_STATUS, Score: $OVERALL_SCORE"
        fi
    else
        print_error "❌ Detailed health endpoint failed"
        add_validation_result "detailed_health" "FAILED" "Invalid response format"
    fi
    
    # Test readiness probe
    print_status "Testing readiness probe..."
    READY_RESPONSE=$(curl -s "$API_BASE/health/ready")
    READY_STATUS=$(echo "$READY_RESPONSE" | jq -r '.status // "unknown"')
    
    if [ "$READY_STATUS" = "ready" ]; then
        print_success "✅ Readiness probe working"
        add_validation_result "readiness_probe" "PASSED" "Status: $READY_STATUS"
    else
        print_error "❌ Readiness probe failed (status: $READY_STATUS)"
        add_validation_result "readiness_probe" "FAILED" "Status: $READY_STATUS"
    fi
    
    # Test liveness probe
    print_status "Testing liveness probe..."
    LIVE_RESPONSE=$(curl -s "$API_BASE/health/live")
    LIVE_STATUS=$(echo "$LIVE_RESPONSE" | jq -r '.status // "unknown"')
    
    if [ "$LIVE_STATUS" = "alive" ]; then
        print_success "✅ Liveness probe working"
        add_validation_result "liveness_probe" "PASSED" "Status: $LIVE_STATUS"
    else
        print_error "❌ Liveness probe failed (status: $LIVE_STATUS)"
        add_validation_result "liveness_probe" "FAILED" "Status: $LIVE_STATUS"
    fi
    
    return 0
}

# Test authentication endpoints
test_authentication_endpoints() {
    print_header "Authentication Endpoints Validation"
    
    AUTH_ENDPOINTS=("register" "login" "refresh" "logout" "user")
    
    for endpoint in "${AUTH_ENDPOINTS[@]}"; do
        print_status "Testing auth endpoint: /$endpoint"
        
        if [ "$endpoint" = "user" ]; then
            METHOD="GET"
        else
            METHOD="POST"
        fi
        
        RESPONSE=$(curl -s -w "%{http_code}" -X $METHOD "$API_BASE/auth/$endpoint" \
            -H "Content-Type: application/json" \
            -d '{}' 2>/dev/null || echo "000")
        
        HTTP_CODE="${RESPONSE: -3}"
        
        # For cutover validation, we expect these to be implemented or return proper errors
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "422" ]; then
            print_success "✅ Auth endpoint /$endpoint responding correctly (HTTP $HTTP_CODE)"
            add_validation_result "auth_$endpoint" "PASSED" "HTTP $HTTP_CODE"
        elif [ "$HTTP_CODE" = "501" ]; then
            print_warning "⚠️ Auth endpoint /$endpoint not implemented (HTTP $HTTP_CODE)"
            add_validation_result "auth_$endpoint" "WARNING" "Not implemented"
        else
            print_error "❌ Auth endpoint /$endpoint failed (HTTP $HTTP_CODE)"
            add_validation_result "auth_$endpoint" "FAILED" "HTTP $HTTP_CODE"
        fi
    done
    
    return 0
}

# Test file management endpoints
test_file_endpoints() {
    print_header "File Management Endpoints Validation"
    
    FILE_ENDPOINTS=("list" "upload" "download" "delete")
    
    for endpoint in "${FILE_ENDPOINTS[@]}"; do
        print_status "Testing files endpoint: /$endpoint"
        
        if [ "$endpoint" = "list" ]; then
            METHOD="GET"
        else
            METHOD="POST"
        fi
        
        RESPONSE=$(curl -s -w "%{http_code}" -X $METHOD "$API_BASE/files/$endpoint" 2>/dev/null || echo "000")
        HTTP_CODE="${RESPONSE: -3}"
        
        # For cutover validation, these should be implemented or return proper errors
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
            print_success "✅ Files endpoint /$endpoint responding correctly (HTTP $HTTP_CODE)"
            add_validation_result "files_$endpoint" "PASSED" "HTTP $HTTP_CODE"
        elif [ "$HTTP_CODE" = "501" ]; then
            print_warning "⚠️ Files endpoint /$endpoint not implemented (HTTP $HTTP_CODE)"
            add_validation_result "files_$endpoint" "WARNING" "Not implemented"
        else
            print_error "❌ Files endpoint /$endpoint failed (HTTP $HTTP_CODE)"
            add_validation_result "files_$endpoint" "FAILED" "HTTP $HTTP_CODE"
        fi
    done
    
    return 0
}

# Test CSV processing endpoints
test_csv_endpoints() {
    print_header "CSV Processing Endpoints Validation"
    
    CSV_ENDPOINTS=("process" "preview" "validate")
    
    for endpoint in "${CSV_ENDPOINTS[@]}"; do
        print_status "Testing CSV endpoint: /$endpoint"
        
        RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_BASE/csv/$endpoint" \
            -H "Content-Type: application/json" \
            -d '{}' 2>/dev/null || echo "000")
        
        HTTP_CODE="${RESPONSE: -3}"
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
            print_success "✅ CSV endpoint /$endpoint responding correctly (HTTP $HTTP_CODE)"
            add_validation_result "csv_$endpoint" "PASSED" "HTTP $HTTP_CODE"
        elif [ "$HTTP_CODE" = "501" ]; then
            print_warning "⚠️ CSV endpoint /$endpoint not implemented (HTTP $HTTP_CODE)"
            add_validation_result "csv_$endpoint" "WARNING" "Not implemented"
        else
            print_error "❌ CSV endpoint /$endpoint failed (HTTP $HTTP_CODE)"
            add_validation_result "csv_$endpoint" "FAILED" "HTTP $HTTP_CODE"
        fi
    done
    
    return 0
}

# Test security features
test_security_features() {
    print_header "Security Features Validation"
    
    # Test HTTPS redirect
    print_status "Testing HTTPS enforcement..."
    HTTP_RESPONSE=$(curl -s -I "http://cutty.com/" 2>/dev/null || echo "")
    if echo "$HTTP_RESPONSE" | grep -i "location:.*https" > /dev/null; then
        print_success "✅ HTTPS redirect working"
        add_validation_result "https_redirect" "PASSED" "HTTP redirects to HTTPS"
    else
        print_warning "⚠️ HTTPS redirect not detected"
        add_validation_result "https_redirect" "WARNING" "No HTTPS redirect detected"
    fi
    
    # Test security headers
    print_status "Testing security headers..."
    SECURITY_RESPONSE=$(curl -s -I "$PRODUCTION_URL/")
    
    REQUIRED_HEADERS=(
        "strict-transport-security"
        "x-content-type-options"
        "x-frame-options"
        "x-xss-protection"
        "content-security-policy"
    )
    
    MISSING_HEADERS=()
    PRESENT_HEADERS=()
    
    for header in "${REQUIRED_HEADERS[@]}"; do
        if echo "$SECURITY_RESPONSE" | grep -i "$header" > /dev/null; then
            PRESENT_HEADERS+=("$header")
            print_success "  ✅ Security header present: $header"
        else
            MISSING_HEADERS+=("$header")
            print_warning "  ⚠️ Security header missing: $header"
        fi
    done
    
    if [ ${#MISSING_HEADERS[@]} -eq 0 ]; then
        print_success "✅ All critical security headers present"
        add_validation_result "security_headers" "PASSED" "All headers present"
    elif [ ${#PRESENT_HEADERS[@]} -ge 3 ]; then
        print_warning "⚠️ Some security headers missing: ${MISSING_HEADERS[*]}"
        add_validation_result "security_headers" "WARNING" "Missing: ${MISSING_HEADERS[*]}"
    else
        print_error "❌ Critical security headers missing: ${MISSING_HEADERS[*]}"
        add_validation_result "security_headers" "FAILED" "Missing: ${MISSING_HEADERS[*]}"
    fi
    
    # Test rate limiting
    print_status "Testing rate limiting..."
    RATE_LIMIT_RESPONSE=$(curl -s -I "$API_BASE/health")
    if echo "$RATE_LIMIT_RESPONSE" | grep -i "x-ratelimit" > /dev/null; then
        RATE_LIMIT=$(echo "$RATE_LIMIT_RESPONSE" | grep -i "x-ratelimit-limit" | cut -d: -f2 | tr -d ' \r' || echo "unknown")
        print_success "✅ Rate limiting active (limit: $RATE_LIMIT)"
        add_validation_result "rate_limiting" "PASSED" "Limit: $RATE_LIMIT"
    else
        print_warning "⚠️ Rate limiting headers not detected"
        add_validation_result "rate_limiting" "WARNING" "No rate limit headers"
    fi
    
    return 0
}

# Test performance metrics
test_performance() {
    print_header "Performance Validation"
    
    # Test response times
    print_status "Testing response times..."
    
    ENDPOINTS=("health" "api/v1/health" "metrics")
    TOTAL_RESPONSE_TIME=0
    ENDPOINT_COUNT=0
    
    for endpoint in "${ENDPOINTS[@]}"; do
        RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$PRODUCTION_URL/$endpoint" 2>/dev/null || echo "999")
        RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
        
        ENDPOINT_COUNT=$((ENDPOINT_COUNT + 1))
        TOTAL_RESPONSE_TIME=$(echo "$TOTAL_RESPONSE_TIME + $RESPONSE_TIME" | bc)
        
        if (( $(echo "$RESPONSE_TIME_MS < $MAX_RESPONSE_TIME" | bc -l) )); then
            print_success "  ✅ /$endpoint: ${RESPONSE_TIME_MS}ms"
        else
            print_warning "  ⚠️ /$endpoint: ${RESPONSE_TIME_MS}ms (slow)"
        fi
    done
    
    # Calculate average response time
    AVG_RESPONSE_TIME=$(echo "scale=3; $TOTAL_RESPONSE_TIME / $ENDPOINT_COUNT" | bc)
    AVG_RESPONSE_TIME_MS=$(echo "$AVG_RESPONSE_TIME * 1000" | bc)
    
    if (( $(echo "$AVG_RESPONSE_TIME_MS < $MAX_RESPONSE_TIME" | bc -l) )); then
        print_success "✅ Average response time: ${AVG_RESPONSE_TIME_MS}ms"
        add_validation_result "performance" "PASSED" "Avg response: ${AVG_RESPONSE_TIME_MS}ms"
    else
        print_warning "⚠️ Average response time high: ${AVG_RESPONSE_TIME_MS}ms"
        add_validation_result "performance" "WARNING" "Avg response: ${AVG_RESPONSE_TIME_MS}ms"
    fi
    
    # Test concurrent requests
    print_status "Testing concurrent request handling..."
    
    # Make 5 concurrent requests
    CONCURRENT_PIDS=()
    CONCURRENT_START=$(date +%s%N)
    
    for i in {1..5}; do
        curl -s "$PRODUCTION_URL/health" > "/tmp/concurrent_test_$i.json" &
        CONCURRENT_PIDS+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${CONCURRENT_PIDS[@]}"; do
        wait $pid
    done
    
    CONCURRENT_END=$(date +%s%N)
    CONCURRENT_DURATION=$(echo "scale=3; ($CONCURRENT_END - $CONCURRENT_START) / 1000000000" | bc)
    
    # Verify all responses
    SUCCESSFUL_CONCURRENT=0
    for i in {1..5}; do
        if [ -f "/tmp/concurrent_test_$i.json" ]; then
            STATUS=$(jq -r '.status // "unknown"' "/tmp/concurrent_test_$i.json" 2>/dev/null || echo "unknown")
            if [ "$STATUS" = "healthy" ]; then
                SUCCESSFUL_CONCURRENT=$((SUCCESSFUL_CONCURRENT + 1))
            fi
            rm -f "/tmp/concurrent_test_$i.json"
        fi
    done
    
    if [ $SUCCESSFUL_CONCURRENT -eq 5 ]; then
        print_success "✅ Concurrent requests handled successfully (${CONCURRENT_DURATION}s)"
        add_validation_result "concurrent_requests" "PASSED" "5/5 successful in ${CONCURRENT_DURATION}s"
    else
        print_warning "⚠️ Some concurrent requests failed ($SUCCESSFUL_CONCURRENT/5 successful)"
        add_validation_result "concurrent_requests" "WARNING" "$SUCCESSFUL_CONCURRENT/5 successful"
    fi
    
    return 0
}

# Test data migration integrity
test_migration_integrity() {
    print_header "Data Migration Integrity Validation"
    
    # Test migration API endpoints
    print_status "Testing migration status endpoints..."
    
    MIGRATION_BATCHES=$(curl -s "$API_BASE/migration/batches" || echo '{"success":false}')
    MIGRATION_SUCCESS=$(echo "$MIGRATION_BATCHES" | jq -r '.success // false')
    
    if [ "$MIGRATION_SUCCESS" = "true" ]; then
        BATCH_COUNT=$(echo "$MIGRATION_BATCHES" | jq -r '.batches | length')
        print_success "✅ Migration API accessible (batches: $BATCH_COUNT)"
        add_validation_result "migration_api" "PASSED" "Batches available: $BATCH_COUNT"
        
        # Check if there are any completed batches
        COMPLETED_BATCHES=$(echo "$MIGRATION_BATCHES" | jq -r '.batches | map(select(.status == "completed")) | length')
        if [ "$COMPLETED_BATCHES" -gt 0 ]; then
            print_success "  ✅ Completed migration batches: $COMPLETED_BATCHES"
        else
            print_warning "  ⚠️ No completed migration batches found"
        fi
    else
        print_error "❌ Migration API not accessible"
        add_validation_result "migration_api" "FAILED" "API not accessible"
    fi
    
    # Test disaster recovery endpoints
    print_status "Testing disaster recovery endpoints..."
    
    DR_STATUS=$(curl -s "$API_BASE/disaster-recovery/status" || echo '{"success":false}')
    DR_SUCCESS=$(echo "$DR_STATUS" | jq -r '.success // false')
    
    if [ "$DR_SUCCESS" = "true" ]; then
        DR_MODE=$(echo "$DR_STATUS" | jq -r '.data.currentMode // "unknown"')
        print_success "✅ Disaster recovery API accessible (mode: $DR_MODE)"
        add_validation_result "disaster_recovery" "PASSED" "Mode: $DR_MODE"
    else
        print_warning "⚠️ Disaster recovery API not accessible"
        add_validation_result "disaster_recovery" "WARNING" "API not accessible"
    fi
    
    return 0
}

# Test frontend serving
test_frontend_serving() {
    print_header "Frontend Serving Validation"
    
    # Test main page
    print_status "Testing main page serving..."
    FRONTEND_RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/")
    HTTP_CODE="${FRONTEND_RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        # Check if it's actually HTML
        if echo "$FRONTEND_RESPONSE" | head -n -1 | grep -q "<html"; then
            # Check for List Cutter branding
            if echo "$FRONTEND_RESPONSE" | head -n -1 | grep -iq "list.cutter\|cutty"; then
                print_success "✅ Frontend serving correctly with proper branding"
                add_validation_result "frontend_serving" "PASSED" "HTML with branding"
            else
                print_warning "⚠️ Frontend serving HTML but branding not detected"
                add_validation_result "frontend_serving" "WARNING" "HTML without clear branding"
            fi
        else
            print_error "❌ Frontend not serving HTML content"
            add_validation_result "frontend_serving" "FAILED" "Non-HTML response"
        fi
    else
        print_error "❌ Frontend serving failed (HTTP $HTTP_CODE)"
        add_validation_result "frontend_serving" "FAILED" "HTTP $HTTP_CODE"
    fi
    
    # Test static assets
    print_status "Testing static asset serving..."
    ASSETS_TO_TEST=("favicon.ico" "robots.txt")
    
    for asset in "${ASSETS_TO_TEST[@]}"; do
        ASSET_RESPONSE=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/$asset" 2>/dev/null || echo "000")
        ASSET_HTTP_CODE="${ASSET_RESPONSE: -3}"
        
        if [ "$ASSET_HTTP_CODE" = "200" ]; then
            print_success "  ✅ Static asset /$asset served correctly"
        elif [ "$ASSET_HTTP_CODE" = "404" ]; then
            print_warning "  ⚠️ Static asset /$asset not found (may be expected)"
        else
            print_warning "  ⚠️ Static asset /$asset returned HTTP $ASSET_HTTP_CODE"
        fi
    done
    
    return 0
}

# Generate validation report
generate_validation_report() {
    print_header "Validation Report Generation"
    
    REPORT_FILE="$PROJECT_ROOT/reports/cutover_validation_$(date +%Y%m%d_%H%M%S).json"
    mkdir -p "$PROJECT_ROOT/reports"
    
    # Count results
    TOTAL_TESTS=0
    PASSED_TESTS=0
    WARNING_TESTS=0
    FAILED_TESTS=0
    
    for result in "${VALIDATION_RESULTS[@]}"; do
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        
        if [[ "$result" == *":PASSED:"* ]]; then
            PASSED_TESTS=$((PASSED_TESTS + 1))
        elif [[ "$result" == *":WARNING:"* ]]; then
            WARNING_TESTS=$((WARNING_TESTS + 1))
        elif [[ "$result" == *":FAILED:"* ]]; then
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    done
    
    # Calculate success rate
    SUCCESS_RATE=$(echo "scale=2; ($PASSED_TESTS + $WARNING_TESTS) * 100 / $TOTAL_TESTS" | bc)
    
    # Create JSON report
    cat > "$REPORT_FILE" <<EOF
{
  "cutover_validation": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "production_url": "$PRODUCTION_URL",
    "validation_log": "$VALIDATION_LOG_FILE",
    "summary": {
      "total_tests": $TOTAL_TESTS,
      "passed": $PASSED_TESTS,
      "warnings": $WARNING_TESTS,
      "failed": $FAILED_TESTS,
      "success_rate": $SUCCESS_RATE
    },
    "results": [
EOF
    
    # Add individual results
    local first=true
    for result in "${VALIDATION_RESULTS[@]}"; do
        IFS=':' read -r test_name test_result test_details <<< "$result"
        
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$REPORT_FILE"
        fi
        
        cat >> "$REPORT_FILE" <<EOF
      {
        "test": "$test_name",
        "result": "$test_result",
        "details": "$test_details"
      }
EOF
    done
    
    cat >> "$REPORT_FILE" <<EOF
    ],
    "failed_tests": [
EOF
    
    # Add failed tests
    local first=true
    for failed_test in "${FAILED_VALIDATIONS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$REPORT_FILE"
        fi
        echo "      \"$failed_test\"" >> "$REPORT_FILE"
    done
    
    cat >> "$REPORT_FILE" <<EOF
    ]
  }
}
EOF
    
    print_success "Validation report generated: $REPORT_FILE"
    
    return 0
}

# Main validation execution
main() {
    local START_TIME=$(date +%s)
    
    echo ""
    echo "🔍 List Cutter Post-Cutover Validation"
    echo "======================================"
    echo "Started at: $(date)"
    echo "Production URL: $PRODUCTION_URL"
    echo "Log file: $VALIDATION_LOG_FILE"
    echo ""
    
    log "Starting post-cutover validation at $(date)"
    
    # Execute validation tests
    test_basic_connectivity
    test_health_endpoints
    test_authentication_endpoints
    test_file_endpoints
    test_csv_endpoints
    test_security_features
    test_performance
    test_migration_integrity
    test_frontend_serving
    generate_validation_report
    
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))
    
    # Calculate final results
    TOTAL_TESTS=${#VALIDATION_RESULTS[@]}
    FAILED_COUNT=${#FAILED_VALIDATIONS[@]}
    
    echo ""
    echo "Validation Summary:"
    echo "=================="
    echo "Total tests: $TOTAL_TESTS"
    echo "Failed tests: $FAILED_COUNT"
    echo "Duration: $DURATION seconds"
    echo ""
    
    if [ $FAILED_COUNT -eq 0 ]; then
        print_success "🎉 All critical validations passed!"
        echo ""
        print_success "✅ List Cutter cutover validation successful"
        log "Post-cutover validation completed successfully at $(date) (duration: ${DURATION}s)"
        return 0
    else
        print_error "❌ Some validations failed!"
        echo ""
        echo "Failed validations:"
        for failed_test in "${FAILED_VALIDATIONS[@]}"; do
            echo "  - $failed_test"
        done
        echo ""
        print_error "❌ List Cutter cutover validation has issues"
        log "Post-cutover validation completed with failures at $(date) (duration: ${DURATION}s)"
        return 1
    fi
}

# Check for help flag
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PRODUCTION_URL          Production URL (default: https://cutty.com)"
    echo "  MAX_RESPONSE_TIME       Max response time in ms (default: 2000)"
    echo "  MIN_HEALTH_SCORE        Min health score percentage (default: 85)"
    echo ""
    exit 0
fi

# Execute main function
main "$@"