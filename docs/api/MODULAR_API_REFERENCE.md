# API
# Modular API Reference Documentation

## (Overview)

API

### (Module Architecture)

```
 Multi-Channel Integration System API


 Auth Conversations Customer
Module Module Module


Teams Messaging Session
Module Module Module


System Integration QRCode
Module Module Module

```

## (Base Information)

### APIURL
- ****: `http://localhost:8787`
- ****: `https://your-domain.workers.dev`


```json
{
 "success": true|false,
 "data": object|array|null,
 "message": "string",
 "timestamp": "ISO8601",
 "requestId": "string"
}
```


```json
{
 "success": false,
 "error": {
 "code": "ERROR_CODE",
 "message": "Error description",
 "details": object,
 "timestamp": "ISO8601",
 "requestId": "string"
 }
}
```

---

## Auth Module

****: `/api/auth`


| HTTP | | | |
|---------|------|------|------|
| POST | `/login` | | |
| POST | `/logout` | | |
| POST | `/refresh` | | |
| GET | `/me` | | |
| GET | `/health` | | |

### API

#### POST /api/auth/login


****:
```json
{
 "email": "user@example.com",
 "password": "password123"
}
```

****:
```json
{
 "success": true,
 "data": {
 "token": "jwt_access_token",
 "refreshToken": "jwt_refresh_token",
 "agent": {
 "id": "agent-123",
 "email": "user@example.com",
 "displayName": "User Name",
 "role": "agent|admin",
 "teamId": 1,
 "isActive": true
 }
 },
 "message": "Login successful"
}
```

#### GET /api/auth/me


**Headers**: `Authorization: Bearer <token>`

****:
```json
{
 "success": true,
 "data": {
 "id": "agent-123",
 "email": "user@example.com",
 "displayName": "User Name",
 "role": "agent",
 "teamId": 1,
 "isActive": true,
 "createdAt": "2024-01-01T00:00:00Z"
 }
}
```

---

## Conversations Module

****: `/api/conversations`


| HTTP | | | |
|---------|------|------|------|
| GET | `/` | | |
| POST | `/` | | |
| GET | `/:id` | | |
| PUT | `/:id` | | |
| DELETE | `/:id` | | |
| POST | `/:id/assign` | | |
| POST | `/:id/transfer` | | |
| GET | `/:id/messages` | | |
| POST | `/:id/messages` | | |

### API

#### GET /api/conversations


****:
- `page`: (: 1)
- `limit`: (: 20, : 100)
- `status`: (`open`, `closed`, `pending`)
- `teamId`: ID
- `agentId`: ID
- `customerId`: ID

****:
```json
{
 "success": true,
 "data": {
 "conversations": [
 {
 "id": "conv-123",
 "customerId": "customer-456",
 "status": "open",
 "priority": "medium",
 "assignedAgent": {
 "id": "agent-789",
 "displayName": "Agent Name"
 },
 "customer": {
 "id": "customer-456",
 "displayName": "Customer Name",
 "platform": "line"
 },
 "latestMessage": {
 "content": "Last message content",
 "createdAt": "2024-01-01T12:00:00Z"
 },
 "messageCount": 15,
 "createdAt": "2024-01-01T10:00:00Z",
 "updatedAt": "2024-01-01T12:00:00Z"
 }
 ],
 "pagination": {
 "page": 1,
 "limit": 20,
 "total": 100,
 "totalPages": 5
 }
 }
}
```

#### POST /api/conversations/:id/assign


****:
```json
{
 "userId": "agent-123", // teamId
 "teamId": 456, // userId
 "reason": "Escalation needed"
}
```

****:
```json
{
 "success": true,
 "data": {
 "conversationId": "conv-123",
 "assignedTo": {
 "type": "user|team",
 "id": "agent-123",
 "name": "Agent Name"
 },
 "transfer": {
 "conversationId": "conv-123",
 "transferredTo": "agent-123",
 "reason": "Escalation needed",
 "createdAt": "2024-01-01T12:00:00Z"
 }
 }
}
```

