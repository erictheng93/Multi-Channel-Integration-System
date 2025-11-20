# Mock 设置标准文档 (Mock Setup Standards)

## 📋 目录
- [概述](#概述)
- [核心原则](#核心原则)
- [标准 Mock 模式](#标准-mock-模式)
- [常见问题和解决方案](#常见问题和解决方案)
- [最佳实践](#最佳实践)

---

## 概述

本文档定义了项目中所有测试文件的 Mock 设置标准，确保：
- ✅ 一致的 Mock 实现
- ✅ 避免 Unhandled Rejection
- ✅ 正确的类型安全
- ✅ 测试隔离和可维护性

---

## 核心原则

### 1. 错误处理优先 (Error Handling First)

**所有异步 Mock 必须有 error handling**

```typescript
// ❌ 错误示例 - 可能导致 Unhandled Rejection
mockStorage.get = vi.fn().mockRejectedValue(new Error('Storage error'));

// ✅ 正确示例 - 在源代码中添加 try-catch
private async loadState(): Promise<void> {
  try {
    const data = await this.state.storage.get('key');
    // ... process data
  } catch (error) {
    console.error('Failed to load state:', error);
    // Initialize with defaults
  }
}
```

### 2. 类型安全 (Type Safety)

**所有 Mock 必须与真实实现的类型匹配**

```typescript
// ❌ 错误示例 - 类型不匹配
const mockDb = {
  select: vi.fn().mockReturnValue({ data: [] })
};

// ✅ 正确示例 - 完整的 Drizzle ORM 结构
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]) // 返回数组
        })
      })
    })
  })
};
```

### 3. 测试隔离 (Test Isolation)

**每个测试必须独立，不依赖其他测试的状态**

```typescript
// ✅ 正确示例 - 使用 beforeEach 确保隔离
beforeEach(() => {
  vi.clearAllMocks();
  // Reset all mock state
  mockDb = createMockDatabase();
  mockEnv = createMockEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

---

## 标准 Mock 模式

### 1. Database Mock (Drizzle ORM)

**标准实现:**

```typescript
import { vi } from 'vitest';
import type { SQLiteSelectBuilder } from 'drizzle-orm/sqlite-core';

/**
 * 创建标准的 Drizzle ORM Mock
 *
 * @param returnData - 查询返回的数据
 * @returns Mock database instance
 */
export function createMockDatabase(returnData: any[] = []) {
  const mockSelect = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue(returnData),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockSelect),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        execute: vi.fn().mockResolvedValue(undefined)
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
          execute: vi.fn().mockResolvedValue(undefined)
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue(undefined)
      })
    })
  };
}

// 使用示例
const mockDb = createMockDatabase([
  { id: 1, name: 'Test User', role: 'admin' }
]);
```

### 2. Cloudflare Bindings Mock

**KV Namespace Mock:**

```typescript
export function createMockKV() {
  const storage = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => {
      const value = storage.get(key);
      return value || null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async () => ({
      keys: Array.from(storage.keys()).map(name => ({ name }))
    }))
  };
}
```

**R2 Bucket Mock:**

```typescript
export function createMockR2() {
  const storage = new Map<string, Buffer>();

  return {
    get: vi.fn(async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;

      return {
        body: data,
        arrayBuffer: async () => data.buffer,
        text: async () => data.toString()
      };
    }),
    put: vi.fn(async (key: string, value: Buffer | string) => {
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
      storage.set(key, buffer);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async () => ({
      objects: Array.from(storage.keys()).map(key => ({ key }))
    }))
  };
}
```

**Durable Objects Mock:**

```typescript
export class MockDurableObjectId {
  constructor(public name: string) {}

  toString(): string {
    return this.name;
  }

  equals(other: MockDurableObjectId): boolean {
    return this.name === other.name;
  }
}

export class MockDurableObjectState {
  public storage: Map<string, any> = new Map();

  constructor(public id: MockDurableObjectId) {}

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      console.error('blockConcurrencyWhile error:', error);
      throw error;
    }
  }

  get storage() {
    return {
      get: async <T>(key: string): Promise<T | undefined> => {
        return this.storage.get(key) as T | undefined;
      },
      put: async <T>(key: string, value: T): Promise<void> => {
        this.storage.set(key, value);
      },
      delete: async (key: string): Promise<boolean> => {
        return this.storage.delete(key);
      },
      list: async <T>(): Promise<Map<string, T>> => {
        return new Map(this.storage);
      }
    };
  }
}
```

### 3. Environment Mock

**完整的 Bindings Mock:**

```typescript
export function createMockEnv(): Bindings {
  return {
    // Database
    DB: createMockDatabase(),

    // KV Namespaces
    SESSION_CACHE: createMockKV(),
    RATE_LIMITER: createMockKV(),

    // R2 Buckets
    FILE_STORAGE: createMockR2(),

    // Durable Objects
    CONVERSATION_ROOM: {
      get: vi.fn((id: DurableObjectId) => ({
        fetch: vi.fn().mockResolvedValue(new Response('OK'))
      })),
      newUniqueId: vi.fn(() => new MockDurableObjectId('test-id'))
    },

    // Queues
    DELAYED_MESSAGE_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
      sendBatch: vi.fn().mockResolvedValue(undefined)
    },

    // Secrets
    JWT_SECRET: 'test-secret-key-for-testing-only',
    LINE_CHANNEL_SECRET: 'test-line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',

    // Environment variables
    ENVIRONMENT: 'test' as const,
    API_BASE_URL: 'http://localhost:8787'
  };
}
```

---

## 常见问题和解决方案

### 问题 1: Unhandled Promise Rejection

**症状:**
```
⎯⎯⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: Storage error
```

**原因:**
Mock 返回被拒绝的 Promise，但源代码没有处理错误。

**解决方案:**

1. **在源代码中添加 error handling** (推荐)
```typescript
// 修改源代码
async loadState(): Promise<void> {
  try {
    const data = await this.storage.get('key');
  } catch (error) {
    console.error('Load error:', error);
    // Use defaults
  }
}
```

2. **或者在测试中添加错误捕获**
```typescript
it('should handle storage errors', async () => {
  mockStorage.get.mockRejectedValue(new Error('Storage error'));

  await expect(async () => {
    await service.loadData();
  }).rejects.toThrow('Storage error');
});
```

### 问题 2: 类型不匹配错误

**症状:**
```
Expected: true
Received: false

