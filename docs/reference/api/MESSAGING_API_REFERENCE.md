# Messaging API Reference
# API

## (Overview)

Messaging CRUD

****: 2.0.0
****: `/api/messages`

---


### GET /health


****:

****:
```json
{
 "status": "healthy",
 "module": "messaging",
 "timestamp": "2025-09-30T10:00:00.000Z",
 "version": "2.0.0"
}
```

### GET /info


****:

****:
```json
{
 "success": true,
 "data": {
 "module": "messaging",
 "version": "2.0.0",
 "status": "operational",
 "features": [
 "Message CRUD operations",
 "Bulk operations (create/delete)",
 "File attachment management",
 "Message forwarding",
 "Message tagging system",
 "Data export (JSON/CSV)"
 ],
 "endpoints": [...]
 }
}
```

---


### POST /


****: JWT

****:
```json
{
 "conversationId": "conv_123",
 "content": "Hello, this is a test message",
 "messageType": "text",
 "metadata": {
 "priority": "high"
 }
}
```

****:
```json
{
 "success": true,
 "data": {
 "id": "msg_1234567890_abc123",
 "conversationId": "conv_123",
 "content": "Hello, this is a test message",
 "messageType": "text",
 "senderType": "agent",
 "agentSenderId": "agent_123",
 "sentAt": "2025-09-30T10:00:00.000Z",
 "createdAt": "2025-09-30T10:00:00.000Z"
 },
 "message": "Message created successfully",
 "timestamp": "2025-09-30T10:00:00.000Z"
}
```

### GET /:id


****: JWT

****:
```json
{
 "success": true,
 "data": {
 "id": "msg_123",
 "conversationId": "conv_123",
 "senderType": "agent",
 "senderInfo": {
 "id": "agent_123",
 "name": "Agent Name",
 "role": "agent"
 },
 "content": "Message content",
 "messageType": "text",
 "isRecalled": false,
 "sentAt": "2025-09-30T10:00:00.000Z",
 "conversationInfo": {
 "status": "active",
 "priority": "normal"
 }
 }
}
```

### PUT /:id


****: JWT ()

****:
```json
{
 "content": "Updated message content",
 "metadata": {
 "edited": true
 }
}
```

### DELETE /:id
()

****: JWT ()

****:
```json
{
 "success": true,
 "data": {
 "id": "msg_123",
 "conversationId": "conv_123",
 "isRecalled": true,
 "recalledAt": "2025-09-30T10:00:00.000Z",
 "recalledBy": {
 "id": "agent_123",
 "name": "Agent Name"
 }
 }
}
```

---


### POST /bulk-create


****: JWT

****: 100/

****:
```json
{
 "messages": [
 {
 "conversationId": "conv_123",
 "content": "Message 1",
 "messageType": "text"
 },
 {
 "conversationId": "conv_124",
 "content": "Message 2",
 "messageType": "text"
 }
 ]
}
```

****:
```json
{
 "success": true,
 "data": {
 "totalRequested": 2,
 "successCount": 2,
 "failureCount": 0,
 "results": [
 {
 "index": 0,
 "id": "msg_xxx",
 "conversationId": "conv_123",
 "status": "success"
 },
 {
 "index": 1,
 "id": "msg_yyy",
 "conversationId": "conv_124",
 "status": "success"
 }
 ]
 },
 "message": "Bulk operation completed: 2 succeeded, 0 failed"
}
```

### POST /bulk-delete
()

****: JWT

****: 100/

****:
```json
{
 "messageIds": [
 "msg_123",
 "msg_124"
 ]
}
```

****:
```json
{
 "success": true,
 "data": {
 "totalRequested": 2,
 "successCount": 2,
 "failureCount": 0,
 "results": [
 {
 "messageId": "msg_123",
 "conversationId": "conv_123",
 "recalledAt": "2025-09-30T10:00:00.000Z",
 "status": "success"
 }
 ]
 }
}
```

---


### GET /:id/attachments


****: JWT

****:
```json
{
 "success": true,
 "data": {
 "messageId": "msg_123",
 "conversationId": "conv_123",
 "attachments": [
 {
 "id": "att_xxx",
 "messageId": "msg_123",
 "filename": "document.pdf",
 "mimeType": "application/pdf",
 "fileSize": 102400,
 "url": "https://storage.example.com/attachments/...",
 "createdAt": "2025-09-30T10:00:00.000Z"
 }
 ],
 "count": 1
 }
}
```

### POST /:id/attachments


****: JWT ()

****: multipart/form-data
- `file`: (10MB)

****:
- : JPEG, PNG, GIF, WebP
- : MP4, WebM
- : MP3, WAV, OGG
- : PDF, TXT, DOC, DOCX

****:
```json
{
 "success": true,
 "data": {
 "attachmentId": "att_xxx",
 "messageId": "msg_123",
 "filename": "document.pdf",
 "mimeType": "application/pdf",
 "fileSize": 102400,
 "url": "https://storage.example.com/...",
 "createdAt": "2025-09-30T10:00:00.000Z"
 },
 "message": "Attachment uploaded successfully"
}
```

---


### POST /:id/forward


****: JWT

****: 20/

****:
```json
{
 "targetConversationIds": [
 "conv_456",
 "conv_789"
 ],
 "comment": "FYI: Important message"
}
```

