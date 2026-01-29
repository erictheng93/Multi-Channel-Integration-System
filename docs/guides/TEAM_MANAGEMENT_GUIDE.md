# Team Management System Guide
# 團隊管理系統完整指南

## 📋 目錄 (Table of Contents)

1. [系統概覽](#-系統概覽-overview)
2. [2-層級角色系統](#-2-層級角色系統-2-tier-role-system)
3. [團隊生命週期管理](#-團隊生命週期管理-team-lifecycle)
4. [成員管理](#-成員管理-member-management)
5. [密碼政策管理](#-密碼政策管理-password-policy)
6. [團隊範圍資源](#-團隊範圍資源-team-scoped-resources)
7. [QR Code 整合](#-qr-code-整合-qr-code-integration)
8. [權限與訪問控制](#-權限與訪問控制-permissions--access-control)
9. [最佳實踐](#-最佳實踐-best-practices)
10. [常見問題](#-常見問題-faq)

---

## 🎯 系統概覽 (Overview)

### 什麼是團隊系統？

團隊系統是多渠道客服平台的核心組織單元，提供：

- 👥 **人員組織** - 將客服人員組織成邏輯團隊
- 🎯 **工作分配** - 自動或手動分配對話到團隊
- 📊 **績效追蹤** - 追蹤團隊和個人績效指標
- 🔒 **資源隔離** - 團隊範圍的數據和資源訪問
- 🎨 **客製化** - 每個團隊的獨特配置和工作流程

### 系統架構

```
┌──────────────────────────────────────────────────────────┐
│              團隊系統架構圖                                 │
└──────────────────────────────────────────────────────────┘

             ┌──────────────────┐
             │  System Admin    │
             │  (全局管理員)     │
             └────────┬─────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   ┌────▼────┐   ┌───▼────┐   ┌───▼────┐
   │ Team 1  │   │ Team 2 │   │ Team 3 │
   │業務 A 組│   │業務 B 組│   │技術支援│
   └────┬────┘   └───┬────┘   └───┬────┘
        │            │            │
   ┌────┴────┐  ┌───┴────┐  ┌───┴────┐
   │ Agents  │  │ Agents │  │ Agents │
   │ (客服)  │  │ (客服)  │  │ (客服)  │
   └─────────┘  └────────┘  └────────┘
        │            │            │
   ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
   │ Team    │  │ Team   │  │ Team   │
   │Resources│  │Resources│  │Resources│
   └─────────┘  └────────┘  └────────┘
```

### 核心特性

```
┌─────────────────────────────────────────────────────────┐
│  團隊管理系統核心特性                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ 2-層級角色系統      ✅ 團隊 CRUD 操作                 │
│  ✅ 成員生命週期管理     ✅ 密碼政策控制                  │
│  ✅ 直接成員添加        ✅ QR Code 整合                   │
│  ✅ 團隊範圍標籤        ✅ 績效統計                       │
│  ✅ 活動日誌           ✅ 資源隔離                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 數據庫結構

```sql
-- 團隊表
CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 客服人員表 (Agents)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',  -- 'admin' or 'agent'
  team_id INTEGER REFERENCES teams(id),
  is_active BOOLEAN DEFAULT TRUE,
  password_policy TEXT DEFAULT 'changeable',  -- 'changeable', 'unchangeable', 'must_change'
  last_active TEXT,
  last_login_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 👑 2-層級角色系統 (2-Tier Role System)

### 角色簡化說明

系統從原本的 3-層級（Admin / Team / Agent）簡化為 **2-層級（Admin / Agent）**：

```
┌──────────────────────────────────────────────────────────┐
│           角色系統演進                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  舊系統 (3-層級):                                          │
│    Admin  →  Team Leader  →  Agent                      │
│    管理員     團隊組長         客服                        │
│                                                          │
│  新系統 (2-層級):                                          │
│    Admin  →  Agent (with teamId)                        │
│    管理員     客服（歸屬團隊）                              │
│                                                          │
│  ✅ 簡化權限管理                                           │
│  ✅ 減少複雜度                                             │
│  ✅ 團隊功能保留                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 角色定義

#### 1. Admin (管理員)

**權限範圍**:
```
✅ 系統級管理:
   • 創建/編輯/刪除所有團隊
   • 管理所有客服人員
   • 查看所有數據和報表
   • 配置系統設置

✅ 團隊管理:
   • 創建和配置團隊
   • 指派客服到團隊
   • 設置團隊密碼政策
   • 查看跨團隊數據

✅ 特殊權限:
   • 創建全局標籤
   • 重置任何人的密碼
   • 訪問審計日誌
   • 系統配置管理
```

**識別特徵**:
- `role = 'admin'`
- `teamId` 通常為 `null`（可選擇歸屬團隊）
- 無資源訪問限制

#### 2. Agent (客服人員)

**權限範圍**:
```
✅ 團隊範圍操作:
   • 處理分配的對話
   • 查看團隊客戶資料
   • 使用團隊標籤
   • 創建團隊標籤

❌ 限制:
   • 無法創建全局標籤
   • 無法訪問其他團隊資源
   • 無法管理團隊設置
   • 無法重置他人密碼（除非自己的）
```

**識別特徵**:
- `role = 'agent'`
- `teamId` 必需（歸屬特定團隊）
- 資源訪問限制在團隊範圍

### 權限矩陣

```
┌────────────────────────────────────────────────────────────┐
│                  操作權限矩陣                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  操作                    │ Admin │ Agent (自己團隊) │ Agent (其他團隊) │
│  ──────────────────────┼───────┼────────────────┼────────────────│
│  創建團隊                │  ✅   │       ❌       │       ❌       │
│  編輯團隊                │  ✅   │       ❌       │       ❌       │
│  刪除團隊                │  ✅   │       ❌       │       ❌       │
│  添加成員                │  ✅   │       ❌       │       ❌       │
│  移除成員                │  ✅   │       ❌       │       ❌       │
│  設置密碼政策            │  ✅   │       ❌       │       ❌       │
│  重置成員密碼            │  ✅   │       ❌       │       ❌       │
│  查看團隊統計            │  ✅   │       ✅       │       ❌       │
│  處理團隊對話            │  ✅   │       ✅       │       ❌       │
│  創建團隊標籤            │  ✅   │       ✅       │       ❌       │
│  創建全局標籤            │  ✅   │       ❌       │       ❌       │
│  查看跨團隊數據          │  ✅   │       ❌       │       ❌       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🔄 團隊生命週期管理 (Team Lifecycle)

### 完整生命週期

```
     ┌──────────────────────────────────────────────────────┐
     │          Team Lifecycle (團隊生命週期)                 │
     └──────────────────────────────────────────────────────┘

┌─────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│         │    │         │    │         │    │          │
│ Created │───▶│ Active  │───▶│ Updated │───▶│Deactivated│
│         │    │         │    │         │    │          │
└─────────┘    └────┬────┘    └────┬────┘    └──────────┘
                    │              │
                    ▼              ▼
            ┌────────────┐   ┌────────────┐
            │  Add       │   │  Remove    │
            │  Members   │   │  Members   │
            └────────────┘   └────────────┘
                    │              │
                    └──────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  Manage       │
                   │  Resources    │
                   └───────────────┘
```

### 階段詳解

#### 1. 創建階段 (Creation)

**API 端點**: `POST /api/teams`

**請求範例**:
```javascript
const response = await fetch('/api/teams', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '業務 A 組',
    description: '負責企業客戶業務',
    qrCode: 'TEAM_A_2024'  // 可選
  })
});
```

**回應範例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "業務 A 組",
    "description": "負責企業客戶業務",
    "qrCode": "TEAM_A_2024",
    "isActive": true,
    "memberCount": 0,
    "createdAt": "2025-11-13T10:00:00.000Z"
  }
}
```

**驗證規則**:
- ✅ 團隊名稱必填（1-100 字符）
- ✅ 團隊名稱必須唯一
- ✅ QR Code（如提供）必須唯一
- ✅ 僅管理員可創建

#### 2. 活躍階段 (Active)

團隊處於活躍狀態時的核心操作：

**查詢團隊列表**:
```javascript
// 管理員查看所有團隊
const response = await fetch('/api/teams', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

// 客服查看自己的團隊
const response = await fetch('/api/teams', {
  headers: {
    'Authorization': `Bearer ${agentToken}`
  }
});
// → 自動返回該客服的團隊
```

**查詢單個團隊**:
```javascript
const response = await fetch('/api/teams/1', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**團隊統計**:
```javascript
const response = await fetch('/api/teams/1/stats', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 返回數據
{
  "teamInfo": {
    "id": 1,
    "name": "業務 A 組",
    "memberCount": 8
  },
  "statistics": {
    "activeConversations": 45,
    "todayMessages": 234,
    "avgResponseTime": "5.2 minutes",
    "customerSatisfaction": 4.5
  }
}
```

#### 3. 更新階段 (Update)

**API 端點**: `PUT /api/teams/:id`

```javascript
await fetch('/api/teams/1', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '業務 A 組（更新）',
    description: '更新後的描述',
    isActive: true
  })
});
```

#### 4. 停用階段 (Deactivation)

**軟刪除機制**:
```javascript
// 停用團隊（軟刪除）
await fetch('/api/teams/1', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    isActive: false
  })
});
```

**效果**:
- ❌ 團隊不再出現在活躍列表
- ❌ 無法分配新對話到該團隊
- ✅ 保留歷史數據和記錄
- ✅ 成員仍然存在（但無法執行團隊操作）
- ✅ 可重新激活

---

## 👥 成員管理 (Member Management)

### 成員生命週期

```
    創建成員
       ↓
    設置初始密碼政策
       ↓
    ┌──────────────┐
    │  Active      │
    │  (活躍狀態)   │
    └───────┬──────┘
            │
    ┌───────┼──────────┐
    │       │          │
 更新資料  密碼管理  停用/刪除
    │       │          │
    └───────┴──────────┘
```

### 添加成員

**API 端點**: `POST /api/teams/:teamId/members`

**請求範例**:
```javascript
await fetch('/api/teams/1/members', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'newagent@company.com',
    displayName: '新客服',
    role: 'agent',
    passwordPolicy: 'must_change',  // 首次登入必須更改密碼
    initialPassword: 'temp123456'
  })
});
```

**回應範例**:
```json
{
  "success": true,
  "data": {
    "id": "agent-123",
    "email": "newagent@company.com",
    "displayName": "新客服",
    "role": "agent",
    "teamId": 1,
    "passwordPolicy": "must_change",
    "isActive": true,
    "createdAt": "2025-11-13T10:00:00.000Z"
  }
}
```

### 查詢團隊成員

```javascript
const response = await fetch('/api/teams/1/members', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 回應
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "agent-001",
        "displayName": "資深客服",
        "email": "agent001@company.com",
        "role": "agent",
        "passwordPolicy": "changeable",
        "lastActive": "2025-11-13T09:45:00.000Z",
        "lastLoginAt": "2025-11-13T08:00:00.000Z",
        "isActive": true
      }
    ],
    "total": 8
  }
}
```

### 更新成員資訊

**API 端點**: `PUT /api/teams/:teamId/members/:memberId`

```javascript
await fetch('/api/teams/1/members/agent-001', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    displayName: '資深客服（更新）',
    isActive: true
  })
});
```

### 移除成員

**API 端點**: `DELETE /api/teams/:teamId/members/:memberId`

```javascript
await fetch('/api/teams/1/members/agent-001', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
```

**注意事項**:
- ⚠️ 軟刪除：設置 `isActive = false`
- ⚠️ 保留歷史活動記錄
- ⚠️ 無法處理新對話
- ℹ️ 可重新激活

---

## 🔐 密碼政策管理 (Password Policy)

### 三種密碼政策

```
┌──────────────────────────────────────────────────────────┐
│              密碼政策類型                                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. changeable (可變更)                                   │
│     • 使用者可以自行更改密碼                               │
│     • 預設政策                                            │
│     • 適用於一般客服人員                                   │
│                                                          │
│  2. unchangeable (不可變更)                               │
│     • 使用者無法自行更改密碼                               │
│     • 僅管理員可以重置                                     │
│     • 適用於臨時帳號或特殊用途帳號                          │
│                                                          │
│  3. must_change (必須變更)                                │
│     • 首次登入必須更改密碼                                 │
│     • 變更後轉為 'changeable' 政策                        │
│     • 適用於新成員初始設置                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 設置密碼政策

**創建成員時設置**:
```javascript
await fetch('/api/teams/1/members', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'newagent@company.com',
    displayName: '新客服',
    passwordPolicy: 'must_change',  // 首次登入必改
    initialPassword: 'temp123456'
  })
});
```

**更新現有成員的政策**:
```javascript
await fetch('/api/teams/1/members/agent-001', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    passwordPolicy: 'unchangeable'  // 改為不可變更
  })
});
```

### 重置密碼

**API 端點**: `POST /api/teams/members/:memberId/reset`

```javascript
await fetch('/api/teams/members/agent-001/reset', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    newPassword: 'newtemp123456',
    passwordPolicy: 'must_change'  // 強制下次登入更改
  })
});
```

### 密碼政策工作流程

```
┌──────────────────────────────────────────────────────────┐
│          密碼政策工作流程圖                                 │
└──────────────────────────────────────────────────────────┘

  新成員創建 (must_change)
         ↓
    首次登入
         ↓
  強制更改密碼
         ↓
    ┌─────────┐
    │changeable│ ←─ 一般狀態
    └────┬────┘
         │
   ┌─────┴─────┐
   │           │
 自行變更    管理員重置
   │           │
   └─────┬─────┘
         │
  ┌──────▼──────────┐
  │  unchangeable?  │ → 特殊帳號
  └─────────────────┘
```

---

---

## 🏷️ 團隊範圍資源 (Team-Scoped Resources)

### 資源隔離模型

```
┌──────────────────────────────────────────────────────────┐
│          團隊資源隔離示意圖                                 │
└──────────────────────────────────────────────────────────┘

  ┌──────────────────┐      ┌──────────────────┐
  │    Team 1        │      │    Team 2        │
  │  業務 A 組        │      │  業務 B 組        │
  └────────┬─────────┘      └────────┬─────────┘
           │                         │
   ┌───────┴────────┐       ┌────────┴────────┐
   │                │       │                 │
   ▼                ▼       ▼                 ▼
  Tags          Customers  Tags          Customers
  (團隊標籤)     (客戶)     (團隊標籤)     (客戶)
   │                │       │                 │
   ▼                ▼       ▼                 ▼
 QR Codes    Conversations QR Codes    Conversations
 (QR碼)         (對話)      (QR碼)         (對話)

  ❌ Team 1 無法訪問 Team 2 資源
  ✅ Admin 可以訪問所有資源
```

### 團隊範圍的標籤

**創建團隊標籤**:
```javascript
await fetch('/api/tags', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${agentToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'team-specific-tag',
    color: '#3B82F6',
    teamId: 1  // 歸屬團隊 1
  })
});
```

**查詢團隊標籤**:
```javascript
const response = await fetch('/api/tags?teamId=1&includeGlobal=true', {
  headers: {
    'Authorization': `Bearer ${agentToken}`
  }
});
// 返回: 團隊 1 的標籤 + 全局標籤
```

### 團隊範圍的客戶

客戶通過 `source_team_id` 欄位關聯到團隊：

```sql
SELECT * FROM customers
WHERE source_team_id = 1;  -- 團隊 1 的客戶
```

### 團隊範圍的對話

對話通過 `assigned_team_id` 欄位分配到團隊：

```sql
SELECT * FROM conversations
WHERE assigned_team_id = 1;  -- 團隊 1 的對話
```

---

## 📱 QR Code 整合 (QR Code Integration)

### 團隊 QR Code 功能

每個團隊可以有獨特的 QR Code 用於：
- 📊 **來源追蹤** - 識別客戶來源
- 🎯 **自動分配** - 自動將客戶分配到特定團隊
- 📈 **統計分析** - 追蹤團隊獲客渠道

### 設置團隊 QR Code

**創建團隊時設置**:
```javascript
await fetch('/api/teams', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '業務 A 組',
    qrCode: 'TEAM_A_2024'  // 團隊專屬 QR Code
  })
});
```

**更新團隊 QR Code**:
```javascript
await fetch('/api/teams/1', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    qrCode: 'TEAM_A_2025_NEW'
  })
});
```

### QR Code 工作流程

```
客戶掃描團隊 QR Code
         ↓
  識別 QR Code (TEAM_A_2024)
         ↓
  查詢對應團隊 (Team 1)
         ↓
  創建客戶記錄
  (source_team_id = 1)
         ↓
  創建對話
  (assigned_team_id = 1)
         ↓
  通知團隊成員
