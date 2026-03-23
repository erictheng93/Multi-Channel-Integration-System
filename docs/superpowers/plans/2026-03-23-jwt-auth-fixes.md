# JWT Auth Token Refresh Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs/gaps in the JWT auth token refresh system so that proactive refresh actually works, both refresh paths stay in sync, file uploads survive token expiry, team permissions update on refresh, and production logs stay clean.

**Architecture:** Single refresh implementation in `ApiClient` (base.ts) with request queue, exposed as a public method. Auth store delegates to it for proactive refresh, and listens for `CustomEvent('auth:token-refreshed')` to sync its reactive refs + WebSocket. Backend refresh endpoint re-queries team data from DB instead of carrying over stale JWT claims.

**Tech Stack:** Vue 3 + Pinia + TypeScript strict mode, Vitest + jsdom for frontend tests, Hono + Cloudflare Workers for backend.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `frontend/src/stores/auth.ts` | Fix JWT exp parsing, delegate refresh to apiClient, listen for refresh events |
| Modify | `frontend/src/api/base.ts` | Make refreshAuthToken public, dispatch event after refresh, add 401 handling to uploadFile, conditional console.log |
| Modify | `frontend/src/api/auth.ts` | Remove dead `refreshToken()` method that sends no body |
| Modify | `frontend/src/composables/useTokenRefresh.ts` | No changes needed (calls authStore which we're fixing) |
| Modify | `src/modules/auth/handlers/auth-main.ts` | Re-query team data from DB during refresh |
| Modify | `frontend/src/stores/auth.test.ts` | Update tests for new JWT exp logic + refresh delegation |
| Modify | `frontend/src/api/base.test.ts` | Add tests for public refreshAuthToken, uploadFile 401 handling |
| Modify | `frontend/src/api/auth.test.ts` | Remove tests for deleted dead method |

---

### Task 1: Fix `shouldRefreshToken()` and `isTokenExpired()` to use JWT `exp` claim (P0)

**Why:** Both functions currently check `sessionExpiry` (a 7-day localStorage value) instead of the JWT's actual 2-hour `exp` claim. This makes proactive refresh never trigger for JWT expiry — it only fires 30 minutes before the 7-day session expires.

**Files:**
- Modify: `frontend/src/stores/auth.ts:447-498`
- Test: `frontend/src/stores/auth.test.ts`

- [ ] **Step 1: Write failing tests for JWT exp-based expiry checking**

In `frontend/src/stores/auth.test.ts`, add these tests after the existing test suite (inside the `describe('Auth Store', ...)` block):

```typescript
// Helper: create JWT with specific exp (seconds since epoch)
function createJWTWithExp(expSeconds: number, userId: string = 'test-agent-id', role: string = 'agent'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ userId, role, exp: expSeconds }))
  const signature = btoa('test-signature')
  return `${header}.${payload}.${signature}`
}

it('should detect token as expired when JWT exp is in the past', async () => {
  const { useAuthStore } = await import('./auth')
  const store = useAuthStore()

  // Token with exp 1 hour in the past
  const pastExp = Math.floor(Date.now() / 1000) - 3600
  store.token = createJWTWithExp(pastExp)
  store.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000 // session still valid

  expect(store.isTokenExpired()).toBe(true)
})

it('should detect token as NOT expired when JWT exp is in the future', async () => {
  const { useAuthStore } = await import('./auth')
  const store = useAuthStore()

  // Token with exp 1 hour in the future
  const futureExp = Math.floor(Date.now() / 1000) + 3600
  store.token = createJWTWithExp(futureExp)
  store.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

  expect(store.isTokenExpired()).toBe(false)
})

it('should recommend refresh when JWT exp is within 30 minutes', async () => {
  const { useAuthStore } = await import('./auth')
  const store = useAuthStore()

  // Token expiring in 20 minutes (within 30-min threshold)
  const soonExp = Math.floor(Date.now() / 1000) + 20 * 60
  store.token = createJWTWithExp(soonExp)
  store.refreshToken = createValidJWT()
  store.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

  expect(store.shouldRefreshToken()).toBe(true)
})

it('should NOT recommend refresh when JWT exp is more than 30 minutes away', async () => {
  const { useAuthStore } = await import('./auth')
  const store = useAuthStore()

  // Token expiring in 90 minutes (outside 30-min threshold)
  const laterExp = Math.floor(Date.now() / 1000) + 90 * 60
  store.token = createJWTWithExp(laterExp)
  store.refreshToken = createValidJWT()
  store.sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000

  expect(store.shouldRefreshToken()).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/stores/auth.test.ts --reporter=verbose`

Expected: The "should detect token as expired when JWT exp is in the past" test FAILS because `isTokenExpired()` checks `sessionExpiry` (7 days, still valid) instead of JWT exp. The "should recommend refresh within 30 minutes" test FAILS for the same reason.

- [ ] **Step 3: Add `getJwtExpiryMs()` helper and fix both functions**

In `frontend/src/stores/auth.ts`, add this helper function right after the `base64UrlDecode` function (around line 50), before `clearAuthStorage`:

```typescript
/**
 * Parse JWT exp claim and return expiry time in milliseconds.
 * Returns null if token is invalid or has no exp claim.
 */
function getJwtExpiryMs(tokenStr: string): number | null {
  try {
    const parts = tokenStr.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000; // Convert seconds to milliseconds
  } catch {
    return null;
  }
}
```

Then replace `isTokenExpired()` (lines 448-453):

```typescript
// Old:
function isTokenExpired(): boolean {
  if (!token.value) {return true;}
  if (!sessionExpiry.value) {return false;}
  return Date.now() >= sessionExpiry.value;
}

// New:
function isTokenExpired(): boolean {
  if (!token.value) return true;
  const expiryMs = getJwtExpiryMs(token.value);
  if (expiryMs === null) return true; // Invalid token = treat as expired
  return Date.now() >= expiryMs;
}
```

Then replace `shouldRefreshToken()` (lines 485-498):

```typescript
// Old:
function shouldRefreshToken(): boolean {
  if (!token.value || !sessionExpiry.value) {return false;}
  if (isTokenExpired()) {
    console.warn('[Auth] Token has expired, cannot refresh');
    return false;
  }
  return (sessionExpiry.value - Date.now()) < TOKEN_REFRESH_THRESHOLD;
}

// New:
function shouldRefreshToken(): boolean {
  if (!token.value || !refreshToken.value) return false;
  if (isTokenExpired()) {
    console.warn('[Auth] Token has expired, cannot proactively refresh');
    return false;
  }
  const expiryMs = getJwtExpiryMs(token.value);
  if (expiryMs === null) return false;
  return (expiryMs - Date.now()) < TOKEN_REFRESH_THRESHOLD;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/stores/auth.test.ts --reporter=verbose`

Expected: ALL tests pass, including the 4 new ones.

- [ ] **Step 5: Run full frontend test suite to check for regressions**

Run: `cd frontend && bunx vitest run --reporter=verbose 2>&1 | tail -20`

Expected: No regressions. All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/auth.ts frontend/src/stores/auth.test.ts
git commit -m "fix(auth): use JWT exp claim for proactive refresh instead of sessionExpiry

shouldRefreshToken() and isTokenExpired() were checking the 7-day
localStorage sessionExpiry instead of the JWT's 2-hour exp claim.
This meant proactive refresh never triggered for JWT expiry."
```

---

### Task 2: Unify token refresh — single path through `ApiClient` (P1)

**Why:** There are two independent refresh implementations that don't sync: `base.ts.refreshAuthToken()` (has request queue, triggered by 401 interceptor) and `auth.ts store.refreshAuthToken()` (has WebSocket reconnect, triggered by proactive timer). They store tokens in separate places and don't notify each other. Additionally, `authApi.refreshToken()` sends NO body to `/auth/refresh`, so the auth store's refresh always fails silently with 400.

**Design:**
1. Make `ApiClient.refreshAuthToken()` public (it's the robust one with queue)
2. Auth store's `refreshAuthToken()` delegates to `apiClient.refreshAuthToken()`
3. `ApiClient` dispatches `CustomEvent('auth:token-refreshed')` on successful refresh
4. Auth store listens for this event to sync its refs + reconnect WebSocket
5. Remove dead `authApi.refreshToken()` and `authApi.refresh()` methods

**Files:**
- Modify: `frontend/src/api/base.ts:109-163` (make refreshAuthToken public + dispatch event)
- Modify: `frontend/src/stores/auth.ts:586-634` (delegate to apiClient)
- Modify: `frontend/src/api/auth.ts:34-42` (remove dead methods)
- Test: `frontend/src/stores/auth.test.ts`
- Test: `frontend/src/api/base.test.ts`
- Test: `frontend/src/api/auth.test.ts`

- [ ] **Step 1: Write failing test for apiClient.refreshAuthToken() being public**

In `frontend/src/api/base.test.ts`, add:

```typescript
it('should expose refreshAuthToken as a public method', () => {
  expect(typeof apiClient.refreshAuthToken).toBe('function')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/api/base.test.ts --reporter=verbose`

Expected: FAIL — `refreshAuthToken` is currently private.

- [ ] **Step 3: Make `ApiClient.refreshAuthToken()` public and dispatch event**

In `frontend/src/api/base.ts`, change `private async refreshAuthToken()` to `async refreshAuthToken()` (line 109). Then after the successful token update (after line 143), add the event dispatch:

```typescript
// Replace the entire refreshAuthToken method (lines 109-163):
async refreshAuthToken(): Promise<string | null> {
  if (!this.refreshToken) return null;

  if (this.isRefreshing) {
    return new Promise((resolve, reject) => {
      this.failedQueue.push({ resolve, reject });
    });
  }

  this.isRefreshing = true;

  try {
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        this.token = result.data.token;
        if (result.data.refreshToken) {
          this.refreshToken = result.data.refreshToken;
        }

        // Update localStorage
        if (typeof window !== 'undefined' && window.localStorage && this.token) {
          localStorage.setItem('token', this.token);
          if (this.refreshToken) {
            localStorage.setItem('refreshToken', this.refreshToken);
          }
        }

        // Dispatch event for auth store to sync
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
            detail: {
              token: this.token,
              refreshToken: this.refreshToken
            }
          }));
        }

        this.processQueue(null, this.token);
        return this.token;
      }
    }
  } catch (error) {
    this.processQueue(error as Error, null);
  } finally {
    this.isRefreshing = false;
  }

  // Refresh failed, clear everything
  this.removeAuthHeader();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  return null;
}
```

- [ ] **Step 4: Run base.test.ts to verify it passes**

Run: `cd frontend && bunx vitest run src/api/base.test.ts --reporter=verbose`

Expected: ALL tests pass.

- [ ] **Step 5: Update auth store to delegate refresh to apiClient**

In `frontend/src/stores/auth.ts`, replace the entire `refreshAuthToken()` function (lines 586-634):

```typescript
// Old: Called authApi.refreshToken() which sent no body (always 400 from backend)
// New: Delegates to apiClient.refreshAuthToken() which has the request queue

