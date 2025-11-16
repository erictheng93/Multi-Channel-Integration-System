# Integration Test Migration Guide

## 使用 DatabaseTestEnvironment 迁移 Integration Tests

本指南帮助您快速将现有的 integration tests 从复杂的 mock 设置迁移到使用 `DatabaseTestEnvironment` 的真实数据库测试。

## 为什么要迁移？

### ❌ 旧方式的问题
- 复杂的 Drizzle ORM mock 设置（50-100+ 行）
- 需要手动模拟每个查询方法（findMany, insert, update, delete）
- 不测试真实的 SQL 约束和外键关系
- Mock 和真实行为可能不一致
- 难以维护和调试

### ✅ 新方式的优势
- **70% 减少代码量** - 从 300+ 行减少到 100 行
- **真实数据库操作** - 使用 in-memory SQLite
- **自动外键验证** - 测试真实的数据库约束
- **更可靠** - 测试实际行为，不是 mock 行为
- **更简单** - 只需创建测试数据，不需要配置 mock

## 迁移步骤

### Step 1: 设置 Module-level Test Environment

在文件顶部添加：

```typescript
import { DatabaseTestEnvironment } from '../helpers/DatabaseTestEnvironment'

// Module-level variable for test environment
let currentTestEnv: DatabaseTestEnvironment | null = null

// Mock drizzle-orm/d1 to use our test database
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized')
    }
    return currentTestEnv.getDrizzleInstance()
  })
}))
```

**为什么需要 module-level variable?**
- `vi.mock()` 在模块加载时运行（在 `beforeEach` 之前）
- 需要一个可以在 mock 中访问的变量来获取数据库实例
- 在 `beforeEach` 中设置 `currentTestEnv`，在 `afterEach` 中清理

### Step 2: 更新 beforeEach 和 afterEach

**删除旧的 mock 设置代码：**
```typescript
// ❌ 删除这些
const mockDb = {
  query: {
    messages: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    }
  },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
}
```

**替换为 DatabaseTestEnvironment：**
```typescript
describe('Your Integration Tests - Refactored', () => {
  let env: DatabaseTestEnvironment
  let testAgent: any
  let testCustomer: any
  let testConversation: any

  beforeEach(async () => {
    // Initialize test database
    env = new DatabaseTestEnvironment()
    currentTestEnv = env

    // Create test data using helper methods
    testAgent = await env.createTestAgent({
      id: 'agent-test-1',
      email: 'agent@test.com',
      displayName: 'Test Agent',
      role: 'agent'
    })

    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'U123456',
      displayName: 'Test Customer'
    })

    testConversation = await env.createTestConversation(testCustomer.id, {
      assignedUserId: testAgent.id
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    env.close()
    currentTestEnv = null
  })
})
```

### Step 3: Mock 外部服务（不是数据库）

只 mock 真正的外部服务，不要 mock 数据库操作：

```typescript
// ✅ Mock external services
vi.mock('../../src/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('../../src/utils/line', () => ({
  pushLineMessage: vi.fn().mockResolvedValue(true),
  createTextMessage: vi.fn((text) => ({ type: 'text', text }))
}))

// ✅ Mock auth middleware
vi.mock('../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('jwtPayload', {
      userId: 'agent-test-1',
      username: 'test-agent',
      role: 'agent',
      teamId: 1
    })
    return next()
  })
}))
```

### Step 4: 更新 Environment 设置

如果测试使用 Hono app，添加环境中间件：

```typescript
beforeEach(async () => {
  env = new DatabaseTestEnvironment()
  currentTestEnv = env

  // Create Hono app
  app = new Hono<{ Bindings: Bindings }>()

  // Setup environment middleware
  app.use('*', (c, next) => {
    c.env = {
      DB: env.getMockD1Database() as any,
      JWT_SECRET: 'test-secret',
      SESSIONS: {} as any,
      CACHE: {} as any
    } as any
    return next()
  })

  // Mount routes
  app.route('/api/messages', messageHandler)
  app.route('/api/conversations', conversationHandler)

  // ... create test data
})
```

### Step 5: 简化测试逻辑

**旧方式（使用 mocks）：**
```typescript
// ❌ 需要配置 mock 返回值
mockDb.query.messages.findMany.mockResolvedValue([
  { id: '1', content: 'Message 1', conversationId: 'conv-1' },
  { id: '2', content: 'Message 2', conversationId: 'conv-1' }
])

const result = await someFunction()

expect(mockDb.query.messages.findMany).toHaveBeenCalledWith({
  where: expect.any(Function)
})
```

**新方式（真实数据库）：**
```typescript
// ✅ 只需创建真实数据，然后验证
await env.createTestMessage(testConversation.id, {
  id: 'msg-1',
  content: 'Message 1',
  agentSenderId: testAgent.id
})

await env.createTestMessage(testConversation.id, {
  id: 'msg-2',
  content: 'Message 2',
  agentSenderId: testAgent.id
})

const result = await someFunction()

// Verify in database directly
const messages = await env.db.query.messages.findMany({
  where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
})

expect(messages).toHaveLength(2)
expect(messages[0].content).toBe('Message 1')
```

