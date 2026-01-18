# Environment Configuration System

本文件採用 **3 層架構模式** 進行環境配置管理，實現生產/開發環境的無縫切換，並消除硬編碼 URL。

## Architecture Pattern: 3-Layer Configuration

```
╔═══════════════════════════════════════════════════════════════╗
║ Layer 3: Business Logic Code                                  ║
║ → Components, Services, Handlers                              ║
║ → Uses: getBackendUrl(), getWebSocketUrl(), etc.              ║
╚═══════════════════════════════════════════════════════════════╝
                        │
                        │ (Imports configuration functions)
                        ▼
╔═══════════════════════════════════════════════════════════════╗
║ Layer 2: Runtime Configuration Layer                          ║
║ → frontend/src/config/runtime.ts (428 lines)                  ║
║ → src/config/runtime.ts (300+ lines)                          ║
║ → Functions: getBackendUrl(), getWebSocketUrl()               ║
║   getFrontendUrl(), getStoragePublicUrl()                     ║
║   validateRuntimeConfig(), etc.                               ║
╚═══════════════════════════════════════════════════════════════╝
                        │
                        │ (Reads from environment variables)
                        ▼
╔═══════════════════════════════════════════════════════════════╗
║ Layer 1: Environment Variables                                ║
║ → .env.development / .env.production (Frontend)               ║
║ → .dev.vars (Backend development)                             ║
║ → wrangler.toml [vars] (Backend production)                   ║
║ → Cloudflare Dashboard secrets (Production secrets)           ║
╚═══════════════════════════════════════════════════════════════╝
```

## Key Configuration Functions

### Frontend Runtime Configuration (`frontend/src/config/runtime.ts`)

```typescript
import { getBackendUrl, getWebSocketUrl, getApiEndpoint } from '@/config/runtime';

// Get backend API base URL
const apiUrl = getBackendUrl();
// Returns: 'https://your-api-domain.example.com' (production)
//       or 'http://localhost:8787' (development)

// Get WebSocket URL (auto protocol conversion)
const wsUrl = getWebSocketUrl();
// Automatically converts: https: → wss:, http: → ws:
// Returns: 'wss://your-api-domain.example.com/ws' (production)
//       or 'ws://localhost:8787/ws' (development)

// Get full API endpoint
const endpoint = getApiEndpoint('/api/messages');
// Returns: 'https://your-api-domain.example.com/api/messages'

// Get storage public URL
import { getStoragePublicUrl } from '@/config/runtime';
const storageUrl = getStoragePublicUrl();
// Returns: 'https://your-storage-domain.example.com'

// Validate runtime configuration
import { validateRuntimeConfig } from '@/config/runtime';
validateRuntimeConfig(); // Throws error if config invalid

// Check environment
import { isDevelopment, isProduction } from '@/config/runtime';
if (isDevelopment()) {
  console.log('Running in development mode');
}
```

### Backend Runtime Configuration (`src/config/runtime.ts`)

```typescript
import { getBackendUrl, getFrontendUrl } from './config/runtime';
import type { WorkerEnv } from './types';

// In Hono handler
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    // Get configuration from Worker environment
    const backendUrl = getBackendUrl(env);
    const frontendUrl = getFrontendUrl(env);

    // Use in CORS configuration
    const allowedOrigins = [backendUrl, frontendUrl];

    return new Response('OK');
  }
}

// In Hono Context
import { getConfigFromContext } from './config/runtime';

app.get('/api/example', async (c) => {
  const config = getConfigFromContext(c);
  // config contains: backendUrl, frontendUrl, jwtSecret, environment, etc.

  return c.json({ backendUrl: config.backendUrl });
});
```

## Environment Variables Reference

### Frontend Environment Variables (`.env.development` / `.env.production`)

**Core URLs:**
- `VITE_BACKEND_URL` - Backend API base URL (required)
- `VITE_FRONTEND_URL` - Frontend application URL (required)
- `VITE_FRONTEND_PAGES_URL` - Cloudflare Pages URL (optional)
- `VITE_WEBSOCKET_URL` - WebSocket server URL (optional, auto-derived if not set)
- `VITE_STORAGE_PUBLIC_URL` - R2 storage public URL (required)

**Environment Configuration:**
- `VITE_ENV` - Environment identifier: `development` | `staging` | `production`
- `VITE_DEBUG` - Enable debug logging: `true` | `false`
- `VITE_WEBSOCKET_ENABLED` - Enable WebSocket: `true` | `false`
- `VITE_WEBSOCKET_AUTO_RECONNECT` - Auto-reconnect WebSocket: `true` | `false`

**Feature Flags:**
- `VITE_ENABLE_PERFORMANCE_MONITORING` - Enable performance tracking
- `VITE_ENABLE_ERROR_REPORTING` - Enable error reporting
- `VITE_ENABLE_ANALYTICS` - Enable analytics

**WebSocket Configuration:**
- `VITE_WEBSOCKET_RECONNECT_INTERVAL` - Reconnect interval in ms (default: 3000)
- `VITE_WEBSOCKET_MAX_RECONNECT_ATTEMPTS` - Max reconnect attempts (default: 5)
- `VITE_WEBSOCKET_HEARTBEAT_INTERVAL` - Heartbeat interval in ms (default: 30000)

**API Configuration:**
- `VITE_API_TIMEOUT` - API request timeout in ms (default: 30000)
- `VITE_API_RETRY_ATTEMPTS` - Number of retry attempts (default: 3)
- `VITE_API_RETRY_DELAY` - Retry delay in ms (default: 1000)

