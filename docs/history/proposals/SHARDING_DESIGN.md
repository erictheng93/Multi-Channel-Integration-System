# Sharding System Design for Multi-Channel Customer Support Platform

##  Document Information

**Created**: 2025-10-28
**Author**: System Architecture Team
**Version**: 1.0.0 (Design Phase)
**Status**:  Design & Planning
**Related Files**:
- `src/durable-objects/ConversationRoom.ts` (Current Implementation)
- `TechStack/pubsub/src/durable-objects/topic.ts` (Reference Implementation)

---

##  Executive Summary

This document outlines the design for implementing an **automatic sharding system** for ConversationRoom Durable Objects, enabling the platform to scale from **~100 concurrent connections per conversation** to **50,000+ connections** through horizontal partitioning.

### Key Objectives

 **Scalability**: Support 50,000+ concurrent connections per conversation
 **Backward Compatibility**: Seamless upgrade without breaking existing features
 **Performance**: Minimal latency overhead (<50ms for shard routing)
 **Reliability**: Automatic failover and shard rebalancing
 **Observability**: Comprehensive metrics and monitoring

---

##  Current System Analysis

### ConversationRoom Current Architecture

```typescript
// src/durable-objects/ConversationRoom.ts (Simplified)
export class ConversationRoom implements DurableObject {
  private connections = new Map<string, WebSocketConnection>();
  private readonly MAX_CONNECTIONS = 100; //  Current Bottleneck

  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      return new Response('Connection limit reached', { status: 429 });
    }
    // ... connection handling
  }
}
```

### Current Limitations

| Aspect | Current State | Impact |
|--------|--------------|--------|
| **Max Connections** | ~100-1,000 per conversation |  Cannot support viral events |
| **Scalability** | Vertical only (single DO) |  Hard limit per instance |
| **Distribution** | None |  All load on one DO |
| **Failover** | Manual recovery |  Downtime during failures |

---

##  Proposed Sharding Architecture

### Core Concept: Horizontal Partitioning

```
┌─────────────────────────────────────────────────────────────────┐
│ Conversation Sharding Architecture │
├─────────────────────────────────────────────────────────────────┤
│ │
│  Client Request (conversationId: "conv-123") │
│ │                                                         │
│ ▼                                                         │
│  ┌──────────────────────┐ │
│  │  ShardingService │   Find available shard │
│  │  (Worker Entry) │                                        │
│  └──────────────────────┘ │
│ │                                                         │
│ ├────► Check shard capacities (RPC) │
│ │                                                         │
│ ▼                                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Shard Selection Algorithm │            │
│  │  conv-123_shard-0  ──► 9,500 connections  Full│ │
│  │  conv-123_shard-1  ──► 8,200 connections  Full│ │
│  │  conv-123_shard-2  ──► 3,100 connections  OK  │ ◄─ Select  │
│  │  conv-123_shard-3  ──► 0 connections (idle) │            │
│  │  conv-123_shard-4  ──► Not created yet │            │
│  └─────────────────────────────────────────────────┘ │
│ │                                                         │
│ ▼                                                         │
│  ┌──────────────────────┐ │
│  │ ConversationRoom DO  │ Route to selected shard │
│  │ (conv-123_shard-2) │                                        │
│  │ • connections: 3,100 │ │
│  │ • capacity: 10,000 │                                        │
│  │ • shardIndex: 2 │                                        │
│  └──────────────────────┘ │
│ │                                                         │
│ ▼                                                         │
│  WebSocket Connection Established │
│ │
└─────────────────────────────────────────────────────────────────┘
```

### Sharding Parameters

