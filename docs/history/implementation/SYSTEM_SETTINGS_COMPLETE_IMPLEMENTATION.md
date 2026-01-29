

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
PUT /api/team/members/:id/status -
DELETE /api/team/members/:id -
POST /api/team/members - (Direct Add)
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

### Note
邀請系統已移除，改用直接添加成員的方式管理團隊人員。


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


