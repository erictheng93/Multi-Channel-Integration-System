---
name: infrastructure
description: "Skill for the Infrastructure area of Multi-Channel-Integration-System. 43 symbols across 10 files."
---

# Infrastructure

43 symbols | 10 files | Cohesion: 59%

## When to Use

- Working with code in `src/`
- Understanding how StorageError, StorageService, ValidationService work
- Modifying infrastructure-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/modules/delayed-message/infrastructure/ValidationService.ts` | validateRecallPermission, validateDelayedMessageRequest, validateDelaySeconds, validatePlatform, validateMessageType (+7) |
| `src/modules/delayed-message/infrastructure/EventService.ts` | broadcastMessageRecalled, broadcastRecallFailed, truncateContent, broadcastCountdownUpdate, broadcastBatch (+5) |
| `src/modules/delayed-message/infrastructure/StorageService.ts` | getMessageById, updateMessageStatus, logOperation, mapToEntity, checkRecallable (+4) |
| `src/modules/delayed-message/services/MessageProcessorService.ts` | processQueueMessage, retryFailedMessage, constructor |
| `src/modules/delayed-message/services/MessageSchedulerService.ts` | updateMessageStatusAsync, cancelScheduledMessage, constructor |
| `src/modules/delayed-message/types/index.ts` | StorageError, ValidationError |
| `src/modules/delayed-message/controllers/DelayedMessageController.ts` | recallDelayedMessage |
| `src/modules/delayed-message/services/DelayedMessageManager.ts` | recallDelayedMessage |
| `src/modules/websocket/services/event-broadcaster.ts` | broadcastDelayedMessageEvent |
| `src/services/websocket-broadcast-service.ts` | broadcastDelayedMessageEvent |

## Entry Points

Start here when exploring this area:

- **`StorageError`** (Class) — `src/modules/delayed-message/types/index.ts:136`
- **`StorageService`** (Class) — `src/modules/delayed-message/infrastructure/StorageService.ts:32`
- **`ValidationService`** (Class) — `src/modules/delayed-message/infrastructure/ValidationService.ts:21`
- **`ValidationError`** (Class) — `src/modules/delayed-message/types/index.ts:129`
- **`getMessageById`** (Method) — `src/modules/delayed-message/infrastructure/StorageService.ts:69`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `StorageError` | Class | `src/modules/delayed-message/types/index.ts` | 136 |
| `StorageService` | Class | `src/modules/delayed-message/infrastructure/StorageService.ts` | 32 |
| `ValidationService` | Class | `src/modules/delayed-message/infrastructure/ValidationService.ts` | 21 |
| `ValidationError` | Class | `src/modules/delayed-message/types/index.ts` | 129 |
| `getMessageById` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 69 |
| `updateMessageStatus` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 91 |
| `logOperation` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 315 |
| `mapToEntity` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 335 |
| `processQueueMessage` | Method | `src/modules/delayed-message/services/MessageProcessorService.ts` | 55 |
| `retryFailedMessage` | Method | `src/modules/delayed-message/services/MessageProcessorService.ts` | 152 |
| `updateMessageStatusAsync` | Method | `src/modules/delayed-message/services/MessageSchedulerService.ts` | 412 |
| `checkRecallable` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 205 |
| `markAsCancelled` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 224 |
| `cleanup` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 255 |
| `saveMessageRecord` | Method | `src/modules/delayed-message/infrastructure/StorageService.ts` | 272 |
| `validateRecallPermission` | Method | `src/modules/delayed-message/infrastructure/ValidationService.ts` | 195 |
| `cancelScheduledMessage` | Method | `src/modules/delayed-message/services/MessageSchedulerService.ts` | 102 |
| `validateDelayedMessageRequest` | Method | `src/modules/delayed-message/infrastructure/ValidationService.ts` | 31 |
| `validateDelaySeconds` | Method | `src/modules/delayed-message/infrastructure/ValidationService.ts` | 98 |
| `validatePlatform` | Method | `src/modules/delayed-message/infrastructure/ValidationService.ts` | 120 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HealthCheck → GetMigrationConfig` | cross_community | 8 |
| `HealthCheck → NowMs` | cross_community | 7 |
| `HealthCheck → EventData` | cross_community | 7 |
| `ProcessBatch → StorageError` | cross_community | 6 |
| `ProcessBatch → AsSupportedPlatform` | cross_community | 6 |
| `ProcessBatch → ProcessingError` | cross_community | 6 |
| `ProcessBatch → AsString` | cross_community | 6 |
| `ProcessQueueMessage → StorageError` | cross_community | 5 |
| `ProcessQueueMessage → AsSupportedPlatform` | cross_community | 5 |
| `ProcessQueueMessage → ProcessingError` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 14 calls |
| Types | 2 calls |
| Middleware | 2 calls |
| Handlers | 1 calls |
| Controllers | 1 calls |

## How to Explore

1. `gitnexus_context({name: "StorageError"})` — see callers and callees
2. `gitnexus_query({query: "infrastructure"})` — find related execution flows
3. Read key files listed above for implementation details
