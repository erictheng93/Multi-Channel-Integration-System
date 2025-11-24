# Tag Management System Guide
# 標籤管理系統完整指南

## 📋 目錄 (Table of Contents)

1. [系統概覽](#-系統概覽-overview)
2. [核心概念](#-核心概念-core-concepts)
3. [標籤生命週期](#-標籤生命週期-tag-lifecycle)
4. [團隊範圍管理](#-團隊範圍管理-team-scope-management)
5. [客戶標籤整合](#-客戶標籤整合-customer-tag-integration)
6. [對話標籤整合](#-對話標籤整合-conversation-tag-integration)
7. [批量操作](#-批量操作-bulk-operations)
8. [統計與分析](#-統計與分析-statistics--analytics)
9. [權限與訪問控制](#-權限與訪問控制-permissions--access-control)
10. [最佳實踐](#-最佳實踐-best-practices)
11. [常見問題](#-常見問題-faq)
12. [故障排除](#-故障排除-troubleshooting)

---

## 🎯 系統概覽 (Overview)

### 什麼是標籤系統？

標籤系統是多渠道客服平台的核心分類和組織工具，允許團隊為客戶和對話添加靈活的標記，以便：

- 📊 **分類管理** - 對客戶和對話進行邏輯分組
- 🔍 **快速檢索** - 通過標籤快速找到相關客戶或對話
- 📈 **數據分析** - 追蹤標籤使用趨勢和模式
- 🎨 **視覺識別** - 使用顏色編碼快速識別重要性
- 👥 **團隊協作** - 團隊內共享標籤語義和使用規範

### 核心特性

```
┌─────────────────────────────────────────────────────────────┐
│  標籤系統核心特性                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 完整 CRUD 操作     ✅ 團隊範圍管理                        │
│  ✅ 批量操作支持       ✅ 客戶關聯                            │
│  ✅ 對話關聯          ✅ 使用統計追蹤                          │
│  ✅ 顏色編碼          ✅ 軟刪除機制                           │
│  ✅ 權限控制          ✅ 搜索與篩選                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 系統架構

```
┌──────────────────────────────────────────────────────────────┐
│                    標籤系統架構圖                               │
└──────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   Tag System    │
                    │   (Core)        │
                    └────────┬────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
         ┌──────▼──────┐    │    ┌──────▼──────┐
         │   Global    │    │    │    Team     │
         │    Tags     │    │    │    Tags     │
         └──────┬──────┘    │    └──────┬──────┘
                │           │           │
                └───────────┼───────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │                                     │
   ┌─────▼─────┐                        ┌─────▼─────┐
   │ Customer  │                        │Conversation│
   │   Tags    │                        │   Tags    │
   └───────────┘                        └───────────┘
```

### 數據庫表結構

```sql
-- 標籤主表
CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  team_id INTEGER REFERENCES teams(id),  -- NULL = 全局標籤
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT NOT NULL REFERENCES agents(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, team_id)  -- 團隊內唯一
);

-- 客戶標籤關聯表
CREATE TABLE customer_tags (
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  assigned_by TEXT NOT NULL REFERENCES agents(id),
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, tag_id)
);

-- 對話標籤關聯表
CREATE TABLE conversation_tags (
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  assigned_by TEXT NOT NULL REFERENCES agents(id),
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, tag_id)
);
```

---

## 💡 核心概念 (Core Concepts)

### 標籤類型 (Tag Types)

#### 1. 全局標籤 (Global Tags)
- **範圍**: 整個系統
- **可見性**: 所有團隊和客服人員
- **創建權限**: 僅管理員
- **使用場景**: 系統級分類（如 VIP、Urgent、Follow-up）
- **數據庫標識**: `team_id = NULL`

```
┌────────────────────────────────────────┐
│        Global Tags (全局標籤)           │
├────────────────────────────────────────┤
│  🌐 VIP Customer                       │
│  ⚠️  Urgent                            │
│  📝 Follow-up Required                 │
│  ✅ Resolved                           │
│  🚫 Complaint                          │
└────────────────────────────────────────┘
```

#### 2. 團隊標籤 (Team Tags)
- **範圍**: 特定團隊
- **可見性**: 該團隊成員
- **創建權限**: 管理員和該團隊客服人員
- **使用場景**: 團隊特定工作流程（如 Technical-Support、Billing-Issue）
- **數據庫標識**: `team_id = <團隊ID>`

```
┌────────────────────────────────────────┐
│    Team 1 Tags (業務 A 組標籤)          │
├────────────────────────────────────────┤
│  🔧 Technical-Support                  │
│  💰 Billing-Issue                      │
│  📦 Product-Inquiry                    │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│    Team 2 Tags (業務 B 組標籤)          │
├────────────────────────────────────────┤
│  📞 Sales-Lead                         │
│  🎁 Promotion-Interest                 │
│  📊 Market-Research                    │
└────────────────────────────────────────┘
```

### 標籤屬性 (Tag Properties)

| 屬性 | 類型 | 必需 | 說明 |
|------|------|------|------|
| **ID** | Integer | 自動 | 唯一識別碼 |
| **名稱** (name) | String | ✅ | 標籤名稱（50字符內） |
| **顏色** (color) | Hex Color | ✅ | 十六進位顏色碼（預設: #3B82F6） |
| **描述** (description) | String | ❌ | 標籤說明（500字符內） |
| **團隊ID** (teamId) | Integer | ❌ | NULL = 全局標籤 |
| **是否啟用** (isActive) | Boolean | ✅ | 軟刪除標記 |
| **創建者** (createdBy) | String | ✅ | 創建者 Agent ID |
| **創建時間** (createdAt) | Timestamp | 自動 | UTC 時間 |
| **更新時間** (updatedAt) | Timestamp | 自動 | UTC 時間 |

### 顏色編碼建議 (Color Coding Recommendations)

```
優先級標籤 (Priority Tags):
  🔴 Urgent          #EF4444  (Red)
  🟡 High Priority   #F59E0B  (Amber)
  🔵 Normal          #3B82F6  (Blue)
  🟢 Low Priority    #10B981  (Green)

狀態標籤 (Status Tags):
  ✅ Resolved        #10B981  (Green)
  ⏳ In Progress     #3B82F6  (Blue)
  ⏸️  Pending        #F59E0B  (Amber)
  ❌ Closed          #6B7280  (Gray)

分類標籤 (Category Tags):
  🛠️  Technical      #8B5CF6  (Purple)
  💰 Billing         #EC4899  (Pink)
  📦 Product         #14B8A6  (Teal)
  📞 Sales           #F97316  (Orange)
```

---

## 🔄 標籤生命週期 (Tag Lifecycle)

### 完整生命週期

```
     ┌──────────────────────────────────────────────────────┐
     │            Tag Lifecycle (標籤生命週期)                │
     └──────────────────────────────────────────────────────┘

┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│         │      │         │      │         │      │         │
│ Created │─────▶│ Active  │─────▶│ Updated │─────▶│Deactivated│
│         │      │         │      │         │      │         │
└─────────┘      └────┬────┘      └────┬────┘      └─────────┘
                      │                │
                      │                │
                      ▼                ▼
              ┌───────────────┐   ┌───────────────┐
              │  Assigned to  │   │  Statistics   │
              │   Customers   │   │   Updated     │
              └───────────────┘   └───────────────┘
                      │                │
                      └────────┬───────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Archived  │
                        │ (Soft Delete)│
                        └─────────────┘
```

### 階段詳解

#### 1. 創建階段 (Creation Phase)

**觸發條件**:
- 管理員創建全局標籤
- 客服人員創建團隊標籤

**操作流程**:
```javascript
// API 調用範例
const response = await fetch('/api/tags', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'urgent',
    color: '#EF4444',
    description: 'Urgent matters requiring immediate attention',
    teamId: 1  // null = 全局標籤
  })
});
```

**驗證檢查**:
- ✅ 名稱不為空且長度 ≤ 50
- ✅ 顏色格式為有效十六進位碼
- ✅ 同一範圍內名稱唯一
- ✅ 創建全局標籤需管理員權限

#### 2. 活躍階段 (Active Phase)

**功能**:
- 可被指派給客戶
- 可被指派給對話
- 可在搜索和篩選中使用
- 統計數據持續更新

**監控指標**:
```
┌─────────────────────────────────────────┐
│  活躍標籤監控指標                         │
├─────────────────────────────────────────┤
│  📊 客戶數量: 45                         │
│  💬 對話數量: 32                         │
│  📈 使用趨勢: ↗ +15% (本週)              │
│  👥 活躍指派者: 8 位客服                  │
│  📅 最後使用: 2 小時前                    │
└─────────────────────────────────────────┘
```

#### 3. 更新階段 (Update Phase)

**可更新屬性**:
- ✏️ 名稱
- 🎨 顏色
- 📝 描述
- ✅ 啟用狀態

**更新範例**:
```javascript
await fetch(`/api/tags/${tagId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'urgent-priority',
    color: '#DC2626',
    description: 'Updated description'
  })
});
```

**注意事項**:
- ⚠️ 更新名稱需確保不與其他標籤重複
- ⚠️ 非管理員只能更新自己團隊的標籤
- ℹ️ 更新不影響現有關聯（客戶和對話）

#### 4. 停用階段 (Deactivation Phase)

**軟刪除機制**:
```sql
-- 執行軟刪除
UPDATE tags
SET is_active = FALSE,
    updated_at = datetime('now')
WHERE id = ?;
```

**效果**:
- ❌ 不再出現在標籤列表
- ❌ 無法被新指派
- ✅ 保留歷史關聯記錄
- ✅ 統計數據仍可查詢
- ✅ 可透過更新重新激活

**重新激活**:
```javascript
await fetch(`/api/tags/${tagId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    isActive: true
  })
});
```

---

## 👥 團隊範圍管理 (Team Scope Management)

### 範圍規則 (Scope Rules)

```
┌────────────────────────────────────────────────────────────┐
│              標籤可見性規則矩陣                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  角色      │  創建全局標籤  │  創建團隊標籤  │  查看範圍    │
│  ─────────┼──────────────┼──────────────┼─────────────   │
│  Admin    │      ✅       │      ✅       │  所有標籤      │
│  Agent    │      ❌       │      ✅       │  團隊+全局     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 標籤篩選邏輯

#### 管理員查看標籤
```javascript
// 管理員可以看到所有標籤
GET /api/tags
→ 返回: 全局標籤 + 所有團隊標籤
```

#### 客服人員查看標籤
```javascript
// 客服人員默認看到自己團隊+全局標籤
GET /api/tags
→ 返回: 全局標籤 + 自己團隊標籤

// 客服人員可以選擇只看團隊標籤
GET /api/tags?includeGlobal=false
→ 返回: 僅自己團隊標籤

// 客服人員可以指定查看其他團隊標籤（如果有跨團隊權限）
GET /api/tags?teamId=2
→ 返回: 團隊2標籤 + 全局標籤
```

### 團隊協作最佳實踐

#### 1. 標籤命名規範

```
推薦命名格式:

團隊標籤:
  [分類]-[描述]
  例如:
    tech-urgent        (技術類-緊急)
    sales-qualified    (銷售類-合格客戶)
    billing-overdue    (帳務類-逾期)

全局標籤:
  [通用描述]
  例如:
    vip-customer       (VIP客戶)
    urgent             (緊急)
    follow-up          (待追蹤)
```

#### 2. 標籤管理權責

```
┌───────────────────────────────────────────────────────────┐
│            標籤管理權責分配                                  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  系統管理員 (System Admin):                                │
│    ✅ 創建全局標籤                                          │
│    ✅ 審核團隊標籤命名規範                                   │
│    ✅ 定期清理無用標籤                                       │
│    ✅ 維護標籤使用文檔                                       │
│                                                           │
│  團隊組長 (Team Lead):                                     │
│    ✅ 為團隊創建必要標籤                                     │
│    ✅ 培訓成員標籤使用規範                                   │
│    ✅ 監控團隊標籤使用情況                                   │
│    ✅ 定期檢視標籤效果                                       │
│                                                           │
│  客服人員 (Agent):                                         │
│    ✅ 根據需要創建標籤                                       │
│    ✅ 正確為客戶/對話添加標籤                                │
│    ✅ 反饋標籤使用問題                                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 🏷️ 客戶標籤整合 (Customer Tag Integration)

### 為客戶添加標籤

**使用場景**:
- 客戶首次聯繫時分類
- 識別 VIP 或重要客戶
- 標記客戶狀態（如：潛在客戶、已成交）
- 記錄客戶特性（如：技術用戶、價格敏感）

**API 操作** (通過客戶管理端點):
```javascript
// 為客戶添加標籤
// 注意: 這通常在客戶管理 API 中操作，而不是標籤 API
await fetch(`/api/customers/${customerId}/tags`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tagIds: [1, 2, 3]  // 要添加的標籤 ID
  })
});

// 移除客戶標籤
await fetch(`/api/customers/${customerId}/tags/${tagId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 查詢使用標籤的客戶

**從標籤端查詢**:
```javascript
// 獲取使用特定標籤的所有客戶
const response = await fetch(`/api/tags/${tagId}/customers?page=1&limit=50`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 回應格式
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": 123,
        "platform": "line",
        "displayName": "John Customer",
        "assignedAt": "2025-11-13T10:00:00.000Z",
        "assignedBy": "agent-001"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 45
    }
  }
}
```

### 客戶標籤統計

```
┌────────────────────────────────────────────────────────┐
│         客戶標籤使用統計範例                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  標籤: "VIP Customer"                                  │
│    總客戶數: 128                                        │
│    平台分布:                                            │
│      • LINE: 85 (66%)                                 │
│      • Facebook: 43 (34%)                             │
│                                                        │
│  最近 30 天新增: +15 (↗ 13%)                           │
│  活躍客服: 12 位                                        │
│  最常指派者: John Doe (28 次)                           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 💬 對話標籤整合 (Conversation Tag Integration)

