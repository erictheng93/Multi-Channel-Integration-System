# WebSocket 測試模式指南

**版本**: 2.0.0
**最後更新**: 2025-11-10
**狀態**: Phase 4 - WebSocket 架構標準化

---

## 📋 概述

本指南定義了統一的 WebSocket 測試模式，確保所有測試代碼使用一致的方法和最佳實踐。

### 測試層級

```
┌─────────────────────────────────────────┐
│  E2E Tests                              │  ← 完整用戶流程
│  (Real-time conversation flows)         │
├─────────────────────────────────────────┤
│  Integration Tests                      │  ← 組件交互
│  (WebSocket + Durable Objects)          │
├─────────────────────────────────────────┤
│  Unit Tests                             │  ← 單一組件
│  (Handlers, Services, Monitors)         │
├─────────────────────────────────────────┤
│  Performance Tests                      │  ← 負載和擴展性
│  (Connection scalability, throughput)   │
└─────────────────────────────────────────┘
```

---

## 🎯 模式 1: 單元測試模式

**適用於**: Handlers、Services、Monitors 等單一組件測試

### 特徵
- ✅ 輕量級設置
- ✅ 快速執行
- ✅ 使用 mock endpoints
- ✅ 隔離測試單個組件

### 標準模板

```typescript
// Example: Performance Monitor 或 Service 測試
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

// ==================== Global Mocks ====================

// 1. Mock WebSocket metrics endpoint
const mockWebSocketMetrics = {
  connections: {
    totalConnections: 10,
    activeConnections: 10,
    connectionsByUser: { 1: 5, 2: 3 },
    connectionsByRole: { admin: 2, agent: 8 },
    averageLatency: 50,
    messagesThroughput: { inbound: 100, outbound: 150 },
    errorRate: 0.01
  }
};

// 2. Store original fetch
const originalFetch = global.fetch;

// 3. Setup global fetch mock
beforeAll(() => {
  global.fetch = vi.fn((url: string | URL) => {
    const urlString = url.toString();

    if (urlString.includes('/api/websocket/metrics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockWebSocketMetrics)
      } as Response);
    }

    if (urlString.includes('/api/delayed-messages/metrics')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          totalScheduled: 50,
          processingRate: 10,
          queueDepth: 5
        })
      } as Response);
    }

    return Promise.reject(new Error(`Unexpected URL: ${urlString}`));
  }) as any;
});

// 4. Restore original fetch
afterAll(() => {
  global.fetch = originalFetch;
});

// ==================== Module Mocks ====================

vi.mock('@real-time/services/service-name', () => ({
  ServiceClass: {
    getInstance: vi.fn(() => mockInstance)
  }
}));

// ==================== Test Suite ====================

describe('Component Name', () => {
  let component: ComponentType;
  let mockEnv: any;

  beforeEach(() => {
    // Setup mock environment
    mockEnv = {
      WORKER_URL: 'http://localhost:8787',
      ADMIN_TOKEN: 'test-admin-token',
      SESSIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null)
      },
      CACHE: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null)
      }
    };

    component = new ComponentType();
    component.initialize(mockEnv);

    // Clear state between tests
    vi.clearAllMocks();
  });

  describe('功能描述', () => {
    it('should 測試案例描述', async () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = await component.method(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.property).toBe(expectedValue);
    });
  });
});
```

### 關鍵點

1. **Global Fetch Mock**
   - 使用 `beforeAll` 設置
   - 使用 `afterAll` 恢復
   - 涵蓋所有 WebSocket metrics endpoints

2. **Environment Setup**
   - 包含 `WORKER_URL` 和 `ADMIN_TOKEN`
   - 提供必要的 KV namespace mocks
   - 在 `beforeEach` 中重置狀態

3. **Test Isolation**
   - 使用 `vi.clearAllMocks()` 清理
   - 重置組件狀態
   - 獨立的測試數據

---

## 🎯 模式 2: 整合測試模式

**適用於**: WebSocket 連接生命週期、消息廣播、Durable Objects 交互

### 特徵
- ✅ 完整的 Durable Objects 環境
- ✅ 真實的 WebSocket 連接模擬
- ✅ 多組件交互測試
- ✅ 使用專用測試工具

### 標準模板

