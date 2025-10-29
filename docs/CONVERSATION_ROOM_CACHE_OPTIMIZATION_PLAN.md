# Week 3-4: ConversationRoom DO 缓存优化方案

## 🎯 优化目标

**目标内存降低**: 100KB/DO
**优化策略**: 减少消息缓存 + Lazy Load机制
**实施时间**: Week 3-4 (2天)

---

## 📊 当前缓存分析

### Current Implementation

**文件**: `src/durable-objects/ConversationRoom.ts:73, 557-564`

```typescript
export class ConversationRoom implements DurableObject {
  // Full mode only
  private messageHistory: RealtimeEvent[] = [];

  // Configuration with defaults
  private readonly MAX_MESSAGE_HISTORY: number;

  constructor(state: DurableObjectState, env: any, config?: ConversationRoomConfig) {
    // ...
    this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 50; // ⚠️ 默认50条
  }

  // Message handling
  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage) {
    // ...
    if (this.isFullMode()) {
      const realtimeEvent: RealtimeEvent = {
        id: event.id,
        type: event.type as any,
        timestamp: event.timestamp.toString(),
        source: event.source,
        data: event.data as any
      };

      // ⚠️ 每条消息都加入缓存
      this.messageHistory.push(realtimeEvent);

      // ⚠️ 超过50条就移除最旧的
      if (this.messageHistory.length > this.MAX_MESSAGE_HISTORY) {
        this.messageHistory.shift();
      }

      // ⚠️ 每次都写入storage
      await this.state.storage.put('messageHistory', this.messageHistory);
    }

    // Broadcast to all connections
    await this.broadcastEvent(event);
  }
}
```

### 缓存使用场景分析

**使用位置**:

1. **存储** (Line 557-564):
   - 每条新消息都添加到缓存
   - 超过50条时移除最旧的
   - 每次都写入DO storage

2. **恢复** (Line 647-650):
   ```typescript
   const messageHistory = await this.state.storage.get('messageHistory');
   if (messageHistory) {
     this.messageHistory = messageHistory;
   }
   ```

3. **Metrics** (Line 931):
   ```typescript
   messageHistory: this.messageHistory.length
   ```

**没有找到的使用场景**:
- ❌ 没有API endpoint返回消息历史
- ❌ 没有新连接时发送历史消息的逻辑
- ❌ 缓存基本上是"write-only"，很少被读取

---

## 🔍 问题分析

### Problem 1: 内存占用过高

**单条消息内存估算**:
```typescript
interface RealtimeEvent {
  id: string;              // ~36 bytes (UUID)
  type: string;            // ~16 bytes (event type)
  timestamp: string;       // ~16 bytes
  source: string;          // ~12 bytes
  data: {
    messageId: string;     // ~36 bytes
    content: string;       // ~500 bytes (平均)
    messageType: string;   // ~8 bytes
    senderName?: string;   // ~20 bytes
    metadata: object;      // ~100 bytes
  };
}

总计: ~744 bytes/message
```

**50条消息内存占用**:
```
50 messages × 744 bytes = 37,200 bytes ≈ 37 KB

考虑JavaScript对象开销和JSON序列化：
实际内存占用 ≈ 50-80 KB

加上DO实例其他状态（connections, participants等）：
总内存占用 ≈ 100-150 KB/DO
```

**系统级影响** (假设1000个活跃对话):
```
1000 DOs × 100 KB = 100 MB 基准内存
1000 DOs × 50 KB (仅缓存) = 50 MB 缓存内存

如果减少到10条消息：
1000 DOs × 10 KB (缓存) = 10 MB 缓存内存

⚡ 节省: 40 MB (80% reduction)
```

### Problem 2: Storage写入频率过高

**当前写入模式**:
```
每条消息 → storage.put('messageHistory', messageHistory)

高频对话场景:
- 100 messages/minute
- 100 storage writes/minute
- 可能触发DO storage throttling
```

**Storage性能影响**:
```
每次put操作: 5-15ms
100次/分钟 × 10ms = 1000ms额外延迟/分钟

对于单个DO来说不严重，但对于1000个DO:
1000 DOs × 100 writes/min = 100,000 writes/min系统级
可能影响Cloudflare Workers整体性能
```

### Problem 3: 缓存很少被使用

**实际使用情况**:

1. **写入**: 每条消息都写入 ✅ 高频
2. **读取**:
   - DO启动时恢复 ✅ 低频（DO冷启动）
   - 新用户连接时发送历史 ❌ **没有实现**
   - API查询历史消息 ❌ **没有实现**
   - Metrics统计 ✅ 低频

