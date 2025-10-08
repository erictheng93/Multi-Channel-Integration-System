# WebSocket 遷移快速啟動指南

> 🚀 **5 分鐘啟用 WebSocket** - 快速參考指南

## 📋 檢查清單

在開始之前，確認以下項目：

- [x] ✅ 後端已部署 Durable Objects 配置
- [x] ✅ 前端環境變數已設置
- [x] ✅ 功能開關管理介面可用
- [x] ✅ 監控 Dashboard 可用
- [x] ✅ 測試腳本執行成功

---

## ⚡ 快速啟動 (3 個步驟)

### Step 1: 驗證系統就緒

```bash
# 1. 測試後端健康狀態
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 2. 檢查當前配置
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# 3. 執行自動化測試
bash test-websocket-migration.sh
```

**預期結果**: 所有端點返回 200 狀態碼 ✅

---

### Step 2: 啟用小規模試點 (5% 用戶)

#### 方法 A: 透過管理介面 (推薦 ⭐)

1. 登入系統並訪問: `https://your-domain.com/admin/websocket`
2. 勾選「啟用 WebSocket」
3. 設置「發布百分比」為 `5`
4. 點擊「保存配置」

#### 方法 B: 透過 API

```bash
# 需要 Admin Token
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enableWebSocket": true,
    "enableSSE": true,
    "migrationStrategy": "gradual",
    "rolloutPercentage": 5
  }'
```

**預期結果**: 配置更新成功，5% 用戶開始使用 WebSocket ✅

---

### Step 3: 監控與逐步擴大

```bash
# 1. 訪問監控 Dashboard
https://your-domain.com/monitoring/websocket

# 2. 觀察關鍵指標 (24 小時)
- 活躍連線數
- 錯誤率 (目標: < 1%)
- 平均延遲 (目標: < 200ms)

# 3. 如果一切正常，逐步提升百分比
Day 1:  5%  → 監控 24 小時
Day 2:  10% → 監控 24 小時
Day 4:  25% → 監控 24 小時
Day 7:  50% → 監控 48 小時
Day 10: 100% → 完全遷移
```

---

## 🎯 關鍵指標閾值

| 指標 | 優秀 | 良好 | 警告 | 危險 |
|-----|------|------|------|------|
| **錯誤率** | < 0.1% | < 1% | < 5% | ≥ 5% |
| **延遲** | < 100ms | < 200ms | < 500ms | ≥ 500ms |
| **連線成功率** | > 99.9% | > 99% | > 95% | < 95% |

---

## 🔧 常用命令

### 查詢系統狀態

```bash
# 健康檢查
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health | jq

# 遷移配置
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status | jq

# 即時指標
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/metrics | jq
```

### 更新配置

```bash
# 設置環境變數
export ADMIN_TOKEN="your-admin-jwt-token"
export API_URL="https://multi-channel.imfinethankyouandyou.com/api"

# 啟用 WebSocket (10% 用戶)
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enableWebSocket": true, "rolloutPercentage": 10}' | jq

# 提升至 50%
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rolloutPercentage": 50}' | jq

# 完全遷移 (100%)
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rolloutPercentage": 100}' | jq
```

### 緊急回退

```bash
# ⚠️ 立即停用 WebSocket，回退至 SSE
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "enableWebSocket": false,
    "enableSSE": true,
    "rolloutPercentage": 0
  }' | jq
```

---

## 🚨 故障快速診斷

### 問題 1: 連線失敗率高

```bash
# 1. 檢查錯誤率
curl $API_URL/websocket/health | jq '.errorRate'

# 2. 如果 > 5%，立即降低百分比
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"rolloutPercentage": 5}'

# 3. 檢查日誌
wrangler tail --format pretty
```

### 問題 2: 延遲過高

```bash
# 1. 檢查平均延遲
curl $API_URL/websocket/health | jq '.averageLatency'

# 2. 如果 > 500ms，檢查 Durable Objects 狀態
curl $API_URL/websocket/metrics | jq

# 3. 考慮優化或回退
```

### 問題 3: 部分用戶無法連線

```bash
# 1. 確認 fallback 已啟用
curl $API_URL/websocket/migration-status | jq '.enableSSE'

# 2. 應該返回 true
# 3. 如果是 false，立即啟用
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enableSSE": true}'
```

---

## 📊 監控 Dashboard 快速指南

### 訪問路徑
```
https://your-domain.com/monitoring/websocket
```

### 關鍵指標卡片

```
┌─────────────────────────────────────────────────┐
│ 🔌 活躍連線          📨 訊息/秒               │
│    1,234              456                       │
│    ↗ +15%             正常                      │
├─────────────────────────────────────────────────┤
│ ⏱️ 平均延遲          ⚠️ 錯誤率                │
│    45ms               0.02%                     │
│    優秀               正常                      │
└─────────────────────────────────────────────────┘
```

### 自動刷新
- ✅ 預設每 5 秒自動刷新
- 可手動勾選「自動刷新」開關

### 告警閾值
- 🟢 **正常**: 錯誤率 < 1%, 延遲 < 200ms
- 🟡 **警告**: 錯誤率 1-5%, 延遲 200-500ms
- 🔴 **危險**: 錯誤率 > 5%, 延遲 > 500ms

---

## 🎓 最佳實踐

### ✅ 推薦做法

1. **漸進式發布**: 從 5% 開始，逐步提升
2. **持續監控**: 每次提升後觀察 24 小時
3. **保留 fallback**: 始終保持 SSE 啟用
4. **定期檢查**: 每天查看監控 Dashboard
5. **文檔化**: 記錄每次配置變更

### ❌ 避免做法

1. ⛔ 直接 100% 切換（除非測試環境）
2. ⛔ 停用 SSE fallback（在穩定前）
3. ⛔ 忽略告警訊息
4. ⛔ 在高峰時段變更配置
5. ⛔ 未經測試就部署

---

## 🔗 相關連結

- 📚 [完整遷移指南](./WEBSOCKET_MIGRATION_GUIDE.md)
- 🧪 [測試腳本](./test-websocket-migration.sh)
- 🎛️ [管理介面](https://your-domain.com/admin/websocket)
- 📊 [監控 Dashboard](https://your-domain.com/monitoring/websocket)

---

## ✅ 完成檢查

部署完成後，確認以下項目：

- [ ] ✅ 健康檢查返回正常狀態
- [ ] ✅ 監控 Dashboard 顯示即時數據
- [ ] ✅ WebSocket 連線成功率 > 95%
- [ ] ✅ 錯誤率 < 1%
- [ ] ✅ 平均延遲 < 200ms
- [ ] ✅ SSE fallback 正常運作
- [ ] ✅ 功能開關可以動態調整
- [ ] ✅ 告警系統正常觸發

---

**準備好了嗎？開始遷移！** 🚀

```bash
# 執行以下命令開始遷移
bash test-websocket-migration.sh

# 如果測試通過，啟用 5% WebSocket
curl -X POST $API_URL/websocket/migration-config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enableWebSocket": true, "rolloutPercentage": 5}' | jq

# 訪問監控 Dashboard
open https://your-domain.com/monitoring/websocket
```

---

**最後更新**: 2025-10-08
**版本**: 1.0.0
**狀態**: ✅ 生產就緒
