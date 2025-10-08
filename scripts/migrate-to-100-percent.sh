#!/bin/bash
# WebSocket 100% 遷移腳本
# 自動化執行從 50% → 75% → 100% 的遷移流程

set -e

echo "🚀 WebSocket 遷移到 100% 自動化腳本"
echo "=================================================="
echo ""

# 配置
API_BASE="${API_BASE:-https://multi-channel.imfinethankyouandyou.com}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

# 檢查 token
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ 錯誤: 未設置 ADMIN_TOKEN 環境變數"
  echo ""
  echo "請先獲取管理員 token:"
  echo "1. 登入 https://multi-channel.imfinethankyouandyou.com"
  echo "2. 開啟 DevTools → Application → Local Storage"
  echo "3. 複製 'auth_token' 的值"
  echo ""
  echo "然後運行:"
  echo "  export ADMIN_TOKEN='your-token-here'"
  echo "  bash scripts/migrate-to-100-percent.sh"
  exit 1
fi

echo "✅ Token 已設置"
echo ""

# 函數: 檢查當前狀態
check_status() {
  echo "📊 檢查當前遷移狀態..."
  RESPONSE=$(curl -s "$API_BASE/api/websocket/migration-status")
  CURRENT_ROLLOUT=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['rolloutPercentage'])" 2>/dev/null || echo "unknown")
  echo "當前 Rollout: $CURRENT_ROLLOUT%"
  echo ""
}

# 函數: 更新 rollout
update_rollout() {
  local TARGET=$1
  echo "⚡ 提升 Rollout 到 $TARGET%..."

  RESPONSE=$(curl -s -X POST "$API_BASE/api/websocket/migration-config" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"rolloutPercentage\": $TARGET}")

  if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ 更新失敗:"
    echo "$RESPONSE" | python3 -m json.tool
    exit 1
  fi

  echo "✅ 成功提升到 $TARGET%"
  echo ""
}

# 函數: 驗證健康狀態
check_health() {
  echo "🏥 檢查系統健康狀態..."
  HEALTH=$(curl -s "$API_BASE/api/websocket/health")
  STATUS=$(echo "$HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")

  if [ "$STATUS" != "healthy" ]; then
    echo "⚠️  警告: 系統狀態不健康: $STATUS"
    echo "$HEALTH" | python3 -m json.tool
    return 1
  fi

  echo "✅ 系統健康"
  echo ""
}

# 函數: 等待並監控
monitor() {
  local DURATION=$1
  echo "⏳ 監控 $DURATION 秒..."
  for i in $(seq 1 $DURATION); do
    if [ $((i % 10)) -eq 0 ]; then
      echo "  ⏱  $i/$DURATION 秒..."
      check_health > /dev/null 2>&1 || echo "  ⚠️  健康檢查失敗"
    fi
    sleep 1
  done
  echo "✅ 監控完成"
  echo ""
}

# ============================================
# 主執行流程
# ============================================

echo "階段 1: 驗證初始狀態"
echo "--------------------------------------------"
check_status
check_health

# 決策邏輯
if [ "$CURRENT_ROLLOUT" == "50" ]; then
  echo "階段 2: 提升到 75%"
  echo "--------------------------------------------"
  update_rollout 75
  monitor 30  # 監控 30 秒

  echo "階段 3: 提升到 100%"
  echo "--------------------------------------------"
  echo "⚠️  準備全量遷移..."
  echo "按 Enter 繼續，或 Ctrl+C 取消"
  read

  update_rollout 100

elif [ "$CURRENT_ROLLOUT" == "75" ]; then
  echo "階段 2: 提升到 100%（跳過 75%）"
  echo "--------------------------------------------"
  echo "⚠️  準備全量遷移..."
  echo "按 Enter 繼續，或 Ctrl+C 取消"
  read

  update_rollout 100

elif [ "$CURRENT_ROLLOUT" == "100" ]; then
  echo "✅ 已經是 100% Rollout"
  echo ""
else
  echo "❌ 未知的 Rollout 狀態: $CURRENT_ROLLOUT%"
  exit 1
fi

echo "階段 4: 驗證最終狀態"
echo "--------------------------------------------"
check_status
check_health

# 顯示最終配置
echo "📋 最終配置:"
curl -s "$API_BASE/api/websocket/migration-status" | python3 -m json.tool

echo ""
echo "=================================================="
echo "🎉 遷移完成！"
echo ""
echo "下一步:"
echo "1. 持續監控 24-48 小時"
echo "2. 確認所有用戶使用 WebSocket"
echo "3. 執行 SSE 代碼清理"
echo ""
echo "監控命令:"
echo "  curl $API_BASE/api/websocket/health | python3 -m json.tool"
echo "  curl $API_BASE/api/websocket/migration-status | python3 -m json.tool"
echo ""
