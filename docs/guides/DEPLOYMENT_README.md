# 🚀 一鍵部署指南

## 概述

這個多渠道客服系統提供完整的一鍵部署解決方案，使用 Terraform 自動創建所有必要的 Cloudflare 資源。客戶只需要幾個簡單的步驟，就能在自己的 Cloudflare 帳戶中部署一個完整的客服系統。

## 🎯 一鍵部署特色

- ✅ **完全自動化**: 一個命令創建所有資源
- ✅ **零配置**: 自動生成安全密鑰和配置
- ✅ **生產就緒**: 包含監控、日誌、備份等企業級功能
- ✅ **成本透明**: 清楚的成本估算和免費額度說明
- ✅ **易於維護**: 完整的管理和監控工具

## 📋 部署前準備

### 1. 安裝必要工具

```bash
# 安裝 Terraform
# Windows (使用 Chocolatey)
choco install terraform

# macOS (使用 Homebrew)
brew install terraform

# 安裝 Wrangler CLI
npm install -g wrangler

# 安裝 Node.js (如果還沒有)
# 下載並安裝: https://nodejs.org/
```

### 2. 準備 Cloudflare 帳戶

1. **註冊 Cloudflare 帳戶**: https://dash.cloudflare.com/sign-up
2. **獲取帳戶 ID**: 
   - 登入 Cloudflare Dashboard
   - 右側邊欄可以看到 Account ID
3. **創建 API Token**:
   - 前往 "My Profile" > "API Tokens"
   - 點擊 "Create Token"
   - 使用 "Custom token" 模板
   - 權限設置:
     - Account: Cloudflare Workers:Edit
     - Zone: Zone:Edit (如果使用自定義域名)
     - Zone: DNS:Edit (如果使用自定義域名)

### 3. 準備 LINE Bot 資訊

1. **前往 LINE Developers Console**: https://developers.line.biz/
2. **創建 Messaging API Channel**
3. **獲取必要資訊**:
   - Channel Access Token
   - Channel Secret

## 🚀 一鍵部署步驟

### 步驟 1: 下載專案

```bash
git clone <your-repository-url>
cd multi-channel-platform
```

### 步驟 2: 設置環境變數

```bash
# 設置 Cloudflare API Token
export CLOUDFLARE_API_TOKEN="your-api-token"

# Windows PowerShell
$env:CLOUDFLARE_API_TOKEN="your-api-token"
```

### 步驟 3: 配置部署參數

```bash
# 複製配置範例
cp terraform.tfvars.example terraform.tfvars

# 編輯配置檔案
# 填入以下必要資訊:
# - cloudflare_account_id
# - line_channel_access_token  
# - line_channel_secret
# - admin_email
# - admin_password
```

### 步驟 4: 執行一鍵部署

```bash
# Windows PowerShell
.\quick-deploy.ps1

# 或者使用 Terraform 直接部署
terraform init
terraform apply
```

### 步驟 5: 完成設置

部署完成後，腳本會顯示所有重要資訊：

```
🎉 部署完成！

API URL: https://your-project.your-account.workers.dev
前端 URL: https://your-project-frontend.pages.dev
管理後台: https://your-project.your-account.workers.dev/admin-dashboard.html

LINE Webhook URL: https://your-project.your-account.workers.dev/api/webhooks/line
管理員帳戶: admin@yourdomain.com

下一步:
1. 在 LINE Developers Console 設置 Webhook URL
2. 訪問管理後台並登入
3. 開始使用系統！
```

## 📊 部署內容

### 自動創建的資源

| 資源類型 | 用途 | 數量 |
|---------|------|------|
| **Cloudflare Workers** | 後端 API 服務 | 1 |
| **Cloudflare Pages** | 前端應用 | 1 |
| **D1 Database** | 主要資料庫 | 1 |
| **R2 Bucket** | 檔案存儲 | 1 |
| **KV Namespace** | 會話和快取 | 2 |
| **Queues** | 訊息佇列 | 2 |
| **Durable Objects** | 即時協作 | 1 |

### 自動配置的功能

- ✅ **完整的資料庫結構** (用戶、對話、訊息、團隊等)
- ✅ **管理員帳戶** (自動創建並設置密碼)
- ✅ **安全密鑰** (JWT Secret、Facebook Verify Token)
- ✅ **環境變數** (所有必要的配置)
- ✅ **域名綁定** (如果提供自定義域名)
- ✅ **CORS 設置** (前後端通訊)
- ✅ **監控配置** (日誌、分析、警報)

## 💰 成本估算

### Cloudflare 免費額度 (每月)

