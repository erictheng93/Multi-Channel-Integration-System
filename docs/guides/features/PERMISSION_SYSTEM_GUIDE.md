

 **2** **4**

## 2

### 1. Admin
- ****: `admin`
- ****:
- ****:
 -
 -
 -
 -
 -
 -
 -

### 2. Agent
- ****: `agent`
- ****:
- ****:
 -
 -
 -
 -
 -
 -

## 4

### 1. Super Admin
- ****: `super_admin`
- ****: `*:*`
- ****:
 - ****
 -
 -
 -
 -

### 2. Admin
- ****: `admin`
- ****:
- ****:
 -
 -
 -
 -
 -

### 3. Team Lead
- ****: `team_lead`
- ****:
- ****:
 -
 -
 -
 -
 -

### 4. Agent
- ****: `agent`
- ****:
- ****:
 -
 -
 -
 -


| | Super Admin | Admin | Team Lead | Agent |
|------|-------------|-------|-----------|-------|
| **** |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| **** |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| **** |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| **** |
| | | | | |
| | | | | |
| | | | | |
| | | | | |


 `.\create-test-users.ps1`


- ****: `superadmin`
- ****: `superadmin123`
- ****: `superadmin@example.com`
- ****: `admin`


- ****: `admin`
- ****: `admin123`
- ****: `admin@example.com`
- ****: `admin`


- ****: `teamlead1`
- ****: `teamlead123`
- ****: `teamlead1@example.com`
- ****: `agent`


- ****: `agent1`
- ****: `agent123`
- ****: `dacagent@dacit.net`
- ****: `agent`


### 1. JWT Token
```typescript
// JWT payload
{
 userId: 1,
 username: "admin",
 role: "admin",
 teamId: 1
}
```

### 2.
```typescript
//
requireRole('admin')

//
requirePermission('conversation', 'view_all')
```

### 3.
```typescript
//
if (conversation.assigned_user_id === userId) {
 //
}

//
if (user.teamId === conversation.assigned_team_id) {
 //
}
```


### 1.
- SHA256
- bcrypt
-

### 2.
- JWT Token 24
- KV
-

### 3.
- 5
-
-

### 4.
-
- IP User-Agent
-


```bash

curl -X POST http://localhost:8787/api/auth/login \
 -H 'Content-Type: application/json' \
 -d '{"username":"admin","password":"admin123"}'


curl -X POST http://localhost:8787/api/auth/login \
 -H 'Content-Type: application/json' \
 -d '{"username":"agent1","password":"agent123"}'
```


```bash
# token
curl -X POST http://localhost:8787/api/auth/register \
 -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"username":"newagent","email":"new@example.com","password":"password123","displayName":"","role":"agent"}'

# token
curl -X POST http://localhost:8787/api/auth/register \
 -H 'Authorization: Bearer YOUR_AGENT_TOKEN' \
 -H 'Content-Type: application/json' \
 -d '{"username":"test","email":"test@example.com","password":"password123","displayName":"","role":"agent"}'
```


1. **Agent Team Lead**: Admin
2. **Team Lead Admin**: Super Admin
3. **Admin Super Admin**:


1. JWT Token
2.
3.


1.
2.
3.


1.
2. Token
3.

---

****: 