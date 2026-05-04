# Multi-Channel Integration System — API Reference

**Version**: 4.0.0  
**Last Updated**: 2026-05-04  
**Production Base URL**: `https://your-api-domain.example.com`

> 本文件為「導覽級」API 參考。各模組詳細端點清單、行為說明、邊界案例請見 **[`docs/modules/INDEX.md`](../../modules/INDEX.md)** 內對應的模組手冊。

---

## 1. 認證

所有受保護端點需要在 `Authorization` 標頭帶 JWT：

```http
Authorization: Bearer <jwt-access-token>
```

### 1.1 取得 Token

**端點**：`POST /api/auth/login`

```json
// Request
{
  "email": "user@example.com",
  "password": "your_password"
}

// Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1...",        // access token (2h)
    "refreshToken": "...",                  // refresh token (7d)
    "agent": {
      "id": 123,
      "email": "user@example.com",
      "displayName": "User Name",
      "role": "agent",                      // 'admin' | 'agent'
      "primaryTeamId": 1,
      "allowedTeamIds": [1, 3],
      "teamRoles": { "1": "lead", "3": "member" }
    }
  },
  "message": "Login successful"
}
```

### 1.2 刷新 Token

**端點**：`POST /api/auth/refresh`

Access token 過期前用 refresh token 換新；refresh 端點會**重新查 DB**，可感應團隊歸屬異動。

### 1.3 角色與權限模型

雙層角色：
- **系統角色** (`role`)：`admin` / `agent`（v4 簡化，移除 v3 的 `team` 系統角色）
- **團隊角色** (`teamRoles[teamId]`)：`member` / `lead` / `supervisor`，每團隊獨立

詳見：[`RBAC_DESIGN.md`](../specifications/RBAC_DESIGN.md)、[`auth 模組手冊`](../../modules/auth.md)

---

## 2. 標準回應格式

### 2.1 一般回應

```typescript
{
  success: boolean
  data: T | null
  message: string
  timestamp: string  // ISO 8601
  requestId: string  // 唯一請求 ID
}
```

### 2.2 分頁回應

```typescript
{
  success: true
  data: {
    items: T[]
    pagination: {
      page: number
      pageSize: number     // max 100
      total: number
      totalPages: number
    }
  }
}
```

### 2.3 錯誤回應

```typescript
{
  success: false
  error: {
    code: string           // 例如 'VALIDATION_ERROR'
    message: string
    details?: unknown      // 選用，欄位級錯誤等
  }
  timestamp: string
  requestId: string
}
```

常見 HTTP 狀態：`400` 驗證錯 / `401` 未認證 / `403` 權限不足 / `404` 找不到 / `409` 衝突 / `429` 速率限制 / `5xx` 伺服器錯誤。

---

## 3. 模組 API 索引

24 個模組各有獨立手冊（含 API 端點、UI 入口、邊界案例）。下表給高階分類：

### 對話與訊息
| 模組 | 主要端點前綴 | 文件 |
|------|------------|------|
| Conversations | `/api/conversations` | [conversations.md](../../modules/conversations.md) |
| Messaging | `/api/messages` | [messaging.md](../../modules/messaging.md) |
| Delayed Messages | `/api/delayed-messages` | [delayed-message.md](../../modules/delayed-message.md) |
| Customer Conversations | `/api/customer-ws` | [customer-conversations.md](../../modules/customer-conversations.md) |
| Sessions | `/api/sessions` | [session.md](../../modules/session.md) |

### 客戶與標籤
| 模組 | 主要端點前綴 | 文件 |
|------|------------|------|
| Customers | `/api/customers` | [customer.md](../../modules/customer.md) |
| Tags | `/api/tags` | [tags.md](../../modules/tags.md) |
| Auto-Reply | `/api/auto-reply` | [auto-reply.md](../../modules/auto-reply.md) |

### 認證與團隊
| 模組 | 主要端點前綴 | 文件 |
|------|------------|------|
| Auth | `/api/auth` | [auth.md](../../modules/auth.md) |
| Teams | `/api/teams` | [teams.md](../../modules/teams.md) |
| Agents | `/api/agents` | [agents.md](../../modules/agents.md) |
| Activities | `/api/activities` | [activities.md](../../modules/activities.md) |

### 渠道整合
| 模組 | 主要端點前綴 | 文件 |
|------|------------|------|
| Integrations | `/api/channels` | [integrations.md](../../modules/integrations.md) |
| LIFF | `/api/liff` | [liff.md](../../modules/liff.md) |