```typescript
// Proposed Configuration
const SHARD_CONFIG = {
  CONNECTIONS_PER_SHARD: 10_000,  // Matches Pubsub proven capacity
  MAX_SHARDS_PER_CONVERSATION: 5, // 50,000 total connections
  SHARD_REBALANCE_THRESHOLD: 0.8, // 80% capacity triggers rebalance check
  SHARD_NAMING_PATTERN: '{conversationId}_shard-{index}',
  CAPACITY_CHECK_TIMEOUT: 2000, // 2 seconds for RPC timeout
  FAILOVER_RETRY_COUNT: 3, // Retry on shard failure
};
```

---

##  Detailed Technical Design

### 1. ShardingService (New Component)

**Location**: `src/services/conversation-sharding-service.ts`

```typescript
/**
 * Manages shard selection and routing for ConversationRoom Durable Objects
 */
export class ConversationShardingService {
  private env: Bindings;
  private shardCache: Map<string, ShardMetadata[]> = new Map();

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * Core Algorithm: Find first available shard for conversation
   *
   * Flow:
   * 1. Check cache for existing shards
   * 2. Loop through shards 0 to MAX_SHARDS-1
   * 3. For each shard, call canSupportConnection() RPC
   * 4. Return first available shard OR create new shard
   * 5. Update cache with shard metadata
   */
  async getAvailableShardForConversation(
    conversationId: string,
    retryAttempt: number = 0
  ): Promise<DurableObjectStub | null> {

    // 1️ Try existing shards first (from cache)
    const cachedShards = this.shardCache.get(conversationId) || [];

    for (const shardMeta of cachedShards) {
      const stub = this.getShardStub(conversationId, shardMeta.index);

      try {
        const capacity = await this.checkShardCapacity(stub);

        if (capacity.hasCapacity) {
          console.log(` Using existing shard-${shardMeta.index} for ${conversationId}`);
          return stub;
        }
      } catch (error) {
        console.warn(` Shard-${shardMeta.index} check failed:`, error);
        // Continue to next shard
      }
    }

    // 2️ Create or find next available shard
    for (let shardIndex = 0; shardIndex < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; shardIndex++) {
      const stub = this.getShardStub(conversationId, shardIndex);

      try {
        const capacity = await this.checkShardCapacity(stub);

        if (capacity.hasCapacity) {
          console.log(` Allocating shard-${shardIndex} for ${conversationId}`);
          await this.initializeShard(stub, conversationId, shardIndex);
          this.updateShardCache(conversationId, shardIndex, capacity);
          return stub;
        }
      } catch (error) {
        console.error(` Failed to check shard-${shardIndex}:`, error);
      }
    }

    // 3️ All shards full or unreachable
    if (retryAttempt < SHARD_CONFIG.FAILOVER_RETRY_COUNT) {
      console.log(` Retrying shard allocation (attempt ${retryAttempt + 1})...`);
      await this.sleep(500 * (retryAttempt + 1)); // Exponential backoff
      return this.getAvailableShardForConversation(conversationId, retryAttempt + 1);
    }

    throw new Error(`All shards full for conversation ${conversationId} (50,000 connections limit reached)`);
  }

  /**
   * Check if shard can accept new connections (RPC call)
   */
  private async checkShardCapacity(
    stub: DurableObjectStub
  ): Promise<{ hasCapacity: boolean; connectionCount: number; shardIndex: number }> {

    const response = await stub.fetch(new Request('https://shard/capacity-check', {
      method: 'GET',
      signal: AbortSignal.timeout(SHARD_CONFIG.CAPACITY_CHECK_TIMEOUT)
    }));

    if (!response.ok) {
      throw new Error(`Capacity check failed: HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Initialize new shard with metadata
   */
  private async initializeShard(
    stub: DurableObjectStub,
    conversationId: string,
    shardIndex: number
  ): Promise<void> {

    const response = await stub.fetch(new Request('https://shard/initialize', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        shardIndex,
        createdAt: Date.now(),
        maxConnections: SHARD_CONFIG.CONNECTIONS_PER_SHARD
      }),
      headers: { 'Content-Type': 'application/json' }
    }));

    if (!response.ok) {
      throw new Error(`Shard initialization failed: HTTP ${response.status}`);
    }
  }

  /**
   * Get Durable Object stub for specific shard
   */
  private getShardStub(conversationId: string, shardIndex: number): DurableObjectStub {
    const shardId = `${conversationId}_shard-${shardIndex}`;
    const id = this.env.CONVERSATION_ROOM.idFromName(shardId);
    return this.env.CONVERSATION_ROOM.get(id);
  }

  /**
   * Update local cache with shard metadata
   */
  private updateShardCache(
    conversationId: string,
    shardIndex: number,
    capacity: { connectionCount: number }
  ): void {

    const shards = this.shardCache.get(conversationId) || [];
    const existingShard = shards.find(s => s.index === shardIndex);

    if (existingShard) {
      existingShard.connectionCount = capacity.connectionCount;
      existingShard.lastChecked = Date.now();
    } else {
      shards.push({
        index: shardIndex,
        connectionCount: capacity.connectionCount,
        lastChecked: Date.now(),
        status: 'active'
      });
    }

    this.shardCache.set(conversationId, shards);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Type definitions
interface ShardMetadata {
  index: number;
  connectionCount: number;
  lastChecked: number;
  status: 'active' | 'full' | 'draining' | 'failed';
}
```

---

### 2. Enhanced ConversationRoom (Modified)

**Location**: `src/durable-objects/ConversationRoom.ts` (Modifications)

```typescript
export class ConversationRoom implements DurableObject {
  // ... existing code ...

  // NEW: Shard-specific metadata
  private shardIndex: number = 0;
  private shardId: string = '';
  private maxConnectionsForShard: number = 10_000;

  // NEW: Initialize shard metadata
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle shard initialization
    if (url.pathname === '/initialize') {
      return this.handleShardInitialization(request);
    }

    // Handle capacity check (RPC endpoint)
    if (url.pathname === '/capacity-check') {
      return this.handleCapacityCheck(request);
    }

    // ... existing WebSocket and API handling ...
  }

  /**
   * RPC Endpoint: Check if shard can accept connections
   */
  private async handleCapacityCheck(_request: Request): Promise<Response> {
    const connectionCount = this.connections.size;
    const hasCapacity = connectionCount < this.maxConnectionsForShard;

    return new Response(JSON.stringify({
      hasCapacity,
      connectionCount,
      shardIndex: this.shardIndex,
      maxConnections: this.maxConnectionsForShard,
      utilizationPercent: (connectionCount / this.maxConnectionsForShard) * 100
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Initialize shard with metadata
   */
  private async handleShardInitialization(request: Request): Promise<Response> {
    try {
      const { conversationId, shardIndex, maxConnections } = await request.json();

      this.conversationId = conversationId;
      this.shardIndex = shardIndex;
      this.shardId = `${conversationId}_shard-${shardIndex}`;
      this.maxConnectionsForShard = maxConnections;

      // Persist metadata to storage
      await this.state.storage.put('shardMetadata', {
        conversationId,
        shardIndex,
        shardId: this.shardId,
        maxConnections,
        initializedAt: Date.now()
      });

      console.log(` Shard initialized: ${this.shardId}`);

      return new Response(JSON.stringify({ success: true, shardId: this.shardId }));
    } catch (error) {
      console.error(' Shard initialization failed:', error);
      return new Response(JSON.stringify({ error: 'Initialization failed' }), { status: 500 });
    }
  }

  // MODIFIED: Update connection limit check
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // ... existing auth code ...

    // Check shard-specific connection limit
    if (this.connections.size >= this.maxConnectionsForShard) {
      console.warn(` Shard ${this.shardId} at capacity: ${this.connections.size}/${this.maxConnectionsForShard}`);
      return new Response('Shard at capacity - please retry', { status: 503 });
    }

    // ... existing connection handling ...
  }

  // NEW: Restore shard metadata from storage
  private async initializeFromStorage(): Promise<void> {
    try {
      // Restore shard metadata
      const shardMetadata = await this.state.storage.get('shardMetadata') as any;
      if (shardMetadata) {
        this.conversationId = shardMetadata.conversationId;
        this.shardIndex = shardMetadata.shardIndex;
        this.shardId = shardMetadata.shardId;
        this.maxConnectionsForShard = shardMetadata.maxConnections;
      }

      // ... existing restoration code ...
    } catch (error) {
      console.error(' Shard metadata restoration error:', error);
    }
  }
}
```

---

### 3. Worker Entry Point Integration

**Location**: `src/index.ts` (Modifications)

```typescript
// Import new sharding service
import { ConversationShardingService } from './services/conversation-sharding-service';

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket connection for conversation
    if (url.pathname === '/api/websocket/conversation') {
      const conversationId = url.searchParams.get('conversationId');
      const token = url.searchParams.get('token');

      if (!conversationId || !token) {
        return new Response('Missing required parameters', { status: 400 });
      }

      // Use sharding service to find available shard
      const shardingService = new ConversationShardingService(env);

      try {
        const shard = await shardingService.getAvailableShardForConversation(conversationId);

        if (!shard) {
          return new Response('No available shard', { status: 503 });
        }

        // Forward request to selected shard
        return shard.fetch(request);

      } catch (error) {
        console.error(' Sharding error:', error);
        return new Response('Service temporarily unavailable', { status: 503 });
      }
    }

    // ... existing routes ...
  }
};
```

---

##  Shard Distribution Strategy

### Load Balancing Algorithm

```typescript
/**
 * Shard Selection Priority:
 *
 * 1. Existing active shards with <80% capacity (preferred)
 * 2. Existing shards with <100% capacity
 * 3. Create new shard (if not at MAX_SHARDS limit)
 * 4. Reject connection (all shards full)
 */

// Pseudo-code
function selectShard(conversationId: string): Shard {
  const shards = getActiveShardsForConversation(conversationId);

  // Priority 1: Under 80% capacity (optimal)
  const optimalShard = shards.find(s => s.utilization < 0.8);
  if (optimalShard) return optimalShard;

  // Priority 2: Any available capacity
  const availableShard = shards.find(s => s.utilization < 1.0);
  if (availableShard) return availableShard;

  // Priority 3: Create new shard
  if (shards.length < MAX_SHARDS) {
    return createNewShard(conversationId, shards.length);
  }

  // Priority 4: Reject
  throw new Error('All shards full');
}
```

### Capacity Planning

| Scenario | Shards Active | Total Capacity | Notes |
|----------|---------------|----------------|-------|
| Normal Operation | 1-2 | 20,000 | Most conversations |
| High Traffic Event | 3-4 | 40,000 | Black Friday, launches |
| Viral Event | 5 (max) | 50,000 | Absolute maximum |

---

##  Message Broadcasting Across Shards

### Challenge: Cross-Shard Communication

When a message is sent to a conversation with multiple shards, **all shards must receive the message** to broadcast to their respective clients.

### Solution: Coordinator Pattern

```
┌─────────────────────────────────────────────────────────────┐
│ Cross-Shard Message Broadcasting │
├─────────────────────────────────────────────────────────────┤
│ │
│  Client sends message │
│ │                                                     │
│ ▼                                                     │
│  ┌──────────────────┐ │
│  │ Shard-0 receives │ Message received │
│  └──────────────────┘ │
│ │                                                     │
│ ├──► Broadcasts to own connections (3,000 clients) │
│ │                                                     │
│ └──► Notifies MessageBroadcaster DO │
│ │                                        │
│ ▼                                        │
│ ┌────────────────────────────┐ │
│ │  MessageBroadcaster DO │  Coordination │
│ │  (Global Event Hub) │                       │
│ └────────────────────────────┘ │
│ │                                        │
│ ┌────────────┼────────────┬──────────────┐ │
│ ▼            ▼ ▼              ▼ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Shard-1  │  │ Shard-2  │  │ Shard-3  │  │ Shard-4  │ │
│  │ 8,000 │  │ 7,500 │  │ 0 (idle) │  │ 0 (idle) │ │
│  │ clients  │  │ clients  │  │ │  │ │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│ │             │ │
│ └─────────────┴──► Broadcast to all connections │
│ │
│  Total: 18,500 clients receive message │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// In ConversationRoom (sending shard)
async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage) {
  // ... existing logic ...

  // Notify MessageBroadcaster for cross-shard distribution
  if (this.shardIndex === 0) { // Only shard-0 coordinates
    await this.broadcastToAllShards(event);
  }

  // Broadcast to own connections
  await this.broadcastEvent(event);
}

