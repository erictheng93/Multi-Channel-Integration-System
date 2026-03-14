# Tag Management API Reference
# 標籤管理 API 參考文檔

##  (Overview)

標籤系統提供完整的 CRUD 操作、批量處理、使用統計追蹤等功能。標籤可以應用於客戶和對話，支持團隊範圍管理和全局管理。

**版本 (Version)**: 1.0.0
**基礎路徑 (Base Path)**: `/api/tags`

---

##  標籤系統特性

-  **完整 CRUD 操作** - 創建、讀取、更新、刪除標籤
-  **團隊範圍管理** - 支持團隊專屬標籤和全局標籤
-  **批量操作** - 批量激活、停用、更新顏色
-  **使用統計** - 追蹤標籤使用情況和趨勢
-  **客戶關聯** - 管理客戶標籤關係
-  **對話關聯** - 管理對話標籤關係
-  **權限控制** - 基於角色的訪問控制

---

##  認證 (Authentication)

所有端點（除了 `/health`）都需要 JWT 認證：

```
Authorization: Bearer <your_jwt_token>
```

### 權限等級 (Permission Levels)

| 角色 (Role) | 創建全局標籤 | 創建團隊標籤 | 編輯/刪除 |
|------------|------------|------------|----------|
| **Admin** |  |  |  所有標籤 |
| **Agent** |  |  |  僅團隊標籤 |

---

##  API 端點總覽

### 健康檢查 (Health Check)

#### GET /health

檢查標籤處理器運行狀態（無需認證）

**請求範例 (Request Example)**:
```bash
curl https://your-domain.com/api/tags/health
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "handler": "tag-main",
    "timestamp": "2025-11-13T10:00:00.000Z"
  },
  "message": "Tag handler is operational"
}
```

---

##  CRUD 操作

### GET /

獲取標籤列表（支持分頁和篩選）

**認證 (Authentication)**: JWT 必需

**查詢參數 (Query Parameters)**:
| 參數 | 類型 | 必需 | 預設值 | 說明 |
|------|------|------|--------|------|
| `page` | integer |  | 1 | 頁碼 |
| `pageSize` | integer |  | 50 | 每頁筆數 |
| `teamId` | integer |  | - | 篩選特定團隊的標籤 |
| `search` | string |  | - | 搜索標籤名稱或描述 |
| `includeGlobal` | boolean |  | true | 是否包含全局標籤 |

**請求範例 (Request Example)**:
```bash
# 獲取第一頁標籤
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/tags?page=1&pageSize=20"

# 搜索標籤
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/tags?search=urgent&includeGlobal=true"

# 獲取特定團隊的標籤
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/tags?teamId=1"
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "urgent",
        "color": "#EF4444",
        "description": "Urgent matters requiring immediate attention",
        "teamId": 1,
        "teamName": "Customer Support",
        "isActive": true,
        "createdBy": "agent-001",
        "createdByName": "John Doe",
        "customerCount": 45,
        "conversationCount": 32,
        "createdAt": "2025-11-01T10:00:00.000Z",
        "updatedAt": "2025-11-13T10:00:00.000Z"
      },
      {
        "id": 2,
        "name": "follow-up",
        "color": "#3B82F6",
        "description": "Requires follow-up action",
        "teamId": null,
        "teamName": null,
        "isActive": true,
        "createdBy": "admin-001",
        "createdByName": "Admin User",
        "customerCount": 28,
        "conversationCount": 15,
        "createdAt": "2025-11-01T10:00:00.000Z",
        "updatedAt": "2025-11-13T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "hasMore": false
    }
  },
  "message": "Tags retrieved successfully"
}
```

---

### POST /

創建新標籤

**認證 (Authentication)**: JWT 必需

**權限要求 (Permission)**:
- **全局標籤**: 僅管理員 (Admin only)
- **團隊標籤**: 管理員和客服人員 (Admin and Agent)

**請求體 (Request Body)**:
```json
{
  "name": "urgent",
  "color": "#EF4444",
  "description": "Urgent matters requiring immediate attention",
  "teamId": 1
}
```

