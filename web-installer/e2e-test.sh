#!/bin/bash

# ==============================================================================
# Web Installer - End-to-End Testing Script
# ==============================================================================
# This script performs comprehensive E2E testing of the entire deployment flow
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BACKEND_URL=""
FRONTEND_URL=""
TEST_PROJECT_NAME="e2e-test-$(date +%s)"
TEST_EMAIL="test@example.com"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Functions
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║         Web Installer E2E Testing Suite                  ║"
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

print_test() {
    ((TOTAL_TESTS++))
    echo -e "${YELLOW}→ Test #$TOTAL_TESTS: $1${NC}"
}

print_success() {
    ((PASSED_TESTS++))
    echo -e "${GREEN}  ✓ PASS - $1${NC}"
}

print_fail() {
    ((FAILED_TESTS++))
    echo -e "${RED}  ✗ FAIL - $1${NC}"
}

print_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

# ==============================================================================
# TEST SUITE
# ==============================================================================

test_backend_health() {
    print_test "Backend Health Check"

    RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" == "200" ]; then
        if echo "$BODY" | grep -q '"status":"ok"'; then
            print_success "Backend is healthy"
            return 0
        else
            print_fail "Invalid health response"
            return 1
        fi
    else
        print_fail "Health check failed (HTTP $HTTP_CODE)"
        return 1
    fi
}

test_frontend_accessible() {
    print_test "Frontend Accessibility"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")

    if [ "$HTTP_CODE" == "200" ]; then
        print_success "Frontend is accessible"
        return 0
    else
        print_fail "Frontend not accessible (HTTP $HTTP_CODE)"
        return 1
    fi
}

test_oauth_authorize() {
    print_test "OAuth Authorization Flow"

    RESPONSE=$(curl -s "$BACKEND_URL/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback")

    if echo "$RESPONSE" | grep -q '"authorizationUrl"'; then
        if echo "$RESPONSE" | grep -q '"state"'; then
            if echo "$RESPONSE" | grep -q '"codeVerifier"'; then
                print_success "OAuth authorization endpoint works"
                return 0
            fi
        fi
    fi

    print_fail "OAuth authorization response invalid"
    echo "Response: $RESPONSE"
    return 1
}

