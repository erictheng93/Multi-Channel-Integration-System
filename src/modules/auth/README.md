# Auth Module ()

> **Version:** 1.2.0
> **Status:** Production Ready
> **TypeScript Path:** `@auth/*`


 JWT AdminTeam LeaderAgent


- **JWT ** - Token
- **** - Admin / Team Leader / Agent
- **** - Cloudflare KV
- **** - bcrypt
- **Token ** - Token
- **** -

## API


```
POST /api/auth/login #
POST /api/auth/register #
POST /api/auth/logout #
POST /api/auth/refresh # Token
GET /api/auth/me #
POST /api/auth/verify-token # Token
GET /api/auth/health #
```


| | Admin | Team Leader | Agent |
|------|-------|-------------|-------|
| | | | |
| | | | |
| | | | |
| | | () | () |


```typescript
import { authHandler } from '@auth/handlers';

//
const response = await fetch('/api/auth/login', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 username: 'admin@example.com',
 password: 'secure_password'
 })
});

const { token, user } = await response.json();
```


```typescript
import { jwtAuth } from '@auth/middleware';
import { Hono } from 'hono';

const app = new Hono();

// /api/admin/*
app.use('/api/admin/*', jwtAuth);

//
app.get('/api/admin/users', async (c) => {
 const user = c.get('user'); //
 return c.json({ user });
});
```


```typescript
import { requireRole } from '@auth/middleware';

// Admin
app.get('/api/system/settings', requireRole('admin'), async (c) => {
 //
});

// Admin Team Leader
app.get('/api/team/members', requireRole(['admin', 'team']), async (c) => {
 //
});
```


```
src/modules/auth/
 handlers/
 auth-main.ts #
 index.ts # Handler
 middleware/
 auth.ts # JWT
 index.ts # Middleware
 services/
 auth-service.ts #
 index.ts # Service
 types/
 auth-types.ts #
 index.ts # Type
 utils/
 jwt.ts # JWT
 password.ts #
 index.ts # Util
 index.ts #
```


- `@/db` - Database schema and types
- `@/utils` - Shared utility functions


- `hono` - Web
- `jose` - JWT
- `bcrypt` -
- `drizzle-orm` - ORM


```typescript
interface AuthConfig {
 jwt: {
 secret: string; // JWT
 expiresIn: string; // Token (: '24h')
 refreshExpiresIn: string; // Refresh Token (: '7d')
 };
 session: {
 kvNamespace: string; // KV
 sessionTTL: number; // TTL ()
 };
 security: {
 bcryptRounds: number; // bcrypt (: 12)
 maxLoginAttempts: number; //
 lockoutDuration: number; // ()
 };
}
```


```bash

npm run test -- src/modules/auth


npm run test:integration -- auth
```


1. **** - bcrypt
2. **Token ** - JWT HS256
3. **** - KV
4. **** -
5. **HTTPS Only** - HTTPS


- ****: < 200ms (P95)
- **Token **: < 50ms (P95)
- ** (KV)**: < 10ms (P95)
- ****: 1000+ req/s


### Q: Token

A: 401 `/api/auth/refresh` Token

### Q:

A: Refresh Token 30 localStorage

### Q:

A: TokenKV


### v1.2.0 (2025-09-30)
- TypeScript `@auth/*`
- Token
- API

### v1.1.0
-
-

### v1.0.0
-


 [CONTRIBUTING.md](../../../CONTRIBUTING.md)


MIT License - [LICENSE](../../../LICENSE)

---

****: Multi-Channel Integration System Team
****: 2025-09-30