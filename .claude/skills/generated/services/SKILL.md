---
name: services
description: "Skill for the Services area of Multi-Channel-Integration-System. 1554 symbols across 278 files."
---

# Services

1554 symbols | 278 files | Cohesion: 68%

## When to Use

- Working with code in `src/`
- Understanding how loadQRCode, generateQRCode, updateTeamLocal work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/services/distributed-lock-service.ts` | tryLock, generateLockId, LockCoordinator, DistributedLockService, isAvailable (+22) |
| `src/services/message-batch-optimizer.ts` | optimizeBatch, calculatePriority, sortByPriority, deduplicateMessages, generateDeduplicationKey (+21) |
| `src/modules/analytics/services/dashboard-service.ts` | constructor, queryAnalytics, saveDashboardConfig, getDashboardData, createDashboardTemplate (+20) |
| `web-installer/backend/src/services/CloudflareAPI.ts` | request, createD1Database, listD1Databases, createR2Bucket, createQueue (+20) |
| `src/services/unified-cache-service.ts` | resetStats, buildKey, get, set, getOrSet (+19) |
| `frontend/src/services/websocketManager.ts` | connect, disconnect, destroy, isJoinedToConversation, sendMessage (+19) |
| `src/modules/analytics/services/period-comparison-service.ts` | getMetricValue, getTotalConversations, getActiveConversations, getClosedConversations, getAverageResolutionTime (+19) |
| `frontend/src/services/websocketClient.ts` | constructor, connect, disconnect, performPreConnectionChecks, buildWebSocketUrl (+18) |
| `src/services/connection-pool-manager.ts` | constructor, updateConnectionState, startBackgroundTasks, performHealthCheck, addConnection (+15) |
| `src/modules/session/services/session-service.ts` | create, get, update, delete, getOrCreate (+14) |

## Entry Points

Start here when exploring this area:

- **`loadQRCode`** (Function) — `frontend/src/stores/qrcode.ts:102`
- **`generateQRCode`** (Function) — `frontend/src/stores/qrcode.ts:174`
- **`updateTeamLocal`** (Function) — `frontend/src/stores/team.ts:448`
- **`createSession`** (Function) — `src/modules/auth/services/auth.ts:555`
- **`runComponentCheck`** (Function) — `src/modules/system/handlers/health-main.ts:131`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `MessageBroadcaster` | Class | `src/durable-objects/MessageBroadcaster.ts` | 33 |
| `RateLimiterDO` | Class | `src/durable-objects/RateLimiterDO.ts` | 70 |
| `UserConnection` | Class | `src/durable-objects/UserConnection.ts` | 42 |
| `UserConnectionStateManager` | Class | `src/durable-objects/user-connection-state.ts` | 37 |
| `LockCoordinator` | Class | `src/services/distributed-lock-service.ts` | 513 |
| `AnalyticsService` | Class | `src/modules/analytics/services/analytics-core.ts` | 92 |
| `QueryValidationError` | Class | `src/modules/analytics/types/analytics-types.ts` | 556 |
| `DataProcessingError` | Class | `src/modules/analytics/types/analytics-types.ts` | 563 |
| `FileManagementError` | Class | `src/modules/file-management/utils/error-handler.ts` | 63 |
| `SessionNotFoundError` | Class | `src/modules/session/types/session-types.ts` | 323 |
| `SessionOperationError` | Class | `src/modules/session/types/session-types.ts` | 337 |
| `MetricsCollector` | Class | `src/modules/analytics/services/metrics-collector.ts` | 36 |
| `CollaborationError` | Class | `src/modules/collaboration/types/collaboration-types.ts` | 315 |
| `AdapterNotInitializedError` | Class | `src/modules/collaboration/types/collaboration-types.ts` | 357 |
| `DistributedLockService` | Class | `src/services/distributed-lock-service.ts` | 65 |
| `AnalyticsError` | Class | `src/modules/analytics/types/analytics-types.ts` | 544 |
| `CustomerCrudService` | Class | `src/modules/customer/services/customer-crud.ts` | 26 |
| `CustomerSearchService` | Class | `src/modules/customer/services/customer-search.ts` | 26 |
| `CustomerStatsService` | Class | `src/modules/customer/services/customer-stats.ts` | 22 |
| `CustomerTagService` | Class | `src/modules/customer/services/customer-tags.ts` | 21 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddTagsToCustomer → Warn` | cross_community | 8 |
| `AddTagsToCustomer → NowISO` | cross_community | 8 |
| `AddTagsToCustomer → GetLevelEmoji` | cross_community | 8 |
| `RemoveTagsFromCustomer → Warn` | cross_community | 8 |
| `RemoveTagsFromCustomer → NowISO` | cross_community | 8 |
| `RemoveTagsFromCustomer → GetLevelEmoji` | cross_community | 8 |
| `SetCustomerTags → Warn` | cross_community | 8 |
| `SetCustomerTags → NowISO` | cross_community | 8 |
| `SetCustomerTags → GetLevelEmoji` | cross_community | 8 |
| `HealthCheck → GetMigrationConfig` | cross_community | 8 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Handlers | 46 calls |
| Middleware | 41 calls |
| Cluster_362 | 21 calls |
| Infrastructure | 19 calls |
| Durable-objects | 18 calls |
| Repositories | 18 calls |
| Config | 7 calls |
| Line-modules | 6 calls |

## How to Explore

1. `gitnexus_context({name: "loadQRCode"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
