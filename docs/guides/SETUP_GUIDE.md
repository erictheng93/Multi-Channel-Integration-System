# 🚀 multi-channel-platform 完整設置指南

## 📋 前置需求

### 1. Cloudflare 帳戶設置
- 註冊 [Cloudflare](https://cloudflare.com) 帳戶
- 升級到 Workers Paid Plan（$5/月，包含更多資源）
- 確保有域名（可選，用於自訂域名）

### 2. LINE 開發者設置
- 註冊 [LINE Developers](https://developers.line.biz/) 帳戶
- 建立 LINE Official Account
- 建立 Messaging API Channel
- 取得 Channel Access Token 和 Channel Secret

### 3. Facebook 開發者設置（可選）
- 註冊 [Facebook Developers](https://developers.facebook.com/) 帳戶
- 建立 Facebook App
- 設置 Messenger Platform
- 取得 Page Access Token

## 🛠️ 步驟一：Cloudflare 服務設置

### 1.1 安裝 Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 1.2 建立 D1 資料庫
```bash
# 建立資料庫
wrangler d1 create omni-channel-platform

# 記錄返回的 database_id，更新到 wrangler.jsonc
```

### 1.3 建立 KV 命名空間
```bash
# 建立會話存儲
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# 建立快取存儲
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# 記錄返回的 ID，更新到 wrangler.jsonc
```

### 1.4 建立 R2 存儲桶
```bash
# 建立檔案存儲
wrangler r2 bucket create omni-files

# 建立頭像存儲
wrangler r2 bucket create omni-avatars
```

### 1.5 建立 Queues
```bash
# 建立訊息處理佇列
wrangler queues create message-processing

# 建立通知佇列
wrangler queues create notifications

# 建立延遲發送佇列
wrangler queues create delayed-messages
```

## 🔧 步驟二：專案配置

### 2.1 更新 wrangler.jsonc
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "multi-channel-platform",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
  "observability": {
    "logs": {
      "enabled": true
    }
  },
  "routes": [
    {
      "pattern": "multi-channel-platform.imfinethankyouandyou.com/*",
      "zone_name": "imfinethankyouandyou.com"
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "omni-channel-platform",
      "database_id": "YOUR_DATABASE_ID_HERE"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSIONS",
      "id": "YOUR_SESSIONS_KV_ID_HERE",
      "preview_id": "YOUR_SESSIONS_PREVIEW_ID_HERE"
    },
    {
      "binding": "CACHE",
      "id": "YOUR_CACHE_KV_ID_HERE", 
      "preview_id": "YOUR_CACHE_PREVIEW_ID_HERE"
    }
  ],
  "r2_buckets": [
    {
      "binding": "FILES",
      "bucket_name": "omni-files"
    },
    {
      "binding": "AVATARS",
      "bucket_name": "omni-avatars"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "MESSAGE_QUEUE",
        "queue": "message-processing"
      },
      {
        "binding": "NOTIFICATION_QUEUE", 
        "queue": "notifications"
      },
      {
        "binding": "DELAYED_QUEUE",
        "queue": "delayed-messages"
      }
    ],
    "consumers": [
      {
        "queue": "message-processing",
        "max_batch_size": 10,
        "max_batch_timeout": 30
      },
      {
        "queue": "notifications",
        "max_batch_size": 5,
        "max_batch_timeout": 10
      },
      {
        "queue": "delayed-messages",
        "max_batch_size": 1,
        "max_batch_timeout": 1
      }
    ]
  },
  "crons": [
    {
      "cron": "*/5 * * * *",
      "name": "cleanup-expired-sessions"
    },
    {
      "cron": "0 */6 * * *", 
      "name": "generate-statistics"
    }
  ]
}
```

### 2.2 設置環境變數 (Secrets)
```bash
# LINE 相關
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET

# Facebook 相關（可選）
wrangler secret put FACEBOOK_PAGE_ACCESS_TOKEN
wrangler secret put FACEBOOK_APP_SECRET

# JWT 密鑰
wrangler secret put JWT_SECRET

# 加密密鑰
wrangler secret put ENCRYPTION_KEY

# 管理員密碼
wrangler secret put ADMIN_PASSWORD
```

## 💾 步驟三：資料庫初始化

### 3.1 建立遷移檔案
```bash
mkdir -p migrations
```

### 3.2 執行資料庫遷移
```bash
# 本地開發環境
wrangler d1 migrations apply omni-channel-platform --local

# 生產環境
wrangler d1 migrations apply omni-channel-platform
```

### 3.3 插入初始資料
```bash
# 建立管理員帳戶和預設資料
wrangler d1 execute omni-channel-platform --local --file=./seed.sql
```

## 🚀 步驟四：開發與測試

### 4.1 本地開發
```bash
# 安裝依賴
npm install

# 生成類型定義
npm run cf-typegen

# 啟動開發服務器
npm run dev
```

### 4.2 測試 API 端點
```bash
# 健康檢查
curl http://localhost:8787/health

# 測試 Webhook（需要設置 LINE Channel Secret）
curl -X POST http://localhost:8787/api/webhooks/line \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'
```

### 4.3 測試資料庫連接
```bash
# 查看資料庫內容
wrangler d1 execute omni-channel-platform --local --command="SELECT * FROM users LIMIT 5"
```

## 🌐 步驟五：部署到生產環境

### 5.1 部署 Workers
```bash
# 部署主要 Worker
npm run deploy

# 檢查部署狀態
wrangler deployments list
```

### 5.2 設置 LINE Webhook
1. 登入 LINE Developers Console
2. 選擇你的 Messaging API Channel
3. 在 "Webhook settings" 中設置：
   - Webhook URL: `https://your-domain.com/api/webhook`
   - 啟用 "Use webhook"

### 5.3 設置 Facebook Webhook（可選）
1. 登入 Facebook Developers Console
2. 設置 Webhook URL: `https://your-domain.com/api/facebook/webhook`
3. 訂閱必要的事件

## 📊 步驟六：監控與維護

### 6.1 設置監控
```bash
# 查看 Worker 日誌
wrangler tail

# 查看 D1 使用情況
wrangler d1 info omni-channel-platform

# 查看 KV 使用情況
wrangler kv:namespace list
```

### 6.2 備份策略
```bash
# 定期備份資料庫
wrangler d1 export omni-channel-platform --output=backup-$(date +%Y%m%d).sql
```

## 🔒 步驟七：安全設置

### 7.1 設置 CORS 和安全標頭
已在代碼中實現，包括：
- CORS 設置
- 安全標頭
- 輸入驗證
- SQL 注入防護

### 7.2 設置 Rate Limiting
```typescript
// 已在代碼中實現基於 IP 的速率限制
```

### 7.3 設置 SSL/TLS
Cloudflare 自動提供 SSL 憑證，無需額外設置。

## 🎯 步驟八：功能驗證

### 8.1 基礎功能測試
- [ ] ✅ LINE Webhook 接收正常
- [ ] ✅ 資料庫讀寫正常
- [ ] ✅ 用戶認證功能
- [ ] ✅ 團隊管理功能
- [ ] ✅ 對話管理功能

### 8.2 進階功能測試
- [ ] ✅ 標籤系統
- [ ] ✅ 權限控制
- [ ] ✅ 轉移指派
- [ ] ✅ QR Code 生成
- [ ] ✅ 撤回機制

## 🚨 常見問題排除

### Q1: 資料庫連接失敗
```bash
# 檢查資料庫 ID 是否正確
wrangler d1 list

# 檢查資料庫是否存在
wrangler d1 info omni-channel-platform
```

### Q2: Secrets 設置問題
```bash
# 列出所有 secrets
wrangler secret list

# 重新設置 secret
wrangler secret put SECRET_NAME
```

### Q3: 部署失敗
```bash
# 檢查 wrangler.jsonc 語法
npx jsonc-parser wrangler.jsonc

# 檢查 TypeScript 編譯
npx tsc --noEmit
```

### Q4: LINE Webhook 驗證失敗
- 確認 Channel Secret 設置正確
- 檢查 Webhook URL 是否可訪問
- 查看 Worker 日誌確認錯誤

## 📚 下一步

完成設置後，你可以：

1. **開始開發 MVP 功能**：按照 MIGRATION_PLAN.md 的階段計劃
2. **設置前端界面**：使用 Cloudflare Pages 部署管理界面
3. **整合更多渠道**：添加 Facebook Messenger、Instagram 等
4. **優化效能**：根據使用情況調整資源配置
5. **擴展功能**：添加更多企業級功能

## 🎉 恭喜！

你的 multi-channel-platform 基礎設施已經設置完成！現在可以開始按照遷移計劃逐步實現 MVP 功能了。