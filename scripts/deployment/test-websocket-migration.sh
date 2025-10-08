#!/bin/bash

# WebSocket 遷移系統測試腳本
# 測試所有 WebSocket 相關端點和功能

set -e

BASE_URL="${BASE_URL:-https://multi-channel.imfinethankyouandyou.com}"
API_BASE="$BASE_URL/api"

echo "=========================================="
echo "WebSocket 遷移系統測試"
echo "=========================================="
echo "API Base URL: $API_BASE"
echo ""

# 顏色輸出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 測試結果統計
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 測試函數
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
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# =================== Phase 1: 公開端點測試 ===================
echo ""
echo "=========================================="
echo "Phase 1: 公開端點測試"
echo "=========================================="

test_endpoint "WebSocket Health Check" GET "/websocket/health" 200
test_endpoint "WebSocket Migration Status" GET "/websocket/migration-status" 200
test_endpoint "WebSocket Readiness" GET "/websocket/readiness" 200
test_endpoint "WebSocket Liveness" GET "/websocket/liveness" 200

# =================== Phase 2: 監控端點測試 ===================
echo ""
echo "=========================================="
echo "Phase 2: 監控端點測試"
echo "=========================================="

test_endpoint "WebSocket Metrics" GET "/websocket/metrics" 200

# =================== Phase 3: 功能驗證 ===================
echo ""
echo "=========================================="
echo "Phase 3: 功能驗證"
echo "=========================================="

# 檢查 Migration Config
echo ""
echo "檢查 Migration Config:"
config_response=$(curl -s "$API_BASE/websocket/migration-status")
echo "$config_response" | jq '.'

websocket_enabled=$(echo "$config_response" | jq -r '.enableWebSocket')
sse_enabled=$(echo "$config_response" | jq -r '.enableSSE')

echo ""
echo "WebSocket 狀態: $websocket_enabled"
echo "SSE 狀態: $sse_enabled"

# 檢查 Health Status
echo ""
echo "檢查 Health Status:"
health_response=$(curl -s "$API_BASE/websocket/health")
echo "$health_response" | jq '.'

health_status=$(echo "$health_response" | jq -r '.status')
active_connections=$(echo "$health_response" | jq -r '.activeConnections // 0')
total_connections=$(echo "$health_response" | jq -r '.totalConnections // 0')

echo ""
echo "健康狀態: $health_status"
echo "活躍連線: $active_connections"
echo "總連線數: $total_connections"

# =================== Phase 4: Durable Objects 測試 ===================
echo ""
echo "=========================================="
echo "Phase 4: Durable Objects 測試"
echo "=========================================="

# 測試 Durable Objects 可用性
test_endpoint "Test Durable Objects Connection" GET "/websocket/test-connection?userId=test-user" 200

# =================== Phase 5: 前端配置驗證 ===================
echo ""
echo "=========================================="
echo "Phase 5: 前端配置驗證"
echo "=========================================="

# 檢查前端環境變數檔案
if [ -f "frontend/.env.development" ]; then
    echo -e "${GREEN}✓${NC} 前端 .env.development 檔案存在"

    if grep -q "VITE_WEBSOCKET_ENABLED" frontend/.env.development; then
        echo -e "${GREEN}✓${NC} WebSocket 環境變數已配置"
        grep "VITE_WEBSOCKET" frontend/.env.development
    else
        echo -e "${RED}✗${NC} WebSocket 環境變數未配置"
    fi
else
    echo -e "${RED}✗${NC} 前端 .env.development 檔案不存在"
fi

# 檢查前端配置模組
if [ -f "frontend/src/config/realtime.ts" ]; then
    echo -e "${GREEN}✓${NC} 前端 realtime 配置模組存在"
else
    echo -e "${RED}✗${NC} 前端 realtime 配置模組不存在"
fi

# 檢查前端 composable
if [ -f "frontend/src/composables/useRealtime.ts" ]; then
    echo -e "${GREEN}✓${NC} useRealtime composable 存在"
else
    echo -e "${RED}✗${NC} useRealtime composable 不存在"
fi

# 檢查前端管理介面
if [ -f "frontend/src/views/WebSocketAdmin.vue" ]; then
    echo -e "${GREEN}✓${NC} WebSocket 管理介面存在"
else
    echo -e "${RED}✗${NC} WebSocket 管理介面不存在"
fi

# 檢查前端監控介面
if [ -f "frontend/src/views/WebSocketMonitoring.vue" ]; then
    echo -e "${GREEN}✓${NC} WebSocket 監控介面存在"
else
    echo -e "${RED}✗${NC} WebSocket 監控介面不存在"
fi

# =================== 測試總結 ===================
echo ""
echo "=========================================="
echo "測試總結"
echo "=========================================="
echo "總測試數: $TOTAL_TESTS"
echo -e "${GREEN}通過: $PASSED_TESTS${NC}"
echo -e "${RED}失敗: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=========================================="
    echo "✓ 所有測試通過！"
    echo "==========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================="
    echo "✗ 有 $FAILED_TESTS 個測試失敗"
    echo "==========================================${NC}"
    exit 1
fi
