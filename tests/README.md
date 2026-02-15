# Backend Tests

## Mock Standard

This project uses **`vi.fn()` with manual chainable mocks**. See `tests/helpers/README.md` for the standard pattern and available helpers.

> **Do NOT** use frameworks from `tests/archive/deprecated-helpers/` (MockFactory, DatabaseTestEnvironment, etc.)

## Structure

```
tests/
  unit/              # Unit tests
  modules/           # Module-specific tests
  integration/       # Integration tests
  e2e/               # End-to-end tests
  edge-cases/        # Boundary condition tests
  helpers/           # Active test helpers (see helpers/README.md)
    mockDrizzle.ts   # Drizzle ORM mocking
    mockKV.ts        # Cloudflare KV mocking
    testUtils.ts     # General utilities
    websocket/       # WebSocket test infrastructure
  archive/           # Historical reference only (do not use)
```

## Running Tests

```bash
# Run all handler tests
npm run test:handlers

# Run API integration tests
npm run test:api

# Run specific test file
npm test tests/unit/handlers/messaging-handler.test.ts

# Run with coverage
npm run test:coverage
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
