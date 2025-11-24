# 部署檢查清單

這份檢查清單幫助您確保部署過程的每個步驟都正確完成。請在完成每項後打勾 ✅。

---

## 📦 部署前準備（必須完成）

### 工具安裝

- [ ] **Node.js >= 18** 已安裝
  ```bash
  node --version  # 應顯示 v18.x.x 或更高
  ```

- [ ] **npm** 已安裝
  ```bash
  npm --version
  ```

- [ ] **Terraform >= 1.0** 已安裝
  ```bash
  terraform --version
  ```

- [ ] **Wrangler CLI** 已安裝
  ```bash
  wrangler --version  # 應顯示 4.x.x
  ```

### Cloudflare 帳戶設置

- [ ] **Cloudflare 帳號**已創建並登入
- [ ] **Account ID** 已獲取（在 Dashboard 右側欄）
- [ ] **API Token** 已創建（參考 [API Token 設置指南](./API_TOKEN_SETUP_GUIDE.md)）
- [ ] API Token **權限**包含：
  - [ ] Account Settings (Read)
  - [ ] Workers Scripts (Edit)
  - [ ] Workers KV Storage (Edit)
  - [ ] Workers R2 Storage (Edit)
  - [ ] D1 (Edit)
  - [ ] Pages (Edit)
  - [ ] Durable Objects (Edit)

### LINE 整合設置

- [ ] **LINE Official Account** 已創建
- [ ] **LINE Channel Access Token** 已獲取
- [ ] **LINE Channel Secret** 已獲取
- [ ] LINE Messaging API 已啟用

### 專案檔案

- [ ] 專案檔案已解壓或 clone
- [ ] 進入專案根目錄
  ```bash
  cd multi-channel-platform
  ```

### 配置檔案

- [ ] `terraform.tfvars` 已從範例複製
  ```bash
  cp terraform.tfvars.example terraform.tfvars
  ```

- [ ] `terraform.tfvars` 已編輯並填入實際值：
  - [ ] `cloudflare_account_id`
  - [ ] `admin_email`
  - [ ] `admin_password`（至少 8 個字元）
  - [ ] `line_channel_access_token`
  - [ ] `line_channel_secret`
  - [ ] （可選）`custom_domain`
  - [ ] （可選）`frontend_custom_domain`
  - [ ] （可選）`zone_id`（如使用自訂域名）

### 環境變數

- [ ] `CLOUDFLARE_API_TOKEN` 環境變數已設置
  ```bash
  # Windows PowerShell
  echo $env:CLOUDFLARE_API_TOKEN

  # macOS/Linux
  echo $CLOUDFLARE_API_TOKEN
  ```

- [ ] API Token 已驗證
  ```bash
  wrangler whoami
  ```

---

## 🔨 建置步驟

- [ ] 後端依賴已安裝
  ```bash
  npm install
  ```

- [ ] 前端依賴已安裝
  ```bash
  cd frontend && npm install && cd ..
  ```

- [ ] TypeScript 編譯檢查通過
  ```bash
  npm run build
  ```

- [ ] Worker 已建置
  ```bash
  npx wrangler deploy --dry-run --outdir=dist
  ```

- [ ] 前端已建置
  ```bash
  cd frontend && npm run build && cd ..
  ```

- [ ] `dist/index.js` 檔案存在
  ```bash
  # Windows
  dir dist\index.js

  # macOS/Linux
  ls -la dist/index.js
  ```

- [ ] `frontend/dist` 目錄存在
  ```bash
  # Windows
  dir frontend\dist

  # macOS/Linux
  ls -la frontend/dist
  ```

**💡 提示**：或使用自動化腳本：
```bash
# Windows
.\scripts\pre-deployment-build.ps1

# macOS/Linux
./scripts/pre-deployment-build.sh
```

---

## 🚀 Terraform 部署

### 初始化

- [ ] Terraform 已初始化
  ```bash
  terraform init
  ```

- [ ] 初始化成功（應看到 "Terraform has been successfully initialized!"）

### 規劃

- [ ] Terraform plan 已執行
  ```bash
  terraform plan
  ```

- [ ] Plan 輸出已檢查，確認將建立以下資源：
  - [ ] D1 Database
  - [ ] R2 Bucket
  - [ ] KV Namespaces (2 個)
  - [ ] Worker Script
  - [ ] Durable Objects Bindings (7 個)
  - [ ] Pages Project
  - [ ] （可選）Custom Domains

- [ ] 沒有意外的 "destroy" 或 "replace" 操作

### 應用

- [ ] Terraform apply 已執行
  ```bash
  terraform apply
  ```

- [ ] 輸入 `yes` 確認部署

- [ ] 部署成功（應看到 "Apply complete!"）

- [ ] 記錄部署輸出
  ```bash
  terraform output > deployment-info.txt
  ```

---

## 📝 部署後配置

### 獲取部署資訊

- [ ] 已記錄以下資訊（從 `terraform output` 獲得）：
  - [ ] `api_url`
  - [ ] `frontend_url`
  - [ ] `line_webhook_url`
  - [ ] `admin_email`
  - [ ] `database_id`
  - [ ] `database_name`

### LINE Webhook 設置