**欄位說明 (Field Description)**:
| 欄位 | 類型 | 必需 | 說明 |
|------|------|------|------|
| `name` | string |  | 標籤名稱（在同一範圍內唯一） |
| `color` | string |  | 十六進位顏色碼（預設: #3B82F6） |
| `description` | string |  | 標籤描述 |
| `teamId` | integer |  | 團隊 ID（null = 全局標籤） |

**請求範例 (Request Example)**:
```bash
# 創建團隊標籤
curl -X POST https://your-domain.com/api/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "urgent",
    "color": "#EF4444",
    "description": "Urgent matters",
    "teamId": 1
  }'

# 創建全局標籤（僅管理員）
curl -X POST https://your-domain.com/api/tags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vip-customer",
    "color": "#F59E0B",
    "description": "VIP customer tag"
  }'
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "urgent",
    "color": "#EF4444",
    "description": "Urgent matters",
    "teamId": 1,
    "isActive": true,
    "createdBy": "agent-001",
    "customerCount": 0,
    "conversationCount": 0,
    "createdAt": "2025-11-13T10:00:00.000Z",
    "updatedAt": "2025-11-13T10:00:00.000Z"
  },
  "message": "Tag created successfully"
}
```

**錯誤回應 (Error Response)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      {
        "field": "name",
        "message": "Tag name already exists in this scope"
      }
    ]
  }
}
```

---

### GET /:id

獲取單一標籤詳情（包含使用統計）

**認證 (Authentication)**: JWT 必需

**路徑參數 (Path Parameters)**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | integer | 標籤 ID |

**請求範例 (Request Example)**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/tags/1
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "urgent",
    "color": "#EF4444",
    "description": "Urgent matters requiring immediate attention",
    "teamId": 1,
    "teamName": "Customer Support",
    "isActive": true,
    "createdBy": "agent-001",
    "createdByName": "John Doe",
    "customerCount": 45,
    "conversationCount": 32,
    "createdAt": "2025-11-01T10:00:00.000Z",
    "updatedAt": "2025-11-13T10:00:00.000Z"
  },
  "message": "Tag retrieved successfully"
}
```

---

### PUT /:id

更新標籤資訊

**認證 (Authentication)**: JWT 必需

**權限要求 (Permission)**:
- **管理員**: 可以編輯所有標籤
- **客服人員**: 只能編輯自己團隊的標籤

**路徑參數 (Path Parameters)**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | integer | 標籤 ID |

**請求體 (Request Body)**:
```json
{
  "name": "urgent-priority",
  "color": "#DC2626",
  "description": "Updated description",
  "isActive": true
}
```

**欄位說明 (Field Description)**:
| 欄位 | 類型 | 必需 | 說明 |
|------|------|------|------|
| `name` | string |  | 新的標籤名稱 |
| `color` | string |  | 新的顏色碼 |
| `description` | string |  | 新的描述 |
| `isActive` | boolean |  | 是否啟用 |

**請求範例 (Request Example)**:
```bash
curl -X PUT https://your-domain.com/api/tags/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "urgent-priority",
    "color": "#DC2626",
    "description": "Updated urgent tag"
  }'
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "urgent-priority",
    "color": "#DC2626",
    "description": "Updated urgent tag",
    "teamId": 1,
    "isActive": true,
    "createdBy": "agent-001",
    "customerCount": 45,
    "conversationCount": 32,
    "createdAt": "2025-11-01T10:00:00.000Z",
    "updatedAt": "2025-11-13T10:15:00.000Z"
  },
  "message": "Tag updated successfully"
}
```

---

### DELETE /:id

刪除標籤（軟刪除）

**認證 (Authentication)**: JWT 必需

**權限要求 (Permission)**:
- **管理員**: 可以刪除所有標籤
- **客服人員**: 只能刪除自己團隊的標籤

**路徑參數 (Path Parameters)**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | integer | 標籤 ID |

**請求範例 (Request Example)**:
```bash
curl -X DELETE https://your-domain.com/api/tags/1 \
  -H "Authorization: Bearer $TOKEN"
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": null,
  "message": "Tag deleted successfully"
}
```

