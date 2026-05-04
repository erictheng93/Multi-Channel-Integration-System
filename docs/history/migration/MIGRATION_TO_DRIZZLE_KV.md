# Drizzle ORM + KV


 Drizzle ORM Cloudflare KV


### 1.

```bash
# D1
wrangler d1 export omni-channel-platform --output backup-$(date +%Y%m%d).sql


cp wrangler.toml wrangler.toml.backup
cp package.json package.json.backup
```

### 2.

```bash
# Drizzle ORM
npm install drizzle-orm@^0.36.4
npm install -D drizzle-kit@^0.30.0


npm list
```

### 3. KV Namespaces

```bash
# Sessions KV
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# Cache KV
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview

# namespace IDs
```

### 4. wrangler.toml

```toml

main = "src/index-drizzle.ts"

# KV bindings
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-kv-id"
preview_id = "your-sessions-kv-preview-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-kv-id"
preview_id = "your-cache-kv-preview-id"
```

### 5. Drizzle

```bash
# drizzle.config.ts ()

echo "CLOUDFLARE_ACCOUNT_ID=your-account-id" >> .env
echo "CLOUDFLARE_DATABASE_ID=37537e1f-625e-4cf9-be60-a01b5c063772" >> .env
echo "CLOUDFLARE_D1_TOKEN=your-d1-token" >> .env
```

### 6. Schema

```bash
# Drizzle
npm run db:generate


ls database/migrations/


npm run db:migrate


npm run db:migrate:prod
```

### 7.

```bash


wrangler dev --local


curl -X POST http://localhost:8787/migrate-data
```

### 8.

```bash
# Drizzle
npm run dev

# API
curl -X POST http://localhost:8787/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"admin","password":"admin123"}'

# API
curl -X GET http://localhost:8787/api/conversations \
 -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```


### 1.

```sql
--
SELECT COUNT(*) FROM users;

--
SELECT COUNT(*) FROM conversations;

--
SELECT COUNT(*) FROM messages;

--
SELECT COUNT(*) FROM agents;
```

### 2.

```bash
# KV Session
curl -X POST http://localhost:8787/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"username":"admin","password":"admin123"}'


curl -X GET http://localhost:8787/api/conversations/conv-123


curl -X POST http://localhost:8787/api/delayed-messages/send \
 -H "Authorization: Bearer TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"conversationId":"conv-123","content":"Test","delaySeconds":30}'
```

### 3.

```bash
# Drizzle Studio
npm run db:studio

# KV
wrangler kv:key list --namespace-id=your-sessions-kv-id
wrangler kv:key list --namespace-id=your-cache-kv-id
```


### 1.

```bash

cp wrangler.toml.backup wrangler.toml
cp package.json.backup package.json


npm install


# wrangler.toml main = "src/index.ts"
```

### 2.

```bash

wrangler d1 execute omni-channel-platform --file=backup-YYYYMMDD.sql
```


### 1.

- ****: Drizzle ORM
- ****: KV
- **Session **: KV session

### 2.

- ****: TypeScript
- **IDE **:
- ****: Drizzle Studio

### 3.

- ****:
- ****:
- ****:


1. **KV Namespace **
 ```bash
 # Cloudflare
 wrangler whoami

 #
 wrangler kv:namespace create "SESSIONS" --force
 ```

2. **Drizzle **
 ```bash
 #
 cat drizzle.config.ts

 #
 npm run db:generate -- --force
 ```

3. **Session **
 ```bash
 # KV binding
 wrangler kv:key list --namespace-id=your-sessions-kv-id

 # session
 wrangler kv:key delete --namespace-id=your-sessions-kv-id session-key
 ```

4. ****
 ```bash
 # KV
 wrangler kv:key list --namespace-id=your-cache-kv-id

 #
 wrangler kv:key delete --namespace-id=your-cache-kv-id cache-key
 ```


1. ** Drizzle Studio**
 ```bash
 npm run db:studio
 # https://local.drizzle.studio
 ```

2. **KV **
 ```bash
 # KV keys
 wrangler kv:key list --namespace-id=your-kv-id

 # key
 wrangler kv:key get --namespace-id=your-kv-id "session:token"
 ```

3. ****
 ```bash
 # Worker
 wrangler tail --format pretty

 #
 wrangler tail --search "Drizzle"
 ```


### 1.

- KV
-
- session

### 2.

```bash
# KV
# KV


npm run db:studio

# Drizzle
npm update drizzle-orm drizzle-kit
```


 Drizzle ORM + KV

-
- KV
-
-


- [Drizzle ORM ](https://orm.drizzle.team/)
- [Cloudflare KV ](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [](./DRIZZLE_KV_INTEGRATION.md)

---

****: 2.0.0
****: 2025-01-11