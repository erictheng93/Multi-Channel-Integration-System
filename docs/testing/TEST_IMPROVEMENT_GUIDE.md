# Backend Test Improvement Guide

## Executive Summary

**Current Status:**
- ✅ Frontend Tests: 132+ tests (100% pass rate)
- ⚠️ Backend Tests: 44 tests (66% pass rate → 29/44 passing)
- 🎯 Goal: Achieve 90%+ backend test pass rate

**Root Cause Identified:**
Backend tests were written for the old D1 API but handlers have been migrated to **Drizzle ORM**. Tests need to be updated to use the new Drizzle mocking infrastructure.

---

## Problem Analysis

### Architecture Mismatch

```
┌─────────────────────────────────────────────────────────────┐
│                   TESTING ARCHITECTURE GAP                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OLD: Tests Mock D1 API                                    │
│  ┌──────────────────────────────────────┐                  │
│  │  mockDB.prepare(query)               │                  │
│  │    .bind(params)                     │ ❌ Handlers       │
│  │    .all() / .first()                 │ don't use this   │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  NEW: Handlers Use Drizzle ORM                             │
│  ┌──────────────────────────────────────┐                  │
│  │  db.select({...})                    │                  │
│  │    .from(table)                      │ ✅ Modern ORM    │
│  │    .where(condition)                 │ type-safe API    │
│  │    .leftJoin(...)                    │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  Result: TypeError: db.select is not a function           │
└─────────────────────────────────────────────────────────────┘
```

---

## Solutions Implemented

### 1️⃣ Infrastructure Separation

**Problem:** Backend tests were importing Pinia (frontend dependency)

```
❌ OLD: Mixed Dependencies
tests/helpers/consolidatedTestUtils.ts (imports pinia)
         ↑
tests/helpers/testUtils.ts
         ↑
tests/unit/handlers/message.test.ts

✅ NEW: Clean Separation
tests/helpers/consolidatedBackendTestUtils.ts (NO pinia)
         ↑
tests/helpers/testUtils.ts
         ↑
tests/unit/handlers/message.test.ts
```

**Files Created:**
- `tests/helpers/consolidatedBackendTestUtils.ts` - Backend-specific utilities
- `tests/helpers/mockDrizzle.ts` - Drizzle ORM mock implementation

### 2️⃣ Drizzle ORM Mock

**New Mock API:**

```typescript
// tests/helpers/mockDrizzle.ts

export class MockDrizzleDB {
  // Main query methods
  select(fields) → QueryBuilder
  insert(table) → QueryBuilder
  update(table) → QueryBuilder
  delete(table) → QueryBuilder

  // Helper methods for tests
  mockQueryResponses(dataResponse, countTotal)
  mockSelectResponse(response)
  mockCountResponse(total)
  mockInsertResponse(table, data)
  mockError(error)
}
```

**Query Builder Methods:**
```
from()  → chainable
where() → chainable
leftJoin() → chainable
innerJoin() → chainable
limit() → chainable
offset() → chainable
orderBy() → chainable
[await] → executes query
```

### 3️⃣ Updated Test Context

**Context now provides:**
```typescript
const mockContext = createMockContext()

// Access via c.get()
c.get('dbService')  // → MockDatabaseService
c.get('db')         // → MockDrizzleDB

// Direct access for test setup
mockContext._mockDB  // → MockDrizzleDB instance
mockContext._mockDBService // → MockDatabaseService instance
```

---

## Migration Pattern

### OLD Test Pattern (D1 API)

```typescript
❌ OUTDATED - Don't use this anymore

it('should return messages', async () => {
  const mockContext = createMockContext()
  const mockDB = mockContext.env.DB

  // OLD: Mock D1 prepare/bind/all pattern
  mockDB.prepare.mockImplementation((query) => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: mockMessages })
    }
    return statement
  })

  const result = await messageHandler.list(mockContext)
  expect(result.data.items).toHaveLength(3)
})
```

### NEW Test Pattern (Drizzle ORM)

