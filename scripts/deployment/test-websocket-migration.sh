#!/bin/bash

# WebSocket ?·ç§»ç³»çµ±æ¸¬è©¦?³æœ¬
# æ¸¬è©¦?€??WebSocket ?¸é?ç«¯é??Œå???

set -e

BASE_URL="${BASE_URL:-https://your-api-domain.example.com}"
API_BASE="$BASE_URL/api"

echo "=========================================="
echo "WebSocket ?·ç§»ç³»çµ±æ¸¬è©¦"
echo "=========================================="
echo "API Base URL: $API_BASE"
echo ""

# é¡è‰²è¼¸å‡º
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# æ¸¬è©¦çµæ?çµ±è?
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# æ¸¬è©¦?½æ•¸
test_endpoint() {
    local name=$1
    local method=${2:-GET}
    local endpoint=$3
    local expected_status=${4:-200}
    local data=${5:-}

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing $name... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$API_BASE$endpoint")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}??PASS${NC} (Status: $status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}??FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# =================== Phase 1: ?¬é?ç«¯é?æ¸¬è©¦ ===================
echo ""
echo "=========================================="
echo "Phase 1: ?¬é?ç«¯é?æ¸¬è©¦"
echo "=========================================="

test_endpoint "WebSocket Health Check" GET "/websocket/health" 200
test_endpoint "WebSocket Migration Status" GET "/websocket/migration-status" 200
test_endpoint "WebSocket Readiness" GET "/websocket/readiness" 200
test_endpoint "WebSocket Liveness" GET "/websocket/liveness" 200

# =================== Phase 2: ??§ç«¯é?æ¸¬è©¦ ===================
echo ""
echo "=========================================="
echo "Phase 2: ??§ç«¯é?æ¸¬è©¦"
echo "=========================================="

test_endpoint "WebSocket Metrics" GET "/websocket/metrics" 200

# =================== Phase 3: ?Ÿèƒ½é©—è? ===================
echo ""
echo "=========================================="
echo "Phase 3: ?Ÿèƒ½é©—è?"
echo "=========================================="

# æª¢æŸ¥ Migration Config
echo ""
echo "æª¢æŸ¥ Migration Config:"
config_response=$(curl -s "$API_BASE/websocket/migration-status")
echo "$config_response" | jq '.'

websocket_enabled=$(echo "$config_response" | jq -r '.enableWebSocket')
sse_enabled=$(echo "$config_response" | jq -r '.enableSSE')

echo ""
echo "WebSocket ?€?? $websocket_enabled"
echo "SSE ?€?? $sse_enabled"

# æª¢æŸ¥ Health Status
echo ""
echo "æª¢æŸ¥ Health Status:"
health_response=$(curl -s "$API_BASE/websocket/health")
echo "$health_response" | jq '.'

health_status=$(echo "$health_response" | jq -r '.status')
active_connections=$(echo "$health_response" | jq -r '.activeConnections // 0')
total_connections=$(echo "$health_response" | jq -r '.totalConnections // 0')

echo ""
echo "?¥åº·?€?? $health_status"
echo "æ´»è????: $active_connections"
echo "ç¸½é€???? $total_connections"

# =================== Phase 4: Durable Objects æ¸¬è©¦ ===================
echo ""
echo "=========================================="
echo "Phase 4: Durable Objects æ¸¬è©¦"
echo "=========================================="

# æ¸¬è©¦ Durable Objects ?¯ç”¨??
test_endpoint "Test Durable Objects Connection" GET "/websocket/test-connection?userId=test-user" 200

# =================== Phase 5: ?ç«¯?ç½®é©—è? ===================
echo ""
echo "=========================================="
echo "Phase 5: ?ç«¯?ç½®é©—è?"
echo "=========================================="

# æª¢æŸ¥?ç«¯?°å?è®Šæ•¸æª”æ?
if [ -f "frontend/.env.development" ]; then
    echo -e "${GREEN}??{NC} ?ç«¯ .env.development æª”æ?å­˜åœ¨"

    if grep -q "VITE_WEBSOCKET_ENABLED" frontend/.env.development; then
        echo -e "${GREEN}??{NC} WebSocket ?°å?è®Šæ•¸å·²é?ç½?
        grep "VITE_WEBSOCKET" frontend/.env.development
    else
        echo -e "${RED}??{NC} WebSocket ?°å?è®Šæ•¸?ªé?ç½?
    fi
else
    echo -e "${RED}??{NC} ?ç«¯ .env.development æª”æ?ä¸å???
fi

# æª¢æŸ¥?ç«¯?ç½®æ¨¡ç?
if [ -f "frontend/src/config/realtime.ts" ]; then
    echo -e "${GREEN}??{NC} ?ç«¯ realtime ?ç½®æ¨¡ç?å­˜åœ¨"
else
    echo -e "${RED}??{NC} ?ç«¯ realtime ?ç½®æ¨¡ç?ä¸å???
fi

# æª¢æŸ¥?ç«¯ composable
if [ -f "frontend/src/composables/useRealtime.ts" ]; then
    echo -e "${GREEN}??{NC} useRealtime composable å­˜åœ¨"
else
    echo -e "${RED}??{NC} useRealtime composable ä¸å???
fi

# æª¢æŸ¥?ç«¯ç®¡ç?ä»‹é¢
if [ -f "frontend/src/views/WebSocketAdmin.vue" ]; then
    echo -e "${GREEN}??{NC} WebSocket ç®¡ç?ä»‹é¢å­˜åœ¨"
else
    echo -e "${RED}??{NC} WebSocket ç®¡ç?ä»‹é¢ä¸å???
fi

# æª¢æŸ¥?ç«¯??§ä»‹é¢
if [ -f "frontend/src/views/WebSocketMonitoring.vue" ]; then
    echo -e "${GREEN}??{NC} WebSocket ??§ä»‹é¢å­˜åœ¨"
else
    echo -e "${RED}??{NC} WebSocket ??§ä»‹é¢ä¸å???
fi

# =================== æ¸¬è©¦ç¸½ç? ===================
echo ""
echo "=========================================="
echo "æ¸¬è©¦ç¸½ç?"
echo "=========================================="
echo "ç¸½æ¸¬è©¦æ•¸: $TOTAL_TESTS"
echo -e "${GREEN}?šé?: $PASSED_TESTS${NC}"
echo -e "${RED}å¤±æ?: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "???€?‰æ¸¬è©¦é€šé?ï¼?
    echo "==========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "????$FAILED_TESTS ?‹æ¸¬è©¦å¤±??
    echo "==========================================${NC}"
    exit 1
fi
