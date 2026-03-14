# Integration Tests

This directory contains integration tests for the Multi-Channel Integration System handlers.

## Philosophy

Integration tests in this project follow these principles:

1. **Test HTTP Layer** - Test endpoints through `app.request()`, not internal functions
2. **Minimal Mocking** - Only mock external services (DB, KV, R2), not internal logic
3. **Behavior Focus** - Test inputs and outputs, not implementation details
4. **Real Hono Apps** - Test actual Hono handler routing and middleware

## Directory Structure

```
tests/integration/
├── README.md # This file
├── helpers/
│ └── integration-test-setup.ts  # Test utilities and mock factories
└── handlers/
    ├── auth.integration.test.ts # Authentication endpoints
    ├── conversation.integration.test.ts # Conversation management
    ├── message.integration.test.ts # Messaging endpoints
    ├── webhook.integration.test.ts # LINE/FB webhook handling
    └── team.integration.test.ts # Team management
```

## Test Pattern

### Basic Test Structure

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import {
  createMockEnv,
  createTestApp,
  TEST_USERS,
  jsonPost,
  parseJsonResponse,
  assertSuccess
} from '../helpers/integration-test-setup';
import handler from '@backend/handlers/your-handler';

describe('Handler Integration Tests', () => {
  let app: ReturnType<typeof handler>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    const setup = createTestApp(handler, createMockEnv());
    app = setup.app;
    env = setup.env;
  });

  test('should create resource successfully', async () => {
    // Setup mock database response
    const mockStatement = env.DB.prepare({} as any);
    mockStatement.run.mockResolvedValueOnce({ success: true });
    mockStatement.first.mockResolvedValueOnce({ id: 1, name: 'Test' });

    // Make request
    const response = await app.request('/api/resource',
      jsonPost({ name: 'Test' }, TEST_USERS.admin)
    );

    // Assert
    const { status, data } = await parseJsonResponse(response);
    expect(status).toBe(201);
    assertSuccess(data);
  });
});
```

### What to Mock

 **DO Mock:**
- Database (D1) - `createMockDatabase()`
- KV Storage - `createMockKV()`
- R2 Bucket - `createMockR2Bucket()`
- External APIs (LINE, Facebook)
- JWT validation (bypass in tests)

 **DON'T Mock:**
- Hono routing and middleware
- Request/Response handling
- Internal business logic
- Utility functions

### Authentication in Tests

Use the `TEST_USERS` constants and `withAuth()` helper:

```typescript
import { TEST_USERS, withAuth, jsonPost } from '../helpers/integration-test-setup';

// Admin user request
const response = await app.request('/api/admin-only',
  jsonPost({ data: 'test' }, TEST_USERS.admin)
);

// Agent user request
const response = await app.request('/api/agent-endpoint',
  withAuth(TEST_USERS.agent, { method: 'GET' })
);

// Unauthenticated request
const response = await app.request('/api/public-endpoint');
```

## Running Tests

```bash
# Run all integration tests
npm run test -- tests/integration/

# Run specific handler tests
npm run test -- tests/integration/handlers/auth.integration.test.ts

# Run with coverage
npm run test:coverage -- tests/integration/
```

## Comparison with Unit Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| Scope | Single function/module | HTTP endpoint |
| Mocking | Heavy (mock everything) | Light (mock only external) |
| Speed | Fastest | Fast |
| Confidence | Implementation correct | Behavior correct |
| Maintenance | High (coupled to impl) | Low (coupled to API) |

## Migration from Unit Tests

When migrating a test from `tests/unit/handlers/` to `tests/integration/handlers/`:

1. Remove all complex mock chains (Drizzle ORM mocks, etc.)
2. Use `createMockEnv()` for environment setup
3. Test through `app.request()` instead of calling functions directly
4. Focus on HTTP status codes and response bodies
5. Add TODO comment with original test file reference

## Best Practices

1. **One assertion per test** when possible
2. **Descriptive test names** that explain the scenario
3. **Setup/teardown** in `beforeEach`/`afterEach`
4. **Test error cases** as well as success cases
5. **Document edge cases** with comments

## Related Documentation

- [Testing Strategy Report](../../docs/TESTING_STRATEGY.md)
- [API Reference](../../docs/api/)
- [Handler Implementation](../../src/handlers/)
