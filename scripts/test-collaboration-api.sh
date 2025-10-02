#!/bin/bash

# Collaboration API 測試腳本
# 用途: 獲取 JWT Token 並測試協作功能 API

# 配置
API_URL="${API_URL:-https://multi-channel.imfinethankyouandyou.com}"
EMAIL="${EMAIL:-admin@dacit.net}"
PASSWORD="${PASSWORD:-}"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# 如果沒有提供密碼，提示輸入
if [ -z "$PASSWORD" ]; then
    echo -e "${YELLOW}請輸入密碼:${NC}"
    read -s PASSWORD
fi

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}    Collaboration API 測試工具${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# 步驟 1: 登入獲取 Token
echo -e "${YELLOW}🔐 步驟 1: 登入獲取 JWT Token...${NC}"
echo -e "${GRAY}   Email: $EMAIL${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

# 檢查是否安裝 jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}   ⚠️ 未安裝 jq，無法解析 JSON 響應${NC}"
    echo -e "${GRAY}   請安裝 jq: sudo apt-get install jq (Ubuntu) 或 brew install jq (Mac)${NC}"
    echo ""
    echo "原始響應:"
    echo "$LOGIN_RESPONSE"
    exit 1
fi

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
USER_NAME=$(echo $LOGIN_RESPONSE | jq -r '.data.user.displayName')
USER_ROLE=$(echo $LOGIN_RESPONSE | jq -r '.data.user.role')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}   ❌ 登入失敗${NC}"
    echo ""
    echo -e "${YELLOW}💡 提示:${NC}"
    echo -e "${GRAY}   1. 確認密碼正確${NC}"
    echo -e "${GRAY}   2. 確認網絡連接正常${NC}"
    echo -e "${GRAY}   3. 確認 API URL 正確: $API_URL${NC}"
    echo ""
    echo "完整響應:"
    echo $LOGIN_RESPONSE | jq
    exit 1
fi

echo -e "${GREEN}   ✅ 登入成功！${NC}"
echo -e "${GRAY}   用戶: $USER_NAME ($USER_ROLE)${NC}"
echo -e "${GRAY}   Token: ${TOKEN:0:50}...${NC}"
echo ""

# 步驟 2: 測試協作健康端點
echo -e "${YELLOW}🏥 步驟 2: 測試協作模組健康狀態...${NC}"
HEALTH_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/collaboration/health")

if echo $HEALTH_RESPONSE | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ 健康檢查成功！${NC}"
    STATUS=$(echo $HEALTH_RESPONSE | jq -r '.data.status')
    PROTOCOL=$(echo $HEALTH_RESPONSE | jq -r '.data.config.defaultProtocol')
    WS_ENABLED=$(echo $HEALTH_RESPONSE | jq -r '.data.config.enableWebSocket')
    PROTOCOLS=$(echo $HEALTH_RESPONSE | jq -r '.data.availableProtocols | join(", ")')

    echo -e "${GRAY}   狀態: $STATUS${NC}"
    echo -e "${GRAY}   預設協議: $PROTOCOL${NC}"
    echo -e "${GRAY}   WebSocket 啟用: $WS_ENABLED${NC}"
    echo -e "${GRAY}   可用協議: $PROTOCOLS${NC}"
else
    echo -e "${YELLOW}   ⚠️ 健康檢查失敗${NC}"
    echo $HEALTH_RESPONSE | jq
fi
echo ""

# 步驟 3: 測試協作統計
echo -e "${YELLOW}📊 步驟 3: 獲取協作統計數據...${NC}"
STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/collaboration/stats")

if echo $STATS_RESPONSE | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ 統計數據獲取成功！${NC}"
    VIEWERS=$(echo $STATS_RESPONSE | jq -r '.data.totalViewers')
    TYPING=$(echo $STATS_RESPONSE | jq -r '.data.totalTyping')
    ROOMS=$(echo $STATS_RESPONSE | jq -r '.data.totalRooms')
    SSE_COUNT=$(echo $STATS_RESPONSE | jq -r '.data.connectionsByProtocol.sse')
    WS_COUNT=$(echo $STATS_RESPONSE | jq -r '.data.connectionsByProtocol.websocket')

    echo -e "${GRAY}   查看者總數: $VIEWERS${NC}"
    echo -e "${GRAY}   正在輸入: $TYPING${NC}"
    echo -e "${GRAY}   活躍房間: $ROOMS${NC}"
    echo -e "${GRAY}   協議分布:${NC}"
    echo -e "${GRAY}     - SSE: $SSE_COUNT${NC}"
    echo -e "${GRAY}     - WebSocket: $WS_COUNT${NC}"
