# Test Migration Plan

**Generated:** 2025-11-18
**Goal:** Migrate 50% of tests to use MockFactory
**Total files to migrate:** 70

## Summary

| Category | Count |
|----------|-------|
| Unit | 58 |
| Integration | 10 |
| Module | 2 |

## Migration Batches

### Batch 1

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 1 | tests\modules\session\unit\handlers\session-boundary.test.ts | Unit | 92.0 | 4/10 |
| 2 | tests\unit\handlers\delayed-message-main.test.ts | Unit | 92.0 | 4/10 |
| 3 | tests\unit\handlers\system-main.test.ts | Unit | 92.0 | 4/10 |
| 4 | tests\unit\handlers\auth-main.test.ts | Unit | 90.0 | 5/10 |
| 5 | tests\unit\handlers\conversation-edge-cases.test.ts | Unit | 90.0 | 5/10 |
| 6 | tests\unit\handlers\conversation.test.ts | Unit | 90.0 | 5/10 |
| 7 | tests\unit\handlers\delayed-message-drizzle.test.ts | Unit | 88.0 | 6/10 |
| 8 | tests\modules\session\unit\services\boundary-detection.test.ts | Unit | 87.0 | 4/10 |
| 9 | tests\unit\services\permission-edge-cases.test.ts | Unit | 87.0 | 4/10 |
| 10 | tests\modules\session\unit\handlers\session-main.test.ts | Unit | 86.0 | 7/10 |

### Batch 2

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 11 | tests\modules\session\unit\services\session-service.test.ts | Unit | 83.0 | 6/10 |
| 12 | tests\unit\handlers\message.test.ts | Unit | 82.0 | 9/10 |
| 13 | tests\unit\modules\file-management\utils\error-handler.test.ts | Unit | 82.0 | 4/10 |
| 14 | tests\unit\utils\line-error-handling.test.ts | Unit | 82.0 | 4/10 |
| 15 | tests\unit\utils\line.test.ts | Unit | 82.0 | 3/10 |
| 16 | tests\unit\services\analytics-core.test.ts | Unit | 81.0 | 3/10 |
| 17 | tests\unit\services\permission-performance.test.ts | Unit | 81.0 | 3/10 |
| 18 | tests\unit\services\permission.test.ts | Unit | 81.0 | 3/10 |
| 19 | tests\integration\handlers\customer-integration.test.ts | Integration | 80.0 | 3/10 |
| 20 | tests\integration\handlers\team-integration.test.ts | Integration | 80.0 | 3/10 |

### Batch 3

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 21 | tests\unit\handlers\conversation-integration.test.ts | Unit | 80.0 | 10/10 |
| 22 | tests\unit\handlers\conversation-main.test.ts | Unit | 80.0 | 10/10 |
| 23 | tests\unit\handlers\conversation-performance.test.ts | Unit | 80.0 | 10/10 |
| 24 | tests\unit\handlers\message-edge-cases.test.ts | Unit | 80.0 | 10/10 |
| 25 | tests\unit\handlers\message-integration.test.ts | Unit | 80.0 | 10/10 |
| 26 | tests\unit\handlers\message-performance.test.ts | Unit | 80.0 | 10/10 |
| 27 | tests\unit\handlers\team-main.test.ts | Unit | 80.0 | 10/10 |
| 28 | tests\unit\handlers\webhook.test.ts | Unit | 80.0 | 10/10 |
| 29 | tests\unit\handlers\auth-role-validation.test.ts | Unit | 78.0 | 1/10 |
| 30 | tests\unit\handlers\customer-main.test.ts | Unit | 78.0 | 1/10 |

### Batch 4

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 31 | tests\unit\handlers\team-role-access-control.test.ts | Unit | 78.0 | 1/10 |
| 32 | tests\integration\handlers\tag-integration.test.ts | Integration | 76.0 | 2/10 |
| 33 | tests\unit\utils\auth.test.ts | Unit | 76.0 | 2/10 |
| 34 | tests\unit\services\channel-service.test.ts | Unit | 75.0 | 10/10 |
| 35 | tests\unit\services\permission-integration.test.ts | Unit | 75.0 | 2/10 |
| 36 | tests\integration\handlers\auth-integration.test.ts | Integration | 74.0 | 2/10 |
| 37 | tests\unit\utils\line-integration.test.ts | Unit | 74.0 | 2/10 |
| 38 | tests\unit\composables\composables-edge-cases.test.ts | Unit | 72.0 | 4/10 |
| 39 | tests\unit\composables\composables-performance.test.ts | Unit | 72.0 | 4/10 |
| 40 | tests\unit\durable-objects\Week34-Optimizations.test.ts | Unit | 72.0 | 4/10 |