### 為對話添加標籤

**使用場景**:
- 對話分類（技術支持、銷售查詢、投訴等）
- 標記對話優先級
- 追蹤對話狀態
- 標記特殊處理需求

**操作方式** (通過訊息 API):
```javascript
// 為對話添加標籤（通過訊息標籤端點）
await fetch(`/api/messages/${messageId}/tags`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tags: ['urgent', 'technical-support', 'follow-up']
  })
});
```

### 對話標籤工作流程

```
┌──────────────────────────────────────────────────────────┐
│           對話標籤工作流程圖                                │
└──────────────────────────────────────────────────────────┘

  客戶發起對話
       ↓
  ┌─────────────┐
  │ 初始分類標籤 │ → [new, unassigned]
  └──────┬──────┘
       ↓
  客服接手對話
       ↓
  ┌─────────────┐
  │ 添加專業標籤 │ → [technical-support, billing]
  └──────┬──────┘
       ↓
  識別緊急程度
       ↓
  ┌─────────────┐
  │ 添加優先級   │ → [urgent, high-priority]
  └──────┬──────┘
       ↓
  解決問題
       ↓
  ┌─────────────┐
  │ 更新狀態標籤 │ → [resolved, follow-up]
  └─────────────┘
```

### 對話標籤統計

```javascript
// 獲取標籤在對話中的使用統計
const response = await fetch(`/api/tags/${tagId}/stats`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 統計數據示例
{
  "conversations": {
    "total": 256,
    "active": 128,    // 活躍對話數
    "closed": 128     // 已關閉對話數
  },
  "usageTrend": [
    { "date": "2025-11-13", "assignments": 15 },
    { "date": "2025-11-12", "assignments": 12 }
  ]
}
```

