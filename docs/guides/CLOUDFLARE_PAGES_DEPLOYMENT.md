# Cloudflare Pages 部署指南

## 概述

這個指南將幫助你將前端應用部署到 Cloudflare Pages，並確保與 Cloudflare Workers 後端的正確通信。

## 前置條件

1. Cloudflare 帳戶
2. 後端 Worker 已部署到 `multi-channel.imfinethankyouandyou.com`
3. 前端代碼已準備好部署

## 部署步驟

### 1. 準備構建

```bash
# 在 frontend 目錄中
cd frontend

# 安裝依賴
npm install

# 構建生產版本
npm run build:pages
```

### 2. Cloudflare Pages 設定

#### 方法 A：通過 Cloudflare Dashboard

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 選擇 "Pages" 
3. 點擊 "Create a project"
4. 連接你的 Git 倉庫
5. 設定構建配置：
   - **Framework preset**: Vue
   - **Build command**: `npm run build:pages`
   - **Build output directory**: `dist`
   - **Root directory**: `frontend`

#### 方法 B：使用 Wrangler CLI

```bash
# 安裝 Wrangler（如果尚未安裝）
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 部署到 Pages
wrangler pages deploy dist --project-name=multi-channel-platform-frontend
```

### 3. 環境變數設定

在 Cloudflare Pages 專案設定中添加以下環境變數：

#### Production 環境
```
VITE_API_BASE_URL=https://multi-channel.imfinethankyouandyou.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
```

#### Preview 環境
```
VITE_API_BASE_URL=https://multi-channel.imfinethankyouandyou.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
```

### 4. 自定義域名設定（可選）

如果你想使用自定義域名：

1. 在 Pages 專案設定中點擊 "Custom domains"
2. 添加你的域名
3. 按照指示更新 DNS 記錄

## 重要配置檔案

### `_redirects`
```
# SPA 路由支援
/*    /index.html   200

# API 代理到後端 Worker
/api/*  https://multi-channel.imfinethankyouandyou.com/api/:splat  200
```

### `functions/_middleware.ts`
處理 CORS 和安全標頭的中間件。

### `.pages.toml`
Cloudflare Pages 的配置檔案。

## 驗證部署

運行驗證腳本來確認部署狀態：

```bash
# 在 frontend 目錄中
powershell -ExecutionPolicy Bypass -File scripts/verify-deployment-simple.ps1 -Environment production
```

## 常見問題

### 1. API 請求失敗
- 確認後端 Worker 正在運行
- 檢查 CORS 設定
- 驗證 API 基礎 URL 配置

### 2. 路由問題
- 確認 `_redirects` 檔案已正確複製到 `dist` 目錄
- 檢查 SPA 路由配置

### 3. 環境變數問題
- 確認所有必要的環境變數都已在 Cloudflare Pages 中設定
- 檢查變數名稱是否正確（必須以 `VITE_` 開頭）

## 監控和除錯

### 查看構建日誌
在 Cloudflare Pages Dashboard 中查看構建和部署日誌。

### 查看 Functions 日誌
使用 Wrangler 查看 Pages Functions 的日誌：

```bash
wrangler pages deployment tail --project-name=multi-channel-platform-frontend
```

### 本地測試
在部署前本地測試：

```bash
# 預覽構建結果
npm run preview

# 測試 API 連接
npm run dev
```

## 自動化部署

### GitHub Actions 範例

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Build
        run: |
          cd frontend
          npm run build:pages
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: multi-channel-platform-frontend
          directory: frontend/dist
```

## 效能優化

1. **啟用壓縮**: 已在 Vite 配置中啟用 Gzip 和 Brotli 壓縮
2. **代碼分割**: 已配置 chunk splitting 以優化快取
3. **資源內聯**: 小於 4KB 的資源會被內聯
4. **Tree Shaking**: 自動移除未使用的代碼

## 安全考量

1. **CSP 標頭**: 在 `_middleware.ts` 中配置
2. **CORS 設定**: 確保正確的跨域配置
3. **環境變數**: 敏感資訊不應暴露給前端

## 支援

如果遇到問題，請檢查：
1. Cloudflare Pages 構建日誌
2. 瀏覽器開發者工具的網路標籤
3. 後端 Worker 的健康狀態