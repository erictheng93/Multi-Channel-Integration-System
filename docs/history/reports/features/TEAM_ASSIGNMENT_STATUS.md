#  團隊指派功能實現狀態報告

##  (Current Status Overview)

### 實現狀態總結

```
後端支持度:  80% (API 完成, 權限需加強)
前端支持度:  0% (尚未實現 UI)
整體可用性: 部分完成 (需前端開發)
```

---

## / (Detailed Analysis)

### 1️ **後端實現 - 已完成 80%**

####  數據庫層面 - 100% 完成

**位置**: `src/db/schema.ts:94`

```typescript
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  customerId: integer('customer_id').notNull(),
  assignedTeamId: integer('assigned_team_id').references(() => teams.id), //  支持團隊指派
  assignedUserId: text('assigned_user_id').references(() => agents.id), //  支持個人指派
  status: text('status').notNull().default('active'),
  // ...
});
```

**支持功能**:
-  可以指派給團隊 (`assignedTeamId`)
-  可以指派給個人 (`assignedUserId`)
-  可以同時指派 (團隊 + 個人)
-  可以單獨指派團隊或個人

---

####  API 層面 - 完成但權限需加強

**位置**: `src/handlers/conversation.ts:263-299`

```typescript
conversations.post('/:id/assign', async (c) => {
  const { teamId, userId, reason } = await c.req.json();

  // 權限檢查 - 需要加強
  const hasPermission = await PermissionService.checkPermission(
    agent!.id,
    'conversation',
    'assign'  // 此動作未在 Agent 權限列表中定義
  );

  if (!hasPermission) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }

  // 支持團隊和個人指派
  await drizzleDb.update(conversationTable)
    .set({
      assignedTeamId: teamId || null,  //  接受 teamId 參數
      assignedUserId: userId || null, //  接受 userId 參數
      status: 'assigned',
      updatedAt: sql`datetime('now')`
    })
    .where(eq(conversationTable.id, conversationId));
});
```

**API 端點**:
- `POST /conversations/:id/assign`
- 請求參數: `{ teamId?, userId?, reason? }`
- 回應: `{ success: boolean, message: string }`

---

####  權限控制 - 需要加強

**位置**: `src/services/permission-service.ts:30-52`

**目前權限定義**:

```typescript
admin: {
  permissions: [
    { resource: '*', action: '*' }  //  Admin 有完整權限
  ]
},
agent: {
  permissions: [
    { resource: 'conversation', action: 'view' },
    { resource: 'conversation', action: 'reply', conditions: { assigned: true } },
    // 沒有定義 'assign' 動作
  ]
}
```

**問題分析**:

| 角色 | 現狀 | 預期行為 | 問題 |
|------|------|---------|------|
| **Admin** |  有權限 |  應該有權限 | 無問題 |
| **Agent** |  未定義 |  不應該有權限 | 權限定義缺失 |

**建議修正**:

```typescript
// 方案 1: 明確禁止 Agent 的 assign 權限 (推薦)
// 在 PermissionService.checkPermission 中加強檢查
// 如果找不到對應權限定義，預設拒絕訪問

// 方案 2: 加入中間件
// 在 conversation.ts 的 /assign 端點加上 requireAdmin() 中間件
conversations.post('/:id/assign', jwtAuth, requireAdmin(), async (c) => {
  // ...
});
```

---

### 2️ **前端實現 - 0% 完成**

####  API 層面 - 不支持團隊指派

**位置**: `frontend/src/api/conversations.ts:237-241`

```typescript
// 現有的 API 函數 - 僅支持個人指派
assignConversation: async (conversationId: string, agentId: string): Promise<ApiResponse<void>> => {
  // 只傳送 agentId，沒有 teamId 參數
  return apiClient.put(`/conversations/${conversationId}/assign`, { agentId });
}
```

**需要修改為**:

```typescript
// 建議的新 API 函數 - 支持團隊和個人指派
assignConversation: async (
  conversationId: string,
  options: {
    teamId?: number; //  新增團隊 ID
    userId?: string; //  個人 ID (可選)
    reason?: string; //  指派原因
  }
): Promise<ApiResponse<void>> => {
  return apiClient.post(`/conversations/${conversationId}/assign`, options);
}
```

---

####  UI 層面 - 沒有團隊指派選項

**位置**: `frontend/src/components/conversation/AdvancedAssignActions.vue`

**現有功能**:
-  指派給個人成員
-  成員搜尋和篩選
-  角色篩選 (全部/管理員/客服)
-  **沒有團隊指派選項**

**缺少的 UI 元素**:

```
需要新增:
┌────────────────────────────────────┐
│  指派對話 │
├────────────────────────────────────┤
│ 指派給個人 │
│ 指派給團隊  ←  需要新增 │
├────────────────────────────────────┤
│  [選擇成員/團隊的下拉選單] │
└────────────────────────────────────┘
```

---

## (Implementation Comparison)

### 功能對比表

| 功能 | 後端支持 | 前端支持 | 狀態 |
|------|---------|---------|------|
| **數據庫欄位** |  `assignedTeamId` | N/A | 完成 |
| **API 接受參數** |  `teamId`, `userId` |  僅 `agentId` | 後端完成 |
| **權限控制** |  需加強 | N/A | 需改進 |
| **UI 介面** | N/A |  無團隊選項 | 未實現 |
| **下拉選單** | N/A |  僅成員列表 | 未實現 |

---

## (What Works & What Doesn't)

###  目前可以做到的

#### 透過 API 直接調用 (繞過前端)

```bash
# Admin 可以透過 API 指派對話給團隊
curl -X POST https://your-domain.com/conversations/conv-123/assign \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": 1,
    "reason": "指派給業務團隊處理"
  }'

# 結果:  成功指派給團隊
```

#### 數據庫層面

```sql
--  數據庫可以正確儲存團隊指派
UPDATE conversations
SET assigned_team_id = 1,
    assigned_user_id = NULL,
    status = 'assigned'
WHERE id = 'conv-123';
```

---

###  目前不能做到的

#### 1. 前端 UI 操作

```
Admin 登入前端系統
  ↓
進入對話詳情頁面
  ↓
點擊「重新指派」按鈕
  ↓
 只看到成員列表，沒有團隊選項
  ↓
無法透過 UI 指派給團隊
```

#### 2. Agent 權限控制不明確

```typescript
Agent 調用 API:
POST /conversations/123/assign
{ "teamId": 1 }

結果:  可能成功 (因為權限檢查不夠嚴格)
預期:  應該返回 403 Forbidden
```

---

##  (Implementation Roadmap)

### 需要完成的工作

#### Phase 1: 權限加強 (1-2 小時)

```typescript
// src/handlers/conversation.ts

// 方案 A: 加入 requireAdmin 中間件 (推薦)
conversations.post('/:id/assign', jwtAuth, requireAdmin(), async (c) => {
  const { teamId, userId, reason } = await c.req.json();

  // Admin 可以指派給團隊或個人
  await drizzleDb.update(conversationTable)
    .set({
      assignedTeamId: teamId || null,
      assignedUserId: userId || null,
      status: 'assigned',
      updatedAt: sql`datetime('now')`
    })
    .where(eq(conversationTable.id, conversationId));
});

// 方案 B: 在權限服務中明確定義 (備選)
// src/services/permission-service.ts
admin: {
  permissions: [
    { resource: 'conversation', action: 'assign' }  // 明確定義
  ]
}
```

---

#### Phase 2: 前端 API 層 (30分鐘)

```typescript
// frontend/src/api/conversations.ts

export interface AssignOptions {
  teamId?: number; // 團隊 ID
  userId?: string; // 個人 ID
  reason?: string; // 指派原因
}

export const conversationApi = {
  // 更新 API 函數支持團隊指派
  assignConversation: async (
    conversationId: string,
    options: AssignOptions
  ): Promise<ApiResponse<void>> => {
    return apiClient.post(`/conversations/${conversationId}/assign`, options);
  },

  // 新增:取得所有團隊列表
  getTeams: async (): Promise<ApiResponse<Team[]>> => {
    return apiClient.get('/teams');
  }
};
```

---

#### Phase 3: 前端 UI 開發 (2-3 小時)

**3.1 修改 AdvancedAssignActions.vue**

