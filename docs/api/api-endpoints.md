# API

 API


```json
{
 "success": true,
 "data": <>,
 "message": "",
 "timestamp": "2024-01-01T00:00:00.000Z",
 "requestId": "req_1234567890_abcdef"
}
```


```json
{
 "success": false,
 "error": "",
 "timestamp": "2024-01-01T00:00:00.000Z",
 "requestId": "req_1234567890_abcdef"
}
```


```json
{
 "success": true,
 "data": [<>],
 "message": "",
 "pagination": {
 "page": 1,
 "limit": 20,
 "total": 100,
 "totalPages": 5,
 "hasNext": true,
 "hasPrev": false
 },
 "timestamp": "2024-01-01T00:00:00.000Z",
 "requestId": "req_1234567890_abcdef"
}
```


```json
{
 "success": false,
 "error": "Validation failed",
 "data": {
 "code": "VALIDATION_ERROR",
 "errors": [
 {
 "field": "email",
 "message": "Email is required",
 "value": ""
 }
 ]
 },
 "timestamp": "2024-01-01T00:00:00.000Z",
 "requestId": "req_1234567890_abcdef"
}
```


### POST /auth/login


**:**
```json
{
 "email": "user@example.com",
 "password": "password123"
}
```

**:**
```json
{
 "success": true,
 "data": {
 "token": "jwt_token_here",
 "agent": {
 "id": "agent_id",
 "email": "user@example.com",
 "name": "Agent Name",
 "role": "agent",
 "isActive": true,
 "createdAt": 1640995200000
 }
 },
 "message": "Login successful"
}
```

### GET /auth/me


**:** `Authorization: Bearer <token>`

**:**
```json
{
 "success": true,
 "data": {
 "id": "agent_id",
 "email": "user@example.com",
 "name": "Agent Name",
 "role": "agent",
 "isActive": true,
 "createdAt": 1640995200000
 },
 "message": "User information retrieved successfully"
}
```


### GET /conversations


**:**
- `page`: (: 1)
- `pageSize`: (: 20)
- `status`: (open, assigned, closed)

**:** `Authorization: Bearer <token>`

**:** data

### GET /conversations/:id


**:** `Authorization: Bearer <token>`

**:**
```json
{
 "success": true,
 "data": {
 "id": "conv_id",
 "userId": "user_id",
 "user": {
 "id": "user_id",
 "name": "User Name",
 "platform": "line",
 "platformUserId": "line_user_id",
 "avatarUrl": "avatar_url",
 "createdAt": 1640995200000
 },
 "assignedTo": "agent_id",
 "assignedAgent": {
 "id": "agent_id",
 "name": "Agent Name",
 "email": "agent@example.com",
 "role": "agent",
 "isActive": true,
 "createdAt": 1640995200000
 },
 "status": "open",
 "lastMessageAt": 1640995200000,
 "unreadCount": 5,
 "createdAt": 1640995200000,
 "updatedAt": 1640995200000
 }
}
```

### PUT /conversations/:id/assign


**:**
```json
{
 "agentId": "agent_id"
}
```

**:** `Authorization: Bearer <token>`

### PUT /conversations/:id/close


**:** `Authorization: Bearer <token>`


### GET /conversations/:id/messages


**:**
- `page`: (: 1)
- `pageSize`: (: 50)

**:** `Authorization: Bearer <token>`

**:** data

### POST /conversations/:id/messages


**:**
```json
{
 "content": "",
 "mediaUrl": "URL ()",
 "mediaType": "image|video|file ()",
 "attachmentIds": ["attachment_id1", "attachment_id2"]
}
```

**:** `Authorization: Bearer <token>`


### POST /conversations/:id/attachments


**:** FormData
- `file`:
- `messageType`: "image" | "file"

**:** `Authorization: Bearer <token>`

### GET /conversations/:id/attachments/:attachmentId


**:** `Authorization: Bearer <token>`

### GET /conversations/:id/attachments/:attachmentId/download


**:** `Authorization: Bearer <token>`

### DELETE /conversations/:id/attachments/:attachmentId


**:** `Authorization: Bearer <token>`

### GET /conversations/:id/attachments


**:**
- `page`: (: 1)
- `pageSize`: (: 20)
- `type`: ("image" | "document")

**:** `Authorization: Bearer <token>`

## Webhook

### POST /api/webhooks/line
LINE Webhook

**:** `X-Line-Signature: <signature>`

### POST /api/webhooks/facebook
Facebook Webhook

### POST /api/webhook
 LINE Webhook ( `/api/webhooks/line`)

** ():**
- `hub.mode`: "subscribe"
- `hub.verify_token`:
- `hub.challenge`:


### GET /team/members


**:** `Authorization: Bearer <admin_token>`

### PUT /team/members/:id/status


**:**
```json
{
 "isActive": true
}
```

**:** `Authorization: Bearer <admin_token>`

### DELETE /team/members/:id


**:** `Authorization: Bearer <admin_token>`


### GET /system/info


**:** `Authorization: Bearer <token>`

### GET /system/settings


**:** `Authorization: Bearer <admin_token>`

### PUT /system/settings


**:** `Authorization: Bearer <admin_token>`

### POST /system/integrations/:platform/test


**:** `Authorization: Bearer <admin_token>`

### GET /system/metrics


**:** `Authorization: Bearer <admin_token>`

### POST /system/backup


**:** `Authorization: Bearer <admin_token>`

### GET /system/backups


**:** `Authorization: Bearer <admin_token>`

### POST /system/restore/:backupId


**:** `Authorization: Bearer <admin_token>`

### POST /system/cache/clear


**:**
```json
{
 "type": "all|conversations|messages|sessions"
}
```

**:** `Authorization: Bearer <admin_token>`

### POST /system/restart


**:** `Authorization: Bearer <admin_token>`

### GET /system/health


| | |
|------|------|
| UNAUTHORIZED | |
| FORBIDDEN | |
| TOKEN_EXPIRED | |
| INVALID_CREDENTIALS | |
| VALIDATION_ERROR | |
| REQUIRED_FIELD | |
| INVALID_FORMAT | |
| NOT_FOUND | |
| ALREADY_EXISTS | |
| RESOURCE_CONFLICT | |
| INTERNAL_ERROR | |
| SERVICE_UNAVAILABLE | |
| RATE_LIMIT_EXCEEDED | |

## HTTP

| | |
|--------|------|
| 200 | |
| 201 | |
| 204 | |
| 400 | |
| 401 | |
| 403 | |
| 404 | |
| 409 | |
| 422 | |
| 500 | |
| 503 | |