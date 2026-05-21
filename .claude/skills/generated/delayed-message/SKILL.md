---
name: delayed-message
description: "Skill for the Delayed-message area of Multi-Channel-Integration-System. 21 symbols across 4 files."
---

# Delayed-message

21 symbols | 4 files | Cohesion: 63%

## When to Use

- Working with code in `src/`
- Understanding how updateAlarm, collectReadyMessages, restoreState work
- Modifying delayed-message-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/durable-objects/delayed-message/retry-handler.ts` | isMessageAlreadySent, shouldSkipMessage, handlePermanentFailure, handleCatastrophicError, sendMessage (+9) |
| `src/durable-objects/delayed-message/schedule-manager.ts` | updateAlarm, collectReadyMessages, restoreState |
| `src/durable-objects/DelayedMessageScheduler.ts` | doUpdateAlarm, alarm |
| `src/durable-objects/delayed-message/types.ts` | info, error |

## Entry Points

Start here when exploring this area:

- **`updateAlarm`** (Function) — `src/durable-objects/delayed-message/schedule-manager.ts:24`
- **`collectReadyMessages`** (Function) — `src/durable-objects/delayed-message/schedule-manager.ts:66`
- **`restoreState`** (Function) — `src/durable-objects/delayed-message/schedule-manager.ts:204`
- **`isMessageAlreadySent`** (Function) — `src/durable-objects/delayed-message/retry-handler.ts:48`
- **`shouldSkipMessage`** (Function) — `src/durable-objects/delayed-message/retry-handler.ts:183`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `updateAlarm` | Function | `src/durable-objects/delayed-message/schedule-manager.ts` | 24 |
| `collectReadyMessages` | Function | `src/durable-objects/delayed-message/schedule-manager.ts` | 66 |
| `restoreState` | Function | `src/durable-objects/delayed-message/schedule-manager.ts` | 204 |
| `isMessageAlreadySent` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 48 |
| `shouldSkipMessage` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 183 |
| `handlePermanentFailure` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 314 |
| `handleCatastrophicError` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 341 |
| `sendMessage` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 362 |
| `addToDeadLetterQueue` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 396 |
| `sendLineMessage` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 79 |
| `sendFacebookMessage` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 119 |
| `sendToPlatform` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 159 |
| `handleSendSuccess` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 286 |
| `storeMessageInDatabase` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 464 |
| `sendWithRetry` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 231 |
| `doUpdateAlarm` | Method | `src/durable-objects/DelayedMessageScheduler.ts` | 211 |
| `alarm` | Method | `src/durable-objects/DelayedMessageScheduler.ts` | 526 |
| `info` | Method | `src/durable-objects/delayed-message/types.ts` | 62 |
| `error` | Method | `src/durable-objects/delayed-message/types.ts` | 65 |
| `sleep` | Function | `src/durable-objects/delayed-message/retry-handler.ts` | 24 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Alarm → Info` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 6 calls |
| Durable-objects | 1 calls |

## How to Explore

1. `gitnexus_context({name: "updateAlarm"})` — see callers and callees
2. `gitnexus_query({query: "delayed-message"})` — find related execution flows
3. Read key files listed above for implementation details
