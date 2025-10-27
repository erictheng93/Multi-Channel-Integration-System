# Cloudflare API Token 設置指南

## 📋 目錄

1. [為什麼需要 API Token](#為什麼需要-api-token)
2. [API Token vs Global API Key](#api-token-vs-global-api-key)
3. [建立 API Token 詳細步驟](#建立-api-token-詳細步驟)
4. [驗證 API Token](#驗證-api-token)
5. [設置環境變數](#設置環境變數)
6. [權限說明](#權限說明)
7. [安全性最佳實踐](#安全性最佳實踐)
8. [常見問題](#常見問題)
9. [故障排除](#故障排除)

---

## 🔑 為什麼需要 API Token

Cloudflare API Token 是用於自動化部署的**安全認證方式**，它允許 Terraform 在您的 Cloudflare 帳戶中建立和管理資源，而**無需手動登入**。

### 使用 API Token 的優勢

✅ **安全性高**：可以精確控制權限範圍
✅ **可撤銷**：隨時可以撤銷而不影響其他服務
✅ **自動化友好**：適合 CI/CD 和腳本化部署
✅ **無需互動**：不需要瀏覽器登入

---

## 🔐 API Token vs Global API Key

### 比較表

| 特性 | API Token（推薦） | Global API Key（不推薦） |
|------|------------------|------------------------|
| **安全性** | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **權限控制** | 精細控制 | 完全訪問 |
| **可撤銷性** | ✅ 隨時撤銷 | ❌ 撤銷影響所有服務 |
| **到期時間** | 可設置 | 永不過期 |
| **最佳實踐** | ✅ Cloudflare 官方推薦 | ⚠️ 不建議使用 |

**⚠️ 重要**：本指南只使用 **API Token**，不使用 Global API Key。

---

## 📝 建立 API Token 詳細步驟

### 第 1 步：登入 Cloudflare Dashboard

1. 訪問 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 使用您的帳號登入

### 第 2 步：進入 API Token 管理頁面

1. 點擊右上角的**頭像圖示**
2. 選擇 **我的個人資料**（My Profile）
3. 在左側選單選擇 **API 權杖**（API Tokens）

**頁面路徑**：
```
頭像 → 我的個人資料 → API 權杖
```

### 第 3 步：建立新的 API Token

1. 點擊 **建立權杖**（Create Token）按鈕
2. 您會看到多個預設範本

### 第 4 步：選擇自訂範本

為了確保權限正確，我們**不使用**預設範本，而是：

1. 滑動到頁面底部
2. 找到 **建立自訂權杖**（Create Custom Token）
3. 點擊 **開始使用**（Get Started）

### 第 5 步：配置 Token 名稱

在 **Token 名稱**（Token name）欄位輸入：
```
Multi-Channel Platform Deployment
```

或任何您容易識別的名稱。

### 第 6 步：配置權限（最重要！）

#### 帳戶級別權限

在 **帳戶權限**（Account Permissions）區塊，新增以下權限：

| 權限類型 | 存取等級 |
|---------|---------|
| **Account Settings** | **Read** |
| **Workers Scripts** | **Edit** |
| **Workers KV Storage** | **Edit** |
| **Workers R2 Storage** | **Edit** |
| **D1** | **Edit** |
| **Pages** | **Edit** |
| **Durable Objects** | **Edit** |

**設置步驟**：
1. 點擊 **+ 新增更多**（+ Add more）
2. 從下拉選單選擇權限類型（例如：Account Settings）
3. 在右側選擇存取等級（Read 或 Edit）
4. 重複以上步驟，直到新增所有權限

#### 區域級別權限（僅在使用自訂域名時需要）

如果您計劃使用自己的域名（例如 `api.yourcompany.com`），需要新增：

在 **區域權限**（Zone Permissions）區塊：

| 權限類型 | 存取等級 |
|---------|---------|
| **Zone** | **Read** |
| **Zone Settings** | **Edit** |
| **DNS** | **Edit** |

#### 設置資源範圍

**重要選擇**：

##### 選項 1：所有帳戶資源（推薦新手）
- 選擇：**包含** → **所有帳戶**（All accounts）

這樣 Token 可以訪問您帳戶下的所有資源。

##### 選項 2：特定帳戶（推薦進階用戶）
- 選擇：**包含** → **特定帳戶**（Specific account）
- 從下拉選單選擇您的帳戶

### 第 7 步：設置 IP 限制（可選，但推薦）

如果您的部署環境有固定 IP，可以增加安全性：

1. 在 **Client IP Address Filtering** 區塊
2. 選擇 **Is in**
3. 輸入您的 IP 位址或 IP 範圍

**範例**：
- 單一 IP：`203.0.113.1`
- IP 範圍：`203.0.113.0/24`

**💡 提示**：如果您不確定，可以暫時跳過此步驟，但建議部署完成後回來設置。

### 第 8 步：設置 Token 有效期（可選）

**預設**：永不過期

**建議設置**：
- 對於生產環境：1 年
- 對於測試環境：30-90 天

在 **TTL（Time to Live）** 區塊：
1. 選擇 **結束日期**
2. 設置到期日期

### 第 9 步：檢視摘要並建立

1. 滑動到頁面底部
2. 檢查 **Token Summary** 確認所有權限正確
3. 點擊 **繼續以顯示摘要**（Continue to summary）
4. 最後點擊 **建立權杖**（Create Token）

### 第 10 步：複製並保存 Token

**⚠️ 超級重要**：Token 只會顯示**一次**！

1. 您會看到一個長字串，類似：
   ```
   3yJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ...
   ```
2. 點擊 **複製**（Copy）按鈕
3. **立即**將 Token 保存到安全的地方：
   - 密碼管理器（推薦：1Password、LastPass、Bitwarden）
   - 加密筆記應用
   - 環境變數檔案（`.env`）

**❌ 不要**：
- ❌ 將 Token 提交到 Git repository
- ❌ 在公開場所分享 Token
- ❌ 將 Token 保存在純文字檔案中

4. 完成後點擊 **完成**（Finished）

---

## ✅ 驗證 API Token

### 方法 1：使用 Cloudflare API

```bash
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer YOUR_API_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**成功的回應**：
```json
{
  "result": {
    "id": "ed17f6d0b7a942f4a3d9d7e7e7f1f83e",
    "status": "active"
  },
  "success": true,
  "errors": [],
  "messages": [
    {
      "code": 10000,
      "message": "This API Token is valid and active",
      "type": null
    }
  ]
}
```

**失敗的回應**：
```json
{
  "result": null,
  "success": false,
  "errors": [
    {
      "code": 6003,
      "message": "Invalid request headers"
    }
  ]
}
```

### 方法 2：使用 Wrangler CLI

```bash
# 設置環境變數
export CLOUDFLARE_API_TOKEN="YOUR_API_TOKEN_HERE"

# 驗證 Token
wrangler whoami
```

**成功的回應**：
```
 ⛅️ wrangler 4.x.x
───────────────────
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email your-email@example.com.
┌────────────────────────────────┬──────────────────────────────────┐
│ Account Name                   │ Account ID                       │
├────────────────────────────────┼──────────────────────────────────┤
│ Your Company Name              │ abc123def456...                  │
└────────────────────────────────┴──────────────────────────────────┘
```

---

## 🔧 設置環境變數

有了 API Token 後，需要將它設置為環境變數供 Terraform 使用。

### Windows PowerShell

#### 臨時設置（當前 session）

```powershell
$env:CLOUDFLARE_API_TOKEN="your-actual-token-here"
```

#### 永久設置（推薦）

```powershell
# 設置用戶級別環境變數
[System.Environment]::SetEnvironmentVariable(
    'CLOUDFLARE_API_TOKEN',
    'your-actual-token-here',
    'User'
)

# 重啟 PowerShell 或執行
$env:CLOUDFLARE_API_TOKEN = [System.Environment]::GetEnvironmentVariable('CLOUDFLARE_API_TOKEN', 'User')
```

#### 驗證設置

```powershell
echo $env:CLOUDFLARE_API_TOKEN
# 應顯示您的 Token
```

### macOS / Linux Bash

#### 臨時設置（當前 session）

```bash
export CLOUDFLARE_API_TOKEN="your-actual-token-here"
```

#### 永久設置（推薦）

```bash
# 加入到 ~/.bashrc（Bash）或 ~/.zshrc（Zsh）
echo 'export CLOUDFLARE_API_TOKEN="your-actual-token-here"' >> ~/.bashrc

# 重新載入設定
source ~/.bashrc
```

#### 驗證設置

```bash
echo $CLOUDFLARE_API_TOKEN
# 應顯示您的 Token
```

### 使用 .env 檔案（適用於本地開發）

**⚠️ 僅適用於本地開發，不要提交到 Git！**

1. 在專案根目錄建立 `.env` 檔案：
   ```bash
   CLOUDFLARE_API_TOKEN=your-actual-token-here
   ```

2. 確保 `.env` 已加入 `.gitignore`：
   ```bash
   # .gitignore
   .env
   .env.local
   ```

3. 在執行 Terraform 前載入：
   ```bash
   # Linux/macOS
   source .env

   # 或使用 direnv (需先安裝)
   direnv allow
   ```

---

## 🛡️ 權限說明

### 必需權限清單

| 權限 | 用途 | 為何需要 |
|------|------|---------|
| **Account Settings (Read)** | 讀取帳戶資訊 | 取得 Account ID，驗證帳戶狀態 |
| **Workers Scripts (Edit)** | 管理 Worker 腳本 | 部署和更新 API 後端 |
| **Workers KV Storage (Edit)** | 管理 KV 命名空間 | 建立 Session 和 Cache 儲存 |
| **Workers R2 Storage (Edit)** | 管理 R2 儲存桶 | 建立檔案附件儲存 |
| **D1 (Edit)** | 管理 D1 資料庫 | 建立和管理應用程式資料庫 |
| **Pages (Edit)** | 管理 Pages 專案 | 部署前端應用 |
| **Durable Objects (Edit)** | 管理 Durable Objects | 建立 WebSocket 連線管理 |

### 可選權限（僅在使用自訂域名時）

| 權限 | 用途 |
|------|------|
| **Zone (Read)** | 讀取網域資訊 |
| **Zone Settings (Edit)** | 配置網域設置 |
| **DNS (Edit)** | 管理 DNS 記錄 |

---

## 🔒 安全性最佳實踐

### ✅ 應該做的

1. **使用最小權限原則**
   - 只授予必要的權限
   - 避免使用 "All zones" 或 "All accounts" 除非真的需要

2. **設置 Token 到期時間**
   - 生產環境：6-12 個月
   - 開發環境：30-90 天
   - 定期輪換 Token

3. **使用 IP 限制**
   - 如果部署環境有固定 IP，設置 IP 白名單
   - 可以設置多個 IP 範圍

4. **安全儲存 Token**
   - 使用密碼管理器（1Password、LastPass）
   - 使用環境變數（不要硬編碼）
   - 使用加密的 Secrets 管理工具（HashiCorp Vault、AWS Secrets Manager）

5. **定期審查**
   - 每季度檢查 Token 使用情況
   - 刪除不再使用的 Token

6. **監控 Token 活動**
   - 在 Cloudflare Audit Logs 查看 API 活動
   - 設置異常活動警報

### ❌ 不應該做的

1. ❌ **不要將 Token 提交到 Git**
   ```bash
   # 確保 .gitignore 包含：
   .env
   .env.local
   terraform.tfvars
   ```

2. ❌ **不要在公開場所分享**
   - 不要貼到 Slack/Discord/論壇
   - 不要包含在螢幕截圖中

3. ❌ **不要使用 Global API Key**
   - Global API Key 有完全訪問權限
   - 無法細化權限控制

4. ❌ **不要重複使用相同 Token**
   - 不同專案/環境應使用不同 Token
   - 方便撤銷和管理

5. ❌ **不要在客戶端程式碼使用**
   - API Token 只應在後端/部署流程使用
   - 前端不應有任何 API Token

---

## ❓ 常見問題

### Q1: Token 建立後忘記複製怎麼辦？

**A:** Token 只顯示一次，無法再次查看。解決方案：
1. 刪除該 Token
2. 重新建立一個新的 Token
3. 這次記得複製並安全保存！

### Q2: 如何刪除或撤銷 Token？

**A:**
1. 登入 Cloudflare Dashboard
2. 前往：頭像 → 我的個人資料 → API 權杖
3. 找到要刪除的 Token
4. 點擊右側的 **刪除**（Delete）按鈕
5. 確認刪除

**影響**：該 Token 會立即失效，所有使用該 Token 的服務將無法訪問。

### Q3: Token 可以同時用於多個專案嗎？

**A:** 技術上可以，但**不建議**。

**推薦做法**：
- 每個專案/環境使用獨立的 Token
- 方便管理和撤銷
- 減少安全風險

### Q4: 忘記 Token 有哪些權限怎麼辦？

**A:**
1. 登入 Cloudflare Dashboard
2. 前往：頭像 → 我的個人資料 → API 權杖
3. 找到該 Token
4. 點擊 **編輯**（Edit）查看權限
5. 注意：編輯後需要重新生成 Token

### Q5: Token 到期後會發生什麼？

**A:**
- Token 會自動失效
- 所有使用該 Token 的部署會失敗
- Cloudflare 會在到期前 7 天發送提醒郵件

**解決方案**：
1. 建立新的 Token
2. 更新環境變數
3. 重新部署

### Q6: 如何檢查 Token 是否還有效？

**A:**
```bash
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

查看 `"status": "active"` 表示有效。

### Q7: 可以在 CI/CD 中使用 API Token 嗎？

**A:** 可以，這正是 API Token 的主要用途！

**最佳實踐**：
- 使用 CI/CD 平台的 Secrets 管理（GitHub Secrets、GitLab CI Variables）
- 設置 IP 限制為 CI/CD 伺服器 IP
- 使用較短的到期時間並定期輪換

---

## 🔧 故障排除

### 問題 1: "Authentication error" 或 "Invalid credentials"

**原因**：
- Token 錯誤或已失效
- 環境變數未設置
- Token 權限不足

**解決方案**：
```bash
# 驗證 Token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# 檢查環境變數
echo $CLOUDFLARE_API_TOKEN

# 如果為空，重新設置
export CLOUDFLARE_API_TOKEN="your-token"
```

### 問題 2: "Permission denied" 或 "Insufficient permissions"

**原因**：Token 缺少必要權限

**解決方案**：
1. 登入 Cloudflare Dashboard
2. 檢查 Token 權限
3. 確保包含本指南「必需權限清單」中的所有權限
4. 如需修改，須刪除舊 Token 並建立新的

### 問題 3: Terraform 無法讀取 Token

**原因**：環境變數設置方式錯誤

**解決方案**：

#### 方法 1：直接在命令列設置
```bash
CLOUDFLARE_API_TOKEN="your-token" terraform apply
```

#### 方法 2：檢查 Shell 類型
```bash
# 檢查當前 Shell
echo $SHELL

# 如果是 bash，編輯 ~/.bashrc
# 如果是 zsh，編輯 ~/.zshrc
# 如果是 fish，編輯 ~/.config/fish/config.fish
```

#### 方法 3：使用 Terraform 變數
```hcl
# terraform.tfvars
cloudflare_api_token = "your-token"
```

```hcl
# variables.tf
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

# main.tf
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
```

**⚠️ 注意**：方法 3 不推薦，因為 Token 會被寫入檔案。

### 問題 4: Token 在 Windows 無法使用

**原因**：PowerShell 環境變數設置問題

**解決方案**：
```powershell
# 方法 1：系統環境變數
[System.Environment]::SetEnvironmentVariable('CLOUDFLARE_API_TOKEN', 'your-token', 'User')

# 重啟 PowerShell
exit

# 方法 2：在每次使用前設置
$env:CLOUDFLARE_API_TOKEN="your-token"

# 驗證
$env:CLOUDFLARE_API_TOKEN
```

### 問題 5: API 請求被限流（Rate Limited）

**錯誤訊息**：
```
Error: API rate limit exceeded
```

**原因**：短時間內發送太多 API 請求

**解決方案**：
1. 等待 1-5 分鐘後重試
2. 如果經常遇到，考慮：
   - 減少 Terraform 並行度：`terraform apply -parallelism=1`
   - 聯繫 Cloudflare 提高限額（付費客戶）

---

## 📚 相關資源

- [Cloudflare API Token 官方文檔](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare API 參考](https://developers.cloudflare.com/api/)
- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [客戶部署指南](./CUSTOMER_DEPLOYMENT_GUIDE.md)

---

## 🎓 快速參考

### Token 建立檢查清單

- [ ] 登入 Cloudflare Dashboard
- [ ] 前往：頭像 → 我的個人資料 → API 權杖
- [ ] 點擊「建立權杖」
- [ ] 選擇「建立自訂權杖」
- [ ] 設置 Token 名稱
- [ ] 新增必需的帳戶權限（7 項）
- [ ] 如使用自訂域名，新增區域權限（3 項）
- [ ] 設置資源範圍（所有帳戶或特定帳戶）
- [ ] （可選）設置 IP 限制
- [ ] （可選）設置到期時間
- [ ] 檢視摘要確認
- [ ] 點擊「建立權杖」
- [ ] 複製 Token 並安全保存
- [ ] 設置環境變數
- [ ] 驗證 Token 有效性

### 權限快速複製

建立 Token 時需要的權限：

**帳戶權限**：
- Account Settings - Read
- Workers Scripts - Edit
- Workers KV Storage - Edit
- Workers R2 Storage - Edit
- D1 - Edit
- Pages - Edit
- Durable Objects - Edit

**區域權限**（僅自訂域名）：
- Zone - Read
- Zone Settings - Edit
- DNS - Edit

---

**完成設置後，請繼續參閱 [客戶部署指南](./CUSTOMER_DEPLOYMENT_GUIDE.md) 進行部署。** 🚀
