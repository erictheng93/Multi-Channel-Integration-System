# Backend Tests

## Mock Standard

This project uses **`vi.fn()` with manual chainable mocks**. See `tests/helpers/README.md` for the standard pattern and available helpers.

> **Do NOT** use frameworks from `tests/archive/deprecated-helpers/` (MockFactory, DatabaseTestEnvironment, etc.)

## Structure

```
tests/
  unit/ # Unit tests
  modules/ # Module-specific tests
  integration/ # Integration tests
  edge-cases/ # Boundary condition tests
  contract/ validation/ database/ smoke/ # Run by test:backend:ci as well
  performance/ # Opt-in measurements, NOT in CI (bun run test:perf:rows-read)
  helpers/ # Active test helpers (see helpers/README.md)
    mockDrizzle.ts # Drizzle ORM mocking
    mockKV.ts # Cloudflare KV mocking
    sqlite-d1.ts # Real SQLite-backed D1 for query-level tests
```

## Running Tests

```bash
# Full backend suite, as CI runs it (from the repo root)
bun run test:backend:ci

# Handler unit tests only
bun run test:handlers:unit

# Run specific test file
bunx vitest run tests/unit/handlers/messaging-crud.test.ts
```

## Active Helpers

### mockKV

```typescript
import { createMockKV } from './helpers/mockKV';

const mockKV = createMockKV();
mockKV.setMockValue('session:123', JSON.stringify(sessionData));
```

### mockDrizzle

```typescript
import { createMockDrizzle } from './helpers/mockDrizzle';

const { db, mocks } = createMockDrizzle();
```

## Writing New Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyService', () => {
  // Create mocks tailored to this test file
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks(); // NOT vi.restoreAllMocks()
  });

  it('should do something', async () => {
    // Arrange
    mockDb.select.mockResolvedValue([{ id: 1 }]);

    // Act
    const result = await myFunction(mockDb);

    // Assert
    expect(result).toBeDefined();
  });
});
```

## Best Practices

1. **AAA Pattern**: Arrange, Act, Assert
2. **Self-contained mocks**: Each test file creates its own mocks
3. **Use `vi.clearAllMocks()` in `beforeEach`**: Clears call history without breaking `vi.mock()` factories
4. **Use `vi.hoisted()`** for mock functions inside `vi.mock()` factory callbacks
5. **Mock external dependencies**: Always mock D1, KV, R2, and Durable Objects