**注意事項 (Notes)**:
- 這是軟刪除，標籤的 `isActive` 欄位會被設為 `false`
- 已關聯的客戶和對話標籤不會被刪除
- 標籤可以透過更新操作重新激活

---

##  批量操作

### POST /bulk

批量操作標籤

**認證 (Authentication)**: JWT 必需

**請求體 (Request Body)**:
```json
{
  "operation": "activate|deactivate|update_color",
  "tagIds": [1, 2, 3],
  "data": {
    "color": "#3B82F6"
  }
}
```

**欄位說明 (Field Description)**:
| 欄位 | 類型 | 必需 | 說明 |
|------|------|------|------|
| `operation` | string |  | 操作類型: `activate`, `deactivate`, `update_color` |
| `tagIds` | array |  | 標籤 ID 陣列 |
| `data` | object |  | 操作相關數據（update_color 時必需） |

**請求範例 (Request Examples)**:

```bash
# 批量激活標籤
curl -X POST https://your-domain.com/api/tags/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "activate",
    "tagIds": [1, 2, 3]
  }'

# 批量停用標籤
curl -X POST https://your-domain.com/api/tags/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "deactivate",
    "tagIds": [4, 5, 6]
  }'

# 批量更新顏色
curl -X POST https://your-domain.com/api/tags/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "update_color",
    "tagIds": [1, 2, 3],
    "data": {
      "color": "#10B981"
    }
  }'
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": null,
  "message": "Bulk activate completed successfully"
}
```

---

##  統計與分析

### GET /:id/stats

獲取標籤使用統計

**認證 (Authentication)**: JWT 必需

**路徑參數 (Path Parameters)**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | integer | 標籤 ID |

**請求範例 (Request Example)**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/tags/1/stats
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "tagInfo": {
      "id": 1,
      "name": "urgent",
      "color": "#EF4444"
    },
    "customers": {
      "total": 45,
      "byPlatform": {
        "line": 32,
        "facebook": 13
      }
    },
    "conversations": {
      "total": 32,
      "active": 18,
      "closed": 14
    },
    "usageTrend": [
      {
        "date": "2025-11-13",
        "assignments": 8
      },
      {
        "date": "2025-11-12",
        "assignments": 5
      }
    ],
    "topAssigners": [
      {
        "name": "John Doe",
        "assignments": 15
      },
      {
        "name": "Jane Smith",
        "assignments": 12
      }
    ]
  },
  "message": "Tag usage statistics retrieved successfully"
}
```

**數據說明 (Data Description)**:
- **customers**: 使用該標籤的客戶統計
  - `total`: 總客戶數
  - `byPlatform`: 按平台分組的客戶數
- **conversations**: 使用該標籤的對話統計
  - `total`: 總對話數
  - `active`: 活躍對話數
  - `closed`: 已關閉對話數
- **usageTrend**: 最近 30 天的使用趨勢
- **topAssigners**: 最活躍的標籤指派者（最近 30 天）

---

### GET /:id/customers

獲取使用該標籤的客戶列表

**認證 (Authentication)**: JWT 必需

**路徑參數 (Path Parameters)**:
| 參數 | 類型 | 說明 |
|------|------|------|
| `id` | integer | 標籤 ID |

**查詢參數 (Query Parameters)**:
| 參數 | 類型 | 必需 | 預設值 | 說明 |
|------|------|------|--------|------|
| `page` | integer |  | 1 | 頁碼 |
| `limit` | integer |  | 50 | 每頁筆數（最大 100） |

**請求範例 (Request Example)**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/tags/1/customers?page=1&limit=20"
```

