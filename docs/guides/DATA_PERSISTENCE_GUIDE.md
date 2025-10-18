

 LINE Bot

```


 LINE
 (Webhook )
 Cloudflare Worker

 D1 ()

 Worker

 LINE API

 D1 ()


```


### 1.
- ****:
- ****: LINE User ID
- ****:

### 2.
- ****:
- ****: active, closed, pending
- ****:

### 3.
- ****:
- ****: ID
- ****:
- ****:

### 4.
- ****:
- ****:
- ****:


#### customers ()
```sql
- id: ID
- platform: (line, facebook )
- platform_user_id: ID
- display_name:
- created_at:
```

#### conversations ()
```sql
- id: ID
- customer_id: ID
- status:
- last_message_at:
- created_at:
```

#### messages ()
```sql
- id: ID (TEXT)
- conversation_id: ID
- sender_type: (customer/agent)
- content:
- message_type: (text/image )
- is_sent:
- created_at:
```


### 1.
```bash
curl http://localhost:8787/health
```

### 2.
```bash
curl http://localhost:8787/api/stats
```

### 3.
```bash
node test-persistence.js
```


```

========================

1. ...
 : healthy
 : connected

2. Webhook...
 Webhook : OK

3. ...
4. ...
 :
 : 2
 : 3
 : 3

 :
 1. [customer] - 2025/8/1 4:58:18
 : 2025-08-01T08:58:18.344Z
 : line
```


```
 test-user-12345 : ""
 - ID: 3, : line
 - ID: 3, : active
 - ID: test-msg-1754038698265
 : ""
 - ID: reply_1754038698344_abc123
 : LINE Worker D1 Worker LINE
```


### 1. Cloudflare
```bash
npm run deploy
```

### 2.
```bash
wrangler d1 execute omni-channel-platform --file=./schema.sql
wrangler d1 execute omni-channel-platform --file=./seed.sql
```

### 3. LINE Webhook URL
- URL: `https://multi-channel-platform.imfinethankyouandyou.com/api/webhook`
- : it is verified


### 1.
- 0-120
- Cloudflare Queues

### 2.
- LINE Official Account
- Facebook Messenger ()
- Instagram ()

### 3.
-
-
-


- **API **: < 100ms
- ****: < 50ms
- ****: < 200ms
- ****: 1000+


- **D1 **:
- **Workers **:
- **KV **:
- **R2 **:


 LINE Bot

 ****:
 ****:
 ****:
 ****:
 ****:

****: MVP 