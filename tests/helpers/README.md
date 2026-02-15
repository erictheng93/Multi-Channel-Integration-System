# Test Helpers

## Standard Mock Pattern

This project uses **`vi.fn()` with manual chainable mocks** as the standard testing approach.

**Do NOT use** any frameworks from `tests/archive/deprecated-helpers/` (MockFactory, DatabaseTestEnvironment, etc.) — they were abandoned and are preserved only for historical reference.

### How to Write Test Mocks

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create chainable mock for Drizzle ORM
function createMockDb() {
  const mockResults: any[] = [];

  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue(mockResults),
  };

  return {
    select: vi.fn(() => chain),
    insert: vi.fn(() => ({ values: vi.fn().mockReturnThis(), returning: vi.fn() })),
    update: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn() })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    _chain: chain,
    _setResults: (results: any[]) => { mockResults.length = 0; mockResults.push(...results); },
  };
}
```

### Key Rules

1. **Each test file creates its own mocks** tailored to what it needs
2. **Use `vi.clearAllMocks()` in `beforeEach`** (NOT `vi.restoreAllMocks()` — see note below)
3. **Use `vi.hoisted()`** for mock functions referenced inside `vi.mock()` factories

### Important: `clearAllMocks` vs `restoreAllMocks`

```typescript
// CORRECT
beforeEach(() => {
  vi.clearAllMocks(); // Clears call history, keeps implementations
});

// WRONG — breaks vi.mock() factory implementations
afterEach(() => {
  vi.restoreAllMocks(); // Strips mockImplementation from factory mocks!
});
```

## Active Helpers

| File | Purpose | Used By |
|------|---------|---------|
| `mockDrizzle.ts` | Drizzle ORM mock utilities | customer-crud, message-crud tests |
| `mockKV.ts` | Cloudflare KV mock | analytics, webhook-security tests |
| `testUtils.ts` | General test utilities | e2e tests |
| `AUTH_MOCK_PATTERN.md` | Guide for mocking jwtAuth middleware | Reference doc |
| `websocket/` | WebSocket test client and helpers | WebSocket tests |

## Archived (Do Not Use)

Deprecated helpers are in `tests/archive/deprecated-helpers/`. They include:

- `mockFactory.ts` + `MOCKFACTORY_USAGE_GUIDE.md` — Comprehensive mock factory (never adopted widely)
- `DatabaseTestEnvironment.ts` — In-memory SQLite environment (never adopted)
- `MockDatabaseFactory.ts` + `mockDatabase.ts` — Alternative DB mocking (superseded)
- `consolidated*.ts` — Consolidation attempt (never imported)
- Various other unused utilities

These are kept for historical reference only.
