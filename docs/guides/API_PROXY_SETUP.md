# API 代理設定指南

## 概覽

本指南說明如何在不同環境中設定前端與後端 Worker API 的通訊。

## Worker API 域名

根據你的 `wrangler.toml` 配置，你的 Worker API 域名是：

```
https://multi-channel-platform.imfinethankyouandyou.com
```

## 環境配置

### 1. 開發環境 (Development)

#### 本地開發 (推薦)

當你同時開發前端和後端時：

```bash
# 終端 1: 啟動後端 Worker
wrangler dev

# 終端 2: 啟動前端開發服務器
cd frontend
npm run dev
```

**配置文件**: `frontend/.env.development`
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

**Vite 代理配置**: `frontend/vite.config.ts`
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8787',  // 本地 Worker
      changeOrigin: true,
      secure: false
    }
  }
}
```

#### 遠程開發

當你只開發前端，使用已部署的後端時：

**配置文件**: `frontend/.env.local` (創建此文件)
```env
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
```

**Vite 代理配置**會自動使用環境變數：
```typescript
proxy: {
  '/api': {
    target: process.env.VITE_API_BASE_URL, // 使用遠程 Worker
    changeOrigin: true,
    secure: true  // HTTPS 需要設為 true
  }
}
```

### 2. 生產環境 (Production)

#### Cloudflare Pages 配置

**環境變數** (在 Cloudflare Pages Dashboard 設定):
```env
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
```

**重定向規則**: `frontend/_redirects`
```
# SPA 路由支援
/*    /index.html   200

# API 代理到後端 Worker
/api/*  https://multi-channel-platform.imfinethankyouandyou.com/api/:splat  200
```

## API 請求流程

### 開發環境流程

```
前端請求: http://localhost:3000/api/auth/login
    ↓ (Vite 代理)
後端處理: http://localhost:8787/api/auth/login
    ↓ (Worker 響應)
前端接收: 200 OK + JSON 數據
```

### 生產環境流程

```
前端請求: https://your-pages-domain.pages.dev/api/auth/login
    ↓ (Cloudflare Pages 重定向)
後端處理: https://multi-channel-platform.imfinethankyouandyou.com/api/auth/login
    ↓ (Worker 響應)
前端接收: 200 OK + JSON 數據
```

## 配置步驟

### 步驟 1: 確認 Worker 域名

檢查你的 `wrangler.toml`:
```toml
[[routes]]
pattern = "multi-channel-platform.imfinethankyouandyou.com/*"
zone_name = "imfinethankyouandyou.com"
```

### 步驟 2: 更新前端環境變數

**開發環境** (`frontend/.env.development`):
```env
VITE_API_BASE_URL=http://localhost:8787
```

**生產環境** (`frontend/.env.production`):
```env
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
```

### 步驟 3: 更新 _redirects 文件

`frontend/_redirects`:
```
/*    /index.html   200
/api/*  https://multi-channel-platform.imfinethankyouandyou.com/api/:splat  200
```

### 步驟 4: 在 Cloudflare Pages 設定環境變數

1. 前往 Cloudflare Dashboard
2. 選擇你的 Pages 專案
3. 前往 Settings > Environment variables
4. 添加：
   ```
   VITE_API_BASE_URL = https://multi-channel-platform.imfinethankyouandyou.com
   VITE_DEV_MODE = false
   VITE_ENABLE_DEBUG_LOGS = false
   ```

## 測試 API 連接

### 本地測試

```bash
# 測試本地 Worker
curl http://localhost:8787/api/health

# 測試前端代理
curl http://localhost:3000/api/health
```

### 生產測試

```bash
# 測試 Worker 直接訪問
curl https://multi-channel-platform.imfinethankyouandyou.com/api/health

# 測試 Pages 代理
curl https://your-pages-domain.pages.dev/api/health
```

## 常見問題

### 1. CORS 錯誤

**問題**: 前端請求被 CORS 政策阻止

**解決方案**:
- 確認後端 Worker 設定了正確的 CORS 標頭
- 檢查 `frontend/functions/_middleware.ts` 是否正確配置

### 2. 代理失敗

**問題**: Vite 代理無法連接到後端

**解決方案**:
- 確認後端 Worker 正在運行 (`wrangler dev`)
- 檢查 `VITE_API_BASE_URL` 環境變數
- 查看 Vite 控制台的代理日誌

### 3. 生產環境 API 404

**問題**: 生產環境中 API 請求返回 404

**解決方案**:
- 確認 `_redirects` 文件已正確複製到 `dist/` 目錄
- 檢查 Worker 域名是否可訪問
- 驗證 Cloudflare Pages 環境變數設定

### 4. 環境變數未生效

**問題**: 環境變數在前端中未正確載入

**解決方案**:
- 確認變數名稱以 `VITE_` 開頭，使用 `VITE_API_BASE_URL` 而非 `VITE_API_URL`
- 重新建置前端專案
- 檢查 Cloudflare Pages Dashboard 中的環境變數設定
- 確保所有 API 客戶端都使用一致的環境變數名稱

## 開發工作流程

### 完整本地開發

```bash
# 1. 啟動後端
wrangler dev

# 2. 啟動前端 (新終端)
cd frontend
npm run dev

# 3. 訪問應用
# 前端: http://localhost:3000
# 後端: http://localhost:8787
```

### 前端開發 + 遠程後端

```bash
# 1. 創建本地環境變數
cp frontend/.env.local.example frontend/.env.local

# 2. 編輯 .env.local
# VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com

# 3. 啟動前端
cd frontend
npm run dev
```

### 部署到生產環境

```bash
# 1. 建置前端
cd frontend
npm run build:pages

# 2. 部署到 Pages
wrangler pages deploy dist --project-name=your-project-name

# 3. 設定環境變數 (在 Dashboard 中)
```

## 安全考量

1. **環境變數安全**: 不要在 `VITE_` 變數中存放敏感資訊
2. **HTTPS**: 生產環境必須使用 HTTPS
3. **CORS**: 適當配置 CORS 政策
4. **域名驗證**: 確保只允許信任的域名訪問 API

---

這個配置確保了前端在不同環境中都能正確與後端 Worker API 通訊。