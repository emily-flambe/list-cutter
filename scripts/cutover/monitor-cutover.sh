#!/bin/bash
# scripts/cutover/monitor-cutover.sh
# Real-time cutover monitoring script - Continuous system health monitoring

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MONITOR_LOG_DIR="$PROJECT_ROOT/logs/monitoring"
MONITOR_LOG_FILE="$MONITOR_LOG_DIR/cutover_monitor_$(date +%Y%m%d_%H%M%S).log"
PRODUCTION_URL="https://cutty.com"
API_BASE="$PRODUCTION_URL/api/v1"

# Monitoring configuration
DEFAULT_DURATION=1800  # 30 minutes
DEFAULT_INTERVAL=10    # 10 seconds
MAX_CONSECUTIVE_FAILURES=3
ALERT_RESPONSE_TIME=2000  # 2 seconds in milliseconds
ALERT_ERROR_RATE=10       # 10% error rate

# Parse command line arguments
MONITOR_DURATION="$DEFAULT_DURATION"
CHECK_INTERVAL="$DEFAULT_INTERVAL"
CONTINUOUS_MODE=false
ALERT_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --duration)
            MONITOR_DURATION="$2"
            shift 2
            ;;
        --interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        --continuous)
            CONTINUOUS_MODE=true
            shift
            ;;
        --alerts)
            ALERT_MODE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --duration SECONDS    Monitor for specified duration (default: $DEFAULT_DURATION)"
            echo "  --interval SECONDS    Check interval (default: $DEFAULT_INTERVAL)"
            echo "  --continuous          Run continuously until stopped"
            echo "  --alerts              Enable alert notifications"
            echo "  --help                Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create log directory
mkdir -p "$MONITOR_LOG_DIR"

# Monitoring state
CONSECUTIVE_FAILURES=0
TOTAL_CHECKS=0
SUCCESSFUL_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0
TOTAL_RESPONSE_TIME=0
START_TIME=$(date +%s)

# Logging functions
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$MONITOR_LOG_FILE"
}

print_status() {
    echo -e "${BLUE}[MONITOR]${NC} $1" | tee -a "$MONITOR_LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$MONITOR_LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$MONITOR_LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$MONITOR_LOG_FILE"
}

print_alert() {
    echo -e "${PURPLE}[ALERT]${NC} $1" | tee -a "$MONITOR_LOG_FILE"
}

print_metric() {
    echo -e "${CYAN}[METRIC]${NC} $1" | tee -a "$MONITOR_LOG_FILE"
}

# Alert notification function
send_alert() {
    local alert_type="$1"
    local alert_message="$2"
    
    if [ "$ALERT_MODE" = true ]; then
        print_alert "$alert_type: $alert_message"
        
        # Here you could integrate with external alerting systems
        # Examples:
        # - Slack webhook
        # - Email notification
        # - PagerDuty
        # - Discord webhook
        
        # For now, just log the alert
        log "ALERT [$alert_type]: $alert_message"
    fi
}

# Health check function
perform_health_check() {
    local check_start=$(date +%s%N)
    
    # Basic health check
    HEALTH_RESPONSE=$(curl -s --max-time 5 "$PRODUCTION_URL/health" 2>/dev/null || echo '{"status":"failed"}')
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // "unknown"')
    
    local check_end=$(date +%s%N)
    local response_time_ms=$(echo "scale=0; ($check_end - $check_start) / 1000000" | bc)
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    TOTAL_RESPONSE_TIME=$(echo "$TOTAL_RESPONSE_TIME + $response_time_ms" | bc)
    
    local check_result="FAILED"
    
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        if [ "$response_time_ms" -le "$ALERT_RESPONSE_TIME" ]; then
            check_result="SUCCESS"
            SUCCESSFUL_CHECKS=$((SUCCESSFUL_CHECKS + 1))
            CONSECUTIVE_FAILURES=0
            print_success "Health check passed (${response_time_ms}ms)"
        else
            check_result="WARNING"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            CONSECUTIVE_FAILURES=0
            print_warning "Health check slow (${response_time_ms}ms)"
        fi
    else
        check_result="FAILED"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        print_error "Health check failed: $HEALTH_STATUS (${response_time_ms}ms)"
    fi
    
    # Store metrics
    echo "$check_result:$response_time_ms:$(date +%s)" >> "$MONITOR_LOG_DIR/metrics.log"
    
    return $([ "$check_result" = "FAILED" ] && echo 1 || echo 0)
}