async function refreshAuthToken() {
  if (!refreshToken.value) {
    return { success: false, error: 'No refresh token available' };
  }

  try {
    const newToken = await apiClient.refreshAuthToken();
    if (newToken) {
      // apiClient already updated localStorage + dispatched event
      // Sync our reactive refs
      token.value = newToken;
      const storedRefresh = localStorage.getItem('refreshToken');
      if (storedRefresh) {
        refreshToken.value = storedRefresh;
      }

      // Reconnect WebSocket with new token
      try {
        const { useWebSocketStore } = await import('@/stores/websocket');
        const wsStore = useWebSocketStore();
        console.log('[Auth] Token refreshed, reconnecting WebSocket...');
        wsStore.reconnect().catch((err: Error) => {
          console.warn('[Auth] WebSocket reconnection failed after token refresh:', err);
        });
      } catch (wsError) {
        console.warn('[Auth] Could not reconnect WebSocket after token refresh:', wsError);
      }

      return { success: true };
    } else {
      // apiClient.refreshAuthToken() returns null on failure and handles redirect
      return { success: false, error: 'Token refresh failed' };
    }
  } catch (_err) {
    return { success: false, error: 'Token refresh error' };
  }
}
```

Also add a listener for the `auth:token-refreshed` event (for when base.ts refreshes from a 401 interceptor), in the initialization block near line 638:

```typescript
// Listen for token refresh events from apiClient (e.g., 401 interceptor path)
if (typeof window !== 'undefined') {
  window.addEventListener('auth:token-refreshed', ((event: CustomEvent) => {
    const { token: newToken, refreshToken: newRefresh } = event.detail;
    if (newToken && newToken !== token.value) {
      token.value = newToken;
      if (newRefresh) {
        refreshToken.value = newRefresh;
      }
      // Parse updated team data from new token
      parseJwtTeamData(newToken);
    }
  }) as EventListener);
}
```

- [ ] **Step 6: Remove dead methods from authApi**

In `frontend/src/api/auth.ts`, remove the two broken refresh methods (lines 34-42):

```typescript
// REMOVE these two methods:
// refresh: async (refreshToken: string): Promise<...> => { ... },
// refreshToken: async (): Promise<...> => { ... },
```

Keep only the methods that are still in use: `setAuthHeader`, `removeAuthHeader`, `login`, `me`, `logout`, `changePassword`.

- [ ] **Step 7: Update auth.test.ts — fix the refresh test**

In `frontend/src/stores/auth.test.ts`, the existing mock `mockRefreshToken` and the test "should handle token refresh" need to be updated. The auth store now calls `apiClient.refreshAuthToken()`, not `authApi.refreshToken()`.

Add a mock for `apiClient.refreshAuthToken` at **module scope** (top of file, alongside existing `vi.mock('@/api/auth', ...)` block):

```typescript
const mockApiClientRefreshAuthToken = vi.fn()