或

TypeError: Cannot read property 'from' of undefined
```

**原因:**
Mock 返回的数据结构与真实实现不匹配。

**解决方案:**

检查 Drizzle ORM 查询链：

```typescript
// ❌ 错误 - 缺少 from
db.select().where(...) // TypeError!

// ✅ 正确 - 完整链
db.select()
  .from(table)
  .where(...)
  .limit(10)
```

Mock 必须匹配：

```typescript
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({      // ← 必须有 from
      where: vi.fn().mockReturnValue({   // ← 必须有 where
        limit: vi.fn().mockReturnValue([]) // ← 返回数组
      })
    })
  })
};
```

### 问题 3: 时区相关测试失败

**症状:**
测试在不同机器或 CI 环境中失败。

**解决方案:**

1. **强制使用 UTC 时间**
```typescript
// vitest.setup.ts
beforeAll(() => {
  process.env.TZ = 'UTC';
});
```

2. **使用固定时间**
```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

### 问题 4: Mock 在测试间泄漏状态

**症状:**
测试顺序影响结果，单独运行通过但一起运行失败。

**解决方案:**

```typescript
beforeEach(() => {
  // 清除所有 mock 调用记录
  vi.clearAllMocks();

  // 重新创建 mock 实例
  mockDb = createMockDatabase();
  mockEnv = createMockEnv();
});

afterEach(() => {
  // 恢复所有 mock
  vi.restoreAllMocks();
});
```

---

## 最佳实践

### 1. 使用工厂函数

创建可重用的 Mock 工厂：

```typescript
// tests/helpers/mockFactory.ts
export class MockFactory {
  static createDatabase(data?: any[]) {
    return createMockDatabase(data);
  }

  static createEnv(overrides?: Partial<Bindings>): Bindings {
    return {
      ...createMockEnv(),
      ...overrides
    };
  }

  static createRequest(
    url: string,
    options?: RequestInit
  ): Request {
    return new Request(url, {
      method: 'GET',
      ...options
    });
  }
}

// 使用
const db = MockFactory.createDatabase([{ id: 1 }]);
const env = MockFactory.createEnv({
  JWT_SECRET: 'custom-secret'
});
```

### 2. 集中管理测试数据

```typescript
// tests/fixtures/testData.ts
export const TEST_USERS = [
  { id: 1, username: 'admin', role: 'admin' },
  { id: 2, username: 'agent', role: 'agent' }
];

export const TEST_CONVERSATIONS = [
  { id: 'conv-1', customerId: 1, status: 'open' },
  { id: 'conv-2', customerId: 2, status: 'closed' }
];

// 使用
import { TEST_USERS } from '../fixtures/testData';
const mockDb = createMockDatabase(TEST_USERS);
```

### 3. 使用 Type Guards 验证 Mock

```typescript
function isMockDatabase(db: any): db is ReturnType<typeof createMockDatabase> {
  return (
    typeof db.select === 'function' &&
    typeof db.insert === 'function' &&
    typeof db.update === 'function' &&
    typeof db.delete === 'function'
  );
}

// 在测试中验证
it('should have valid mock database', () => {
  expect(isMockDatabase(mockDb)).toBe(true);
});
```

### 4. 文档化复杂 Mock

```typescript
/**
 * Mock for Reports Service with custom date range
 *
 * @example
 * ```typescript
 * const service = new ReportsService(
 *   mockDb,
 *   mockEnv,
 *   {
 *     startDate: '2025-01-01',
 *     endDate: '2025-01-31'
 *   }
 * );
 * ```
 */
export function createMockReportsService(options: {
  startDate?: string;
  endDate?: string;
} = {}) {
  // ... implementation
}
```

---

## 检查清单

在创建新测试时，确保：

- [ ] 使用标准 Mock 工厂函数
- [ ] 所有异步操作有 error handling
- [ ] Mock 类型与真实实现匹配
- [ ] 使用 `beforeEach`/`afterEach` 清理状态
- [ ] 时区设置为 UTC（如果测试涉及日期）
- [ ] 测试独立运行和批量运行都能通过
- [ ] 添加了必要的注释和文档
- [ ] Mock 数据使用 fixtures 管理

---

## 参考资料

- [Vitest Mock Functions](https://vitest.dev/guide/mocking.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Cloudflare Workers Types](https://github.com/cloudflare/workers-types)
- [项目测试辅助工具](./helpers/)

---

**版本:** 1.0
**最后更新:** 2025-11-18
**维护者:** Development Team
