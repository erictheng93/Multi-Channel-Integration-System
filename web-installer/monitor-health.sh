#!/bin/bash

# ==============================================================================
# Web Installer - Health Monitoring Script
# ==============================================================================
# This script continuously monitors the health of your deployment
# ==============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKEND_URL=""
FRONTEND_URL=""
CHECK_INTERVAL=60  # seconds
ALERT_THRESHOLD=3   # consecutive failures before alert

# Counters
BACKEND_FAILURES=0
FRONTEND_FAILURES=0

# Functions
print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $(date '+%Y-%m-%d %H:%M:%S') - $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $(date '+%Y-%m-%d %H:%M:%S') - $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $(date '+%Y-%m-%d %H:%M:%S') - $1${NC}"
}

send_alert() {
    local service="$1"
    local status="$2"

    print_error "ALERT: $service is $status!"
    echo "------------------------------------------------------------"
    echo "Service: $service"
    echo "Status: $status"
    echo "Time: $(date)"
    echo "------------------------------------------------------------"

    # TODO: Add email/Slack/webhook notification here
    # Example:
    # curl -X POST https://hooks.slack.com/... \
    #   -d "{\"text\":\"ALERT: $service is $status\"}"
}

check_backend() {
    local url="$1"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url/health" --max-time 10)

    if [ "$HTTP_CODE" == "200" ]; then
        BACKEND_FAILURES=0
        print_success "Backend OK (HTTP $HTTP_CODE)"
        return 0
    else
        ((BACKEND_FAILURES++))
        print_error "Backend FAILED (HTTP $HTTP_CODE)"

        if [ $BACKEND_FAILURES -ge $ALERT_THRESHOLD ]; then
            send_alert "Backend" "DOWN"
        fi
        return 1
    fi
}

check_frontend() {
    local url="$1"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)

    if [ "$HTTP_CODE" == "200" ]; then
        FRONTEND_FAILURES=0
        print_success "Frontend OK (HTTP $HTTP_CODE)"
        return 0
    else
        ((FRONTEND_FAILURES++))
        print_error "Frontend FAILED (HTTP $HTTP_CODE)"

        if [ $FRONTEND_FAILURES -ge $ALERT_THRESHOLD ]; then
            send_alert "Frontend" "DOWN"
        fi
        return 1
    fi
}

check_response_time() {
    local url="$1"

    START_TIME=$(date +%s%N)
    curl -s "$url/health" > /dev/null
    END_TIME=$(date +%s%N)
    ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

    if [ $ELAPSED_MS -lt 1000 ]; then
        print_success "Response time: ${ELAPSED_MS}ms"
    elif [ $ELAPSED_MS -lt 2000 ]; then
        print_warning "Response time: ${ELAPSED_MS}ms (slow)"
    else
        print_error "Response time: ${ELAPSED_MS}ms (very slow)"
    fi
}

# ==============================================================================
# MAIN
# ==============================================================================

clear
print_header "Web Installer Health Monitoring"
echo ""

# Get URLs
if [ -z "$1" ]; then
    read -p "Enter Backend Worker URL: " BACKEND_URL
else
    BACKEND_URL="$1"
fi

if [ -z "$2" ]; then
    read -p "Enter Frontend Pages URL: " FRONTEND_URL
else
    FRONTEND_URL="$2"
fi

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo "Usage: $0 <backend-url> <frontend-url>"
    echo "Example: $0 https://backend.workers.dev https://frontend.pages.dev"
    exit 1
fi

echo ""
echo "Monitoring Configuration:"
echo "  Backend: $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  Check Interval: ${CHECK_INTERVAL}s"
echo "  Alert Threshold: $ALERT_THRESHOLD consecutive failures"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

sleep 2

# Monitoring loop
CHECK_COUNT=0

while true; do
    ((CHECK_COUNT++))

    print_header "Health Check #$CHECK_COUNT - $(date '+%Y-%m-%d %H:%M:%S')"

    # Check backend
    check_backend "$BACKEND_URL"
    BACKEND_STATUS=$?

    # Check frontend
    check_frontend "$FRONTEND_URL"
    FRONTEND_STATUS=$?

    # Check response time
    if [ $BACKEND_STATUS -eq 0 ]; then
        check_response_time "$BACKEND_URL"
    fi

    # Summary
    echo ""
    if [ $BACKEND_STATUS -eq 0 ] && [ $FRONTEND_STATUS -eq 0 ]; then
        echo -e "${GREEN}Status: ALL SERVICES HEALTHY ✓${NC}"
    else
        echo -e "${RED}Status: SOME SERVICES DOWN ✗${NC}"
        echo "  Backend failures: $BACKEND_FAILURES"
        echo "  Frontend failures: $FRONTEND_FAILURES"
    fi

    echo ""
    echo "Next check in ${CHECK_INTERVAL} seconds..."
    echo ""

    sleep $CHECK_INTERVAL
done