vi.mock('@/api/base', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    setContextTeam: vi.fn(),
    getContextTeam: vi.fn(),
    getCurrentToken: vi.fn(),
    refreshAuthToken: mockApiClientRefreshAuthToken
  }
}))
```

Also update the `window` mock in `beforeEach` to include `addEventListener`/`dispatchEvent` (required because auth store now listens for `auth:token-refreshed` event during initialization):

```typescript
// In beforeEach, replace the window mock with:
Object.defineProperty(global, 'window', {
  value: {
    localStorage: global.localStorage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    location: { pathname: '/dashboard', href: '' }
  },
  writable: true
})
```

Update the refresh test:

```typescript
it('should handle token refresh via apiClient', async () => {
  const newToken = createValidJWT('1', 'agent')

  mockApiClientRefreshAuthToken.mockResolvedValue(newToken)
  // Mock localStorage to return refresh token
  vi.mocked(global.localStorage.getItem).mockImplementation((key) => {
    if (key === 'refreshToken') return createValidJWT('1', 'agent')
    return null
  })

  const { useAuthStore } = await import('./auth')
  const store = useAuthStore()
  store.token = createValidJWT('1', 'agent')
  store.refreshToken = createValidJWT('1', 'agent')

  const result = await store.refreshAuthToken()

  expect(result.success).toBe(true)
  expect(store.token).toBe(newToken)
  expect(mockApiClientRefreshAuthToken).toHaveBeenCalled()
})
```

- [ ] **Step 8: Update auth.test.ts — remove mockRefreshToken setup**

Remove `mockRefreshToken` from the mock setup and `beforeEach` reset since `authApi.refreshToken` no longer exists.

- [ ] **Step 9: Update auth API test — remove dead method tests**

In `frontend/src/api/auth.test.ts`, remove any tests for `authApi.refresh()` and `authApi.refreshToken()`.

- [ ] **Step 10: Run all auth-related tests**

Run: `cd frontend && bunx vitest run src/stores/auth.test.ts src/api/base.test.ts src/api/auth.test.ts --reporter=verbose`

Expected: ALL tests pass.

- [ ] **Step 11: Run full frontend test suite**

Run: `cd frontend && bunx vitest run --reporter=verbose 2>&1 | tail -20`

Expected: No regressions.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api/base.ts frontend/src/stores/auth.ts frontend/src/api/auth.ts \
       frontend/src/stores/auth.test.ts frontend/src/api/base.test.ts frontend/src/api/auth.test.ts
git commit -m "fix(auth): unify token refresh through single ApiClient path

- Make ApiClient.refreshAuthToken() public (has request queue)
- Auth store delegates refresh to apiClient instead of broken authApi
- ApiClient dispatches 'auth:token-refreshed' event for store sync
- Remove dead authApi.refresh/refreshToken (sent no body, always 400)"
```

