# 企業級權限控制系統設計 (RBAC)

## 角色權限矩陣

### 角色定義
- **Super Admin**: 系統超級管理員
- **Admin**: 組織管理員
- **Team Lead**: 團隊主管
- **Senior Agent**: 資深客服
- **Agent**: 一般客服
- **Viewer**: 只讀權限用戶

### 權限模組

#### 1. 用戶管理權限
```typescript
interface UserPermissions {
  create: boolean;      // 創建用戶
  read: boolean;        // 查看用戶
  update: boolean;      // 更新用戶
  delete: boolean;      // 刪除用戶
  invite: boolean;      // 邀請用戶
  resetPassword: boolean; // 重置密碼
}
```

#### 2. 對話管理權限
```typescript
interface ConversationPermissions {
  viewAll: boolean;     // 查看所有對話
  viewTeam: boolean;    // 查看團隊對話
  viewOwn: boolean;     // 查看自己的對話
  assign: boolean;      // 分配對話
  transfer: boolean;    // 轉移對話
  close: boolean;       // 關閉對話
  reopen: boolean;      // 重新開啟對話
  export: boolean;      // 匯出對話記錄
}
```

#### 3. 訊息權限
```typescript
interface MessagePermissions {
  send: boolean;        // 發送訊息
  edit: boolean;        // 編輯訊息
  delete: boolean;      // 刪除訊息
  recall: boolean;      // 撤回訊息
  forward: boolean;     // 轉發訊息
  viewHistory: boolean; // 查看歷史訊息
}
```

#### 4. 系統管理權限
```typescript
interface SystemPermissions {
  viewSettings: boolean;    // 查看系統設定
  updateSettings: boolean;  // 更新系統設定
  viewLogs: boolean;       // 查看系統日誌
  viewAnalytics: boolean;  // 查看統計分析
  exportData: boolean;     // 匯出數據
  manageIntegrations: boolean; // 管理第三方整合
}
```

## 權限檢查機制

### 1. 資源級權限控制
```typescript
// 檢查用戶是否可以訪問特定對話
async function canAccessConversation(
  userId: number, 
  conversationId: number, 
  action: string
): Promise<boolean> {
  const user = await getUserById(userId);
  const conversation = await getConversationById(conversationId);
  
  // Super Admin 和 Admin 可以訪問所有資源
  if (user.role === 'super_admin' || user.role === 'admin') {
    return true;
  }
  
  // Team Lead 可以訪問團隊內的對話
  if (user.role === 'team_lead' && user.teamId === conversation.teamId) {
    return true;
  }
  
  // Agent 只能訪問分配給自己的對話
  if (user.role === 'agent' && conversation.assignedTo === userId) {
    return true;
  }
  
  return false;
}
```

### 2. 動態權限檢查
```typescript
// 基於上下文的動態權限檢查
async function checkDynamicPermission(
  userId: number,
  resource: string,
  action: string,
  context: any
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  const resourcePermissions = permissions[resource];
  
  if (!resourcePermissions || !resourcePermissions[action]) {
    return false;
  }
  
  // 檢查時間限制
  if (context.timeRestriction) {
    const currentHour = new Date().getHours();
    if (currentHour < context.timeRestriction.start || 
        currentHour > context.timeRestriction.end) {
      return false;
    }
  }
  
  // 檢查 IP 限制
  if (context.ipRestriction && context.clientIP) {
    if (!context.ipRestriction.includes(context.clientIP)) {
      return false;
    }
  }
  
  return true;
}
```

## 實現建議

### 1. 資料庫結構擴展
```sql
-- 角色表
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 權限表
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 角色權限關聯表
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

-- 用戶角色關聯表（支援多角色）
CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_by INTEGER,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);
```

### 2. 權限中間件增強
```typescript
export function requirePermission(resource: string, action: string) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const user = c.get('user');
    const hasPermission = await checkUserPermission(
      user.id, 
      resource, 
      action,
      {
        clientIP: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        timestamp: Date.now()
      }
    );
    
    if (!hasPermission) {
      return c.json({
        error: 'Insufficient permissions',
        required: `${resource}:${action}`,
        user: user.id
      }, 403);
    }
    
    await next();
  };
}
```