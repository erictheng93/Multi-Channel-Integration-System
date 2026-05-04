# MCIS MVP


MCIS 8 MVP

### MVP

1. ****
 - LINE OA
 - Facebook Messenger
 -

2. ****
 -
 -
 -

3. ****
 -
 -
 -

4. ****
 - Admin
 -
 -

5. ****
 -
 -
 -
 -

6. **QR Code **
 - QR Code
 - QR Code
 - QR Code

7. ****
 -
 -
 -

8. ****
 - 0-120
 -
 -


### Cloudflare
- **Workers**:
- **D1**: SQLite
- **KV**:
- **R2**:
- **Queues**:
- **Pages**:
- **Cron Triggers**:


| myOmni | MCIS | |
|-------------|------------------|------|
| Go + Gin | TypeScript + Hono | TS |
| PostgreSQL | Cloudflare D1 | SQLite |
| Redis | Cloudflare KV | |
| NATS/Kafka | Cloudflare Queues | |
| Docker/K8s | Serverless | |
| Vue 3 + Nuxt | HTML/CSS/JS | |

## 24

### (Day 1-3)
- [x] TypeScript
- [x] Cloudflare
- [x] schema
- [x] API

### (Day 4-7)
- [ ] JWT
- [ ] CRUD
- [ ]
- [ ] RBAC
- [ ] QR Code

### (Day 8-12)
- [ ]
- [ ]
- [ ]
- [ ]
- [ ] LINE OA

### (Day 13-16)
- [ ] Cloudflare Queues
- [ ]
- [ ]
- [ ]

### (Day 17-20)
- [ ]
- [ ]
- [ ]
- [ ]

### (Day 21-24)
- [ ] Facebook Messenger
- [ ]
- [ ]
- [ ]


1. **5 ** `QUICK_START.md`
2. **** `SETUP_GUIDE.md`
3. **** `MIGRATION_PLAN.md`


```bash
# 1.
node --version # 18+
npm install -g wrangler
wrangler login

# 2. Cloudflare
cd Multi_Channel_Integration_System
wrangler d1 create omni-channel-platform

# 3.
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET
wrangler secret put JWT_SECRET

# 4.
wrangler d1 execute omni-channel-platform --local --file=./schema.sql
wrangler d1 execute omni-channel-platform --local --file=./seed.sql

# 5.
npm install
npm run cf-typegen
npm run dev
```


### (Day 1-7 )
- TypeScript
-
- schema
- API
- LINE Webhook
-
- JWT
- API
-
-
- QR Code
-

### (Day 8 )
-
-
-
- LINE OA


- [ ] API < 200ms
- [ ] 1000+
- [ ] 99.9%
- [ ]


- [ ] 8 MVP
- [ ] LINE OA
- [ ]
- [ ] 15


- [ ] Cloudflare
- [ ] < $10
- [ ]
- [ ]


- `QUICK_START.md` - 5
- `SETUP_GUIDE.md` -
- `MIGRATION_PLAN.md` -
- `TYPESCRIPT_FIXES.md` - TypeScript


- `schema.sql` -
- `seed.sql` -
- `src/types/` -
- `src/utils/` -


- `admin` / `admin123`
- AB
- LINE Facebook
-


 MCIS MVP

1. **** TypeScript + Cloudflare
2. **** MVP
3. ****
4. ****
5. ****

** MVP **

 `QUICK_START.md` 5 LINE Bot 