---

## 🔄 批量操作 (Bulk Operations)

### 支持的批量操作類型

#### 1. 批量激活 (Bulk Activate)

**使用場景**: 重新啟用季節性或臨時停用的標籤

```javascript
await fetch('/api/tags/bulk', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'activate',
    tagIds: [1, 2, 3, 4, 5]
  })
});
```

#### 2. 批量停用 (Bulk Deactivate)

**使用場景**: 停用過時或不再使用的標籤

```javascript
await fetch('/api/tags/bulk', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'deactivate',
    tagIds: [10, 11, 12]
  })
});
```

#### 3. 批量更新顏色 (Bulk Update Color)

**使用場景**: 統一相同類別標籤的顏色風格

```javascript
// 將所有技術支持相關標籤改為紫色
await fetch('/api/tags/bulk', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'update_color',
    tagIds: [5, 6, 7, 8, 9],
    data: {
      color: '#8B5CF6'  // Purple for technical tags
    }
  })
});
```

### 批量操作限制

```
┌──────────────────────────────────────────┐
│      批量操作限制與約束                    │
├──────────────────────────────────────────┤
│                                          │
│  最大批量數量: 100 個標籤/次              │
│  並發限制: 1 個批量操作/使用者            │
│  超時時間: 30 秒                          │
│  權限檢查: 每個標籤單獨驗證               │
│                                          │
│  錯誤處理:                                │
│    • 部分失敗不影響成功項                 │
│    • 返回詳細的成功/失敗列表              │
│    • 事務性操作保證數據一致性             │
│                                          │
└──────────────────────────────────────────┘
```

