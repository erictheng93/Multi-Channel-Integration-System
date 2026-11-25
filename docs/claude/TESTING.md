# Testing Strategy

## WebSocket / Durable Object Tests

Durable Object and WebSocket behaviour is covered by unit tests in `tests/unit/durable-objects/`
and `tests/unit/services/` (run by `test:backend:ci`). There is no separate WebSocket config,
load-test or stress-test runner.

## Frontend Testing (132+ tests, 100% pass rate)

The project has a robust testing infrastructure:
- **Unit tests** for all components and stores including WebSocket components
- **Integration tests** for API communication and WebSocket connections
- **Real-time functionality tests** for typing indicators, presence, and live updates
- **Edge case testing** for error scenarios and connection failures
- **Performance tests** for optimization validation

Key test helpers:
- `frontend/tests/helpers/directStoreCreation.ts` - Reliable store testing
- `frontend/tests/helpers/testUtils.ts` - Common test utilities
- `frontend/vitest.setup.ts` - Global test configuration

## Backend Testing

- Handler-specific tests in `tests/unit/handlers/` with WebSocket broadcasting validation
  - **Messaging Handler**: 44 unit tests with 66% pass rate (29/44 passing, core functionality 100%)
- API integration tests in `tests/integration/` including real-time event testing
- Database operation tests with mocking
- **Improved Test Architecture**: Database layer mocking approach with proper Drizzle ORM column structure
- **WebSocket Infrastructure Tests** - Complete Durable Objects and broadcasting system testing
- **Load Testing Suite** - Validates 1000+ concurrent connections and message throughput

## Running Tests

### Frontend Tests

```bash
cd frontend

# Run all tests
bun run test

# Run with coverage
bun run test:coverage

# Run specific test file
bun run test -- unit/components/MyComponent.test.ts

# Interactive test UI
bun run test:ui
```

### Backend Tests

```bash
# Full backend suite, exactly as CI runs it (root vitest.config.ts, include tests/**)
bun run test:backend:ci

# Subsets
bun run test:unit
bun run test:modules
bun run test:handlers:unit

# Run specific test file
bunx vitest run tests/unit/handlers/messaging-crud.test.ts

# Opt-in: measure D1 rows_read of the dashboard queries on a local workerd D1
bun run test:perf:rows-read
```

Backend tests must live under `tests/`; a `*.test.ts` under `src/` is outside the
root config's include and never runs.

## Running Tests with Bun (Optional - Faster)

>  **NEW**: Tests can now run with Bun for 2x faster execution. All npm test commands remain fully functional.

### Prerequisites

```bash
# Install Bun (if not already installed)
powershell -c "irm bun.sh/install.ps1|iex"

# Verify installation
bun --version  # Should show 1.2.20 or higher
```

### Frontend Tests with Bun

```bash
cd frontend

# Run all tests with Bun (2x faster)
bun run bun:test

# Run with watch mode
bun vitest watch

# Run specific test file
bun vitest unit/components/MyComponent.test.ts

# Interactive test UI
bun vitest --ui
```

**Performance Comparison:**
- **bun run test**: ~20 seconds
- **bun run bun:test**: ~10 seconds (2x faster )

### Backend Tests with Bun

```bash
# From the repo root (uses the root vitest.config.ts)
bun run test:backend:ci
```

### Known Limitations with Bun

** Works Great:**
- Vitest test execution (2x faster)
- Unit tests and component tests
- Store testing with proper setup

** Known Issues:**
- `better-sqlite3` requires `bun:sqlite` adapter (see `tests/archive/deprecated-helpers/bun-sqlite-adapter.ts`)
- Some tests may show `ReferenceError: document is not defined` (environment config issue, not critical)

### Switching Between npm and Bun

```bash
# Quick switch to Bun
.\scripts\switch-to-bun.ps1

# Run tests
cd frontend && bun run bun:test

# Switch back to npm (if needed)
.\scripts\switch-to-npm.ps1
cd frontend && bun run test
```

**Rollback Time:** < 3 minutes for full environment switch

## Mock Standard (IMPORTANT)

**This project uses `vi.fn()` with manual chainable mocks as the standard pattern.**

Do NOT use MockFactory, DatabaseTestEnvironment, or any framework from `tests/archive/deprecated-helpers/`. Those were abandoned migration attempts and are kept only for historical reference.

### Standard Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Each test file creates its own mocks
function createMockDb() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return {
    select: vi.fn(() => chain),
    insert: vi.fn(() => ({ values: vi.fn().mockReturnThis(), returning: vi.fn() })),
    update: vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn() })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

beforeEach(() => {
  vi.clearAllMocks(); // NEVER use vi.restoreAllMocks() — it breaks vi.mock() factories
});
```

### Key Rules

1. **Each test creates its own mocks** — tailored to what it needs
2. **Use `vi.clearAllMocks()` in `beforeEach`** — NOT `vi.restoreAllMocks()`
3. **Use `vi.hoisted()`** for mock functions inside `vi.mock()` factories
4. **Active helpers** are in `tests/helpers/` — see `tests/helpers/README.md` for what's available

### Active Test Helpers

| Helper | Purpose |
|--------|---------|
| `tests/helpers/mockDrizzle.ts` | Drizzle ORM mock utilities |
| `tests/helpers/mockKV.ts` | Cloudflare KV mock |
| `tests/helpers/sqlite-d1.ts` | In-memory SQLite D1 with real migrations |

## Test Best Practices

1. **Mock External Dependencies**: Always mock D1, KV, R2, and Durable Objects
2. **Use Active Helpers Only**: See `tests/helpers/README.md` for current helpers
3. **Test Real-time Features**: Ensure WebSocket events are properly tested
4. **Coverage Goals**: Maintain >80% coverage for critical paths
5. **Performance Testing**: Query-cost measurements are opt-in (`bun run test:perf:rows-read`)
6. **Bun Testing** (Optional): Use Bun for faster test execution during local development

## Related Documentation

- `frontend/vitest.config.ts` - Frontend test configuration
- `tests/helpers/README.md` - Active test helpers and mock standard
- `tests/helpers/` - Test utility functions and mocking helpers
- `docs/history/reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md` - Messaging handler test results
- `docs/BUN_MIGRATION_GUIDE.md` - Complete Bun migration guide with testing instructions
