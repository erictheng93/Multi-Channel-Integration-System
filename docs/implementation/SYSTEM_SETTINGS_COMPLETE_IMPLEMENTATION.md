

 API


### 1.
- **SystemSettings.vue **
- ****`/settings`
- ****
- **API ** API (`frontend/src/api/system.ts`)

### 2. API
- ****`src/handlers/system.ts`
- ****`src/handlers/team.ts`
- **** API `src/index.ts`

### 3.
- ****`system_settings` `database/schema.sql`
- ****`invitations`


#### 1.
-
-
-
-

#### 2.
- **LINE Official Account **
 - Channel ID
 - Channel Secret
 - Access Token
 -
 -

- **Facebook Messenger **
 - App ID
 - App Secret
 - Page ID
 - Page Token
 -
 -

#### 3.
-
-
-
-
-
-
-

#### 4.
- ****
 -
 -
 -

- ****
 -
 -
 -

- ****
 -
 -


-
-
- /
-


-
-
-
-

## API

### API
```
GET /api/system/info -
GET /api/system/settings -
PUT /api/system/settings -
POST /api/system/integrations/:platform/test -
GET /api/system/metrics -
POST /api/system/database/backup -
GET /api/system/database/backups -
POST /api/system/database/restore/:id -
POST /api/system/cache/clear -
POST /api/system/restart -
GET /api/system/health -
```

### API
```
GET /api/team/members -
POST /api/team/invite -
GET /api/team/invitations -
DELETE /api/team/invitations/:id -
PUT /api/team/members/:id/status -
DELETE /api/team/members/:id -
GET /api/invites/:token -
POST /api/invites/:token/accept -
```


-
-
-


-
-
-


1. **JWT ** API JWT
2. ****
3. **** bcryptjs
4. **** UUID
5. **** 7


### system_settings
```sql
CREATE TABLE system_settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
```

### invitations
```sql
CREATE TABLE invitations (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 name TEXT NOT NULL,
 role TEXT NOT NULL,
 token TEXT UNIQUE NOT NULL,
 invited_by TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 used_by TEXT,
 FOREIGN KEY (invited_by) REFERENCES agents(id)
);
```


- `tests/unit/views/SystemSettings.test.ts`
- `tests/unit/views/TeamManagement.test.ts`
- API


1. ****
 - `JWT_SECRET`JWT
 - `FRONTEND_URL` URL

2. ****

3. ****


 API


 LINEFacebook