---

## 📊 統計與分析 (Statistics & Analytics)

### 標籤使用統計

#### 整體統計 (GET /tags/:id/stats)

```json
{
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
    { "date": "2025-11-13", "assignments": 8 },
    { "date": "2025-11-12", "assignments": 5 }
  ],
  "topAssigners": [
    { "name": "John Doe", "assignments": 15 },
    { "name": "Jane Smith", "assignments": 12 }
  ]
}
```

### 趨勢分析

```
┌──────────────────────────────────────────────────────────┐
│            標籤使用趨勢圖（最近 30 天）                      │
└──────────────────────────────────────────────────────────┘

  指派次數
    20 ┤                                          ●
       ┤                                    ●
    15 ┤                              ●
       ┤                        ●
    10 ┤                  ●
       ┤            ●
     5 ┤      ●
       ┤ ●
     0 ┼─────────────────────────────────────────────────→
       0    5    10   15   20   25   30 (天數)

  趨勢分析:
    📈 穩定增長: +15% (本週)
    🎯 平均每日使用: 8 次
    👥 活躍指派者: 12 位客服
```

### 效能指標 (Performance Metrics)

```javascript
// 團隊標籤使用效率分析
const metrics = {
  // 標籤利用率
  utilizationRate: {
    active: 85,      // 85% 標籤有被使用
    inactive: 15     // 15% 標籤從未使用
  },

  // 平均指派時間
  avgAssignmentTime: {
    perCustomer: 3.2,      // 平均每客戶 3.2 個標籤
    perConversation: 2.1   // 平均每對話 2.1 個標籤
  },

  // 標籤覆蓋率
  coverage: {
    customers: 78,        // 78% 客戶有標籤
    conversations: 92     // 92% 對話有標籤
  }
};
```

