# multi-channel-platform MVP


 myOmni MVP multi-channel-platform Cloudflare MVP

## MVP

### 1.
- LINE OA
- Facebook Messenger
-

### 2.
-
-
-

### 3.
-
-
-

### 4.
- Admin
-
-

### 5.
-
-
-
-

### 6. QR Code
- QR Code
- QR Code
- QR Code

### 7.
-
-
-

### 8.
- 0-120
-
-


| | myOmni | multi-channel-platform | Cloudflare |
|------|--------|-------------|----------------|
| | Go | TypeScript | Workers |
| | Docker/K8s | Serverless | Workers |
| | PostgreSQL | SQLite | D1 |
| / | Redis | Key-Value | KV |
| | Local/S3 | Object Storage | R2 |
| | Vue 3 + Nuxt | HTML/CSS/JS | Pages |
| | NATS/Kafka | Queue System | Queues |
| | Cron | Scheduled Jobs | Cron Triggers |


### (Day 1-3)
** Cloudflare **

#### Day 1:
- [ ] Cloudflare
- [ ] D1
- [ ] KV
- [ ] R2
- [ ] Queues

#### Day 2:
- [ ] schema.sql D1
- [ ]
- [ ]

#### Day 3: API
- [ ] Hono
- [ ] CORS
- [ ]

### (Day 4-7)
****

#### Day 4:
- [x] JWT
- [x] / API
- [x]
- [x] KV

#### Day 5:
- [x] CRUD
- [x]
- [x]
- [x] QR Code

#### Day 6:
- [x] RBAC
- [x]
- [x] API
- [x]

#### Day 7:
- [x]
- [x]
- [x]

### (Day 8-12)
****

#### Day 8:
- [ ] CRUD
- [ ]
- [ ]
- [ ]

#### Day 9:
- [ ] CRUD
- [ ]
- [ ]
- [ ]

#### Day 10:
- [ ]
- [ ]
- [ ]
- [ ]

#### Day 11: LINE OA
- [ ] Webhook
- [ ]
- [ ]
- [ ]

#### Day 12:
- [ ]
- [ ]
- [ ]

### (Day 13-16)
****

#### Day 13: Queues
- [ ] Cloudflare Queues
- [ ]
- [ ]
- [ ]

#### Day 14:
- [ ]
- [ ]
- [ ]
- [ ]

#### Day 15:
- [ ] Cron Triggers
- [ ]
- [ ]
- [ ]

#### Day 16:
- [ ]
- [ ]
- [ ]

### (Day 17-20)
****

#### Day 17:
- [ ] /
- [ ]
- [ ]
- [ ]

#### Day 18:
- [ ]
- [ ]
- [ ]
- [ ]

#### Day 19:
- [ ]
- [ ]
- [ ]
- [ ]

#### Day 20:
- [ ]
- [ ]
- [ ]
- [ ]

### (Day 21-24)
****

#### Day 21: Facebook Messenger
- [ ] Facebook API
- [ ] Webhook
- [ ]
- [ ]

#### Day 22:
- [ ]
- [ ]
- [ ]
- [ ]

#### Day 23:
- [ ]
- [ ]
- [ ] SSL
- [ ]

#### Day 24:
- [ ] API
- [ ]
- [ ]
- [ ]

## Cloudflare

### Workers
```javascript
// wrangler.toml
name = "multi-channel-platform"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "omni-channel-platform"

[[kv_namespaces]]
binding = "SESSIONS"
id = "session-storage"

[[r2_buckets]]
binding = "FILES"
bucket_name = "omni-files"

[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-processing"
```

### D1
-
-
-
-

### KV
-
-
-

### R2
-
-
-

### Queues
-
-
-


- [ ] LINE OA
- [ ] Facebook Messenger
- [ ]
- [ ]
- [ ]
- [ ] QR Code
- [ ] 15
- [ ]


- [ ] API < 200ms
- [ ] 99.9%
- [ ] 1000+
- [ ]
- [ ] < 3s


- [ ] JWT
- [ ] API
- [ ]
- [ ]
- [ ]


### ()
1. Cloudflare
2. Cloudflare
3.
4.

### ()
1.
2.
3.
4.

 24 MVP Cloudflare myOmni 