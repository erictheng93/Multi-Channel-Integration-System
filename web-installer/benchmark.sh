#!/bin/bash

# ==============================================================================
# Web Installer - Performance Benchmark Script
# ==============================================================================
# This script measures performance metrics for the Web Installer
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
BACKEND_URL=""
FRONTEND_URL=""
CONCURRENT_REQUESTS=10
TOTAL_REQUESTS=100

# Benchmark results
declare -A RESULTS

# Functions
print_banner() {
    echo -e "${MAGENTA}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║         Web Installer Performance Benchmark              ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_metric() {
    local name="$1"
    local value="$2"
    local unit="$3"
    local threshold="$4"

    echo -n "  $name: "

    if [ ! -z "$threshold" ]; then
        if (( $(echo "$value < $threshold" | bc -l) )); then
            echo -e "${GREEN}${value}${unit} ✓${NC}"
        else
            echo -e "${YELLOW}${value}${unit} ⚠${NC}"
        fi
    else
        echo -e "${CYAN}${value}${unit}${NC}"
    fi
}

# ==============================================================================
# BENCHMARK TESTS
# ==============================================================================

benchmark_health_endpoint() {
    print_section "1. Health Endpoint Performance"

    echo "Testing: GET $BACKEND_URL/health"
    echo "Requests: $TOTAL_REQUESTS (${CONCURRENT_REQUESTS} concurrent)"
    echo ""

    # Create temporary file for results
    TEMP_FILE=$(mktemp)

    # Run concurrent requests
    START_TIME=$(date +%s%N)

    for i in $(seq 1 $CONCURRENT_REQUESTS); do
        (
            for j in $(seq 1 $((TOTAL_REQUESTS / CONCURRENT_REQUESTS))); do
                REQ_START=$(date +%s%N)
                curl -s -o /dev/null -w "%{http_code}\n" "$BACKEND_URL/health"
                REQ_END=$(date +%s%N)
                REQ_TIME=$(( (REQ_END - REQ_START) / 1000000 ))
                echo "$REQ_TIME" >> "$TEMP_FILE"
            done
        ) &
    done

    wait

    END_TIME=$(date +%s%N)
    TOTAL_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

    # Calculate statistics
    RESPONSE_TIMES=($(sort -n "$TEMP_FILE"))
    COUNT=${#RESPONSE_TIMES[@]}

    MIN=${RESPONSE_TIMES[0]}
    MAX=${RESPONSE_TIMES[$((COUNT-1))]}

    # Calculate average
    SUM=0
    for time in "${RESPONSE_TIMES[@]}"; do
        SUM=$((SUM + time))
    done
    AVG=$((SUM / COUNT))

    # Calculate median (P50)
    P50=${RESPONSE_TIMES[$((COUNT / 2))]}

    # Calculate P95
    P95_INDEX=$((COUNT * 95 / 100))
    P95=${RESPONSE_TIMES[$P95_INDEX]}

    # Calculate P99
    P99_INDEX=$((COUNT * 99 / 100))
    P99=${RESPONSE_TIMES[$P99_INDEX]}

    # Calculate throughput
    THROUGHPUT=$((TOTAL_REQUESTS * 1000 / TOTAL_TIME))

    # Store results
    RESULTS["health_avg"]=$AVG
    RESULTS["health_p95"]=$P95
    RESULTS["health_throughput"]=$THROUGHPUT

    # Display results
    echo "Results:"
    print_metric "  Total Time     " "$TOTAL_TIME" "ms"
    print_metric "  Requests/sec   " "$THROUGHPUT" " req/s"
    print_metric "  Min            " "$MIN" "ms"
    print_metric "  Max            " "$MAX" "ms"
    print_metric "  Average        " "$AVG" "ms" "200"
    print_metric "  Median (P50)   " "$P50" "ms" "150"
    print_metric "  P95            " "$P95" "ms" "300"
    print_metric "  P99            " "$P99" "ms" "500"

    rm -f "$TEMP_FILE"
}

benchmark_oauth_endpoint() {
    print_section "2. OAuth Authorization Endpoint Performance"

    echo "Testing: GET $BACKEND_URL/oauth/authorize"
    echo "Requests: 50"
    echo ""

    TEMP_FILE=$(mktemp)

    for i in $(seq 1 50); do
        REQ_START=$(date +%s%N)
        curl -s "$BACKEND_URL/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback" > /dev/null
        REQ_END=$(date +%s%N)
        REQ_TIME=$(( (REQ_END - REQ_START) / 1000000 ))
        echo "$REQ_TIME" >> "$TEMP_FILE"
    done

    # Calculate statistics
    RESPONSE_TIMES=($(sort -n "$TEMP_FILE"))
    COUNT=${#RESPONSE_TIMES[@]}

    MIN=${RESPONSE_TIMES[0]}
    MAX=${RESPONSE_TIMES[$((COUNT-1))]}

    SUM=0
    for time in "${RESPONSE_TIMES[@]}"; do
        SUM=$((SUM + time))
    done
    AVG=$((SUM / COUNT))

    P95_INDEX=$((COUNT * 95 / 100))
    P95=${RESPONSE_TIMES[$P95_INDEX]}

    # Store results
    RESULTS["oauth_avg"]=$AVG
    RESULTS["oauth_p95"]=$P95

    # Display results
    echo "Results:"
    print_metric "  Min            " "$MIN" "ms"
    print_metric "  Max            " "$MAX" "ms"
    print_metric "  Average        " "$AVG" "ms" "300"
    print_metric "  P95            " "$P95" "ms" "500"

    rm -f "$TEMP_FILE"
}

benchmark_frontend_load() {
    print_section "3. Frontend Page Load Performance"

    echo "Testing: GET $FRONTEND_URL"
    echo "Requests: 20"
    echo ""

    TEMP_FILE=$(mktemp)

    for i in $(seq 1 20); do
        REQ_START=$(date +%s%N)
        curl -s "$FRONTEND_URL" > /dev/null
        REQ_END=$(date +%s%N)
        REQ_TIME=$(( (REQ_END - REQ_START) / 1000000 ))
        echo "$REQ_TIME" >> "$TEMP_FILE"
    done

    # Calculate statistics
    RESPONSE_TIMES=($(sort -n "$TEMP_FILE"))
    COUNT=${#RESPONSE_TIMES[@]}

    MIN=${RESPONSE_TIMES[0]}
    MAX=${RESPONSE_TIMES[$((COUNT-1))]}

    SUM=0
    for time in "${RESPONSE_TIMES[@]}"; do
        SUM=$((SUM + time))
    done
    AVG=$((SUM / COUNT))

    # Store results
    RESULTS["frontend_avg"]=$AVG

    # Display results
    echo "Results:"
    print_metric "  Min            " "$MIN" "ms"
    print_metric "  Max            " "$MAX" "ms"
    print_metric "  Average        " "$AVG" "ms" "500"

    rm -f "$TEMP_FILE"
}

benchmark_payload_size() {
    print_section "4. Payload Size Analysis"

    echo "Analyzing response sizes..."
    echo ""

    # Health endpoint
    HEALTH_SIZE=$(curl -s "$BACKEND_URL/health" | wc -c)
    echo "  Health endpoint:     ${HEALTH_SIZE} bytes"

    # OAuth endpoint
    OAUTH_SIZE=$(curl -s "$BACKEND_URL/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback" | wc -c)
    echo "  OAuth endpoint:      ${OAUTH_SIZE} bytes"

    # Frontend HTML
    FRONTEND_SIZE=$(curl -s "$FRONTEND_URL" | wc -c)
    FRONTEND_KB=$((FRONTEND_SIZE / 1024))
    echo "  Frontend HTML:       ${FRONTEND_KB} KB"

    # Store results
    RESULTS["frontend_size_kb"]=$FRONTEND_KB
}

benchmark_ttfb() {
    print_section "5. Time To First Byte (TTFB)"

    echo "Measuring TTFB for different endpoints..."
    echo ""

    # Backend TTFB
    BACKEND_TTFB=$(curl -s -w "%{time_starttransfer}\n" -o /dev/null "$BACKEND_URL/health")
    BACKEND_TTFB_MS=$(echo "$BACKEND_TTFB * 1000" | bc)

    echo "  Backend (health):    ${BACKEND_TTFB_MS%.*}ms"

    # Frontend TTFB
    FRONTEND_TTFB=$(curl -s -w "%{time_starttransfer}\n" -o /dev/null "$FRONTEND_URL")
    FRONTEND_TTFB_MS=$(echo "$FRONTEND_TTFB * 1000" | bc)

    echo "  Frontend (HTML):     ${FRONTEND_TTFB_MS%.*}ms"

    # Store results
    RESULTS["backend_ttfb"]=${BACKEND_TTFB_MS%.*}
    RESULTS["frontend_ttfb"]=${FRONTEND_TTFB_MS%.*}
}

benchmark_connection_time() {
    print_section "6. Connection Establishment Time"

    echo "Measuring connection times..."
    echo ""

    # Backend connection
    BACKEND_CONNECT=$(curl -s -w "%{time_connect}\n" -o /dev/null "$BACKEND_URL/health")
    BACKEND_CONNECT_MS=$(echo "$BACKEND_CONNECT * 1000" | bc)

    echo "  Backend connect:     ${BACKEND_CONNECT_MS%.*}ms"

    # Frontend connection
    FRONTEND_CONNECT=$(curl -s -w "%{time_connect}\n" -o /dev/null "$FRONTEND_URL")
    FRONTEND_CONNECT_MS=$(echo "$FRONTEND_CONNECT * 1000" | bc)

    echo "  Frontend connect:    ${FRONTEND_CONNECT_MS%.*}ms"
}

# ==============================================================================
# PERFORMANCE SCORE
# ==============================================================================

calculate_performance_score() {
    print_section "Performance Score"

    SCORE=100

    # Health endpoint average (target: < 200ms)
    if [ ${RESULTS["health_avg"]} -gt 200 ]; then
        PENALTY=$(( (${RESULTS["health_avg"]} - 200) / 10 ))
        SCORE=$((SCORE - PENALTY))
    fi

    # Health endpoint P95 (target: < 300ms)
    if [ ${RESULTS["health_p95"]} -gt 300 ]; then
        PENALTY=$(( (${RESULTS["health_p95"]} - 300) / 10 ))
        SCORE=$((SCORE - PENALTY))
    fi

    # OAuth average (target: < 300ms)
    if [ ${RESULTS["oauth_avg"]} -gt 300 ]; then
        PENALTY=$(( (${RESULTS["oauth_avg"]} - 300) / 10 ))
        SCORE=$((SCORE - PENALTY))
    fi

    # Frontend average (target: < 500ms)
    if [ ${RESULTS["frontend_avg"]} -gt 500 ]; then
        PENALTY=$(( (${RESULTS["frontend_avg"]} - 500) / 10 ))
        SCORE=$((SCORE - PENALTY))
    fi

    # Ensure score is between 0-100
    if [ $SCORE -lt 0 ]; then
        SCORE=0
    fi

    # Display score
    echo ""
    if [ $SCORE -ge 90 ]; then
        echo -e "  Overall Score: ${GREEN}${SCORE}/100 ⭐⭐⭐${NC}"
        echo -e "  Grade: ${GREEN}A (Excellent)${NC}"
    elif [ $SCORE -ge 80 ]; then
        echo -e "  Overall Score: ${GREEN}${SCORE}/100 ⭐⭐${NC}"
        echo -e "  Grade: ${GREEN}B (Good)${NC}"
    elif [ $SCORE -ge 70 ]; then
        echo -e "  Overall Score: ${YELLOW}${SCORE}/100 ⭐${NC}"
        echo -e "  Grade: ${YELLOW}C (Fair)${NC}"
    else
        echo -e "  Overall Score: ${RED}${SCORE}/100${NC}"
        echo -e "  Grade: ${RED}D (Needs Improvement)${NC}"
    fi

    echo ""
}

# ==============================================================================
# RECOMMENDATIONS
# ==============================================================================

provide_recommendations() {
    print_section "Performance Recommendations"

    RECOMMENDATIONS=()

    if [ ${RESULTS["health_avg"]} -gt 200 ]; then
        RECOMMENDATIONS+=("⚠ Health endpoint average response time is high (${RESULTS["health_avg"]}ms). Consider caching or optimization.")
    fi

    if [ ${RESULTS["health_p95"]} -gt 300 ]; then
        RECOMMENDATIONS+=("⚠ Health endpoint P95 is high (${RESULTS["health_p95"]}ms). Investigate slow requests.")
    fi

    if [ ${RESULTS["oauth_avg"]} -gt 300 ]; then
        RECOMMENDATIONS+=("⚠ OAuth endpoint is slow (${RESULTS["oauth_avg"]}ms). Check external API calls.")
    fi

    if [ ${RESULTS["frontend_avg"]} -gt 500 ]; then
        RECOMMENDATIONS+=("⚠ Frontend load time is high (${RESULTS["frontend_avg"]}ms). Consider CDN or compression.")
    fi

    if [ ${RESULTS["frontend_size_kb"]} -gt 100 ]; then
        RECOMMENDATIONS+=("⚠ Frontend HTML is large (${RESULTS["frontend_size_kb"]}KB). Consider minification.")
    fi

    if [ ${RESULTS["health_throughput"]} -lt 100 ]; then
        RECOMMENDATIONS+=("⚠ Throughput is low (${RESULTS["health_throughput"]} req/s). Scale horizontally.")
    fi

    if [ ${#RECOMMENDATIONS[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ No performance issues detected!${NC}"
        echo ""
        echo "Your deployment is performing excellently!"
    else
        echo "Recommendations to improve performance:"
        echo ""
        for recommendation in "${RECOMMENDATIONS[@]}"; do
            echo "  $recommendation"
        done
    fi

    echo ""
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

clear
print_banner

# Get URLs
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Enter deployment URLs to benchmark:"
    echo ""
    read -p "Backend Worker URL: " BACKEND_URL
    read -p "Frontend Pages URL: " FRONTEND_URL
else
    BACKEND_URL="$1"
    FRONTEND_URL="$2"
fi

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo -e "${RED}Error: Both URLs are required${NC}"
    echo "Usage: $0 <backend-url> <frontend-url>"
    exit 1
fi

echo ""
echo "Benchmark Configuration:"
echo "  Backend:              $BACKEND_URL"
echo "  Frontend:             $FRONTEND_URL"
echo "  Total Requests:       $TOTAL_REQUESTS"
echo "  Concurrent Requests:  $CONCURRENT_REQUESTS"
echo ""
read -p "Press Enter to start benchmarking..."

# Run benchmarks
benchmark_health_endpoint
benchmark_oauth_endpoint
benchmark_frontend_load
benchmark_payload_size
benchmark_ttfb
benchmark_connection_time

# Calculate score
calculate_performance_score

# Provide recommendations
provide_recommendations

# ==============================================================================
# SUMMARY
# ==============================================================================

print_section "Benchmark Summary"

echo "Key Metrics:"
echo ""
print_metric "  Health Avg         " "${RESULTS["health_avg"]}" "ms" "200"
print_metric "  Health P95         " "${RESULTS["health_p95"]}" "ms" "300"
print_metric "  Health Throughput  " "${RESULTS["health_throughput"]}" " req/s"
print_metric "  OAuth Avg          " "${RESULTS["oauth_avg"]}" "ms" "300"
print_metric "  Frontend Avg       " "${RESULTS["frontend_avg"]}" "ms" "500"
print_metric "  Frontend Size      " "${RESULTS["frontend_size_kb"]}" " KB"
print_metric "  Backend TTFB       " "${RESULTS["backend_ttfb"]}" "ms" "100"
print_metric "  Frontend TTFB      " "${RESULTS["frontend_ttfb"]}" "ms" "200"

echo ""
echo "Benchmark completed!"
echo ""
echo "Next Steps:"
echo "  1. Run security scan: ./security-check.sh"
echo "  2. Run E2E tests: ./e2e-test.sh"
echo "  3. Review production checklist"
echo ""