---

### Task 3: Add 401 refresh handling to `uploadFile()` (P1)

**Why:** `uploadFile()` immediately redirects to `/login` on 401 without attempting token refresh, unlike `request()`. This means file uploads fail and the user is logged out if the token expires mid-upload.

**Files:**
- Modify: `frontend/src/api/base.ts:313-366`
- Test: `frontend/src/api/base.test.ts`

- [ ] **Step 1: Write failing test for uploadFile 401 handling**

In `frontend/src/api/base.test.ts`, add:

```typescript
// At the top, after existing imports:
import { vi, beforeEach } from 'vitest'

// Mock fetch globally for these tests
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('uploadFile 401 handling', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should attempt token refresh on 401 before giving up', async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Token expired' })
    })
    // Refresh call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { token: 'new-token', refreshToken: 'new-refresh' }
      })
    })
    // Retry upload: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { url: 'https://example.com/file.jpg' } })
    })

    apiClient.setAuthHeader('old-token', 'valid-refresh-token')
    const formData = new FormData()
    const result = await apiClient.uploadFile('/upload', formData)

    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3) // original + refresh + retry
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/api/base.test.ts --reporter=verbose`

Expected: FAIL — uploadFile doesn't retry on 401.

- [ ] **Step 3: Add 401 refresh handling to uploadFile**