```typescript
✅ CORRECT - Use this pattern

import { createMockContext } from '../../helpers/testUtils'

it('should return messages', async () => {
  const mockContext = createMockContext()

  // NEW: Access the Drizzle mock
  const mockDB = mockContext._mockDB

  // Mock data response (for select queries)
  const mockMessagesData = [
    {
      id: 'msg-1',
      conversationId: '1',
      senderType: 'customer',
      customerSenderId: 1,
      agentSenderId: null,
      content: 'Hello',
      messageType: 'text',
      createdAt: '2024-01-15T10:00:00Z',
      customerName: 'John',
      agentName: null
    },
    // ... more messages
  ]

  // Set up mock responses for BOTH queries
  mockDB.mockQueryResponses(
    mockMessagesData,  // Data query response
    3                  // Count query response
  )

  // Set up request params
  mockContext.req.param = vi.fn().mockReturnValue('1')

  // Run the handler
  const result = await messageHandler.list(mockContext)

  // Assertions
  expect(result.data.items).toHaveLength(3)
  expect(result.data.total).toBe(3)
  expect(result.data.page).toBe(1)
})
```

---

## Step-by-Step Test Fix Guide

### Step 1: Identify Handler's Database Calls

**Read the handler code to see what it queries:**

```typescript
// src/handlers/message.ts

// Query 1: Select messages with joins
const messagesWithSender = await db.select({...})
  .from(messages)
  .leftJoin(customers, ...)
  .leftJoin(agents, ...)
  .where(eq(messages.conversationId, conversationId))
  .orderBy(messages.createdAt)
  .limit(pageSize)
  .offset(offset)

// Query 2: Count total messages
const [totalResult] = await db.select({ total: sql`count(...)` })
  .from(messages)
  .where(eq(messages.conversationId, conversationId))
```

### Step 2: Prepare Mock Data

**Match the shape of data the handler expects:**

```typescript
const mockMessagesData = [
  {
    // All fields from the select() clause
    id: 'msg-1',
    conversationId: '1',
    senderType: 'customer',
    customerSenderId: 1,
    agentSenderId: null,
    content: 'Hello',
    messageType: 'text',
    createdAt: '2024-01-15T10:00:00Z',
    // Joined fields
    customerName: 'John Doe',
    agentName: null
  }
]
```

### Step 3: Set Up Mock Responses

```typescript
// Access the mock DB
const mockDB = mockContext._mockDB

// Option A: Set both data and count responses
mockDB.mockQueryResponses(mockMessagesData, 3)

// Option B: Set them separately
mockDB.mockSelectResponse(mockMessagesData)
mockDB.mockCountResponse(3)
```

### Step 4: Configure Request Context

```typescript
// Set up request parameters
mockContext.req.param = vi.fn().mockReturnValue('1')

// Set up query parameters (if needed)
mockContext.req.query = vi.fn((key) => {
  const params = { page: '1', pageSize: '50' }
  return key ? params[key] : params
})
```

### Step 5: Run and Assert

```typescript
const result = await messageHandler.list(mockContext)

expect(result.data.success).toBe(true)
expect(result.data.items).toHaveLength(3)
expect(result.data.total).toBe(3)
```

---

## Common Scenarios

### Scenario A: Insert/Create Handler

```typescript
it('should create a message', async () => {
  const mockContext = createMockContext()
  const mockDB = mockContext._mockDB

  // Mock the insert response
  const insertedData = {
    id: 'new-msg-id',
    content: 'New message',
    createdAt: '2024-01-15T10:00:00Z'
  }

  mockDB.mockInsertResponse('messages', insertedData)

  // Set up request body
  mockContext.req.json = vi.fn().mockResolvedValue({
    content: 'New message',
    messageType: 'text'
  })

  const result = await messageHandler.send(mockContext)

  expect(result.data.id).toBe('new-msg-id')
})
```

### Scenario B: Update Handler