# Detailed system check
perform_detailed_check() {
    print_status "Performing detailed system check..."
    
    # Detailed health endpoint
    DETAILED_HEALTH=$(curl -s --max-time 10 "$API_BASE/health/detailed" 2>/dev/null || echo '{}')
    if echo "$DETAILED_HEALTH" | jq -e '.status' > /dev/null 2>&1; then
        DETAILED_STATUS=$(echo "$DETAILED_HEALTH" | jq -r '.status')
        OVERALL_SCORE=$(echo "$DETAILED_HEALTH" | jq -r '.overallScore // 0')
        
        print_metric "System status: $DETAILED_STATUS, Score: $OVERALL_SCORE"
        
        # Check individual components
        DB_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.database.healthy // false')
        STORAGE_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.storage.healthy // false')
        MEMORY_HEALTHY=$(echo "$DETAILED_HEALTH" | jq -r '.checks.memory.healthy // false')
        
        if [ "$DB_HEALTHY" = "false" ]; then
            send_alert "DATABASE_UNHEALTHY" "Database component is unhealthy"
        fi
        
        if [ "$STORAGE_HEALTHY" = "false" ]; then
            send_alert "STORAGE_UNHEALTHY" "Storage component is unhealthy"
        fi
        
        if [ "$MEMORY_HEALTHY" = "false" ]; then
            send_alert "MEMORY_DEGRADED" "Memory component is degraded"
        fi
        
        if (( $(echo "$OVERALL_SCORE < 70" | bc -l) )); then
            send_alert "LOW_HEALTH_SCORE" "Overall health score is low: $OVERALL_SCORE"
        fi
    else
        print_warning "Detailed health check unavailable"
    fi
    
    # Check readiness and liveness
    READY_STATUS=$(curl -s --max-time 5 "$API_BASE/health/ready" | jq -r '.status // "unknown"')
    LIVE_STATUS=$(curl -s --max-time 5 "$API_BASE/health/live" | jq -r '.status // "unknown"')
    
    print_metric "Readiness: $READY_STATUS, Liveness: $LIVE_STATUS"
    
    if [ "$READY_STATUS" != "ready" ]; then
        send_alert "NOT_READY" "System readiness probe failed: $READY_STATUS"
    fi
    
    if [ "$LIVE_STATUS" != "alive" ]; then
        send_alert "NOT_ALIVE" "System liveness probe failed: $LIVE_STATUS"
    fi
}

# API endpoint checks
check_api_endpoints() {
    print_status "Checking critical API endpoints..."
    
    CRITICAL_ENDPOINTS=("health" "auth/register" "files/list")
    ENDPOINT_FAILURES=0
    
    for endpoint in "${CRITICAL_ENDPOINTS[@]}"; do
        if [ "$endpoint" = "health" ]; then
            ENDPOINT_URL="$PRODUCTION_URL/$endpoint"
            METHOD="GET"
        else
            ENDPOINT_URL="$API_BASE/$endpoint"
            METHOD="POST"
        fi
        
        RESPONSE=$(curl -s -w "%{http_code}" --max-time 5 -X $METHOD "$ENDPOINT_URL" 2>/dev/null || echo "000")
        HTTP_CODE="${RESPONSE: -3}"
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "501" ]; then
            print_metric "Endpoint /$endpoint: HTTP $HTTP_CODE"
        else
            print_warning "Endpoint /$endpoint: HTTP $HTTP_CODE"
            ENDPOINT_FAILURES=$((ENDPOINT_FAILURES + 1))
        fi
    done
    
    if [ $ENDPOINT_FAILURES -gt 1 ]; then
        send_alert "MULTIPLE_ENDPOINT_FAILURES" "$ENDPOINT_FAILURES critical endpoints failing"
    fi
}

