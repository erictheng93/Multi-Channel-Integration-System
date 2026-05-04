# 環境配置系統

本文件採用 **3 層架構模式 (3-Layer Architecture Pattern)** 進行環境配置管理，實現生產/開發環境的無縫切換，並消除硬編碼 (Hardcoding) URL。

## 架構模式：3 層配置

```
╔═══════════════════════════════════════════════════════════════╗
║ 第 3 層：業務邏輯代碼 (Business Logic Code) ║
║ → 組件 (Components)、服務 (Services)、處理器 (Handlers) ║
║ → 使用：getBackendUrl(), getWebSocketUrl() 等 ║
╚═══════════════════════════════════════════════════════════════╝
                        │
                        │ (導入配置函數)
                        ▼
╔═══════════════════════════════════════════════════════════════╗
║ 第 2 層：運行時配置層 (Runtime Configuration Layer) ║
║ → frontend/src/config/runtime.ts (428 行) ║
║ → src/config/runtime.ts (300+ 行) ║
║ → 函數：getBackendUrl(), getWebSocketUrl() ║
║ getFrontendUrl(), getStoragePublicUrl() ║
║ validateRuntimeConfig() 等 ║
╚═══════════════════════════════════════════════════════════════╝
                        │
                        │ (讀取環境變數)
                        ▼
╔═══════════════════════════════════════════════════════════════╗
║ 第 1 層：環境變數 (Environment Variables) ║
║ → .env.development / .env.production (前端) ║
║ → .dev.vars (後端開發) ║
║ → wrangler.toml [vars] (後端生產) ║
║ → Cloudflare Dashboard secrets (生產環境機密) ║
╚═══════════════════════════════════════════════════════════════╝
```

## 關鍵配置函數

### 前端運行時配置 (`frontend/src/config/runtime.ts`)

```typescript
import { getBackendUrl, getWebSocketUrl, getApiEndpoint } from '@/config/runtime';

// 獲取後端 API 基礎 URL
const apiUrl = getBackendUrl();
// 返回：'https://your-api-domain.example.com' (生產環境)
// 或 'http://localhost:8787' (開發環境)

// 獲取 WebSocket URL (自動轉換協議)
const wsUrl = getWebSocketUrl();
// 自動轉換：https: → wss:, http: → ws:
// 返回：'wss://your-api-domain.example.com/ws' (生產環境)
// 或 'ws://localhost:8787/ws' (開發環境)

// 獲取完整 API 端點
const endpoint = getApiEndpoint('/api/messages');
// 返回：'https://your-api-domain.example.com/api/messages'

// 獲取存儲公共 URL
import { getStoragePublicUrl } from '@/config/runtime';
const storageUrl = getStoragePublicUrl();
// 返回：'https://your-storage-domain.example.com'

// 驗證運行時配置
import { validateRuntimeConfig } from '@/config/runtime';
validateRuntimeConfig(); // 如果配置無效則拋出錯誤

// 檢查環境
import { isDevelopment, isProduction } from '@/config/runtime';
if (isDevelopment()) {
  console.log('運行在開發模式');
}
```

### 後端運行時配置 (`src/config/runtime.ts`)

```typescript
import { getBackendUrl, getFrontendUrl } from './config/runtime';
import type { WorkerEnv } from './types';

// 在 Hono 處理器中
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    // 從 Worker 環境中獲取配置
    const backendUrl = getBackendUrl(env);
    const frontendUrl = getFrontendUrl(env);

    // 用於 CORS 配置
    const allowedOrigins = [backendUrl, frontendUrl];

    return new Response('OK');
  }
}

// 在 Hono Context 中
import { getConfigFromContext } from './config/runtime';

app.get('/api/example', async (c) => {
  const config = getConfigFromContext(c);
  // config 包含：backendUrl, frontendUrl, jwtSecret, environment 等

  return c.json({ backendUrl: config.backendUrl });
});
```

## 環境變數參考

