# API 端點文檔

本文檔描述了所有已標準化的 API 端點，所有端點都使用統一的響應格式和錯誤處理機制。

## 標準響應格式

### 成功響應
```json
{
  "success": true,
  "data": <響應數據>,
  "message": "操作成功訊息",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_1234567890_abcdef"
}
```

### 錯誤響應
```json
{
  "success": false,
  "error": "錯誤訊息",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_1234567890_abcdef"
}
```

### 分頁響應
```json
{
  "success": true,
  "data": [<數據項目>],
  "message": "數據獲取成功",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_1234567890_abcdef"
}
```

### 驗證錯誤響應
```json
{
  "success": false,
  "error": "Validation failed",
  "data": {
    "code": "VALIDATION_ERROR",
    "errors": [
      {
        "field": "email",
        "message": "Email is required",
        "value": ""
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req_1234567890_abcdef"
}
```

## 認證端點

### POST /auth/login
用戶登入

**請求體:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**成功響應:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "agent": {
      "id": "agent_id",
      "email": "user@example.com",
      "name": "Agent Name",
      "role": "agent",
      "isActive": true,
      "createdAt": 1640995200000
    }
  },
  "message": "Login successful"
}
```

### GET /auth/me
獲取當前用戶資訊

**標頭:** `Authorization: Bearer <token>`

**成功響應:**
```json
{
  "success": true,
  "data": {
    "id": "agent_id",
    "email": "user@example.com",
    "name": "Agent Name",
    "role": "agent",
    "isActive": true,
    "createdAt": 1640995200000
  },
  "message": "User information retrieved successfully"
}
```

## 對話端點

### GET /conversations
獲取對話列表

**查詢參數:**
- `page`: 頁碼 (預設: 1)
- `pageSize`: 每頁數量 (預設: 20)
- `status`: 對話狀態 (open, assigned, closed)

**標頭:** `Authorization: Bearer <token>`

**成功響應:** 分頁響應格式，data 包含對話列表

### GET /conversations/:id
獲取單一對話

**標頭:** `Authorization: Bearer <token>`

**成功響應:**
```json
{
  "success": true,
  "data": {
    "id": "conv_id",
    "userId": "user_id",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "platform": "line",
      "platformUserId": "line_user_id",
      "avatarUrl": "avatar_url",
      "createdAt": 1640995200000
    },
    "assignedTo": "agent_id",
    "assignedAgent": {
      "id": "agent_id",
      "name": "Agent Name",
      "email": "agent@example.com",
      "role": "agent",
      "isActive": true,
      "createdAt": 1640995200000
    },
    "status": "open",
    "lastMessageAt": 1640995200000,
    "unreadCount": 5,
    "createdAt": 1640995200000,
    "updatedAt": 1640995200000
  }
}
```

### PUT /conversations/:id/assign
指派對話

**請求體:**
```json
{
  "agentId": "agent_id"
}
```

**標頭:** `Authorization: Bearer <token>`

### PUT /conversations/:id/close
關閉對話

**標頭:** `Authorization: Bearer <token>`

## 訊息端點

### GET /conversations/:id/messages
獲取對話訊息

**查詢參數:**
- `page`: 頁碼 (預設: 1)
- `pageSize`: 每頁數量 (預設: 50)

**標頭:** `Authorization: Bearer <token>`

**成功響應:** 分頁響應格式，data 包含訊息列表

### POST /conversations/:id/messages
發送訊息

**請求體:**
```json
{
  "content": "訊息內容",
  "mediaUrl": "媒體URL (可選)",
  "mediaType": "image|video|file (可選)",
  "attachmentIds": ["attachment_id1", "attachment_id2"]
}
```

**標頭:** `Authorization: Bearer <token>`

## 檔案附件端點

### POST /conversations/:id/attachments
上傳檔案附件

**請求體:** FormData
- `file`: 檔案
- `messageType`: "image" | "file"

**標頭:** `Authorization: Bearer <token>`

### GET /conversations/:id/attachments/:attachmentId
獲取檔案附件資訊

**標頭:** `Authorization: Bearer <token>`

### GET /conversations/:id/attachments/:attachmentId/download
下載檔案附件

**標頭:** `Authorization: Bearer <token>`

### DELETE /conversations/:id/attachments/:attachmentId
刪除檔案附件

**標頭:** `Authorization: Bearer <token>`

### GET /conversations/:id/attachments
獲取對話的所有附件

**查詢參數:**
- `page`: 頁碼 (預設: 1)
- `pageSize`: 每頁數量 (預設: 20)
- `type`: 檔案類型 ("image" | "document")

**標頭:** `Authorization: Bearer <token>`

## Webhook 端點

### POST /api/webhooks/line
LINE Webhook 處理

**標頭:** `X-Line-Signature: <signature>`

### POST /api/webhooks/facebook
Facebook Webhook 處理

### POST /api/webhook
向後兼容的 LINE Webhook 端點 (重定向到 `/api/webhooks/line`)

**查詢參數 (驗證模式):**
- `hub.mode`: "subscribe"
- `hub.verify_token`: 驗證令牌
- `hub.challenge`: 挑戰字符串

## 團隊管理端點

### GET /team/members
獲取團隊成員列表

**標頭:** `Authorization: Bearer <admin_token>`

### POST /team/invite
邀請新成員

**請求體:**
```json
{
  "email": "new@example.com",
  "name": "New Member",
  "role": "agent"
}
```

**標頭:** `Authorization: Bearer <admin_token>`

### POST /team/invite/:token/accept
接受邀請

**請求體:**
```json
{
  "password": "password123"
}
```

### GET /team/invite/:token
獲取邀請資訊

### PUT /team/members/:id/status
更新成員狀態

**請求體:**
```json
{
  "isActive": true
}
```

**標頭:** `Authorization: Bearer <admin_token>`

### DELETE /team/members/:id
刪除成員

**標頭:** `Authorization: Bearer <admin_token>`

### GET /team/invitations
獲取邀請列表

**標頭:** `Authorization: Bearer <admin_token>`

### DELETE /team/invitations/:id
撤銷邀請

**標頭:** `Authorization: Bearer <admin_token>`

## 系統管理端點

### GET /system/info
獲取系統資訊

**標頭:** `Authorization: Bearer <token>`

### GET /system/settings
獲取系統設定

**標頭:** `Authorization: Bearer <admin_token>`

### PUT /system/settings
更新系統設定

**標頭:** `Authorization: Bearer <admin_token>`

### POST /system/integrations/:platform/test
測試平台整合

**標頭:** `Authorization: Bearer <admin_token>`

### GET /system/metrics
獲取系統指標

**標頭:** `Authorization: Bearer <admin_token>`

### POST /system/backup
備份資料庫

**標頭:** `Authorization: Bearer <admin_token>`

### GET /system/backups
獲取備份列表

**標頭:** `Authorization: Bearer <admin_token>`

### POST /system/restore/:backupId
恢復資料庫

**標頭:** `Authorization: Bearer <admin_token>`

### POST /system/cache/clear
清除快取

**請求體:**
```json
{
  "type": "all|conversations|messages|sessions"
}
```

**標頭:** `Authorization: Bearer <admin_token>`

### POST /system/restart
重啟系統

**標頭:** `Authorization: Bearer <admin_token>`

### GET /system/health
健康檢查

## 錯誤代碼

| 代碼 | 描述 |
|------|------|
| UNAUTHORIZED | 未授權 |
| FORBIDDEN | 禁止訪問 |
| TOKEN_EXPIRED | 令牌過期 |
| INVALID_CREDENTIALS | 無效憑證 |
| VALIDATION_ERROR | 驗證錯誤 |
| REQUIRED_FIELD | 必填欄位 |
| INVALID_FORMAT | 格式無效 |
| NOT_FOUND | 資源未找到 |
| ALREADY_EXISTS | 資源已存在 |
| RESOURCE_CONFLICT | 資源衝突 |
| INTERNAL_ERROR | 內部錯誤 |
| SERVICE_UNAVAILABLE | 服務不可用 |
| RATE_LIMIT_EXCEEDED | 超出速率限制 |

## HTTP 狀態碼

| 狀態碼 | 描述 |
|--------|------|
| 200 | 成功 |
| 201 | 已創建 |
| 204 | 無內容 |
| 400 | 錯誤請求 |
| 401 | 未授權 |
| 403 | 禁止訪問 |
| 404 | 未找到 |
| 409 | 衝突 |
| 422 | 無法處理的實體 |
| 500 | 內部伺服器錯誤 |
| 503 | 服務不可用 |