# 前後端類型一致性分析報告

**生成時間**: 2025-11-04
**分析範圍**: Customer/User 實體字段定義

---

##  問題總結

發現**關鍵的前後端類型不一致**問題：

| 層級 | 期望字段 | 實際字段 | 狀態 |
|------|---------|---------|------|
| **共享類型定義** | `User.name: string` | N/A |  已定義 |
| **數據庫 Schema** | N/A | `customers.displayName` |  不匹配 |
| **後端 API (GET /:id)** | `customer.name` | `customer.name` + `customer.displayName` |  已修復 |
| **後端 API (POST /:id/assign)** | `customer.name` | `customer.name` + `customer.displayName` |  已修復 |
| **後端 API (POST /:id/unassign)** | `customer.name` | `customer.name` + `customer.displayName` |  已修復 |
| **後端 API (GET /)** | `customer.name` | `customerName` (扁平結構) |  **需要修復** |
| **前端組件** | `customer.name` | `customer.name` |  正確使用 |

---

##  詳細分析

### 1. 共享類型定義 (shared/types/entities.ts)

**User 接口定義**:
```typescript
export interface User {
  id: EntityId
  name: string // ← 定義為 name
  platform: Platform
  platformUserId: string
  avatarUrl?: string
  createdAt: Timestamp
}

export type Customer = User  // Customer 是 User 的別名
```

**分析**:
-  類型定義清晰
-  Customer 正確映射到 User
- 期望 `name` 字段，但數據庫使用 `displayName`

---

### 2. 數據庫 Schema (src/db/schema.ts)

**customers 表定義**:
```typescript
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey(),
  platform: text('platform').notNull(),
  platformUserId: text('platform_user_id').notNull(),
  displayName: text('display_name'),  // ← 數據庫字段名
  avatarUrl: text('avatar_url'),
  // ... 其他字段
});
```

**分析**:
-  數據庫使用 `displayName`，但類型定義期望 `name`
-  字段名稱不一致導致需要手動映射

---

### 3. 後端 API 返回字段

#### 3.1 GET /api/conversations/:id ( 已修復)

**修復後返回結構**:
```typescript
customer: {
  id: 1,
  name: customers.displayName, //  添加 name 映射
  displayName: customers.displayName, //  保留向後兼容
  platformUserId: "...",
  platform: "line",
  avatarUrl: "...",
  // ...
}
```

**狀態**:  **已修復** (2025-11-04)

---

#### 3.2 POST /api/conversations/:id/assign ( 已修復)

**修復後返回結構**:
```typescript
customer: updatedConversation.customers ? {
  ...updatedConversation.customers,
  name: updatedConversation.customers.displayName  //  添加 name 映射
} : undefined
```

**狀態**:  **已修復** (2025-11-04)

---

#### 3.3 POST /api/conversations/:id/unassign ( 已修復)

**修復後返回結構**:
```typescript
customer: updatedConversation?.customers ? {
  id: updatedConversation.customers.id,
  name: updatedConversation.customers.displayName, //  添加 name 映射
  displayName: updatedConversation.customers.displayName,
  // ...
} : undefined
```

**狀態**:  **已修復** (2025-11-04)

---

#### 3.4 GET /api/conversations/ ( **需要修復**)

**當前返回結構** (扁平):
```typescript
{
  id: "...",
  customerId: 1,
  assignedTeamId: 14,
  status: "assigned",
  // 扁平的客戶字段 
  customerName: "Eric Vrataski",
  platform: "line",
  platformUserId: "U7aed...",
  // 沒有嵌套的 customer 對象 
}
```

**前端期望結構** (嵌套):
```typescript
{
  id: "...",
  customerId: 1,
  assignedTeamId: 14,
  status: "assigned",
  // 完整的 customer 對象 
  customer: {
    id: 1,
    name: "Eric Vrataski", // ← 前端使用 customer.name
    displayName: "Eric Vrataski",
    platform: "line",
    platformUserId: "U7aed...",
    avatarUrl: "..."
  }
}
```

**影響範圍**:
- `frontend/src/components/conversation/ConversationCard.vue` - 使用 `conversation.customer?.name`
- `frontend/src/views/ConversationsTable.vue` - 列表顯示
- `frontend/src/composables/useConversations.ts` - 對話列表邏輯

**狀態**:  **需要修復**

---

### 4. 前端組件使用情況

#### 4.1 使用 customer.name 的文件列表

1. `ConversationHeader.vue:19` - 對話標題顯示
2. `ConversationCard.vue:138` - 卡片顯示
3. `ConversationsTable.vue` - 列表表格
4. `ConversationDetail.vue` - 詳情頁
5. `DelayedMessageSender.vue` - 延遲消息
6. `ActivityLog.vue` - 活動日誌
7. `useConversations.ts` - Composable
8. `dataProcessor.worker.ts` - Web Worker

**分析**:
-  前端一致使用 `customer.name`
-  沒有使用 `customer.displayName`
-  類型使用正確

---

##  修復方案

### 優先級 1: 修復 GET /api/conversations/ (列表 API) 

**位置**: `src/modules/conversations/handlers/conversation-main.ts:1317-1336`