### Batch 5

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 41 | tests\unit\durable-objects\MessageBroadcaster.test.ts | Unit | 70.0 | 5/10 |
| 42 | tests\unit\handlers\customer-main-refactored.test.ts | Unit | 70.0 | 1/10 |
| 43 | tests\unit\modules\realtime\realtime-main.test.ts | Unit | 70.0 | 5/10 |
| 44 | tests\integration\handlers\conversation-handler-integration.test.ts | Integration | 68.0 | 2/10 |
| 45 | tests\unit\durable-objects\ConversationRoom.test.ts | Unit | 68.0 | 6/10 |
| 46 | tests\unit\durable-objects\CustomerMessageDO.test.ts | Unit | 68.0 | 6/10 |
| 47 | tests\integration\handlers\conversation-sse-streaming.test.ts | Integration | 66.0 | 1/10 |
| 48 | tests\integration\handlers\conversation-websocket-integration.test.ts | Integration | 66.0 | 1/10 |
| 49 | tests\unit\composables\composables-integration.test.ts | Unit | 66.0 | 3/10 |
| 50 | tests\unit\composables\useAuthStore.test.ts | Unit | 66.0 | 2/10 |

### Batch 6

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 51 | tests\unit\composables\useError.test.ts | Unit | 66.0 | 3/10 |
| 52 | tests\unit\durable-objects\DelayedMessageScheduler.test.ts | Unit | 66.0 | 7/10 |
| 53 | tests\unit\modules\activities\activity-service.test.ts | Unit | 66.0 | 3/10 |
| 54 | tests\unit\stores\auth-role-system.test.ts | Unit | 66.0 | 2/10 |
| 55 | tests\modules\conversations\conversations.test.ts | Module | 65.0 | 5/10 |
| 56 | tests\modules\error-handling\error-handling.test.ts | Module | 65.0 | 3/10 |
| 57 | tests\unit\modules\file-management\services\validation-service.test.ts | Unit | 65.0 | 0/10 |
| 58 | tests\unit\services\conversation-sharding-service.test.ts | Unit | 65.0 | 1/10 |
| 59 | tests\unit\services\cross-shard-broadcasting.test.ts | Unit | 65.0 | 1/10 |
| 60 | tests\integration\handlers\conversation-permissions.test.ts | Integration | 64.0 | 1/10 |

### Batch 7

| # | File | Category | Priority | Complexity |
|---|------|----------|----------|------------|
| 61 | tests\unit\durable-objects\LatestMessageCacheCoordinator.test.ts | Unit | 64.0 | 8/10 |
| 62 | tests\unit\modules\realtime\performance-monitor.test.ts | Unit | 64.0 | 2/10 |
| 63 | tests\unit\utils\facebook-integration.test.ts | Unit | 64.0 | 1/10 |
| 64 | tests\unit\utils\facebook.test.ts | Unit | 64.0 | 1/10 |
| 65 | tests\unit\utils\line-signature.test.ts | Unit | 64.0 | 1/10 |
| 66 | tests\unit\auth\database-query-optimization.test.ts | Unit | 62.0 | 2/10 |
| 67 | tests\unit\modules\integrations\webhook-security.test.ts | Unit | 62.0 | 2/10 |
| 68 | tests\integration\handlers\conversation-concurrent-tests.test.ts | Integration | 60.0 | 1/10 |
| 69 | tests\integration\handlers\conversation-load-tests.test.ts | Integration | 60.0 | 1/10 |
| 70 | tests\unit\composables\useConversationsStore.test.ts | Unit | 60.0 | 2/10 |

## Migration Steps

1. **Import MockFactory**:
   ```typescript
   import { MockFactory } from '@helpers/mockFactory';
   ```

2. **Replace manual mocks**:
   ```typescript
   // Before
   const mockEnv = { DB: ..., SESSION_CACHE: ..., ... };

   // After
   const mockEnv = MockFactory.createEnv();
   ```

3. **Run tests** to verify migration

4. **Commit** the changes

