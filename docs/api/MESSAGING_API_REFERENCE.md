# Messaging API Reference
# 訊息模組API參考文檔

## 概述 (Overview)

Messaging 模組提供完整的訊息管理功能，包括基本的CRUD操作、批量處理、附件管理、訊息轉發、標記系統和數據匯出。

**版本**: 2.0.0
**基礎路徑**: `/api/messages`

---

## 🏥 健康檢查端點

### GET /health
檢查模組健康狀態

**認證**: ❌ 不需要

**回應範例**:
```json
{
  "status": "healthy",
  "module": "messaging",
  "timestamp": "2025-09-30T10:00:00.000Z",
  "version": "2.0.0"
}
```

### GET /info
獲取模組資訊

**認證**: ❌ 不需要

**回應範例**:
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

## 📨 基本訊息操作

### POST /
創建新訊息

**認證**: ✅ 需要 JWT

**請求體**:
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

**回應**:
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
獲取特定訊息詳細資訊

**認證**: ✅ 需要 JWT

**回應**:
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
更新訊息

**認證**: ✅ 需要 JWT (僅發送者或管理員)

**請求體**:
```json
{
  "content": "Updated message content",
  "metadata": {
    "edited": true
  }
}
```

### DELETE /:id
刪除(撤回)訊息

**認證**: ✅ 需要 JWT (僅發送者或管理員)

**回應**:
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

## 📋 批量操作

### POST /bulk-create
批量創建訊息

**認證**: ✅ 需要 JWT

**限制**: 最多100條訊息/次

**請求體**:
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

**回應**:
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
批量刪除(撤回)訊息

**認證**: ✅ 需要 JWT

**限制**: 最多100條訊息/次

**請求體**:
```json
{
  "messageIds": [
    "msg_123",
    "msg_124"
  ]
}
```

**回應**:
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

## 📎 附件管理

### GET /:id/attachments
獲取訊息的附件列表

**認證**: ✅ 需要 JWT

**回應**:
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
上傳訊息附件

**認證**: ✅ 需要 JWT (僅發送者或管理員)

**請求**: multipart/form-data
- `file`: 檔案 (最大10MB)

**支援的檔案類型**:
- 圖片: JPEG, PNG, GIF, WebP
- 影片: MP4, WebM
- 音訊: MP3, WAV, OGG
- 文件: PDF, TXT, DOC, DOCX

**回應**:
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

## 🔀 訊息轉發

### POST /:id/forward
轉發訊息到其他對話

**認證**: ✅ 需要 JWT

**限制**: 最多20個目標對話/次

**請求體**:
```json
{
  "targetConversationIds": [
    "conv_456",
    "conv_789"
  ],
  "comment": "FYI: Important message"
}
```

**回應**:
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

## 🏷️ 訊息標記

### PUT /:id/tags
為訊息添加/更新標籤

**認證**: ✅ 需要 JWT

**限制**: 最多10個標籤/訊息

**請求體**:
```json
{
  "tags": [
    "urgent",
    "follow-up",
    "customer-request"
  ]
}
```

**回應**:
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
獲取所有可用標籤及使用統計

**認證**: ✅ 需要 JWT

**回應**:
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

## 📤 數據匯出

### GET /export
匯出訊息為JSON或CSV格式

**認證**: ✅ 需要 JWT

**查詢參數**:
- `format`: 格式 (json | csv) - 預設: json
- `conversationId`: 對話ID (可選)
- `dateFrom`: 開始日期 (可選)
- `dateTo`: 結束日期 (可選)
- `limit`: 最大數量 (1-1000) - 預設: 100

**範例請求**:
```
GET /api/messages/export?format=json&conversationId=conv_123&limit=500
```

**JSON格式回應**:
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

**CSV格式回應**:
```csv
Message ID,Conversation ID,Sender Type,Sender Name,Content,Message Type,Sent At,Delivery Status,Created At
msg_123,conv_123,agent,Agent Name,"Message content",text,2025-09-30T10:00:00.000Z,delivered,2025-09-30T10:00:00.000Z
```

---

## 🔍 進階查詢

### GET /search
搜尋訊息

**認證**: ✅ 需要 JWT

**查詢參數**:
- `q`: 搜尋關鍵字
- `conversationId`: 對話ID
- `messageType`: 訊息類型
- `senderType`: 發送者類型
- `dateFrom`: 開始日期
- `dateTo`: 結束日期
- `isRecalled`: 是否包含撤回訊息
- `limit`: 最大結果數 (預設: 50)
- `offset`: 偏移量 (預設: 0)

**範例請求**:
```
GET /api/messages/search?q=urgent&conversationId=conv_123&limit=20
```

### GET /conversation/:conversationId
獲取對話的訊息列表

**認證**: ✅ 需要 JWT

**查詢參數**:
- `page`: 頁碼 (預設: 1)
- `pageSize`: 每頁數量 (1-100, 預設: 20)
- `messageType`: 訊息類型過濾
- `senderType`: 發送者類型過濾
- `includeRecalled`: 是否包含撤回訊息 (預設: false)

**回應**:
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
獲取訊息統計

**認證**: ✅ 需要 JWT

**回應**:
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

## 錯誤碼參考

| 錯誤碼 | HTTP狀態 | 描述 |
|--------|---------|------|
| INVALID_JSON | 400 | 無效的JSON數據 |
| VALIDATION_ERROR | 400 | 驗證失敗 |
| MESSAGE_NOT_FOUND | 404 | 訊息不存在 |
| CONVERSATION_NOT_FOUND | 404 | 對話不存在 |
| PERMISSION_DENIED | 403 | 權限不足 |
| RECALL_DEADLINE_EXCEEDED | 400 | 撤回時限已過 |
| FILE_TOO_LARGE | 400 | 檔案過大 (>10MB) |
| INVALID_FILE_TYPE | 400 | 不支援的檔案類型 |
| BATCH_LIMIT_EXCEEDED | 400 | 超過批量操作限制 |
| STORAGE_ERROR | 500 | 儲存服務錯誤 |

---

## 使用範例

### 完整工作流程: 創建 → 轉發 → 標記 → 匯出

```javascript
// 1. 創建訊息
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

// 2. 轉發訊息
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

// 3. 添加標籤
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

// 4. 匯出數據
const exportResponse = await fetch('/api/messages/export?format=json&limit=100', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const exportData = await exportResponse.json();
```

---

## 效能考量

- **批量操作**: 限制為100條訊息/次,避免超時
- **附件上傳**: 檔案大小限制10MB
- **訊息匯出**: 單次最多匯出1000條訊息
- **標籤系統**: 每條訊息最多10個標籤
- **轉發操作**: 一次最多轉發到20個對話

---

## 版本歷史

### v2.0.0 (2025-09-30)
- ✅ 新增批量操作端點 (bulk-create, bulk-delete)
- ✅ 新增附件管理功能
- ✅ 新增訊息轉發功能
- ✅ 新增訊息標記系統
- ✅ 新增數據匯出功能 (JSON/CSV)

### v1.0.0
- 基本CRUD操作
- 搜尋和過濾
- 訊息統計