```typescript
// Example: WebSocket 整合測試
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DurableObjectsTestEnvironment,
  testEnv
} from '../../helpers/websocket/durable-objects-test-env';
import {
  WebSocketTestClient,
  WebSocketRoomTestController,
  WebSocketTestClientFactory
} from '../../helpers/websocket/websocket-test-client';
import {
  TestDataFactory,
  TestAssertions,
  TestScenarios
} from '../../helpers/websocket/websocket-test-utils';
import { ConversationRoom } from '@backend/durable-objects/ConversationRoom';
import { UserConnection } from '@backend/durable-objects/UserConnection';
import { MessageBroadcaster } from '@backend/durable-objects/MessageBroadcaster';
import { WebSocketBroadcastService } from '@backend/services/websocket-broadcast-service';

describe('WebSocket Integration Test Name', () => {
  let broadcastService: WebSocketBroadcastService;
  let mockEnv: any;
  let roomController: WebSocketRoomTestController;

  beforeEach(async () => {
    // 1. Reset test environment
    testEnv.reset();

    // 2. Register Durable Objects
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    testEnv.registerDurableObject('USER_CONNECTION', UserConnection);
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);

    // 3. Setup mock environment
    mockEnv = {
      ...testEnv.getBindings(),
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([])
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      }
    };

    // 4. Set migration config
    const migrationConfig = TestDataFactory.createMigrationConfig({
      enableWebSocket: true,
      rolloutPercentage: 100
    });

    mockEnv.SESSIONS.get.mockImplementation((key: string) => {
      if (key === 'websocket_migration_config') {
        return JSON.stringify(migrationConfig);
      }
      return null;
    });

    // 5. Initialize services
    broadcastService = new WebSocketBroadcastService(mockEnv);
    roomController = new WebSocketRoomTestController(testEnv);
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  describe('功能描述', () => {
    it('should 測試案例描述', async () => {
      // Arrange
      const conversationId = 'test-conversation-1';
      const client = WebSocketTestClientFactory.createAuthenticatedClient({
        userId: 'user-1',
        role: 'agent'
      });

      // Act
      await client.connect(conversationId);
      await client.sendMessage({
        type: 'message',
        content: 'Test message'
      });

      // Assert
      const messages = await client.getReceivedMessages();
      expect(messages).toHaveLength(1);
      TestAssertions.assertValidWebSocketMessage(messages[0]);
    });
  });
});
```

### 關鍵點

1. **Durable Objects Setup**
   - 使用 `testEnv.registerDurableObject()`
   - 在 `beforeEach` 中重置環境
   - 在 `afterEach` 中清理資源

2. **WebSocket Test Clients**
   - 使用 `WebSocketTestClientFactory` 創建客戶端
   - 模擬真實的連接行為
   - 提供消息發送/接收功能

3. **Test Utilities**
   - `TestDataFactory` 創建測試數據
   - `TestAssertions` 驗證結果
   - `TestScenarios` 常見測試場景

---

## 🎯 模式 3: 性能測試模式

**適用於**: 負載測試、連接擴展性、吞吐量測試

### 特徵
- ✅ 大量併發連接模擬
- ✅ 性能指標收集
- ✅ 閾值驗證
- ✅ 壓力測試場景

### 標準模板

```typescript
// Example: 連接擴展性測試
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoadTestUtilities } from '../../helpers/websocket/websocket-test-utils';
import { WebSocketTestClientFactory } from '../../helpers/websocket/websocket-test-client';

describe('WebSocket Performance Test Name', () => {
  const CONNECTION_COUNT = 1000;
  const MESSAGE_RATE_PER_SECOND = 100;
  const TEST_DURATION_MS = 10000;

  let loadTestUtil: LoadTestUtilities;

  beforeEach(() => {
    loadTestUtil = new LoadTestUtilities();
  });

  afterEach(async () => {
    await loadTestUtil.cleanup();
  });

  describe('Connection Scalability', () => {
    it('should handle 1000+ concurrent connections', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const metrics = await loadTestUtil.createMassiveLoad({
        connectionCount: CONNECTION_COUNT,
        messageRate: MESSAGE_RATE_PER_SECOND,
        duration: TEST_DURATION_MS
      });

      const endTime = Date.now();
      const testDuration = endTime - startTime;

      // Assert
      expect(metrics.successfulConnections).toBeGreaterThan(CONNECTION_COUNT * 0.95);
      expect(metrics.averageLatency).toBeLessThan(200);
      expect(metrics.errorRate).toBeLessThan(0.05);
      expect(testDuration).toBeLessThan(TEST_DURATION_MS * 1.1);
    });

    it('should maintain performance under sustained load', async () => {
      // Arrange
      const connections = await loadTestUtil.createConnections(100);

      // Act
      const metrics = await loadTestUtil.sustainedLoad({
        connections,
        messageRate: 50,
        duration: 30000
      });

      // Assert
      expect(metrics.throughput).toBeGreaterThan(40); // 80% of target
      expect(metrics.cpuUsage).toBeLessThan(80);
      expect(metrics.memoryUsage).toBeLessThan(500); // MB
    });
  });
});
```

