# Testing Strategy

## Comprehensive WebSocket Testing Infrastructure

The project features enterprise-grade testing for real-time WebSocket functionality:

### **WebSocket Testing Categories**
- **Unit Tests** (`tests/unit/durable-objects/`) - Individual Durable Objects testing
- **Integration Tests** (`tests/integration/websocket/`) - End-to-end WebSocket flows
- **Performance Tests** (`tests/performance/websocket/`) - 1000+ connection scalability testing
- **Stress Tests** (`tests/stress/websocket/`) - High-load and recovery scenarios
- **End-to-End Tests** (`tests/e2e/websocket/`) - Complete real-time conversation workflows

### **WebSocket Test Infrastructure**
- `tests/helpers/websocket/WebSocketTestClient.ts` - Simulates real WebSocket connections
- `tests/helpers/websocket/DurableObjectsTestEnv.ts` - Mock Durable Objects environment
- `tests/helpers/websocket/TestUtilities.ts` - Load testing and performance helpers
- `tests/helpers/websocket/WebSocketTestSetup.ts` - Global WebSocket test configuration

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
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- unit/components/MyComponent.test.ts

# Interactive test UI
npm run test:ui
```

### Backend Tests

```bash
# Run all handler tests
npm run test:handlers

# Run API integration tests
npm run test:api

# Run file upload end-to-end tests
npm run test:upload

# Run specific test file
npm test tests/unit/handlers/messaging-handler.test.ts
```

## Running Tests with Bun (Optional - Faster)

> 🚀 **NEW**: Tests can now run with Bun for 2x faster execution. All npm test commands remain fully functional.

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
- **npm run test**: ~20 seconds
- **bun run bun:test**: ~10 seconds (2x faster ⚡)

### Backend Tests with Bun

```bash
# Run handler tests (root directory)
cd tests
bun test

# Note: Database tests use bun:sqlite adapter
# See tests/helpers/bun-sqlite-adapter.ts for implementation
```

### Known Limitations with Bun

**✅ Works Great:**
- Vitest test execution (2x faster)
- Unit tests and component tests
- Store testing with proper setup

**⚠️ Known Issues:**
- `better-sqlite3` requires `bun:sqlite` adapter (see `tests/archive/deprecated-helpers/bun-sqlite-adapter.ts`)
- Some tests may show `ReferenceError: document is not defined` (environment config issue, not critical)

### Bun Test Environment

**Automatic SQLite Adapter:**
The project automatically uses `bun:sqlite` adapter when running tests with Bun:

```typescript
// tests/vitest.config.ts
resolve: {
  alias: {
    'better-sqlite3': typeof Bun !== 'undefined'
      ? path.resolve(__dirname, './helpers/bun-sqlite-adapter.ts')
      : 'better-sqlite3'
  }
}
```

**Custom Adapter Features:**
- 95% API compatibility with better-sqlite3
- Supports `prepare()`, `run()`, `get()`, `all()`, `transaction()`
- Automatic transaction handling
- See `tests/helpers/bun-sqlite-adapter.ts` for implementation details

### Switching Between npm and Bun

```bash
# Quick switch to Bun
.\scripts\switch-to-bun.ps1

# Run tests
cd frontend && bun run bun:test

# Switch back to npm (if needed)
.\scripts\switch-to-npm.ps1
cd frontend && npm run test
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
| `tests/helpers/testUtils.ts` | General test utilities |
| `tests/helpers/websocket/` | WebSocket test client and helpers |

## Test Best Practices

1. **Mock External Dependencies**: Always mock D1, KV, R2, and Durable Objects
2. **Use Active Helpers Only**: See `tests/helpers/README.md` for current helpers
3. **Test Real-time Features**: Ensure WebSocket events are properly tested
4. **Coverage Goals**: Maintain >80% coverage for critical paths
5. **Performance Testing**: Include load testing for scalability validation
6. **Bun Testing** (Optional): Use Bun for faster test execution during local development

## Related Documentation

- `frontend/vitest.config.ts` - Frontend test configuration
- `tests/helpers/README.md` - Active test helpers and mock standard
- `tests/helpers/` - Test utility functions and mocking helpers
- `docs/history/reports/modules/MESSAGING_MODULE_ENHANCEMENT_REPORT.md` - Messaging handler test results
- `docs/BUN_MIGRATION_GUIDE.md` - Complete Bun migration guide with testing instructions
