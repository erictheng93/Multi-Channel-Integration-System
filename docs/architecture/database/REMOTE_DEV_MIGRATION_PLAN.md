

 Drizzle ORM


- ****: 2025-08-28 08:09:43 UTC
- ****:
- ****: (multi-channel-platform-dev)


| | | | |
|------|--------|--------|------|
| | 11 | 14 | Drizzle |
| agents | UNIQUE | Drizzle email UNIQUE | |
| conversations | INTEGER idcustomer_id | TEXT UUIDuser_id | |
| | - | | 3 agents1 conversation1 customer |


 Drizzle
- `delayed_messages` -
- `file_attachments` -
- `invitations` -
- `messages` -
- `teams` -
- `users` -


1. **Agents (3)**
 - admin@dacit.net (System Administration) - Admin
 - dacagent@dacit.net (dacagent) - Agent
 - test@dacit.net (Test User) - Agent
 -

2. **Customers (1)**
 -
 -

3. **Conversations (1)**
 - UUID
 - user
 -


- ****: `scripts/migrate-remote-dev-db.ts`
- ** SQL**: `migration_dev_remote.sql`
- ****: wrangler d1 execute --remote


1. **ID **
 ```typescript
 // : integer id
 // : UUID text id
 const convId = generateUUID();
 ```

2. ****
 ```sql
 -- : customer_id -> customers.id
 -- : user_id -> users.id
 ```

3. ****
 ```typescript
 const createdAt = isNaN(Number(agent.created_at)) ?
 `'${agent.created_at}'` :
 `datetime(${agent.created_at} / 1000, 'unixepoch')`;
 ```


 `d1_migrations`
```sql
INSERT OR REPLACE INTO d1_migrations (name, applied_at) VALUES
('0000_charming_chimera.sql', datetime('now')),
('0001_perfect_klaw.sql', datetime('now'));
```


- [x] 14
- [x]
- [x]
- [x] Drizzle


- [x] Agents: 3
- [x]
- [x]
- [x]


- [x] API
- [x]
- [x]


1. ****:
2. ****:
3. ****:


- `remote_agents_backup.json`
- `remote_conversations_backup.json`
- `remote_customers_backup.json`


- Drizzle ORM
-
-
-


- API
-
-

