# 事件驅動推送系統部署指南

## 🚀 系統概述

本次升級將原有的定時查詢 SSE 系統替換為事件驅動的 Cloudflare Queue 系統，實現真正的零延遲實時推送。

## 📋 部署清單

### 1. **Cloudflare Queue 配置**
- ✅ 在 `wrangler.toml` 中配置 `REALTIME_QUEUE`
- ✅ 隊列設置：batch_size=5, batch_timeout=1s
- 🔲 **需要部署**: `wrangler deploy` 建立隊列

### 2. **新增文件**
- ✅ `src/types/events.ts` - 事件類型定義
- ✅ `src/handlers/realtime-queue.ts` - 隊列事件處理器
- ✅ `src/handlers/realtime-v2.ts` - 新版 SSE 處理器
- ✅ `test-event-driven-push.js` - 測試腳本

### 3. **修改的文件**
- ✅ `src/types/index.ts` - 添加 REALTIME_QUEUE 綁定
- ✅ `src/handlers/conversation.ts` - 集成消息事件推送
- ✅ `src/handlers/webhook.ts` - 集成 LINE 消息事件推送
- ✅ `src/index.ts` - 使用新版處理器和隊列路由

### 4. **部署前檢查**

```bash
# 1. TypeScript 檢查
npm run build

# 2. 測試運行
npm run test

# 3. Lint 檢查
npm run lint:check

# 4. 部署到生產環境
npm run deploy
```

## 🔄 系統架構對比

### **舊架構 (定時查詢)**
```
消息創建 → 存儲到資料庫 → SSE 每3秒查詢 → 推送到前端
延遲: 0-3秒 + 查詢開銷
```

### **新架構 (事件驅動)**
```
消息創建 → 存儲到資料庫 + 推送到隊列 → 隊列處理器立即推送到 SSE → 前端
延遲: <100ms
```

## 📊 性能預期改善

| 指標 | 舊系統 | 新系統 | 改善 |
|------|--------|--------|------|
| 消息延遲 | 0-3秒 | <100ms | **95%↓** |
| 資料庫查詢 | 每3秒 | 僅在需要時 | **90%↓** |
| 資源使用 | 持續高負載 | 按需使用 | **80%↓** |
| 併發支持 | 受限於查詢頻率 | 隊列無限擴展 | **無限制** |

## 🧪 測試步驟

### 1. **自動化測試**
```bash
# 運行現有測試確保向後兼容
npm run test

# 特別關注 SSE 和消息相關測試
npm run test -- --grep "SSE|message|realtime"
```

### 2. **手動測試**
1. 開啟瀏覽器控制台
2. 載入測試腳本: `test-event-driven-push.js`
3. 替換 JWT token 和對話 ID
4. 執行測試並觀察結果

### 3. **性能測試**
```bash
# 監控隊列處理性能
wrangler tail --env production

# 觀察 SSE 連接統計
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/realtime/conversation/1/status
```

## 🚨 風險評估與回滾計劃

### **潛在風險**
1. **隊列延遲**: Cloudflare Queue 可能在高負載時有延遲
2. **連接管理**: SSE 連接管理器記憶體使用
3. **事件重複**: 隊列重試可能導致重複事件

### **監控指標**
- 隊列處理時間 < 1秒
- SSE 連接數 < 1000
- 事件重複率 < 0.1%

### **回滾計劃**
如果出現問題，可以快速回滾：

```bash
# 1. 切換回舊的 realtime handler
# 修改 src/index.ts:
# import { realtimeHandler } from './handlers/realtime';
# app.get('/api/realtime/sse', realtimeHandler.sse);

# 2. 重新部署
wrangler deploy
```

## 🔧 配置說明

### **環境變數**
無需新增環境變數，使用現有的：
- `JWT_SECRET`
- `DB` (D1 Database)
- `SESSIONS` (KV Namespace)
- `REALTIME_QUEUE` (新增的 Queue 綁定)

### **隊列配置調優**
根據負載情況可以調整：

```toml
# wrangler.toml
[[queues.consumers]]
queue = "realtime-events"
max_batch_size = 5      # 可調整 1-100
max_batch_timeout = 1   # 可調整 1-30 秒
```

## 📈 監控和日誌

### **關鍵日誌**
- `🚀 [Message] Event queued for message X` - 消息事件已推送
- `📡 [SSE Manager] Connection registered` - SSE 連接建立
- `✅ [Queue Handler] Event X pushed to Y connections` - 事件成功推送

### **性能監控**
```bash
# 查看隊列統計
wrangler queues list

# 監控即時日誌
wrangler tail --env production --format pretty
```

## ✅ 部署後驗證

1. **功能驗證**
   - [ ] SSE 連接正常建立
   - [ ] 新消息立即顯示（<1秒）
   - [ ] 打字狀態實時更新
   - [ ] 無重複消息

2. **性能驗證**
   - [ ] 消息延遲 < 500ms
   - [ ] SSE 連接穩定
   - [ ] 隊列處理無堆積

3. **相容性驗證**
   - [ ] 現有功能無影響
   - [ ] 前端正常工作
   - [ ] 測試全部通過

## 🎯 預期成果

部署成功後，用戶將體驗到：
- **即時消息**: LINE 消息幾乎零延遲顯示
- **更好性能**: 系統響應更快，資源使用更少
- **更高穩定性**: 事件驅動架構更可靠
- **更好擴展性**: 支持更多並發用戶

這是一個重大的架構升級，將客服系統的實時性提升到企業級水準！