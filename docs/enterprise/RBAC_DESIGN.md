# (RBAC)


- **Super Admin**:
- **Admin**:
- **Team Lead**:
- **Senior Agent**:
- **Agent**:
- **Viewer**:


#### 1.
```typescript
interface UserPermissions {
 create: boolean; //
 read: boolean; //
 update: boolean; //
 delete: boolean; //
 invite: boolean; //
 resetPassword: boolean; //
}
```

#### 2.
```typescript
interface ConversationPermissions {
 viewAll: boolean; //
 viewTeam: boolean; //
 viewOwn: boolean; //
 assign: boolean; //
 transfer: boolean; //
 close: boolean; //
 reopen: boolean; //
 export: boolean; //
}
```

#### 3.
```typescript
interface MessagePermissions {
 send: boolean; //
 edit: boolean; //
 delete: boolean; //
 recall: boolean; //
 forward: boolean; //
 viewHistory: boolean; //
}
```

#### 4.
```typescript
interface SystemPermissions {
 viewSettings: boolean; //
 updateSettings: boolean; //
 viewLogs: boolean; //
 viewAnalytics: boolean; //
 exportData: boolean; //
 manageIntegrations: boolean; //
}
```


### 1.
```typescript
//
async function canAccessConversation(
 userId: number,
 conversationId: number,
 action: string
): Promise<boolean> {
 const user = await getUserById(userId);
 const conversation = await getConversationById(conversationId);

 // Super Admin Admin
 if (user.role === 'super_admin' || user.role === 'admin') {
 return true;
 }

 // Team Lead
 if (user.role === 'team_lead' && user.teamId === conversation.teamId) {
 return true;
 }

 // Agent
 if (user.role === 'agent' && conversation.assignedTo === userId) {
 return true;
 }

 return false;
}
```

### 2.
```typescript
//
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

 //
 if (context.timeRestriction) {
 const currentHour = new Date().getHours();
 if (currentHour < context.timeRestriction.start ||
 currentHour > context.timeRestriction.end) {
 return false;
 }
 }

 // IP
 if (context.ipRestriction && context.clientIP) {
 if (!context.ipRestriction.includes(context.clientIP)) {
 return false;
 }
 }

 return true;
}
```


### 1.
```sql
--
CREATE TABLE roles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT UNIQUE NOT NULL,
 display_name TEXT NOT NULL,
 description TEXT,
 is_system BOOLEAN DEFAULT FALSE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--
CREATE TABLE permissions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT UNIQUE NOT NULL,
 resource TEXT NOT NULL,
 action TEXT NOT NULL,
 description TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--
CREATE TABLE role_permissions (
 role_id INTEGER NOT NULL,
 permission_id INTEGER NOT NULL,
 granted BOOLEAN DEFAULT TRUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY (role_id, permission_id),
 FOREIGN KEY (role_id) REFERENCES roles(id),
 FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

--
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

### 2.
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