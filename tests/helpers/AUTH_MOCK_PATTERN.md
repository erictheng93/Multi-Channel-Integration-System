# Handler Test Authentication Mock Pattern

## Problem

Handler tests were failing with **401 Unauthorized** errors because handlers import and apply the real `jwtAuth` middleware, which requires valid JWT tokens in the Authorization header.

## Solution

Mock the `jwtAuth` middleware **BEFORE importing the handler** to bypass authentication in tests.

## Required Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// CRITICAL: Mock auth middleware BEFORE importing the handler
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    // Set mock user on context
    c.set('user', {
      id: 'user-123',
      username: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'admin',
      teamId: 1,
      isActive: true
    });
    return next();
  })
}));

// Now import the handler (it will use the mocked jwtAuth)
import myHandler from '@backend/handlers/my-handler';
import { setupHandlerTest } from '../../helpers/handler-test-setup';

describe('My Handler Tests', () => {
  let app: any;

  beforeEach(() => {
    const testSetup = setupHandlerTest();
    app = testSetup.app;
    app.route('/api/my-endpoint', myHandler);
  });

  it('should work without 401 errors', async () => {
    const response = await app.request('/api/my-endpoint');
    expect(response.status).not.toBe(401);
  });
});
```

## Why This Works

1. **Module-level mocking**: `vi.mock()` must be called **before** the handler is imported
2. **Handler imports middleware**: When the handler file executes, it imports `jwtAuth` from `src/middleware/auth`
3. **Vitest intercepts**: Because we mocked the module first, the handler gets the mocked `jwtAuth`
4. **Mock passes through**: The mock `jwtAuth` sets a user on context and calls `next()`, allowing requests to proceed

## Order of Operations ( CRITICAL)

```typescript
// WRONG - Handler imported BEFORE mock
import myHandler from '@backend/handlers/my-handler';
vi.mock('../../../src/middleware/auth', () => ({ /* ... */ }));
// Handler already has the real jwtAuth - too late!

// CORRECT - Mock BEFORE handler import
vi.mock('../../../src/middleware/auth', () => ({ /* ... */ }));
import myHandler from '@backend/handlers/my-handler';
// Handler will use the mocked jwtAuth
```

## Test Results

### Before Fix
```
 tests/unit/handlers/customer-main.test.ts (0 of 13 passing)
   × should return all customers
     → expected 401 to be 200
```

### After Fix
```
 tests/unit/handlers/customer-main.test.ts (13 of 13 passing)
    should return all customers
    should handle database errors
    should return empty list when no customers
   ... (all 13 tests passing)
```

## Alternative Patterns (for reference)

Some older tests use a different context variable:

```typescript
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('jwtPayload', {  // Different from 'user'
      userId: 'user-123',
      username: 'test-agent',
      role: 'agent',
      teamId: 1
    });
    return next();
  })
}));
```

**Note**: Use the `user` pattern (first example) for consistency with the actual auth middleware behavior.

## Files Fixed

-  `tests/unit/handlers/customer-main-refactored.test.ts` - 7/7 passing
-  `tests/unit/handlers/customer-main.test.ts` - 13/13 passing

## Files Already With Auth Mocks

- `tests/unit/handlers/auth-main.test.ts`
- `tests/unit/handlers/delayed-message-main.test.ts`
- `tests/unit/handlers/messaging-main.test.ts` - 42/44 passing
- `tests/unit/handlers/system-main.test.ts`
- `tests/unit/handlers/team-main.test.ts`

## Files Needing Auth Mock (To Be Fixed)

- `tests/unit/handlers/auth-role-validation.test.ts`
- `tests/unit/handlers/conversation-integration.test.ts`
- `tests/unit/handlers/conversation-performance.test.ts`
- `tests/unit/handlers/message-edge-cases.test.ts`
- `tests/unit/handlers/message-integration.test.ts`
- `tests/unit/handlers/message-performance.test.ts`
- `tests/unit/handlers/team-role-access-control.test.ts`
- `tests/unit/handlers/delayed-message-drizzle.test.ts`
- `tests/unit/handlers/conversation-main.test.ts`
- `tests/unit/handlers/conversation-edge-cases.test.ts`
- `tests/unit/handlers/conversation.test.ts`
- `tests/unit/handlers/message.test.ts`

## Summary

This pattern is **REQUIRED** for all handler tests that test routes protected by `jwtAuth` middleware. The mock must be placed at the top of the test file, before any handler imports.

**Key Insight**: The order of operations matters because JavaScript modules are evaluated when imported. If the handler is imported before the mock is set up, it will capture the real middleware.