In `frontend/src/api/base.ts`, replace the `uploadFile` method (lines 313-366):

```typescript
async uploadFile<T>(
  endpoint: string,
  formData: globalThis.FormData,
  options: { isRetry?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { isRetry = false } = options;

  try {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Phase 1 Optimization: Include team context header
    if (this.contextTeamId !== null) {
      headers['X-Context-Team-ID'] = this.contextTeamId.toString();
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData
    });

    let result;
    try {
      result = await response.json();
    } catch {
      result = { error: '服務器響應格式錯誤' };
    }

    if (!response.ok) {
      // Handle 401 with token refresh (same pattern as request())
      if (response.status === 401 && !isRetry && this.refreshToken) {
        const newToken = await this.refreshAuthToken();
        if (newToken) {
          return this.uploadFile<T>(endpoint, formData, { isRetry: true });
        }
      }

      // Handle 401 without refresh token
      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }

      const errorMessage = result.error || result.message || this.getErrorMessage(response.status);
      return {
        success: false,
        error: errorMessage,
        status: response.status
      };
    }

    return result;
  } catch {
    return {
      success: false,
      error: '檔案上傳過程中發生網路錯誤',
      status: 0
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bunx vitest run src/api/base.test.ts --reporter=verbose`

Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/base.ts frontend/src/api/base.test.ts
git commit -m "fix(auth): add 401 token refresh handling to uploadFile

Previously, uploadFile() redirected to /login on 401 without attempting
token refresh. Now uses the same refresh+retry pattern as request()."
```

---

### Task 4: Re-query team permissions from DB on token refresh (P2)

**Why:** The `/auth/refresh` endpoint carries over `allowedTeamIds` and `teamRoles` from the old refresh token without re-querying the database. If an admin changes a user's team permissions, the change won't take effect until the user logs in again (up to 7 days).

**Files:**
- Modify: `src/modules/auth/handlers/auth-main.ts:458-492`
- Test: `tests/modules/auth/auth.test.ts` (if relevant test exists)

- [ ] **Step 1: Modify refresh endpoint to re-query team data**

In `src/modules/auth/handlers/auth-main.ts`, in the refresh handler (around line 458), after fetching `userRow` and before generating the new access token, add a DB query for fresh team data:

```typescript
// After userRow validation (around line 456), add:

// Re-query fresh team data from DB instead of carrying over stale JWT claims
let freshAllowedTeamIds: number[] = payload.allowedTeamIds || [];
let freshTeamRoles: Record<string, string> = payload.teamRoles || {};

try {
  // Note: agentTeams should be added to the static import at the top of the file:
  // import { agents, agentTeams } from '@/db/schema';
  const { agentTeams } = await import('@/db/schema');
  const teamMemberships = await drizzleDb
    .select({
      teamId: agentTeams.teamId,
      role: agentTeams.roleInTeam,
      isPrimary: agentTeams.isPrimary
    })
    .from(agentTeams)
    .where(eq(agentTeams.agentId, String(payload.userId)));

  if (teamMemberships.length > 0) {
    freshAllowedTeamIds = teamMemberships.map(m => m.teamId);
    freshTeamRoles = {};
    for (const m of teamMemberships) {
      freshTeamRoles[m.teamId] = m.role;
    }
    authLogger.info('Refreshed team data from DB', {
      userId: payload.userId,
      teamCount: teamMemberships.length
    });
  }
} catch (teamError) {
  // Fall back to JWT data if DB query fails
  authLogger.warn('Failed to refresh team data from DB, using JWT data', {
    error: teamError instanceof Error ? teamError.message : String(teamError)
  });
}
```

Then update the `signJWT` calls (lines 460-491) to use `freshAllowedTeamIds` and `freshTeamRoles`:

```typescript
// In the new access token (line 469-470):
allowedTeamIds: freshAllowedTeamIds,
teamRoles: freshTeamRoles,

// In the new refresh token (line 487-488):
allowedTeamIds: freshAllowedTeamIds,
teamRoles: freshTeamRoles,
```

- [ ] **Step 2: Verify backend TypeScript compiles**

Run: `bun run build`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/handlers/auth-main.ts
git commit -m "fix(auth): re-query team permissions from DB on token refresh

Previously carried over stale allowedTeamIds/teamRoles from old JWT.
Now re-queries agent_teams table to pick up permission changes immediately
instead of waiting up to 7 days for next login."
```

---

### Task 5: Conditional console.log in production (P2)

**Why:** `base.ts` logs every API request and response in production. This is a performance concern (console.log is synchronous) and a security concern (endpoint URLs and status codes in browser console).

**Files:**
- Modify: `frontend/src/api/base.ts:194-204`

- [ ] **Step 1: Wrap console.log in DEV check**

In `frontend/src/api/base.ts`, replace lines 194-195:

```typescript
// Old:
console.log(` API Request: ${method} ${this.baseURL}${endpoint}`);
console.log(' Request data:', data);

// New:
if (import.meta.env.DEV) {
  console.log(`API Request: ${method} ${this.baseURL}${endpoint}`);
  console.log('Request data:', data);
}
```

Replace line 204:

```typescript
// Old:
console.log(` Response status: ${response.status} ${response.statusText}`);

// New:
if (import.meta.env.DEV) {
  console.log(`Response status: ${response.status} ${response.statusText}`);
}
```

- [ ] **Step 2: Verify frontend builds without errors**

Run: `cd frontend && bun run build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/base.ts
git commit -m "fix(api): only log API requests/responses in development mode

Removes production console.log noise and prevents endpoint URLs
from appearing in browser console in production."
```

---

### Task 6: Final integration verification

- [ ] **Step 1: Run full frontend test suite**

Run: `cd frontend && bunx vitest run --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass with no regressions.

- [ ] **Step 2: Run full backend test suite**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -30`

Expected: All tests pass.

- [ ] **Step 3: Run TypeScript type checks**

Run: `cd frontend && bun run type-check && cd .. && bun run build`

Expected: No type errors in frontend or backend.

- [ ] **Step 4: Manual smoke test (optional)**

Start dev server and verify:
1. Login works
2. After 2 hours (or manually set short token expiry), proactive refresh triggers
3. File upload works after token refresh
4. WebSocket reconnects after token refresh