**结论**: 缓存是"write-heavy, read-light"，投入产出比低

---

## ✨ 优化方案

### Strategy 1: 减少缓存大小

**变更**:
```typescript
// Before
this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 50;

// After
this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 10; // 80% reduction
```

**收益**:
- ✅ 内存占用降低 **40 KB → 8 KB** (80% reduction)
- ✅ Storage序列化更快（数据量小5倍）
- ✅ DO启动恢复更快

**风险**: 低
- 缓存很少被读取，减少对用户无影响
- 10条消息足够覆盖大多数"快速重连查看最新消息"的场景

---

### Strategy 2: Lazy Load from Database

**当前问题**: 缓存被清除后，历史消息就丢失了

**解决方案**: 实现按需从D1数据库加载

#### 新增API Endpoint: `/history`

```typescript
/**
 * GET /history?limit=50&before=messageId
 *
 * Lazy load message history from database
 *
 * Response:
 * {
 *   messages: RealtimeEvent[],
 *   hasMore: boolean,
 *   cached: boolean
 * }
 */
private async handleGetHistory(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const before = url.searchParams.get('before'); // messageId

  // 1. First try: Return from cache if available
  if (!before && this.messageHistory.length > 0) {
    return Response.json({
      messages: this.messageHistory,
      hasMore: true, // Assume more messages in DB
      cached: true
    });
  }

  // 2. Load from D1 database
  const db = drizzle(this.env.DB);

  let query = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, this.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  if (before) {
    const beforeMessage = await db
      .select()
      .from(messages)
      .where(eq(messages.id, before))
      .limit(1);

    if (beforeMessage.length > 0) {
      query = query.where(lt(messages.createdAt, beforeMessage[0].createdAt!));
    }
  }

  const dbMessages = await query;

  // Convert to RealtimeEvent format
  const events: RealtimeEvent[] = dbMessages.map(msg => ({
    id: msg.id,
    type: 'message_sent',
    timestamp: msg.createdAt || new Date().toISOString(),
    source: 'database',
    data: {
      messageId: msg.id,
      content: msg.content || '',
      messageType: msg.messageType || 'text',
      senderName: msg.agentSenderId || 'Unknown'
    }
  }));

  return Response.json({
    messages: events,
    hasMore: events.length === limit,
    cached: false
  });
}
```

**使用流程**:
```
┌─────────────────────────────────────────────────────────────┐
│ User connects to ConversationRoom                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. WebSocket建立连接                                       │
│                                                             │
│  2. 前端请求: GET /history?limit=10                         │
│     ↓                                                       │
│     DO检查缓存 (10条最新消息)                                │
│     ↓                                                       │
│     返回缓存 (if available)                                 │
│                                                             │
│  3. 用户向上滚动查看更多                                     │
│     ↓                                                       │
│     前端请求: GET /history?limit=20&before=msg-123          │
│     ↓                                                       │
│     DO查询D1数据库                                          │
│     ↓                                                       │
│     返回历史消息                                             │
│                                                             │
│  ⚡ 缓存只用于最新10条，历史全部lazy load                    │
└─────────────────────────────────────────────────────────────┘
```

**收益**:
- ✅ 无限历史消息访问（不受缓存限制）
- ✅ 缓存只存最新，内存占用最小
- ✅ 按需加载，性能最优

---

### Strategy 3: 批量Storage写入

**当前问题**: 每条消息都立即写入storage

**优化方案**: 延迟批量写入

#### Option A: Debounced Write (防抖写入)

```typescript
private messageDirty = false;
private writeDebounceTimer: any = null;

private async handleChatMessage(...) {
  // ... (message processing)

  if (this.isFullMode()) {
    this.messageHistory.push(realtimeEvent);
    if (this.messageHistory.length > this.MAX_MESSAGE_HISTORY) {
      this.messageHistory.shift();
    }

    // ✅ Week 3-4: Debounced storage write
    this.messageDirty = true;
    this.scheduleStorageWrite();
  }

  // ... (broadcast)
}

private scheduleStorageWrite(): void {
  // Clear existing timer
  if (this.writeDebounceTimer) {
    clearTimeout(this.writeDebounceTimer);
  }

  // Schedule write in 5 seconds
  this.writeDebounceTimer = setTimeout(async () => {
    if (this.messageDirty) {
      await this.state.storage.put('messageHistory', this.messageHistory);
      this.messageDirty = false;
      console.log(`💾 [ConversationRoom] Message history persisted (${this.messageHistory.length} messages)`);
    }
  }, 5000); // 5 second debounce
}
```

