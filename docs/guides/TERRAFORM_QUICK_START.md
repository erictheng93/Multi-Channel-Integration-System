# Terraform 快速開始指南

## 概述

本指南幫助您使用 Terraform 基礎設施即代碼快速部署多渠道客服支援平台。

## 前置需求

### 必需工具
- [Terraform](https://www.terraform.io/downloads) (>= 1.0)
- [Cloudflare CLI (wrangler)](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Node.js](https://nodejs.org/) (>= 18)
- [Git](https://git-scm.com/)

### 必需帳戶
- [Cloudflare 帳戶](https://dash.cloudflare.com/sign-up) 包含：
  - Workers 付費方案（用於 D1、KV、R2 和 Queue 功能）
  - 域名（可選，用於自定義域名）

### 必需令牌
- **Cloudflare API 令牌** 具有以下權限：
  - Zone:Zone Settings:Edit
  - Zone:Zone:Read
  - Account:Cloudflare Workers:Edit
  - Account:Account Settings:Read

## 快速設置（5 分鐘）

### 1. 克隆和設置
```bash
git clone <repository-url>
cd multi-channel-platform
npm install
```

### 2. 配置環境
```bash
# 複製範例文件
cp terraform.tfvars.example terraform.tfvars
cp .env.example .env

# 設置 Cloudflare API 令牌
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

### 3. 配置變數
編輯 `terraform.tfvars`：
```hcl
# 必需
cloudflare_account_id = "your-account-id"
project_name = "my-customer-support"
admin_email = "admin@yourcompany.com"
admin_password = "secure-password-123"

# LINE 整合（必需）
line_channel_access_token = "your-line-channel-access-token"
line_channel_secret = "your-line-channel-secret"

# Facebook 整合（可選）
facebook_page_access_token = "your-facebook-page-access-token"
facebook_app_secret = "your-facebook-app-secret"

# 自定義域名（可選）
custom_domain = "api.yourcompany.com"
frontend_custom_domain = "support.yourcompany.com"
zone_id = "your-cloudflare-zone-id"
```

### 4. 部署基礎設施
```bash
# 初始化 Terraform
terraform init

# 規劃部署
terraform plan

# 部署（需要 2-3 分鐘）
terraform apply
```

### 5. 驗證部署
```bash
# 檢查部署狀態
terraform output

# 測試 API 端點
curl https://your-worker-url.workers.dev/api/health
```

## 配置詳情

### 必需變數

| 變數 | 描述 | 範例 |
|------|------|------|
| `cloudflare_account_id` | 您的 Cloudflare 帳戶 ID | `abc123...` |
| `project_name` | 專案名稱（用於資源命名） | `customer-support` |
| `admin_email` | 管理員用戶電子郵件 | `admin@company.com` |
| `admin_password` | 管理員用戶密碼 | `SecurePass123!` |
| `line_channel_access_token` | LINE Bot 頻道存取令牌 | `abc123...` |
| `line_channel_secret` | LINE Bot 頻道密鑰 | `def456...` |

### 可選變數

| 變數 | 描述 | 預設值 |
|------|------|--------|
| `environment` | 部署環境 | `production` |
| `custom_domain` | API 自定義域名 | `""` (使用 workers.dev) |
| `frontend_custom_domain` | 前端自定義域名 | `""` (使用 pages.dev) |
| `zone_id` | Cloudflare Zone ID（自定義域名必需） | `""` |
| `r2_location` | R2 存儲桶位置 | `auto` |
| `facebook_page_access_token` | Facebook 頁面存取令牌 | `""` |
| `facebook_app_secret` | Facebook 應用程式密鑰 | `""` |

## 創建的資源

### Cloudflare 資源
- **Worker**: 主要 API 後端
- **D1 資料庫**: SQLite 相容資料庫
- **KV 命名空間**: 會話和快取存儲
- **R2 存儲桶**: 檔案附件存儲
- **佇列**: 訊息處理佇列
- **Pages 專案**: 前端應用程式

### 自動設置
- 資料庫結構初始化
- 管理員用戶創建
- 環境變數配置
- Webhook 端點設置

## 部署後步驟

### 1. 配置 LINE Bot
在 LINE Developers Console 中設置 webhook URL：
```
https://your-domain/api/webhooks/line
```

### 2. 配置 Facebook Messenger（可選）
在 Facebook Developers Console 中設置 webhook URL 和驗證令牌：
```
Webhook URL: https://your-domain/api/webhooks/facebook
Verify Token: (顯示在 terraform output 中)
```

### 3. 存取管理員儀表板
```
URL: https://your-domain/admin-dashboard.html
Email: (your admin_email)
Password: (your admin_password)
```

### 4. 存取前端應用程式
```
URL: https://your-frontend-domain
```

## 環境管理

### 開發環境
```bash
# 部署到開發環境
terraform workspace new development
terraform apply -var="environment=development"
```

### 測試環境
```bash
# 部署到測試環境
terraform workspace new staging
terraform apply -var="environment=staging"
```

### 生產環境
```bash
# 部署到生產環境（預設）
terraform workspace select default
terraform apply -var="environment=production"
```

## 故障排除

### 常見問題

#### 1. API 令牌權限
```bash
# 測試 API 令牌
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

#### 2. 找不到帳戶 ID
```bash
# 獲取帳戶 ID
wrangler whoami
```

#### 3. 域名配置
```bash
# 驗證 zone ID
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

#### 4. 資源限制
- 確保您有 Workers 付費方案
- 檢查 D1、KV、R2 和 Queues 的帳戶限制

### 驗證命令
```bash
# 檢查所有資源
terraform state list

# 驗證資料庫
wrangler d1 execute omni-channel-platform --command="SELECT COUNT(*) FROM users"

# 測試 API 端點
curl https://your-domain/api/health
curl https://your-domain/api/system/status
```

## 更新部署

### 代碼更新
```bash
# 拉取最新變更
git pull origin main

# 更新基礎設施
terraform plan
terraform apply
```

### 配置變更
```bash
# 更新 terraform.tfvars
vim terraform.tfvars

# 應用變更
terraform apply
```

## 清理

### 移除所有資源
```bash
# 銷毀基礎設施
terraform destroy

# 清理本地狀態
rm -rf .terraform
rm terraform.tfstate*
```

## 成本估算

### Cloudflare Workers（付費方案）
- **Workers**: $5/月 + 使用量
- **D1**: 前 25GB 免費，之後 $0.75/GB
- **KV**: 前 100k 操作免費，之後 $0.50/百萬次
- **R2**: 前 10GB 免費，之後 $0.015/GB
- **Pages**: 每月 500 次建置免費，之後 $0.25/次建置
- **Queues**: 前 100 萬次操作免費，之後 $0.40/百萬次

### 典型月費用
- **小型部署**: $5-15/月
- **中型部署**: $15-50/月
- **大型部署**: $50-200/月

## 安全考量

### 密鑰管理
- 將敏感變數存儲在 `terraform.tfvars` 中（不要加入版本控制）
- 團隊部署使用 Terraform Cloud 或類似服務
- 定期輪換 API 令牌

### 存取控制
- 使用最小權限 API 令牌
- 在 Cloudflare 帳戶上啟用 2FA
- 定期檢查存取日誌

### 網路安全
- 使用帶有 SSL/TLS 的自定義域名
- 啟用 Cloudflare 安全功能
- 配置適當的 CORS 設置

## 支援

### 獲取幫助
1. 查看[部署指南](DEPLOYMENT_GUIDE.md)獲取詳細說明
2. 查看[系統健康報告](SYSTEM_HEALTH_REPORT.md)進行監控
3. 在 GitHub 上提交問題報告錯誤或功能請求

### 監控
- 使用 Cloudflare Analytics 進行流量監控
- 檢查 Worker 日誌查看錯誤
- 監控 D1 資料庫使用情況

---

*本快速開始指南讓您在 10 分鐘內啟動並運行。有關詳細配置選項，請參閱[完整部署指南](DEPLOYMENT_GUIDE.md)。*