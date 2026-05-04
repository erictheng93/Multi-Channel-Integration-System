# 客戶部署指南

##  目錄

1. [部署前準備](#部署前準備)
2. [環境需求](#環境需求)
3. [獲取 Cloudflare API Token](#獲取-cloudflare-api-token)
4. [配置部署參數](#配置部署參數)
5. [執行部署](#執行部署)
6. [部署後設置](#部署後設置)
7. [驗證部署](#驗證部署)
8. [常見問題](#常見問題)
9. [故障排除](#故障排除)

---

##  部署前準備

### 必備條件清單

在開始部署前，請確認您已具備以下條件：

-  **Cloudflare 帳號**（免費或付費方案均可）
-  **LINE Official Account**（用於 LINE Bot 集成）
-  **域名**（可選，用於自訂網址）
-  **系統管理員資訊**（Email 和密碼）

### 預估時間

- 首次部署：**20-30 分鐘**
- 熟悉流程後：**5-10 分鐘**

### 預估費用

Cloudflare Workers 採用用量計費：

| 服務 | 免費額度 | 超額費用 |
|------|---------|---------|
| **Workers 請求** | 前 100,000 次/天 免費 | $0.50/百萬次 |
| **D1 資料庫** | 前 5GB 免費 | $0.75/GB |
| **R2 儲存** | 前 10GB 免費 | $0.015/GB |
| **KV 操作** | 前 100,000 次/天 免費 | $0.50/百萬次 |
| **Pages 建置** | 前 500 次/月 免費 | $0.25/次 |

** 提示**：小型企業通常在免費額度內即可運行。

---

##  環境需求

### 1. 安裝必要工具

#### Windows 用戶

```powershell
# 安裝 Node.js (>= 18)
# 下載並安裝: https://nodejs.org/

# 安裝 Terraform
# 下載並安裝: https://www.terraform.io/downloads

# 安裝 Wrangler CLI
bun install -g wrangler

# 驗證安裝
node --version # 應顯示 v18.x.x 或更高
npm --version # 應顯示 9.x.x 或更高
terraform --version # 應顯示 Terraform v1.x.x
wrangler --version # 應顯示 wrangler 4.x.x
```

#### macOS/Linux 用戶

```bash
# 安裝 Node.js (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 安裝 Terraform (使用 tfenv)
brew install tfenv
tfenv install 1.0.0
tfenv use 1.0.0

# 安裝 Wrangler CLI
bun install -g wrangler

# 驗證安裝
node --version
npm --version
terraform --version
wrangler --version
```

### 2. 解壓專案檔案

```bash
# 解壓交付包
cd /path/to/deployment/location
unzip MCIS.zip
cd Multi_Channel_Integration_System

# 或從 Git repository clone
git clone <repository-url>
cd Multi_Channel_Integration_System
```

---

##  獲取 Cloudflare API Token

**詳細步驟請參閱：[Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)**

### 快速步驟

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 點擊右上角頭像 → **我的個人資料** → **API 權杖**
3. 點擊 **建立權杖** → **使用自訂權杖範本**
4. 設置權限：
   ```
   帳戶資源
   ├─ Account Settings → Read
   ├─ Cloudflare Workers → Edit

   區域資源（如使用自訂域名）
   ├─ Zone → Read
   └─ Zone Settings → Edit
   ```
5. 複製生成的 Token（只顯示一次！）

### 設置環境變數

#### Windows PowerShell
```powershell
$env:CLOUDFLARE_API_TOKEN="your-token-here"

# 永久保存（可選）
[System.Environment]::SetEnvironmentVariable('CLOUDFLARE_API_TOKEN', 'your-token-here', 'User')
```

#### macOS/Linux
```bash
export CLOUDFLARE_API_TOKEN="your-token-here"

# 永久保存（加入 ~/.bashrc 或 ~/.zshrc）
echo 'export CLOUDFLARE_API_TOKEN="your-token-here"' >> ~/.bashrc
source ~/.bashrc
```

---

##  配置部署參數

### 1. 複製配置範本

```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2. 編輯 terraform.tfvars

使用任何文字編輯器打開 `terraform.tfvars`：

```hcl
# ============================================================
#  基本配置
# ============================================================

# Cloudflare 帳戶 ID
# 在 Cloudflare Dashboard 右側欄位可找到
cloudflare_account_id = "your-account-id-here"

# 專案名稱（建議保持預設值）
project_name = "mcis-worker"

# 部署環境
environment = "production"

# ============================================================
#  管理員帳戶
# ============================================================

admin_email = "admin@yourcompany.com"
admin_password = "YourSecurePassword123!"  # 至少 8 個字元

# ============================================================
#  LINE Official Account 配置
# ============================================================

# 在 LINE Developers Console 獲取
# https://developers.line.biz/console/
line_channel_access_token = "your-line-channel-access-token"
line_channel_secret = "your-line-channel-secret"

# ============================================================
#  域名配置（可選）
# ============================================================

# 如果您有自己的域名，可以在此設置
# 留空則使用 Cloudflare 提供的 *.workers.dev 域名

# API 後端域名（例如：api.yourcompany.com）
custom_domain = ""

# 前端應用域名（例如：app.yourcompany.com）
frontend_custom_domain = ""

# 如使用自訂域名，需要提供 Zone ID
# 在 Cloudflare Dashboard → 您的網域 → 右側欄位可找到
zone_id = ""

# ============================================================
#  R2 儲存區域配置
# ============================================================

# 選擇最接近您用戶的區域以獲得最佳性能
# 可用選項：WNAM (北美西), ENAM (北美東), WEUR (西歐), EEUR (東歐), APAC (亞太)
r2_location = "APAC"

# ============================================================
#  功能開關（可選）
# ============================================================

# 是否啟用 Facebook Messenger 整合
enable_facebook_integration = false

# Facebook 配置（如啟用上面的開關）
facebook_page_access_token = ""
facebook_app_secret = ""

# 是否啟用進階功能（WebSocket、Durable Objects）
enable_advanced_features = true

# ============================================================
#  資源配置（進階選項）
# ============================================================

worker_cpu_limit = 50 # Worker CPU 限制（毫秒）
worker_memory_limit = 128  # Worker 記憶體限制（MB）
```

### 3. 獲取必要的配置資訊

#### Cloudflare Account ID

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在右側欄位找到 **Account ID**
3. 點擊複製

#### Cloudflare Zone ID（僅在使用自訂域名時需要）

1. 在 Cloudflare Dashboard 選擇您的網域
2. 在右側欄位找到 **Zone ID**
3. 點擊複製

#### LINE Channel 資訊

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Channel
3. 在 **Basic settings** 標籤：
   - 複製 **Channel secret**
4. 在 **Messaging API** 標籤：
   - 複製 **Channel access token**
   - 如果沒有，點擊 **Issue** 生成

---

##  執行部署

### 方法 1: 使用自動化腳本（推薦）

#### Windows PowerShell

```powershell
# 執行部署前準備
.\scripts\pre-deployment-build.ps1

# 初始化 Terraform
terraform init

# 檢視部署計劃
terraform plan

# 執行部署（需要確認）
terraform apply

# 查看部署結果
terraform output
```

#### macOS/Linux Bash

```bash
# 賦予執行權限
chmod +x scripts/pre-deployment-build.sh

# 執行部署前準備
./scripts/pre-deployment-build.sh

# 初始化 Terraform
terraform init

# 檢視部署計劃
terraform plan

# 執行部署（需要確認）
terraform apply

# 查看部署結果
terraform output
```

### 方法 2: 手動步驟

```bash
# 1. 安裝依賴
bun install
cd frontend && bun install && cd ..

# 2. 建置專案
bun run build
cd frontend && bun run build && cd ..

# 3. 建置 Worker
bunx wrangler deploy --dry-run --outdir=dist

# 4. Terraform 部署
terraform init
terraform plan
terraform apply

# 5. 查看結果
terraform output
```

### 部署過程說明

執行 `terraform apply` 後，您會看到：

```
Plan: 15 to add, 0 to change, 0 to destroy.

Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value:
```

輸入 `yes` 並按 Enter 開始部署。

Terraform 將會建立：
-  D1 資料庫
-  R2 儲存桶
-  KV 命名空間（2 個）
-  Worker Script（含 7 個 Durable Objects）
-  Pages 專案
-  資料庫 Migrations
-  管理員帳戶

預計時間：**2-5 分鐘**

---

##  部署後設置

### 1. 獲取部署資訊

```bash
terraform output
```

您會看到類似以下的輸出：

```
api_url = "https://mcis-backend.daiwandist.com"
frontend_url = "https://mcis-ey7.pages.dev"
line_webhook_url = "https://mcis-backend.daiwandist.com/api/webhooks/line"
admin_email = "admin@yourcompany.com"
database_id = "08ae6790-2494-40a8-a07a-df3920783159"
```

**重要**：請記錄這些資訊，稍後會用到！

### 2. 設置 LINE Webhook

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Channel
3. 進入 **Messaging API** 標籤
4. 在 **Webhook settings** 區塊：
   - **Webhook URL**：填入 `line_webhook_url`（從上一步獲得）
   - 點擊 **Update**
   - 開啟 **Use webhook**
   - 點擊 **Verify** 驗證（應該顯示成功）

5. 在 **LINE Official Account features** 區塊：
   - 關閉 **Auto-reply messages**（避免重複回覆）
   - 關閉 **Greeting messages**（可選）

### 3. 首次登入管理後台

1. 使用瀏覽器訪問：`<api_url>/admin-dashboard.html`
2. 使用您在 `terraform.tfvars` 中設置的管理員帳號登入
3. 首次登入後建議：
   - 修改管理員密碼
   - 建立其他管理員或客服人員帳號
   - 瀏覽系統設置

### 4. 訪問前端應用

1. 使用瀏覽器訪問：`<frontend_url>`
2. 使用管理員帳號登入
3. 開始使用客服系統！

---

##  驗證部署

### 自動驗證腳本

```bash
# 執行健康檢查
curl <your-api-url>/api/system/health

# 應該返回：
# {"status":"healthy","timestamp":"..."}
```

### 手動驗證清單

- [ ] **API 健康檢查**：訪問 `<api_url>/api/system/health` 應返回 `{"status":"healthy"}`
- [ ] **前端可訪問**：訪問 `<frontend_url>` 可以看到登入頁面
- [ ] **管理後台可訪問**：訪問 `<api_url>/admin-dashboard.html` 可以看到登入頁面
- [ ] **LINE Webhook 驗證**：在 LINE Developers Console 驗證成功
- [ ] **資料庫正常**：執行 `wrangler d1 execute <database_name> --command="SELECT COUNT(*) FROM users"` 應返回至少 1（管理員帳戶）
- [ ] **R2 儲存正常**：執行 `wrangler r2 bucket list` 應能看到建立的儲存桶

### 測試 LINE Bot

1. 在 LINE App 加入您的 Official Account 好友
2. 傳送訊息給 Bot
3. 在管理後台查看是否收到訊息
4. 回覆訊息
5. 確認 LINE 端收到回覆

---

##  常見問題

### Q1: 部署時出現 "Error: Invalid Credentials"

**A:** 請確認：
- `CLOUDFLARE_API_TOKEN` 環境變數已正確設置
- API Token 權限包含必要的 Account 和 Zone 權限
- Token 沒有過期

重新生成 Token 並設置：
```bash
export CLOUDFLARE_API_TOKEN="new-token"
terraform apply
```

### Q2: 部署成功但 LINE Webhook 驗證失敗

**A:** 可能原因：
1. **URL 錯誤**：確認填入的是 `terraform output` 顯示的完整 `line_webhook_url`
2. **Worker 未完全部署**：等待 1-2 分鐘後重試
3. **CORS 問題**：檢查 Worker 日誌（Cloudflare Dashboard → Workers → Logs）

### Q3: 前端無法連接到後端 API

**A:** 檢查：
1. 前端環境變數是否正確設置（`VITE_API_BASE_URL`）
2. CORS 配置是否正確
3. Worker 是否正常運行

重新部署前端：
```bash
cd frontend
bun run build:pages
bun run deploy:pages
```

### Q4: 如何更新系統到新版本？

**A:**
```bash
# 獲取最新代碼
git pull origin main

# 安裝新依賴
bun install
cd frontend && bun install && cd ..

# 重新建置
./scripts/pre-deployment-build.sh  # 或 .ps1

# 檢視變更
terraform plan

# 應用更新
terraform apply
```

### Q5: 如何完全移除部署？

**A:**
```bash
# 銷毀所有 Terraform 管理的資源
terraform destroy

# 確認所有資源已刪除
# 登入 Cloudflare Dashboard 手動檢查
```

 **警告**：這會刪除所有資料，包括資料庫內容！請先備份重要資料。

### Q6: 如何部署多個環境（開發/測試/生產）？

**A:** 使用 Terraform Workspaces：

```bash
# 建立開發環境
terraform workspace new development
terraform apply -var="environment=development"

# 切換到生產環境
terraform workspace select default
terraform apply -var="environment=production"

# 列出所有環境
terraform workspace list
```

### Q7: 部署費用大約是多少？

**A:** 根據使用量：
- **小型企業**（< 1000 對話/天）：通常完全免費
- **中型企業**（1000-10000 對話/天）：約 $5-15/月
- **大型企業**（> 10000 對話/天）：約 $15-50/月

實際費用在 Cloudflare Dashboard → Billing 可以查看。

---

##  故障排除

### 部署失敗：資源已存在

**錯誤訊息**：
```
Error: A resource with the name "..." already exists
```

**解決方案**：
```bash
# 導入現有資源
terraform import cloudflare_d1_database.main <database_id>

# 或刪除現有資源後重新部署
wrangler d1 delete <database_name>
terraform apply
```

### Worker 部署後 502 錯誤

**可能原因**：
- Worker 腳本有語法錯誤
- Durable Objects 初始化失敗

**解決方案**：
```bash
# 檢查 Worker 日誌
wrangler tail <worker_name>

# 重新部署
terraform apply
```

### 資料庫 Migration 失敗

**錯誤訊息**：
```
Error applying migrations
```

**解決方案**：
```bash
# 手動執行 migrations
wrangler d1 migrations apply <database_name> --remote

# 如果需要重置資料庫（ 會刪除所有資料）
wrangler d1 delete <database_name>
terraform apply
```

### R2 儲存桶訪問失敗

**解決方案**：
```bash
# 檢查儲存桶權限
wrangler r2 bucket list

# 重新設置 R2 綁定
terraform apply -replace=cloudflare_worker_script.main
```

### 前端建置失敗

**錯誤訊息**：
```
npm ERR! code ELIFECYCLE
```

**解決方案**：
```bash
# 清理快取
cd frontend
rm -rf node_modules package-lock.json
bun install
bun run build

# 如果仍然失敗，檢查 Node.js 版本
node --version  # 應該 >= 18
```

---

##  支援與聯繫

如果您在部署過程中遇到問題：

1. **檢查本文件的常見問題和故障排除章節**
2. **查看系統日誌**：
   ```bash
   wrangler tail <worker_name>
   ```
3. **聯繫技術支援**：
   - Email: support@yourcompany.com
   - 技術文檔: https://docs.yourcompany.com

---

##  相關文檔

- [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- [Terraform 快速開始](./guides/TERRAFORM_QUICK_START.md)
- [系統架構說明](../CLAUDE.md)
- [API 參考文檔](./api/)

---

##  變更記錄

- **2025-01-27**: 初版發布
  - 包含完整的部署流程
  - 新增 pre-deployment 自動化腳本
  - 新增常見問題解答

---

**祝您部署順利！** 

如有任何問題，請隨時聯繫我們的技術支援團隊。
