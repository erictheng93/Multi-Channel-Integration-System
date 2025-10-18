
Multi-Channel Support MVP


- `schema.sql` - schema
- `cleanup.sql` -
- `init.sql` - + +
- `init-database.ps1` - PowerShell
- `verify-schema.js` - Node.js


1. **users** -
 -
 - LINEFacebookInstagramWhatsApp

2. **conversations** -
 -
 -

3. **messages** -
 -
 -

4. **agents** -
 -
 -


- `idx_conversations_user` -
- `idx_conversations_status` -
- `idx_conversations_assigned` -
- `idx_messages_conversation` -
- `idx_messages_created` -


### 1.

 PowerShell
```powershell
.\database\init-database.ps1
```


-
-
-
-

### 2.

```powershell
.\database\status.ps1
```

### 3.

```bash
node database/verify-schema.js
```

### 4.


```bash

wrangler d1 execute omni-channel-platform --local --file=database/cleanup-remote.sql

wrangler d1 execute omni-channel-platform --remote --file=database/cleanup-remote.sql
```


```bash

wrangler d1 execute omni-channel-platform --local --file=database/schema.sql

wrangler d1 execute omni-channel-platform --remote --file=database/schema.sql
```


- **Admin**: admin@dacit.net (admin-001)
- **Agent 1**: dacagent@dacit.net (agent-001)


1.
2. `IF NOT EXISTS`
3. Unix timestamp (INTEGER)
4.
5. 