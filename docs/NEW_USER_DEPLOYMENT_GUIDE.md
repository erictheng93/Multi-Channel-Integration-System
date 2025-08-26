# 🚀 新用戶完整部署指南

本文檔為全新用戶提供完整的系統部署指南，適用於在全新電腦上從零開始部署 Multi-Channel Customer Support System v3.0。

## 📋 系統概覽

### 🌟 核心功能
- ✅ **多渠道整合**: LINE OA、Facebook Messenger 統一管理
- ✅ **企業級權限**: Admin、Team、Agent 三級權限系統
- ✅ **即時協作**: WebSocket 實時多人協作
- ✅ **API 監控**: 實時 API 健康狀態監控
- ✅ **延遲發送**: 1-120 秒可撤回訊息機制
- ✅ **QR Code**: 自動客戶指派系統
- ✅ **雙軌部署**: 開發者/用戶雙軌部署支援

### 🏗️ 技術架構
- **後端**: Cloudflare Workers + Hono.js + Drizzle ORM
- **前端**: Vue 3 + TypeScript + Vite
- **資料庫**: Cloudflare D1 (SQLite)
- **存儲**: Cloudflare R2 + KV + Queues
- **部署**: Terraform (IaC) + PowerShell 腳本

---

## 🛠️ 第一階段：系統準備

### 1.1 安裝必要工具

#### **Node.js 和 npm**
```bash
# 下載並安裝 Node.js LTS 版本
# 訪問: https://nodejs.org
# 推薦版本: 18.x 或 20.x（包含 npm）

# 驗證安裝
node --version  # 應該顯示 v18.x.x 或 v20.x.x
npm --version   # 應該顯示 9.x.x 或更高版本
```

#### **Terraform**
```bash
# Windows 用戶 - 方法 1: 使用 Chocolatey
choco install terraform

# Windows 用戶 - 方法 2: 手動安裝
# 1. 訪問 https://terraform.io/downloads
# 2. 下載適合的版本
# 3. 解壓並添加到 PATH 環境變量

# 驗證安裝
terraform --version  # 應該顯示 v1.0.0 或更高版本
```

#### **Wrangler CLI**
```bash
# 全局安裝 Wrangler
npm install -g wrangler

# 驗證安裝
wrangler --version  # 應該顯示 3.x.x 或更高版本
```

### 1.2 驗證工具安裝
```bash
# 完整驗證腳本
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)" 
echo "Terraform: $(terraform --version)"
echo "Wrangler: $(wrangler --version)"
```

---

## 🔑 第二階段：帳戶設定

### 2.1 Cloudflare 帳戶準備

