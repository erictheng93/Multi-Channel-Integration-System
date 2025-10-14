# API 端點修復驗證指南
# API Endpoint Fixes Verification Guide

## 📋 概述 (Overview)

本文檔提供三個關鍵 API 端點修復的驗證指南:

1. ✅ **QR 碼停用端點** - `PUT /api/teams/:id/qr-codes/:qrCodeId/deactivate`
2. ✅ **團隊成員詳情端點** - `GET /api/team/members/:id`
3. ✅ **前端邀請功能開關** - Client-side feature toggle

## 🔧 前置準備 (Prerequisites)

### 1. 獲取認證令牌 (Get Authentication Token)

```bash
# 方法 1: 從瀏覽器開發者工具獲取
# 1. 登入到 https://multi-channel.imfinethankyouandyou.com
# 2. 打開開發者工具 (F12)
# 3. 進入 Console tab
# 4. 執行: localStorage.getItem('auth_token')

# 方法 2: 使用 API 登入
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "loginId": "admin-001",
    "password": "your-password"
  }'
```

### 2. 設定環境變數 (Set Environment Variables)

```bash
# Windows PowerShell
$env:API_URL="https://multi-channel.imfinethankyouandyou.com/api"
$env:TEST_AUTH_TOKEN="your-jwt-token-here"

# Linux/Mac
export API_URL="https://multi-channel.imfinethankyouandyou.com/api"
export TEST_AUTH_TOKEN="your-jwt-token-here"
```

---

## ✅ 驗證 1: QR 碼停用端點
## Verification 1: QR Code Deactivation Endpoint

### 📍 端點資訊 (Endpoint Information)

- **路徑**: `PUT /api/teams/:id/qr-codes/:qrCodeId/deactivate`
- **認證**: Required (JWT Bearer Token)
- **實現位置**: `src/modules/teams/handlers/team.ts:544-573`
- **服務層**: `src/modules/teams/services/qr-service.ts:66-78`

### 🧪 測試步驟 (Test Steps)

#### Step 1: 創建測試 QR 碼

```bash
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/teams/1/qr-code \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaignName": "Verification Test Campaign",
    "description": "Test QR code for endpoint verification",
    "maxUses": 100
  }'
```

**預期響應**:
```json
{
  "success": true,
  "data": {
    "id": "qr-code-uuid",
    "qrCode": "https://api.qrserver.com/v1/create-qr-code/...",
    "lineUrl": "https://line.me/R/ti/p/...",
    "token": "qr-token-string",
    "campaignName": "Verification Test Campaign",
    "usageCount": 0,
    "maxUses": 100
  },
  "timestamp": "2025-10-14T..."
}
```

#### Step 2: 停用 QR 碼

```bash
# 使用 Step 1 獲得的 QR Code ID
QR_CODE_ID="qr-code-uuid-from-step-1"

curl -X PUT https://multi-channel.imfinethankyouandyou.com/api/teams/1/qr-codes/$QR_CODE_ID/deactivate \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**:
```json
{
  "success": true,
  "message": "QR code deactivated successfully",
  "timestamp": "2025-10-14T..."
}
```

#### Step 3: 驗證 QR 碼已停用

```bash
curl -X GET https://multi-channel.imfinethankyouandyou.com/api/teams/1/qr-codes \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN"
```

**驗證點**:
- ✅ 回應中應包含剛才創建的 QR 碼
- ✅ 該 QR 碼的 `isActive` 欄位應為 `false`
- ✅ 其他欄位 (id, campaignName, usageCount 等) 應保持不變

### 🔍 錯誤情況測試 (Error Case Testing)

#### 測試 1: 未提供認證令牌

```bash
curl -X PUT https://multi-channel.imfinethankyouandyou.com/api/teams/1/qr-codes/test-id/deactivate \
  -H "Content-Type: application/json"
```

**預期響應**: `401 Unauthorized`

#### 測試 2: 無效的團隊 ID

```bash
curl -X PUT https://multi-channel.imfinethankyouandyou.com/api/teams/invalid/qr-codes/test-id/deactivate \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**: `400 Bad Request` with error message "Invalid team ID"

#### 測試 3: 不存在的 QR 碼 ID

```bash
curl -X PUT https://multi-channel.imfinethankyouandyou.com/api/teams/1/qr-codes/non-existent-id/deactivate \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**: `404 Not Found` or `500 Internal Server Error` with error message

---

## ✅ 驗證 2: 團隊成員詳情端點
## Verification 2: Team Member Details Endpoint

### 📍 端點資訊 (Endpoint Information)

- **路徑**: `GET /api/team/members/:id`
- **認證**: Required (JWT Bearer Token)
- **實現位置**: `src/index.ts:573-610`
- **返回欄位**: id, loginId, email, name, role, teamId, status, isActive, createdAt, lastActive

### 🧪 測試步驟 (Test Steps)

#### Step 1: 獲取成員詳情

```bash
# 使用已知的成員 ID (例如當前登入用戶)
MEMBER_ID="admin-001"