### 前端環境變數 (`.env.development` / `.env.production`)

**核心 URL：**
- `VITE_BACKEND_URL` - 後端 API 基礎 URL (必填)
- `VITE_FRONTEND_URL` - 前端應用程式 URL (必填)
- `VITE_FRONTEND_PAGES_URL` - Cloudflare Pages URL (選填)
- `VITE_WEBSOCKET_URL` - WebSocket 伺服器 URL (選填，若未設置將自動推導)
- `VITE_STORAGE_PUBLIC_URL` - R2 存儲公共 URL (必填)

**環境配置：**
- `VITE_ENV` - 環境標識符：`development` | `staging` | `production`
- `VITE_DEBUG` - 啟用調試日誌：`true` | `false`
- `VITE_WEBSOCKET_ENABLED` - 啟用 WebSocket：`true` | `false`
- `VITE_WEBSOCKET_AUTO_RECONNECT` - WebSocket 自動重連：`true` | `false`

**功能標誌 (Feature Flags)：**
- `VITE_ENABLE_PERFORMANCE_MONITORING` - 啟用性能監控
- `VITE_ENABLE_ERROR_REPORTING` - 啟用錯誤報告
- `VITE_ENABLE_ANALYTICS` - 啟用分析

**WebSocket 配置：**
- `VITE_WEBSOCKET_RECONNECT_INTERVAL` - 重連間隔 (毫秒) (預設：3000)
- `VITE_WEBSOCKET_MAX_RECONNECT_ATTEMPTS` - 最大重連嘗試次數 (預設：5)
- `VITE_WEBSOCKET_HEARTBEAT_INTERVAL` - 心跳間隔 (毫秒) (預設：30000)

**API 配置：**
- `VITE_API_TIMEOUT` - API 請求超時 (毫秒) (預設：30000)
- `VITE_API_RETRY_ATTEMPTS` - 重試次數 (預設：3)
- `VITE_API_RETRY_DELAY` - 重試延遲 (毫秒) (預設：1000)

完整列表及詳細說明請參閱 `frontend/.env.example`。

### 後端環境變數 (`.dev.vars` / `wrangler.toml`)

**核心配置：**
- `BACKEND_URL` - 後端 API 基礎 URL
- `FRONTEND_URL` - 前端應用程式 URL
- `FRONTEND_PAGES_URL` - Cloudflare Pages URL (選填)
- `JWT_SECRET` - JWT 簽名密鑰 (必填，最少 32 個字符)
- `ENCRYPTION_KEY` - 數據加密密鑰 (必填，32 個字符)
- `ENVIRONMENT` - 環境：`development` | `production`

**外部 API 憑證：**
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Messaging API token
- `LINE_CHANNEL_SECRET` - LINE channel secret
- `FACEBOOK_APP_ID` - Facebook app ID
- `FACEBOOK_APP_SECRET` - Facebook app secret

**Cloudflare 綁定 (定義於 wrangler.toml)：**
- `DB` - D1 資料庫綁定
- `KV_SESSION` - 用於會話 (Session) 的 KV 命名空間
- `KV_CACHE` - 用於緩存的 KV 命名空間
- `R2_STORAGE` - 用於文件存儲的 R2 存儲桶
- `DELAYED_MESSAGE_QUEUE` - 延遲訊息隊列
- `CONVERSATION_ROOM` - 用於對話的 Durable Objects
- `USER_CONNECTION` - 用於用戶連接的 Durable Objects
- `MESSAGE_BROADCASTER` - 用於訊息廣播的 Durable Objects

## 環境切換指南

**切換至開發環境 (Development Environment)：**

1. **前端：**
   ```bash
   cd frontend
   cp .env.development .env
   # 如果需要，編輯 .env 以自定義本地 URL
   bun run dev
   ```

2. **後端：**
   ```bash
   # 確保已配置 .dev.vars
   bun run dev  # 連接到遠程資源 (REMOTE resources)
   ```

