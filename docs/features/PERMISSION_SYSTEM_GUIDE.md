# 🔐 權限系統指南

## 📋 權限身份總覽

系統共有 **2個基本角色** 和 **4個企業級角色**，提供靈活的權限管理。

## 🎯 基本權限角色（2個）

### 1. 👑 Admin（管理員）
- **角色代碼**: `admin`
- **權限範圍**: 系統管理員權限
- **主要功能**:
  - ✅ 用戶管理（創建、編輯、刪除用戶）
  - ✅ 系統設定管理
  - ✅ 查看所有對話
  - ✅ 分配對話給客服
  - ✅ 系統分析和報告
  - ✅ 團隊管理
  - ✅ 平台整合設定

### 2. 👤 Agent（客服人員）
- **角色代碼**: `agent`
- **權限範圍**: 客服操作權限
- **主要功能**:
  - ✅ 查看分配給自己的對話
  - ✅ 發送和接收訊息
  - ✅ 關閉對話
  - ✅ 編輯自己發送的訊息
  - ❌ 無法管理其他用戶
  - ❌ 無法修改系統設定

## 🏢 企業級權限角色（4個）

### 1. 🔴 Super Admin（超級管理員）
- **角色代碼**: `super_admin`
- **權限範圍**: 所有權限（`*:*`）
- **主要功能**:
  - ✅ **所有系統權限**
  - ✅ 系統級配置
  - ✅ 安全設定管理
  - ✅ 審計日誌查看
  - ✅ 企業級功能管理

### 2. 🟠 Admin（管理員）
- **角色代碼**: `admin`
- **權限範圍**: 管理員權限
- **主要功能**:
  - ✅ 用戶創建和管理
  - ✅ 查看所有對話
  - ✅ 對話分配和轉移
  - ✅ 系統設定
  - ✅ 分析報告

### 3. 🟡 Team Lead（團隊主管）
- **角色代碼**: `team_lead`
- **權限範圍**: 團隊管理權限
- **主要功能**:
  - ✅ 查看團隊對話
  - ✅ 分配團隊內對話
  - ✅ 管理團隊成員
  - ✅ 團隊績效報告
  - ❌ 無法管理其他團隊

### 4. 🟢 Agent（客服人員）
- **角色代碼**: `agent`
- **權限範圍**: 個人操作權限
- **主要功能**:
  - ✅ 查看自己的對話
  - ✅ 發送訊息
  - ✅ 關閉對話
  - ❌ 無法查看其他人的對話

## 🔑 詳細權限矩陣

| 功能 | Super Admin | Admin | Team Lead | Agent |
|------|-------------|-------|-----------|-------|
| **用戶管理** |
| 創建用戶 | ✅ | ✅ | ❌ | ❌ |
| 編輯用戶 | ✅ | ✅ | 🟡 團隊內 | ❌ |
| 刪除用戶 | ✅ | ✅ | ❌ | ❌ |
| 查看用戶 | ✅ | ✅ | 🟡 團隊內 | ❌ |
| **對話管理** |
| 查看所有對話 | ✅ | ✅ | ❌ | ❌ |
| 查看團隊對話 | ✅ | ✅ | ✅ | ❌ |
| 查看個人對話 | ✅ | ✅ | ✅ | ✅ |
| 分配對話 | ✅ | ✅ | 🟡 團隊內 | ❌ |
| 轉移對話 | ✅ | ✅ | 🟡 團隊內 | ❌ |
| 關閉對話 | ✅ | ✅ | ✅ | ✅ |
| **訊息管理** |
| 發送訊息 | ✅ | ✅ | ✅ | ✅ |
| 編輯訊息 | ✅ | ✅ | ✅ | 🟡 自己的 |
| 刪除訊息 | ✅ | ✅ | 🟡 團隊內 | ❌ |
| 撤回訊息 | ✅ | ✅ | ✅ | 🟡 自己的 |
| **系統管理** |
| 系統設定 | ✅ | ✅ | ❌ | ❌ |
| 平台整合 | ✅ | ✅ | ❌ | ❌ |
| 查看日誌 | ✅ | ✅ | ❌ | ❌ |
| 系統分析 | ✅ | ✅ | 🟡 團隊報告 | ❌ |

