# API
# API Endpoint Fixes Verification Guide

## (Overview)

 API :

1. **QR ** - `PUT /api/teams/:id/qr-codes/:qrCodeId/deactivate`
2. **** - `GET /api/team/members/:id`
3. **** - Client-side feature toggle

## (Prerequisites)

### 1. (Get Authentication Token)

```bash
# 1:
# 1. https://your-api-domain.example.com
# 2. (F12)
# 3. Console tab
# 4. : localStorage.getItem('auth_token')

# 2: API
curl -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{
 "loginId": "admin-001",
 "password": "your-password"
 }'
```

### 2. (Set Environment Variables)

```bash
# Windows PowerShell
$env:API_URL="https://your-api-domain.example.com/api"
$env:TEST_AUTH_TOKEN="your-jwt-token-here"

# Linux/Mac
export API_URL="https://your-api-domain.example.com/api"
export TEST_AUTH_TOKEN="your-jwt-token-here"
```

---

## 1: QR
## Verification 1: QR Code Deactivation Endpoint

### (Endpoint Information)

- ****: `PUT /api/teams/:id/qr-codes/:qrCodeId/deactivate`
- ****: Required (JWT Bearer Token)
- ****: `src/modules/teams/handlers/team.ts:544-573`
- ****: `src/modules/teams/services/qr-service.ts:66-78`

### (Test Steps)

#### Step 1: QR

```bash
curl -X POST https://your-api-domain.example.com/api/teams/1/qr-code \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "campaignName": "Verification Test Campaign",
 "description": "Test QR code for endpoint verification",
 "maxUses": 100
 }'
```

****:
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

#### Step 2: QR

```bash
# Step 1 QR Code ID
QR_CODE_ID="qr-code-uuid-from-step-1"

curl -X PUT https://your-api-domain.example.com/api/teams/1/qr-codes/$QR_CODE_ID/deactivate \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json"
```

****:
```json
{
 "success": true,
 "message": "QR code deactivated successfully",
 "timestamp": "2025-10-14T..."
}
```

#### Step 3: QR

```bash
curl -X GET https://your-api-domain.example.com/api/teams/1/qr-codes \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN"
```

****:
- QR
- QR `isActive` `false`
- (id, campaignName, usageCount )

### (Error Case Testing)

#### 1:

```bash
curl -X PUT https://your-api-domain.example.com/api/teams/1/qr-codes/test-id/deactivate \
 -H "Content-Type: application/json"
```

****: `401 Unauthorized`

#### 2: ID

```bash
curl -X PUT https://your-api-domain.example.com/api/teams/invalid/qr-codes/test-id/deactivate \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json"
```

****: `400 Bad Request` with error message "Invalid team ID"

#### 3: QR ID

```bash
curl -X PUT https://your-api-domain.example.com/api/teams/1/qr-codes/non-existent-id/deactivate \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json"
```

****: `404 Not Found` or `500 Internal Server Error` with error message

---

## 2:
## Verification 2: Team Member Details Endpoint

### (Endpoint Information)

- ****: `GET /api/team/members/:id`
- ****: Required (JWT Bearer Token)
- ****: `src/index.ts:573-610`
- ****: id, loginId, email, name, role, teamId, status, isActive, createdAt, lastActive

### (Test Steps)

#### Step 1:

```bash
# ID ()
MEMBER_ID="admin-001"

curl -X GET https://your-api-domain.example.com/api/team/members/$MEMBER_ID \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json"
```

****:
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

#### Step 2:

****:
- `id` ID
- `loginId` ( displayName)
- `email`
- `name` ( displayName)
- `role` 'admin', 'team', 'agent'
- `teamId`
- `status` 'active' 'inactive'
- `isActive` , status
- `createdAt` ISO 8601
- `lastActive` ( null)

#### Step 3:

```bash

# status === 'active' isActive === true
# status === 'inactive' isActive === false

# jq ()
curl -X GET https://your-api-domain.example.com/api/team/members/$MEMBER_ID \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 | jq '{status: .data.status, isActive: .data.isActive}'
```

### (Error Case Testing)

#### 1:

```bash
curl -X GET https://your-api-domain.example.com/api/team/members/admin-001 \
 -H "Content-Type: application/json"
```

****: `401 Unauthorized`

#### 2: ID

```bash
curl -X GET https://your-api-domain.example.com/api/team/members/non-existent-member \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json"
```

