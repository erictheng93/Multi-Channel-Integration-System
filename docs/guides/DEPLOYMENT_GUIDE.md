# 多渠道客服系統部署指南

## 系統架構概覽

這是一個基於 Cloudflare Workers 的多渠道客服管理系統，支援以下功能：

### 核心功能
- ✅ **多平台整合**: Line OA, Facebook Messenger
- ✅ **權限管理**: 基於角色的訪問控制 (RBAC)
- ✅ **團隊協作**: 內建權限管理和對話指派
- ✅ **QR Code 生成**: 自動客戶指派
- ✅ **訊息撤回**: 延遲發送機制 (0-120秒)
- ✅ **標籤系統**: 客戶和對話標籤管理
- ✅ **對話轉移**: 團隊間對話轉移
- ✅ **即時協作**: 基於 Durable Objects 的 WebSocket

### 技術棧
- **後端**: Cloudflare Workers (Hono.js)
- **ORM**: Drizzle ORM (型別安全的資料庫操作)
- **資料庫**: Cloudflare D1 (SQLite)
- **快取**: Cloudflare KV (Session 管理 + 智能快取)
- **檔案存儲**: Cloudflare R2
- **佇列**: Cloudflare Queues
- **即時通訊**: Durable Objects + WebSocket
- **前端**: Vue.js 3 + TypeScript

## 部署步驟

### 1. 環境準備

```bash
# 安裝 Wrangler CLI
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 克隆專案
git clone <your-repo>
cd multi-channel-platform

# 安裝依賴
npm install
```

### 2. Cloudflare 服務設置

#### 2.1 創建 D1 資料庫
```bash
# 創建資料庫
wrangler d1 create omni-channel-platform

# 使用 Drizzle 生成和應用遷移
npm run db:generate
npm run db:migrate:prod

# 或手動執行 SQL
wrangler d1 execute omni-channel-platform --file=./database/schema.sql
```

#### 2.2 創建 KV 命名空間
```bash
# 創建 Sessions KV (用於用戶 session 管理)
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# 創建 Cache KV (用於資料快取)
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# 更新 wrangler.toml 中的 KV namespace IDs
```

#### 2.3 創建 R2 存儲桶
```bash
# 創建 R2 存儲桶
wrangler r2 bucket create multi-channel-platform-files
```

#### 2.4 創建 Queues
```bash
# 創建訊息佇列
wrangler queues create message-queue
wrangler queues create delayed-message-queue
```

### 3. 環境變數配置

創建 `.dev.vars` 檔案（基於 `.env.example`）：

```env
# JWT 設定
JWT_SECRET=your-super-secret-jwt-key-here

# LINE Bot 配置
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# Facebook Messenger 配置
FACEBOOK_PAGE_ACCESS_TOKEN=your-facebook-page-access-token
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_VERIFY_TOKEN=your-facebook-verify-token

# Cloudflare 配置 (用於 Drizzle)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_DATABASE_ID=37537e1f-625e-4cf9-be60-a01b5c063772
CLOUDFLARE_D1_TOKEN=your-cloudflare-d1-token

# 檔案上傳配置
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf

# 應用程式配置
ENVIRONMENT=production
APP_URL=https://multi-channel-platform.workers.dev
FRONTEND_URL=https://your-frontend.pages.dev
```

### 4. wrangler.toml 配置

確認 `wrangler.toml` 配置（已更新為使用 Drizzle）：

```toml
name = "multi-channel-platform"
main = "src/index-drizzle.ts"  # 使用 Drizzle ORM 入口點
compatibility_date = "2025-07-31"
compatibility_flags = ["nodejs_compat"]

# D1 資料庫綁定
[[d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"
database_id = "37537e1f-625e-4cf9-be60-a01b5c063772"

# KV Namespaces 綁定
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-kv-id"  # 替換為實際 ID
preview_id = "your-sessions-kv-preview-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-kv-id"  # 替換為實際 ID
preview_id = "your-cache-kv-preview-id"

# R2 存儲綁定
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "omni-channel-attachments-production"

# Queues 綁定
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue-prod"

# 生產環境配置
[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"
database_id = "37537e1f-625e-4cf9-be60-a01b5c063772"
```

### 5. 前端配置

前端已配置為 Vue.js 應用，將部署到 Cloudflare Pages。

#### 5.1 前端建置配置

```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install

# 建置前端 (包含 Pages 配置)
npm run build:pages
```

#### 5.2 Cloudflare Pages 部署

```bash
# 使用 Wrangler 部署到 Pages
wrangler pages deploy frontend/dist --project-name=multi-channel-platform-frontend

# 或使用 PowerShell 腳本
.\deploy-frontend.ps1 production
```

### 6. 部署應用

#### 6.1 後端部署 (Cloudflare Workers)

```bash
# 開發環境測試
wrangler dev

# 部署到生產環境
wrangler deploy --env production
```

#### 6.2 前端部署 (Cloudflare Pages)

```bash
# 前端開發 (在 frontend/ 目錄)
cd frontend && npm run dev

# 前端建置和部署
cd frontend && npm run build:pages
wrangler pages deploy dist --project-name=multi-channel-platform-frontend
```

#### 6.3 環境變數設定

在 Cloudflare Pages Dashboard 中設定：

**生產環境變數**:
```
VITE_API_BASE_URL=https://multi-channel-platform.workers.dev
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
```

**預覽環境變數**:
```
VITE_API_BASE_URL=https://multi-channel-platform.workers.dev
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

### 7. 設置 Webhook

#### 6.1 Line Bot Webhook
在 Line Developers Console 設置：
- Webhook URL: `https://multi-channel-platform.workers.dev/api/webhook`
- 啟用 Webhook