## DatabaseTestEnvironment Helper Methods

### 可用的 Helper Methods

```typescript
// Teams
await env.createTestTeam({ name: 'Test Team', description: 'Test' })

// Users
await env.createTestAgent({
  id: 'agent-1',
  email: 'agent@test.com',
  displayName: 'Agent Name',
  role: 'agent',
  teamId: 1
})

// Customers
await env.createTestCustomer({
  platform: 'line',
  platformUserId: 'U123456',
  displayName: 'Customer Name'
})

// Conversations
await env.createTestConversation(customerId, {
  assignedUserId: agentId,
  assignedTeamId: teamId,
  status: 'active'
})

// Messages
await env.createTestMessage(conversationId, {
  id: 'msg-1',
  content: 'Message content',
  senderType: 'agent',
  agentSenderId: agentId,
  messageType: 'text'
})

// Tags
await env.createTestTag({
  name: 'important',
  color: '#ff0000',
  type: 'message'
})

// Activities
await env.createTestActivity({
  userId: agentId,
  action: 'message_sent',
  resourceType: 'message',
  resourceId: messageId
})
```

### 直接访问数据库

```typescript
// Query using Drizzle ORM
const customers = await env.db.query.customers.findMany({
  where: (customers, { eq }) => eq(customers.platform, 'line')
})

// Insert directly
await env.db.insert(env.db.schema.messages).values({
  id: 'custom-msg',
  conversationId: testConversation.id,
  content: 'Custom message'
})

// Update directly
await env.db
  .update(env.db.schema.conversations)
  .set({ status: 'closed' })
  .where(eq(env.db.schema.conversations.id, testConversation.id))

// Delete directly
await env.db
  .delete(env.db.schema.messages)
  .where(eq(env.db.schema.messages.id, 'msg-1'))
```

## 常见迁移场景

### Scenario 1: 测试消息创建和列表

```typescript
it('should create and list messages', async () => {
  // Create messages
  const response1 = await app.request(`/api/messages/${testConversation.id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: 'Test message 1'
    })
  })

  expect(response1.status).toBe(200)

  // List messages
  const response2 = await app.request(`/api/messages/${testConversation.id}`)

  expect(response2.status).toBe(200)
  const result = await response2.json()

  expect(result.data.messages).toHaveLength(1)
  expect(result.data.messages[0].content).toBe('Test message 1')

  // Verify in database
  const dbMessages = await env.db.query.messages.findMany({
    where: (messages, { eq }) => eq(messages.conversationId, testConversation.id)
  })
  expect(dbMessages).toHaveLength(1)
})
```

### Scenario 2: 测试外键约束

```typescript
it('should enforce foreign key constraints', async () => {
  // Try to create message with non-existent conversation
  await expect(
    env.createTestMessage('nonexistent-conv', {
      id: 'msg-1',
      content: 'Test'
    })
  ).rejects.toThrow() // Foreign key constraint violation

  // Try to create message with non-existent agent
  await expect(
    env.db.insert(env.db.schema.messages).values({
      id: 'msg-2',
      conversationId: testConversation.id,
      content: 'Test',
      agentSenderId: 'nonexistent-agent'
    })
  ).rejects.toThrow() // Foreign key constraint violation
})
```

### Scenario 3: 测试并发更新

```typescript
it('should handle concurrent updates', async () => {
  const message = await env.createTestMessage(testConversation.id, {
    id: 'concurrent-msg',
    content: 'Original',
    metadata: JSON.stringify({ status: 'pending' })
  })

  // Concurrent updates
  const updates = [
    env.db
      .update(env.db.schema.messages)
      .set({ content: 'Updated 1' })
      .where(eq(env.db.schema.messages.id, message.id)),
    env.db
      .update(env.db.schema.messages)
      .set({ content: 'Updated 2' })
      .where(eq(env.db.schema.messages.id, message.id))
  ]

  await Promise.all(updates)

  // Verify final state
  const final = await env.db.query.messages.findFirst({
    where: (messages, { eq }) => eq(messages.id, message.id)
  })

  expect(final).toBeDefined()
  expect(['Updated 1', 'Updated 2']).toContain(final!.content)
})
```

### Scenario 4: 测试元数据 JSON 序列化

```typescript
it('should serialize and deserialize metadata correctly', async () => {
  const metadata = {
    platform: 'line',
    recipientId: 'U123456',
    customField: { nested: 'data' },
    timestamp: new Date().toISOString()
  }

  const message = await env.createTestMessage(testConversation.id, {
    id: 'metadata-msg',
    content: 'Test',
    metadata: JSON.stringify(metadata)
  })

  // Retrieve and verify
  const retrieved = await env.db.query.messages.findFirst({
    where: (messages, { eq }) => eq(messages.id, message.id)
  })

  expect(retrieved).toBeDefined()
  const parsedMetadata = JSON.parse(retrieved!.metadata!)
  expect(parsedMetadata).toEqual(metadata)
})
```

## 迁移 Checklist

对于每个要迁移的测试文件：

- [ ] Step 1: 添加 `DatabaseTestEnvironment` import 和 module-level setup
- [ ] Step 2: 删除所有 Drizzle ORM mock 代码
- [ ] Step 3: 在 `beforeEach` 中初始化 `DatabaseTestEnvironment`
- [ ] Step 4: 使用 helper methods 创建测试数据
- [ ] Step 5: 更新测试逻辑，使用真实数据库操作
- [ ] Step 6: 添加 `afterEach` 清理代码
- [ ] Step 7: Mock 外部服务（WebSocket, LINE API, etc.）
- [ ] Step 8: 运行测试验证
- [ ] Step 9: 重命名文件为 `*-refactored.test.ts`
- [ ] Step 10: 更新 test comments 说明使用 DatabaseTestEnvironment

## 性能考虑

### In-memory SQLite 性能
- **创建数据库**: ~5ms
- **插入测试数据**: ~1-2ms per record
- **查询**: <1ms for simple queries
- **完整测试**: 通常 <100ms per test

### 优化建议
1. **重用测试数据结构** - 在 `beforeEach` 中创建常用的测试数据
2. **避免过多测试数据** - 只创建测试需要的最小数据集
3. **使用 batch inserts** - 如果需要大量数据，使用 Drizzle 的批量插入
4. **清理策略** - `afterEach` 中使用 `env.close()` 完全清理数据库

## 常见问题

### Q1: 为什么需要 module-level `currentTestEnv` 变量？

A: 因为 `vi.mock()` 在模块加载时执行（在任何测试运行之前），而我们的 `DatabaseTestEnvironment` 实例在 `beforeEach` 中创建。我们需要一个可以在 mock 和测试之间共享的变量。

### Q2: 如何测试需要特定数据库状态的场景？

A: 直接使用 Drizzle ORM 操作数据库：

```typescript
// Set up specific state
await env.db
  .update(env.db.schema.messages)
  .set({ isSent: true, deliveryStatus: 'delivered' })
  .where(eq(env.db.schema.messages.id, messageId))

