# TypeScript


 `@cloudflare/workers-types` Cloudflare


### 1.
```bash
wrangler types
```

****: `worker-configuration.d.ts`
- ****:
- ****: workerd@1.20250803.0 2025-07-31 nodejs_compat
- ****: 642c1bdbd042b569af25c78f8b691ae1

### 2. Cloudflare.Env

```typescript
declare namespace Cloudflare {
 interface Env {
 SESSIONS: KVNamespace; // KV ()
 CACHE: KVNamespace; // KV ()
 ENVIRONMENT: "production"; //
 LINE_CHANNEL_ACCESS_TOKEN: string; // LINE
 LINE_CHANNEL_SECRET: string; // LINE
 JWT_SECRET: string; // JWT
 R2_BUCKET: R2Bucket; // R2
 DB: D1Database; // D1
 MESSAGE_QUEUE: Queue; //
 }
}
```

### 3.

#### package.json
```bash
npm uninstall @cloudflare/workers-types
```
- devDependencies
-

#### tsconfig.json
```json
//
"types": [
 "@cloudflare/workers-types",
 "./worker-configuration.d.ts"
]

//
"types": [
 "./worker-configuration.d.ts"
]
```

### 4. TypeScript

#### queue-consumer
- ****: `src/index-original-backup.ts`
- ****: `handleQueueMessage`
- ****: `default`

```typescript
//
export { handleQueueMessage as queue } from './queue-consumer';

//
export { default as queue } from './queue-consumer';
```


### TypeScript
```bash
npm run build
```
****:


- **D1 **: D1Database
- **KV **: KVNamespace
- **R2 **: R2Bucket
- **Queues**: Queue
- ****:
- **Web APIs**: Workers API


- ****: wrangler.toml
- ****:
- ** IntelliSense**:
- ****: Cloudflare Workers


### (@cloudflare/workers-types)
-
-
-
- wrangler.toml

### ()
-
-
- wrangler.toml
-
-


### 1.
 `wrangler.toml`
```bash
wrangler types
```

### 2.
- `worker-configuration.d.ts`
- CI/CD

### 3.
-
- PR


- `wrangler types`
- `@cloudflare/workers-types`
- `tsconfig.json`
- TypeScript
-
-


****: ****

TypeScript Cloudflare

****:
- ****: 100%
- ****:
- ****: IntelliSense
- ****:

****: 