### 關鍵點

1. **負載參數**
   - 明確定義連接數量
   - 設定消息速率
   - 指定測試持續時間

2. **Metrics 收集**
   - 成功連接率
   - 平均延遲
   - 錯誤率
   - 資源使用情況

3. **閾值驗證**
   - 95% 成功率下限
   - 延遲上限 < 200ms
   - 錯誤率 < 5%

---

## 🎯 模式 4: E2E 測試模式

**適用於**: 完整用戶流程、端到端場景

### 特徵
- ✅ 完整的應用流程
- ✅ 多用戶交互
- ✅ 真實場景模擬
- ✅ 用戶體驗驗證

### 標準模板

```typescript
// Example: 實時對話流程 E2E 測試
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestScenarios } from '../../helpers/websocket/websocket-test-utils';
import { WebSocketTestClientFactory } from '../../helpers/websocket/websocket-test-client';

describe('Real-time Conversation E2E Flow', () => {
  let agent: any;
  let customer: any;
  let conversationId: string;

  beforeEach(async () => {
    // Setup test scenario
    const scenario = await TestScenarios.createMultiUserConversation({
      agentCount: 1,
      customerCount: 1
    });

    agent = scenario.agents[0];
    customer = scenario.customers[0];
    conversationId = scenario.conversationId;
  });

  afterEach(async () => {
    await agent?.disconnect();
    await customer?.disconnect();
  });

  describe('Complete Conversation Flow', () => {
    it('should support real-time message exchange', async () => {
      // Act: Customer sends message
      await customer.sendMessage({
        type: 'message',
        content: 'I need help'
      });

      // Wait for agent to receive
      await agent.waitForMessage();

      // Act: Agent responds
      await agent.sendMessage({
        type: 'message',
        content: 'How can I assist you?'
      });

      // Wait for customer to receive
      await customer.waitForMessage();

      // Assert
      const agentMessages = await agent.getReceivedMessages();
      const customerMessages = await customer.getReceivedMessages();

      expect(agentMessages).toHaveLength(1);
      expect(agentMessages[0].content).toBe('I need help');

      expect(customerMessages).toHaveLength(1);
      expect(customerMessages[0].content).toBe('How can I assist you?');
    });
  });
});
```

### 關鍵點

1. **場景設置**
   - 使用 `TestScenarios` 創建真實場景
   - 模擬多用戶交互
   - 設置完整的對話環境

2. **用戶流程**
   - 模擬真實用戶行為
   - 驗證消息傳遞
   - 測試端到端延遲

3. **清理資源**
   - 斷開所有連接
   - 清理測試數據
   - 確保測試隔離

---

## 📚 測試工具參考

### 核心工具類

#### 1. DurableObjectsTestEnvironment

```typescript
import { testEnv } from '../../helpers/websocket/durable-objects-test-env';

// 功能
testEnv.reset();                          // 重置環境
testEnv.registerDurableObject(name, cls); // 註冊 Durable Object
testEnv.getBindings();                    // 獲取 bindings
testEnv.cleanup();                        // 清理資源
```

#### 2. WebSocketTestClient

```typescript
import { WebSocketTestClientFactory } from '../../helpers/websocket/websocket-test-client';

// 創建客戶端
const client = WebSocketTestClientFactory.createAuthenticatedClient({
  userId: 'user-1',
  role: 'agent'
});

// 操作
await client.connect(conversationId);
await client.sendMessage(message);
await client.waitForMessage();
const messages = await client.getReceivedMessages();
await client.disconnect();
```

#### 3. TestDataFactory

```typescript
import { TestDataFactory } from '../../helpers/websocket/websocket-test-utils';

// 創建測試數據
const event = TestDataFactory.createRealtimeEvent({ /* options */ });
const message = TestDataFactory.createWebSocketMessage({ /* options */ });
const config = TestDataFactory.createMigrationConfig({ /* options */ });
```

#### 4. TestAssertions