---

## 🔒 權限與訪問控制 (Permissions & Access Control)

### 權限矩陣

```
┌───────────────────────────────────────────────────────────────┐
│                  標籤系統權限矩陣                                │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  操作               │ Admin │ Agent (自己團隊) │ Agent (其他團隊)│
│  ──────────────────┼───────┼────────────────┼────────────────│
│  創建全局標籤       │  ✅   │       ❌       │       ❌       │
│  創建團隊標籤       │  ✅   │       ✅       │       ❌       │
│  查看全局標籤       │  ✅   │       ✅       │       ✅       │
│  查看團隊標籤       │  ✅   │       ✅       │       ❌       │
│  編輯全局標籤       │  ✅   │       ❌       │       ❌       │
│  編輯團隊標籤       │  ✅   │       ✅       │       ❌       │
│  刪除全局標籤       │  ✅   │       ❌       │       ❌       │
│  刪除團隊標籤       │  ✅   │       ✅       │       ❌       │
│  批量操作           │  ✅   │       ✅       │       ❌       │
│  查看統計           │  ✅   │       ✅       │       ❌       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 權限驗證流程

```
┌──────────────────────────────────────────────────────────┐
│              權限驗證流程圖                                 │
└──────────────────────────────────────────────────────────┘

    使用者請求操作標籤
            ↓
    ┌───────────────┐
    │ 驗證 JWT Token │
    └───────┬───────┘
            ↓
     ┌──────────────┐
     │ 取得使用者角色│ → Admin? ✅ 允許所有操作
     └───────┬──────┘
             ↓ Agent
     ┌──────────────┐
     │ 檢查標籤範圍  │
     └───────┬──────┘
             │
      ┌──────┴──────┐
      │             │
  全局標籤      團隊標籤
      │             │
      ↓             ↓
   ❌拒絕        是自己團隊?
                    │
              ┌─────┴─────┐
              │           │
             是          否
              │           │
              ↓           ↓
          ✅允許       ❌拒絕