```vue
<template>
  <div class="advanced-assign-actions">
    <!--  新增:指派類型選擇 -->
    <div class="assign-type-selector">
      <label>
        <input type="radio" v-model="assignType" value="user" />
        指派給個人
      </label>
      <label>
        <input type="radio" v-model="assignType" value="team" />
        指派給團隊
      </label>
    </div>

    <!--  新增:團隊選擇器 (當選擇「指派給團隊」時顯示) -->
    <div v-if="assignType === 'team'" class="team-selector">
      <select v-model="selectedTeamId">
        <option value="">請選擇團隊</option>
        <option v-for="team in teams" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
    </div>

    <!--  現有:成員選擇器 (當選擇「指派給個人」時顯示) -->
    <div v-else class="members-section">
      <!-- 現有的成員列表 -->
    </div>

    <!--  更新:確認按鈕 -->
    <button @click="confirmAssign">
      {{ assignType === 'team' ? '指派給團隊' : '指派給成員' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { conversationApi } from '@/api/conversations';
import { teamApi } from '@/api/team';

const assignType = ref<'user' | 'team'>('user');
const selectedTeamId = ref<number | null>(null);
const teams = ref<Team[]>([]);

// 載入團隊列表
onMounted(async () => {
  const response = await teamApi.getTeams();
  if (response.success) {
    teams.value = response.data;
  }
});

// 確認指派
const confirmAssign = async () => {
  if (assignType.value === 'team' && selectedTeamId.value) {
    // 指派給團隊
    await conversationApi.assignConversation(props.conversation.id, {
      teamId: selectedTeamId.value
    });
  } else if (assignType.value === 'user' && selectedMember.value) {
    // 指派給個人
    await conversationApi.assignConversation(props.conversation.id, {
      userId: selectedMember.value.id
    });
  }
};
</script>
```

**3.2 新增團隊選擇組件 (可選)**

```vue
<!--  frontend/src/components/conversation/TeamSelector.vue -->
<template>
  <div class="team-selector">
    <div class="team-search">
      <input
        v-model="searchTerm"
        placeholder="搜尋團隊..."
        type="text"
      />
    </div>
    <div class="team-list">
      <div
        v-for="team in filteredTeams"
        :key="team.id"
        class="team-item"
        :class="{ 'selected': selectedTeam?.id === team.id }"
        @click="selectTeam(team)"
      >
        <div class="team-icon">
          <TeamsIcon />
        </div>
        <div class="team-info">
          <div class="team-name">{{ team.name }}</div>
          <div class="team-meta">
            {{ team.memberCount }} 位成員
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

---

#### Phase 4: 測試 (1 小時)

**4.1 權限測試**

```bash
#  Admin 應該可以指派給團隊
curl -X POST /conversations/123/assign \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"teamId": 1}'

# Expected: 200 OK

#  Agent 不應該可以指派
curl -X POST /conversations/123/assign \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -d '{"teamId": 1}'

# Expected: 403 Forbidden
```

**4.2 UI 測試清單**

- [ ] Admin 登入後可以看到「指派給團隊」選項
- [ ] 可以從下拉選單選擇團隊
- [ ] 點擊確認後對話成功指派給團隊
- [ ] 對話詳情頁面顯示「已指派給 XXX 團隊」
- [ ] Agent 登入後看不到團隊指派選項 (或按鈕disabled)

---

##  總結

### 回答您的問題

> **我需要 Admin 可以指派某一個對話給某一個團隊 Team, Agent 沒有這個權限，目前已經辦到了嗎？**

**答案**:  **部分完成**

####  已完成的部分:

1. **數據庫層面** - 100% 支持
   - `conversations` 表有 `assignedTeamId` 欄位
   - 可以正確儲存團隊指派資料

2. **後端 API** - 80% 支持
   - `POST /conversations/:id/assign` 接受 `teamId` 參數
   - 可以成功指派對話給團隊
   -  但權限控制需要加強

####  未完成的部分:

1. **權限控制不夠嚴格** - 需改進
   - Agent 的 `assign` 權限未明確定義為禁止
   - 建議在 API 端點加上 `requireAdmin()` 中間件

2. **前端完全未實現** - 0%
   - 前端 API 層不支持 `teamId` 參數
   - UI 沒有團隊選擇的下拉選單
   - Admin 無法透過介面指派給團隊

---

### 建議行動方案

####  快速修復 (30分鐘)

如果您只需要 Admin 能用,且可以接受透過 API 直接調用:

```typescript
// src/handlers/conversation.ts
// 加上這一行中間件
conversations.post('/:id/assign', jwtAuth, requireAdmin(), async (c) => {
  // ... 現有代碼
});
```

 這樣就能確保只有 Admin 可以指派,Agent 會收到 403 錯誤。

####  完整實現 (4-6 小時)

如果需要完整的 UI 功能:

1. **權限加強** (30分鐘) - 加上 `requireAdmin()` 中間件
2. **前端 API** (30分鐘) - 修改 `assignConversation` 支持 `teamId`
3. **前端 UI** (2-3小時) - 添加團隊選擇器和下拉選單
4. **測試** (1小時) - 完整測試權限和 UI 流程

---

 報告日期: 2025-10-23
 狀態: 後端已完成 80%, 前端待開發
 優先級: 建議先加強權限控制,再開發前端 UI
