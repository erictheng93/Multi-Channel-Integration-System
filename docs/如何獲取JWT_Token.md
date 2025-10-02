# 如何獲取 JWT Token

> **測試協作功能和 API 的完整指南**
> 日期: 2025-10-02

---

## 📋 目錄

1. [快速獲取 Token](#快速獲取-token)
2. [方法詳解](#方法詳解)
3. [使用 Token 測試 API](#使用-token-測試-api)
4. [常見問題](#常見問題)

---

## 快速獲取 Token

### 方法 1: 使用現有管理員帳號（最簡單）

```bash
# 登入取得 token
curl -X POST https://multi-channel.imfinethankyouandyou.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dacit.net",
    "password": "YOUR_PASSWORD"
  }'

# 響應示例:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "admin-001",
      "email": "admin@dacit.net",
      "displayName": "System Administration",
      "role": "admin"
    }
  }
}
```

### 方法 2: 從前端應用取得

如果您已經在前端登入：

```javascript
// 方式 1: 從 localStorage 取得
const token = localStorage.getItem('auth_token');
console.log('Token:', token);

// 方式 2: 從 sessionStorage 取得
const token = sessionStorage.getItem('auth_token');
console.log('Token:', token);

// 方式 3: 從 Pinia store 取得
import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
console.log('Token:', authStore.token);
```

---

## 方法詳解

### 選項 1: 使用 curl 命令行

#### Step 1: 登入獲取 Token

```bash
# 使用管理員帳號登入
TOKEN=$(curl -s -X POST https://multi-channel.imfinethankyouandyou.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dacit.net","password":"YOUR_PASSWORD"}' \
  | jq -r '.data.token')

# 顯示 token
echo "Token: $TOKEN"
```

#### Step 2: 使用 Token 測試 API

```bash
# 測試協作健康端點（需要認證）
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/health

# 測試協作統計端點
curl -H "Authorization: Bearer $TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/stats
```

---

### 選項 2: 使用 PowerShell（Windows）

```powershell
# Step 1: 登入獲取 Token
$response = Invoke-RestMethod -Uri "https://multi-channel.imfinethankyouandyou.com/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"admin@dacit.net","password":"YOUR_PASSWORD"}'

$TOKEN = $response.data.token
Write-Host "Token: $TOKEN"

# Step 2: 測試 API
$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# 測試協作健康端點
Invoke-RestMethod -Uri "https://multi-channel.imfinethankyouandyou.com/api/collaboration/health" `
  -Headers $headers

# 測試協作統計
Invoke-RestMethod -Uri "https://multi-channel.imfinethankyouandyou.com/api/collaboration/stats" `
  -Headers $headers
```

---

### 選項 3: 使用瀏覽器開發者工具

#### Step 1: 打開前端應用並登入

1. 訪問：https://multi-channel.imfinethankyouandyou.com
2. 使用管理員帳號登入：
   - Email: `admin@dacit.net`
   - Password: （您的密碼）

#### Step 2: 打開開發者工具

1. 按 `F12` 或右鍵 → 檢查
2. 切換到 **Console (控制台)** 標籤

#### Step 3: 複製 Token

在控制台中執行以下任一命令：

```javascript
// 方法 1: 從 localStorage
copy(localStorage.getItem('auth_token'))

// 方法 2: 從 sessionStorage
copy(sessionStorage.getItem('auth_token'))

// 方法 3: 從 cookie
document.cookie.split(';').find(c => c.trim().startsWith('token='))

// 方法 4: 從請求攔截器
// 打開 Network 標籤，找到任意 API 請求
// 查看 Request Headers 中的 Authorization 欄位
```

Token 已自動複製到剪貼板！

---

### 選項 4: 創建測試用戶（開發環境）

如果您需要創建新的測試用戶：

```bash
# 使用 wrangler 執行 SQL
wrangler d1 execute multi-channel-platform --remote \
  --command "INSERT INTO agents (id, email, password_hash, display_name, role, team_id)
  VALUES (
    'test-admin-001',
    'test@example.com',
    '\$2a\$10\$your_bcrypt_hash_here',
    'Test Admin',
    'admin',
    1
  )"
```

---

## 使用 Token 測試 API

### 協作功能 API 測試

#### 1. 健康檢查（需認證）

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/health

# 預期響應:
{
  "success": true,
  "data": {
    "status": "healthy",
    "config": {
      "defaultProtocol": "websocket",
      "enableWebSocket": true
    },
    "availableProtocols": ["sse", "websocket"],
    "timestamp": "2025-10-02T10:00:00Z"
  }
}
```

#### 2. 協作統計

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/stats

# 預期響應:
{
  "success": true,
  "data": {
    "totalViewers": 10,
    "totalTyping": 2,
    "totalRooms": 5,
    "connectionsByProtocol": {
      "sse": 3,
      "websocket": 7,
      "http": 0
    }
  }
}
```

#### 3. 加入對話

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/conversations/123/join

# 預期響應:
{
  "success": true,
  "message": "Joined conversation successfully"
}
```

#### 4. 獲取對話狀態

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/conversations/123/state

# 預期響應:
{
  "success": true,
  "data": {
    "conversationId": 123,
    "viewers": [...],
    "typing": [...],
    "totalConnections": 2,
    "protocol": "websocket"
  }
}
```

#### 5. 發送輸入狀態

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId": 123, "status": "start"}' \
  https://multi-channel.imfinethankyouandyou.com/api/collaboration/typing

# 預期響應:
{
  "success": true,
  "message": "Typing start sent successfully"
}
```

---

### WebSocket 功能測試（無需認證）

這些端點不需要 token：

```bash
# 1. WebSocket 健康檢查
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/health

# 2. WebSocket 遷移狀態
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status

# 3. 就緒檢查
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/readiness

# 4. 存活檢查
curl https://multi-channel.imfinethankyouandyou.com/api/websocket/liveness
```

---

## 常見問題

### Q1: Token 過期了怎麼辦？

**症狀**:
```json
{
  "error": "Token expired",
  "statusCode": 401
}
```

**解決方法**:
重新登入獲取新的 token：

```bash
TOKEN=$(curl -s -X POST https://multi-channel.imfinethankyouandyou.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dacit.net","password":"YOUR_PASSWORD"}' \
  | jq -r '.data.token')
```

---

### Q2: Token 無效或格式錯誤

**症狀**:
```json
{
  "error": "Invalid token",
  "statusCode": 401
}
```

**檢查清單**:
1. ✅ Token 前面有 `Bearer ` 前綴
2. ✅ Token 完整無截斷
3. ✅ 沒有多餘的空格或換行

**正確格式**:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api-url
```

---

### Q3: 如何檢查 Token 內容？

使用 JWT 解碼工具：

```bash
# 方法 1: 使用 jq (需要安裝 jq)
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq

# 方法 2: 線上工具
# 訪問 https://jwt.io
# 貼上 token 即可查看內容
```

**Token Payload 示例**:
```json
{
  "userId": "admin-001",
  "email": "admin@dacit.net",
  "displayName": "System Administration",
  "role": "admin",
  "teamId": 1,
  "iat": 1727860800,
  "exp": 1727947200
}
```

---

### Q4: 忘記密碼怎麼辦？

**方法 1: 重設密碼（需要資料庫訪問權限）**

```bash
# 1. 生成新的密碼哈希
# 使用線上工具: https://bcrypt-generator.com/
# 或使用 Node.js:
node -e "console.log(require('bcryptjs').hashSync('new_password', 10))"

# 2. 更新資料庫
wrangler d1 execute multi-channel-platform --remote \
  --command "UPDATE agents SET password_hash = 'YOUR_NEW_HASH' WHERE email = 'admin@dacit.net'"
```

**方法 2: 聯繫管理員重設**

如果您不是管理員，請聯繫系統管理員重設密碼。

---

### Q5: 如何保存 Token 以便重複使用？

**Bash/Linux**:
```bash
# 保存到文件
echo $TOKEN > ~/.api_token

# 使用時讀取
TOKEN=$(cat ~/.api_token)
curl -H "Authorization: Bearer $TOKEN" https://api-url
```

**PowerShell**:
```powershell
# 保存到文件
$TOKEN | Out-File -FilePath "$env:USERPROFILE\.api_token"

# 使用時讀取
$TOKEN = Get-Content "$env:USERPROFILE\.api_token"
Invoke-RestMethod -Uri "https://api-url" -Headers @{"Authorization"="Bearer $TOKEN"}
```

**環境變數**:
```bash
# Linux/Mac
export API_TOKEN="your_token_here"
curl -H "Authorization: Bearer $API_TOKEN" https://api-url

# Windows PowerShell
$env:API_TOKEN = "your_token_here"
curl -H "Authorization: Bearer $env:API_TOKEN" https://api-url
```

---

## 快速參考腳本

### 完整測試腳本（Bash）

```bash
#!/bin/bash

# 配置
API_URL="https://multi-channel.imfinethankyouandyou.com"
EMAIL="admin@dacit.net"
PASSWORD="YOUR_PASSWORD"

# 1. 登入獲取 Token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo $LOGIN_RESPONSE | jq
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:50}..."

# 2. 測試協作健康端點
echo ""
echo "🏥 Testing collaboration health..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/collaboration/health" | jq

# 3. 測試協作統計
echo ""
echo "📊 Testing collaboration stats..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/collaboration/stats" | jq

# 4. 測試 WebSocket 健康（無需認證）
echo ""
echo "🔌 Testing WebSocket health..."
curl -s "$API_URL/api/websocket/health" | jq

echo ""
echo "✅ All tests completed!"
```

保存為 `test-api.sh`，然後執行：

```bash
chmod +x test-api.sh
./test-api.sh
```

---

### 完整測試腳本（PowerShell）

```powershell
# 配置
$API_URL = "https://multi-channel.imfinethankyouandyou.com"
$EMAIL = "admin@dacit.net"
$PASSWORD = "YOUR_PASSWORD"

# 1. 登入獲取 Token
Write-Host "🔐 Logging in..." -ForegroundColor Cyan
$loginBody = @{
    email = $EMAIL
    password = $PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/api/auth/login" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $loginBody

    $TOKEN = $loginResponse.data.token
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "Token: $($TOKEN.Substring(0, 50))..."
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# 2. 測試協作健康端點
Write-Host "`n🏥 Testing collaboration health..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/api/collaboration/health" -Headers $headers | ConvertTo-Json

# 3. 測試協作統計
Write-Host "`n📊 Testing collaboration stats..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/api/collaboration/stats" -Headers $headers | ConvertTo-Json

# 4. 測試 WebSocket 健康（無需認證）
Write-Host "`n🔌 Testing WebSocket health..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/api/websocket/health" | ConvertTo-Json

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
```

保存為 `test-api.ps1`，然後執行：

```powershell
.\test-api.ps1
```

---

## 總結

### 獲取 Token 的步驟

1. **使用管理員帳號登入**
   - Email: `admin@dacit.net`
   - Password: (您的密碼)

2. **從響應中提取 token**
   - 位置: `response.data.token`

3. **使用 token 測試 API**
   - Header: `Authorization: Bearer YOUR_TOKEN`

### 重要提醒

⚠️ **Token 安全**:
- 不要在公開場合分享 token
- Token 包含用戶身份信息
- 定期更新密碼和 token

⚠️ **Token 有效期**:
- 預設有效期: 24 小時
- 過期後需重新登入
- 建議使用 refresh token 機制（如已實現）

✅ **最佳實踐**:
- 使用環境變數存儲敏感信息
- 自動化腳本中使用 `.env` 文件
- 測試完成後清除本地 token

---

**文檔版本**: 1.0.0
**最後更新**: 2025-10-02
