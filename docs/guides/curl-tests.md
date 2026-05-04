# curl

 API curl


```bash

curl http://localhost:8787/


curl http://localhost:8787/health

# API
curl http://localhost:8787/api
```


```bash
# Admin
curl -X POST http://localhost:8787/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"admin","password":"admin123"}'

# Agent
curl -X POST http://localhost:8787/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"agent1","password":"agent123"}'
```


```bash
# YOUR_TOKEN JWT token
curl http://localhost:8787/api/auth/profile \
 -H "Authorization: Bearer YOUR_TOKEN"
```


```bash
curl -X POST http://localhost:8787/api/auth/logout \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "X-Session-ID: dummy-session-id"
```


```bash
curl http://localhost:8787/api/teams \
 -H "Authorization: Bearer YOUR_TOKEN"
```

### Admin
```bash
curl -X POST http://localhost:8787/api/teams \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"name":"","description":""}'
```


```bash
# TEAM_ID ID
curl http://localhost:8787/api/teams/TEAM_ID \
 -H "Authorization: Bearer YOUR_TOKEN"
```

### Admin
```bash
curl -X PUT http://localhost:8787/api/teams/TEAM_ID \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"name":"","description":""}'
```


```bash
curl http://localhost:8787/api/teams/TEAM_ID/members \
 -H "Authorization: Bearer YOUR_TOKEN"
```


```bash
curl http://localhost:8787/api/teams/TEAM_ID/stats \
 -H "Authorization: Bearer YOUR_TOKEN"
```

### QR Code
```bash
curl -X POST http://localhost:8787/api/teams/TEAM_ID/qr-code \
 -H "Authorization: Bearer YOUR_TOKEN"
```


### Admin
```bash
curl -X POST http://localhost:8787/api/auth/register \
 -H "Authorization: Bearer YOUR_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "username":"testuser",
 "email":"test@example.com",
 "password":"test123",
 "displayName":"",
 "role":"agent",
 "teamId":1
 }'
```


### 1.
```bash
echo " ..."
curl -s http://localhost:8787/health | jq '.'
```

### 2. Admin Token
```bash
echo " Admin ..."
RESPONSE=$(curl -s -X POST http://localhost:8787/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"admin","password":"admin123"}')

echo $RESPONSE | jq '.'

# token jq
TOKEN=$(echo $RESPONSE | jq -r '.data.token')
echo "Token: $TOKEN"
```

### 3. Token API
```bash
echo " ..."
curl -s http://localhost:8787/api/auth/profile \
 -H "Authorization: Bearer $TOKEN" | jq '.'

echo " ..."
curl -s http://localhost:8787/api/teams \
 -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 4.
```bash
echo " ..."
curl -s -X POST http://localhost:8787/api/teams \
 -H "Authorization: Bearer $TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"name":"curl","description":"curl"}' | jq '.'
```


### Windows PowerShell
```powershell
# test-api.ps1
$BASE_URL = "http://localhost:8787"


Write-Host " ..." -ForegroundColor Green
$health = Invoke-RestMethod -Uri "$BASE_URL/health"
Write-Host ": $($health.status)" -ForegroundColor Yellow


Write-Host " ..." -ForegroundColor Green
$loginData = @{
 username = "admin"
 password = "admin123"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"

if ($loginResponse.success) {
 $token = $loginResponse.data.token
 Write-Host " !" -ForegroundColor Green
 Write-Host ": $($loginResponse.data.user.displayName)" -ForegroundColor Yellow

 #
 Write-Host " ..." -ForegroundColor Green
 $headers = @{ Authorization = "Bearer $token" }
 $teams = Invoke-RestMethod -Uri "$BASE_URL/api/teams" -Headers $headers

 Write-Host " $($teams.data.Count) :" -ForegroundColor Yellow
 foreach ($team in $teams.data) {
 Write-Host " - $($team.name) (ID: $($team.id))" -ForegroundColor Cyan
 }
} else {
 Write-Host " : $($loginResponse.error)" -ForegroundColor Red
}
```

### Linux/Mac Bash
```bash
#!/bin/bash
# test-api.sh

BASE_URL="http://localhost:8787"

echo " ..."
curl -s $BASE_URL/health | jq '.status'

echo " ..."
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"admin","password":"admin123"}')

if echo $RESPONSE | jq -e '.success' > /dev/null; then
 TOKEN=$(echo $RESPONSE | jq -r '.data.token')
 USER_NAME=$(echo $RESPONSE | jq -r '.data.user.displayName')

 echo " ! : $USER_NAME"

 echo " ..."
 curl -s $BASE_URL/api/teams \
 -H "Authorization: Bearer $TOKEN" | jq '.data[] | {id, name, description}'
else
 echo " "
 echo $RESPONSE | jq '.error'
fi
```


1. ****: `bun run dev`
2. ** jq**: JSON
 - Windows: `choco install jq`
 - Mac: `brew install jq`
 - Linux: `sudo apt-get install jq`
3. ****: `YOUR_TOKEN` `TEAM_ID`
4. ****: admin


- ****:
- **401 **: JWT token
- **403 **: admin vs agent
- **400 **:


```bash
# HTTP
curl -v http://localhost:8787/api/teams

# HTTP
curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/health

# JSON
curl -s http://localhost:8787/api | jq '.'
```