**切換至生產環境 (Production Environment)：**

1. **前端：**
   ```bash
   cd frontend
   cp .env.production .env
   bun run build
   bun run deploy:pages
   ```

2. **後端：**
   ```bash
   bun run deploy  # 使用 wrangler.toml [vars] 部分
   ```

## 遷移效益

**遷移前 (硬編碼 URL)：**
-  69+ 個文件含有硬編碼 URL
-  切換環境需 4-6 小時
-  手動查找替換容易出錯
-  配置缺乏類型安全
-  難以維持一致性

**遷移後 (3 層架構)：**
-  0 個硬編碼 URL (除了 runtime.ts 中的預設值)
-  切換環境僅需 5-10 分鐘
-  僅需更改單個 `.env` 文件
-  完整的 TypeScript 類型安全
-  自動驗證和錯誤處理
-  切換時間減少 96%
-  732% 投資回報率 (ROI)

## 配置最佳實踐

1. **始終使用配置函數：**
   ```typescript
   // GOOD
   import { getBackendUrl } from '@/config/runtime';
   const url = getBackendUrl();

   // BAD - 絕不要硬編碼 URL
   const url = 'https://your-api-domain.example.com';
   ```

2. **啟動時驗證配置：**
   ```typescript
   // 在 main.ts 或 index.ts 中
   import { validateRuntimeConfig } from './config/runtime';
   validateRuntimeConfig(); // 如果配置無效則拋出錯誤
   ```

3. **使用環境檢測：**
   ```typescript
   import { isDevelopment, isProduction } from '@/config/runtime';

   if (isDevelopment()) {
     console.log('Debug info'); // 僅在開發環境中顯示
   }
   ```

4. **TypeScript 支持：**
   ```typescript
   // frontend/src/vite-env.d.ts 提供完整的自動補全
   const url = import.meta.env.VITE_BACKEND_URL; //  類型安全
   ```

5. **絕不提交敏感數據：**
   - `.env.development` 和 `.env.production` 已被 gitignored
   - 使用 `.env.example` 作為模板
   - 將生產環境機密存儲在 Cloudflare Dashboard 中

## 配置問題故障排除

**問題：出現 "VITE_BACKEND_URL is not set" 錯誤**
- 解決方案：確保 `frontend/` 目錄下存在 `.env` 文件
- 從 `.env.development` 或 `.env.production` 複製

**問題：WebSocket 連接失敗**
- 檢查 `VITE_WEBSOCKET_URL` 是否與後端部署匹配
- 驗證協議：HTTPS 對應 `wss://`，HTTP 對應 `ws://`
- 使用 `getWebSocketUrl()` 進行自動協議轉換

**問題：開發環境中的 CORS 錯誤**
- 確保 `VITE_FRONTEND_URL` 與實際的開發伺服器 URL 匹配
- 檢查後端 `FRONTEND_URL` 包含正確的端口 (通常是 3000)

**問題：更改後配置未更新**
- 重啟 Vite 開發伺服器 (`bun run dev`)
- 清除瀏覽器緩存並重新加載
- 驗證 `.env` 文件是否在正確的目錄中

完整的遷移文檔請參閱 `docs/history/reports/HARDCODE_REMOVAL_COMPLETION_REPORT.md`。

## 相關文件

**配置文件：**
- `frontend/.env.development` - 前端開發環境變數 (16 個變數)
- `frontend/.env.production` - 前端生產環境變數
- `frontend/.env.example` - 包含文檔的完整環境變數模板 (80+ 行)
- `.dev.vars` - 後端開發環境變數 (Cloudflare Workers)
- `frontend/src/config/runtime.ts` - **前端運行時配置層** (428 行) - 第 2 層抽象
- `src/config/runtime.ts` - **後端運行時配置層** (300+ 行) - Worker 環境抽象
- `frontend/src/vite-env.d.ts` - 所有環境變數的 TypeScript 類型定義 (150+ 行)