## 🧪 測試用戶

運行 `.\create-test-users.ps1` 創建以下測試用戶：

### 🔴 超級管理員
- **用戶名**: `superadmin`
- **密碼**: `superadmin123`
- **郵箱**: `superadmin@example.com`
- **角色**: `admin`（具有超級管理員權限）

### 🟠 管理員
- **用戶名**: `admin`
- **密碼**: `admin123`
- **郵箱**: `admin@example.com`
- **角色**: `admin`

### 🟡 團隊主管
- **用戶名**: `teamlead1`
- **密碼**: `teamlead123`
- **郵箱**: `teamlead1@example.com`
- **角色**: `agent`（具有團隊主管權限）

### 🟢 客服人員
- **用戶名**: `agent1`
- **密碼**: `agent123`
- **郵箱**: `dacagent@dacit.net`
- **角色**: `agent`

## 🔧 權限檢查機制

### 1. JWT Token 驗證
```typescript
// 在 JWT payload 中包含角色信息
{
  userId: 1,
  username: "admin",
  role: "admin",
  teamId: 1
}
```

### 2. 中間件權限檢查
```typescript
// 要求特定角色
requireRole('admin')

// 要求特定權限
requirePermission('conversation', 'view_all')
```

### 3. 上下文權限檢查
```typescript
// 檢查資源所有權
if (conversation.assigned_user_id === userId) {
  // 允許訪問
}

// 檢查團隊權限
if (user.teamId === conversation.assigned_team_id) {
  // 允許訪問
}
```

## 🛡️ 安全特性

### 1. 密碼安全
- 使用 SHA256 哈希存儲密碼
- 支援 bcrypt 格式（向後兼容）
- 強制密碼複雜度要求

### 2. 會話管理
- JWT Token 有效期 24 小時
- KV 存儲會話狀態
- 自動會話過期清理

### 3. 權限緩存
- 用戶權限緩存 5 分鐘
- 角色變更時自動清除緩存
- 分散式權限檢查

### 4. 審計日誌
- 記錄所有權限相關操作
- 包含 IP 地址和 User-Agent
- 支援權限變更追蹤

## 📝 使用範例

### 登入測試
```bash
# 管理員登入
curl -X POST http://localhost:8787/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# 客服登入
curl -X POST http://localhost:8787/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"agent1","password":"agent123"}'
```

### 權限測試
```bash
# 使用管理員 token 創建用戶
curl -X POST http://localhost:8787/api/auth/register \
  -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"username":"newagent","email":"new@example.com","password":"password123","displayName":"新客服","role":"agent"}'

# 使用客服 token 嘗試創建用戶（應該失敗）
curl -X POST http://localhost:8787/api/auth/register \
  -H 'Authorization: Bearer YOUR_AGENT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"username":"test","email":"test@example.com","password":"password123","displayName":"測試","role":"agent"}'
```

## 🔄 權限升級路徑

1. **Agent → Team Lead**: 由 Admin 分配團隊主管權限
2. **Team Lead → Admin**: 由 Super Admin 提升為管理員
3. **Admin → Super Admin**: 系統級配置，需要直接資料庫操作

## 📞 故障排除

### 權限被拒絕
1. 檢查 JWT Token 是否有效
2. 確認用戶角色是否正確
3. 檢查權限緩存是否需要清除

### 登入失敗
1. 確認用戶名和密碼正確
2. 檢查用戶是否被停用
3. 驗證密碼哈希格式

### 權限不生效
1. 清除權限緩存
2. 重新登入獲取新 Token
3. 檢查資料庫權限配置

---

**注意**: 這是測試環境配置，生產環境請使用強密碼並定期更新。