| 服務 | 免費額度 | 超出後費用 |
|------|----------|------------|
| **Workers** | 100,000 次請求 | $0.50/百萬次 |
| **D1 Database** | 25GB 存儲 | $0.75/GB |
| **R2 Storage** | 10GB 存儲 | $0.015/GB |
| **KV Operations** | 100,000 次操作 | $0.50/百萬次 |
| **Pages** | 500 次建置 | $0.25/次 |

### 典型使用場景成本

| 使用規模 | 月請求量 | 預估月費用 |
|----------|----------|------------|
| **小型企業** | < 50,000 | $0 (免費額度內) |
| **中型企業** | 200,000 | $0.50 |
| **大型企業** | 1,000,000 | $4.50 |

## 🔧 進階配置

### 自定義域名設置

```hcl
# 在 terraform.tfvars 中設置
custom_domain = "api.yourdomain.com"
frontend_custom_domain = "app.yourdomain.com"
zone_id = "your-zone-id"
```

### 多環境部署

```bash
# 部署到測試環境
.\quick-deploy.ps1 -Environment staging

# 部署到開發環境  
.\quick-deploy.ps1 -Environment development
```

### 功能開關

```hcl
# 在 terraform.tfvars 中設置
enable_facebook_integration = true
enable_advanced_features = true
```

## 🛠️ 管理和維護

### 查看部署狀態

```bash
terraform show
terraform output
```

### 更新系統

```bash
# 拉取最新代碼
git pull

# 重新部署
.\quick-deploy.ps1 -AutoApprove
```

### 備份和恢復

```bash
# 備份資料庫
wrangler d1 export your-database-name --output backup.sql

# 恢復資料庫
wrangler d1 execute your-database-name --file backup.sql
```

### 監控和日誌

```bash
# 查看即時日誌
wrangler tail

# 查看分析數據
# 訪問 Cloudflare Dashboard > Analytics
```

## 🔒 安全性

### 自動安全配置

- ✅ **強密碼生成**: 自動生成 64 字符 JWT Secret
- ✅ **環境隔離**: 不同環境使用不同資源
- ✅ **權限最小化**: 每個服務只有必要權限
- ✅ **HTTPS 強制**: 所有通訊都使用 HTTPS
- ✅ **輸入驗證**: 完整的輸入驗證和清理
- ✅ **SQL 注入防護**: 使用參數化查詢

### 安全最佳實務

1. **定期更新密碼**: 建議每 90 天更新管理員密碼
2. **監控異常**: 定期檢查訪問日誌
3. **備份策略**: 定期備份重要資料
4. **權限審核**: 定期審核用戶權限

## 🆘 故障排除

### 常見問題

#### 1. Terraform 初始化失敗
```bash
# 清理並重新初始化
rm -rf .terraform
terraform init
```

#### 2. API Token 權限不足
- 確認 API Token 有 Workers:Edit 權限
- 如果使用自定義域名，需要 Zone:Edit 權限

#### 3. 資料庫初始化失敗
```bash
# 手動執行資料庫初始化
wrangler d1 execute your-database-name --file ./database/schema.sql
```

#### 4. 前端建置失敗
```bash
# 清理並重新建置
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### 獲取幫助

```bash
# 查看部署腳本幫助
.\quick-deploy.ps1 -Help

# 查看 Terraform 幫助
terraform -help

# 查看 Wrangler 幫助
wrangler --help
```

## 🎯 銷毀資源

如果需要完全移除系統：

```bash
# 銷毀所有資源
.\quick-deploy.ps1 -Destroy

# 或使用 Terraform
terraform destroy
```

⚠️ **警告**: 這將刪除所有資料，請確保已備份重要資訊。

## 📞 技術支援

如果遇到問題：

1. **查看文件**: 檢查 `docs/` 目錄中的詳細文件
2. **檢查日誌**: 使用 `wrangler tail` 查看即時日誌
3. **社群支援**: 查看 GitHub Issues
4. **商業支援**: 聯繫技術支援團隊

---

## 🎉 恭喜！

完成部署後，你將擁有一個功能完整的企業級多渠道客服系統：

- ✅ **現代化界面**: Vue.js 前端應用
- ✅ **強大後端**: Cloudflare Workers 高效能 API
- ✅ **即時協作**: WebSocket 多人協作
- ✅ **企業級功能**: 權限管理、團隊協作、檔案管理
- ✅ **全球部署**: Cloudflare 全球網路
- ✅ **自動擴展**: 無需管理伺服器
- ✅ **成本效益**: 按使用量付費

開始享受你的新客服系統吧！ 🚀