#### GET /api/conversations/:id/messages


****:
- `limit`: (: 50, : 100)
- `offset`: (: 0)

****:
```json
{
 "success": true,
 "data": {
 "messages": [
 {
 "id": "msg-123",
 "conversationId": "conv-456",
 "content": "Message content",
 "senderType": "customer|agent|system",
 "senderId": "customer-789",
 "messageType": "text|image|file",
 "createdAt": "2024-01-01T12:00:00Z",
 "metadata": {}
 }
 ]
 }
}
```

---

## Customer Module

****: `/api/customers`


| HTTP | | | |
|---------|------|------|------|
| GET | `/` | | |
| POST | `/` | | |
| GET | `/:id` | | |
| PUT | `/:id` | | |
| DELETE | `/:id` | | |
| GET | `/:id/conversations` | | |
| GET | `/search` | | |

### API

#### GET /api/customers


****:
- `page`:
- `limit`:
- `platform`: (`line`, `facebook`)
- `teamId`: ID

****:
```json
{
 "success": true,
 "data": {
 "customers": [
 {
 "id": "customer-123",
 "platform": "line",
 "platformUserId": "U123456789",
 "displayName": "Customer Name",
 "avatarUrl": "https://example.com/avatar.jpg",
 "email": "customer@example.com",
 "phone": "+886-12345678",
 "sourceTeamId": 1,
 "metadata": {},
 "createdAt": "2024-01-01T00:00:00Z",
 "updatedAt": "2024-01-01T12:00:00Z"
 }
 ],
 "pagination": {
 "page": 1,
 "limit": 20,
 "total": 50
 }
 }
}
```

---

## Teams Module

****: `/api/teams`


| HTTP | | | |
|---------|------|------|------|
| GET | `/` | | |
| POST | `/` | | (Admin) |
| GET | `/:id` | | |
| PUT | `/:id` | | (Team/Admin) |
| DELETE | `/:id` | | (Admin) |
| GET | `/:id/members` | | |
| POST | `/:id/members` | | (Team/Admin) |

---

## Messaging Module

****: `/api/messaging`


| HTTP | | | |
|---------|------|------|------|
| POST | `/send` | | |
| POST | `/delayed` | | |
| PUT | `/:id/recall` | | |
| GET | `/delayed` | | |
| DELETE | `/delayed/:id` | | |

---

## Session Module

****: `/api/sessions`


| HTTP | | | |
|---------|------|------|------|
| GET | `/` | | |
| POST | `/` | | |
| GET | `/:id` | | |
| PUT | `/:id` | | |
| DELETE | `/:id` | | |
| POST | `/:id/messages` | | |
| GET | `/stats` | | |

---

## QRCode Module

****: `/api/qrcode`


| HTTP | | | |
|---------|------|------|------|
| POST | `/generate` | QR | |
| GET | `/:id` | QR | |
| GET | `/:id/image` | QR | |
| PUT | `/:id` | QR | |
| DELETE | `/:id` | QR | |
| GET | `/` | QR | |

---

## Integration Module

****: `/api/integrations`


| HTTP | | | |
|---------|------|------|------|
| GET | `/platforms` | | |
| POST | `/:platform/webhook` | webhook | |
| POST | `/:platform/test` | | (Admin) |
| GET | `/:platform/status` | | |
| PUT | `/:platform/config` | | (Admin) |

---

## Reports Module

****: `/api/reports`


| HTTP | | | |
|---------|------|------|------|
| GET | `/dashboard` | | |
| GET | `/conversations` | | |
| GET | `/agents` | | |
| GET | `/teams` | | |
| GET | `/export/:type` | | |

---

## System Module

****: `/api/system`


| HTTP | | | |
|---------|------|------|------|
| GET | `/health` | | |
| GET | `/status` | | |
| GET | `/info` | | |
| GET | `/metrics` | | (Team/Admin) |
| GET | `/settings` | | (Admin) |
| PUT | `/settings` | | (Admin) |
| POST | `/backup` | | (Admin) |
| GET | `/logs` | | (Admin) |