#### 6.2 Facebook Messenger Webhook
在 Facebook Developers Console 設置：
- Webhook URL: `https://multi-channel-platform.workers.dev/api/webhook` (Facebook 支援未來實現)
- Verify Token: 使用 `.dev.vars` 中的 `FB_VERIFY_TOKEN`
- 訂閱事件: messages, messaging_postbacks

### 8. 初始化系統

#### 7.1 創建管理員帳戶
```bash
# 使用 Wrangler 執行 SQL
wrangler d1 execute multi-channel-platform --command="
INSERT INTO users (username, email, password_hash, role, is_active) 
VALUES ('admin', 'admin@example.com', 'hashed_password', 'admin', TRUE)
"
```

#### 7.2 創建預設團隊
```bash
wrangler d1 execute multi-channel-platform --command="
INSERT INTO teams (name, description, is_active) 
VALUES ('客服團隊', '預設客服團隊', TRUE)
"
```

## 系統使用

### 1. 管理後台
訪問 `https://multi-channel-platform.workers.dev/admin-dashboard.html`

### 2. API 端點

#### 認證相關
- `POST /api/auth/login` - 用戶登入
- `POST /api/auth/logout` - 用戶登出
- `GET /api/auth/profile` - 獲取用戶資料

#### 團隊管理
- `GET /api/teams` - 獲取團隊列表
- `POST /api/teams` - 創建團隊
- `POST /api/teams/:id/qr-code` - 生成團隊 QR Code

#### 對話管理
- `GET /api/conversations` - 獲取對話列表
- `POST /api/conversations/:id/assign` - 指派對話
- `POST /api/conversations/:id/transfer` - 轉移對話

#### 訊息管理
- `POST /api/messages/send` - 發送訊息
- `POST /api/messages/:id/recall` - 撤回訊息
- `GET /api/messages/pending` - 獲取待發送訊息

### 3. Webhook 端點
- `POST /api/webhooks/line` - LINE Bot Webhook
- `POST /api/webhooks/facebook` - Facebook Messenger Webhook
- `POST /api/webhook` - 向後兼容端點 (重定向到 LINE)

## 監控和維護

### 1. 日誌監控
```bash
# 查看 Worker 日誌
wrangler tail

# 查看特定環境日誌
wrangler tail --env production
```

### 2. 資料庫維護
```bash
# 查詢資料庫
wrangler d1 execute multi-channel-platform --command="SELECT COUNT(*) FROM messages"

# 備份資料庫
wrangler d1 export multi-channel-platform --output backup.sql
```

### 3. 效能監控
- 使用 Cloudflare Analytics 監控請求量
- 監控 D1 資料庫使用量
- 監控 KV 和 R2 使用量

## 擴展功能

### 1. 新增平台支援
1. 在 `src/integrations/` 創建新的平台適配器
2. 實作 `PlatformAdapter` 介面
3. 在主 Worker 中添加新的 Webhook 端點

### 2. 自訂權限規則
1. 修改 `src/services/permission-service.ts`
2. 在資料庫中添加新的權限配置
3. 更新前端權限檢查邏輯

### 3. 整合 AI 客服
1. 添加 OpenAI 或其他 AI 服務整合
2. 實作智能回覆邏輯
3. 添加訓練資料管理功能

## 故障排除

### 常見問題

1. **Webhook 驗證失敗**
   - 檢查 Channel Secret 是否正確
   - 確認 Webhook URL 可以正常訪問

2. **資料庫連接失敗**
   - 檢查 D1 資料庫 ID 是否正確
   - 確認資料庫已正確綁定到 Worker

3. **訊息發送失敗**
   - 檢查 Access Token 是否有效
   - 確認用戶是否已加入 Bot

4. **權限錯誤**
   - 檢查用戶角色設定
   - 確認團隊指派是否正確

### 調試技巧

1. **本地開發**
```bash
# 使用本地資料庫
wrangler d1 execute multi-channel-platform --local --file=./schema.sql

# 本地開發模式
wrangler dev --local
```

2. **日誌分析**
```bash
# 實時查看日誌
wrangler tail --format pretty

# 過濾特定日誌
wrangler tail --search "ERROR"
```

## 安全考量

1. **環境變數保護**
   - 使用 Cloudflare Workers Secrets 存儲敏感資訊
   - 定期輪換 API 金鑰

2. **輸入驗證**
   - 所有用戶輸入都經過驗證和清理
   - 實作 SQL 注入防護

3. **權限控制**
   - 實作最小權限原則
   - 定期審核用戶權限

4. **資料加密**
   - 敏感資料在存儲時加密
   - 使用 HTTPS 傳輸

## 效能優化

1. **快取策略**
   - 使用 KV 快取常用資料
   - 實作適當的快取過期策略

2. **資料庫優化**
   - 建立適當的索引
   - 定期清理舊資料

3. **請求優化**
   - 實作請求去重
   - 使用批次處理減少 API 調用

## 成本控制

1. **監控使用量**
   - 定期檢查各服務使用量
   - 設置使用量警報

2. **優化策略**
   - 合理設置快取時間
   - 清理不必要的資料

3. **預算管理**
   - 設置 Cloudflare 預算警報
   - 定期評估成本效益

---

## 支援

如有問題，請參考：
1. [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
2. [Line Bot SDK 文檔](https://developers.line.biz/en/docs/)
3. [Facebook Messenger API 文檔](https://developers.facebook.com/docs/messenger-platform/)

---

**版本**: 1.0.0  
**最後更新**: 2025-01-08