curl -X GET https://multi-channel.imfinethankyouandyou.com/api/team/members/$MEMBER_ID \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**:
```json
{
  "success": true,
  "data": {
    "id": "admin-001",
    "loginId": "System Administration",
    "email": "admin@dacit.net",
    "name": "System Administration",
    "role": "admin",
    "teamId": 1,
    "status": "active",
    "isActive": true,
    "createdAt": "2025-01-20T...",
    "lastActive": "2025-10-14T..."
  },
  "message": "Member retrieved successfully"
}
```

#### Step 2: 驗證欄位完整性

**驗證點**:
- ✅ `id` 欄位存在且與請求的 ID 一致
- ✅ `loginId` 欄位存在 (映射自 displayName)
- ✅ `email` 欄位存在
- ✅ `name` 欄位存在 (映射自 displayName)
- ✅ `role` 欄位為 'admin', 'team', 或 'agent' 之一
- ✅ `teamId` 欄位存在且為數字
- ✅ `status` 欄位為 'active' 或 'inactive'
- ✅ `isActive` 欄位為布林值,且與 status 一致
- ✅ `createdAt` 欄位為有效的 ISO 8601 日期格式
- ✅ `lastActive` 欄位存在 (可能為 null)

#### Step 3: 驗證狀態映射邏輯

```bash
# 檢查狀態映射是否正確
# status === 'active' 應對應 isActive === true
# status === 'inactive' 應對應 isActive === false

# 使用 jq 工具解析 (可選)
curl -X GET https://multi-channel.imfinethankyouandyou.com/api/team/members/$MEMBER_ID \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  | jq '{status: .data.status, isActive: .data.isActive}'
```

### 🔍 錯誤情況測試 (Error Case Testing)

#### 測試 1: 未提供認證令牌

```bash
curl -X GET https://multi-channel.imfinethankyouandyou.com/api/team/members/admin-001 \
  -H "Content-Type: application/json"
```

**預期響應**: `401 Unauthorized`

#### 測試 2: 不存在的成員 ID

```bash
curl -X GET https://multi-channel.imfinethankyouandyou.com/api/team/members/non-existent-member \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**預期響應**: `404 Not Found`
```json
{
  "success": false,
  "error": "Member not found"
}
```

---

## ✅ 驗證 3: 前端邀請功能開關
## Verification 3: Frontend Invitation Feature Toggle

### 📍 功能資訊 (Feature Information)

- **實現位置**: `frontend/src/api/team.ts:14-18`
- **環境變數**: `VITE_ENABLE_INVITATION`
- **預設值**: `false` (功能已停用)

### 🧪 驗證步驟 (Verification Steps)

#### Step 1: 檢查前端程式碼

```bash
# 查看邀請功能開關實現
cat frontend/src/api/team.ts | grep -A 5 "isInvitationEnabled"
```

**預期結果**:
```typescript
isInvitationEnabled: (): boolean => {
  // 從環境變數檢查是否啟用邀請功能
  // 預設為 false，因為後端已禁用此功能
  return import.meta.env.VITE_ENABLE_INVITATION === 'true' || false
},
```

#### Step 2: 驗證邀請相關方法已加入檢查

需檢查以下方法是否都包含 `isInvitationEnabled()` 檢查:

1. ✅ `inviteMember` (line 44-52)
2. ✅ `resendInvitation` (line 55-63)
3. ✅ `cancelInvitation` (line 66-74)
4. ✅ `acceptInvitation` (line 137-147)
5. ✅ `declineInvitation` (line 150-158)
6. ✅ `validateInvitation` (line 171-178)
7. ✅ `generateQRInvite` (line 190-197)

#### Step 3: 測試邀請功能端點已停用

```bash
# 測試 1: 邀請成員端點
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/teams/invite \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "agent"
  }'

# 測試 2: 重發邀請端點
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/team/invitations/test-id/resend \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN"

# 測試 3: 取消邀請端點
curl -X DELETE https://multi-channel.imfinethankyouandyou.com/api/team/invitations/test-id \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN"

# 測試 4: QR 碼邀請端點
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/teams/qr-invite \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "agent"
  }'
```

**預期響應** (所有端點):
- 狀態碼: `404 Not Found` 或 `500 Internal Server Error`
- 原因: 後端已完全停用邀請功能端點

#### Step 4: 前端 UI 驗證 (可選)

如果有前端開發環境:

1. 打開團隊管理頁面
2. 檢查是否隱藏了「邀請成員」相關按鈕
3. 如果嘗試觸發邀請功能,應看到錯誤訊息: "邀請功能暫時不可用,請使用直接添加成員功能"

---

## 🏃 自動化測試執行
## Automated Test Execution

### 使用 Vitest 執行測試套件

```bash
# 安裝依賴 (如果尚未安裝)
npm install

# 設定環境變數
export API_URL="https://multi-channel.imfinethankyouandyou.com/api"
export TEST_AUTH_TOKEN="your-jwt-token-here"

# 執行測試
npm run test -- tests/api-endpoint-fixes-verification.test.ts

# 執行測試並顯示詳細輸出
npm run test -- tests/api-endpoint-fixes-verification.test.ts --reporter=verbose

