# 模組化API參考文檔
# Modular API Reference Documentation

## 概述 (Overview)

本文檔描述了重構後的模組化API架構，每個模組都有明確的職責範圍和標準化的接口設計。

### 模組架構圖 (Module Architecture)

```
        Multi-Channel Integration System API
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼───┐        ┌──────▼──────┐      ┌──────▼──────┐
│ Auth  │        │Conversations│      │  Customer   │
│Module │        │   Module    │      │   Module    │
└───┬───┘        └──────┬──────┘      └──────┬──────┘
    │                   │                    │
┌───▼───┐        ┌──────▼──────┐      ┌──────▼──────┐
│Teams  │        │ Messaging   │      │  Session    │
│Module │        │   Module    │      │   Module    │
└───┬───┘        └──────┬──────┘      └──────┬──────┘
    │                   │                    │
┌───▼───┐        ┌──────▼──────┐      ┌──────▼──────┐
│System │        │Integration  │      │  QRCode     │
│Module │        │   Module    │      │   Module    │
└───────┘        └─────────────┘      └─────────────┘
```

## 基礎信息 (Base Information)

### API基礎URL
- **開發環境**: `http://localhost:8787`
- **生產環境**: `https://your-domain.workers.dev`

### 通用響應格式

```json
{
  "success": true|false,
  "data": object|array|null,
  "message": "string",
  "timestamp": "ISO8601",
  "requestId": "string"
}
```

