# 🌐 curl 命令測試集合

這個文檔包含了所有 API 端點的 curl 測試命令，你可以直接在命令行中使用。

## 🔍 基礎測試

### 檢查服務狀態
```bash
# 根路由
curl http://localhost:8787/

# 健康檢查
curl http://localhost:8787/health

# API 資訊
curl http://localhost:8787/api
```

## 🔐 認證測試

### 用戶登入
```bash
# Admin 登入
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Agent 登入
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"agent1","password":"agent123"}'
```

### 獲取用戶資料
```bash
# 替換 YOUR_TOKEN 為實際的 JWT token
curl http://localhost:8787/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 用戶登出
```bash
curl -X POST http://localhost:8787/api/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Session-ID: dummy-session-id"
```

## 🏢 團隊管理測試

### 獲取團隊列表
```bash
curl http://localhost:8787/api/teams \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 創建團隊（僅 Admin）
```bash
curl -X POST http://localhost:8787/api/teams \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"測試團隊","description":"這是一個測試團隊"}'
```

### 獲取團隊詳情
```bash
# 替換 TEAM_ID 為實際的團隊 ID
curl http://localhost:8787/api/teams/TEAM_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 更新團隊（僅 Admin）
```bash
curl -X PUT http://localhost:8787/api/teams/TEAM_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"更新後的團隊名稱","description":"更新後的描述"}'
```

### 獲取團隊成員
```bash
curl http://localhost:8787/api/teams/TEAM_ID/members \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 獲取團隊統計
```bash
curl http://localhost:8787/api/teams/TEAM_ID/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 生成團隊 QR Code
```bash
curl -X POST http://localhost:8787/api/teams/TEAM_ID/qr-code \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 👥 用戶管理測試

### 創建新用戶（僅 Admin）
```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "email":"test@example.com",
    "password":"test123",
    "displayName":"測試用戶",
    "role":"agent",
    "teamId":1
  }'
```

## 🧪 完整測試流程

### 1. 檢查服務
```bash
echo "🔍 檢查服務狀態..."
curl -s http://localhost:8787/health | jq '.'
```

### 2. Admin 登入並獲取 Token
```bash
echo "🔐 Admin 登入..."
RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

echo $RESPONSE | jq '.'

# 提取 token（需要 jq 工具）
TOKEN=$(echo $RESPONSE | jq -r '.data.token')
echo "Token: $TOKEN"
```

### 3. 使用 Token 測試 API
```bash
echo "👤 獲取用戶資料..."
curl -s http://localhost:8787/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" | jq '.'

echo "🏢 獲取團隊列表..."
curl -s http://localhost:8787/api/teams \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 4. 創建團隊
```bash
echo "➕ 創建新團隊..."
curl -s -X POST http://localhost:8787/api/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"curl測試團隊","description":"通過curl創建的測試團隊"}' | jq '.'
```

## 🛠️ 測試腳本

### Windows PowerShell 腳本
```powershell
# test-api.ps1
$BASE_URL = "http://localhost:8787"

# 檢查服務
Write-Host "🔍 檢查服務狀態..." -ForegroundColor Green
$health = Invoke-RestMethod -Uri "$BASE_URL/health"
Write-Host "服務狀態: $($health.status)" -ForegroundColor Yellow

# 登入
Write-Host "🔐 嘗試登入..." -ForegroundColor Green
$loginData = @{
    username = "admin"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"

if ($loginResponse.success) {
    $token = $loginResponse.data.token
    Write-Host "✅ 登入成功!" -ForegroundColor Green
    Write-Host "用戶: $($loginResponse.data.user.displayName)" -ForegroundColor Yellow
    
    # 獲取團隊列表
    Write-Host "🏢 獲取團隊列表..." -ForegroundColor Green
    $headers = @{ Authorization = "Bearer $token" }
    $teams = Invoke-RestMethod -Uri "$BASE_URL/api/teams" -Headers $headers
    
    Write-Host "找到 $($teams.data.Count) 個團隊:" -ForegroundColor Yellow
    foreach ($team in $teams.data) {
        Write-Host "  - $($team.name) (ID: $($team.id))" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ 登入失敗: $($loginResponse.error)" -ForegroundColor Red
}
```

### Linux/Mac Bash 腳本
```bash
#!/bin/bash
# test-api.sh

BASE_URL="http://localhost:8787"

echo "🔍 檢查服務狀態..."
curl -s $BASE_URL/health | jq '.status'

echo "🔐 嘗試登入..."
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

if echo $RESPONSE | jq -e '.success' > /dev/null; then
    TOKEN=$(echo $RESPONSE | jq -r '.data.token')
    USER_NAME=$(echo $RESPONSE | jq -r '.data.user.displayName')
    
    echo "✅ 登入成功! 用戶: $USER_NAME"
    
    echo "🏢 獲取團隊列表..."
    curl -s $BASE_URL/api/teams \
      -H "Authorization: Bearer $TOKEN" | jq '.data[] | {id, name, description}'
else
    echo "❌ 登入失敗"
    echo $RESPONSE | jq '.error'
fi
```

## 📝 使用說明

1. **確保服務運行**: 在另一個終端運行 `npm run dev`
2. **安裝 jq**: 用於 JSON 格式化（可選）
   - Windows: `choco install jq`
   - Mac: `brew install jq`
   - Linux: `sudo apt-get install jq`
3. **替換變數**: 將 `YOUR_TOKEN` 和 `TEAM_ID` 替換為實際值
4. **權限測試**: 某些操作需要 admin 權限

## 🔧 故障排除

### 常見錯誤
- **連接失敗**: 確保開發服務器正在運行
- **401 未授權**: 檢查 JWT token 是否正確
- **403 禁止訪問**: 檢查用戶權限（admin vs agent）
- **400 錯誤請求**: 檢查請求格式和必需欄位

### 調試技巧
```bash
# 顯示詳細的 HTTP 資訊
curl -v http://localhost:8787/api/teams

# 只顯示 HTTP 狀態碼
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/health

# 格式化 JSON 輸出
curl -s http://localhost:8787/api | jq '.'
```