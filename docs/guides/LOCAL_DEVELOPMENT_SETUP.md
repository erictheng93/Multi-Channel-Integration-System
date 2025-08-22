# 本地開發環境設定指南

## 🎯 快速開始

### 一鍵啟動 (推薦)

```powershell
# 在專案根目錄執行
.\start-dev.ps1
```

這個腳本會自動：
- 檢查開發環境
- 安裝依賴
- 啟動後端 Worker (http://localhost:8787)
- 啟動前端開發服務器 (http://localhost:3000)
- 測試 API 連接
- 打開瀏覽器

### 手動啟動

如果你想分別控制各個服務：

```powershell
# 終端 1: 啟動後端 Worker
wrangler dev --port 8787

# 終端 2: 啟動前端開發服務器
cd frontend
npm run dev
```

## 🧪 測試 API 連接

### 使用測試腳本 (推薦)

```powershell
# 測試所有環境
.\test-api.ps1

# 只測試本地環境
.\test-api.ps1 local

# 只測試生產環境
.\test-api.ps1 production
```

### 手動測試

#### 1. 測試本地 Worker
```bash
curl http://localhost:8787/api/health
```

**預期響應**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-08T...",
  "database": "connected",
  "version": "1.0.0",
  "environment": "development"
}
```

#### 2. 測試前端代理
```bash
curl http://localhost:3000/api/health
```

**預期響應**: 與上面相同 (通過 Vite 代理)

#### 3. 測試生產環境
```bash
curl https://multi-channel-platform.imfinethankyouandyou.com/api/health
```

## 🔧 開發環境配置

### 環境變數

**後端** (根目錄 `.dev.vars`):
```env
JWT_SECRET=your_jwt_secret_key
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
```

**前端** (`frontend/.env.development`):
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_DEBUG=true
```

### Vite 代理配置

`frontend/vite.config.ts` 已配置代理：
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8787',
      changeOrigin: true,
      secure: false
    }
  }
}
```

## 🌐 訪問地址

- **前端應用**: http://localhost:3000
- **後端 API**: http://localhost:8787
- **健康檢查**: 
  - http://localhost:8787/health
  - http://localhost:8787/api/health
  - http://localhost:3000/api/health (代理)

## 🔍 開發工具

### 瀏覽器開發者工具

1. 打開 http://localhost:3000
2. 按 F12 打開開發者工具
3. 在 Network 標籤中可以看到 API 請求
4. 在 Console 標籤中可以看到代理日誌

### Wrangler 日誌

```bash
# 查看 Worker 日誌
wrangler tail

# 查看特定環境日誌
wrangler tail --env production
```

## 🚨 常見問題

### 1. 後端啟動失敗

**錯誤**: `Error: Could not resolve "..."`

**解決方案**:
```bash
# 重新安裝依賴
npm install

# 清除快取
npm run clean
```

### 2. 前端代理失敗

**錯誤**: `[vite] http proxy error: ECONNREFUSED`

**解決方案**:
- 確認後端 Worker 正在運行
- 檢查端口 8787 是否被占用
- 重啟前端開發服務器

### 3. 資料庫連接失敗

**錯誤**: `D1_ERROR: no such table`

**解決方案**:
```bash
# 執行資料庫遷移
wrangler d1 execute omni-channel-platform --local --file=database/schema.sql
```

### 4. 環境變數未載入

**解決方案**:
- 檢查 `.dev.vars` 文件是否存在
- 重啟 Worker: `wrangler dev`
- 檢查變數名稱拼寫

## 🔄 開發工作流程

### 日常開發

1. **啟動開發環境**:
   ```bash
   .\start-dev.ps1
   ```

2. **測試 API 連接**:
   ```bash
   .\test-api.ps1 local
   ```

3. **開發代碼**:
   - 前端代碼修改會自動熱重載
   - 後端代碼修改會自動重啟 Worker

4. **測試功能**:
   - 在瀏覽器中測試前端功能
   - 使用 Postman 或 curl 測試 API

### 提交前檢查

```bash
# 前端類型檢查
cd frontend
npm run type-check

# 前端 Lint 檢查 (注意：目前有一些 TypeScript 嚴格模式警告)
npm run lint:check

# 建置測試 (跳過 lint 檢查)
vite build

# 或者直接建置 (會執行 lint 檢查，可能失敗)
npm run build

# API 測試
.\test-api.ps1 local
```

**注意**: 目前 Lint 檢查會顯示一些 TypeScript 嚴格模式的警告（主要是 `any` 類型使用），這些不影響核心功能運行，但建議在後續開發中逐步改善。如果需要快速建置，可以使用 `vite build` 直接建置，跳過 prebuild 檢查。

## 📝 開發提示

### 熱重載

- **前端**: 修改 Vue 文件會立即反映在瀏覽器中
- **後端**: 修改 TypeScript 文件會自動重啟 Worker

### 調試技巧

1. **前端調試**:
   - 使用 Vue DevTools 瀏覽器擴展
   - 在代碼中添加 `console.log()`
   - 使用瀏覽器斷點調試

2. **後端調試**:
   - 在 Worker 代碼中添加 `console.log()`
   - 使用 `wrangler tail` 查看日誌
   - 檢查 Wrangler 控制台輸出

### 效能監控

- 使用 `npm run build:analyze` 分析前端包大小
- 監控 API 響應時間
- 檢查資料庫查詢效能

## 🚀 準備部署

當本地開發完成後，準備部署到生產環境：

1. **測試生產環境**:
   ```bash
   .\test-api.ps1 production
   ```

2. **建置前端**:
   ```bash
   cd frontend
   npm run build:pages
   ```

3. **部署後端**:
   ```bash
   wrangler deploy --env production
   ```

4. **部署前端**:
   ```bash
   .\deploy-frontend.ps1 production
   ```

---

## 📞 需要幫助？

如果遇到問題：

1. 檢查 [常見問題](#-常見問題) 部分
2. 運行 `.\test-api.ps1` 診斷問題
3. 查看 [API 代理設定指南](API_PROXY_SETUP.md)
4. 檢查 Wrangler 和前端控制台日誌