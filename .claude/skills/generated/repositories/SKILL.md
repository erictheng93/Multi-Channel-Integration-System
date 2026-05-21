---
name: repositories
description: "Skill for the Repositories area of Multi-Channel-Integration-System. 52 symbols across 4 files."
---

# Repositories

52 symbols | 4 files | Cohesion: 68%

## When to Use

- Working with code in `src/`
- Understanding how promises, getNotificationListKey, cacheNotificationList work
- Modifying repositories-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/modules/notifications/repositories/notification-cache.ts` | getNotificationListKey, cacheNotificationList, getCachedNotificationList, invalidateUserCache, getUnreadCountKey (+18) |
| `src/modules/notifications/repositories/notification-repository.ts` | findByQuery, markAsRead, markAllAsRead, getUnreadCount, create (+7) |
| `src/modules/notifications/services/notification-service.ts` | getByQuery, calculatePagination, markAllAsRead, getUnreadCount, getById (+5) |
| `src/types/db-compat.ts` | set, update, values, insert, select (+2) |

## Entry Points

Start here when exploring this area:

- **`promises`** (Function) — `src/modules/notifications/repositories/notification-cache.ts:221`
- **`getNotificationListKey`** (Method) — `src/modules/notifications/repositories/notification-cache.ts:45`
- **`cacheNotificationList`** (Method) — `src/modules/notifications/repositories/notification-cache.ts:92`
- **`getCachedNotificationList`** (Method) — `src/modules/notifications/repositories/notification-cache.ts:107`
- **`findByQuery`** (Method) — `src/modules/notifications/repositories/notification-repository.ts:133`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `promises` | Function | `src/modules/notifications/repositories/notification-cache.ts` | 221 |
| `getNotificationListKey` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 45 |
| `cacheNotificationList` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 92 |
| `getCachedNotificationList` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 107 |
| `findByQuery` | Method | `src/modules/notifications/repositories/notification-repository.ts` | 133 |
| `getByQuery` | Method | `src/modules/notifications/services/notification-service.ts` | 140 |
| `calculatePagination` | Method | `src/modules/notifications/services/notification-service.ts` | 299 |
| `invalidateUserCache` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 210 |
| `markAsRead` | Method | `src/modules/notifications/repositories/notification-repository.ts` | 197 |
| `markAllAsRead` | Method | `src/modules/notifications/repositories/notification-repository.ts` | 213 |
| `markAllAsRead` | Method | `src/modules/notifications/services/notification-service.ts` | 182 |
| `set` | Method | `src/types/db-compat.ts` | 13 |
| `update` | Method | `src/types/db-compat.ts` | 29 |
| `getUnreadCountKey` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 53 |
| `cacheUnreadCount` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 159 |
| `getCachedUnreadCount` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 166 |
| `getUnreadCount` | Method | `src/modules/notifications/repositories/notification-repository.ts` | 254 |
| `getUnreadCount` | Method | `src/modules/notifications/services/notification-service.ts` | 204 |
| `getNotificationKey` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 41 |
| `cacheNotification` | Method | `src/modules/notifications/repositories/notification-cache.ts` | 62 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TriggerPriorityChangedNotification → Insert` | cross_community | 4 |
| `TriggerPriorityChangedNotification → Values` | cross_community | 4 |
| `TriggerPriorityChangedNotification → Select` | cross_community | 4 |
| `TriggerPriorityChangedNotification → MapToNotification` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 1 calls |

## How to Explore

1. `gitnexus_context({name: "promises"})` — see callers and callees
2. `gitnexus_query({query: "repositories"})` — find related execution flows
3. Read key files listed above for implementation details