#### **創建 Cloudflare 帳戶**
1. 訪問 [https://cloudflare.com](https://cloudflare.com)
2. 點擊 "Sign Up" 註冊新帳戶
3. 完成電子郵件驗證
4. 登入 Cloudflare Dashboard

#### **獲取 API Token**
1. 登入 Cloudflare Dashboard
2. 點擊右上角頭像 → "My Profile"
3. 點擊 "API Tokens" 標籤
4. 點擊 "Create Token" 按鈕
5. 選擇 "Custom token" 模板
6. 設定 Token 權限：
   ```
   Permissions:
   - Account: Cloudflare Workers:Edit
   - Account: Account Settings:Read  
   - Zone: Zone:Read
   - Zone: DNS:Edit
   
   Account Resources:
   - Include: Your Account
   
   Zone Resources:  
   - Include: All zones (如果有自訂域名)
   ```
7. 點擊 "Continue to summary"
8. 點擊 "Create Token"
9. **重要**: 複製並安全保存生成的 Token

#### **登入 Wrangler**
```bash
# 使用 Cloudflare API Token 登入
wrangler login

# 或者直接使用 Token（推薦）
wrangler auth login --api-token YOUR_CLOUDFLARE_API_TOKEN

# 驗證登入狀態
wrangler whoami
```

### 2.2 LINE Developer 帳戶設定

#### **創建 LINE Channel**
1. 訪問 [LINE Developers Console](https://developers.line.biz)
2. 使用 LINE 帳戶登入
3. 如果是首次使用，同意開發者協議
4. 點擊 "Create Provider"
5. 輸入 Provider 名稱（例如：你的公司名稱）
6. 點擊 "Create"

#### **創建 Messaging API Channel**
1. 在 Provider 頁面點擊 "Create Channel"
2. 選擇 "Messaging API"
3. 填寫 Channel 資訊：
   ```
   Channel name: 多渠道客服系統
   Channel description: 企業級客服管理系統
   Category: Business
   Subcategory: Customer Service
   ```
4. 上傳 Channel 圖標（可選）
5. 閱讀並同意條款
6. 點擊 "Create"

#### **獲取 LINE Credentials**
1. 進入創建的 Channel
2. 在 "Basic settings" 標籤找到 **Channel Secret**
3. 點擊 "Messaging API" 標籤
4. 找到 **Channel Access Token**
   - 如果沒有，點擊 "Issue" 生成
5. **重要**: 複製並安全保存這兩個值

### 2.3 Facebook Messenger 設定（可選）

#### **創建 Facebook App**
1. 訪問 [Facebook Developers](https://developers.facebook.com)
2. 登入 Facebook 帳戶
3. 點擊 "My Apps" → "Create App"
4. 選擇 "Business" 用途
5. 填寫應用資訊並創建

#### **設定 Messenger**
1. 在應用 Dashboard 點擊 "Add Product"
2. 找到 "Messenger" 並點擊 "Set Up"
3. 獲取 Page Access Token
4. 複製 App Secret

---

## 🌐 第三階段：環境變數設定

### 3.1 必要環境變數

```powershell
# PowerShell 中設定環境變數（當前會話）
$env:CLOUDFLARE_API_TOKEN = "你的_Cloudflare_API_Token"
$env:TF_VAR_line_channel_access_token = "你的_LINE_Channel_Access_Token"
$env:TF_VAR_line_channel_secret = "你的_LINE_Channel_Secret"
$env:TF_VAR_admin_email = "admin@yourdomain.com"
$env:TF_VAR_admin_password = "你的_安全密碼_至少8字符"
```

### 3.2 可選環境變數

```powershell
# Cloudflare 帳戶 ID（可選，腳本會自動偵測）
$env:TF_VAR_cloudflare_account_id = "你的_Cloudflare_帳戶_ID"

# Facebook Messenger（如果要使用）
$env:TF_VAR_facebook_page_access_token = "你的_Facebook_Page_Access_Token"
$env:TF_VAR_facebook_app_secret = "你的_Facebook_App_Secret"

# 自訂域名（可選）
$env:TF_VAR_custom_domain = "api.yourdomain.com"
$env:TF_VAR_frontend_custom_domain = "app.yourdomain.com"
```

### 3.3 永久設定環境變數

#### **方法 1: PowerShell 永久設定**
```powershell
# 永久設定到使用者環境變數
[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "你的_Token", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_line_channel_access_token", "你的_LINE_Token", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_line_channel_secret", "你的_LINE_Secret", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_admin_email", "admin@yourdomain.com", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_admin_password", "你的密碼", "User")

# 重新載入環境變數
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
```

#### **方法 2: Windows 系統設定**
1. 按 `Win + R`，輸入 `sysdm.cpl`
2. 點擊 "環境變數"
3. 在 "使用者變數" 區域點擊 "新增"
4. 逐一添加上述變數

#### **方法 3: 創建 .env 檔案**
```bash
# 在專案根目錄創建 .env.local 檔案
# 注意：不要提交此檔案到 Git

CLOUDFLARE_API_TOKEN=你的_Token
TF_VAR_line_channel_access_token=你的_LINE_Token
TF_VAR_line_channel_secret=你的_LINE_Secret
TF_VAR_admin_email=admin@yourdomain.com
TF_VAR_admin_password=你的密碼
```

### 3.4 驗證環境變數

```powershell
# 檢查所有必要環境變數
Write-Host "CLOUDFLARE_API_TOKEN: $($env:CLOUDFLARE_API_TOKEN -ne $null)"
Write-Host "TF_VAR_line_channel_access_token: $($env:TF_VAR_line_channel_access_token -ne $null)"
Write-Host "TF_VAR_line_channel_secret: $($env:TF_VAR_line_channel_secret -ne $null)"
Write-Host "TF_VAR_admin_email: $env:TF_VAR_admin_email"
Write-Host "TF_VAR_admin_password: $($env:TF_VAR_admin_password -ne $null)"
```

---

## 📁 第四階段：專案準備

### 4.1 獲取專案代碼

#### **方法 1: Git Clone（推薦）**
```bash
# 如果專案在 Git 倉庫中
git clone [專案_Git_URL]
cd Multi_Channel_Integration_System
```

#### **方法 2: 下載壓縮檔**
```bash
# 下載並解壓專案檔案
# 確保解壓到一個易於訪問的目錄
# 例如: C:\Projects\Multi_Channel_Integration_System
```

### 4.2 安裝依賴

```bash
# 進入專案根目錄
cd Multi_Channel_Integration_System

# 安裝後端依賴
npm install

# 安裝前端依賴
cd frontend
npm install
cd ..

# 驗證依賴安裝
npm ls --depth=0
cd frontend && npm ls --depth=0 && cd ..
```

### 4.3 建置專案

```bash
# 建置後端 Worker
npm run build

# 建置前端應用
cd frontend
npm run build:pages
cd ..

# 驗證建置結果
ls dist/          # 應該看到 index.js
ls frontend/dist/ # 應該看到前端建置檔案
```

---

## 🚀 第五階段：執行部署

### 5.1 使用 Terraform 部署腳本

#### **基本部署命令**
```powershell
# 進入專案根目錄
cd Multi_Channel_Integration_System

# 基本部署（生產環境）
.\scripts\user-deploy.ps1

# 查看完整幫助
.\scripts\user-deploy.ps1 -Help
```

#### **部署選項**
```powershell
# 只查看部署計劃（不實際部署）
.\scripts\user-deploy.ps1 -PlanOnly

# 自動批准（跳過確認步驟）
.\scripts\user-deploy.ps1 -AutoApprove

# 部署到開發環境
.\scripts\user-deploy.ps1 -Environment development

# 組合使用
.\scripts\user-deploy.ps1 -Environment development -AutoApprove
```

### 5.2 部署過程說明

部署腳本會依序執行以下步驟：

1. **檢查必要工具** - 驗證 Terraform、Node.js、Wrangler 是否可用
2. **檢查環境變數** - 驗證所有必要的環境變數已設定
3. **檢查 Wrangler 登入** - 確保 Cloudflare 帳戶已登入
4. **建置應用** - 自動建置後端和前端代碼
5. **Terraform 初始化** - 初始化 Terraform 工作空間
6. **創建部署計劃** - 生成 Terraform 部署計劃
7. **執行部署** - 創建所有 Cloudflare 資源
8. **部署後驗證** - 測試 API 和前端可用性

### 5.3 預期部署時間

- **首次部署**: 5-10 分鐘
- **後續更新**: 2-3 分鐘
- **網路因素**: 可能影響部署時間

---

## 🔍 第六階段：部署後設定

### 6.1 記錄部署輸出

部署成功後，Terraform 會顯示重要的 URL 和資訊：

```bash
Outputs:

api_url = "https://multi-channel-platform.your-account.workers.dev"
frontend_url = "https://multi-channel-platform-frontend.pages.dev"  
admin_dashboard_url = "https://multi-channel-platform.your-account.workers.dev/admin-dashboard.html"
line_webhook_url = "https://multi-channel-platform.your-account.workers.dev/api/webhooks/line"
facebook_webhook_url = "https://multi-channel-platform.your-account.workers.dev/api/webhooks/facebook"
database_name = "multi-channel-platform"
facebook_verify_token = <sensitive>
```

**重要**: 請將這些 URL 複製並保存，後續設定會用到。

### 6.2 設定 LINE Webhook

1. **獲取 Webhook URL**
   ```bash
   # 從 Terraform 輸出複製 line_webhook_url
   # 例如: https://multi-channel-platform.your-account.workers.dev/api/webhooks/line
   ```

2. **在 LINE Developers Console 設定**
   ```bash
   # 步驟：
   # 1. 登入 LINE Developers Console
   # 2. 選擇你的 Channel
   # 3. 點擊 "Messaging API" 標籤
   # 4. 在 "Webhook settings" 區域：
   #    - Webhook URL: 貼上你的 line_webhook_url
   #    - 點擊 "Verify" 驗證
   #    - 啟用 "Use webhook"
   # 5. 在 "Auto-reply messages" 區域：
   #    - 停用 "Auto-reply messages"
   #    - 停用 "Greeting messages"（可選）
   ```

3. **驗證 Webhook**
   ```bash
   # LINE Console 中點擊 "Verify" 按鈕
   # 應該看到 "Success" 訊息
   ```

### 6.3 設定 Facebook Webhook（如果使用）

1. **獲取 Facebook Verify Token**
   ```bash
   # 查看 Terraform 敏感輸出
   terraform output facebook_verify_token
   ```

2. **在 Facebook Developers Console 設定**
   ```bash
   # 步驟：
   # 1. 進入你的 Facebook App Dashboard
   # 2. 選擇 "Messenger" → "Settings"
   # 3. 在 "Webhooks" 區域點擊 "Add Callback URL"
   # 4. 填寫：
   #    - Callback URL: 你的 facebook_webhook_url
   #    - Verify Token: 從 Terraform 輸出取得的 token
   # 5. 選擇需要的訂閱事件
   # 6. 點擊 "Verify and Save"
   ```

### 6.4 測試系統功能

#### **測試管理後台**
```bash
# 1. 訪問管理後台 URL
#    https://your-worker-url/admin-dashboard.html
# 2. 使用設定的管理員帳戶登入
#    Email: 你設定的 TF_VAR_admin_email
#    Password: 你設定的 TF_VAR_admin_password
# 3. 檢查儀表板是否正常載入
```

#### **測試 API 監控**
```bash
# 1. 在管理後台點擊 "API 監控"
# 2. 檢查是否顯示 API 狀態統計
# 3. 點擊統計卡片查看詳細資訊
# 4. 確認大部分 API 顯示為 "正常"
```

#### **測試 LINE Bot**
```bash
# 1. 在 LINE Developers Console 找到你的 Bot
# 2. 使用 LINE App 掃描 QR Code 或搜尋 Bot ID
# 3. 加入為好友
# 4. 發送測試訊息
# 5. 檢查管理後台是否收到對話記錄
```

### 6.5 初始系統設定

#### **創建團隊**
```bash
# 1. 登入管理後台
# 2. 點擊 "團隊管理"
# 3. 點擊 "新建團隊"
# 4. 填寫團隊資訊並創建
```

#### **創建用戶**
```bash
# 1. 在 "團隊管理" 中選擇團隊
# 2. 點擊 "新增成員"  
# 3. 填寫用戶資訊並設定角色
# 4. 創建用戶帳戶
```

#### **生成 QR Code**
```bash
# 1. 點擊 "QR Code 管理"
# 2. 點擊 "新建 QR Code"
# 3. 設定指派團隊
# 4. 生成並測試 QR Code
```

---

## ❗ 常見問題與解決方案

### 7.1 環境變數問題

#### **問題**: 環境變數未正確設定
```powershell
# 檢查環境變數
echo $env:CLOUDFLARE_API_TOKEN
echo $env:TF_VAR_line_channel_access_token

# 如果顯示空白或 null，重新設定
$env:CLOUDFLARE_API_TOKEN = "你的_Token"
$env:TF_VAR_line_channel_access_token = "你的_LINE_Token"
# ... 設定其他變數
```

#### **問題**: 環境變數在新 PowerShell 視窗中消失
```powershell
# 使用永久設定
[Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "你的_Token", "User")
[Environment]::SetEnvironmentVariable("TF_VAR_line_channel_access_token", "你的_LINE_Token", "User")
# ... 其他變數

# 重啟 PowerShell 或重新載入環境
refreshenv  # 如果安裝了 Chocolatey
```

### 7.2 Terraform 問題

#### **問題**: Terraform 初始化失敗
```bash
# 清除並重新初始化
rm -rf .terraform .terraform.lock.hcl
terraform init

# 如果持續失敗，檢查網路連接和 Terraform 版本
terraform --version
```

#### **問題**: 資源創建失敗
```bash
# 查看詳細錯誤
terraform plan -detailed-exitcode

# 檢查 Cloudflare 帳戶權限
wrangler whoami

# 重新登入 Cloudflare
wrangler logout
wrangler login
```

#### **問題**: 狀態檔案問題
```bash
# 如果是首次部署，可以重新開始
rm terraform.tfstate*
terraform init
terraform plan
```

### 7.3 Wrangler 問題

#### **問題**: Wrangler 登入失敗
```bash
# 清除現有會話
wrangler logout

# 重新登入
wrangler login

# 或使用 API Token
wrangler auth login --api-token YOUR_CLOUDFLARE_API_TOKEN

# 驗證登入
wrangler whoami
```

#### **問題**: Worker 部署失敗
```bash
# 檢查建置檔案是否存在
ls dist/index.js

# 如果不存在，重新建置
npm run build

# 檢查 wrangler.toml 設定
cat wrangler.toml
```

### 7.4 建置問題

#### **問題**: npm 安裝依賴失敗
```bash
# 清除 npm 快取
npm cache clean --force

# 刪除 node_modules 重新安裝
rm -rf node_modules package-lock.json
npm install

# 如果是前端
cd frontend
rm -rf node_modules package-lock.json  
npm install
```

#### **問題**: TypeScript 編譯錯誤
```bash
# 檢查 TypeScript 設定
npx tsc --noEmit

# 前端 TypeScript 檢查
cd frontend
npm run type-check

# 如果有錯誤，檢查型別定義檔案
```

#### **問題**: 前端建置失敗
```bash
cd frontend

# 檢查環境變數
echo $env:NODE_ENV

# 設定生產環境
$env:NODE_ENV = "production"

# 重新建置
npm run build:pages

# 檢查建置輸出
ls dist/
```

### 7.5 API 和 Webhook 問題

#### **問題**: LINE Webhook 驗證失敗
```bash
# 檢查 Webhook URL 是否可訪問
curl https://your-worker-url/api/webhooks/line

# 檢查 LINE Channel Secret 設定
echo $env:TF_VAR_line_channel_secret

# 檢查 Worker 日誌
wrangler tail --name your-worker-name
```

#### **問題**: API 監控顯示大量錯誤
```bash
# 檢查 Worker 是否正常運行
curl https://your-worker-url/api/system/health

# 檢查資料庫是否正常
wrangler d1 execute your-database-name --command="SELECT 1"

# 查看詳細日誌
wrangler tail --name your-worker-name --format=pretty
```

### 7.6 資料庫問題

#### **問題**: 資料庫初始化失敗
```bash
# 檢查資料庫是否存在
wrangler d1 list

# 手動執行 Schema
wrangler d1 execute your-database-name --file=./database/schema.sql

# 檢查表是否創建成功
wrangler d1 execute your-database-name --command="SELECT name FROM sqlite_master WHERE type='table'"
```

#### **問題**: 管理員帳戶登入失敗
```bash
# 檢查管理員帳戶是否創建
wrangler d1 execute your-database-name --command="SELECT * FROM users WHERE role='admin'"

# 如果沒有，手動創建（使用 Node.js 生成密碼雜湊）
node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('your_password', 10);
console.log('INSERT INTO users (email, password_hash, role, is_active, display_name, created_at, updated_at) VALUES (\"admin@example.com\", \"' + hash + '\", \"admin\", 1, \"系統管理員\", datetime(\"now\"), datetime(\"now\"));');
" > create_admin.sql

wrangler d1 execute your-database-name --file=./create_admin.sql
rm create_admin.sql
```

---

## ✅ 完整檢查清單

### 🔧 部署前檢查清單

- [ ] **工具安裝完成**
  - [ ] Node.js 18+ 或 20+ 已安裝
  - [ ] npm 已安裝並可用
  - [ ] Terraform 1.0+ 已安裝
  - [ ] Wrangler CLI 3.x+ 已安裝

- [ ] **帳戶設定完成**
  - [ ] Cloudflare 帳戶已創建
  - [ ] Cloudflare API Token 已獲取
  - [ ] Wrangler 已登入 Cloudflare
  - [ ] LINE Channel 已創建
  - [ ] LINE Channel Access Token 已獲取
  - [ ] LINE Channel Secret 已獲取

- [ ] **環境變數設定完成**
  - [ ] CLOUDFLARE_API_TOKEN 已設定
  - [ ] TF_VAR_line_channel_access_token 已設定
  - [ ] TF_VAR_line_channel_secret 已設定
  - [ ] TF_VAR_admin_email 已設定
  - [ ] TF_VAR_admin_password 已設定

- [ ] **專案準備完成**
  - [ ] 專案代碼已下載
  - [ ] 後端依賴已安裝 (npm install)
  - [ ] 前端依賴已安裝 (cd frontend && npm install)
  - [ ] 後端已建置 (npm run build)
  - [ ] 前端已建置 (npm run build:pages)

### ✅ 部署後檢查清單

- [ ] **部署成功**
  - [ ] Terraform 部署完成無錯誤
  - [ ] Worker 已成功部署
  - [ ] Pages 已成功部署
  - [ ] 資料庫已初始化
  - [ ] 管理員帳戶已創建

- [ ] **服務可用性**
  - [ ] API 後端可訪問
  - [ ] 前端應用可訪問
  - [ ] 管理後台可訪問
  - [ ] 可以使用管理員帳戶登入

- [ ] **功能測試**
  - [ ] API 監控頁面正常
  - [ ] 大部分 API 狀態為正常
  - [ ] LINE Webhook 已設定並驗證
  - [ ] LINE Bot 可以正常接收訊息
  - [ ] 管理後台各功能正常

- [ ] **初始設定**
  - [ ] 已創建至少一個團隊
  - [ ] 已創建非管理員用戶
  - [ ] 已生成並測試 QR Code
  - [ ] 已測試基本客服流程

---

## 📊 效能和監控

### 🔍 系統監控

#### **Cloudflare Dashboard**
```bash
# 訪問以下 URL 監控系統狀態：
# Worker Analytics: https://dash.cloudflare.com/your-account-id/analytics/workers
# Worker Logs: https://dash.cloudflare.com/your-account-id/workers/services/view/your-worker-name/logs  
# Pages Analytics: https://dash.cloudflare.com/your-account-id/pages/view/your-pages-name
```

#### **本地監控工具**
```bash
# 查看 Worker 即時日誌
wrangler tail --name your-worker-name

# 查看 D1 資料庫狀態
wrangler d1 info your-database-name

# 查看 KV 使用情況
wrangler kv:namespace list
```

### 📈 效能基準

#### **預期效能指標**
- **API 回應時間**: < 1000ms (正常狀態)
- **前端載入時間**: < 3 秒
- **WebSocket 連接**: < 500ms
- **資料庫查詢**: < 200ms

#### **資源使用限制**
- **Worker CPU**: 每請求 50ms (可配置)
- **Worker 記憶體**: 128MB (可配置)
- **D1 資料庫**: 25GB 免費額度
- **R2 存儲**: 10GB 免費額度
- **KV 操作**: 每月 100,000 次免費

---

## 💰 成本估算

### 📊 Cloudflare 定價（2025年）

#### **免費額度**
- **Workers**: 每月 100,000 次請求
- **D1 Database**: 25GB 存儲 + 500 萬次讀取 + 10 萬次寫入
- **R2 Storage**: 10GB 存儲 + 每月 100 萬次讀取 + 10 萬次寫入
- **KV**: 每月 100,000 次操作
- **Pages**: 每月 500 次建置 + 無限頻寬

#### **超出免費額度的費用**
- **Workers**: 每百萬次請求 $0.50
- **D1 Database**: 每 GB 存儲 $0.75/月
- **R2 Storage**: 每 GB 存儲 $0.015/月
- **KV**: 每百萬次操作 $0.50
- **Pages**: 每次建置 $0.25

#### **典型月費估算**
```bash
# 小型企業（< 10,000 對話/月）
- 大部分在免費額度內
- 預估費用: $0-5/月

# 中型企業（10,000-50,000 對話/月）  
- 預估費用: $10-25/月

# 大型企業（> 50,000 對話/月）
- 預估費用: $25-100/月
```

---

## 🔒 安全考量

### 🛡️ 安全最佳實踐

#### **API Token 管理**
```bash
# 定期輪換 API Token
# 1. 在 Cloudflare 創建新 Token
# 2. 更新環境變數
# 3. 測試新 Token
# 4. 刪除舊 Token
```

#### **密碼安全**
```bash
# 管理員密碼要求：
# - 至少 8 個字符
# - 包含大小寫字母
# - 包含數字和特殊字符
# - 定期更換（建議每 90 天）
```

#### **環境變數保護**
```bash
# 永遠不要：
# - 將敏感資訊提交到版本控制
# - 在日誌中記錄敏感資料
# - 通過不安全管道傳輸 Token
```

### 🔐 資料保護

#### **傳輸安全**
- 所有 API 通訊使用 HTTPS
- WebSocket 連接使用 WSS
- Webhook 使用簽名驗證

#### **存儲安全**
- 密碼使用 bcrypt 雜湊
- 敏感資料在 KV 中加密存儲
- 定期備份資料庫

---

## 📊 系統使用指南

### 🖥️ 管理後台功能

#### **訪問管理後台**
- URL: `https://your-worker-url/admin-dashboard.html`
- 登入: 使用部署時設定的管理員帳戶

#### **主要功能模組**
1. **儀表板**: 系統概覽和統計數據
2. **API 監控**: 實時 API 健康狀態監控  
3. **對話管理**: 客戶對話處理和指派
4. **團隊管理**: 團隊創建、成員管理
5. **客戶管理**: 客戶資料查看和編輯
6. **QR Code 管理**: 自動指派 QR Code 生成

### 🔌 API 端點參考

#### **認證相關 API**
```bash
POST /api/auth/login          # 用戶登入
POST /api/auth/logout         # 用戶登出  
GET  /api/auth/profile        # 獲取用戶資料
POST /api/auth/refresh        # Token 刷新
```

#### **團隊管理 API**
```bash
GET  /api/teams               # 獲取團隊列表
POST /api/teams               # 創建團隊
PUT  /api/teams/:id           # 更新團隊資訊
DELETE /api/teams/:id         # 刪除團隊
GET  /api/teams/:id/members   # 獲取團隊成員
POST /api/teams/:id/members   # 添加團隊成員
POST /api/teams/:id/qr-code   # 生成團隊專屬 QR Code
```

#### **對話管理 API**
```bash
GET  /api/conversations       # 獲取對話列表
GET  /api/conversations/:id   # 獲取對話詳情
POST /api/conversations/:id/assign   # 指派對話
POST /api/conversations/:id/transfer # 轉移對話
PUT  /api/conversations/:id   # 更新對話狀態
```

#### **訊息管理 API**
```bash
GET  /api/conversations/:id/messages  # 獲取對話訊息
POST /api/messages/send               # 發送訊息
POST /api/messages/:id/recall         # 撤回訊息
GET  /api/messages/pending            # 獲取待發送訊息
DELETE /api/messages/:id              # 刪除訊息
```

#### **客戶管理 API**
```bash
GET  /api/customers           # 獲取客戶列表
GET  /api/customers/:id       # 獲取客戶詳情
PUT  /api/customers/:id       # 更新客戶資訊
POST /api/customers/:id/tags  # 添加客戶標籤
```

#### **系統 API**
```bash
GET  /api/system/health       # 系統健康檢查
GET  /api/system/status       # API 狀態監控
GET  /api/system/config       # 系統配置資訊
```

#### **Webhook 端點**
```bash
POST /api/webhooks/line       # LINE Bot Webhook
POST /api/webhooks/facebook   # Facebook Messenger Webhook
```

### 🛠️ 手動操作參考（故障排除用）

#### **資料庫操作**
```bash
# 查詢資料庫
wrangler d1 execute your-database-name --command="SELECT COUNT(*) FROM messages"

# 備份資料庫
wrangler d1 export your-database-name --output backup.sql

# 執行 SQL 檔案
wrangler d1 execute your-database-name --file=./database/schema.sql

# 創建管理員用戶（如果需要）
wrangler d1 execute your-database-name --command="
INSERT INTO users (email, password_hash, role, is_active, display_name, created_at, updated_at) 
VALUES ('admin@example.com', 'hashed_password', 'admin', 1, '系統管理員', datetime('now'), datetime('now'))
"
```

#### **KV 操作**
```bash
# 查看 KV 命名空間
wrangler kv:namespace list

# 查看 KV 內容
wrangler kv:key list --namespace-id=your-namespace-id

# 設定 KV 值
wrangler kv:key put "test-key" "test-value" --namespace-id=your-namespace-id

# 刪除 KV 值
wrangler kv:key delete "test-key" --namespace-id=your-namespace-id
```

#### **R2 操作**
```bash
# 查看 R2 存儲桶
wrangler r2 bucket list

# 上傳檔案到 R2
wrangler r2 object put your-bucket-name/test.txt test-file.txt

# 下載檔案
wrangler r2 object get your-bucket-name/test.txt --file=downloaded-file.txt
```

#### **Queue 操作**
```bash
# 查看 Queue 列表
wrangler queues list

# 發送測試訊息到 Queue
wrangler queues producer your-queue-name "test message"

# 查看 Queue 消費者
wrangler queues consumer your-queue-name
```

---

## 🚀 部署完成

恭喜！如果你按照本指南完成了所有步驟，你現在已經成功部署了一個功能完整的企業級多渠道客服管理系統。

### 🎯 接下來的步驟

1. **熟悉系統**: 瀏覽管理後台的各項功能
2. **建立工作流程**: 設定團隊和用戶帳戶
3. **客戶整合**: 設定 QR Code 和 Webhook
4. **監控優化**: 定期檢查 API 監控和系統效能
5. **用戶培訓**: 培訓團隊成員使用系統

### 📞 技術支援

如果在部署過程中遇到問題，請：

1. 檢查本文檔的故障排除章節
2. 查看系統日誌和錯誤訊息
3. 驗證所有環境變數和設定
4. 聯繫技術支援團隊

---

## 🔧 系統擴展指南

### 🆕 新增平台支援

#### **添加新的通訊平台**
1. **創建平台適配器**
   ```bash
   # 在 src/integrations/ 目錄創建新檔案
   # 例如: src/integrations/telegram-adapter.ts
   ```

2. **實作 PlatformAdapter 介面**
   ```typescript
   export class TelegramAdapter implements PlatformAdapter {
     async sendMessage(message: Message): Promise<void> {
       // 實作 Telegram API 調用
     }
     
     async processWebhook(request: Request): Promise<void> {
       // 處理 Telegram Webhook
     }
   }
   ```

3. **添加 Webhook 端點**
   ```typescript
   // 在主 Worker 中添加路由
   app.post('/api/webhooks/telegram', async (c) => {
     const telegramAdapter = new TelegramAdapter();
     return await telegramAdapter.processWebhook(c.req);
   });
   ```

#### **支援的新平台範例**
- **Telegram Bot API**
- **WhatsApp Business API** 
- **Instagram Direct Messages**
- **Twitter Direct Messages**
- **Discord Bot**

### 🤖 AI 整合功能

#### **添加 ChatGPT 自動回覆**
1. **安裝依賴**
   ```bash
   npm install openai
   ```

2. **創建 AI 服務**
   ```typescript
   // src/services/ai-service.ts
   export class AIService {
     async generateReply(context: string): Promise<string> {
       // OpenAI API 調用
     }
   }
   ```

3. **整合到訊息處理**
   ```typescript
   // 在訊息處理中添加 AI 自動回覆邏輯
   if (conversation.enableAutoReply) {
     const aiReply = await aiService.generateReply(messageContext);
     await sendMessage(aiReply);
   }
   ```

### 📊 進階分析功能

#### **客戶行為分析**
1. **創建分析資料表**
   ```sql
   CREATE TABLE customer_analytics (
     id INTEGER PRIMARY KEY,
     customer_id TEXT NOT NULL,
     event_type TEXT NOT NULL,
     event_data JSON,
     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **實作分析 API**
   ```bash
   GET  /api/analytics/customers/:id     # 客戶行為分析
   GET  /api/analytics/teams/:id        # 團隊效能分析  
   GET  /api/analytics/conversations    # 對話統計
   ```

### 🔐 自訂權限規則

#### **擴展權限系統**
1. **修改權限服務**
   ```typescript
   // src/services/permission-service.ts
   export class PermissionService {
     async checkCustomPermission(user: User, resource: string, action: string): Promise<boolean> {
       // 實作自訂權限邏輯
     }
   }
   ```

2. **添加新權限規則**
   ```sql
   INSERT INTO permissions (resource, action, role) VALUES 
   ('analytics', 'view', 'manager'),
   ('export', 'data', 'admin');
   ```

### 📱 移動應用開發

#### **React Native App**
1. **專案結構**
   ```
   mobile-app/
   ├── src/
   │   ├── screens/
   │   ├── components/
   │   ├── services/
   │   └── utils/
   └── package.json
   ```

2. **API 整合**
   ```typescript
   // 使用現有的 REST API
   const apiClient = new ApiClient('https://your-worker-url');
   ```

### 📈 監控和告警系統

#### **設定 Grafana 監控**
1. **數據收集**
   ```typescript
   // 發送監控數據到外部服務
   await metrics.send({
     timestamp: Date.now(),
     apiResponseTime: responseTime,
     errorRate: errors / total
   });
   ```

2. **告警配置**
   ```yaml
   # grafana-alerts.yml
   alerts:
     - name: "High Error Rate"
       condition: "error_rate > 0.05"
       notification: "slack-webhook"
   ```

### 🔄 第三方整合

#### **CRM 系統整合**
```typescript
// src/integrations/crm-integration.ts
export class CRMIntegration {
  async syncCustomer(customer: Customer): Promise<void> {
    // 同步客戶資料到 CRM
  }
  
  async createTicket(conversation: Conversation): Promise<string> {
    // 在 CRM 中創建工單
  }
}
```

#### **支援的 CRM 系統**
- **Salesforce**
- **HubSpot** 
- **Pipedrive**
- **Zendesk**
- **Freshworks**

---

## 📚 延伸學習

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [LINE Messaging API 文檔](https://developers.line.biz/en/docs/messaging-api/)
- [Vue.js 3 文檔](https://vuejs.org/)
- [Drizzle ORM 文檔](https://orm.drizzle.team/)
- [Hono 框架文檔](https://hono.dev/)

---

**版本**: v3.0.0  
**最後更新**: 2025-08-25  
**文檔狀態**: 完整版 ✅  
**預計閱讀時間**: 45-60 分鐘  
**實際操作時間**: 2-3 小時（新手）/ 1 小時（有經驗者）

希望這份完整指南能幫助你成功部署系統！🎉