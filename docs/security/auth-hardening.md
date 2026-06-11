# Auth Hardening Spec

## Objective
Reduce frontend token exposure by moving refresh credentials into HttpOnly cookies, adding CSRF protection for cookie-authenticated writes, and keeping legacy Bearer-token clients working during the migration.

## Commands
- Backend focused tests: `rtk bunx vitest run tests/unit/auth/auth-cookie-csrf.test.ts`
- Frontend focused tests: `cd frontend && rtk bun run test:run src/api/base.test.ts src/utils/authStorage.test.ts`
- Project health: `rtk bun run check`

## Project Structure
- Backend auth routes and cookie issuance: `src/modules/auth/handlers/auth-main.ts`
- Backend auth/CSRF middleware helpers: `src/middleware/auth.ts`
- Frontend API request behavior: `frontend/src/api/base.ts`
- Auth storage migration helpers: `frontend/src/utils/authStorage.ts`
- Regression tests: `tests/unit/auth/` and `frontend/src/**/*.test.ts`

## Code Style
Use small named helpers for cookie/header parsing and keep auth middleware interfaces unchanged:

```ts
const token = getBearerToken(c.req.header('Authorization')) ?? getCookie(c, ACCESS_COOKIE_NAME)
```

## Testing Strategy
- Backend unit/integration tests assert `Set-Cookie` attributes, refresh-cookie fallback, logout cookie clearing, and CSRF rejection for cookie-authenticated unsafe methods.
- Frontend API client tests assert requests include `credentials: 'include'` and CSRF headers on unsafe methods.
- Existing auth and build checks must continue to pass.

## Boundaries
- Always: keep legacy Bearer token support during migration; fail closed on missing CSRF for cookie-authenticated unsafe writes.
- Ask first: removing token fields from API responses entirely; changing database schema; changing JWT TTL values.
- Never: store refresh tokens in `localStorage`; weaken refresh-token rotation/reuse detection; add secrets to source or env examples.

## Success Criteria
- Login and refresh set HttpOnly Secure SameSite refresh cookies and readable CSRF cookies.
- Refresh accepts the HttpOnly refresh cookie when no body refresh token is supplied.
- Logout clears auth cookies and revokes available access/refresh credentials.
- Cookie-authenticated POST/PUT/PATCH/DELETE requests require a matching CSRF cookie/header pair.
- Frontend API calls use `credentials: 'include'`; unsafe API calls send `X-CSRF-Token` when the readable CSRF cookie exists.
- Raw auth-header fetches are either removed or routed through a shared authenticated request helper.
- Development origins come from a single backend source of truth.
- Trusted Types moves from report-only to enforced after HTML sinks are covered.
