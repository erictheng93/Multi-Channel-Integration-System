# Cloudflare


 Cloudflare


### 1.

#### wrangler.toml
- ****: `multi-channel-platform-db`
- ** ID**: `af267959-762b-4915-907f-ca08a6feb699`
- **R2 ()**: `multi-channel-platform-attachments-develop`
- **R2 ()**: `multi-channel-platform-attachments-production`

#### wrangler-delayed-message.toml
- ****: `multi-channel-platform-db`
- ** ID**: `af267959-762b-4915-907f-ca08a6feb699`

#### package.json
- ****: `multi-channel-platform`
- ****: `multi-channel-platform-db`

### 2.

#### src/handlers/system-main.ts
- **R2 **: `multi-channel-platform-attachments`
- ****:

#### tests/setup-cloudflare-services.ts
- ****: `multi-channel-platform-db`
- ****: `multi-channel-platform`
- ****:

### 3. TypeScript


```bash
npm run build
> tsc --noEmit
Exit Code: 0
```
****: ****

### 4.


| | | |
|---------|--------|------|
| D1 | `multi-channel-platform-db` | |
| R2 () | `multi-channel-platform-attachments-develop` | |
| R2 () | `multi-channel-platform-attachments-production` | |
| | `multi-channel-platform` | |


#### wrangler.toml
```toml
name = "multi-channel-platform"
database_name = "multi-channel-platform-db"
database_id = "af267959-762b-4915-907f-ca08a6feb699"
bucket_name = "multi-channel-platform-attachments-develop"
```

#### package.json
```json
{
 "name": "multi-channel-platform",
 "scripts": {
 "db:migrate": "wrangler d1 migrations apply multi-channel-platform-db --local",
 "db:migrate:prod": "wrangler d1 migrations apply multi-channel-platform-db"
 }
}
```


- R2
-
- ID


- Cloudflare
-
-


****: ****
- DOM
- ****:
- ****: Vue Test Utils DOM
- ****: DOM


- ****: 100%
- **TypeScript **:
- ****: 100%
- ****: DOM


- [x]
- [x]
- [x] ID
- [x] R2
- [x] TypeScript


- [x]
- [x]
- [x]
- [x]


- [x]
- [x]
- [x] ID


1. ****
 ```bash
 npm run dev
 ```

2. ****
 ```bash
 npm run db:migrate
 ```

3. ****
 ```bash
 npm run deploy
 ```


4. ****
 ```powershell
 .\scripts\cleanup-old-resources.ps1
 ```


- **100% **:
- **100% **:
- **100% **: TypeScript
- **100% **:


- ****: (5/5)
- ****: (5/5)
- ****: (5/5)
- ****: (5/5)


Cloudflare ****


- ****:
- ****: `multi-channel-platform`
- ****:
- ****:


- ****:
- ****: 100%
- ****:
- ****:


---

****: 2025813
****: ****
****: 