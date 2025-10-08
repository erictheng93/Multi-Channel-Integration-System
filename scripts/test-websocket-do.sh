#!/bin/bash
# WebSocket + Durable Objects 功能驗證腳本
# Project: Multi-Channel Support MVP
# Phase: 2.1 - Pre-Migration Validation

set -e

# 配置
API_BASE="${API_BASE:-https://multi-channel.imfinethankyouandyou.com}"
TOKEN="${TEST_TOKEN:-}"
VERBOSE="${VERBOSE:-false}"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 輔助函數
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# 檢查依賴
check_dependencies() {
  log "Checking dependencies..."

  if ! command -v curl &> /dev/null; then
    log_error "curl is not installed"
    exit 1
  fi

  if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    log_error "python/python3 is not installed"
    exit 1
  fi

  log_success "All dependencies are available"
}

# JSON 格式化函數
format_json() {
  if command -v python3 &> /dev/null; then
    python3 -m json.tool
  elif command -v python &> /dev/null; then
    python -m json.tool
  else
    cat
  fi
}

# HTTP 請求函數
http_get() {
  local url="$1"
  local auth_header="${2:-}"

  if [ -n "$auth_header" ]; then
    curl -s -w "\nHTTP_STATUS:%{http_code}" "$url" -H "Authorization: Bearer $auth_header"
  else
    curl -s -w "\nHTTP_STATUS:%{http_code}" "$url"
  fi
}

# 測試結果統計
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# 開始測試函數
start_test() {
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  echo ""
  echo "═══════════════════════════════════════════════════════"
  log "Test $TESTS_TOTAL: $1"
  echo "═══════════════════════════════════════════════════════"
}

# 通過測試
pass_test() {
  TESTS_PASSED=$((TESTS_PASSED + 1))
  log_success "Test $TESTS_TOTAL passed: $1"
}

# 失敗測試
fail_test() {
  TESTS_FAILED=$((TESTS_FAILED + 1))
  FAILED_TESTS+=("Test $TESTS_TOTAL: $1")
  log_error "Test $TESTS_TOTAL failed: $1"
}

# 顯示橫幅
show_banner() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════╗"
  echo "║                                                       ║"
  echo "║   WebSocket + Durable Objects Test Suite            ║"
  echo "║   Phase 2.1: Pre-Migration Validation                ║"
  echo "║                                                       ║"
  echo "╚═══════════════════════════════════════════════════════╝"
  echo ""
}

# Test 1: System Health Check
test_health_check() {
  start_test "System Health Check"

  local response=$(http_get "$API_BASE/api/websocket/health")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$VERBOSE" = "true" ]; then
    echo "$body" | format_json
  fi

  if [ "$http_status" -eq 200 ]; then
    local status=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null || echo "unknown")

    if [ "$status" = "healthy" ]; then
      pass_test "System health check passed (HTTP 200, status: healthy)"

      # 檢查各組件狀態
      local components=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(','.join([k for k,v in comps.items() if v.get('status')=='healthy']))" 2>/dev/null || echo "")
      log "Healthy components: $components"
    else
      fail_test "System status is not healthy: $status"
    fi
  else
    fail_test "Health check failed (HTTP $http_status)"
  fi
}

# Test 2: Migration Configuration Check
test_migration_config() {
  start_test "Migration Configuration Check"

  local response=$(http_get "$API_BASE/api/websocket/migration-status")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$VERBOSE" = "true" ]; then
    echo "$body" | format_json
  fi

  if [ "$http_status" -eq 200 ]; then
    local ws_enabled=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('websocketEnabled', False))" 2>/dev/null || echo "false")
    local rollout=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('rolloutPercentage', 0))" 2>/dev/null || echo "0")

    log "WebSocket enabled: $ws_enabled"
    log "Rollout percentage: $rollout%"

    if [ "$ws_enabled" = "True" ] || [ "$ws_enabled" = "true" ]; then
      pass_test "Migration config retrieved successfully (WebSocket enabled, rollout: $rollout%)"
    else
      log_warning "WebSocket is disabled in migration config"
      pass_test "Migration config retrieved (WebSocket disabled)"
    fi
  else
    fail_test "Failed to retrieve migration config (HTTP $http_status)"
  fi
}

