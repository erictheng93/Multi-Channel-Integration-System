---
name: durable-objects
description: "Skill for the Durable-objects area of Multi-Channel-Integration-System. 118 symbols across 20 files."
---

# Durable-objects

118 symbols | 20 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how cancelMessage, formatFileSize, createFileFlexMessage work
- Modifying durable-objects-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | isAlreadyExistsError, executeDeployment, runStep, handleDeploymentError, cancelDeployment (+19) |
| `src/durable-objects/UserConnection.ts` | fetch, handleConnectToConversation, handleDisconnectFromConversation, handleSubscribe, handleUnsubscribe (+13) |
| `src/durable-objects/CustomerConversationDO.ts` | generateConnectionId, validateSession, clientConnected, clientConnectedValidated, webSocketMessage (+6) |
| `src/durable-objects/DelayedMessageScheduler.ts` | handleSchedule, handleCancel, handleStatus, jsonResponse, badRequestResponse (+6) |
| `src/durable-objects/RateLimiterDO.ts` | constructor, handleCleanup, loadFromStorage, persistToStorage, cleanupExpiredEntries (+6) |
| `src/durable-objects/MetricsCollectorDO.ts` | constructor, ensureAlarm, fetch, handleReset, persistToStorage (+5) |
| `src/durable-objects/LatestMessageCacheCoordinator.ts` | saveState, fetch, handleScheduleUpdate, handleManualAlarmTrigger, alarm (+4) |
| `src/durable-objects/user-subscription-manager.ts` | registerWithMessageBroadcaster, idFromName, get, unregisterFromMessageBroadcaster |
| `src/durable-objects/CustomerMessageDO.ts` | validateSession, setupRoutes, fetch |
| `web-installer/backend/src/services/CloudflareAPI.ts` | createKVNamespace, listKVNamespaces |

## Entry Points

Start here when exploring this area:

- **`cancelMessage`** (Function) — `src/durable-objects/delayed-message/schedule-manager.ts:147`
- **`formatFileSize`** (Function) — `src/utils/line-modules/line-flex-builders.ts:139`
- **`createFileFlexMessage`** (Function) — `src/utils/line-modules/line-flex-builders.ts:158`
- **`LatestMessageCache`** (Class) — `src/services/latest-message-cache.ts:42`
- **`executeDeployment`** (Method) — `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts:218`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `LatestMessageCache` | Class | `src/services/latest-message-cache.ts` | 42 |
| `cancelMessage` | Function | `src/durable-objects/delayed-message/schedule-manager.ts` | 147 |
| `formatFileSize` | Function | `src/utils/line-modules/line-flex-builders.ts` | 139 |
| `createFileFlexMessage` | Function | `src/utils/line-modules/line-flex-builders.ts` | 158 |
| `executeDeployment` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 218 |
| `runStep` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 274 |
| `handleDeploymentError` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 342 |
| `cancelDeployment` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 459 |
| `log` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 485 |
| `updateState` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 502 |
| `sleep` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 512 |
| `stepInitialize` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 543 |
| `stepCreateD1` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 549 |
| `stepCreateKVSession` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 571 |
| `stepCreateKVCache` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 593 |
| `stepCreateR2` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 615 |
| `stepCreateQueue` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 633 |
| `stepRunMigrations` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 657 |
| `stepGenerateConfig` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 666 |
| `stepBuildFrontend` | Method | `web-installer/backend/src/durable-objects/DeploymentOrchestrator.ts` | 763 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Fetch → NowMs` | cross_community | 6 |
| `Fetch → HandleSubscribeMessage` | cross_community | 5 |
| `Fetch → HandleUnsubscribeMessage` | cross_community | 5 |
| `Fetch → UpdateUserState` | cross_community | 5 |
| `Fetch → NowISO` | cross_community | 5 |
| `Fetch → ScheduleDOUpdate` | cross_community | 5 |
| `Constructor → Sleep` | cross_community | 5 |
| `Constructor → NowMs` | cross_community | 5 |
| `Constructor → GroupEventsByTarget` | cross_community | 5 |
| `ExecuteDeployment → IsTestEnvironment` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 57 calls |
| Delayed-message | 6 calls |
| Line-modules | 3 calls |

## How to Explore

1. `gitnexus_context({name: "cancelMessage"})` — see callers and callees
2. `gitnexus_query({query: "durable-objects"})` — find related execution flows
3. Read key files listed above for implementation details