**當前代碼** (扁平結構):
```typescript
const conversationData = await drizzleDb
  .select({
    // 對話資料
    id: conversations.id,
    customerId: conversations.customerId,
    assignedTeamId: conversations.assignedTeamId,
    assignedUserId: conversations.assignedUserId,
    status: conversations.status,
    lastMessageAt: conversations.lastMessageAt,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    // 客戶資料 (扁平) 
    customerName: customers.displayName,
    platform: customers.platform,
    platformUserId: customers.platformUserId
  })
  .from(conversations)
  .leftJoin(customers, eq(conversations.customerId, customers.id))
  .where(inArray(conversations.id, visibleConversationIds))
  .orderBy(desc(conversations.updatedAt));
```

**建議修改** (嵌套結構):
```typescript
// 使用完整 JOIN 查詢，返回嵌套對象
const conversationResults = await drizzleDb
  .select()
  .from(conversations)
  .leftJoin(customers, eq(conversations.customerId, customers.id))
  .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
  .where(inArray(conversations.id, visibleConversationIds))
  .orderBy(desc(conversations.updatedAt));

// 構建完整的對話對象數組
const conversationData = conversationResults.map(result => ({
  ...result.conversations,
  // 完整的 customer 對象 
  customer: result.customers ? {
    id: result.customers.id,
    name: result.customers.displayName, //  映射到 name
    displayName: result.customers.displayName, // 保留向後兼容
    platform: result.customers.platform,
    platformUserId: result.customers.platformUserId,
    avatarUrl: result.customers.avatarUrl,
    createdAt: result.customers.createdAt
  } : undefined,
  // 完整的 assignedTeam 對象 
  assignedTeam: result.teams ? {
    id: result.teams.id,
    name: result.teams.name,
    description: result.teams.description
  } : undefined
}));
```

**預期效果**:
-  前端 ConversationCard 正常顯示消費者名字
-  所有使用 customer.name 的組件正常工作
-  與詳情 API 保持一致的數據結構

---

### 優先級 2: 統一所有 API 返回結構

確保以下 API 都返回一致的嵌套對象結構：

1.  `GET /api/conversations/:id` - 已修復
2.  `POST /api/conversations/:id/assign` - 已修復
3.  `POST /api/conversations/:id/unassign` - 已修復
4.  `GET /api/conversations/` - **待修復**
5. `POST /api/conversations/:id/transfer` - 需要檢查
6. `POST /api/conversations/:id/close` - 需要檢查

---

##  數據映射規範

為了保持前後端一致性，建立以下映射規範：

### Customer/User 對象映射

| 數據庫字段 | API 返回字段 | 共享類型字段 | 說明 |
|-----------|------------|------------|------|
| `customers.id` | `customer.id` | `User.id` | 主鍵 |
| `customers.display_name` | **`customer.name`** | **`User.name`** |  主要顯示名稱 |
| `customers.display_name` | `customer.displayName` | N/A | 向後兼容 |
| `customers.platform_user_id` | `customer.platformUserId` | `User.platformUserId` | 平台用戶ID |
| `customers.platform` | `customer.platform` | `User.platform` | 平台類型 |
| `customers.avatar_url` | `customer.avatarUrl` | `User.avatarUrl` | 頭像 |
| `customers.created_at` | `customer.createdAt` | `User.createdAt` | 創建時間 |

### Conversation 對象結構

```typescript
{
  // 對話基本信息
  id: string
  customerId: number
  assignedTeamId?: number
  assignedUserId?: string
  status: 'active' | 'assigned' | 'pending' | 'closed'

  // 嵌套對象 (必須完整返回)
  customer: { //  完整對象
    id: number
    name: string //  主要字段
    displayName: string // 向後兼容
    platform: string
    platformUserId: string
    avatarUrl?: string
    createdAt: string
  }

  assignedTeam?: { //  完整對象
    id: number
    name: string
    description?: string
  }

  assignedAgent?: { //  完整對象 (如果有)
    id: string
    name: string
    displayName: string
    email: string
  }

  // 其他字段...
}
```

---

##  實施檢查清單

### 後端修復
- [x] GET /api/conversations/:id - 返回 customer.name
- [x] POST /api/conversations/:id/assign - 返回 customer.name
- [x] POST /api/conversations/:id/unassign - 返回 customer.name
- [ ] **GET /api/conversations/ - 返回完整 customer 對象**  **優先**
- [ ] POST /api/conversations/:id/transfer - 檢查並修復
- [ ] POST /api/conversations/:id/close - 檢查並修復

### 前端驗證
- [ ] ConversationCard 正常顯示消費者名字
- [ ] ConversationsTable 列表正常顯示
- [ ] ConversationDetail 詳情頁正常顯示
- [ ] 所有使用 customer.name 的組件正常工作

### 文檔更新
- [ ] 更新 API 文檔，明確返回結構
- [ ] 更新類型定義文檔
- [ ] 添加映射規範文檔

---

##  建議

1. **建立類型檢查機制**:
   - 在 CI/CD 中添加 TypeScript 嚴格檢查
   - 確保前後端使用相同的共享類型定義

2. **統一數據轉換層**:
   - 創建統一的數據轉換函數
   - 所有 API 都使用相同的轉換邏輯

3. **API 響應格式標準化**:
   - 所有相關 API 返回一致的數據結構
   - 避免扁平和嵌套混用

4. **測試覆蓋**:
   - 為每個 API 添加返回結構測試
   - 確保所有必要字段都存在

---

##  預期結果

修復完成後：

1.  所有 API 返回一致的嵌套對象結構
2.  前端組件正常顯示消費者名字
3.  類型定義與實際使用完全一致
4.  向後兼容性得到保持 (displayName 字段保留)
5.  減少未來的類型不匹配問題

---

**報告結束**
