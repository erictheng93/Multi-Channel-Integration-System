# 延遲訊息撤回功能部署指南

## 技術架構概述

### 核心技術組合
1. **Cloudflare Queues** - 延遲訊息發送的核心機制
2. **Cloudflare KV** - 快速撤回狀態標記和 TTL 自動清理
3. **Cloudflare D1** - 持久化儲存和審計記錄

### 架構優勢
- **低延遲**: KV 提供毫秒級撤回響應
- **高可靠性**: Queues 保證訊息最終發送
- **成本效益**: 無需額外 Durable Objects
- **自動擴展**: 水平擴展能力

## 部署步驟

### 1. 啟用 Cloudflare Queues

#### 1.1 更新 wrangler.toml
```toml
# Queues 綁定 - 延遲訊息功能
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue"

# 生產環境 Queues 綁定
[[env.production.queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue-prod"
```

#### 1.2 創建 Queue
```bash
# 開發環境
wrangler queues create message-queue

# 生產環境
wrangler queues create message-queue-prod
```

### 2. 資料庫結構部署

#### 2.1 執行資料庫遷移
```bash
# 本地開發環境
wrangler d1 execute DB --local --file=database/delayed-messages-schema.sql

# 生產環境
wrangler d1 execute DB --file=database/delayed-messages-schema.sql
```

#### 2.2 驗證資料庫結構
```bash
# 檢查表是否創建成功
wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%message%';"
```

### 3. 部署 Worker

#### 3.1 部署主要 Worker
```bash
# 部署到開發環境
wrangler deploy

# 部署到生產環境
wrangler deploy --env production
```

#### 3.2 部署 Queue Consumer
```bash
# 如果使用獨立的 Queue Consumer
wrangler deploy --config wrangler-delayed-message.toml
```

### 4. 配置環境變數

確保以下環境變數已正確配置：

```bash
# LINE 平台
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret

# Facebook 平台
FB_PAGE_ACCESS_TOKEN=your_fb_token
FB_VERIFY_TOKEN=your_fb_verify_token

# 其他配置
ENVIRONMENT=production
```

### 5. 測試部署

#### 5.1 API 端點測試
```bash
# 測試發送延遲訊息
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/delayed-messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "conversationId": 1,
    "content": "測試延遲訊息",
    "delaySeconds": 10
  }'

# 測試撤回訊息
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/delayed-messages/recall \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "messageId": "your-message-id"
  }'
```

#### 5.2 Queue 功能測試
```bash
# 檢查 Queue 狀態
wrangler queues list

# 查看 Queue 統計
wrangler queues consumer list message-queue
```

## 監控和維護

### 1. 日誌監控

#### 1.1 Worker 日誌
```bash
# 實時查看日誌
wrangler tail

# 查看特定時間範圍的日誌
wrangler tail --since 1h
```

#### 1.2 Queue 監控
```bash
# 查看 Queue 統計
wrangler queues consumer list message-queue

# 查看失敗的訊息
wrangler queues consumer show message-queue
```

### 2. 效能監控

#### 2.1 KV 使用情況
- 監控 KV 讀寫次數
- 檢查 TTL 設定是否合理
- 觀察撤回成功率

#### 2.2 D1 效能
- 監控資料庫查詢效能
- 檢查索引使用情況
- 定期清理過期資料

### 3. 定期維護

#### 3.1 資料清理腳本
```sql
-- 清理 7 天前的已處理訊息
DELETE FROM pending_messages 
WHERE status IN ('sent', 'cancelled', 'failed') 
AND updated_at < datetime('now', '-7 days');

-- 清理 30 天前的撤回日誌
DELETE FROM message_recall_logs 
WHERE created_at < datetime('now', '-30 days');
```

#### 3.2 自動化清理
可以設置 Cron Trigger 定期執行清理：

```toml
# wrangler.toml
[[triggers.crons]]
cron = "0 2 * * *"  # 每天凌晨 2 點執行
```

## 故障排除

### 1. 常見問題

#### 1.1 Queue 訊息未處理
- 檢查 Queue Consumer 是否正確部署
- 驗證 Queue 綁定配置
- 查看 Worker 日誌中的錯誤訊息

#### 1.2 撤回功能失效
- 檢查 KV 命名空間配置
- 驗證 TTL 設定
- 確認時間同步問題

#### 1.3 訊息發送失敗
- 檢查平台 API 憑證
- 驗證網路連接
- 查看平台 API 限制

### 2. 除錯工具

#### 2.1 本地測試
```bash
# 本地運行 Worker
wrangler dev

# 本地測試 Queue
wrangler queues consumer add message-queue --script-name=your-worker
```

#### 2.2 生產環境除錯
```bash
# 查看即時日誌
wrangler tail --env production

# 檢查資源使用情況
wrangler analytics
```

## 效能優化建議

### 1. KV 優化
- 使用合理的 TTL 值避免不必要的儲存
- 批次操作減少 API 調用次數
- 使用適當的鍵命名策略

### 2. Queue 優化
- 設定合理的批次大小
- 配置適當的重試策略
- 監控 Queue 深度避免積壓

### 3. D1 優化
- 使用索引優化查詢效能
- 定期清理過期資料
- 批次操作減少事務開銷

## 安全考量

### 1. 權限控制
- 確保只有授權用戶可以撤回自己的訊息
- 實施適當的 JWT 驗證
- 記錄所有撤回操作用於審計

### 2. 資料保護
- 敏感資料加密儲存
- 定期備份重要資料
- 實施資料保留政策

### 3. API 安全
- 實施速率限制
- 驗證輸入參數
- 使用 HTTPS 加密傳輸

## 成本估算

### 1. Cloudflare 服務成本
- **Workers**: 基於請求數量計費
- **KV**: 基於讀寫操作計費
- **D1**: 基於資料庫大小和查詢次數
- **Queues**: 基於訊息數量計費

### 2. 成本優化
- 合理設定 TTL 減少 KV 儲存成本
- 定期清理資料減少 D1 儲存成本
- 批次處理減少 API 調用成本

這個架構提供了一個高效、可靠且成本效益的延遲訊息撤回解決方案，完全利用了 Cloudflare 平台的優勢。