**收益**:
```
Before: 100 messages/min → 100 storage writes/min
After:  100 messages/min → 12 storage writes/min (every 5 seconds)

⚡ Storage写入降低: 88% reduction
```

**风险**: 中等
- 如果DO crash，最多丢失5秒内的消息缓存
- 但消息本身已经通过WebSocket broadcast发送
- 且已经发送到message queue持久化
- 所以丢失缓存不影响消息完整性

#### Option B: Periodic Write (定期写入)

```typescript
private setupCleanupTasks(): void {
  // ... existing cleanup tasks

  // ✅ Week 3-4: Periodic message history persistence
  setInterval(async () => {
    if (this.messageDirty) {
      await this.state.storage.put('messageHistory', this.messageHistory);
      this.messageDirty = false;
    }
  }, 10000); // Every 10 seconds
}
```

**推荐**: **Option A (Debounced Write)**
- 更及时（有消息就5秒后写入）
- 更节省（没消息就不写入）
- 更灵活（可以根据负载调整debounce时间）

---

## 📈 预期性能提升

### 内存优化

```
单个DO:
Before: 50 messages × 744 bytes = ~37 KB (仅缓存)
After:  10 messages × 744 bytes = ~7.4 KB (仅缓存)

⚡ 内存降低: 29.6 KB (80% reduction per DO)

系统级 (1000个活跃DOs):
Before: 1000 × 37 KB = 37 MB
After:  1000 × 7.4 KB = 7.4 MB

⚡ 系统内存节省: 29.6 MB
```

### Storage写入优化

```
高频对话场景 (100 messages/min):
Before: 100 storage writes/min
After:  12 storage writes/min (debounce 5s)

⚡ Storage写入降低: 88% reduction

系统级 (1000个活跃DOs, 平均20 msg/min):
Before: 1000 × 20 = 20,000 writes/min
After:  1000 × 12 = 12,000 writes/min (worst case, 实际更少)

⚡ 系统Storage负载降低: 40-60%
```

### 启动性能优化

```
DO冷启动恢复缓存:
Before: 50 messages × JSON parse = ~15-20ms
After:  10 messages × JSON parse = ~3-5ms

⚡ 启动速度提升: 75%
```

---

## 🛠️ 实施计划

### Phase 1: 减少缓存大小 (1小时)

#### 步骤1: 修改默认值
```typescript
// src/durable-objects/ConversationRoom.ts:90
- this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 50;
+ this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 10;
```

#### 步骤2: 添加配置注释
```typescript
/**
 * Week 3-4 Optimization: Reduced message cache from 50 to 10
 * Rationale:
 * - Cache is rarely read (no API endpoint for history)
 * - 10 messages cover "quick reconnect" scenarios
 * - Full history available via lazy load from database
 * Memory savings: 30KB per DO (80% reduction)
 */
this.MAX_MESSAGE_HISTORY = this.config.maxMessageHistory || 10;
```

---

### Phase 2: 实现Lazy Load (3小时)

#### 步骤1: 添加/history endpoint
```typescript
// Add to fetch() method switch statement
case '/history':
  return this.handleGetHistory(request);
```

#### 步骤2: 实现handleGetHistory方法
```typescript
private async handleGetHistory(request: Request): Promise<Response> {
  // Implementation as shown above
}
```

#### 步骤3: 测试
```bash
# Test cache retrieval
curl "https://conversation-room/history?limit=10"

# Test database lazy load
curl "https://conversation-room/history?limit=20&before=msg-123"
```

---

### Phase 3: 实现批量写入 (2小时)

#### 步骤1: 添加debounce机制
```typescript
private messageDirty = false;
private writeDebounceTimer: any = null;

private scheduleStorageWrite(): void {
  // Implementation as shown above
}
```

#### 步骤2: 修改消息处理逻辑
```typescript
// Replace immediate storage write
- await this.state.storage.put('messageHistory', this.messageHistory);
+ this.messageDirty = true;
+ this.scheduleStorageWrite();
```

#### 步骤3: DO关闭时强制写入
```typescript
// Add to cleanup logic
async onShutdown(): Promise<void> {
  if (this.messageDirty) {
    await this.state.storage.put('messageHistory', this.messageHistory);
  }
}
```

---

## 🧪 测试计划

### 单元测试