### 錯誤響應格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": object,
    "timestamp": "ISO8601",
    "requestId": "string"
  }
}
```

---

## 🔐 Auth Module

**基礎路徑**: `/api/auth`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| POST | `/login` | 用戶登入 | ❌ |
| POST | `/logout` | 用戶登出 | ✅ |
| POST | `/refresh` | 刷新令牌 | ❌ |
| GET | `/me` | 獲取當前用戶信息 | ✅ |
| GET | `/health` | 模組健康檢查 | ❌ |

### 詳細API

#### POST /api/auth/login
用戶登入認證

**請求體**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**響應**:
```json
{
  "success": true,
  "data": {
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "agent": {
      "id": "agent-123",
      "email": "user@example.com",
      "displayName": "User Name",
      "role": "agent|admin",
      "teamId": 1,
      "isActive": true
    }
  },
  "message": "Login successful"
}
```

#### GET /api/auth/me
獲取當前用戶信息

**Headers**: `Authorization: Bearer <token>`

**響應**:
```json
{
  "success": true,
  "data": {
    "id": "agent-123",
    "email": "user@example.com",
    "displayName": "User Name",
    "role": "agent",
    "teamId": 1,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 💬 Conversations Module

**基礎路徑**: `/api/conversations`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/` | 列出對話 | ✅ |
| POST | `/` | 創建新對話 | ✅ |
| GET | `/:id` | 獲取對話詳情 | ✅ |
| PUT | `/:id` | 更新對話 | ✅ |
| DELETE | `/:id` | 刪除對話 | ✅ |
| POST | `/:id/assign` | 分配對話 | ✅ |
| POST | `/:id/transfer` | 轉移對話 | ✅ |
| GET | `/:id/messages` | 獲取對話消息 | ✅ |
| POST | `/:id/messages` | 發送消息 | ✅ |

### 詳細API

#### GET /api/conversations
列出對話（分頁）

**查詢參數**:
- `page`: 頁碼 (默認: 1)
- `limit`: 每頁數量 (默認: 20, 最大: 100)
- `status`: 對話狀態 (`open`, `closed`, `pending`)
- `teamId`: 團隊ID
- `agentId`: 代理ID
- `customerId`: 客戶ID

**響應**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-123",
        "customerId": "customer-456",
        "status": "open",
        "priority": "medium",
        "assignedAgent": {
          "id": "agent-789",
          "displayName": "Agent Name"
        },
        "customer": {
          "id": "customer-456",
          "displayName": "Customer Name",
          "platform": "line"
        },
        "latestMessage": {
          "content": "Last message content",
          "createdAt": "2024-01-01T12:00:00Z"
        },
        "messageCount": 15,
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### POST /api/conversations/:id/assign
分配對話給代理或團隊

**請求體**:
```json
{
  "userId": "agent-123",  // 或者 teamId
  "teamId": 456,         // 可選，與userId二選一
  "reason": "Escalation needed"
}
```

**響應**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv-123",
    "assignedTo": {
      "type": "user|team",
      "id": "agent-123",
      "name": "Agent Name"
    },
    "transfer": {
      "conversationId": "conv-123",
      "transferredTo": "agent-123",
      "reason": "Escalation needed",
      "createdAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

#### GET /api/conversations/:id/messages
獲取對話消息

**查詢參數**:
- `limit`: 消息數量 (默認: 50, 最大: 100)
- `offset`: 偏移量 (默認: 0)

**響應**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg-123",
        "conversationId": "conv-456",
        "content": "Message content",
        "senderType": "customer|agent|system",
        "senderId": "customer-789",
        "messageType": "text|image|file",
        "createdAt": "2024-01-01T12:00:00Z",
        "metadata": {}
      }
    ]
  }
}
```

---

## 👥 Customer Module

**基礎路徑**: `/api/customers`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/` | 列出客戶 | ✅ |
| POST | `/` | 創建新客戶 | ✅ |
| GET | `/:id` | 獲取客戶詳情 | ✅ |
| PUT | `/:id` | 更新客戶信息 | ✅ |
| DELETE | `/:id` | 刪除客戶 | ✅ |
| GET | `/:id/conversations` | 獲取客戶對話 | ✅ |
| GET | `/search` | 搜索客戶 | ✅ |

### 詳細API

#### GET /api/customers
列出客戶

**查詢參數**:
- `page`: 頁碼
- `limit`: 每頁數量
- `platform`: 平台 (`line`, `facebook`)
- `teamId`: 團隊ID

**響應**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "customer-123",
        "platform": "line",
        "platformUserId": "U123456789",
        "displayName": "Customer Name",
        "avatarUrl": "https://example.com/avatar.jpg",
        "email": "customer@example.com",
        "phone": "+886-12345678",
        "sourceTeamId": 1,
        "metadata": {},
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```

---

## 🏢 Teams Module

**基礎路徑**: `/api/teams`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/` | 列出團隊 | ✅ |
| POST | `/` | 創建新團隊 | ✅ (Admin) |
| GET | `/:id` | 獲取團隊詳情 | ✅ |
| PUT | `/:id` | 更新團隊信息 | ✅ (Team/Admin) |
| DELETE | `/:id` | 刪除團隊 | ✅ (Admin) |
| GET | `/:id/members` | 獲取團隊成員 | ✅ |
| POST | `/:id/members` | 添加團隊成員 | ✅ (Team/Admin) |

---

## 💌 Messaging Module

**基礎路徑**: `/api/messaging`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| POST | `/send` | 發送消息 | ✅ |
| POST | `/delayed` | 發送延時消息 | ✅ |
| PUT | `/:id/recall` | 撤回消息 | ✅ |
| GET | `/delayed` | 列出延時消息 | ✅ |
| DELETE | `/delayed/:id` | 取消延時消息 | ✅ |

---

## 🔧 Session Module

**基礎路徑**: `/api/sessions`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/` | 列出會話 | ✅ |
| POST | `/` | 創建新會話 | ✅ |
| GET | `/:id` | 獲取會話詳情 | ✅ |
| PUT | `/:id` | 更新會話 | ✅ |
| DELETE | `/:id` | 刪除會話 | ✅ |
| POST | `/:id/messages` | 添加會話消息 | ✅ |
| GET | `/stats` | 獲取會話統計 | ✅ |

---

## 📱 QRCode Module

**基礎路徑**: `/api/qrcode`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| POST | `/generate` | 生成QR碼 | ✅ |
| GET | `/:id` | 獲取QR碼信息 | ✅ |
| GET | `/:id/image` | 獲取QR碼圖片 | ❌ |
| PUT | `/:id` | 更新QR碼 | ✅ |
| DELETE | `/:id` | 刪除QR碼 | ✅ |
| GET | `/` | 列出QR碼 | ✅ |

---

## 🔗 Integration Module

**基礎路徑**: `/api/integrations`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/platforms` | 獲取支持的平台 | ✅ |
| POST | `/:platform/webhook` | 平台webhook端點 | ❌ |
| POST | `/:platform/test` | 測試平台連接 | ✅ (Admin) |
| GET | `/:platform/status` | 獲取平台狀態 | ✅ |
| PUT | `/:platform/config` | 更新平台配置 | ✅ (Admin) |

---

## 📊 Reports Module

**基礎路徑**: `/api/reports`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/dashboard` | 儀表板報告 | ✅ |
| GET | `/conversations` | 對話報告 | ✅ |
| GET | `/agents` | 代理績效報告 | ✅ |
| GET | `/teams` | 團隊績效報告 | ✅ |
| GET | `/export/:type` | 導出報告 | ✅ |

---

## ⚙️ System Module

**基礎路徑**: `/api/system`

### 端點概覽

| HTTP方法 | 端點 | 描述 | 認證 |
|---------|------|------|------|
| GET | `/health` | 系統健康檢查 | ❌ |
| GET | `/status` | 系統狀態 | ✅ |
| GET | `/info` | 系統信息 | ✅ |
| GET | `/metrics` | 系統指標 | ✅ (Team/Admin) |
| GET | `/settings` | 獲取系統設置 | ✅ (Admin) |
| PUT | `/settings` | 更新系統設置 | ✅ (Admin) |
| POST | `/backup` | 創建系統備份 | ✅ (Admin) |
| GET | `/logs` | 獲取系統日誌 | ✅ (Admin) |

### 詳細API

#### GET /api/system/health
系統健康檢查

**響應**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0.0",
    "uptime": "24:30:15",
    "services": {
      "database": "healthy",
      "cache": "healthy",
      "queue": "healthy",
      "storage": "healthy"
    }
  }
}
```

#### GET /api/system/metrics
系統指標

**響應**:
```json
{
  "success": true,
  "data": {
    "requests": {
      "total": 10000,
      "successful": 9950,
      "failed": 50,
      "averageResponseTime": 120
    },
    "conversations": {
      "total": 500,
      "active": 45,
      "closed": 455
    },
    "messages": {
      "total": 15000,
      "today": 250
    },
    "agents": {
      "total": 25,
      "online": 12,
      "busy": 8,
      "idle": 5
    }
  }
}
```

---

## 認證與授權 (Authentication & Authorization)

### JWT令牌
所有需要認證的API都使用JWT Bearer令牌：

```
Authorization: Bearer <your-jwt-token>
```

### 角色權限

| 角色 | 描述 | 權限範圍 |
|------|------|----------|
| `admin` | 系統管理員 | 所有API端點的完全訪問權限 |
| `team` | 團隊領導 | 團隊相關功能和報告的訪問權限 |
| `agent` | 客服代理 | 基本的對話和客戶管理權限 |

### 權限檢查
每個端點都會檢查用戶角色和權限：

```json
// 403 Forbidden 響應
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions to access this resource",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## 錯誤代碼參考 (Error Codes Reference)