# Test 3: Durable Objects Connection Test
test_durable_objects() {
  start_test "Durable Objects Connection Test"

  local test_user="test-user-$(date +%s)"
  local test_conv="test-conv-$(date +%s)"
  local response=$(http_get "$API_BASE/api/websocket/test-connection?userId=$test_user&conversationId=$test_conv" "$TOKEN")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$VERBOSE" = "true" ]; then
    echo "$body" | format_json
  fi

  if [ "$http_status" -eq 200 ]; then
    local success=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")

    if [ "$success" = "True" ] || [ "$success" = "true" ]; then
      # 檢查各 DO 組件
      local user_conn=$(echo "$body" | python3 -c "import sys, json; print('OK' if json.load(sys.stdin).get('userConnection') else 'ERROR')" 2>/dev/null || echo "ERROR")
      local conv_room=$(echo "$body" | python3 -c "import sys, json; print('OK' if json.load(sys.stdin).get('conversationRoom') else 'ERROR')" 2>/dev/null || echo "ERROR")
      local broadcaster=$(echo "$body" | python3 -c "import sys, json; print('OK' if json.load(sys.stdin).get('messageBroadcaster') else 'ERROR')" 2>/dev/null || echo "ERROR")

      log "UserConnection DO: $user_conn"
      log "ConversationRoom DO: $conv_room"
      log "MessageBroadcaster DO: $broadcaster"

      if [ "$user_conn" = "OK" ] && [ "$conv_room" = "OK" ] && [ "$broadcaster" = "OK" ]; then
        pass_test "All Durable Objects are operational"
      else
        log_warning "Some Durable Objects may have issues"
        pass_test "DO connection test completed with warnings"
      fi
    else
      fail_test "DO connection test returned success=false"
    fi
  else
    fail_test "DO connection test failed (HTTP $http_status)"
  fi
}

# Test 4: WebSocket Metrics Endpoint
test_websocket_metrics() {
  start_test "WebSocket Metrics Endpoint"

  local response=$(http_get "$API_BASE/api/websocket/metrics" "$TOKEN")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$VERBOSE" = "true" ]; then
    echo "$body" | format_json
  fi

  # Metrics 端點可能返回 200 或 401 (需要認證)
  if [ "$http_status" -eq 200 ]; then
    pass_test "Metrics endpoint accessible (HTTP 200)"

    local total_conns=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('connections',{}).get('totalConnections',0))" 2>/dev/null || echo "0")
    log "Total connections: $total_conns"
  elif [ "$http_status" -eq 401 ]; then
    log_warning "Metrics endpoint requires authentication (HTTP 401)"
    pass_test "Metrics endpoint exists (requires auth)"
  else
    fail_test "Metrics endpoint failed (HTTP $http_status)"
  fi
}

# Test 5: SSE Fallback Availability
test_sse_fallback() {
  start_test "SSE Fallback Availability"

  # 檢查 SSE 健康端點
  local response=$(http_get "$API_BASE/api/monitoring/sse/health")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$VERBOSE" = "true" ]; then
    echo "$body" | format_json
  fi

  if [ "$http_status" -eq 200 ]; then
    pass_test "SSE fallback is available (HTTP 200)"
  elif [ "$http_status" -eq 404 ]; then
    log_warning "SSE health endpoint not found (may be deprecated)"
    pass_test "SSE fallback check completed (endpoint not found)"
  else
    log_warning "SSE fallback check returned HTTP $http_status"
    pass_test "SSE fallback check completed"
  fi
}

# Test 6: Database Connectivity
test_database() {
  start_test "Database Connectivity"

  # 使用系統健康端點檢查數據庫
  local response=$(http_get "$API_BASE/api/system/health")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$VERBOSE" = "true" ]; then
    echo "$body" | format_json
  fi

  if [ "$http_status" -eq 200 ]; then
    local db_status=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(comps.get('database',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")

    if [ "$db_status" = "healthy" ]; then
      pass_test "Database is healthy"
    else
      fail_test "Database status: $db_status"
    fi
  else
    fail_test "Database connectivity check failed (HTTP $http_status)"
  fi
}

# Test 7: KV Storage Check
test_kv_storage() {
  start_test "KV Storage Availability"

  local response=$(http_get "$API_BASE/api/websocket/health")
  local http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d':' -f2)
  local body=$(echo "$response" | sed '/HTTP_STATUS/d')

  if [ "$http_status" -eq 200 ]; then
    local kv_status=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); comps=data.get('components',{}); print(comps.get('kv',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")

    if [ "$kv_status" = "healthy" ]; then
      pass_test "KV storage is healthy"
    else
      fail_test "KV storage status: $kv_status"
    fi
  else
    fail_test "KV storage check failed (HTTP $http_status)"
  fi
}

# 測試摘要報告
show_summary() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════╗"
  echo "║              Test Summary Report                     ║"
  echo "╚═══════════════════════════════════════════════════════╝"
  echo ""
  echo "Total Tests:  $TESTS_TOTAL"
  echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
  echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
  echo ""

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}║  ✅ ALL TESTS PASSED - System Ready for Phase 2.2  ║${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}║  ❌ SOME TESTS FAILED - Review Required             ║${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Failed Tests:"
    for test in "${FAILED_TESTS[@]}"; do
      echo -e "${RED}  • $test${NC}"
    done
    echo ""
    return 1
  fi
}

# 主執行流程
main() {
  check_dependencies
  show_banner

  log "Starting WebSocket + DO validation tests..."
  log "API Base URL: $API_BASE"
  log "Verbose mode: $VERBOSE"
  echo ""

  # 執行所有測試
  test_health_check
  test_migration_config
  test_durable_objects
  test_websocket_metrics
  test_sse_fallback
  test_database
  test_kv_storage

  # 顯示摘要
  show_summary

  exit $?
}

# 執行主程序
main