```

---

## 🔒 權限與訪問控制 (Permissions & Access Control)

### API 權限中間件

```javascript
// 僅管理員
requireAdmin: (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  return next();
}

// 團隊訪問權限
requireTeamAccess: (teamId) => (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.teamId !== parseInt(teamId)) {
    return c.json({ error: 'Team access denied' }, 403);
  }
  return next();
}
```

### 數據訪問控制

```javascript
// Agent 查詢時自動過濾
if (user.role === 'agent') {
  query = query.where(eq(table.teamId, user.teamId));
}

// Admin 可以查看所有數據
if (user.role === 'admin') {
  // 無過濾
}
```

---

## ✅ 最佳實踐 (Best Practices)

### 團隊設計原則

```
1. 按業務線劃分:
   ✅ 銷售團隊
   ✅ 技術支援團隊
   ✅ 客服團隊

2. 合理的團隊規模:
   ✅ 建議 5-15 人/團隊
   ✅ 便於管理和協作
   ✅ 避免過大或過小

3. 清晰的職責劃分:
   ✅ 明確團隊負責的客戶類型
   ✅ 明確服務時間
   ✅ 明確升級流程
```

### 成員管理最佳實踐

```
新成員入職流程:
  ☐ 創建帳號 (passwordPolicy: 'must_change')
  ☐ 發送臨時密碼
  ☐ 提供培訓材料
  ☐ 首次登入強制更改密碼
  ☐ 分配導師（資深成員）
  ☐ 監控首週表現

