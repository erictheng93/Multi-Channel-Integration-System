# 獲取管理員 Token 指南

**目的**: 獲取有效的管理員 JWT token 以執行 WebSocket Rollout 升級

---

## 方法 1: 從瀏覽器獲取 (推薦)

### 步驟:

1. **開啟生產環境網站**
   ```
   https://multi-channel.imfinethankyouandyou.com
   ```

2. **使用管理員帳號登入**
   - Email: `admin@dacit.net` (或您的管理員帳號)
   - Password: [您的密碼]

3. **開啟 DevTools**
   - 按 `F12` 或右鍵 → 檢查

4. **獲取 Token**
   - 切換到 **Application** 標籤
   - 左側選擇 **Local Storage** → `https://multi-channel.imfinethankyouandyou.com`
   - 找到 key: `auth_token`
   - 複製 value (長字串，格式: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

5. **設置環境變數**
   ```powershell
   # PowerShell (Windows)
   $env:ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

   # 或使用 Bash (Git Bash / WSL)
   export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

---

## 方法 2: 使用 API 登入

### 使用 curl 登入:

```bash
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dacit.net",
    "password": "您的密碼"
  }'
```

### 預期響應:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin-001",
    "email": "admin@dacit.net",
    "role": "admin",
    "displayName": "System Administration"
  }
}
```

### 設置 Token:

```powershell
# 從響應中複製 token 值
$env:ADMIN_TOKEN = "從上面響應中的token值"
```

---

## 執行遷移腳本

獲取 Token 後，運行自動化遷移腳本:

```bash
# 檢查 token 是否設置
echo $env:ADMIN_TOKEN  # PowerShell
echo $ADMIN_TOKEN      # Bash

# 執行遷移 (Bash)
bash scripts/migrate-to-100-percent.sh

# 或手動執行 (PowerShell)
pwsh scripts/migrate-to-100-percent.ps1  # 如果有 PowerShell 版本
```

---

## 手動升級步驟 (如果腳本無法運行)

### Step 1: 升級到 75%

```powershell
$TOKEN = $env:ADMIN_TOKEN

curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"rolloutPercentage": 75}'
```

### Step 2: 驗證 75% 狀態

```bash
curl "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status"
```

預期: `"rolloutPercentage": 75`

### Step 3: 監控 2-4 小時

```bash
# 每 30 分鐘檢查一次健康狀態
curl "https://multi-channel.imfinethankyouandyou.com/api/websocket/health"
```

### Step 4: 升級到 100%

```powershell
curl -X POST "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-config" `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"rolloutPercentage": 100, "migrationStrategy": "complete"}'
```

### Step 5: 最終驗證

```bash
curl "https://multi-channel.imfinethankyouandyou.com/api/websocket/migration-status"
```

預期: `"rolloutPercentage": 100`

---

## 故障排除

### Token 過期錯誤

```json
{"error": "Authentication token required", "code": 4401}
```

**解決方案**: 重新登入並獲取新的 token (JWT token 通常有 24 小時有效期)

### 權限錯誤

```json
{"error": "Admin access required", "code": 403}
```

**解決方案**: 確認您使用的是管理員帳號 (role: "admin")

### Token 格式錯誤

確保 token 字串完整，沒有多餘的空格或換行符。

---

**創建時間**: 2025-10-08
**最後更新**: 2025-10-08