### API

#### GET /api/system/health


****:
```json
{
 "success": true,
 "data": {
 "status": "healthy",
 "timestamp": "2024-01-01T12:00:00Z",
 "version": "1.0.0",
 "uptime": "24:30:15",
 "services": {
 "database": "healthy",
 "cache": "healthy",
 "queue": "healthy",
 "storage": "healthy"
 }
 }
}
```

#### GET /api/system/metrics


****:
```json
{
 "success": true,
 "data": {
 "requests": {
 "total": 10000,
 "successful": 9950,
 "failed": 50,
 "averageResponseTime": 120
 },
 "conversations": {
 "total": 500,
 "active": 45,
 "closed": 455
 },
 "messages": {
 "total": 15000,
 "today": 250
 },
 "agents": {
 "total": 25,
 "online": 12,
 "busy": 8,
 "idle": 5
 }
 }
}
```

---

## (Authentication & Authorization)

### JWT
APIJWT Bearer

```
Authorization: Bearer <your-jwt-token>
```


| | | |
|------|------|----------|
| `admin` | | API |
| `team` | | |
| `agent` | | |


```json
// 403 Forbidden
{
 "success": false,
 "error": {
 "code": "AUTHORIZATION_ERROR",
 "message": "Insufficient permissions to access this resource",
 "timestamp": "2024-01-01T12:00:00Z"
 }
}
```

---

## (Error Codes Reference)

| | HTTP | |
|---------|---------|------|
| `VALIDATION_ERROR` | 400 | |
| `AUTHENTICATION_ERROR` | 401 | |
| `AUTHORIZATION_ERROR` | 403 | |
| `NOT_FOUND_ERROR` | 404 | |
| `BUSINESS_LOGIC_ERROR` | 422 | |
| `RATE_LIMIT_ERROR` | 429 | |
| `SYSTEM_ERROR` | 500 | |
| `DATABASE_ERROR` | 500 | |
| `EXTERNAL_SERVICE_ERROR` | 502 | |

---

## (Pagination & Filtering)


API

- `page`: 1
- `limit`: 20100


```json
{
 "pagination": {
 "page": 1,
 "limit": 20,
 "total": 100,
 "totalPages": 5,
 "hasNext": true,
 "hasPrev": false
 }
}
```


- `startDate` / `endDate`:
- `status`:
- `teamId`:
- `search`:

---

## (Real-time Communication)

### Server-Sent Events (SSE)
SSE

```javascript
//
const eventSource = new EventSource('/api/conversations/stream');
eventSource.onmessage = function(event) {
 const data = JSON.parse(event.data);
 console.log('Conversation update:', data);
};
```

### SSE
- `/api/conversations/stream` -
- `/api/conversations/:id/messages/stream` -
- `/api/system/monitoring/stream` -

---

## (Development Guidelines)

### API
API `/api/`


- `Content-Type: application/json`
- `Content-Type: application/json`


APIUTF-8


ISO 8601`2024-01-01T12:00:00Z`

---

## (Testing & Examples)

### cURL


```bash
curl -X POST http://localhost:8787/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"admin@example.com","password":"password"}'
```


```bash
curl -X GET http://localhost:8787/api/conversations \
 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 -G -d "page=1" -d "limit=20" -d "status=open"
```


```bash
curl -X POST http://localhost:8787/api/conversations/conv-123/messages \
 -H "Authorization: Bearer YOUR_JWT_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"content":"Hello","senderType":"agent","senderId":"agent-456"}'
```

### Postman Collection
Postman collection`docs/api/Modular_API.postman_collection.json`

---

## (Changelog)

### v2.0.0 -
- API
-
-
-
-
- SSE

### v1.0.0 -
- API
- LINE
-

---

## (Support)

API

1. `tests/modules/*/`
2. `GET /api/system/health`
3. `GET /api/system/logs`

****: 2.0.0
****: 2024-01-01
****: Multi-Channel Integration System Team