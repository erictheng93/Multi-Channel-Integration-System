#!/bin/bash
# LINE 貼圖問題診斷腳本
# 用途: 診斷 Claire 對話中的貼圖無法顯示問題

CONVERSATION_ID="39754c72-ba50-4a35-ba86-56feb46bd710"
DB_NAME="multi-channel-crm"

echo "============================================"
echo "🔍 LINE 貼圖問題診斷工具"
echo "============================================"
echo ""

echo "📋 步驟 1: 查詢對話中的貼圖訊息"
echo "--------------------------------------------"
npx wrangler d1 execute $DB_NAME --command="
SELECT
  id,
  content,
  messageType,
  metadata,
  createdAt
FROM messages
WHERE conversationId = '$CONVERSATION_ID'
  AND messageType = 'sticker'
ORDER BY createdAt DESC
LIMIT 5;
"

echo ""
echo "📋 步驟 2: 檢查 metadata 格式"
echo "--------------------------------------------"
echo "正確的 metadata 格式應該包含:"
echo "  { \"packageId\": \"...\", \"stickerId\": \"...\" }"
echo ""

echo "📋 步驟 3: 生成 LINE CDN URL"
echo "--------------------------------------------"
echo "請提供從步驟 1 獲取的 packageId 和 stickerId:"
read -p "輸入 packageId: " PACKAGE_ID
read -p "輸入 stickerId: " STICKER_ID

if [ -n "$PACKAGE_ID" ] && [ -n "$STICKER_ID" ]; then
  echo ""
  echo "✅ 生成的 LINE CDN URLs:"
  echo "--------------------------------------------"
  echo "1. https://stickershop.line-scdn.net/stickershop/v1/sticker/$STICKER_ID/android/sticker.png"
  echo "2. https://stickershop.line-scdn.net/stickershop/v1/sticker/$STICKER_ID/iPhone/sticker.png"
  echo "3. https://stickershop.line-scdn.net/products/$PACKAGE_ID/sticker.png?v=$STICKER_ID"
  echo "4. https://obs.line-scdn.net/$PACKAGE_ID/$STICKER_ID/android/sticker.png"
  echo ""
  echo "📋 步驟 4: 測試 URL 可用性"
  echo "--------------------------------------------"

  URL1="https://stickershop.line-scdn.net/stickershop/v1/sticker/$STICKER_ID/android/sticker.png"

  echo "正在測試 URL: $URL1"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL1")

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ URL 可以訪問 (HTTP $HTTP_CODE)"
  else
    echo "❌ URL 無法訪問 (HTTP $HTTP_CODE)"
    echo "   可能原因:"
    echo "   - 防火牆阻擋 LINE CDN"
    echo "   - 網路連接問題"
    echo "   - packageId/stickerId 不正確"
  fi
else
  echo "❌ 未提供 packageId 或 stickerId,跳過 URL 測試"
fi

echo ""
echo "============================================"
echo "📊 診斷完成"
echo "============================================"
echo ""
echo "下一步建議:"
echo "1. 確認 metadata 格式正確"
echo "2. 在瀏覽器開發者工具查看 Network 請求"
echo "3. 檢查 Console 是否有錯誤訊息"
echo "4. 如果 URL 可訪問但前端不顯示,檢查前端渲染邏輯"
echo ""