****: `404 Not Found`
```json
{
 "success": false,
 "error": "Member not found"
}
```

---

## 3:
## Verification 3: Frontend Invitation Feature Toggle

### (Feature Information)

- ****: `frontend/src/api/team.ts:14-18`
- ****: `VITE_ENABLE_INVITATION`
- ****: `false` ()

### (Verification Steps)

#### Step 1:

```bash

cat frontend/src/api/team.ts | grep -A 5 "isInvitationEnabled"
```

****:
```typescript
isInvitationEnabled: (): boolean => {
 //
 // false
 return import.meta.env.VITE_ENABLE_INVITATION === 'true' || false
},
```

#### Step 2:

 `isInvitationEnabled()` :

1. `inviteMember` (line 44-52)
2. `resendInvitation` (line 55-63)
3. `cancelInvitation` (line 66-74)
4. `acceptInvitation` (line 137-147)
5. `declineInvitation` (line 150-158)
6. `validateInvitation` (line 171-178)
7. `generateQRInvite` (line 190-197)

#### Step 3:

```bash
# 1:
curl -X POST https://your-api-domain.example.com/api/teams/invite \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "email": "test@example.com",
 "role": "agent"
 }'

# 2:
curl -X POST https://your-api-domain.example.com/api/team/invitations/test-id/resend \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN"

# 3:
curl -X DELETE https://your-api-domain.example.com/api/team/invitations/test-id \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN"

# 4: QR
curl -X POST https://your-api-domain.example.com/api/teams/qr-invite \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{
 "email": "test@example.com",
 "role": "agent"
 }'
```

**** ():
- : `404 Not Found` `500 Internal Server Error`
- :

#### Step 4: UI ()

:

1.
2.
3. ,: ","

---


## Automated Test Execution

### Vitest

```bash
# ()
npm install


export API_URL="https://your-api-domain.example.com/api"
export TEST_AUTH_TOKEN="your-jwt-token-here"


npm run test -- tests/api-endpoint-fixes-verification.test.ts


npm run test -- tests/api-endpoint-fixes-verification.test.ts --reporter=verbose


npm run test:coverage -- tests/api-endpoint-fixes-verification.test.ts
```


- ****: 30
- ****:
 1. QR (7 tests)
 2. (5 tests)
 3. (5 tests)
 4. (3 tests)
 5. (3 tests)

---


## Verification Checklist

### QR

- [ ] QR
- [ ] QR
- [ ] `isActive` `false`
- [ ] 401
- [ ] ID 400
- [ ] QR
- [ ]


- [ ]
- [ ]
- [ ] `status` `isActive`
- [ ] `role` (admin/team/agent)
- [ ] 401
- [ ] 404
- [ ] ISO 8601


- [ ] `isInvitationEnabled()`
- [ ] `false`
- [ ]
- [ ]
- [ ] ( 404)
- [ ] UI ()

---


## Troubleshooting

### 1: 401 Unauthorized

****:

****:
```bash

curl -X POST https://your-api-domain.example.com/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{
 "loginId": "admin-001",
 "password": "your-password"
 }'


export TEST_AUTH_TOKEN="new-token-here"
```

### 2: CORS

****:

****:
- curl
- ( `src/config/cors.ts`)

### 3: QR

****: ID

****:
```bash
# ID
curl -X GET https://your-api-domain.example.com/api/team/members/admin-001 \
 -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
 | jq '.data.teamId'

# ID QR
```

---


## Test Report Template

```markdown
# API
Date: YYYY-MM-DD
Tester: [Your Name]
Environment: Production / Staging


- QR : PASS / FAIL
- : PASS / FAIL
- : PASS / FAIL


### 1. QR
- [/] QR
- [/] QR
- [/]
- [/]

### 2.
- [/]
- [/]
- [/]
- [/]

### 3.
- [/]
- [/]
- [/]
- [/]


[]


[]
```

---


## Related Documentation

- [API ](../API_ENDPOINT_COMPARISON.md)
- [ API ](../api/TEAM_MANAGEMENT_API.md)
- [QR ](../../src/modules/teams/services/qr-service.ts)
- [](../../src/modules/teams/handlers/team.ts)
- [ API ](../../frontend/src/api/team.ts)

---


## Verification Completion Criteria

:

1. 30
2.
3.
4. CORS
5.
6.
7.

---

****: 2025-10-14
****: 1.0.0
****:
