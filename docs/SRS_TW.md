# (SRS)

**** 1.0
**** 2025825
****
****

---

## 1.

### 1.1
(SRS)

### 1.2
SRS
-
-
-
-
-
-
-

### 1.3
- ****
- ****
- **DevOps**
- ****
- ****
- ****

---

## 2.

### 2.1

#### 2.1.1
Cloudflare

```


 Vue 3 SPA Cloudflare APIs
 Workers (LINE, Facebook)


 Webhook
 (Pages) (Hono.js) ()


 D1 (SQLite)
 KV (Sessions)
 R2 (Files)
 Queues (Async)

```

#### 2.1.2
- ****Cloudflare Workers (V8 Isolates)
- ****Hono.js (TypeScript)
- ****Vue 3 + TypeScript
- ****Cloudflare D1 (SQLite) + Drizzle ORM
- ****Cloudflare KV
- ****Cloudflare R2
- ****Cloudflare Queues
- ****Vite (), TypeScript ()
- ****Vitest (132100%)

### 2.2

#### 2.2.1 (Vue 3 SPA)
****`/frontend/`
****`src/main.ts`
****Cloudflare Pages

****
- **Vue 3 Composition API**
- **Pinia**
- **Vue Router 4**
- **TypeScript**
- **Vite**HMR

****
- `vite.config.ts`
- `vitest.config.ts`
- `tsconfig.json`TypeScript

#### 2.2.2 Worker
****`/src/`
****`src/index.ts`
****Cloudflare Workers ()

****
```
src/
 index.ts #
 handlers/ # ()
 auth-main.ts #
 conversation-main.ts #
 delayed-message-main.ts #
 team-main.ts #
 system-main.ts #
 customer-main.ts #
 middleware/ #
 auth.ts # JWT
 database.ts #
 services/ #
 permission-service.ts #
 activity-service.ts #
 message-recall-service.ts #
 utils/ #
 auth.ts #
 database.ts #
 performance.ts #
 types/ # TypeScript
 bindings.ts # Cloudflare
 database.ts #
 handlers.ts #
```

#### 2.2.3 (Drizzle ORM + D1)
**ORM**Drizzle ORM
****Cloudflare D1 (SQLite)
****`src/db/schema.ts`

****
-
-
-
- Cloudflare

---

## 3.

### 3.1 Cloudflare

#### 3.1.1 Cloudflare Workers
****
- `2025-07-31`
- `["nodejs_compat"]`
-
 - CPU50ms () / 15 ()
 - 128MB
 - 100MB

****`wrangler.toml`
```toml
name = "multi-channel-platform"
main = "src/index.ts"
compatibility_date = "2025-07-31"
compatibility_flags = ["nodejs_compat"]
```

#### 3.1.2 Cloudflare D1
****
- ****`multi-channel-platform-dev`
- ****`multi-channel-platform`
- ****500MB () / 10GB+ ()
- ****100,000/ () / ()

****
```toml
[[d1_databases]]
binding = "DB"
database_name = "multi-channel-platform-dev"
database_id = "3b7339f0-80de-49dc-b079-312df4a4c316"
```

#### 3.1.3 Cloudflare KV
****
- **SESSIONS**
- **CACHE**
- ****1GB
- ****1000/ () / ()

****
```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "ace3f7202e6a4dd8b98c50e9b91b2431"
preview_id = "df901efdffa143638a02f6c6d2d6459f"

[[kv_namespaces]]
binding = "CACHE"
id = "f3bc7a55c8a14f4fb28b8321fa01dc73"
preview_id = "bafc060a634943b19409b7ecbb1b4f5b"
```

#### 3.1.4 Cloudflare R2
****
- ****`multi-channel-platform-attachments-dev`
- ****`multi-channel-platform-attachments-production`
- ****10GB () / ()
- ****1,000,000/ ()

****
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "multi-channel-platform-attachments-dev"
```

#### 3.1.5 Cloudflare Queues
****
- ****`message-queue-dev`
- ****`message-queue`
- ****1,000,000/ ()
- ****105

****
```toml
[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "message-queue-dev"

[[queues.consumers]]
queue = "message-queue-dev"
max_batch_size = 10
max_batch_timeout = 5
```

### 3.2

#### 3.2.1
**API**`http://localhost:8787` (Wrangler)
****`http://localhost:3000` (Vite)
****D1
****R2
****

****
```toml
[vars]
R2_PUBLIC_URL = "https://s3dev.imfinethankyouandyou.com"
ENCRYPTION_KEY = "dev-encryption-key-32-char-long"
```

#### 3.2.2
**API**`https://multi-channel.imfinethankyouandyou.com`
****Cloudflare Pages
****D1
****R2
****SSL/TLS

****
```toml
[env.production.vars]
ENVIRONMENT = "production"
R2_PUBLIC_URL = "https://s3.imfinethankyouandyou.com"
ENCRYPTION_KEY = "production-encryption-key-change-me"
```

****
```toml
[[routes]]
pattern = "multi-channel.imfinethankyouandyou.com/*"
zone_name = "imfinethankyouandyou.com"
```

---

## 4.

### 4.1

#### 4.1.1
```sql
-- ()
users conversations (1:N)
 messages (1:N via conversations)

-- 3
teams agents (1:N, for team/agent roles)
 conversations (1:N, team assignment)
 invitations (1:N, team-specific invites)

--
conversations messages (1:N)
 file_attachments (1:N via messages)
 delayed_messages (1:N)
 agents (N:1, assignment)

--
messages file_attachments (1:N)
 delayed_messages (references for scheduling)
```

#### 4.1.2

**** (`users`)
- `id` (TEXT)
- `platform_id`, `platform`
- `display_name`, `avatar_url`, `email`, `phone`
- `metadata` (JSON)
- `created_at`, `updated_at`

**** (`teams`)
- `id` (INTEGER AUTOINCREMENT)
- `name`, `description`
- QR`qr_code` ()
- `is_active` (boolean)
- `created_at`, `updated_at`

**** (`agents`)
- `id` (TEXT)
- `username`, `email`, `password_hash`
- `password_encrypted` (AES)
- `display_name`, `role` (admin/team/agent)
- `team_id` (teams)
- `is_active`, `password_policy`
- `last_login_at`, `created_at`, `updated_at`

**** (`conversations`)
- `id` (TEXT)
- `user_id` (), `agent_id` ()
- `platform` (LINE, Facebook)
- `status` (pending/in-progress/closed)
- `title`, `last_message_at`
- `created_at`, `updated_at`

**** (`messages`)
- `id` (TEXT)
- `conversation_id`, `sender_id`
- `sender_type`, `message_type`, `content`
- `metadata`, `platform_message_id`, `reply_token`
- `is_read`
- `created_at`, `updated_at`

**** (`file_attachments`)
- `id` (TEXT)
- `message_id`
- `file_name`, `file_type`, `file_size`
- `r2_key` (R2), `url` (URL)
- `created_at`

**** (`delayed_messages`)
- `id` (TEXT)
- `conversation_id`, `agent_id`
- `content`, `message_type`
- `scheduled_at`, `status` (pending/sent/failed/cancelled)
- `metadata` ()
- `created_at`, `updated_at`

**** (`invitations`)
- `id` (TEXT)
- `email`, `name`, `role`
- `team_id` ()
- `token` (), `expires_at`
- `invited_by`, `used_at`, `used_by`
- `created_at`

#### 4.1.3

**Drizzle ORM** (`drizzle.config.ts`)
```typescript
export default {
 schema: "./src/db/schema.ts",
 driver: 'wrangler',
 out: "./drizzle",
 schemaFilter: ["public"],
 breakpoints: true,
 strict: true,
 verbose: true,
 dbCredentials: {
 databaseName: "multi-channel-platform"
 }
} satisfies Config;
```

****
- ****`drizzle/`
- ****`npm run db:generate`
- ****`npm run db:migrate`
- ****`npm run db:migrate:prod`
- ****`npm run db:studio:local`

### 4.2

#### 4.2.1
****
-
-
-

****
- Drizzle ORM
-
-

****
- TypeScript
-
-

#### 4.2.2
****
-
-
-

****
-
- KV
-

****
- Cloudflare D1
-
-

#### 4.2.3
****
- Cloudflare
-
-

****
-
-
-

****
- (RTO)< 4
- (RPO)< 24
-

---

## 5.

### 5.1

#### 5.1.1 JWT
****
- ****HS256 (HMAC with SHA-256)
- ****8 ()
- ****IDID
- ****

****`src/utils/auth.ts`
```typescript
interface JWTPayload {
 userId: string;
 username: string;
 role: 'admin' | 'team' | 'agent';
 teamId?: number;
 exp: number;
 iat: number;
}
```

****
-
-
-
-

#### 5.1.2 (RBAC)
****
```typescript
enum RoleLevel {
 AGENT = 1,
 TEAM = 2,
 ADMIN = 3
}
```

****
- ** (3)** (`*:*`)
- ** (2)**
- ** (1)**

****`src/services/permission-service.ts`
-
-
-

#### 5.1.3
****Cloudflare KV (`SESSIONS` )
****
```typescript
interface SessionData {
 agentId: string;
 username: string;
 role: string;
 loginAt: string;
 expiresAt: string;
}
```

****
-
-
-
-

### 5.2

#### 5.2.1
****
- Cloudflare D1
- Cloudflare R2
- KV
- bcrypt (12)

****
- TLS 1.3
- Cloudflare
- HSTS (HTTP Strict Transport Security)
-

****
- (AES-256)
- API
- PII
-

#### 5.2.2
****
-
- SQL
- XSS
-

****
- TypeScript
- Vue 3 composables
-
- (CSP)

#### 5.2.3 API
****
```typescript
// 10
// API1000
// 10
```

****
- JWT
-
-
-

****
-
-
-
-

### 5.3

#### 5.3.1
****
```typescript
enum SecurityEventType {
 AUTHENTICATION_FAILURE = 'auth_failure',
 AUTHORIZATION_VIOLATION = 'authz_violation',
 SUSPICIOUS_ACTIVITY = 'suspicious_activity',
 DATA_BREACH_ATTEMPT = 'data_breach_attempt',
 SYSTEM_COMPROMISE = 'system_compromise',
 MALWARE_DETECTION = 'malware_detection'
}

interface SecurityEvent {
 id: string;
 type: SecurityEventType;
 severity: 'low' | 'medium' | 'high' | 'critical';
 timestamp: string;
 source: string;
 description: string;
 metadata: object;
 resolved: boolean;
}
```

****
- ****5
- ****
- ****API
- ****

#### 5.3.2
****
```yaml
:
 (P1):
 -
 -
 -
 : (< 1)

 (P2):
 -
 -
 -
 : < 4

 (P3):
 -
 -
 -
 : < 24

 (P4):
 -
 -
 : < 72
```

****
- ****
- ****
- ****
- ****

#### 5.3.3
****
- ****
- ****
- ****
- ****

**KPI**
```typescript
interface SecurityMetrics {
 authenticationFailureRate: number; // < 1%
 unauthorizedAccessAttempts: number; // < 10/day
 securityIncidentCount: number; // < 5/month
 vulnerabilityMeanTimeToRemediation: number; // < 72 hours
 securityTrainingCompletion: number; // 100%
 patchingCompliance: number; // > 95%
}
```

---

## 6.

### 6.1

#### 6.1.1
**API**
- < 200ms (95)
- < 500ms (95)
- < 300ms (95)
- 10MB < 2s
- < 100ms ()

****
- Time to Interactive (TTI)< 3s
- Largest Contentful Paint (LCP)< 2.5s
- First Input Delay (FID)< 100ms
- Cumulative Layout Shift (CLS)< 0.1

****
-
-
-
-

#### 6.1.2
****
- 50
- 1000+
- 2000+

****
- 1000/
- 500/
- 100/
- 50/

****
- 10,000/
- 1,000/
- 100/
- 100+

#### 6.1.3
****
- Worker < 64MB ()
- < 100MB
-
- 80%+

**CPU**
- Worker CPU < 10ms ()
- CPU< 50%
- < 5ms
- < 100ms

### 6.2

#### 6.2.1
****
-
-
-
-

****
-
-
-
-

****
- Cloudflare Workers
- D1
- R2
-

#### 6.2.2
****
```
 (24h)

CDN (7d)

KV (1h)


```

****
- ****CDN
- **API**TTLKV
- ****
- ****KV

****
- (TTL)
-
-
- Stale-while-revalidate

#### 6.2.3
****
- Cloudflare D1
-
-
-

****
-
-
-
-

****
-
-
-
-

### 6.3

#### 6.3.1
****
-
-
-
-

****
- Cloudflare Analytics
-
- (APM)
- (RUM)

****
- > 2s ()
- > 1% ()
- CPU > 80% ()
- > 90% ()

#### 6.3.2
****
```typescript
// Vite
export default defineConfig({
 build: {
 target: 'es2022',
 minify: 'terser',
 rollupOptions: {
 output: {
 manualChunks: {
 'vue-vendor': ['vue', 'vue-router'],
 'pinia-vendor': ['pinia'],
 'conversation': ['./src/views/ConversationList.vue'],
 'dashboard': ['./src/views/Dashboard.vue']
 }
 }
 }
 }
});
```

****
-
-
- I/OAsync/await
-

****
-
-
-
-

---

## 7.

### 7.1

#### 7.1.1 LINE
**API**
- **API**
- **Webhook API**
- **API**
- **API**

****
```typescript
// LINE webhook
const validateLineSignature = (
 body: string,
 signature: string,
 channelSecret: string
): boolean => {
 const hash = crypto.createHmac('sha256', channelSecret)
 .update(body)
 .digest('base64');
 return signature === hash;
};
```

****
- 1000/ ()
- 1
- Webhook3
- 5000

****
- API
- API
-
-

#### 7.1.2 Facebook Messenger ()
**API**
- **API**
- **Webhook API**
- **API**
- **API**

****
```typescript
// Facebook webhook
const verifyFacebookWebhook = (
 mode: string,
 token: string,
 challenge: string
): string | null => {
 if (mode === 'subscribe' && token === VERIFY_TOKEN) {
 return challenge;
 }
 return null;
};
```

****
- Meta
-
-
-

#### 7.1.3
****`src/integrations/platform-adapter.ts`
```typescript
interface PlatformAdapter {
 sendMessage(conversation: Conversation, message: Message): Promise<void>;
 validateWebhook(request: Request): boolean;
 processIncomingMessage(payload: any): Promise<Message>;
 getUserProfile(platformUserId: string): Promise<UserProfile>;
}
```

****
- LINE
- Facebook
-
-

### 7.2

#### 7.2.1 (Drizzle ORM)
****`drizzle.config.ts`
```typescript
export default {
 schema: "./src/db/schema.ts",
 driver: 'wrangler',
 out: "./drizzle",
 dbCredentials: {
 databaseName: "multi-channel-platform"
 }
} satisfies Config;
```

****
```typescript
//
const conversations = await db
 .select()
 .from(conversationsTable)
 .where(eq(conversationsTable.agentId, agentId))
 .orderBy(desc(conversationsTable.lastMessageAt));
```

****
- git
-
-
-

#### 7.2.2 (Cloudflare Queues)
****
```typescript
//
await env.MESSAGE_QUEUE.send({
 conversationId,
 messageContent,
 scheduledAt: Date.now() + delayMs
});
```

****`src/queue-consumer.ts`
```typescript
export default {
 async queue(batch: MessageBatch, env: Bindings): Promise<void> {
 for (const message of batch.messages) {
 await processDelayedMessage(message.body, env);
 message.ack();
 }
 }
};
```

****
-
-
-
-

#### 7.2.3 (Cloudflare R2)
****
```typescript
//
const uploadFile = async (
 file: File,
 metadata: FileMetadata,
 env: Bindings
): Promise<FileUploadResult> => {
 const key = generateSecureKey(file.name);
 await env.R2_BUCKET.put(key, file.stream(), {
 metadata: {
 originalName: file.name,
 contentType: file.type,
 uploadedBy: metadata.userId
 }
 });
 return { key, url: generatePublicURL(key) };
};
```

****
- URL
-
-
-

### 7.3 -

#### 7.3.1 API
**API**`frontend/src/api/base.ts`
```typescript
class APIClient {
 private baseURL: string;
 private authToken: string | null = null;

 constructor(baseURL: string) {
 this.baseURL = baseURL;
 }

 async request<T>(
 method: string,
 endpoint: string,
 data?: any
 ): Promise<T> {
 const response = await fetch(`${this.baseURL}${endpoint}`, {
 method,
 headers: {
 'Content-Type': 'application/json',
 ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
 },
 body: data ? JSON.stringify(data) : undefined
 });

 if (!response.ok) {
 throw new APIError(response.status, await response.text());
 }

 return response.json();
 }
}
```

**API**
- `auth.ts`
- `conversations.ts`
- `messages.ts`
- `team.ts`
- `files.ts`

#### 7.3.2 (Pinia)
****
```typescript
// API
export const useAuthStore = defineStore('auth', () => {
 const currentAgent = ref<Agent | null>(null);
 const apiClient = new APIClient('/api');

 const login = async (credentials: LoginCredentials) => {
 const response = await apiClient.login(credentials);
 currentAgent.value = response.agent;
 apiClient.setAuthToken(response.token);
 };

 return { currentAgent, login };
});
```

****
-
- UI
-
-

#### 7.3.3
**WebSocket** ()
```typescript
//
const useConversationUpdates = () => {
 const socket = new WebSocket('/api/ws/conversations');

 socket.onmessage = (event) => {
 const update = JSON.parse(event.data);
 updateConversationStore(update);
 };

 return { socket };
};
```

**** ()
```typescript
//
const pollForUpdates = async () => {
 const updates = await api.getConversationUpdates(lastUpdateTime);
 updateLocalState(updates);
};
```

---

## 8.

### 8.1

#### 8.1.1
**Node.js**
- Node.js 18.x
- npm 9.x
- TypeScript 5.3+

****
- Wrangler CLI 4.31.0+ (Cloudflare Workers)
- Vite 5.0+ ()
- Drizzle Kit ()
- Git 2.40+ ()

**IDE**
- Visual Studio Code ()
- TypeScript
- Vue Language Features (Volar)
- ESLintPrettier
- CloudflareWrangler

#### 8.1.2
****
```bash

git clone <repository-url>
cd multi-channel-integration-system


npm install


cd frontend && npm install && cd ..


.\setup-env.ps1


npm run db:migrate
npm run db:studio:local # GUI
```

****
```bash

npm run dev # localhost:8787Wrangler


cd frontend && npm run dev # localhost:3000Vite


cd frontend && npm run test # 132100%


npm run build # TypeScript
cd frontend && npm run type-check # TypeScript
```

#### 8.1.3
**** (`wrangler.toml`)
```toml

[[d1_databases]]
binding = "DB"
database_name = "multi-channel-platform-dev"

[[kv_namespaces]]
binding = "SESSIONS"
id = "development-sessions-id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "attachments-dev"
```

**** (`vite.config.ts`)
```typescript
export default defineConfig({
 server: {
 port: 3000,
 proxy: {
 '/api': {
 target: 'http://localhost:8787',
 changeOrigin: true
 }
 }
 }
});
```

### 8.2

#### 8.2.1
**** (Vitest + Vue Testing Library)
```typescript
// vitest.config.ts
export default defineConfig({
 test: {
 environment: 'happy-dom',
 globals: true,
 setupFiles: ['./vitest.setup.ts']
 }
});
```

****
- 100% (132/132)
- 100%
- API
- E2E

#### 8.2.2
****
- (Vue)
- (Pinia)
-
- ()

****
- API
-
-
- /

****
-
-
-
-

#### 8.2.3
****
```typescript
//
export const createMockConversation = (): Conversation => ({
 id: 'test-conv-' + Math.random(),
 userId: 'test-user-123',
 agentId: 'test-agent-456',
 platform: 'line',
 status: 'pending',
 createdAt: new Date().toISOString()
});
```

****
- SQLite
-
-
-

### 8.3

#### 8.3.1
**** (TypeScript)
```bash
# (Workers)
npm run build # tsc --noEmit


wrangler deploy --env production
```

**** (Vite)
```typescript
//
export default defineConfig({
 build: {
 target: 'es2022',
 minify: 'terser',
 terserOptions: {
 compress: {
 drop_console: true,
 drop_debugger: true
 }
 },
 rollupOptions: {
 output: {
 manualChunks: {
 'vue-vendor': ['vue', 'vue-router'],
 'pinia-vendor': ['pinia']
 }
 }
 }
 }
});
```

#### 8.3.2
****
```bash

wrangler deploy --env development


cd frontend && npm run build && npm run deploy:pages
```

****
```bash

.\quick-deploy.ps1


npm run deploy #
cd frontend && npm run deploy:pages #
```

#### 8.3.3
****
- `wrangler.toml`
- Cloudflare
-
-

****
```bash

curl https://multi-channel.imfinethankyouandyou.com/api/health


curl https://frontend.imfinethankyouandyou.com


npm run db:migrate:prod --dry-run
```

---

## 9.

### 9.1

#### 9.1.1
****
```typescript
//
app.get('/api/health', async (c) => {
 const health = {
 status: 'healthy',
 timestamp: new Date().toISOString(),
 services: {
 database: await checkDatabaseHealth(c.env.DB),
 cache: await checkKVHealth(c.env.CACHE),
 queue: await checkQueueHealth(c.env.MESSAGE_QUEUE),
 storage: await checkR2Health(c.env.R2_BUCKET)
 }
 };
 return c.json(health);
});
```

****
- (p50, p95, p99)
-
-
- CPU
-

****
- Cloudflare Analytics ()
-
-
-

#### 9.1.2
****
```yaml

- > 5% 5
- 95 > 5
-
-


- > 1% 10
- 95 > 2
- (>80%)
- > 1000
```

****
-
- Slack/Teams
- SMS
-

#### 9.1.3
****
```typescript
//
const logger = {
 info: (message: string, metadata?: object) => {
 console.log(JSON.stringify({
 level: 'info',
 timestamp: new Date().toISOString(),
 message,
 ...metadata
 }));
 }
};
```

****
- ()
- (HTTP)
- ()
- ()
- ()

****
-
-
-
- (5)

### 9.2

#### 9.2.1
****
-
-
-
-

****
```bash

wrangler d1 backup create multi-channel-platform


wrangler d1 backup list multi-channel-platform

# ()
wrangler d1 backup restore multi-channel-platform <backup-id>
```

****
-
- (RTO)4
- (RPO)24
-

#### 9.2.2
****
- KV
-
-
-

****
- R2
-
-
-

#### 9.2.3
****
1.
2.
3.
4.
5.

****
-
-
-
-
-

### 9.3

#### 9.3.1
****
-
-
-
-

****
-
-
-
-

****
-
-
-
-

#### 9.3.2
****
```bash

npm outdated


npm update
cd frontend && npm update


npm run test:all
```

****
-
-
-
-

****
- ( )
-
- A/B
-

#### 9.3.3
****
-
-
- KV
-

****
-
-
-
-

****
-
-
-
-

---

## 10.

### 10.1

#### 10.1.1
**GDPR** ()
-
-
-
-

****
```typescript
// GDPR
class GDPRDataHandler {
 async requestDataExport(userId: string): Promise<UserDataExport> {
 return {
 personalData: await this.getUserPersonalData(userId),
 conversationHistory: await this.getUserConversations(userId),
 preferences: await this.getUserPreferences(userId)
 };
 }

 async deleteUserData(userId: string): Promise<void> {
 //
 await this.anonymizeUserData(userId);
 await this.removePersonallyIdentifiableInformation(userId);
 }
}
```

****
-
-
-
-

#### 10.1.2
**ISO 27001**
-
-
-
-

****
-
-
-
-

****
-
-
-
-

#### 10.1.3
****
-
-
-
- (LINE, Facebook)

****
-
-
-
- (WCAG 2.1 AA)

### 10.2

#### 10.2.1
**TypeScript**
```typescript
// TypeScript
{
 "compilerOptions": {
 "strict": true,
 "noUncheckedIndexedAccess": true,
 "noImplicitReturns": true,
 "noUnusedLocals": true,
 "noUnusedParameters": true
 }
}
```

****
- ESLint
- Prettier
- Husky
- SonarQube

****
- 90% (100%)
-
- API
- E2E

#### 10.2.2
****
- JSDoc
- README
- (ADR)
- OpenAPI/SwaggerAPI

****
-
-
-
-

#### 10.2.3
**Git**
-
- (Conventional Commits)
-
-

****
-
-
-
-

### 10.3

#### 10.3.1 (SLA)
****
- 99.9%
- <4/
- <8/
- 99.99%

****
- API<2 (95)
- <100ms ()
- 10MB<5
- <1

****
- <2
- <8
- <24
- 72

#### 10.3.2
****
1.
2.
3.
4.
5.
6.

****
-
-
-
-

#### 10.3.3
****
- (RTO)<4
- (RPO)<24
-
-

****
-
-
-
-

---

## 11.

### 11.1

#### 11.1.1
| | | | |
|---|---|---|---|
| | Cloudflare Workers | | |
| | Hono.js | 4.8.10+ | Web |
| | Vue 3 | 3.5.12+ | UI |
| | Cloudflare D1 | | SQLite |
| ORM | Drizzle ORM | 0.44.4+ | |
| | Cloudflare KV | | |
| | Cloudflare R2 | | |
| | Cloudflare Queues | | |
| | Vite | 5.0+ | |
| | Vitest | 3.2.4+ | / |
| | TypeScript | 5.3+ | |

#### 11.1.2 API
| | | | |
|---|---|---|---|
| | `/api/auth/*` | POST, DELETE | JWT/Session |
| | `/api/conversations/*` | GET, POST, PUT, DELETE | JWT |
| | `/api/messages/*` | GET, POST, DELETE | JWT |
| | `/api/teams/*` | GET, POST, PUT, DELETE | JWT |
| | `/api/files/*` | GET, POST, DELETE | JWT |
| | `/api/system/*` | GET, POST | JWT |
| Webhook | `/api/webhooks/*` | POST | |
| | `/api/health` | GET | |

#### 11.1.3
| | | | | |
|---|---|---|---|---|
| users | id (TEXT) | - | platform_id | |
| teams | id (INTEGER) | - | name | |
| agents | id (TEXT) | team_id teams | username, email | |
| conversations | id (TEXT) | user_id users, agent_id agents | status, platform | |
| messages | id (TEXT) | conversation_id conversations | created_at | |
| file_attachments | id (TEXT) | message_id messages | r2_key | |
| delayed_messages | id (TEXT) | conversation_id, agent_id | scheduled_at, status | |
| invitations | id (TEXT) | team_id teams | token, email | |

### 11.2

#### 11.2.1
```toml
# wrangler.toml
name = "multi-channel-platform"
main = "src/index.ts"
compatibility_date = "2025-07-31"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "development"
R2_PUBLIC_URL = "https://files.your-domain.com"
ENCRYPTION_KEY = "your-32-character-encryption-key"

[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-namespace-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-namespace-id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-file-bucket-name"

[[queues.producers]]
binding = "MESSAGE_QUEUE"
queue = "your-message-queue-name"

[[queues.consumers]]
queue = "your-message-queue-name"
max_batch_size = 10
max_batch_timeout = 5
```

#### 11.2.2
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
 plugins: [vue()],
 server: {
 port: 3000,
 proxy: {
 '/api': {
 target: process.env.VITE_API_BASE_URL || 'http://localhost:8787',
 changeOrigin: true
 }
 }
 },
 build: {
 target: 'es2022',
 minify: 'terser'
 }
});
```

### 11.3

#### 11.3.1
- [ ] (132/132)
- [ ] TypeScript
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

#### 11.3.2
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

### 11.4

#### 11.4.1
****
```bash

wrangler d1 info DB


npm run db:studio:local


wrangler d1 migrations apply DB --local
```

****
```bash

rm -rf dist node_modules/.vite
npm install

# TypeScript
npm run build
cd frontend && npm run type-check


wrangler deploy --dry-run
```

****
```bash

cd frontend && npm run build:analyze


npm run db:studio:local


curl https://your-domain.com/api/health
```

#### 11.4.2
****
1.
2.
3.
4.
5.
6.
7.

****
1.
2.
3.
4.
5.
6.
7.

---

## 12.

### 12.1
- **** (SRS)
- ****1.0
- ****2025825
- ****2025825
- ****
- ****

### 12.2
| | | | |
|---|---|---|---|
| | | 2025-08-25 | |
| | | 2025-08-25 | |
| DevOps | | 2025-08-25 | |
| | | 2025-08-25 | |
| | QA | 2025-08-25 | |

### 12.3
| | | | |
|---|---|---|---|
| 1.0 | 2025-08-25 | | |

### 12.4
- ** (BRD)**
- ** (FRS)**
- ** (NFR)**
- ****
- ****
- ****

---

****
****20251125
****DevOps