****:
```json
{
 "success": true,
 "data": {
 "originalMessageId": "msg_123",
 "totalTargets": 2,
 "successCount": 2,
 "failureCount": 0,
 "results": [
 {
 "conversationId": "conv_456",
 "newMessageId": "msg_xxx",
 "status": "success"
 },
 {
 "conversationId": "conv_789",
 "newMessageId": "msg_yyy",
 "status": "success"
 }
 ]
 },
 "message": "Message forwarded: 2 succeeded, 0 failed"
}
```

---


### PUT /:id/tags
/

****: JWT

****: 10/

****:
```json
{
 "tags": [
 "urgent",
 "follow-up",
 "customer-request"
 ]
}
```

****:
```json
{
 "success": true,
 "data": {
 "messageId": "msg_123",
 "conversationId": "conv_123",
 "tags": ["urgent", "follow-up", "customer-request"],
 "updatedAt": "2025-09-30T10:00:00.000Z"
 },
 "message": "Message tags updated successfully"
}
```

### GET /tags


****: JWT

****:
```json
{
 "success": true,
 "data": {
 "tags": [
 { "name": "urgent", "count": 45 },
 { "name": "follow-up", "count": 32 },
 { "name": "resolved", "count": 28 }
 ],
 "total": 3
 }
}
```

---


### GET /export
JSONCSV

****: JWT

****:
- `format`: (json | csv) - : json
- `conversationId`: ID ()
- `dateFrom`: ()
- `dateTo`: ()
- `limit`: (1-1000) - : 100

****:
```
GET /api/messages/export?format=json&conversationId=conv_123&limit=500
```

**JSON**:
```json
{
 "success": true,
 "data": {
 "messages": [
 {
 "id": "msg_123",
 "conversationId": "conv_123",
 "senderType": "agent",
 "senderName": "Agent Name",
 "content": "Message content",
 "messageType": "text",
 "sentAt": "2025-09-30T10:00:00.000Z",
 "deliveryStatus": "delivered",
 "createdAt": "2025-09-30T10:00:00.000Z"
 }
 ],
 "exportInfo": {
 "format": "json",
 "totalRecords": 1,
 "exportedAt": "2025-09-30T11:00:00.000Z",
 "exportedBy": "agent_123",
 "filters": {
 "conversationId": "conv_123",
 "limit": 500
 }
 }
 }
}
```

**CSV**:
```csv
Message ID,Conversation ID,Sender Type,Sender Name,Content,Message Type,Sent At,Delivery Status,Created At
msg_123,conv_123,agent,Agent Name,"Message content",text,2025-09-30T10:00:00.000Z,delivered,2025-09-30T10:00:00.000Z
```

---


### GET /search


****: JWT

****:
- `q`:
- `conversationId`: ID
- `messageType`:
- `senderType`:
- `dateFrom`:
- `dateTo`:
- `isRecalled`:
- `limit`: (: 50)
- `offset`: (: 0)

****:
```
GET /api/messages/search?q=urgent&conversationId=conv_123&limit=20
```

### GET /conversation/:conversationId


****: JWT

****:
- `page`: (: 1)
- `pageSize`: (1-100, : 20)
- `messageType`:
- `senderType`:
- `includeRecalled`: (: false)

****:
```json
{
 "success": true,
 "data": {
 "messages": [...],
 "pagination": {
 "page": 1,
 "pageSize": 20,
 "total": 150,
 "totalPages": 8,
 "hasMore": true
 },
 "filters": {
 "messageType": null,
 "senderType": null,
 "includeRecalled": false
 }
 }
}
```

### GET /stats


****: JWT

****:
```json
{
 "success": true,
 "data": {
 "overview": {
 "totalMessages": 10000,
 "todayMessages": 0,
 "activeConversations": 0,
 "averagePerDay": 333,
 "recalledMessages": 0
 },
 "breakdown": {
 "byMessageType": {},
 "bySenderType": {}
 },
 "scope": "global",
 "generatedAt": "2025-09-30T10:00:00.000Z"
 }
}
```

---


| | HTTP | |
|--------|---------|------|
| INVALID_JSON | 400 | JSON |
| VALIDATION_ERROR | 400 | |
| MESSAGE_NOT_FOUND | 404 | |
| CONVERSATION_NOT_FOUND | 404 | |
| PERMISSION_DENIED | 403 | |
| RECALL_DEADLINE_EXCEEDED | 400 | |
| FILE_TOO_LARGE | 400 | (>10MB) |
| INVALID_FILE_TYPE | 400 | |
| BATCH_LIMIT_EXCEEDED | 400 | |
| STORAGE_ERROR | 500 | |

---


### :

```javascript
// 1.
const createResponse = await fetch('/api/messages', {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 conversationId: 'conv_123',
 content: 'Important announcement',
 messageType: 'text'
 })
});
const { data: message } = await createResponse.json();

// 2.
await fetch(`/api/messages/${message.id}/forward`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 targetConversationIds: ['conv_456', 'conv_789'],
 comment: 'FYI'
 })
});

// 3.
await fetch(`/api/messages/${message.id}/tags`, {
 method: 'PUT',
 headers: {
 'Authorization': `Bearer ${token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 tags: ['important', 'announcement']
 })
});

// 4.
const exportResponse = await fetch('/api/messages/export?format=json&limit=100', {
 headers: {
 'Authorization': `Bearer ${token}`
 }
});
const exportData = await exportResponse.json();
```

---


- ****: 100/,
- ****: 10MB
- ****: 1000
- ****: 10
- ****: 20

---


### v2.0.0 (2025-09-30)
- (bulk-create, bulk-delete)
-
-
-
- (JSON/CSV)

### v1.0.0
- CRUD
-
- 