#!/bin/bash

# ==============================================================================
# Web Installer - Deployment Testing Script
# ==============================================================================
# This script tests both backend and frontend deployments
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKEND_URL=""
FRONTEND_URL=""

# Functions
print_header() {
    echo -e "${BLUE}┌───────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│  $1${NC}"
    echo -e "${BLUE}└───────────────────────────────────────────────────────────┘${NC}"
}

print_test() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"

    print_test "$test_name"

    if eval "$test_command"; then
        print_success "PASS"
        return 0
    else
        print_error "FAIL"
        return 1
    fi
}

# ==============================================================================
# GET URLS
# ==============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║       Web Installer Deployment Testing                   ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

read -p "Enter Backend Worker URL (e.g., https://xxx.workers.dev): " BACKEND_URL
read -p "Enter Frontend Pages URL (e.g., https://xxx.pages.dev): " FRONTEND_URL

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    print_error "Both URLs are required"
    exit 1
fi

# ==============================================================================
# BACKEND TESTS
# ==============================================================================

print_header "Backend API Tests"

TEST_PASSED=0
TEST_FAILED=0

# Test 1: Health Endpoint
print_test "Test 1: Health Endpoint"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"status":"ok"'; then
        print_success "PASS - Health endpoint returns 200 OK"
        ((TEST_PASSED++))
    else
        print_error "FAIL - Invalid response body"
        echo "Response: $BODY"
        ((TEST_FAILED++))
    fi
else
    print_error "FAIL - Expected 200, got $HTTP_CODE"
    ((TEST_FAILED++))
fi

# Test 2: OAuth Authorize Endpoint
print_test "Test 2: OAuth Authorize Endpoint"
RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"authorizationUrl"'; then
        print_success "PASS - OAuth authorize endpoint works"
        ((TEST_PASSED++))
    else
        print_error "FAIL - Missing authorizationUrl in response"
        echo "Response: $BODY"
        ((TEST_FAILED++))
    fi
else
    print_error "FAIL - Expected 200, got $HTTP_CODE"
    ((TEST_FAILED++))
fi

# Test 3: CORS Headers
print_test "Test 3: CORS Headers"
CORS_HEADERS=$(curl -s -I -X OPTIONS "$BACKEND_URL/health" | grep -i "access-control")

if [ ! -z "$CORS_HEADERS" ]; then
    print_success "PASS - CORS headers present"
    ((TEST_PASSED++))
else
    print_error "FAIL - CORS headers missing"
    ((TEST_FAILED++))
fi

# Test 4: Response Time
print_test "Test 4: Response Time (< 500ms)"
START_TIME=$(date +%s%N)
curl -s "$BACKEND_URL/health" > /dev/null
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $ELAPSED_MS -lt 500 ]; then
    print_success "PASS - Response time: ${ELAPSED_MS}ms"
    ((TEST_PASSED++))
else
    print_error "FAIL - Response time: ${ELAPSED_MS}ms (too slow)"
    ((TEST_FAILED++))
fi

# ==============================================================================
# FRONTEND TESTS
# ==============================================================================

print_header "Frontend Tests"

# Test 5: Frontend Loads
print_test "Test 5: Frontend Page Loads"
RESPONSE=$(curl -s -w "\n%{http_code}" "$FRONTEND_URL")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q "<!DOCTYPE html>"; then
        print_success "PASS - Frontend page loads"
        ((TEST_PASSED++))
    else
        print_error "FAIL - Invalid HTML response"
        ((TEST_FAILED++))
    fi
else
    print_error "FAIL - Expected 200, got $HTTP_CODE"
    ((TEST_FAILED++))
fi

# Test 6: Frontend Assets
print_test "Test 6: Frontend Assets (CSS/JS)"
if echo "$BODY" | grep -q "script"; then
    if echo "$BODY" | grep -q "type=\"module\""; then
        print_success "PASS - JavaScript modules found"
        ((TEST_PASSED++))
    else
        print_error "FAIL - No JavaScript modules found"
        ((TEST_FAILED++))
    fi
else
    print_error "FAIL - No script tags found"
    ((TEST_FAILED++))
fi

# Test 7: Meta Tags
print_test "Test 7: Meta Tags Present"
if echo "$BODY" | grep -q "<meta"; then
    print_success "PASS - Meta tags present"
    ((TEST_PASSED++))
else
    print_error "FAIL - No meta tags found"
    ((TEST_FAILED++))
fi

# ==============================================================================
# INTEGRATION TESTS
# ==============================================================================

print_header "Integration Tests"

# Test 8: Frontend Can Reach Backend
print_test "Test 8: Frontend → Backend Connection"

# Check if frontend has correct API base URL in build
if curl -s "$FRONTEND_URL" | grep -q "$BACKEND_URL"; then
    print_success "PASS - Frontend configured with correct backend URL"
    ((TEST_PASSED++))
else
    print_error "WARNING - Cannot verify frontend-backend connection"
    print_error "Make sure VITE_API_BASE_URL is set correctly"
    ((TEST_FAILED++))
fi

# ==============================================================================
# SUMMARY
# ==============================================================================

print_header "Test Summary"

TOTAL_TESTS=$((TEST_PASSED + TEST_FAILED))
PASS_RATE=$((TEST_PASSED * 100 / TOTAL_TESTS))

echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TEST_PASSED${NC}"
echo -e "${RED}Failed: $TEST_FAILED${NC}"
echo -e "Pass Rate: ${PASS_RATE}%"
echo ""

if [ $TEST_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║           ✓ ALL TESTS PASSED!                            ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your Web Installer is ready for production! 🎉"
    echo ""
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}║           ✗ SOME TESTS FAILED                            ║${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please review the failed tests above and fix the issues."
    echo ""
    exit 1
fi