### 即時通訊
| 模組 | 主要端點前綴 | 文件 |
|------|------------|------|
| WebSocket | `/api/websocket` | [websocket.md](../../modules/websocket.md) |
| Realtime | `/api/realtime` | [realtime.md](../../modules/realtime.md) |
| Collaboration | `/api/collaboration` | [collaboration.md](../../modules/collaboration.md) |
| Notifications | `/api/notifications` | [notifications.md](../../modules/notifications.md) |

### 系統與營運
| 模組 | 主要端點前綴 | 文件 |
|------|------------|------|
| System | `/api/system`, `/api/health`, `/api/stats` | [system.md](../../modules/system.md) |
| Monitoring | `/api/monitoring` | [monitoring.md](../../modules/monitoring.md) |
| Analytics | `/api/analytics` | [analytics.md](../../modules/analytics.md) |
| Reports | `/api/reports` | [reports.md](../../modules/reports.md) |
| File Management | `/api/files` | [file-management.md](../../modules/file-management.md) |
| Queue | `/api/queue` | [queue.md](../../modules/queue.md) |

### 模組級 API 規格（如有獨立規格書）
- [`modules/WEBSOCKET_API.md`](./modules/WEBSOCKET_API.md)
- [`modules/COLLABORATION_API.md`](./modules/COLLABORATION_API.md)
- [`modules/ANALYTICS_API.md`](./modules/ANALYTICS_API.md)
- [`MESSAGING_API_REFERENCE.md`](./MESSAGING_API_REFERENCE.md)
- [`TAG_API_REFERENCE.md`](./TAG_API_REFERENCE.md)

---

## 4. WebSocket 連線

v4 即時通訊由 WebSocket + Durable Objects 提供（v3 的 SSE 已完全移除）。

**端點**：`GET /api/websocket/connect?conversationId=<id>`（HTTP Upgrade）

詳見 [`websocket 模組手冊`](../../modules/websocket.md) 與 [`WEBSOCKET_API.md`](./modules/WEBSOCKET_API.md)。

---

## 5. 速率限制

由 `RateLimiterDO` 全域控制：
- 每用戶連線上限：10
- 全域連線上限：10,000
- 細部端點限制依模組而定（見各模組手冊）

超限回 `429 Too Many Requests`。

---

## 6. CORS

由 `src/config/cors.ts` 統一管理。允許：
- 認證 header（Authorization, Session-ID）
- 標準 HTTP methods
- 預檢請求快取

詳見 [`docs/guides/CORS_CONFIGURATION_GUIDE.md`](../../guides/CORS_CONFIGURATION_GUIDE.md)。

---

## 7. 版本管理

| 變更類型 | 處理 |
|---------|------|
| Breaking change | 主版號 +1（v4 → v5），CHANGELOG 標 BREAKING |
| 新增端點 | 次版號 +1 |
| 修補 | 修訂號 +1 |

> v3 → v4 重大變更（移除 SSE、簡化角色、團隊指派專屬）的完整對照見 [`docs/CURRENT_STATUS.md`](../../CURRENT_STATUS.md) §8。

---

## 8. 與 v3 (v2.0.0 規格) 差異速查

| 面向 | v3 (v2.0.0 docs) | v4 (本文件) |
|------|------------------|-------------|
| 即時通訊 | WebSocket + SSE 雙通道 | **僅 WebSocket** |
| JWT Payload | 單團隊 | 多團隊（`primaryTeamId` + `allowedTeamIds[]` + `teamRoles{}`） |
| 對話指派 | 個人或團隊 | **僅團隊** |
| 系統角色 | admin / team / agent | **admin / agent** |
| Durable Objects | 7 個 | **10 個**（新增 RateLimiterDO + MetricsCollectorDO） |

---

## 9. 相關文件

- [`docs/PROJECT_OVERVIEW.md`](../../PROJECT_OVERVIEW.md) — 系統對外完整描述
- [`docs/CURRENT_STATUS.md`](../../CURRENT_STATUS.md) — v4 系統現況快照
- [`docs/modules/INDEX.md`](../../modules/INDEX.md) — 24 模組使用者手冊
- [`docs/architecture/`](../../architecture/) — 系統設計與架構決策
- [`docs/guides/`](../../guides/) — 部署、CORS、KV、效能優化指南