**回應範例 (Response Example)**:
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": 123,
        "platform": "line",
        "platformUserId": "U1234567890abcdef",
        "displayName": "John Customer",
        "avatarUrl": "https://...",
        "email": "john@example.com",
        "phone": "+886912345678",
        "createdAt": "2025-10-01T10:00:00.000Z",
        "assignedAt": "2025-11-13T10:00:00.000Z",
        "assignedBy": "agent-001"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "message": "Tag customers retrieved successfully"
}
```

---

##  錯誤碼 (Error Codes)

| 錯誤碼 | HTTP 狀態碼 | 說明 |
|--------|------------|------|
| VALIDATION_ERROR | 400 | 驗證失敗（欄位錯誤） |
| TAG_NOT_FOUND | 404 | 標籤不存在 |
| PERMISSION_DENIED | 403 | 權限不足 |
| UNAUTHORIZED | 401 | 未授權（Token 無效或過期） |
| DUPLICATE_TAG_NAME | 400 | 標籤名稱重複 |
| INVALID_OPERATION | 400 | 無效的批量操作類型 |
| INTERNAL_ERROR | 500 | 伺服器內部錯誤 |

### 錯誤回應格式 (Error Response Format)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "errors": [
      {
        "field": "name",
        "message": "Tag name is required"
      }
    ]
  },
  "timestamp": "2025-11-13T10:00:00.000Z"
}
```

---

##  使用範例 (Usage Examples)

### 範例 1: 創建並管理標籤

```javascript
// 1. 創建新標籤
const createResponse = await fetch('/api/tags', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'urgent',
    color: '#EF4444',
    description: 'Urgent matters',
    teamId: 1
  })
});
const { data: tag } = await createResponse.json();

// 2. 獲取標籤詳情
const tagResponse = await fetch(`/api/tags/${tag.id}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 3. 更新標籤
await fetch(`/api/tags/${tag.id}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    description: 'Updated description'
  })
});
```

### 範例 2: 批量管理標籤

```javascript
// 批量停用不常用的標籤
await fetch('/api/tags/bulk', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'deactivate',
    tagIds: [5, 6, 7, 8]
  })
});

// 批量更新顏色以統一風格
await fetch('/api/tags/bulk', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'update_color',
    tagIds: [1, 2, 3],
    data: { color: '#3B82F6' }
  })
});
```

### 範例 3: 獲取標籤統計並生成報表

```javascript
// 獲取標籤統計
const statsResponse = await fetch('/api/tags/1/stats', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { data: stats } = await statsResponse.json();

// 生成使用趨勢圖表
const trendData = stats.usageTrend.map(item => ({
  date: item.date,
  count: item.assignments
}));

// 獲取使用該標籤的客戶列表
const customersResponse = await fetch('/api/tags/1/customers?page=1&limit=50', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { data: customerData } = await customersResponse.json();
```

---

##  限制與約束 (Limits & Constraints)

| 項目 | 限制值 | 說明 |
|------|--------|------|
| **標籤名稱長度** | 1-50 字符 | 名稱不可為空 |
| **描述長度** | 最多 500 字符 | 可選欄位 |
| **顏色格式** | 十六進位色碼 | 例如: #3B82F6 |
| **批量操作數量** | 最多 100 個標籤 | 一次批量操作 |
| **客戶列表每頁** | 最多 100 筆 | 預設 50 筆 |
| **標籤列表每頁** | 最多 100 筆 | 預設 50 筆 |
| **團隊標籤唯一性** | 團隊內唯一 | 同一團隊不可重複 |
| **全局標籤唯一性** | 全局唯一 | 全局標籤名稱不可重複 |

---

##  版本歷史 (Version History)

### v1.0.0 (2025-11-13)
-  初始版本發布
-  完整 CRUD 操作
-  批量操作支持
-  使用統計和趨勢分析
-  客戶列表查詢
-  團隊範圍和全局標籤支持
-  權限控制和驗證

---

##  相關文檔 (Related Documentation)

- [Tag Management Guide](../TAG_MANAGEMENT_GUIDE.md) - 標籤管理完整指南
- [Messaging API Reference](./MESSAGING_API_REFERENCE.md) - 訊息標籤整合
- [Team Management Guide](../TEAM_MANAGEMENT_GUIDE.md) - 團隊管理指南
- [Authentication Guide](../AUTH_GUIDE.md) - 認證和授權指南

---

##  支援 (Support)

如有問題或建議，請聯繫：
- **文檔倉庫**: GitHub Issues
- **技術支援**: 查看 CLAUDE.md 主要文檔

---

**文檔生成日期**: 2025-11-13
**維護者**: Development Team
**狀態**:  Production Ready