- [ ] 登入 [LINE Developers Console](https://developers.line.biz/console/)
- [ ] 選擇 Provider 和 Channel
- [ ] 進入 **Messaging API** 標籤
- [ ] 設置 Webhook URL（從 `line_webhook_url` 獲得）
- [ ] 點擊 **Update**
- [ ] 開啟 **Use webhook** 開關
- [ ] 點擊 **Verify** 驗證（應顯示成功）
- [ ] 關閉 **Auto-reply messages**
- [ ] （可選）關閉 **Greeting messages**

### 資料庫驗證

- [ ] 資料庫已成功初始化
  ```bash
  wrangler d1 execute <database_name> --remote \
    --command="SELECT COUNT(*) FROM users"
  ```
  應返回至少 1（管理員帳戶）

### 管理後台登入

- [ ] 訪問管理後台：`<api_url>/admin-dashboard.html`
- [ ] 使用 `admin_email` 和 `admin_password` 登入
- [ ] 登入成功
- [ ] （建議）修改管理員密碼
- [ ] （建議）建立其他管理員或客服帳號

### 前端應用訪問

- [ ] 訪問前端應用：`<frontend_url>`
- [ ] 登入頁面顯示正常
- [ ] 使用管理員帳號登入
- [ ] 登入成功，儀表板顯示正常

---

## ✅ 功能驗證

### 基本功能測試

- [ ] **API 健康檢查**
  ```bash
  curl <api_url>/api/system/health
  ```
  應返回 `{"status":"healthy",...}`

- [ ] **前端載入正常**
  - [ ] 無 JavaScript 錯誤（開啟瀏覽器 DevTools → Console）
  - [ ] 無網路錯誤（DevTools → Network）

### LINE Bot 測試

- [ ] 在 LINE App 加入 Official Account 好友
- [ ] 傳送測試訊息給 Bot
- [ ] 訊息出現在管理後台「對話列表」
- [ ] 在管理後台回覆訊息
- [ ] LINE 端收到回覆
- [ ] 訊息歷史記錄正確

### 進階功能測試（可選）

- [ ] **檔案上傳**
  - [ ] 在對話中傳送圖片
  - [ ] 圖片正確顯示
  - [ ] 圖片可以下載

- [ ] **即時通知**
  - [ ] 新訊息到達時前端自動更新
  - [ ] 不需要重新整理頁面

- [ ] **標籤功能**
  - [ ] 可以為對話新增標籤
  - [ ] 可以按標籤篩選對話

- [ ] **搜尋功能**
  - [ ] 可以搜尋對話
  - [ ] 搜尋結果正確

---

## 🔒 安全性檢查

- [ ] **API Token 安全**
  - [ ] Token 未提交到 Git repository
  - [ ] Token 已安全保存（密碼管理器）
  - [ ] 環境變數已正確設置

- [ ] **管理員密碼**
  - [ ] 密碼強度足夠（至少 8 個字元，包含大小寫字母和數字）
  - [ ] 密碼未分享給無關人員

- [ ] **Cloudflare Dashboard**
  - [ ] 已啟用 Two-Factor Authentication (2FA)
  - [ ] 定期檢查 Audit Logs

- [ ] **LINE Channel**
  - [ ] Channel Access Token 和 Secret 已安全保存
  - [ ] 未分享給無關人員

---

## 📊 監控設置（建議）

- [ ] **Cloudflare Analytics**
  - [ ] 瀏覽 Workers Analytics
  - [ ] 設置使用量警報

- [ ] **日誌監控**
  ```bash
  wrangler tail <worker_name>
  ```

- [ ] **健康檢查腳本**（設置定時任務）
  ```bash
  # Linux/macOS crontab
  */5 * * * * curl -f <api_url>/api/system/health || echo "Health check failed"
  ```

---

## 📚 文檔歸檔

- [ ] 部署資訊已記錄（`terraform output`）
- [ ] API URLs 已記錄
- [ ] Webhook URLs 已記錄
- [ ] 管理員帳號資訊已安全保存
- [ ] Cloudflare Account ID 已記錄
- [ ] Database ID 已記錄

---

## 🎓 培訓與交接

- [ ] 管理員已接受培訓：
  - [ ] 如何登入管理後台
  - [ ] 如何查看和回覆訊息
  - [ ] 如何管理客服人員帳號
  - [ ] 如何使用標籤和搜尋功能

- [ ] 技術人員已接受培訓：
  - [ ] 如何更新系統
  - [ ] 如何查看日誌
  - [ ] 如何處理常見問題

- [ ] 文檔已交付：
  - [ ] [客戶部署指南](./CUSTOMER_DEPLOYMENT_GUIDE.md)
  - [ ] [API Token 設置指南](./API_TOKEN_SETUP_GUIDE.md)
  - [ ] 本檢查清單

---

## 🎉 部署完成

恭喜！如果以上所有項目都已完成，您的多渠道客服系統已成功部署並可以投入使用。

### 後續步驟

1. **監控系統運行**
   - 前 7 天密切監控
   - 檢查錯誤日誌
   - 收集使用者回饋

2. **優化配置**
   - 根據實際使用量調整資源
   - 優化 Worker 性能設置

3. **定期維護**
   - 每月檢查系統更新
   - 每季度輪換 API Token
   - 定期備份資料庫

4. **擴展功能**
   - 考慮整合 Facebook Messenger
   - 開發自訂功能

### 支援聯繫

如遇問題，請參考：
- [客戶部署指南](./CUSTOMER_DEPLOYMENT_GUIDE.md) - 常見問題
- [API Token 設置指南](./API_TOKEN_SETUP_GUIDE.md) - Token 相關問題
- 技術支援：support@yourcompany.com

---

**部署日期**：_____________

**部署人員**：_____________

**驗證人員**：_____________

**簽名**：_____________