定期檢視:
  ☐ 每月檢查活躍成員
  ☐ 停用長期不活躍帳號
  ☐ 檢討團隊績效
  ☐ 調整團隊配置
```

---

## ❓ 常見問題 (FAQ)

### Q1: Agent 可以創建團隊嗎？

**A**: ❌ 不可以。只有管理員可以創建和管理團隊。

### Q2: 如何將成員從一個團隊轉移到另一個團隊？

**A**:
```javascript
// 更新成員的 teamId
await fetch(`/api/teams/members/${memberId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    teamId: 2  // 新團隊 ID
  })
});
```

### Q3: 刪除團隊會發生什麼？

**A**:
```
軟刪除效果:
  ✅ 團隊標記為 isActive = false
  ✅ 保留所有歷史數據
  ✅ 成員仍然存在但無法執行團隊操作
  ✅ 可以重新激活

硬刪除（不推薦）:
  ⚠️ 級聯刪除所有關聯數據
  ⚠️ 無法恢復
```

### Q4: 一個客服可以屬於多個團隊嗎？

**A**: ❌ 目前不支持。每個客服只能屬於一個團隊（`teamId` 為單一值）。

如需支持多團隊，需要架構調整。

### Q5: 如何追蹤團隊績效？

**A**: 使用團隊統計 API：

```javascript
const response = await fetch('/api/teams/1/stats', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 返回關鍵指標
{
  "activeConversations": 45,
  "todayMessages": 234,
  "avgResponseTime": "5.2 minutes",
  "customerSatisfaction": 4.5,
  "memberActivity": [...]
}
```

---

## 📚 相關資源

### 文檔連結

- **Tag Management Guide**: [TAG_MANAGEMENT_GUIDE.md](./TAG_MANAGEMENT_GUIDE.md)
- **API Reference**: API 文檔（待創建）
- **System Architecture**: [CLAUDE.md](./CLAUDE.md)
- **CHANGELOG**: [CHANGELOG.md](./CHANGELOG.md)

### 數據庫 Schema

查看完整的數據庫結構:
- `src/db/schema.ts` - Teams and Agents tables
- `drizzle/migrations/` - Migration history

---

## 📝 版本資訊

**文檔版本**: 1.0.0
**最後更新**: 2025-11-13
**適用系統版本**: v2.0.0+ (2-tier role system)
**維護團隊**: Development Team

---

## 🔄 角色系統變更歷史

### v2.0.0 (2025-11-05) - 2-層級簡化
- ✅ 移除 `team` 角色，簡化為 `admin` 和 `agent`
- ✅ 團隊功能完全保留
- ✅ 數據庫遷移：`drizzle/0017_remove_team_role.sql`
- ✅ 權限系統簡化

### v1.0.0 - 3-層級系統（已廢棄）
- ❌ 原有 `admin`, `team`, `agent` 三個角色
- ❌ 過於複雜的權限管理

---

**文檔狀態**: ✅ Production Ready
**維護優先級**: HIGH
**定期檢視**: Monthly
