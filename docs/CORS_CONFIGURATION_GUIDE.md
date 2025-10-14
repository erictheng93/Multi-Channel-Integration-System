# CORS 配置指南

## 📚 目錄
- [概述](#概述)
- [統一 CORS 架構](#統一-cors-架構)
- [配置文件說明](#配置文件說明)
- [監控系統](#監控系統)
- [添加新域名](#添加新域名)
- [SSE 特殊處理](#sse-特殊處理)
- [故障排除](#故障排除)
- [最佳實踐](#最佳實踐)

---

## 概述

本系統使用**統一的 CORS 配置架構**，所有 CORS 相關設置集中在 `src/config/cors.ts` 文件中管理。這種架構確保：

✅ **單一來源的真理** - 所有 CORS 配置只需在一個地方維護
✅ **一致性** - 所有端點使用相同的 origin 驗證邏輯
✅ **安全性** - 完整的 credentials 支援和 origin 驗證
✅ **可監控性** - 內建 CORS 錯誤追蹤和統計
✅ **可擴展性** - 輕鬆添加新的允許域名

---

## 統一 CORS 架構

### 架構圖

```
┌─────────────────────────────────────────┐
│  @/config/cors.ts                       │
│  ✅ 單一來源的 CORS 配置                 │
│  - isOriginAllowed()                    │
│  - getSSECorsHeaders()                  │
│  - applySSECorsHeaders()                │
│  - ALLOWED_ORIGINS 常量                 │
└─────────────┬───────────────────────────┘
              │
              │ 被全局使用
              ▼
┌─────────────────────────────────────────┐
│  src/index.ts (Line 106)                │
│  ✅ 全局 CORS middleware                 │
│  - 自動 origin 驗證                      │
│  - Credentials 支援                      │
│  - OPTIONS preflight (Line 139)         │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴──────────┬─────────────────┐
    │                    │                 │
┌───▼─────────────┐ ┌───▼──────────┐ ┌───▼─────────────┐
│ conversations   │ │ analytics    │ │ notifications   │
│ handlers        │ │ dashboard    │ │ handlers        │
└─────────────────┘ └──────────────┘ └─────────────────┘
```

### 工作流程

1. **請求到達** → Global CORS middleware 檢查 Origin header
2. **驗證 origin** → 使用 `isOriginAllowed()` 驗證是否在白名單中
3. **處理 preflight** → OPTIONS 請求返回 204 + CORS headers
4. **處理實際請求** → 添加 CORS headers 到響應
5. **記錄事件** → CORS 監控系統記錄允許/拒絕事件

---

## 配置文件說明

### `src/config/cors.ts`

這是 CORS 配置的**核心文件**，所有 CORS 相關邏輯都在這裡。

#### 允許的 Origins

```typescript
export const ALLOWED_ORIGINS = [
  // 生產環境
  'https://multi-channel.imfinethankyouandyou.com',        // Backend API
  'https://multi-channel-platform-frontend.pages.dev',     // Frontend Cloudflare Pages
  'https://mcp.imfinethankyouandyou.com',                  // MCP Frontend Domain

  // 開發環境
  'http://localhost:3000',                                  // Vite dev server
  'https://localhost:3000',                                 // Vite dev server (SSL)
  'http://127.0.0.1:3000',                                  // Local IP
  'http://localhost:8787',                                  // Wrangler dev server
] as const;
```

#### Origin 驗證函數

```typescript
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  // 檢查是否在白名單中
  if (ALLOWED_ORIGINS.includes(origin as any)) {
    return true;
  }

  // 檢查是否為 Cloudflare Pages preview 域名
  // 例如：abc123.multi-channel-platform-frontend.pages.dev
  if (origin.endsWith('.multi-channel-platform-frontend.pages.dev')) {
    return true;
  }

  return false;
}
```

#### SSE 專用 CORS 函數

```typescript
export function getSSECorsHeaders(
  origin: string | undefined,
  additionalHeaders?: string[]
): Record<string, string> {
  // SSE 特殊處理邏輯
  // 允許的 origin 返回具體 origin + credentials
  // 未知 origin 返回 '*' (僅允許連接，無 credentials)
}
```

---

## 監控系統

### 監控端點

| 端點 | 權限 | 說明 |
|------|------|------|
| `GET /api/monitoring/cors/stats` | Admin | 獲取 CORS 統計數據 |
| `GET /api/monitoring/cors/events` | Admin | 獲取最近的 CORS 事件 |
| `GET /api/monitoring/cors/rejected-origins` | Admin | 獲取被拒絕的 origin 列表 |
| `POST /api/monitoring/cors/cleanup` | Admin | 清理過期事件 |
| `GET /api/monitoring/cors/health` | Public | 監控系統健康檢查 |
| `GET /api/monitoring/cors/config` | Public | 查看當前 CORS 配置 |

### 監控數據示例

```json
{
  "success": true,
  "data": {
    "total": 15234,
    "allowed": 14892,
    "rejected": 342,
    "preflightRequests": 3241,
    "sseConnections": 456,
    "credentialsUsed": 14123,
    "topOrigins": [
      { "origin": "https://multi-channel.imfinethankyouandyou.com", "count": 8234 },
      { "origin": "http://localhost:3000", "count": 5432 }
    ],
    "topRejectedOrigins": [
      { "origin": "https://suspicious-site.com", "count": 234 },
      { "origin": "http://unknown-origin.example", "count": 108 }
    ]
  }
}
```

### 監控事件類型

- `allowed` - 允許的請求
- `rejected` - 被拒絕的請求
- `preflight` - OPTIONS 預檢請求
- `sse_connection` - SSE 連接
- `credentials_used` - 使用了 credentials 的請求

---

## 添加新域名

### 步驟 1：更新配置文件

編輯 `src/config/cors.ts`，添加新域名到 `ALLOWED_ORIGINS` 數組：

```typescript
export const ALLOWED_ORIGINS = [
  // ... 現有域名 ...
  'https://new-domain.example.com',  // 新增域名
] as const;
```

### 步驟 2：驗證配置

運行 TypeScript 類型檢查：

```bash
npm run lint:check
```

### 步驟 3：測試新域名

使用 E2E 測試驗證：

```bash
# 測試新域名是否可以訪問
curl -H "Origin: https://new-domain.example.com" \
     https://your-api.com/api/system/health

# 檢查響應 headers 中是否包含：
# Access-Control-Allow-Origin: https://new-domain.example.com
# Access-Control-Allow-Credentials: true
```

### 步驟 4：部署

```bash
npm run deploy
```

### 步驟 5：監控

部署後，使用監控端點檢查新域名的訪問情況：

```bash
# 查看 CORS 統計
GET /api/monitoring/cors/stats

# 查看最近事件（確認新域名被允許）
GET /api/monitoring/cors/events?limit=20
```

---

## SSE 特殊處理

### 為什麼 SSE 需要特殊處理？

Server-Sent Events (SSE) 使用 `EventSource` API，有以下限制：

1. ❌ **無法發送自定義 headers** - 只能通過 URL 參數傳遞 token
2. ❌ **無法配置 credentials** - 完全由 CORS 決定
3. ✅ **需要持久連接** - 連接可能持續數分鐘到數小時

### SSE CORS 策略

```typescript
// 允許的 origin - 返回具體 origin + credentials 支援
if (origin && isOriginAllowed(origin)) {
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
  console.log(`✅ [SSE CORS] Allowed origin: ${origin}`);
}
// 未知 origin - 返回 wildcard (允許連接但無 credentials)
else {
  headers['Access-Control-Allow-Origin'] = '*';
  console.warn(`⚠️ [SSE CORS] Unknown origin (wildcard fallback): ${origin}`);
}
```

### 使用 SSE CORS 函數

在 SSE 端點中使用：

```typescript
import { getSSECorsHeaders } from '@/config/cors';

app.get('/api/notifications/sse', async (c) => {
  const stream = new ReadableStream({
    // ... SSE 邏輯 ...
  });

  // 使用統一的 SSE CORS 配置
  const sseCorsHeaders = getSSECorsHeaders(c.req.header('Origin'));
  return new Response(stream, { headers: sseCorsHeaders });
});
```

---

## 故障排除

### 問題 1：CORS 錯誤 "Access-Control-Allow-Origin missing"

**症狀：**
```
Access to fetch at 'https://api.example.com' from origin 'https://frontend.example.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

**解決方案：**

1. 檢查 origin 是否在白名單中
2. 查看監控端點確認 origin 被拒絕：
   ```bash
   GET /api/monitoring/cors/rejected-origins
   ```
3. 將 origin 添加到 `src/config/cors.ts` 的 `ALLOWED_ORIGINS` 數組

### 問題 2：Credentials 不工作

**症狀：**
```
Access to fetch has been blocked by CORS policy:
The value of 'Access-Control-Allow-Origin' must not be the wildcard '*'
when the request's credentials mode is 'include'.
```

**解決方案：**

1. 確認 origin 在 `ALLOWED_ORIGINS` 白名單中
2. 檢查前端請求是否設置了 `credentials: 'include'`：
   ```javascript
   fetch('https://api.example.com/endpoint', {
     credentials: 'include',  // 必須設置
     headers: {
       'Authorization': `Bearer ${token}`
     }
   })
   ```
3. 確認全局 CORS middleware 正常工作

### 問題 3：OPTIONS preflight 失敗

**症狀：**
```
Response to preflight request doesn't pass access control check
```

**解決方案：**

1. 檢查 `src/index.ts` 中的 OPTIONS handler (Line 119-129)
2. 確認前端發送的 headers 在允許列表中
3. 使用 curl 測試 OPTIONS 請求：
   ```bash
   curl -X OPTIONS https://api.example.com/endpoint \
        -H "Origin: https://frontend.example.com" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -v
   ```

### 問題 4：Cloudflare Pages Preview 分支無法訪問

**症狀：**
Preview 部署的 URL（如 `abc123.multi-channel-platform-frontend.pages.dev`）被 CORS 拒絕

**解決方案：**

檢查 `isOriginAllowed()` 函數中的 preview 域名匹配邏輯：

```typescript
// 這段應該已經存在
if (origin.endsWith('.multi-channel-platform-frontend.pages.dev')) {
  return true;
}
```

### 問題 5：SSE 連接失敗

**症狀：**
EventSource 無法建立連接或立即斷開

**解決方案：**

1. 檢查 SSE 端點是否使用 `getSSECorsHeaders()` 函數
2. 確認 origin 驗證正常：
   ```bash
   # 測試 SSE 端點
   curl -N -H "Accept: text/event-stream" \
        -H "Origin: https://frontend.example.com" \
        https://api.example.com/api/notifications/sse
   ```
3. 查看監控日誌：
   ```bash
   GET /api/monitoring/cors/events?type=sse_connection
   ```

---

## 最佳實踐

### 1. 永遠不要使用 Wildcard '*'

❌ **錯誤做法：**
```typescript
headers['Access-Control-Allow-Origin'] = '*';
headers['Access-Control-Allow-Credentials'] = 'true';  // 這不會工作
```

✅ **正確做法：**
```typescript
import { isOriginAllowed } from '@/config/cors';

if (origin && isOriginAllowed(origin)) {
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
}
```

### 2. 使用統一的 CORS 函數

❌ **錯誤做法：** 在每個文件中重複 CORS 邏輯
```typescript
// handler-a.ts
const allowed = ['https://domain1.com', 'https://domain2.com'];
if (allowed.includes(origin)) { ... }

// handler-b.ts
const allowed = ['https://domain1.com', 'https://domain2.com'];  // 重複！
if (allowed.includes(origin)) { ... }
```

✅ **正確做法：** 使用 `@/config/cors.ts` 中的函數
```typescript
import { isOriginAllowed, getSSECorsHeaders } from '@/config/cors';

// For regular endpoints
if (isOriginAllowed(origin)) { ... }

// For SSE endpoints
const headers = getSSECorsHeaders(origin);
```

### 3. 記錄 CORS 事件

✅ **在關鍵位置記錄 CORS 決策：**
```typescript
if (isOriginAllowed(origin)) {
  console.log(`✅ [CORS] Allowed origin: ${origin}`);
} else {
  console.warn(`❌ [CORS] Rejected origin: ${origin}`);
}
```

### 4. 定期檢查監控數據

✅ **設置自動化告警：**
```typescript
// 每天檢查被拒絕的 origin
GET /api/monitoring/cors/rejected-origins

// 如果拒絕率 > 5%，發送告警
if (stats.rejected / stats.total > 0.05) {
  sendAlert('High CORS rejection rate detected');
}
```

### 5. 為 Preview 分支保持靈活性

✅ **使用 pattern matching 而不是硬編碼：**
```typescript
// 允許所有 Cloudflare Pages preview 分支
if (origin.endsWith('.multi-channel-platform-frontend.pages.dev')) {
  return true;
}
```

### 6. 測試所有環境

✅ **E2E 測試應涵蓋：**
- ✅ 生產環境域名
- ✅ 開發環境 localhost
- ✅ Preview 分支
- ✅ SSE 連接
- ✅ Credentials 支援
- ✅ OPTIONS preflight

---

## 配置文件位置

| 文件 | 用途 |
|------|------|
| `src/config/cors.ts` | 核心 CORS 配置和函數 |
| `src/index.ts` (Line 106-142) | 全局 CORS middleware |
| `src/monitoring/cors-monitor.ts` | CORS 監控系統 |
| `src/handlers/cors-monitoring.ts` | 監控 API 端點 |

---

## 相關資源

- **MDN CORS 文檔**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- **EventSource API**: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- **Cloudflare Workers CORS**: https://developers.cloudflare.com/workers/examples/cors-headers/
- **CORS Preflight 解釋**: https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request

---

## 更新日誌

### 2025-01-14 - 統一 CORS 架構實施

- ✅ 創建統一 CORS 配置系統 (`src/config/cors.ts`)
- ✅ 移除 8 個獨立 CORS 配置點
- ✅ 減少 85% 重複代碼 (121 行 → 18 行)
- ✅ 添加 CORS 監控系統
- ✅ 修復缺少的生產環境域名
- ✅ 完整 credentials 支援
- ✅ SSE 專用 CORS 處理

### 受影響的文件

**已修改：**
1. `src/config/cors.ts` - 添加 SSE CORS 函數
2. `src/utils/performance.ts` - 替換 wildcard 為 origin 驗證
3. `src/handlers/notification-optimized.ts` - 使用統一 SSE CORS
4. `src/handlers/notification.ts` - 使用統一 SSE CORS
5. `src/modules/conversations/handlers/conversation-main.ts` - 4 處 SSE CORS 修復
6. `src/modules/conversations/handlers/index.ts` - 移除重複 CORS middleware (56 行)
7. `src/modules/analytics/services/realtime-dashboard-service.ts` - 使用統一 SSE CORS
8. `src/modules/analytics/handlers/realtime-dashboard-main.ts` - 修復測試端點 CORS

**新增：**
1. `src/monitoring/cors-monitor.ts` - CORS 監控系統
2. `src/handlers/cors-monitoring.ts` - 監控 API 端點
3. `docs/CORS_CONFIGURATION_GUIDE.md` - 本文檔

---

**問題或建議？** 請聯繫開發團隊或提交 issue。