```typescript
it('should update a message', async () => {
  const mockContext = createMockContext()
  const mockDB = mockContext._mockDB

  // Mock update response (number of rows changed)
  mockDB.mockUpdateResponse('messages', 1)

  mockContext.req.param = vi.fn().mockReturnValue('msg-1')
  mockContext.req.json = vi.fn().mockResolvedValue({
    content: 'Updated content'
  })

  const result = await messageHandler.update(mockContext)

  expect(result.data.changes).toBe(1)
})
```

### Scenario C: Error Handling

```typescript
it('should handle database errors', async () => {
  const mockContext = createMockContext()
  const mockDB = mockContext._mockDB

  // Mock an error
  mockDB.mockError(new Error('Database connection failed'))

  const result = await messageHandler.list(mockContext)

  expect(result.status).toBe(500)
  expect(result.data.message).toContain('failed')
})
```

---

## Checklist for Each Test

- [ ] Remove old D1 API mocking (`mockDB.prepare`)
- [ ] Access Drizzle mock via `mockContext._mockDB`
- [ ] Identify all database queries in the handler
- [ ] Create mock data matching the handler's select shape
- [ ] Set up responses for ALL queries (data + count if applicable)
- [ ] Configure request params/query/body as needed
- [ ] Run test and verify assertions
- [ ] Check for error scenarios

---

## Progress Tracker

### Tests Fixed (Example Template)

```
☐ message.test.ts → list
  ☐ should return messages list with default pagination
  ☐ should handle custom pagination parameters
  ☐ should transform message data correctly
  ☐ should handle empty message list
  ☐ should handle database errors gracefully

☐ message.test.ts → send
  ☐ should send text message successfully
  ☐ should send media message successfully
  ☐ should return 404 when conversation not found
  ☐ should handle Facebook platform messages
  ☐ should update conversation last message time
  ☐ should handle database errors gracefully
  ☐ should store message with correct parameters
```

---

## Next Steps

1. **Fix message.test.ts** (14 tests)
   - Use the new Drizzle mock pattern
   - Update all test cases following the guide above

2. **Fix other handler tests**
   - conversation.test.ts
   - team.test.ts
   - auth.test.ts

3. **Expand integration test coverage** (40% → 80%+)
   - Add end-to-end flow tests
   - Test multiple handlers working together

4. **Expand E2E test coverage** (20% → 60%+)
   - Add user journey tests
   - Test critical workflows

5. **Run full test suite and verify 90%+ pass rate**

---

## Quick Reference

### Import Statement
```typescript
import { createMockContext } from '../../helpers/testUtils'
```

### Basic Test Structure
```typescript
it('test name', async () => {
  // 1. Create context
  const mockContext = createMockContext()
  const mockDB = mockContext._mockDB

  // 2. Set up mocks
  mockDB.mockQueryResponses(dataArray, countNumber)

  // 3. Configure request
  mockContext.req.param = vi.fn().mockReturnValue('value')

  // 4. Run handler
  const result = await handler.method(mockContext)

  // 5. Assert
  expect(result.data).toMatchObject({...})
})
```

### Key Methods
| Method | Purpose | Example |
|--------|---------|---------|
| `mockQueryResponses(data, count)` | Set both data and count responses | `mockDB.mockQueryResponses([...], 10)` |
| `mockSelectResponse(data)` | Set data response only | `mockDB.mockSelectResponse([...])` |
| `mockCountResponse(total)` | Set count response only | `mockDB.mockCountResponse(10)` |
| `mockInsertResponse(table, data)` | Mock insert operation | `mockDB.mockInsertResponse('messages', {...})` |
| `mockUpdateResponse(table, changes)` | Mock update operation | `mockDB.mockUpdateResponse('messages', 1)` |
| `mockError(error)` | Simulate database error | `mockDB.mockError(new Error('...'))` |

---

## Support

For questions or issues with test migration:
1. Check this guide first
2. Review the working example tests in `tests/unit/handlers/`
3. Refer to `tests/helpers/mockDrizzle.ts` for mock implementation details

**Last Updated:** 2025-01-21
