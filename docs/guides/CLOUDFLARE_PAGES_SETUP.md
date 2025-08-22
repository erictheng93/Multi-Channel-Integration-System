# Cloudflare Pages Git 整合部署設定指南

## 為什麼選擇 Git 整合？

1. **自動化**：推送代碼 → 自動建置 → 自動部署
2. **預覽環境**：每個 PR 都有獨立的預覽 URL
3. **版本管理**：完整的部署歷史和回滾功能
4. **零維護**：設定一次，永久使用

## 設定步驟

### 1. 在 Cloudflare Dashboard 中設定

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 點擊左側 **"Pages"**
3. 點擊 **"Create a project"**
4. 選擇 **"Connect to Git"**
5. 選擇你的 Git 提供商（GitHub/GitLab）
6. 授權 Cloudflare 訪問你的倉庫
7. 選擇這個專案的倉庫

### 2. 建置設定

```yaml
# 專案名稱
Project name: multi-channel-platform-frontend

# 生產分支
Production branch: main (或 master)

# 建置設定
Build command: cd frontend && npm ci && npm run build:pages
Build output directory: frontend/dist
Root directory: / (保持空白或填入 /)

# Node.js 版本
Environment variables:
NODE_VERSION: 18
```

### 3. 環境變數設定

在 **Settings > Environment variables** 中添加：

#### Production 環境
```
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
VITE_DEV_MODE=false
VITE_ENABLE_DEBUG_LOGS=false
VITE_ENABLE_PERFORMANCE_MONITORING=true
NODE_VERSION=18
```

#### Preview 環境
```
VITE_API_BASE_URL=https://multi-channel-platform.imfinethankyouandyou.com
VITE_DEV_MODE=true
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_PERFORMANCE_MONITORING=false
NODE_VERSION=18
```

## 使用流程

### 日常開發
```bash
# 1. 開發功能
git checkout -b feature/new-feature
# 修改代碼...

# 2. 提交並推送
git add .
git commit -m "feat: 新增功能"
git push origin feature/new-feature

# 3. 創建 Pull Request
# Cloudflare 會自動為這個 PR 創建預覽環境
```

### 部署到生產環境
```bash
# 1. 合併到主分支
git checkout main
git merge feature/new-feature
git push origin main

# 2. Cloudflare 自動部署到生產環境
# 無需任何手動操作！
```

## 自動化優勢

### 🚀 預覽環境
- 每個 PR 都有獨立的預覽 URL
- 格式：`https://abc123.multi-channel-platform-frontend.pages.dev`
- 可以在合併前測試功能

### 📊 部署狀態
- 在 GitHub/GitLab 中直接看到部署狀態
- 部署失敗會有通知
- 可以直接從 commit 跳轉到部署頁面

### 🔄 自動回滾
- 在 Cloudflare Dashboard 中一鍵回滾
- 可以回滾到任何歷史版本
- 回滾速度極快（秒級）

## 故障排除

### 建置失敗
1. 檢查 **Deployments** 頁面的錯誤日誌
2. 常見問題：
   - Node.js 版本不匹配
   - 依賴安裝失敗
   - TypeScript 錯誤
   - 環境變數缺失

### 解決方案
```bash
# 本地測試建置
cd frontend
npm ci
npm run build:pages

# 檢查是否有錯誤
npm run type-check
npm run lint:check
```

## 高級功能

### 自定義域名
1. 在 **Custom domains** 中添加域名
2. 設定 DNS CNAME 記錄
3. 自動 SSL 證書

### 分支部署
- `main` 分支 → 生產環境
- `develop` 分支 → 測試環境
- 功能分支 → 預覽環境

### Webhook 通知
可以設定 Webhook 在部署完成時通知：
- Slack
- Discord
- 自定義 API

## 成本
- **免費額度**：每月 500 次建置
- **無限流量**：完全免費
- **自定義域名**：免費

## 總結

Git 整合是最佳選擇，因為：
1. **零維護成本**
2. **完全自動化**
3. **專業級功能**
4. **團隊協作友好**
5. **完全免費**

設定一次後，你只需要專注於開發，部署完全自動化！