else
    echo -e "${YELLOW}   ⚠️ 統計數據獲取失敗${NC}"
    echo $STATS_RESPONSE | jq
fi
echo ""

# 步驟 4: 測試 WebSocket 健康（無需認證）
echo -e "${YELLOW}🔌 步驟 4: 測試 WebSocket 健康狀態（無需認證）...${NC}"
WS_HEALTH_RESPONSE=$(curl -s "$API_URL/api/websocket/health")

if echo $WS_HEALTH_RESPONSE | jq -e '.status' > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ WebSocket 健康檢查成功！${NC}"
    WS_STATUS=$(echo $WS_HEALTH_RESPONSE | jq -r '.status')
    WS_ENV=$(echo $WS_HEALTH_RESPONSE | jq -r '.environment')
    DO_STATUS=$(echo $WS_HEALTH_RESPONSE | jq -r '.components.durableObjects.status')
    WS_COMP_STATUS=$(echo $WS_HEALTH_RESPONSE | jq -r '.components.websocket.status')
    SSE_STATUS=$(echo $WS_HEALTH_RESPONSE | jq -r '.components.sse.status')
    DB_STATUS=$(echo $WS_HEALTH_RESPONSE | jq -r '.components.database.status')

    echo -e "${GRAY}   狀態: $WS_STATUS${NC}"
    echo -e "${GRAY}   環境: $WS_ENV${NC}"
    echo -e "${GRAY}   組件狀態:${NC}"
    echo -e "${GRAY}     - Durable Objects: $DO_STATUS${NC}"
    echo -e "${GRAY}     - WebSocket: $WS_COMP_STATUS${NC}"
    echo -e "${GRAY}     - SSE: $SSE_STATUS${NC}"
    echo -e "${GRAY}     - Database: $DB_STATUS${NC}"
else
    echo -e "${YELLOW}   ⚠️ WebSocket 健康檢查失敗${NC}"
    echo $WS_HEALTH_RESPONSE | jq
fi
echo ""

# 步驟 5: 測試 WebSocket 遷移狀態
echo -e "${YELLOW}🚀 步驟 5: 測試 WebSocket 遷移狀態...${NC}"
MIGRATION_RESPONSE=$(curl -s "$API_URL/api/websocket/migration-status")

if echo $MIGRATION_RESPONSE | jq -e '.status' > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ 遷移狀態獲取成功！${NC}"
    WS_ENABLED=$(echo $MIGRATION_RESPONSE | jq -r '.websocketEnabled')
    SSE_ENABLED=$(echo $MIGRATION_RESPONSE | jq -r '.sseEnabled')
    DO_AVAILABLE=$(echo $MIGRATION_RESPONSE | jq -r '.durableObjectsAvailable')
    ROLLOUT=$(echo $MIGRATION_RESPONSE | jq -r '.rolloutPercentage')

    echo -e "${GRAY}   WebSocket 啟用: $WS_ENABLED${NC}"
    echo -e "${GRAY}   SSE 啟用: $SSE_ENABLED${NC}"
    echo -e "${GRAY}   Durable Objects 可用: $DO_AVAILABLE${NC}"
    echo -e "${GRAY}   推出百分比: $ROLLOUT%${NC}"
else
    echo -e "${YELLOW}   ⚠️ 遷移狀態獲取失敗${NC}"
    echo $MIGRATION_RESPONSE | jq
fi
echo ""

# 總結
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}    測試完成！${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "${YELLOW}💡 您的 JWT Token:${NC}"
echo -e "${GREEN}$TOKEN${NC}"
echo ""
echo -e "${YELLOW}📝 如何使用這個 Token:${NC}"
echo -e "${GRAY}   curl -H 'Authorization: Bearer $TOKEN' \\${NC}"
echo -e "${GRAY}     $API_URL/api/collaboration/health${NC}"
echo ""
echo -e "${YELLOW}💾 將 Token 保存到環境變數:${NC}"
echo -e "${GRAY}   export API_TOKEN=\"$TOKEN\"${NC}"
echo -e "${GRAY}   curl -H \"Authorization: Bearer \$API_TOKEN\" ...${NC}"
echo ""

# 將 Token 保存到文件（可選）
echo -e "${YELLOW}是否將 Token 保存到文件？(y/n)${NC}"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$TOKEN" > ~/.api_token
    echo -e "${GREEN}✅ Token 已保存到 ~/.api_token${NC}"
    echo -e "${GRAY}   使用方式: export API_TOKEN=\$(cat ~/.api_token)${NC}"
fi

echo ""
echo -e "${CYAN}🎉 測試腳本執行完畢！${NC}"
