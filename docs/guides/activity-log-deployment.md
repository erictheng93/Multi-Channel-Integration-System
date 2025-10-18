


1. ****
 - /
 -
 -
 -

2. ****
 - Admin
 - Agent
 - Agent

3. ****
 - (`/activities`)
 -
 -
 -


### 1.


```bash
# 1:
npm run db:migrate

# 2: SQL
# database/migrations/001_add_activities_table.sql SQL
```

### 2.


```
src/
 services/
 activity-service.ts #
 handlers/
 activity.ts # API
 index.ts #
```


```bash

npm run build
npm run deploy
```

### 3.


```
frontend/src/
 views/
 ActivityLog.vue #
 api/
 activities.ts # API
 router/
 index.ts #
 components/ui/
 AppLayout.vue #
```


```bash
cd frontend
npm run build
npm run deploy
```


### 1.

```bash

npx ts-node tests/test-activity-logging.ts


npx ts-node tests/test-permissions.ts
```

### 2.

1. ****
 - Admin
 -

2. ****
 - Agent
 -

3. ****
 - Agent
 -
 -

4. ****
 -
 -

## API

### API

```
GET /api/activities #
GET /api/activities/users/:id/stats #
GET /api/activities/overview # Admin
DELETE /api/activities/cleanup # Admin
```


```
page - : 1
pageSize - : 50: 100
userId - ID
action -
resourceType -
startDate -
endDate -
```


| | | | | | |
|-------|-------------|-------------|----------|-------------|-------------|
| Admin | | | | | |
| Agent | | | | | |


- `user_login` -
- `user_logout` -
- `user_create` -
- `user_update` -
- `user_delete` -


- `conversation_assign` -
- `conversation_transfer` -
- `conversation_close` -
- `conversation_reopen` -


- `message_send` -
- `message_recall` -


- `settings_update` -


- `team_invite` -
- `team_member_update` -
- `team_member_remove` -


1. ****
 ```
 : table activities doesn't exist
 :
 ```

2. ****
 ```
 : 403 Forbidden
 : JWT Token
 ```

3. ****
 ```
 :
 : API
 ```


```bash
# Cloudflare Worker
wrangler tail


# > Console
```


1. ****
 - 90
 - API
 -

2. ****
 -
 -
 -

3. ****
 - JSON
 -
 -


1. ****
 -
 - IP User Agent
 -

2. ****
 - API JWT
 -
 - Admin


1. ****
 -
 -
 -

2. ****
 - API
 -
 -

3. ****
 -
 -
 - API 