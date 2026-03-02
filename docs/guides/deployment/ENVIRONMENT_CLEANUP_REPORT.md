

2025-08-29


 (-dev)


### 1. Workers
- ** Worker**: `mcis-worker`
- ** Frontend**: `mcis-ey7`
- ~~ Worker~~: `mcis-worker-dev` ()
- ~~ Frontend~~: `mcis-ey7-dev` ()

### 2. D1
- ****: `mcis-worker` (08ae6790-2494-40a8-a07a-df3920783159)
- ~~~~: `mcis-worker-dev` (3b7339f0-80de-49dc-b079-312df4a4c316) ()

### 3. R2
- ****: `mcis-files`
- ~~~~: `mcis-files-dev` ()
- ** URL**: https://your-storage-domain.example.com

### 4. KV Namespaces
- **SESSIONS**: ace3f7202e6a4dd8b98c50e9b91b2431
- **CACHE**: f3bc7a55c8a14f4fb28b8321fa01dc73
- ~~SESSIONS_preview~~: df901efdffa143638a02f6c6d2d6459f ()
- ~~CACHE_preview~~: bafc060a634943b19409b7ecbb1b4f5b ()

### 5. Queue
- ****: `message-queue`


1. **wrangler.toml**
 -
 - ID

2. **frontend/wrangler.toml**
 -
 - API


1. **frontend/package.json**
 - -dev :
 - switch:dev
 - build:pages:dev
 - copy-pages-config:dev
 - deploy:pages:dev
 - deploy:pages-quick:dev

2. **frontend/scripts/deploy-to-pages.ps1**
 -
 -

3. **scripts/setup-env.ps1**
 - s3dev.example.com
 - R2 URL


```
 Worker: mcis-worker
 Frontend: mcis-ey7
 D1 Database: 08ae6790-2494-40a8-a07a-df3920783159
 R2 Bucket: mcis-files
 KV SESSIONS: ace3f7202e6a4dd8b98c50e9b91b2431
 KV CACHE: f3bc7a55c8a14f4fb28b8321fa01dc73
 Queue: message-queue
```


```
 ENVIRONMENT = "production"
 R2_PUBLIC_URL = "https://your-storage-domain.example.com"
 VITE_API_BASE_URL = "https://your-api-domain.example.com"
```


1. ****
 - Cloudflare Dashboard -dev
 -

2. ****
 - `npm run dev`
 - Wrangler local

3. ****
 - `npm run deploy`
 - `cd frontend && npm run deploy:pages`
 -