| 錯誤代碼 | HTTP狀態 | 描述 |
|---------|---------|------|
| `VALIDATION_ERROR` | 400 | 請求參數驗證失敗 |
| `AUTHENTICATION_ERROR` | 401 | 認證失敗或令牌無效 |
| `AUTHORIZATION_ERROR` | 403 | 權限不足 |
| `NOT_FOUND_ERROR` | 404 | 資源不存在 |
| `BUSINESS_LOGIC_ERROR` | 422 | 業務邏輯錯誤 |
| `RATE_LIMIT_ERROR` | 429 | 請求頻率超出限制 |
| `SYSTEM_ERROR` | 500 | 系統內部錯誤 |
| `DATABASE_ERROR` | 500 | 資料庫操作失敗 |
| `EXTERNAL_SERVICE_ERROR` | 502 | 外部服務錯誤 |

---

## 分頁與過濾 (Pagination & Filtering)

### 標準分頁參數
所有列表API都支持標準分頁：

- `page`: 頁碼（從1開始）
- `limit`: 每頁項目數（默認20，最大100）

### 標準分頁響應
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 通用過濾參數
- `startDate` / `endDate`: 日期範圍過濾
- `status`: 狀態過濾
- `teamId`: 團隊過濾
- `search`: 關鍵詞搜索

---

## 實時通信 (Real-time Communication)

### Server-Sent Events (SSE)
某些模組支持SSE實時更新：

```javascript
// 監聽對話更新
const eventSource = new EventSource('/api/conversations/stream');
eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Conversation update:', data);
};
```

### 支持SSE的端點
- `/api/conversations/stream` - 對話更新
- `/api/conversations/:id/messages/stream` - 消息流
- `/api/system/monitoring/stream` - 系統監控

---

## 開發指南 (Development Guidelines)

### API版本控制
目前使用路徑版本控制，所有API都在 `/api/` 路徑下。

### 內容類型
- 請求：`Content-Type: application/json`
- 響應：`Content-Type: application/json`

### 字符編碼
所有API使用UTF-8編碼。

### 時間格式
所有時間戳使用ISO 8601格式：`2024-01-01T12:00:00Z`

---

## 測試與範例 (Testing & Examples)

### cURL範例

#### 登入
```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

#### 獲取對話列表
```bash
curl -X GET http://localhost:8787/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -G -d "page=1" -d "limit=20" -d "status=open"
```

#### 發送消息
```bash
curl -X POST http://localhost:8787/api/conversations/conv-123/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello","senderType":"agent","senderId":"agent-456"}'
```

### Postman Collection
提供完整的Postman collection供測試使用：`docs/api/Modular_API.postman_collection.json`

---

## 更新日誌 (Changelog)

### v2.0.0 - 模組化重構
- ✅ 完全模組化的API架構
- ✅ 統一的錯誤處理機制
- ✅ 標準化的響應格式
- ✅ 完整的角色權限系統
- ✅ 模組級別的單元測試
- ✅ SSE實時通信支持

### v1.0.0 - 初始版本
- 基礎API功能
- LINE整合
- 基本認證系統

---

## 支持 (Support)

如有API相關問題，請：

1. 查看相關模組的測試檔案：`tests/modules/*/`
2. 檢查系統健康狀態：`GET /api/system/health`
3. 查看錯誤日誌：`GET /api/system/logs`

**文檔版本**: 2.0.0
**最後更新**: 2024-01-01
**維護團隊**: Multi-Channel Integration System Team