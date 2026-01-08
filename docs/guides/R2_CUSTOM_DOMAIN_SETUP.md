# R2


 Cloudflare R2


- **Bucket**: `multi-channel-platform-attachments-develop`
- ****: `s3dev.example.com`
- ****:


- **Bucket**: `multi-channel-platform-attachments-production`
- ****: `your-storage-domain.example.com`
- ****:


### (.env)
```env
R2_PUBLIC_URL=https://s3dev.example.com
```

### (.env.production)
```env
R2_PUBLIC_URL=https://your-storage-domain.example.com
```

## Wrangler

 `wrangler.toml`

```toml

[vars]
R2_PUBLIC_URL = "https://s3dev.example.com"


[env.production]
vars = {
 ENVIRONMENT = "production",
 R2_PUBLIC_URL = "https://your-storage-domain.example.com"
}

# R2 -
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "multi-channel-platform-attachments-develop"

# R2
[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "multi-channel-platform-attachments-production"
```


1. ****: R2 bucket
2. **URL **: `R2_PUBLIC_URL` URL
3. ****:


- [ ] `.env` `R2_PUBLIC_URL` `https://s3dev.example.com`
- [ ] `npm run dev`
- [ ]


- [ ] `wrangler.toml` `R2_PUBLIC_URL` `https://your-storage-domain.example.com`
- [ ] `npm run deploy`
- [ ]


1. R2 bucket CORS
2. DNS
3. `R2_PUBLIC_URL`


1. ( 10MB)
2.
3. R2 bucket


- `wrangler.toml`: Worker R2
- `.env.example`:
- `.env.production.example`:
- `src/handlers/attachment.ts`:
- `scripts/setup-r2-storage.ts`: R2


### R2
```bash
# bucket
wrangler r2 bucket list


wrangler r2 object list multi-channel-platform-attachments-develop
wrangler r2 object list multi-channel-platform-attachments-production
```


```bash
# ()
wrangler r2 object delete multi-channel-platform-attachments-develop/test/test-file.txt
```


- R2 10GB
-
-


-
- URL Cloudflare
- Cloudflare 