private async broadcastToAllShards(event: DurableObjectEvent): Promise<void> {
  // Get MessageBroadcaster stub
  const broadcasterId = this.env.MESSAGE_BROADCASTER.idFromName('global');
  const broadcasterStub = this.env.MESSAGE_BROADCASTER.get(broadcasterId);

  // Request broadcast to all shards
  await broadcasterStub.fetch(new Request('https://broadcaster/shard-broadcast', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: this.conversationId,
      event,
      excludeShardIndex: this.shardIndex // Don't re-broadcast to self
    }),
    headers: { 'Content-Type': 'application/json' }
  }));
}
```

---

##  Performance Optimization

### Caching Strategy

```typescript
// In-memory shard cache (Worker-level)
class ShardCache {
  private cache: Map<string, CachedShardInfo> = new Map();
  private readonly TTL = 60_000; // 1 minute

  get(conversationId: string): CachedShardInfo | null {
    const cached = this.cache.get(conversationId);

    if (!cached || Date.now() - cached.timestamp > this.TTL) {
      return null; // Expired
    }

    return cached;
  }

  set(conversationId: string, shards: ShardMetadata[]): void {
    this.cache.set(conversationId, {
      shards,
      timestamp: Date.now()
    });
  }
}
```

### Latency Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Shard Selection | <20ms | 50ms |
| Capacity Check (RPC) | <10ms | 30ms |
| WebSocket Handshake | <100ms | 200ms |
| Cross-Shard Broadcast | <50ms | 100ms |

---

##  Testing Strategy

### Phase 1: Unit Tests

```typescript
// tests/unit/sharding/shard-selection.test.ts
describe('ConversationShardingService', () => {
  test('selects first available shard under capacity', async () => {
    const service = new ConversationShardingService(mockEnv);
    const shard = await service.getAvailableShardForConversation('conv-test');

    expect(shard).toBeDefined();
    expect(await checkShardIndex(shard)).toBe(0);
  });

  test('creates new shard when all existing are full', async () => {
    // Setup: Fill shard-0 to capacity
    await fillShardToCapacity('conv-test', 0, 10_000);

    const service = new ConversationShardingService(mockEnv);
    const shard = await service.getAvailableShardForConversation('conv-test');

    expect(await checkShardIndex(shard)).toBe(1);
  });

  test('throws error when all 5 shards are full', async () => {
    // Fill all shards
    for (let i = 0; i < 5; i++) {
      await fillShardToCapacity('conv-test', i, 10_000);
    }

    const service = new ConversationShardingService(mockEnv);

    await expect(
      service.getAvailableShardForConversation('conv-test')
    ).rejects.toThrow('All shards full');
  });
});
```

### Phase 2: Load Tests

```typescript
// tests/load/sharding-load.test.ts
describe('Sharding Load Test', () => {
  test('handles 50,000 concurrent connections', async () => {
    const conversationId = 'load-test-conv';
    const connections: WebSocket[] = [];

    // Connect 50,000 clients
    for (let i = 0; i < 50_000; i++) {
      const ws = await connectToConversation(conversationId);
      connections.push(ws);

      if (i % 1000 === 0) {
        console.log(`Connected: ${i + 1}/50,000`);
      }
    }

    expect(connections.length).toBe(50_000);

    // Verify shard distribution
    const shardStats = await getShardStatistics(conversationId);
    expect(shardStats.activeShards).toBe(5);
    expect(shardStats.totalConnections).toBe(50_000);

    // Cleanup
    await Promise.all(connections.map(ws => ws.close()));
  });

  test('message broadcast reaches all 50,000 clients', async () => {
    // ... setup 50,000 connections across shards ...

    const startTime = Date.now();
    const messageId = crypto.randomUUID();

    // Send message from one client
    await connections[0].send(JSON.stringify({
      type: 'message',
      data: { content: 'Test broadcast', messageId }
    }));

    // Wait for all clients to receive
    const receiptPromises = connections.map(ws =>
      waitForMessage(ws, messageId, 5000)
    );

    const results = await Promise.allSettled(receiptPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const latency = Date.now() - startTime;

    expect(successCount).toBeGreaterThan(49_500); // 99% success rate
    expect(latency).toBeLessThan(2000); // <2 seconds for 50K clients
  });
});
```

---

##  Implementation Roadmap

### Week 1: Foundation (Days 1-5)

**Day 1-2: Infrastructure Setup**
- [ ] Create `ConversationShardingService` class
- [ ] Add shard metadata types to `types/websocket-types.ts`
- [ ] Set up unit test framework for sharding

**Day 3-4: Core Algorithm**
- [ ] Implement `getAvailableShardForConversation()`
- [ ] Implement shard capacity checking (RPC)
- [ ] Add shard caching mechanism

**Day 5: Integration**
- [ ] Modify `ConversationRoom` to support shard metadata
- [ ] Add `/capacity-check` and `/initialize` endpoints
- [ ] Unit tests for core sharding logic

**Milestone**:  Basic sharding logic functional in isolated tests

---

### Week 2: ConversationRoom Enhancement (Days 6-10)

**Day 6-7: DO Modifications**
- [ ] Update `ConversationRoom.constructor()` to load shard metadata
- [ ] Modify connection limit checks to use shard-specific limits
- [ ] Add shard ID to all log messages

**Day 8-9: Cross-Shard Messaging**
- [ ] Implement `broadcastToAllShards()` in ConversationRoom
- [ ] Update MessageBroadcaster to handle shard-aware routing
- [ ] Add `/shard-broadcast` endpoint to MessageBroadcaster

**Day 10: Testing**
- [ ] Integration tests for multi-shard conversations
- [ ] Test message broadcasting across 2-3 shards
- [ ] Verify connection distribution

**Milestone**:  Multi-shard messaging working in dev environment

---

### Week 3: Load Testing & Optimization (Days 11-15)

**Day 11-12: Load Test Infrastructure**
- [ ] Create load test scripts (1K, 5K, 10K connections)
- [ ] Set up monitoring and metrics collection
- [ ] Establish baseline performance metrics

**Day 13-14: Performance Testing**
- [ ] Test 10,000 connections on single shard
- [ ] Test 20,000 connections across 2 shards
- [ ] Test 50,000 connections across 5 shards
- [ ] Identify and fix bottlenecks

**Day 15: Optimization**
- [ ] Optimize shard selection algorithm
- [ ] Fine-tune cache TTL values
- [ ] Reduce RPC call overhead

**Milestone**:  Successfully handle 50,000 concurrent connections

---

### Week 4: Production Readiness (Days 16-20)

**Day 16-17: Monitoring & Observability**
- [ ] Add shard metrics to `/metrics` endpoint
- [ ] Create monitoring dashboard (Grafana/custom)
- [ ] Set up alerts for shard capacity warnings

**Day 18: Documentation**
- [ ] Update API documentation
- [ ] Write operations runbook
- [ ] Create migration guide for existing deployments

**Day 19: Deployment Preparation**
- [ ] Create feature flag for gradual rollout
- [ ] Set up A/B testing infrastructure
- [ ] Prepare rollback procedures

**Day 20: Production Deployment**
- [ ] Deploy to staging environment
- [ ] Run full integration tests
- [ ] Deploy to production (5% → 25% → 100%)

**Milestone**:  Sharding system live in production

---

##  Success Metrics

### Technical KPIs

| Metric | Baseline (Current) | Target (With Sharding) |
|--------|-------------------|------------------------|
| Max Concurrent Connections | ~100-1,000 | 50,000 |
| Shard Selection Latency | N/A | <20ms (p50), <50ms (p99) |
| Message Broadcast Latency | ~50ms | <100ms for 50K clients |
| Connection Success Rate | 99% | 99.5% |
| System Availability | 99.0% | 99.9% |

### Business KPIs

- **Support 10x growth** in customer base without infrastructure changes
- **Zero downtime** during high-traffic events (Black Friday, product launches)
- **Reduce infrastructure costs** by 30% through efficient resource utilization

---

##  Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Shard Routing Failure** | Medium | High | Implement retry logic with exponential backoff + circuit breaker |
| **Cross-Shard Broadcast Latency** | Medium | Medium | Use MessageBroadcaster batch processing + prioritize low-latency path |
| **Cache Inconsistency** | Low | Medium | Short TTL (60s) + fallback to RPC on cache miss |
| **Memory Exhaustion** | Low | High | Set hard limits per shard (10K connections) + monitoring alerts |
| **Split Brain Scenario** | Very Low | High | Coordinator pattern (shard-0 as master) + eventual consistency |

---

##  References

### Internal Documentation
- `CLAUDE.md` - Project architecture overview
- `src/durable-objects/ConversationRoom.ts` - Current implementation
- `src/services/websocket-broadcast-service.ts` - Existing broadcast system

### External References
- [Cloudflare Durable Objects Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [TechStack Pubsub Implementation](TechStack/pubsub/src/durable-objects/topic.ts)
- [MQTT QoS Levels](https://www.hivemq.com/blog/mqtt-essentials-part-6-mqtt-quality-of-service-levels/)

---

##  Future Enhancements (Post-MVP)

### Phase 2: Advanced Features

1. **Dynamic Shard Rebalancing**
   - Automatically redistribute connections when load decreases
   - Drain and decommission unused shards
   - Cost optimization through resource efficiency

2. **Geographic Sharding**
   - Route connections to nearest edge location
   - Reduce latency for global users
   - Regulatory compliance (data residency)

3. **Predictive Scaling**
   - ML-based prediction of traffic spikes
   - Pre-create shards before events
   - Proactive capacity planning

4. **Advanced Monitoring**
   - Real-time shard health dashboard
   - Anomaly detection (unusual load patterns)
   - Automated performance tuning

---

##  Checklist for Implementation

### Pre-Implementation
- [ ] Review and approve this design document
- [ ] Allocate development resources (2 engineers, 4 weeks)
- [ ] Set up test environment with DO debugging tools
- [ ] Create project tracking board

### Implementation
- [ ] Complete Week 1 tasks (Foundation)
- [ ] Complete Week 2 tasks (DO Enhancement)
- [ ] Complete Week 3 tasks (Load Testing)
- [ ] Complete Week 4 tasks (Production)

### Post-Implementation
- [ ] Conduct post-mortem review
- [ ] Document lessons learned
- [ ] Plan Phase 2 enhancements
- [ ] Knowledge transfer to operations team

---

##  Contact & Support

**Technical Lead**: Development Team
**Architecture Review**: System Architects
**Questions**: File issue in project repository

---

**Document Status**:  Ready for Implementation
**Last Updated**: 2025-10-28
**Next Review**: After Week 2 Milestone