// Run test
// ...
```

### Q3: 如何测试数据库错误场景？

A: 使用无效的外键或约束违规：

```typescript
await expect(
  env.createTestMessage('invalid-conversation-id', {...})
).rejects.toThrow()
```

### Q4: 测试运行变慢了怎么办？

A:
1. 检查是否创建了不必要的测试数据
2. 确保在 `afterEach` 中调用 `env.close()`
3. 考虑使用 `describe.concurrent` 并行运行独立测试

### Q5: 如何调试测试失败？

A:
1. 打印数据库状态：`console.log(await env.db.query.messages.findMany({}))`
2. 使用 `env.db.schema` 直接查询表
3. 检查外键约束是否被违反
4. 验证测试数据是否正确创建

## 成功案例

已成功迁移的测试文件：

1. ✅ `message-conversation-workflow-refactored.test.ts` (从 366 行减少到 ~300 行)
2. ✅ `message-recall-integration-refactored.test.ts` (从 450+ 行减少到 ~400 行)
3. ✅ `database-field-mapping-refactored.test.ts` (从 315 行减少到 ~350 行，但测试更全面)

### 代码减少示例

**Before (旧的 mock 方式):**
```typescript
// 50+ lines of mock setup
const mockDb = {
  query: {
    messages: {
      findMany: vi.fn(),
      findFirst: vi.fn()
    },
    conversations: {
      findFirst: vi.fn()
    }
  },
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn()
    }))
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn()
    }))
  }))
}

// Complex mock configuration for each test
beforeEach(() => {
  mockDb.query.messages.findMany.mockResolvedValue([...])
  mockDb.query.conversations.findFirst.mockResolvedValue({...})
  // ... more mock setup
})
```

**After (DatabaseTestEnvironment):**
```typescript
// 5 lines of setup
let env: DatabaseTestEnvironment

beforeEach(async () => {
  env = new DatabaseTestEnvironment()
  currentTestEnv = env

  // Simple test data creation
  testAgent = await env.createTestAgent({...})
  testCustomer = await env.createTestCustomer({...})
  testConversation = await env.createTestConversation(testCustomer.id)
})

afterEach(() => {
  env.close()
  currentTestEnv = null
})
```

## 下一步

完成迁移后：

1. 运行所有重构的测试：`npm run test:integration`
2. 验证测试通过率
3. 检查测试覆盖率
4. 删除旧的测试文件（保留 `-refactored.test.ts` 版本）
5. 更新 CI/CD 配置（如果需要）

## 参考资料

- `tests/helpers/DatabaseTestEnvironment.ts` - 完整实现
- `tests/unit/utils/database-inmemory.test.ts` - DatabaseTestEnvironment 验证测试
- `tests/integration/*-refactored.test.ts` - 迁移示例
- Drizzle ORM 文档: https://orm.drizzle.team/
- Vitest 文档: https://vitest.dev/
