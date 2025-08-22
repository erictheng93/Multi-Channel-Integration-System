# Drizzle ORM 和 KV 整合指南

這個文件說明如何在你的 Multi-Channel Support 專案中使用 Drizzle ORM 和 Cloudflare KV。

## 🚀 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 到 `.env` 並填入你的設定：

```bash
cp .env.example .env
```

重要的環境變數：
- `CLOUDFLARE_ACCOUNT_ID`: 你的 Cloudflare 帳號 ID
- `CLOUDFLARE_DATABASE_ID`: D1 資料庫 ID
- `CLOUDFLARE_D1_TOKEN`: D1 API Token
- `JWT_SECRET`: JWT 簽名密鑰

### 3. 建立 KV Namespaces

```bash
# 建立 Sessions KV
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# 建立 Cache KV  
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview
```

更新 `wrangler.toml` 中的 KV namespace IDs。

### 4. 生成和應用資料庫 Schema

```bash
# 生成 Drizzle 遷移檔案
npm run db:generate

# 應用到本地資料庫
npm run db:migrate

# 應用到生產資料庫
npm run db:migrate:prod
```

### 5. 啟動開發伺服器

```bash
npm run dev
```

## 🏗️ 架構概覽

### Drizzle ORM 整合

- **Schema 定義**: `src/db/schema.ts`
- **資料庫連接**: `src/db/index.ts`
- **服務層**: `src/services/database.ts`

### KV 整合

- **Sessions**: 儲存用戶登入 session
- **Cache**: 快取常用資料（對話、用戶資訊等）

### 中間件

- **Database Middleware**: 初始化 DB 和 KV 連接
- **Auth Middleware**: 基於 KV session 的認證

## 📝 API 端點

### 認證 API

```bash
# 登入
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

# 獲取當前用戶
GET /api/auth/me
Authorization: Bearer <token>

# 登出
POST /api/auth/logout
Authorization: Bearer <token>

# 註冊新客服 (僅管理員)
POST /api/auth/register
Authorization: Bearer <token>
{
  "username": "agent1",
  "email": "agent1@example.com", 
  "password": "password123",
  "displayName": "Agent One",
  "role": "agent"
}
```

### 對話 API

```bash
# 獲取對話列表
GET /api/conversations?status=pending&limit=20&page=1
Authorization: Bearer <token>

# 獲取特定對話
GET /api/conversations/:id
Authorization: Bearer <token>

# 發送訊息
POST /api/conversations/:id/messages
Authorization: Bearer <token>
{
  "content": "Hello, how can I help you?",
  "messageType": "text"
}

# 更新對話狀態
PATCH /api/conversations/:id/status
Authorization: Bearer <token>
{
  "status": "in-progress"
}

# 標記訊息為已讀
POST /api/conversations/:id/mark-read
Authorization: Bearer <token>
```

## 🔧 開發工具

### Drizzle Studio

```bash
npm run db:studio
```

在瀏覽器中查看和編輯資料庫。

### 資料庫指令

```bash
# 生成新的遷移
npm run db:generate

# 推送 schema 變更到資料庫
npm run db:push

# 從現有資料庫反向工程 schema
npm run db:introspect
```

## 🎯 主要功能

### 1. 型別安全的資料庫操作

```typescript
import { DatabaseService } from '../services/database';

const dbService = new DatabaseService(db, kv);

// 建立用戶 - 完全型別安全
const user = await dbService.createUser({
  platformId: 'line_user_123',
  platform: 'line',
  displayName: 'John Doe',
});
```

### 2. 智能快取

```typescript
// 自動快取用戶資料
const user = await dbService.getUserById('user-123'); // 從資料庫
const cachedUser = await dbService.getUserById('user-123'); // 從快取

// 手動快取管理
await kv.cacheConversation('conv-123', conversation, 1800); // 30分鐘 TTL
```

### 3. Session 管理

```typescript
// 登入時建立 session
const sessionToken = uuidv4();
const sessionData = {
  agentId: agent.id,
  username: agent.username,
  role: agent.role,
  loginAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

await kv.setSession(sessionToken, sessionData, 86400);
```

## 🔄 資料遷移

如果你有現有的資料需要遷移：

1. 檢查 `scripts/migrate-to-drizzle.ts`
2. 根據你的資料結構調整遷移邏輯
3. 在開發環境中測試遷移

## 🚨 注意事項

### 效能最佳化

1. **KV 快取策略**: 常用資料自動快取，TTL 根據資料更新頻率調整
2. **資料庫查詢**: 使用 Drizzle 的查詢最佳化功能
3. **Session 管理**: KV 提供快速的 session 查詢

### 安全性

1. **密碼雜湊**: 使用 bcrypt 12 rounds
2. **Session 過期**: 24小時自動過期
3. **權限檢查**: 基於角色的存取控制

### 監控

1. **錯誤處理**: 完整的錯誤日誌
2. **效能監控**: 查詢時間和快取命中率
3. **KV 使用量**: 監控 KV 儲存使用情況

## 🔗 相關文件

- [Drizzle ORM 文件](https://orm.drizzle.team/)
- [Cloudflare KV 文件](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare D1 文件](https://developers.cloudflare.com/d1/)

## 🤝 貢獻

如果你發現任何問題或有改進建議，請建立 issue 或 pull request。