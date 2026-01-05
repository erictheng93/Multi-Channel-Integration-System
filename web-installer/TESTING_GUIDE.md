# Web Installer - Phase 1 測試指南

## 🎯 測試目標

驗證 Phase 1 新增的配置欄位能夠正確：
1. 顯示在表單中
2. 收集用戶輸入
3. 執行驗證邏輯
4. 提交到後端
5. 生成正確的配置文件

## 🚀 啟動測試環境

### 1. 啟動後端服務

```bash
cd web-installer/backend
npm install  # 如果還沒安裝依賴
npm run dev  # 啟動 Wrangler 開發服務器
```

**預期輸出**:
```
✨ Wrangler dev server started
🌀 Running on http://localhost:8787
```

### 2. 啟動前端服務

```bash
cd web-installer/frontend
npm install  # 如果還沒安裝依賴
npm run dev  # 啟動 Vite 開發服務器
```

**預期輸出**:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## 🧪 測試場景

### 場景 1: 基本配置 (Step 1) 測試

#### 1.1 測試 R2 Public URL 欄位存在性

**步驟**:
1. 在瀏覽器打開 `http://localhost:5173`
2. 完成 OAuth 登錄（如果需要）
3. 進入配置表單的 Step 1

**檢查項目**:
- ✅ 看到「R2 Public URL (Optional but Recommended)」標籤
- ✅ 看到輸入框，placeholder 為 `https://files.yourdomain.com`
- ✅ 看到提示文字：「💡 Leave empty to use Cloudflare's default R2 public URL...」

#### 1.2 測試 R2 URL 驗證

**測試用例 A: 有效 URL**
```
輸入: https://files.example.com
預期: ✅ 無錯誤，可以進入下一步
```

**測試用例 B: 無效 URL (缺少協議)**
```
輸入: files.example.com
預期: ❌ 顯示錯誤「Please enter a valid URL (must start with http:// or https://)」
```

**測試用例 C: 空值 (可選欄位)**
```
輸入: (留空)
預期: ✅ 無錯誤，可以進入下一步
```

**測試用例 D: HTTP 協議**
```
輸入: http://localhost:8787/files
預期: ✅ 無錯誤（開發環境允許 HTTP）
```

### 場景 2: LINE OA 配置 (Step 2) 測試

#### 2.1 測試 LINE Bot ID 欄位

**步驟**:
1. 填寫 Step 1 基本信息
2. 點擊「Next →」進入 Step 2
3. **不要勾選** "Skip LINE configuration"

**檢查項目**:
- ✅ 看到「LINE Bot ID (Basic ID) *」標籤（有紅色星號表示必填）
- ✅ 看到輸入框，placeholder 為 `@110xsqef`
- ✅ 看到提示：「📌 Required for QR Code generation...」

**測試用例 A: 有效 Bot ID**
```
輸入: @testbot123
預期: ✅ 無錯誤
```

**測試用例 B: 無效格式 (缺少 @)**
```
輸入: testbot123
預期: ❌ 顯示錯誤「LINE Bot ID must start with @ and contain only lowercase letters and numbers」
```

**測試用例 C: 無效格式 (包含大寫字母)**
```
輸入: @TestBot
預期: ❌ 顯示錯誤（HTML5 pattern 驗證）
```

**測試用例 D: 空值 (必填欄位)**
```
輸入: (留空)
預期: ❌ 顯示錯誤「LINE Bot ID is required」
```

#### 2.2 測試 LINE LIFF ID 欄位

**檢查項目**:
- ✅ 看到「LINE LIFF ID (Optional)」標籤
- ✅ 看到輸入框，placeholder 為 `2008756115-vWtFyDMA`
- ✅ 看到提示：「💡 Create a LIFF app in...」

**測試用例 A: 有效 LIFF ID**
```
輸入: 2008756115-vWtFyDMA
預期: ✅ 無錯誤
```

**測試用例 B: 過短 LIFF ID**
```
輸入: 123
預期: ❌ 顯示錯誤「LIFF ID format appears invalid (should be at least 10 characters)」
```

**測試用例 C: 空值 (可選欄位)**
```
輸入: (留空)
預期: ✅ 無錯誤
```

#### 2.3 測試「Skip LINE configuration」功能

**步驟**:
1. 進入 Step 2
2. 填寫一些 LINE 欄位（Bot ID, LIFF ID, Token, Secret）
3. 勾選「Skip LINE configuration (configure later in settings)」

**預期行為**:
- ✅ 所有 LINE 欄位內容被清空
- ✅ 包括新增的 `lineBotId` 和 `lineLiffId`
- ✅ 所有錯誤訊息消失
- ✅ 可以直接進入下一步，不需要填寫 LINE 資訊

**步驟**:
4. 取消勾選「Skip LINE configuration」

**預期行為**:
- ✅ LINE 欄位恢復為必填狀態
- ✅ 如果留空會顯示驗證錯誤

### 場景 3: 完整表單提交測試

#### 3.1 提交完整配置

**測試數據**:
```
Step 1 - 基本配置:
  - Project Name: test-deployment-001
  - Admin Email: admin@example.com
  - Custom Domain: (留空)
  - R2 Public URL: https://files.test-example.com

Step 2 - LINE OA:
  - LINE Bot ID: @testbot001
  - LINE LIFF ID: 1234567890-abcdefgh
  - Channel Access Token: test_token_xxx
  - Channel Secret: abcdefghijklmnopqrstuvwxyz123456

Step 3 - Review:
  - 檢查所有配置顯示正確
  - 點擊「🚀 Start Deployment」
```

