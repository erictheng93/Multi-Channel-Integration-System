---
name: handlers
description: "Skill for the Handlers area of Multi-Channel-Integration-System. 147 symbols across 41 files."
---

# Handlers

147 symbols | 41 files | Cohesion: 65%

## When to Use

- Working with code in `src/`
- Understanding how globalErrorHandler, storeCredential, clearPlatformCredentials work
- Modifying handlers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/modules/realtime/handlers/event-handler.ts` | recordEvent, sendMessageEvent, sendTypingEvent, sendStatusEvent, sendAssignmentEvent (+15) |
| `src/modules/realtime/handlers/realtime-main.ts` | getInstance, updateConfig, getConfig, getConversationStatus, getConfig (+4) |
| `src/durable-objects/handlers/broadcaster-http-handlers.ts` | toQueuedEvent, adminPromises, handleBroadcastGlobal, handleBatchBroadcast, handleBroadcastToTeams (+4) |
| `src/modules/activities/services/TeamActivityService.ts` | logTeamCreate, logTeamUpdate, logTeamDelete, logMemberAdd, logMemberRemove (+3) |
| `src/modules/auth/handlers/credentials.ts` | storeCredential, clearPlatformCredentials, backupCredentials, decrypt, getEncryptionKey (+2) |
| `src/modules/tags/services/tag-service.ts` | isValidHexColor, normalizeHexColor, logTagActivity, create, update (+2) |
| `src/modules/teams/services/activity-service.ts` | logTeamCreate, logTeamUpdate, logTeamDelete, logMemberAdd, logMemberRemove (+1) |
| `src/modules/queue/handlers/line-message-queue.ts` | processBatch, processMediaMessage, handleLineMessageQueue, processMessage, updateMessageStatus (+1) |
| `src/modules/activities/handlers/ActivityHandler.ts` | constructor, getOverview, getHeatmap, getMetrics, getResourceStats |
| `src/modules/activities/services/ActivityStatsService.ts` | ActivityStatsService, getOverview, getActivityHeatmap, getPerformanceMetrics, getResourceTypeStats |

## Entry Points

Start here when exploring this area:

- **`globalErrorHandler`** (Function) — `src/middleware/error-handler.ts:120`
- **`storeCredential`** (Function) — `src/modules/auth/handlers/credentials.ts:84`
- **`clearPlatformCredentials`** (Function) — `src/modules/auth/handlers/credentials.ts:251`
- **`backupCredentials`** (Function) — `src/modules/auth/handlers/credentials.ts:306`
- **`processLineFollowEvent`** (Function) — `src/modules/integrations/handlers/line-follow-handler.ts:29`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ActivityService` | Class | `src/modules/activities/services/ActivityService.ts` | 26 |
| `ActivityStatsService` | Class | `src/modules/activities/services/ActivityStatsService.ts` | 27 |
| `EventQueueService` | Class | `src/modules/realtime/services/event-queue-service.ts` | 40 |
| `DashboardService` | Class | `src/modules/analytics/services/dashboard-service.ts` | 85 |
| `globalErrorHandler` | Function | `src/middleware/error-handler.ts` | 120 |
| `storeCredential` | Function | `src/modules/auth/handlers/credentials.ts` | 84 |
| `clearPlatformCredentials` | Function | `src/modules/auth/handlers/credentials.ts` | 251 |
| `backupCredentials` | Function | `src/modules/auth/handlers/credentials.ts` | 306 |
| `processLineFollowEvent` | Function | `src/modules/integrations/handlers/line-follow-handler.ts` | 29 |
| `processLineUnfollowEvent` | Function | `src/modules/integrations/handlers/line-follow-handler.ts` | 520 |
| `getUnifiedStats` | Function | `src/modules/queue/handlers/queue-monitor.ts` | 49 |
| `getHealthCheck` | Function | `src/modules/queue/handlers/queue-monitor.ts` | 97 |
| `getPerformanceMetrics` | Function | `src/modules/queue/handlers/queue-monitor.ts` | 121 |
| `maintenanceOperations` | Function | `src/modules/queue/handlers/queue-monitor.ts` | 147 |
| `sendMessageEvent` | Function | `src/modules/realtime/handlers/event-handler.ts` | 239 |
| `sendTypingEvent` | Function | `src/modules/realtime/handlers/event-handler.ts` | 285 |
| `sendStatusEvent` | Function | `src/modules/realtime/handlers/event-handler.ts` | 332 |
| `sendAssignmentEvent` | Function | `src/modules/realtime/handlers/event-handler.ts` | 378 |
| `sendNotificationEvent` | Function | `src/modules/realtime/handlers/event-handler.ts` | 433 |
| `sendSystemEvent` | Function | `src/modules/realtime/handlers/event-handler.ts` | 481 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ProcessLineFollowEvent → OutputStructured` | cross_community | 7 |
| `Facebook → GetMigrationConfig` | cross_community | 7 |
| `ProcessMessage → GetMigrationConfig` | cross_community | 7 |
| `ProcessMessage → BroadcastToConversationRooms` | cross_community | 7 |
| `ProcessLineFollowEvent → NowISO` | cross_community | 6 |
| `Facebook → ShouldBatch` | cross_community | 6 |
| `Facebook → RecordImmediateEvent` | cross_community | 6 |
| `ProcessMessage → ShouldBatch` | cross_community | 6 |
| `ProcessMessage → RecordImmediateEvent` | cross_community | 6 |
| `RealtimeDashboardHandler → IsRecord` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 97 calls |
| Middleware | 44 calls |
| Health-checkers | 4 calls |
| Line-modules | 2 calls |
| Integrations | 1 calls |

## How to Explore

1. `gitnexus_context({name: "globalErrorHandler"})` — see callers and callees
2. `gitnexus_query({query: "handlers"})` — find related execution flows
3. Read key files listed above for implementation details
