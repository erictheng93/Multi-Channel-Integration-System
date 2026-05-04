# Cloudflare -


- ****: 2025813 09:00
- ****: 2025813 09:30
- ****: 30


### 1.
- **D1 **: `mcis-db`
 - ID: `af267959-762b-4915-907f-ca08a6feb699`
 - :
 - : (2 )

- **R2 **:
 - : `mcis-files-develop`
 - : `mcis-files-production`
 - :

### 2.
- ****:
 -
 -
 - R2

- ****:
 - Worker
 -
 - URL: https://mcis-worker.omfg.workers.dev

### 3.
- ** D1 **: `omni-channel-platform` -
- ** R2 **: `omni-channel-attachments-*` -
- ****:

### 4.
- `wrangler.toml` - ID
- `wrangler-delayed-message.toml` - ID
- `package.json` - npm scripts
- -

## ()

| | | | |
|---------|--------|--------|------|
| D1 | `omni-channel-platform` | `mcis-db` | |
| R2 () | `omni-channel-attachments-develop` | `mcis-files-develop` | |
| R2 () | `omni-channel-attachments-production` | `mcis-files-production` | |


```bash
wrangler d1 execute mcis-db --command="SELECT COUNT(*) FROM agents"
# : 2
```


```bash
npm run dev
# :

npm run deploy
# :
```


```bash
wrangler r2 bucket list
# :
```


- `scripts/rename-cloudflare-resources.ps1`
- `scripts/rename-cloudflare-resources.sh`
- `scripts/rename-cloudflare-resources-fixed.ps1`
- `scripts/rename-resources-simple.ps1`
- `scripts/cleanup-old-resources.ps1`
- `migration-backup.sql`
- `wrangler-temp-old.toml`


- `scripts/README.md` -
- `docs/guides/RESOURCE_RENAMING_GUIDE.md` -
- `docs/guides/RESOURCE_RENAMING_COMPLETION_REPORT.md` -


**Cloudflare 100% **


1.
2.
3.
4.
5.


- ****:
- ****:
- ****:
- ****:


 Cloudflare `mcis-worker`

---

****: Kiro AI Assistant
****: 2025813
****: 