# 執行測試並生成覆蓋率報告
npm run test:coverage -- tests/api-endpoint-fixes-verification.test.ts
```

### 測試套件統計

- **總測試數**: 30 個測試
- **測試分類**:
  1. QR 碼停用端點測試 (7 tests)
  2. 團隊成員詳情端點測試 (5 tests)
  3. 前端邀請功能開關測試 (5 tests)
  4. 整合測試 (3 tests)
  5. 錯誤處理和邊緣案例測試 (3 tests)

---

## 📊 驗證檢查清單
## Verification Checklist

### QR 碼停用端點

- [ ] ✅ 可成功創建 QR 碼
- [ ] ✅ 可成功停用 QR 碼
- [ ] ✅ 停用後 `isActive` 欄位為 `false`
- [ ] ✅ 未認證請求返回 401
- [ ] ✅ 無效團隊 ID 返回 400
- [ ] ✅ 不存在的 QR 碼返回錯誤
- [ ] ✅ 響應包含正確的時間戳

### 團隊成員詳情端點

- [ ] ✅ 可成功獲取成員詳情
- [ ] ✅ 返回所有必需欄位
- [ ] ✅ `status` 與 `isActive` 映射正確
- [ ] ✅ `role` 為有效值 (admin/team/agent)
- [ ] ✅ 未認證請求返回 401
- [ ] ✅ 不存在的成員返回 404
- [ ] ✅ 日期格式為 ISO 8601

### 前端邀請功能開關

- [ ] ✅ `isInvitationEnabled()` 方法存在
- [ ] ✅ 預設返回 `false`
- [ ] ✅ 所有邀請方法包含功能檢查
- [ ] ✅ 功能停用時返回描述性錯誤
- [ ] ✅ 後端邀請端點已停用 (返回 404)
- [ ] ✅ 前端 UI 隱藏邀請功能 (可選)

---

## 🐛 常見問題排查
## Troubleshooting

### 問題 1: 401 Unauthorized 錯誤

**原因**: 認證令牌無效或已過期

**解決方案**:
```bash
# 重新登入獲取新令牌
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "loginId": "admin-001",
    "password": "your-password"
  }'

# 更新環境變數
export TEST_AUTH_TOKEN="new-token-here"
```

### 問題 2: CORS 錯誤

**原因**: 跨域請求被阻擋

**解決方案**:
- 使用 curl 命令而非瀏覽器測試
- 或確保請求來源在允許列表中 (見 `src/config/cors.ts`)

### 問題 3: QR 碼創建失敗

**原因**: 團隊 ID 無效或無權限

**解決方案**:
```bash
# 檢查當前用戶的團隊 ID
curl -X GET https://multi-channel.imfinethankyouandyou.com/api/team/members/admin-001 \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  | jq '.data.teamId'

# 使用正確的團隊 ID 創建 QR 碼
```

---

## 📝 測試報告範本
## Test Report Template

```markdown
# API 端點修復驗證報告
Date: YYYY-MM-DD
Tester: [Your Name]
Environment: Production / Staging

## 測試結果總覽

- QR 碼停用端點: ✅ PASS / ❌ FAIL
- 團隊成員詳情端點: ✅ PASS / ❌ FAIL
- 前端邀請功能開關: ✅ PASS / ❌ FAIL

## 詳細測試結果

### 1. QR 碼停用端點
- [✅/❌] 創建 QR 碼成功
- [✅/❌] 停用 QR 碼成功
- [✅/❌] 驗證停用狀態正確
- [✅/❌] 錯誤處理正確

### 2. 團隊成員詳情端點
- [✅/❌] 獲取成員詳情成功
- [✅/❌] 欄位完整性驗證通過
- [✅/❌] 狀態映射正確
- [✅/❌] 錯誤處理正確

### 3. 前端邀請功能開關
- [✅/❌] 功能開關實現正確
- [✅/❌] 所有邀請方法已受保護
- [✅/❌] 後端端點已停用
- [✅/❌] 錯誤訊息清晰

## 發現的問題

[列出任何發現的問題]

## 建議

[列出任何改進建議]
```

---

## 🔗 相關文件
## Related Documentation

- [API 端點對照表](../API_ENDPOINT_COMPARISON.md)
- [團隊管理 API 文檔](../api/TEAM_MANAGEMENT_API.md)
- [QR 碼服務實現](../../src/modules/teams/services/qr-service.ts)
- [團隊處理器實現](../../src/modules/teams/handlers/team.ts)
- [前端團隊 API 客戶端](../../frontend/src/api/team.ts)

---

## ✅ 驗證完成標準
## Verification Completion Criteria

驗證視為完成當以下所有條件都滿足:

1. ✅ 所有 30 個自動化測試通過
2. ✅ 所有手動測試檢查清單項目完成
3. ✅ 所有錯誤情況正確處理
4. ✅ CORS 標頭正確設置
5. ✅ 響應時間戳格式一致
6. ✅ 無控制台錯誤或警告
7. ✅ 測試報告已填寫並歸檔

---

**最後更新**: 2025-10-14
**版本**: 1.0.0
**狀態**: ✅ 準備驗證