```typescript
// tests/unit/durable-objects/ConversationRoom-cache.test.ts

describe('ConversationRoom Cache Optimization', () => {
  test('should limit cache to 10 messages', async () => {
    const room = new ConversationRoom(mockState, mockEnv, { mode: 'full' });

    // Send 20 messages
    for (let i = 0; i < 20; i++) {
      await room.handleMessage({ type: 'message', data: { content: `msg-${i}` } });
    }

    // Cache should only have 10 (最新的10条)
    const history = room.getMessageHistory();
    expect(history.length).toBe(10);
    expect(history[0].data.content).toBe('msg-10'); // Oldest in cache
    expect(history[9].data.content).toBe('msg-19'); // Newest in cache
  });

  test('should debounce storage writes', async () => {
    const room = new ConversationRoom(mockState, mockEnv, { mode: 'full' });
    const storagePutSpy = vi.spyOn(mockState.storage, 'put');

    // Send 10 messages rapidly
    for (let i = 0; i < 10; i++) {
      await room.handleMessage({ type: 'message', data: { content: `msg-${i}` } });
    }

    // Storage.put should NOT be called immediately
    expect(storagePutSpy).not.toHaveBeenCalled();

    // Wait 6 seconds (debounce 5s + 1s buffer)
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Storage.put should be called ONCE
    expect(storagePutSpy).toHaveBeenCalledTimes(1);
  });

  test('should lazy load from database', async () => {
    const room = new ConversationRoom(mockState, mockEnv, { mode: 'full' });

    // Mock D1 database
    const mockMessages = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      content: `Message ${i}`,
      createdAt: new Date(Date.now() - i * 60000).toISOString()
    }));

    mockEnv.DB = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(mockMessages.slice(0, 20))
            })
          })
        })
      })
    };

    // Request history
    const response = await room.fetch(new Request('https://room/history?limit=20'));
    const data = await response.json();

    expect(data.messages.length).toBe(20);
    expect(data.cached).toBe(false);
    expect(data.hasMore).toBe(true);
  });
});
```

### 集成测试

```bash
# Test message throughput with cache optimization
npm run test -- tests/integration/websocket/high-volume-messaging.test.ts

# Test DO memory usage
npm run test:memory -- ConversationRoom

# Test lazy load performance
npm run test -- tests/integration/websocket/lazy-load.test.ts
```

---

## 📊 监控指标

### 关键指标

#### 1. DO内存占用
```
Metric: conversation_room_memory_bytes

Before: ~100-150 KB/DO
Target: ~60-80 KB/DO (40% reduction)

监控方法:
- Cloudflare Workers Analytics
- DO metrics endpoint
```

#### 2. Storage写入频率
```
Metric: conversation_room_storage_writes_per_minute

Before: ~20-100 writes/min per DO
Target: ~2-12 writes/min per DO (80-90% reduction)

监控方法:
- Cloudflare Durable Objects Analytics
- Custom logging
```

#### 3. History查询延迟
```
Metric: history_query_latency_ms

Cache hit: < 5ms
Database hit: < 50ms

Target: P95 < 100ms
```

---

## 🚨 回滚计划

### 触发条件

1. **DO内存占用未降低**
   - 如果优化后内存占用没有改善
   - 可能代码有其他内存泄漏

2. **History查询失败率 > 5%**
   - Lazy load实现有bug
   - 数据库查询失败

3. **用户反馈消息历史丢失**
   - 虽然理论上不会发生（消息在D1）
   - 但需要监控用户反馈

### 回滚步骤

```bash
# 1. 回滚代码
git revert <commit-hash>

# 2. 重新部署
npm run deploy

# 3. 验证
npm run health:check:all

# 4. 监控30分钟
```

---

## 🎯 成功标准

### 必须达成

1. ✅ DO内存占用降低 **≥ 30%**
   - Before: ~100-150 KB
   - Target: ~60-80 KB

2. ✅ Storage写入降低 **≥ 80%**
   - Before: ~100 writes/min (高频)
   - Target: ~12 writes/min

3. ✅ History查询成功率 **> 95%**
   - Cache hit + Database hit

4. ✅ 无消息丢失
   - 所有消息可通过lazy load获取

### 期望达成

1. ⭐ DO内存占用降低 **40%**
   - Exceeds target

2. ⭐ Storage写入降低 **90%**
   - Debounce效果显著

3. ⭐ History查询延迟 **P95 < 50ms**
   - 优秀的查询性能

---

## 📚 相关文档

- `src/durable-objects/ConversationRoom.ts` - ConversationRoom DO实现
- `src/db/schema.ts` - 数据库schema
- `docs/DISTRIBUTED_LOCK_OPTIMIZATION_PLAN.md` - 锁优化方案
- `docs/LOCK_OPTIMIZATION_IMPLEMENTATION_REPORT.md` - 锁优化报告

---

**文档版本**: 1.0
**创建日期**: 2025-01-28
**状态**: ✅ Ready for Implementation
**预计完成时间**: 6小时 (1天)
