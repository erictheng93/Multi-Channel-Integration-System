# MCIS (Drizzle ORM + KV)


### - ( Drizzle ORM + KV)
****:
****: `.\quick-deploy.ps1`
****: 10
****: Session

### - (Drizzle + KV )
****: Drizzle ORM KV
****: `.\setup-env.ps1`
****: 5 +
****: Drizzle StudioKV

---

## (10 )


```bash

git clone https://github.com/your-username/MCIS.git
cd Multi_Channel_Integration_System


.\quick-deploy.ps1


# (Node.js, npm, wrangler, terraform)
# Cloudflare


# Cloudflare


```

### LINE
 LINE Webhook
1. [LINE Developers Console](https://developers.line.biz/)
2. Webhook URL: `https://your-domain.workers.dev/api/webhook`
3. Webhook

---

## (5 )


```bash

git clone https://github.com/your-username/MCIS.git
cd Multi_Channel_Integration_System


.\setup-env.ps1


# .env
# frontend/.env.local
# JWT Secret
# ENV-SETUP-GUIDE.md
```


```bash

npm install


cd frontend
npm install
cd ..


npm run dev


cd frontend
npm run dev
```


- : http://localhost:8787
- : http://localhost:3000
- ENV-SETUP-GUIDE.md

---

## ()


```bash
# Node.js ( 18+)
node --version

# npm
npm --version

# Wrangler CLI
npm install -g wrangler

# Cloudflare
wrangler login
```

### Cloudflare
```bash

cd Multi_Channel_Integration_System

# D1 ()
wrangler d1 create omni-channel-platform

# R2 ()
wrangler r2 bucket create omni-channel-attachments-develop
wrangler r2 bucket create omni-channel-attachments-production

# database_id
```

### ()
1. `wrangler.toml`
2. R2
```toml
[[d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"
database_id = "37537e1f-625e-4cf9-be60-a01b5c063772" # ID

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "omni-channel-attachments-develop" #
```

### LINE
```bash
# LINE Channel Access Token
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# LINE Channel Access Token

# LINE Channel Secret
wrangler secret put LINE_CHANNEL_SECRET
# LINE Channel Secret

# JWT
wrangler secret put JWT_SECRET
# your-super-secret-jwt-key-here
```


```bash

wrangler d1 execute omni-channel-platform --local --file=./database/schema.sql


wrangler d1 execute omni-channel-platform --local --file=./database/file-attachments-schema.sql


npm run db:migrate:attachments
```


```bash

npm install


cd frontend
npm install
cd ..


npm run cf-typegen


npm run dev


cd frontend
npm run dev
```


```bash

curl http://localhost:8787/health


# http://localhost:3000


npm run test:upload
```

## LINE Webhook

### 1. URL

```
 Starting local server...
[mf:inf] Ready on http://localhost:8787
```

### 2. ngrok URL
```bash
# ngrok ()
npm install -g ngrok


ngrok http 8787
```

### 3. LINE Webhook
1. [LINE Developers Console](https://developers.line.biz/)
2. Messaging API Channel
3. "Webhook settings"
 - Webhook URL: `https://your-ngrok-url.ngrok.io/api/webhook`
 - "Use webhook"
 - "Verify"

### 4. LINE
1. LINE Bot QR Code
2.
3. webhook


### 1. ()
```bash

.\quick-deploy.ps1


.\quick-deploy.ps1 -Environment staging


.\quick-deploy.ps1 -Help
```

### 2. Cloudflare Workers
```bash

npm run deploy


wrangler deployments list
```

### 2.
```bash

wrangler d1 execute omni-channel-platform --file=./database/schema.sql
wrangler d1 execute omni-channel-platform --file=./database/file-attachments-schema.sql


npm run setup:production
```

### 3.
```bash

cd frontend
npm run build

# Cloudflare Pages ()
wrangler pages publish dist --project-name mcis-ey7
```

### 4. LINE Webhook URL
 Webhook URL
`https://mcis-backend.daiwandist.com/api/webhook`


- [ ] Cloudflare (Workers + D1 + R2)
- [ ] D1
- [ ] R2
- [ ] LINE
- [ ] JWT
- [ ]
- [ ]
- [ ]
- [ ]
- [ ] LINE Webhook
- [ ]
- [ ] LINE
- [ ]
- [ ] (100% 132/132 )
- [ ]
- [ ] (43 )
- [ ]
- [ ] API (12 )
- [ ] TypeScript (0 )


 MCIS


1. ****`USER_MANUAL.md` -
2. ****`README.md` - 132
3. ****`docs/README.md` -
4. ****
 -
 -
 -
 - **** - 1-120
 - **** -
 - (Cloudflare R2)
 -
 - LINE OA


- ****: 1-120
- ****:
- ****:
- ****:


- **API **:
- **TypeScript **: 207 0
- ****: 132 100%


**Q: **
```bash

wrangler d1 list

# wrangler.toml database_id

npm run db:migrate:attachments
```

**Q: LINE Webhook **
- Channel Secret
- Webhook URL
- Worker `wrangler tail`

**Q: **
```bash
# TypeScript
npx tsc --noEmit


npm run cf-typegen
```

**Q: **
```bash
# R2
wrangler r2 bucket list


npm run test:upload
npm run verify:upload

# ()
cd frontend
npm run test:run


npm run test:coverage
```

**Q: **
- http://localhost:8787
- http://localhost:3000
- CORS

**** `docs/SETUP_GUIDE.md` 