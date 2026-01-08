# JWT Token

> ** API **
> : 2025-10-02

---


1. [ Token](#-token)
2. [](#)
3. [ Token API](#-token--api)
4. [](#)

---

## Token

### 1:

```bash
# token
curl -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{
 "email": "admin@dacit.net",
 "password": "YOUR_PASSWORD"
 }'

# :
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

### 2:


```javascript
// 1: localStorage
const token = localStorage.getItem('auth_token');
console.log('Token:', token);

// 2: sessionStorage
const token = sessionStorage.getItem('auth_token');
console.log('Token:', token);

// 3: Pinia store
import { useAuthStore } from '@/stores/auth';
const authStore = useAuthStore();
console.log('Token:', authStore.token);
```

---


### 1: curl

#### Step 1: Token

```bash

TOKEN=$(curl -s -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@dacit.net","password":"YOUR_PASSWORD"}' \
 | jq -r '.data.token')

# token
echo "Token: $TOKEN"
```

#### Step 2: Token API

```bash

curl -H "Authorization: Bearer $TOKEN" \
 https://your-api-domain.example.com/api/collaboration/health


curl -H "Authorization: Bearer $TOKEN" \
 https://your-api-domain.example.com/api/collaboration/stats
```

---

### 2: PowerShellWindows

```powershell
# Step 1: Token
$response = Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/auth/login" `
 -Method POST `
 -Headers @{"Content-Type"="application/json"} `
 -Body '{"email":"admin@dacit.net","password":"YOUR_PASSWORD"}'

$TOKEN = $response.data.token
Write-Host "Token: $TOKEN"

# Step 2: API
$headers = @{
 "Authorization" = "Bearer $TOKEN"
 "Content-Type" = "application/json"
}


Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/collaboration/health" `
 -Headers $headers


Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/collaboration/stats" `
 -Headers $headers
```

---

### 3:

#### Step 1:

1. https://your-api-domain.example.com
2.
 - Email: `admin@dacit.net`
 - Password:

#### Step 2:

1. `F12`
2. **Console ()**

#### Step 3: Token


```javascript
// 1: localStorage
copy(localStorage.getItem('auth_token'))

// 2: sessionStorage
copy(sessionStorage.getItem('auth_token'))

// 3: cookie
document.cookie.split(';').find(c => c.trim().startsWith('token='))

// 4:
// Network API
// Request Headers Authorization
```

Token

---

### 4:


```bash
# wrangler SQL
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

## Token API

### API

#### 1.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://your-api-domain.example.com/api/collaboration/health

# :
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

#### 2.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://your-api-domain.example.com/api/collaboration/stats

# :
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

#### 3.

```bash
curl -X POST \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 https://your-api-domain.example.com/api/collaboration/conversations/123/join

# :
{
 "success": true,
 "message": "Joined conversation successfully"
}
```

#### 4.

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
 https://your-api-domain.example.com/api/collaboration/conversations/123/state

# :
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

#### 5.

```bash
curl -X POST \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"conversationId": 123, "status": "start"}' \
 https://your-api-domain.example.com/api/collaboration/typing

# :
{
 "success": true,
 "message": "Typing start sent successfully"
}
```

---

### WebSocket

 token

```bash
# 1. WebSocket
curl https://your-api-domain.example.com/api/websocket/health

# 2. WebSocket
curl https://your-api-domain.example.com/api/websocket/migration-status

# 3.
curl https://your-api-domain.example.com/api/websocket/readiness

# 4.
curl https://your-api-domain.example.com/api/websocket/liveness
```

---


### Q1: Token

****:
```json
{
 "error": "Token expired",
 "statusCode": 401
}
```

****:
 token

```bash
TOKEN=$(curl -s -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@dacit.net","password":"YOUR_PASSWORD"}' \
 | jq -r '.data.token')
```

---

### Q2: Token

****:
```json
{
 "error": "Invalid token",
 "statusCode": 401
}
```

****:
1. Token `Bearer `
2. Token
3.

****:
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
 https://api-url
```

---

### Q3: Token

 JWT

```bash
# 1: jq ( jq)
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq

# 2:
# https://jwt.io
# token
```

**Token Payload **:
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

### Q4:

** 1: **

```bash
# 1.
# : https://bcrypt-generator.com/
# Node.js:
node -e "console.log(require('bcryptjs').hashSync('new_password', 10))"

# 2.
wrangler d1 execute multi-channel-platform --remote \
 --command "UPDATE agents SET password_hash = 'YOUR_NEW_HASH' WHERE email = 'admin@dacit.net'"
```

** 2: **


---

### Q5: Token

**Bash/Linux**:
```bash

echo $TOKEN > ~/.api_token


TOKEN=$(cat ~/.api_token)
curl -H "Authorization: Bearer $TOKEN" https://api-url
```

**PowerShell**:
```powershell

$TOKEN | Out-File -FilePath "$env:USERPROFILE\.api_token"


$TOKEN = Get-Content "$env:USERPROFILE\.api_token"
Invoke-RestMethod -Uri "https://api-url" -Headers @{"Authorization"="Bearer $TOKEN"}
```

****:
```bash
# Linux/Mac
export API_TOKEN="your_token_here"
curl -H "Authorization: Bearer $API_TOKEN" https://api-url

# Windows PowerShell
$env:API_TOKEN = "your_token_here"
curl -H "Authorization: Bearer $env:API_TOKEN" https://api-url
```

---


### Bash

```bash
#!/bin/bash


API_URL="https://your-api-domain.example.com"
EMAIL="admin@dacit.net"
PASSWORD="YOUR_PASSWORD"

# 1. Token
echo " Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
 -H "Content-Type: application/json" \
 -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
 echo " Login failed"
 echo $LOGIN_RESPONSE | jq
 exit 1
fi

echo " Login successful"
echo "Token: ${TOKEN:0:50}..."

# 2.
echo ""
echo " Testing collaboration health..."
curl -s -H "Authorization: Bearer $TOKEN" \
 "$API_URL/api/collaboration/health" | jq

# 3.
echo ""
echo " Testing collaboration stats..."
curl -s -H "Authorization: Bearer $TOKEN" \
 "$API_URL/api/collaboration/stats" | jq

# 4. WebSocket
echo ""
echo " Testing WebSocket health..."
curl -s "$API_URL/api/websocket/health" | jq

echo ""
echo " All tests completed!"
```

 `test-api.sh`

```bash
chmod +x test-api.sh
./test-api.sh
```

---

### PowerShell

```powershell

$API_URL = "https://your-api-domain.example.com"
$EMAIL = "admin@dacit.net"
$PASSWORD = "YOUR_PASSWORD"

# 1. Token
Write-Host " Logging in..." -ForegroundColor Cyan
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
 Write-Host " Login successful" -ForegroundColor Green
 Write-Host "Token: $($TOKEN.Substring(0, 50))..."
} catch {
 Write-Host " Login failed: $_" -ForegroundColor Red
 exit 1
}

$headers = @{
 "Authorization" = "Bearer $TOKEN"
 "Content-Type" = "application/json"
}

# 2.
Write-Host "`n Testing collaboration health..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/api/collaboration/health" -Headers $headers | ConvertTo-Json

# 3.
Write-Host "`n Testing collaboration stats..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/api/collaboration/stats" -Headers $headers | ConvertTo-Json

# 4. WebSocket
Write-Host "`n Testing WebSocket health..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/api/websocket/health" | ConvertTo-Json

Write-Host "`n All tests completed!" -ForegroundColor Green
```

 `test-api.ps1`

```powershell
.\test-api.ps1
```

---


### Token

1. ****
 - Email: `admin@dacit.net`
 - Password: ()

2. ** token**
 - : `response.data.token`

3. ** token API**
 - Header: `Authorization: Bearer YOUR_TOKEN`


 **Token **:
- token
- Token
- token

 **Token **:
- : 24
-
- refresh token

 ****:
-
- `.env`
- token

---

****: 1.0.0
****: 2025-10-02
