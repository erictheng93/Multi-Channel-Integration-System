


- /
-
-
-
-


- **Admin**:
- **Agent**:
-


-
-
-

## API


```
GET /api/activities
```


- `page`: : 1
- `pageSize`: : 50
- `userId`: ID
- `action`:
- `resourceType`:
- `startDate`:
- `endDate`:


```
GET /api/activities/overview
```
 Admin


```
GET /api/activities/users/:userId/stats
```


```
DELETE /api/activities/cleanup
```
 Admin


`/activities`


-
-
-
-


- Admin
- Agent
-


### (activities)
```sql
CREATE TABLE activities (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 user_name TEXT NOT NULL,
 user_role TEXT NOT NULL,
 action TEXT NOT NULL,
 resource_type TEXT NOT NULL,
 resource_id TEXT,
 details TEXT, -- JSON
 ip_address TEXT,
 user_agent TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```


- `user_login`:
- `user_logout`:
- `conversation_assign`:
- `conversation_transfer`:
- `conversation_close`:
- `settings_update`:
- `team_invite`:
- `team_member_update`:


-
-
-


- API JWT
-
-


-
-
-


-
-
-


-
-
-


1.
2.
3.
4.
5.


1.
2.
3.
4. 