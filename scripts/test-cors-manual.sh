#!/bin/bash
# CORS 手動測試腳本
# 測試統一 CORS 配置的完整功能

BASE_URL="${TEST_BASE_URL:-https://multi-channel.imfinethankyouandyou.com}"
TOKEN="${TEST_ADMIN_TOKEN:-}"

echo "🧪 CORS E2E Manual Testing"
echo "=========================="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"

    echo -n "Testing: $test_name... "

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "   Expected pattern: $expected_pattern"
        echo "   Got: $result"
        ((FAILED++))
        return 1
    fi
}

echo "1️⃣  Testing Allowed Origins"
echo "----------------------------"

# Test 1: Allowed origin
run_test "Allowed origin (main domain)" \
    "curl -s -H 'Origin: https://multi-channel.imfinethankyouandyou.com' $BASE_URL/api/system/health -I" \
    "access-control-allow-origin: https://multi-channel.imfinethankyouandyou.com"

# Test 2: Cloudflare Pages domain
run_test "Allowed origin (Cloudflare Pages)" \
    "curl -s -H 'Origin: https://multi-channel-platform-frontend.pages.dev' $BASE_URL/api/system/health -I" \
    "access-control-allow-origin: https://multi-channel-platform-frontend.pages.dev"

# Test 3: Preview domain
run_test "Preview domain (*.pages.dev)" \
    "curl -s -H 'Origin: https://abc123.multi-channel-platform-frontend.pages.dev' $BASE_URL/api/system/health -I" \
    "access-control-allow-origin: https://abc123.multi-channel-platform-frontend.pages.dev"

echo ""
echo "2️⃣  Testing Blocked Origins"
echo "----------------------------"

# Test 4: Blocked origin
run_test "Blocked origin (malicious-site)" \
    "curl -s -H 'Origin: https://malicious-site.com' $BASE_URL/api/system/health -I | grep -i 'access-control-allow-origin: https://malicious-site.com' || echo 'correctly blocked'" \
    "correctly blocked"

# Test 5: Unknown origin
run_test "Blocked origin (unknown)" \
    "curl -s -H 'Origin: https://unknown-domain.net' $BASE_URL/api/system/health -I | grep -i 'access-control-allow-origin: https://unknown-domain.net' || echo 'correctly blocked'" \
    "correctly blocked"

echo ""
echo "3️⃣  Testing OPTIONS Preflight"
echo "----------------------------"

# Test 6: OPTIONS request
run_test "OPTIONS preflight (allowed origin)" \
    "curl -s -X OPTIONS -H 'Origin: https://multi-channel.imfinethankyouandyou.com' -H 'Access-Control-Request-Method: POST' $BASE_URL/api/conversations -I" \
    "HTTP/.*204"

# Test 7: OPTIONS with blocked origin
run_test "OPTIONS preflight (blocked origin)" \
    "curl -s -X OPTIONS -H 'Origin: https://malicious-site.com' -H 'Access-Control-Request-Method: POST' $BASE_URL/api/conversations -I" \
    "HTTP/.*403"

echo ""
echo "4️⃣  Testing Credentials Support"
echo "----------------------------"

# Test 8: Credentials header
run_test "Credentials support" \
    "curl -s -H 'Origin: https://multi-channel.imfinethankyouandyou.com' $BASE_URL/api/system/health -I" \
    "access-control-allow-credentials: true"

echo ""
echo "5️⃣  Testing CORS Monitoring Endpoints"
echo "----------------------------"

# Test 9: Public config endpoint
run_test "CORS config endpoint (public)" \
    "curl -s $BASE_URL/api/cors/config" \
    "success.*true"

# Test 10: Health endpoint
run_test "CORS monitoring health" \
    "curl -s $BASE_URL/api/cors/health" \
    "status.*healthy"

if [ -n "$TOKEN" ]; then
    # Test 11: Stats endpoint (admin only)
    run_test "CORS stats (admin)" \
        "curl -s -H 'Authorization: Bearer $TOKEN' $BASE_URL/api/cors/stats" \
        "success.*true"

    # Test 12: Rejected origins (admin only)
    run_test "Rejected origins (admin)" \
        "curl -s -H 'Authorization: Bearer $TOKEN' $BASE_URL/api/cors/rejected-origins" \
        "success.*true"
else
    echo -e "${YELLOW}⏭️  Skipping admin tests (no token)${NC}"
fi

echo ""
echo "6️⃣  Testing SSE Endpoints"
echo "----------------------------"

# Test 13: SSE with allowed origin
run_test "SSE endpoint CORS (allowed)" \
    "curl -s -H 'Origin: https://multi-channel.imfinethankyouandyou.com' -H 'Accept: text/event-stream' $BASE_URL/api/cors/health -I" \
    "access-control-allow-origin"

echo ""
echo "7️⃣  Testing Edge Cases"
echo "----------------------------"

# Test 14: Missing Origin header
run_test "Missing Origin header" \
    "curl -s $BASE_URL/api/system/health -I | grep -i 'access-control-allow-origin' || echo 'no cors headers'" \
    "no cors headers"

# Test 15: Empty Origin
run_test "Empty Origin header" \
    "curl -s -H 'Origin: ' $BASE_URL/api/system/health -I | grep -i 'access-control-allow-origin: $' || echo 'correctly handled'" \
    "correctly handled"

echo ""
echo "📊 Test Results"
echo "==============="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo -e "Total:  $(($PASSED + $FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed.${NC}"
    exit 1
fi