# Error rate monitoring
monitor_error_rate() {
    local current_time=$(date +%s)
    local window_start=$((current_time - 300)) # 5-minute window
    
    # Calculate error rate from recent metrics
    if [ -f "$MONITOR_LOG_DIR/metrics.log" ]; then
        RECENT_CHECKS=$(awk -F: -v start="$window_start" '$3 >= start' "$MONITOR_LOG_DIR/metrics.log" | wc -l)
        RECENT_FAILURES=$(awk -F: -v start="$window_start" '$3 >= start && $1 == "FAILED"' "$MONITOR_LOG_DIR/metrics.log" | wc -l)
        
        if [ $RECENT_CHECKS -gt 0 ]; then
            ERROR_RATE=$(echo "scale=2; $RECENT_FAILURES * 100 / $RECENT_CHECKS" | bc)
            print_metric "5-min error rate: ${ERROR_RATE}% ($RECENT_FAILURES/$RECENT_CHECKS)"
            
            if (( $(echo "$ERROR_RATE > $ALERT_ERROR_RATE" | bc -l) )); then
                send_alert "HIGH_ERROR_RATE" "Error rate is ${ERROR_RATE}% (threshold: ${ALERT_ERROR_RATE}%)"
            fi
        fi
    fi
}

# Resource monitoring
monitor_resources() {
    # Check if monitoring endpoint exists
    METRICS_RESPONSE=$(curl -s --max-time 5 "$PRODUCTION_URL/metrics" 2>/dev/null || echo '{}')
    
    if echo "$METRICS_RESPONSE" | jq -e '.cpu' > /dev/null 2>&1; then
        CPU_USAGE=$(echo "$METRICS_RESPONSE" | jq -r '.cpu.usage // 0')
        MEMORY_USAGE=$(echo "$METRICS_RESPONSE" | jq -r '.memory.usage // 0')
        REQUEST_COUNT=$(echo "$METRICS_RESPONSE" | jq -r '.requests.count // 0')
        
        print_metric "CPU: ${CPU_USAGE}%, Memory: ${MEMORY_USAGE}%, Requests: $REQUEST_COUNT"
        
        if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
            send_alert "HIGH_CPU_USAGE" "CPU usage is ${CPU_USAGE}%"
        fi
        
        if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
            send_alert "HIGH_MEMORY_USAGE" "Memory usage is ${MEMORY_USAGE}%"
        fi
    fi
}

# Display monitoring dashboard
display_dashboard() {
    local current_time=$(date +%s)
    local elapsed_time=$((current_time - START_TIME))
    
    clear
    echo ""
    echo "🔍 List Cutter Cutover Monitoring Dashboard"
    echo "==========================================="
    echo "Production URL: $PRODUCTION_URL"
    echo "Started: $(date -d "@$START_TIME" '+%Y-%m-%d %H:%M:%S')"
    echo "Elapsed: ${elapsed_time}s"
    
    if [ "$CONTINUOUS_MODE" = true ]; then
        echo "Mode: Continuous monitoring"
    else
        local remaining_time=$((MONITOR_DURATION - elapsed_time))
        echo "Remaining: ${remaining_time}s"
    fi
    
    echo ""
    echo "Health Check Statistics:"
    echo "========================"
    echo "Total checks: $TOTAL_CHECKS"
    echo "Successful: $SUCCESSFUL_CHECKS"
    echo "Warnings: $WARNING_CHECKS"
    echo "Failed: $FAILED_CHECKS"
    echo "Consecutive failures: $CONSECUTIVE_FAILURES"
    
    if [ $TOTAL_CHECKS -gt 0 ]; then
        local success_rate=$(echo "scale=1; ($SUCCESSFUL_CHECKS + $WARNING_CHECKS) * 100 / $TOTAL_CHECKS" | bc)
        local avg_response_time=$(echo "scale=0; $TOTAL_RESPONSE_TIME / $TOTAL_CHECKS" | bc)
        echo "Success rate: ${success_rate}%"
        echo "Average response time: ${avg_response_time}ms"
    fi
    
    echo ""
    echo "Current Status:"
    echo "==============="
    
    # Show recent health status
    local last_status="Unknown"
    if [ -f "$MONITOR_LOG_DIR/metrics.log" ]; then
        last_status=$(tail -1 "$MONITOR_LOG_DIR/metrics.log" | cut -d: -f1)
    fi
    
    case $last_status in
        "SUCCESS")
            echo -e "Health: ${GREEN}HEALTHY${NC}"
            ;;
        "WARNING")
            echo -e "Health: ${YELLOW}DEGRADED${NC}"
            ;;
        "FAILED")
            echo -e "Health: ${RED}UNHEALTHY${NC}"
            ;;
        *)
            echo "Health: UNKNOWN"
            ;;
    esac
    
    echo ""
    echo "Log file: $MONITOR_LOG_FILE"
    echo "Press Ctrl+C to stop monitoring"
    echo ""
}