```

### 安全最佳實踐

```
🔒 標籤系統安全建議:

1. 存取控制:
   ✅ 始終驗證 JWT Token
   ✅ 檢查使用者角色和團隊歸屬
   ✅ 記錄所有標籤操作日誌

2. 數據保護:
   ✅ 軟刪除而非硬刪除
   ✅ 保留完整的操作審計跟蹤
   ✅ 定期備份標籤數據

3. 輸入驗證:
   ✅ 驗證標籤名稱長度和字符
   ✅ 驗證顏色碼格式
   ✅ 防止 SQL 注入和 XSS

4. 批量操作:
   ✅ 限制批量操作數量
   ✅ 實施速率限制
   ✅ 使用事務保證一致性
```

---

## ✅ 最佳實踐 (Best Practices)

### 標籤設計原則

#### 1. KISS 原則 (Keep It Simple and Stupid)

```
❌ 不好的設計:
   - "urgent-technical-support-billing-issue-requires-immediate-attention"

✅ 好的設計:
   - "urgent"
   - "technical"
   - "billing"
   (組合使用多個簡單標籤)
```

#### 2. 命名規範

```
推薦命名格式:

✅ 使用小寫字母和連字符:
   urgent-priority
   technical-support
   vip-customer

❌ 避免:
   Urgent Priority      (有空格)
   UrgentPriority       (駝峰式)
   urgent_priority      (下劃線)
```

#### 3. 顏色一致性

```
建立顏色語義:

優先級:
  🔴 紅色 (#EF4444) - 緊急
  🟡 黃色 (#F59E0B) - 高
  🔵 藍色 (#3B82F6) - 正常
  🟢 綠色 (#10B981) - 低

狀態:
  🟢 綠色 - 完成/解決
  🔵 藍色 - 進行中
  🟡 黃色 - 等待中
  ⚫ 灰色 - 關閉

類別:
  🟣 紫色 - 技術
  🔴 粉色 - 帳務
  🔵 青色 - 產品
  🟠 橙色 - 銷售
```

### 工作流程最佳實踐

#### 1. 新對話標籤流程

```
步驟 1: 初始分類
  → 添加平台標籤: [line], [facebook]
  → 添加來源標籤: [qr-code], [direct-message]

步驟 2: 內容分類
  → 技術問題: [technical-support]
  → 銷售查詢: [sales-inquiry]
  → 帳務問題: [billing-issue]

步驟 3: 優先級評估
  → 根據情況添加: [urgent], [high-priority]

步驟 4: 狀態追蹤
  → 處理中: [in-progress]
  → 等待回應: [pending-customer]
  → 已解決: [resolved]
```

#### 2. 客戶標籤流程

```
首次接觸:
  → 添加客戶來源: [qr-scan], [website-chat]
  → 添加客戶類型: [potential-customer], [existing-customer]

互動過程:
  → 更新興趣標籤: [product-a], [product-b]
  → 添加行為標籤: [high-engagement], [price-sensitive]

客戶價值:
  → VIP 標記: [vip-customer], [high-value]
  → 風險標記: [churn-risk], [payment-issue]
```

### 維護與清理

#### 定期檢視清單

```
每週檢查:
  ☐ 查看新創建的標籤是否符合命名規範
  ☐ 檢查是否有重複或相似標籤
  ☐ 確認標籤顏色一致性

每月清理:
  ☐ 識別 30 天內未使用的標籤
  ☐ 合併功能相似的標籤
  ☐ 停用過時標籤
  ☐ 更新標籤描述

每季度審核:
  ☐ 分析標籤使用趨勢
  ☐ 評估標籤體系效率
  ☐ 收集團隊反饋
  ☐ 優化標籤策略
```

---

## ❓ 常見問題 (FAQ)

### Q1: 標籤和對話狀態有什麼區別？

**A**:
- **對話狀態** (`status`) 是系統內建的固定字段，如 `active`、`closed`
- **標籤** (`tags`) 是靈活的分類工具，可自定義創建

**使用建議**:
- 用狀態管理對話生命週期（開始、進行、結束）
- 用標籤管理對話特性和分類（技術問題、緊急、VIP 等）

### Q2: 一個客戶/對話可以有多少個標籤？

**A**:
- **數據庫層面**: 無硬性限制
- **最佳實踐**: 建議 3-5 個標籤
- **過多標籤問題**: 會導致分類混亂，失去標籤意義

### Q3: 刪除標籤後會發生什麼？

**A**:
```
標籤軟刪除效果:
  ✅ 保留所有歷史關聯（customer_tags, conversation_tags）
  ✅ 統計數據仍可查詢
  ✅ 不會影響已有的客戶和對話數據
  ✅ 標籤可以重新激活

完全刪除（不推薦）:
  ⚠️ 會級聯刪除所有關聯記錄
  ⚠️ 會破壞歷史數據完整性
  ⚠️ 無法恢復
```

### Q4: 如何處理標籤名稱衝突？

**A**:
```
衝突檢測範圍:
  • 全局標籤: 檢查所有全局標籤
  • 團隊標籤: 僅檢查該團隊內的標籤

解決方案:
  1. 為團隊標籤添加前綴: "team1-urgent", "team2-urgent"
  2. 使用更具描述性的名稱: "tech-urgent", "sales-urgent"
  3. 考慮是否需要創建全局標籤
```

### Q5: 客服人員可以創建全局標籤嗎？

**A**:
❌ 不可以。只有管理員可以創建全局標籤。

**原因**:
- 防止標籤氾濫
- 確保全局標籤的一致性和權威性
- 避免命名衝突

**解決方案**:
- 客服人員可以創建團隊標籤
- 如需全局標籤，向管理員提出請求

### Q6: 批量操作失敗會回滾嗎？

**A**:
```
批量操作特性:
  ✅ 使用事務保證數據一致性
  ✅ 部分失敗不影響成功項
  ✅ 返回詳細的成功/失敗報告

範例回應:
{
  "totalRequested": 10,
  "successCount": 8,
  "failureCount": 2,
  "results": [
    { "tagId": 1, "status": "success" },
    { "tagId": 2, "status": "failed", "reason": "Permission denied" }
  ]
}
```

---

## 🔧 故障排除 (Troubleshooting)

### 常見問題診斷

#### 問題 1: 無法創建標籤 - "Permission Denied"

**原因**:
- 嘗試創建全局標籤但不是管理員
- 嘗試創建其他團隊的標籤

**解決方案**:
```javascript
// 檢查當前使用者角色
const payload = decodeJWT(token);
console.log('Role:', payload.role);
console.log('Team ID:', payload.teamId);

// 確保請求正確
// 創建團隊標籤（需要提供 teamId）
{
  "name": "my-tag",
  "teamId": payload.teamId  // 必須是自己的團隊
}

// 創建全局標籤（需要管理員權限）
{
  "name": "global-tag",
  "teamId": null  // 需要 role === 'admin'
}
```

#### 問題 2: 標籤列表為空

**可能原因**:
1. 該團隊沒有創建任何標籤
2. `includeGlobal=false` 且沒有團隊標籤
3. 所有標籤都已停用

**診斷步驟**:
```javascript
// 1. 檢查是否有標籤
const response = await fetch('/api/tags?page=1&pageSize=100', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 2. 檢查包含全局標籤
const response2 = await fetch('/api/tags?includeGlobal=true', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. 以管理員身份查看所有標籤（如果可能）
```

#### 問題 3: 標籤統計數據不正確

**可能原因**:
- 緩存未更新
- 關聯表數據不同步

**解決方案**:
```bash
# 1. 重新查詢統計
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/tags/1/stats

# 2. 清除緩存（如果使用 KV 緩存）
# 需要管理員執行清除緩存操作

# 3. 檢查數據庫一致性
# 執行數據庫查詢驗證計數
SELECT
  t.id,
  t.name,
  COUNT(DISTINCT ct.customer_id) as customer_count,
  COUNT(DISTINCT cvt.conversation_id) as conversation_count
FROM tags t
LEFT JOIN customer_tags ct ON t.id = ct.tag_id
LEFT JOIN conversation_tags cvt ON t.id = cvt.tag_id
WHERE t.id = 1
GROUP BY t.id;
```

#### 問題 4: 批量操作超時

**可能原因**:
- 批量數量過大（>100）
- 數據庫性能問題

**解決方案**:
```javascript
// 1. 減少批量數量
const batchSize = 50;  // 改為 50 個一批
const tagIds = [1, 2, 3, ..., 200];

for (let i = 0; i < tagIds.length; i += batchSize) {
  const batch = tagIds.slice(i, i + batchSize);

  await fetch('/api/tags/bulk', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operation: 'activate',
      tagIds: batch
    })
  });

  // 添加短暫延遲避免過載
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### 錯誤碼快速查詢

```
┌──────────────────────────────────────────────────────────┐
│              錯誤碼快速查詢表                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 400 - VALIDATION_ERROR                                   │
│   → 檢查請求體格式和必需欄位                               │
│                                                          │
│ 401 - UNAUTHORIZED                                       │
│   → 檢查 JWT Token 是否有效                               │
│                                                          │
│ 403 - PERMISSION_DENIED                                  │
│   → 檢查使用者角色和團隊權限                               │
│                                                          │
│ 404 - TAG_NOT_FOUND                                      │
│   → 確認標籤 ID 正確且標籤仍啟用                           │
│                                                          │
│ 409 - DUPLICATE_TAG_NAME                                 │
│   → 在該範圍內選擇不同的標籤名稱                           │
│                                                          │
│ 500 - INTERNAL_ERROR                                     │
│   → 聯繫系統管理員檢查日誌                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 📚 相關資源

### 文檔連結

- **API Reference**: [TAG_API_REFERENCE.md](./api/TAG_API_REFERENCE.md)
- **Messaging API**: [MESSAGING_API_REFERENCE.md](./api/MESSAGING_API_REFERENCE.md)
- **Team Management**: [TEAM_MANAGEMENT_GUIDE.md](./TEAM_MANAGEMENT_GUIDE.md)
- **System Architecture**: [CLAUDE.md](./CLAUDE.md)

### 數據庫 Schema

查看完整的數據庫結構:
- `src/db/schema.ts` - Tags table definition
- `drizzle/migrations/` - Migration history

### 測試範例

參考測試文件了解使用方式:
- `tests/unit/handlers/tag-handler.test.ts`
- `tests/integration/tag-integration.test.ts`

---

## 📝 版本資訊

**文檔版本**: 1.0.0
**最後更新**: 2025-11-13
**適用系統版本**: v2.0.0+
**維護團隊**: Development Team

---

## 🙏 反饋與貢獻

如有任何問題、建議或發現文檔錯誤，請：

1. 在 GitHub Issues 提出問題
2. 聯繫系統管理員
3. 查閱主要文檔 `CLAUDE.md` 獲取更多支援資訊

---

**文檔狀態**: ✅ Production Ready
**維護優先級**: HIGH
**定期檢視**: Monthly
