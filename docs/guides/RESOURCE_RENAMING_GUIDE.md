# Cloudflare


 Cloudflare `multi-channel-platform` `omni-channel` `multi-channel-platform`


### ()
- **D1 **: `omni-channel-platform`
- **R2 ()**: `omni-channel-attachments-develop`
- **R2 ()**: `omni-channel-attachments-production`

### ()
- **D1 **: `multi-channel-platform`
- **R2 ()**: `multi-channel-platform-attachments-develop`
- **R2 ()**: `multi-channel-platform-attachments-production`


### 1.

**Windows (PowerShell)**:
```powershell
.\scripts\rename-cloudflare-resources.ps1
```

**Linux/macOS (Bash)**:
```bash
./scripts/rename-cloudflare-resources.sh
```

### 2.


```powershell
.\scripts\cleanup-old-resources.ps1
```


### 1: D1

```bash

wrangler d1 create multi-channel-platform

# database_id:
# database_id = "new-database-id-here"
```

### 2: R2

```bash

wrangler r2 bucket create multi-channel-platform-attachments-develop


wrangler r2 bucket create multi-channel-platform-attachments-production
```

### 3:

 `wrangler.toml` `wrangler-delayed-message.toml` ID

```toml
# database_id ID
[[d1_databases]]
binding = "DB"
database_name = "multi-channel-platform"
database_id = "new-database-id-here"
```

### 4:

```bash

wrangler d1 export omni-channel-platform --output=migration-backup.sql


wrangler d1 execute multi-channel-platform --file=migration-backup.sql
```

### 5: R2

R2 `rclone`

```bash
# rclone ()
# Cloudflare R2


rclone sync cloudflare:omni-channel-attachments-develop cloudflare:multi-channel-platform-attachments-develop
rclone sync cloudflare:omni-channel-attachments-production cloudflare:multi-channel-platform-attachments-production
```

### 6:

```bash

npm run db:migrate


npm run dev


npm run deploy
```

### 7:


```bash

wrangler d1 delete omni-channel-platform


wrangler r2 bucket delete omni-channel-attachments-develop
wrangler r2 bucket delete omni-channel-attachments-production
```


- `wrangler.toml`
- `wrangler-delayed-message.toml`
- `package.json` (npm scripts)


- `src/handlers/system-main.ts`
- `tests/setup-cloudflare-services.ts`
- `tests/package.json`


-


1. ****:
2. ****:
3. ** ID**: ID
4. **R2 **: R2
5. **DNS **: DNS


```bash

wrangler d1 list
wrangler r2 bucket list


wrangler d1 execute multi-channel-platform --command="SELECT COUNT(*) FROM users"


npm run dev
```


1. ****: `wrangler.toml` `database_id`
2. **R2 **:
3. ****:
4. ****:


1. Cloudflare Dashboard
2. `wrangler tail`
3. [](../testing/TROUBLESHOOTING.md)
4. 