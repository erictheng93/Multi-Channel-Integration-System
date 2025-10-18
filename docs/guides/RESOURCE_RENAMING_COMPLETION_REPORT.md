# Cloudflare


- ****: 2025813
- ****: 09:14 (UTC+8)


### 1.
- **D1 **: `multi-channel-platform-db`
 - ID: `af267959-762b-4915-907f-ca08a6feb699`
 - : APAC
 - :

- **R2 ()**: `multi-channel-platform-attachments-develop`
 - : 2025-08-13T01:14:22.421Z
 - :

- **R2 ()**: `multi-channel-platform-attachments-production`
 - : 2025-08-13T01:14:30.290Z
 - :

### 2.
- ****: `omni-channel-platform` (ID: 37537e1f-625e-4cf9-be60-a01b5c063772)
- ****: `multi-channel-platform-db` (ID: af267959-762b-4915-907f-ca08a6feb699)
- ****:
- ****:
 - : 2
 - : 0
 - :

### 3.
- **wrangler.toml**: ID
- **wrangler-delayed-message.toml**: ID
- **package.json**: npm scripts

### 4.
- **src/handlers/system-main.ts**: R2
- **tests/setup-cloudflare-services.ts**:
- **tests/package.json**:


| | | | |
|---------|--------|--------|------|
| D1 | `omni-channel-platform` | `multi-channel-platform-db` | |
| R2 () | `omni-channel-attachments-develop` | `multi-channel-platform-attachments-develop` | |
| R2 () | `omni-channel-attachments-production` | `multi-channel-platform-attachments-production` | |


### D1
```bash
wrangler d1 execute multi-channel-platform-db --command="SELECT COUNT(*) FROM agents"
# : 2

wrangler d1 execute multi-channel-platform-db --command="SELECT COUNT(*) FROM users"
# : 0
```

### R2
```bash
wrangler r2 bucket list
# :
```


### ()
- `multi-channel-platform-db` - D1
- `multi-channel-platform-attachments-develop` - R2
- `multi-channel-platform-attachments-production` - R2

### ()
- `omni-channel-platform` - D1 ()
- `omni-channel-attachments-develop` - R2 ()
- `omni-channel-attachments-production` - R2 ()
- `my-omni-channel` - R2 ()


1. ****
 ```bash
 npm run dev
 ```

2. **** ()
 ```bash
 npm run db:migrate
 ```

3. ****
 ```bash
 npm run deploy
 ```


4. **** ()
 ```powershell
 .\scripts\cleanup-old-resources.ps1
 ```


1. **R2 **: R2
2. ****:
3. ****:
4. **DNS **: DNS


Cloudflare `multi-channel-platform`

-
-
-
-