# Cleanup function
cleanup() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    echo ""
    print_status "Monitoring stopped"
    print_status "Total duration: ${total_duration}s"
    print_status "Total checks performed: $TOTAL_CHECKS"
    
    if [ $TOTAL_CHECKS -gt 0 ]; then
        local final_success_rate=$(echo "scale=1; ($SUCCESSFUL_CHECKS + $WARNING_CHECKS) * 100 / $TOTAL_CHECKS" | bc)
        local final_avg_response_time=$(echo "scale=0; $TOTAL_RESPONSE_TIME / $TOTAL_CHECKS" | bc)
        print_status "Final success rate: ${final_success_rate}%"
        print_status "Final average response time: ${final_avg_response_time}ms"
    fi
    
    # Generate monitoring summary
    SUMMARY_FILE="$PROJECT_ROOT/reports/monitoring_summary_$(date +%Y%m%d_%H%M%S).json"
    mkdir -p "$PROJECT_ROOT/reports"
    
    cat > "$SUMMARY_FILE" <<EOF
{
  "monitoring_summary": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "duration": $total_duration,
    "production_url": "$PRODUCTION_URL",
    "statistics": {
      "total_checks": $TOTAL_CHECKS,
      "successful_checks": $SUCCESSFUL_CHECKS,
      "warning_checks": $WARNING_CHECKS,
      "failed_checks": $FAILED_CHECKS,
      "success_rate": $([ $TOTAL_CHECKS -gt 0 ] && echo "scale=2; ($SUCCESSFUL_CHECKS + $WARNING_CHECKS) * 100 / $TOTAL_CHECKS" | bc || echo "0"),
      "average_response_time": $([ $TOTAL_CHECKS -gt 0 ] && echo "scale=0; $TOTAL_RESPONSE_TIME / $TOTAL_CHECKS" | bc || echo "0")
    },
    "log_file": "$MONITOR_LOG_FILE"
  }
}
EOF
    
    print_status "Monitoring summary saved: $SUMMARY_FILE"
    
    # Exit with appropriate code
    if [ $CONSECUTIVE_FAILURES -ge $MAX_CONSECUTIVE_FAILURES ]; then
        exit 1
    else
        exit 0
    fi
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Main monitoring loop
main() {
    echo ""
    echo "🔍 Starting List Cutter Cutover Monitoring"
    echo "=========================================="
    echo "Production URL: $PRODUCTION_URL"
    echo "Check interval: ${CHECK_INTERVAL}s"
    
    if [ "$CONTINUOUS_MODE" = true ]; then
        echo "Duration: Continuous"
    else
        echo "Duration: ${MONITOR_DURATION}s"
    fi
    
    if [ "$ALERT_MODE" = true ]; then
        echo "Alerts: Enabled"
    else
        echo "Alerts: Disabled"
    fi
    
    echo "Log file: $MONITOR_LOG_FILE"
    echo ""
    
    log "Starting cutover monitoring at $(date)"
    
    local end_time
    if [ "$CONTINUOUS_MODE" = true ]; then
        end_time=$(($(date +%s) + 999999999)) # Very large number for continuous mode
    else
        end_time=$(($(date +%s) + MONITOR_DURATION))
    fi
    
    local check_count=0
    
    while [ $(date +%s) -lt $end_time ]; do
        check_count=$((check_count + 1))
        
        # Perform health check
        if ! perform_health_check; then
            # Health check failed
            if [ $CONSECUTIVE_FAILURES -ge $MAX_CONSECUTIVE_FAILURES ]; then
                send_alert "CONSECUTIVE_FAILURES" "System has failed $CONSECUTIVE_FAILURES consecutive health checks"
                print_error "Maximum consecutive failures reached ($MAX_CONSECUTIVE_FAILURES)"
                exit 1
            fi
        fi
        
        # Perform detailed checks every 5th iteration (approximately every 50 seconds with 10s interval)
        if [ $((check_count % 5)) -eq 0 ]; then
            perform_detailed_check
            check_api_endpoints
            monitor_error_rate
            monitor_resources
        fi
        
        # Update dashboard every iteration
        display_dashboard
        
        # Wait for next check
        sleep $CHECK_INTERVAL
    done
    
    print_success "Monitoring completed successfully"
    return 0
}

# Execute main function
main "$@"