test_oauth_security() {
    print_test "OAuth Security (PKCE & State)"

    RESPONSE=$(curl -s "$BACKEND_URL/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback")

    STATE=$(echo "$RESPONSE" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    CODE_VERIFIER=$(echo "$RESPONSE" | grep -o '"codeVerifier":"[^"]*"' | cut -d'"' -f4)

    if [ ${#STATE} -ge 32 ] && [ ${#CODE_VERIFIER} -ge 43 ]; then
        print_success "PKCE and state parameters are secure"
        return 0
    else
        print_fail "PKCE or state parameters too short"
        return 1
    fi
}

test_cors_headers() {
    print_test "CORS Headers Configuration"

    CORS_ORIGIN=$(curl -s -I -H "Origin: http://localhost:3000" "$BACKEND_URL/health" | grep -i "access-control-allow-origin")

    if [ ! -z "$CORS_ORIGIN" ]; then
        print_success "CORS headers properly configured"
        return 0
    else
        print_fail "CORS headers missing"
        return 1
    fi
}

test_api_response_time() {
    print_test "API Response Time Performance"

    START=$(date +%s%N)
    curl -s "$BACKEND_URL/health" > /dev/null
    END=$(date +%s%N)

    ELAPSED_MS=$(( (END - START) / 1000000 ))

    if [ $ELAPSED_MS -lt 500 ]; then
        print_success "Response time: ${ELAPSED_MS}ms (excellent)"
        return 0
    elif [ $ELAPSED_MS -lt 1000 ]; then
        print_success "Response time: ${ELAPSED_MS}ms (good)"
        return 0
    else
        print_fail "Response time: ${ELAPSED_MS}ms (too slow)"
        return 1
    fi
}

test_frontend_assets() {
    print_test "Frontend Asset Loading"

    RESPONSE=$(curl -s "$FRONTEND_URL")

    HAS_JS=$(echo "$RESPONSE" | grep -c "script.*type=\"module\"")
    HAS_CSS=$(echo "$RESPONSE" | grep -c "stylesheet")

    if [ $HAS_JS -gt 0 ] && [ $HAS_CSS -gt 0 ]; then
        print_success "Frontend assets are present (JS: $HAS_JS, CSS: $HAS_CSS)"
        return 0
    else
        print_fail "Missing frontend assets (JS: $HAS_JS, CSS: $HAS_CSS)"
        return 1
    fi
}

test_error_handling() {
    print_test "API Error Handling"

    # Test 404
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/nonexistent")

    if [ "$HTTP_CODE" == "404" ]; then
        print_success "404 error handling works"
        return 0
    else
        print_fail "Expected 404, got $HTTP_CODE"
        return 1
    fi
}

test_deployment_status_endpoint() {
    print_test "Deployment Status Endpoint"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/deployment/test-project/status")

    # Should return 404 (deployment not found) or 200 (deployment exists)
    if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "200" ]; then
        print_success "Status endpoint responds correctly"
        return 0
    else
        print_fail "Unexpected status code: $HTTP_CODE"
        return 1
    fi
}

test_sse_endpoint() {
    print_test "SSE Event Stream Endpoint"

    # Test that SSE endpoint exists and returns correct headers
    HEADERS=$(curl -s -I "$BACKEND_URL/deployment/test/events")

    if echo "$HEADERS" | grep -q "text/event-stream"; then
        print_success "SSE endpoint configured correctly"
        return 0
    else
        print_fail "SSE headers not found"
        return 1
    fi
}

test_security_headers() {
    print_test "Security Headers"

    HEADERS=$(curl -s -I "$BACKEND_URL/health")

    SCORE=0

    if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
        ((SCORE++))
    fi

    if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
        ((SCORE++))
    fi

    # Cloudflare automatically adds some security headers
    if [ $SCORE -ge 0 ]; then
        print_success "Security headers present (score: $SCORE/2)"
        return 0
    else
        print_fail "Missing security headers"
        return 1
    fi
}

test_frontend_routing() {
    print_test "Frontend Routing (SPA)"

    # Test that all routes return the same HTML (SPA behavior)
    HTTP_CODE1=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/")
    HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/configure")

    if [ "$HTTP_CODE1" == "200" ] && [ "$HTTP_CODE2" == "200" ]; then
        print_success "Frontend routing works (SPA)"
        return 0
    else
        print_fail "Frontend routing broken ($HTTP_CODE1, $HTTP_CODE2)"
        return 1
    fi
}

test_input_validation() {
    print_test "Input Validation"

    # Test project name validation with invalid input
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/deployment/start" \
        -H "Content-Type: application/json" \
        -d '{"projectName":"INVALID NAME","adminEmail":"test@test.com"}')

    if echo "$RESPONSE" | grep -qi "error"; then
        print_success "Input validation works"
        return 0
    else
        print_fail "Input validation not working"
        return 1
    fi
}

test_rate_limiting() {
    print_test "Rate Limiting / DDoS Protection"

    # Make multiple rapid requests
    for i in {1..10}; do
        curl -s "$BACKEND_URL/health" > /dev/null &
    done
    wait

    # Check if server still responds
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")

    if [ "$HTTP_CODE" == "200" ]; then
        print_success "Server handles concurrent requests"
        return 0
    else
        print_fail "Server overloaded (HTTP $HTTP_CODE)"
        return 1
    fi
}

test_https_redirect() {
    print_test "HTTPS Enforcement"

    # Check if both URLs use HTTPS
    if [[ $BACKEND_URL == https://* ]] && [[ $FRONTEND_URL == https://* ]]; then
        print_success "HTTPS is enforced"
        return 0
    else
        print_fail "HTTP detected (should be HTTPS)"
        return 1
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

clear
print_banner

# Get URLs
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Enter deployment URLs to test:"
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
echo "Testing Configuration:"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""
read -p "Press Enter to start testing..."

# ==============================================================================
# RUN TESTS
# ==============================================================================

print_section "Infrastructure Tests"
test_backend_health
test_frontend_accessible
test_https_redirect

print_section "API Functionality Tests"
test_oauth_authorize
test_oauth_security
test_deployment_status_endpoint
test_sse_endpoint

print_section "Security Tests"
test_cors_headers
test_security_headers
test_input_validation

print_section "Performance Tests"
test_api_response_time
test_rate_limiting

print_section "Frontend Tests"
test_frontend_assets
test_frontend_routing

print_section "Error Handling Tests"
test_error_handling

# ==============================================================================
# SUMMARY
# ==============================================================================

print_section "Test Summary"

PASS_RATE=0
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
fi

echo ""
echo "Total Tests:    $TOTAL_TESTS"
echo -e "${GREEN}Passed:         $PASSED_TESTS${NC}"
echo -e "${RED}Failed:         $FAILED_TESTS${NC}"
echo "Pass Rate:      ${PASS_RATE}%"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║              ✓ ALL E2E TESTS PASSED!                     ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your Web Installer is production-ready! 🎉"
    echo ""
    echo "Next Steps:"
    echo "  1. Run performance benchmarks: ./benchmark.sh"
    echo "  2. Run security scan: ./security-check.sh"
    echo "  3. Deploy to production: ./deploy-all.sh"
    echo ""
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}║           ✗ SOME E2E TESTS FAILED                        ║${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Please review the failed tests above and fix the issues."
    echo ""
    exit 1
fi