**預期行為**:
1. ✅ 表單驗證通過
2. ✅ 提交請求到後端
3. ✅ 後端 `ConfigGenerator` 收到完整配置
4. ✅ 生成的 `wrangler.toml` 包含：
   ```toml
   [vars]
   R2_PUBLIC_URL = "https://files.test-example.com"
   LINE_BOT_ID = "@testbot001"
   LINE_LIFF_ID = "1234567890-abcdefgh"
   ...
   ```
5. ✅ 前端環境變量包含：
   ```env
   VITE_STORAGE_PUBLIC_URL=https://files.test-example.com
   ```

#### 3.2 提交最小配置

**測試數據**:
```
Step 1:
  - Project Name: minimal-test
  - Admin Email: admin@example.com
  - Custom Domain: (留空)
  - R2 Public URL: (留空)

Step 2:
  - ✅ 勾選 "Skip LINE configuration"
```

**預期行為**:
1. ✅ 表單驗證通過
2. ✅ 提交請求成功
3. ✅ 生成的配置使用默認值：
   ```toml
   [vars]
   R2_PUBLIC_URL = "https://pub-<hash>.r2.dev"
   LINE_BOT_ID = ""
   LINE_LIFF_ID = ""
   ```

## 🔍 開發者工具檢查

### 檢查 Network 請求

1. 打開瀏覽器開發者工具（F12）
2. 切換到 Network 標籤
3. 提交表單
4. 檢查 POST `/deployment/start` 請求

**預期 Payload**:
```json
{
  "projectName": "test-deployment-001",
  "adminEmail": "admin@example.com",
  "customDomain": "",
  "accountId": "...",
  "oauthToken": "...",
  "backendUrl": "",
  "frontendUrl": "",
  "r2PublicUrl": "https://files.test-example.com",
  "lineBotId": "@testbot001",
  "lineLiffId": "1234567890-abcdefgh",
  "lineChannelAccessToken": "test_token_xxx",
  "lineChannelSecret": "abcdefghijklmnopqrstuvwxyz123456",
  "logLevel": "info"
}
```

### 檢查 Console 日誌

**預期看到**:
```
[Runtime Config] Configuration validated successfully
{
  env: 'development',
  backendUrl: 'http://localhost:8787',
  frontendUrl: 'http://localhost:5173'
}
```

## ✅ 測試完成檢查清單

### 前端 UI
- [ ] R2 Public URL 欄位正確顯示
- [ ] LINE Bot ID 欄位正確顯示
- [ ] LINE LIFF ID 欄位正確顯示
- [ ] 所有提示文字清晰易懂
- [ ] 輸入框 placeholder 正確

### 驗證邏輯
- [ ] R2 URL 格式驗證正常
- [ ] LINE Bot ID 格式驗證正常（必須以 @ 開頭）
- [ ] LINE LIFF ID 長度驗證正常（可選，但如果填寫則需>=10字符）
- [ ] Skip LINE 功能正確清空所有 LINE 欄位

### 數據提交
- [ ] 表單提交包含所有新欄位
- [ ] 空值正確處理為 `undefined`
- [ ] 後端正確接收所有配置

### 配置生成
- [ ] `ConfigGenerator.generateWranglerConfig()` 正確使用用戶配置
- [ ] `ConfigGenerator.generateFrontendEnv()` 正確生成環境變量
- [ ] 生成的配置不包含硬編碼的 `imfinethankyouandyou.com`

## 🐛 常見問題排查

### 問題 1: 新欄位沒有顯示

**檢查**:
1. 確認前端開發服務器已重啟
2. 清除瀏覽器緩存（Ctrl+Shift+R）
3. 檢查 Console 是否有 Vue 渲染錯誤

### 問題 2: 驗證邏輯不工作

**檢查**:
1. 在 `validateStep()` 函數中添加 `console.log(step, formData.value)`
2. 確認 `step === 0` 或 `step === 1` 正確觸發

### 問題 3: 提交後後端沒收到新欄位

**檢查**:
1. 在 `handleSubmit()` 中添加 `console.log(formData.value)`
2. 檢查 Network 標籤中的請求 Payload
3. 確認後端類型定義與前端一致

## 📊 測試報告模板

測試完成後，填寫以下報告：

```
# Phase 1 測試報告

測試日期: YYYY-MM-DD
測試人員: [Your Name]
環境:
  - 瀏覽器: Chrome/Firefox/Safari [Version]
  - 前端: http://localhost:5173
  - 後端: http://localhost:8787

## 測試結果

### 場景 1: 基本配置
- R2 Public URL 欄位: ✅ / ❌
- URL 驗證: ✅ / ❌

### 場景 2: LINE 配置
- LINE Bot ID 欄位: ✅ / ❌
- LINE LIFF ID 欄位: ✅ / ❌
- Bot ID 格式驗證: ✅ / ❌
- Skip 功能: ✅ / ❌

### 場景 3: 完整提交
- 完整配置提交: ✅ / ❌
- 最小配置提交: ✅ / ❌
- 後端配置生成: ✅ / ❌

## 發現的問題

1. [問題描述]
   - 重現步驟: ...
   - 預期: ...
   - 實際: ...

## 總體評價

[ ] 所有測試通過，可以進入下一階段
[ ] 部分測試失敗，需要修復
[ ] 重大問題，需要重新設計
```

---

**測試完成後，請執行**:
```bash
cd web-installer/backend
npm test  # 確保後端測試通過

cd ../frontend
npm run type-check  # 確保 TypeScript 類型檢查通過
```

**最後**:
- 提交所有修改到 Git
- 創建測試報告
- 進入 Phase 2 (UI/UX 優化) 或 Phase 3 (移除主項目硬編碼)