See `frontend/.env.example` for complete list with detailed descriptions.

### Backend Environment Variables (`.dev.vars` / `wrangler.toml`)

**Core Configuration:**
- `BACKEND_URL` - Backend API base URL
- `FRONTEND_URL` - Frontend application URL
- `FRONTEND_PAGES_URL` - Cloudflare Pages URL (optional)
- `JWT_SECRET` - JWT signing secret (required, min 32 characters)
- `ENCRYPTION_KEY` - Data encryption key (required, 32 characters)
- `ENVIRONMENT` - Environment: `development` | `production`

**External API Credentials:**
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Messaging API token
- `LINE_CHANNEL_SECRET` - LINE channel secret
- `FACEBOOK_APP_ID` - Facebook app ID
- `FACEBOOK_APP_SECRET` - Facebook app secret

**Cloudflare Bindings (defined in wrangler.toml):**
- `DB` - D1 Database binding
- `KV_SESSION` - KV namespace for sessions
- `KV_CACHE` - KV namespace for cache
- `R2_STORAGE` - R2 bucket for file storage
- `DELAYED_MESSAGE_QUEUE` - Queue for delayed messages
- `CONVERSATION_ROOM` - Durable Objects for conversations
- `USER_CONNECTION` - Durable Objects for user connections
- `MESSAGE_BROADCASTER` - Durable Objects for message broadcasting

## Environment Switching Guide

**Switch to Development Environment:**

1. **Frontend:**
   ```bash
   cd frontend
   cp .env.development .env
   # Edit .env to customize local URLs if needed
   npm run dev
   ```

2. **Backend:**
   ```bash
   # Ensure .dev.vars is configured
   npm run dev  # Connects to REMOTE resources
   ```

**Switch to Production Environment:**

1. **Frontend:**
   ```bash
   cd frontend
   cp .env.production .env
   npm run build
   npm run deploy:pages
   ```

2. **Backend:**
   ```bash
   npm run deploy  # Uses wrangler.toml [vars] section
   ```

## Migration Benefits

**Before Migration (Hardcoded URLs):**
- ❌ 69+ files with hardcoded URLs
- ❌ 4-6 hours to switch environments
- ❌ Manual find-and-replace prone to errors
- ❌ No type safety for configuration
- ❌ Difficult to maintain consistency

**After Migration (3-Layer Architecture):**
- ✅ 0 hardcoded URLs (except defaults in runtime.ts)
- ✅ 5-10 minutes to switch environments
- ✅ Single `.env` file change
- ✅ Full TypeScript type safety
- ✅ Automatic validation and error handling
- ✅ 96% reduction in switching time
- ✅ 732% ROI (Return on Investment)

## Configuration Best Practices

1. **Always use configuration functions:**
   ```typescript
   // ✅ GOOD
   import { getBackendUrl } from '@/config/runtime';
   const url = getBackendUrl();

   // ❌ BAD - Never hardcode URLs
   const url = 'https://your-api-domain.example.com';
   ```

2. **Validate configuration on startup:**
   ```typescript
   // In main.ts or index.ts
   import { validateRuntimeConfig } from './config/runtime';
   validateRuntimeConfig(); // Throws if config invalid
   ```

3. **Use environment detection:**
   ```typescript
   import { isDevelopment, isProduction } from '@/config/runtime';

   if (isDevelopment()) {
     console.log('Debug info'); // Only in development
   }
   ```

4. **TypeScript support:**
   ```typescript
   // frontend/src/vite-env.d.ts provides full autocomplete
   const url = import.meta.env.VITE_BACKEND_URL; // ✅ Type-safe
   ```

5. **Never commit sensitive data:**
   - `.env.development` and `.env.production` are gitignored
   - Use `.env.example` as template
   - Store production secrets in Cloudflare Dashboard

## Troubleshooting Configuration Issues

**Problem: "VITE_BACKEND_URL is not set" error**
- Solution: Ensure `.env` file exists in `frontend/` directory
- Copy from `.env.development` or `.env.production`

**Problem: WebSocket connection fails**
- Check `VITE_WEBSOCKET_URL` matches backend deployment
- Verify protocol: `wss://` for HTTPS, `ws://` for HTTP
- Use `getWebSocketUrl()` for automatic protocol conversion

**Problem: CORS errors in development**
- Ensure `VITE_FRONTEND_URL` matches actual dev server URL
- Check backend `FRONTEND_URL` includes correct port (usually 3000)

**Problem: Configuration not updating after change**
- Restart Vite dev server (`npm run dev`)
- Clear browser cache and reload
- Verify `.env` file is in correct directory

See `docs/reports/HARDCODE_REMOVAL_COMPLETION_REPORT.md` for complete migration documentation.

## Related Files

**Configuration Files:**
- `frontend/.env.development` - Frontend development environment variables (16 variables)
- `frontend/.env.production` - Frontend production environment variables
- `frontend/.env.example` - Comprehensive environment variable template with documentation (80+ lines)
- `.dev.vars` - Backend development environment variables (Cloudflare Workers)
- `frontend/src/config/runtime.ts` - **Frontend runtime configuration layer** (428 lines) - Layer 2 abstraction
- `src/config/runtime.ts` - **Backend runtime configuration layer** (300+ lines) - Worker environment abstraction
- `frontend/src/vite-env.d.ts` - TypeScript type definitions for all environment variables (150+ lines)