```typescript
import { TestAssertions } from '../../helpers/websocket/websocket-test-utils';

// 驗證
TestAssertions.assertValidEvent(event);
TestAssertions.assertValidWebSocketMessage(message);
TestAssertions.assertEventMatches(actual, expected);
TestAssertions.assertPerformanceMetrics(metrics, thresholds);
```

---

## ✅ 測試檢查清單

### 單元測試

- [ ] 使用 global.fetch mock 模擬 WebSocket endpoints
- [ ] 包含 WORKER_URL 和 ADMIN_TOKEN 在環境中
- [ ] 在 beforeEach 中清理 mocks
- [ ] 測試隔離（獨立運行）
- [ ] 使用 beforeAll/afterAll 管理全局設置

### 整合測試

- [ ] 使用 DurableObjectsTestEnvironment
- [ ] 註冊所有必需的 Durable Objects
- [ ] 使用 WebSocketTestClient 模擬連接
- [ ] 在 afterEach 中清理資源
- [ ] 驗證多組件交互

### 性能測試

- [ ] 定義明確的性能閾值
- [ ] 收集完整的性能指標
- [ ] 測試大規模併發場景
- [ ] 驗證資源使用情況
- [ ] 包含壓力測試場景

### E2E 測試

- [ ] 模擬完整的用戶流程
- [ ] 測試多用戶交互
- [ ] 驗證端到端延遲
- [ ] 測試錯誤處理和恢復
- [ ] 清理所有測試資源

---

## 🚫 反模式（避免）

### ❌ 不要這樣做

```typescript
// 1. 不要在單元測試中使用完整的 Durable Objects 環境
// BAD
describe('Simple Service Test', () => {
  beforeEach(() => {
    testEnv.reset();
    testEnv.registerDurableObject('CONVERSATION_ROOM', ConversationRoom);
    // ... 太重量級了
  });
});

// 2. 不要混合使用不同的測試模式
// BAD
it('should test everything', async () => {
  const client = WebSocketTestClientFactory.create(); // 整合測試工具
  const result = await simpleFunction();              // 單元測試邏輯
  // 混亂且難以維護
});

// 3. 不要忘記清理資源
// BAD
afterEach(() => {
  // 沒有清理連接、Durable Objects 或 mocks
});

// 4. 不要使用硬編碼的延遲
// BAD
it('should receive message', async () => {
  client.sendMessage(msg);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 不可靠
  expect(client.messages).toHaveLength(1);
});
```

### ✅ 應該這樣做

```typescript
// 1. 選擇適當的測試模式
// GOOD
describe('Simple Service Test', () => {
  beforeEach(() => {
    global.fetch = mockFetch; // 輕量級 mock
  });
});

// 2. 保持測試單一職責
// GOOD
it('should send message', async () => {
  await client.sendMessage(msg);
  expect(client.lastSentMessage).toEqual(msg);
});

it('should receive message', async () => {
  await client.waitForMessage();
  expect(client.messages).toHaveLength(1);
});

// 3. 總是清理資源
// GOOD
afterEach(async () => {
  await client.disconnect();
  await testEnv.cleanup();
  vi.clearAllMocks();
});

// 4. 使用事件驅動的等待
// GOOD
it('should receive message', async () => {
  await client.sendMessage(msg);
  await client.waitForMessage(); // 事件驅動
  expect(client.messages).toHaveLength(1);
});
```

---

## 📊 測試覆蓋率目標

| 測試類型 | 目標覆蓋率 | 當前狀態 |
|---------|----------|---------|
| 單元測試 | 80%+ | ✅ 85% |
| 整合測試 | 60%+ | ✅ 65% |
| E2E 測試 | 關鍵流程 100% | ✅ 100% |
| 性能測試 | 核心場景 | ✅ 完成 |

---

## 🔗 相關資源

- [WebSocket Test Utilities](../../tests/helpers/websocket/README.md)
- [Durable Objects Testing](../../tests/helpers/websocket/durable-objects-test-env.ts)
- [Performance Testing Guide](./PERFORMANCE_TESTING.md)
- [Test Infrastructure Improvements](../migration/TEST_INFRASTRUCTURE_IMPROVEMENTS.md)

---

## 📝 版本歷史

- **2.0.0** (2025-11-10): Phase 4 更新 - 統一 WebSocket 測試模式
- **1.5.0** (2025-01-30): 添加性能測試模式
- **1.0.0** (2025-01-15): 初始版本 - WebSocket 測試基礎

---

**文檔維護者**: Test Infrastructure Team
**審核者**: Technical Lead
**下次審核**: 2025-12-10
