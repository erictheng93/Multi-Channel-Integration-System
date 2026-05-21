---
name: stores
description: "Skill for the Stores area of Multi-Channel-Integration-System. 71 symbols across 11 files."
---

# Stores

71 symbols | 11 files | Cohesion: 73%

## When to Use

- Working with code in `frontend/`
- Understanding how isCacheValid, init, _doInit work
- Modifying stores-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/stores/auth.ts` | clearAuthStorage, clearAuthState, switchTeam, login, isValidAgent (+14) |
| `frontend/src/stores/notifications.ts` | fetchRecentNotifications, fetchUnreadCount, createNotification, startPolling, stopPolling (+7) |
| `web-installer/frontend/src/stores/deploymentStore.ts` | startDeployment, resetState, cancelDeployment, trimLogs, addLog (+4) |
| `frontend/src/stores/conversations.ts` | handleError, updateConversationInList, fetchConversation, sendMessage, updateStatsFromConversations (+2) |
| `frontend/src/stores/messages.ts` | handleError, fetchMessages, sendMessage, updateMessage, debouncedBuildIndex (+2) |
| `frontend/src/stores/preload.ts` | isCacheValid, init, _doInit, preloadTeams, getTeams (+1) |
| `frontend/src/stores/websocket.ts` | setConnectionState, handleError, connect, disconnect, reconnect |
| `web-installer/frontend/src/views/ConfigForm.vue` | validateStep, handleSubmit |
| `frontend/src/stores/system.ts` | handleError, saveSettings |
| `frontend/src/api/base.ts` | setContextTeam |

## Entry Points

Start here when exploring this area:

- **`isCacheValid`** (Function) — `frontend/src/stores/preload.ts:132`
- **`init`** (Function) — `frontend/src/stores/preload.ts:182`
- **`_doInit`** (Function) — `frontend/src/stores/preload.ts:195`
- **`preloadTeams`** (Function) — `frontend/src/stores/preload.ts:226`
- **`getTeams`** (Function) — `frontend/src/stores/preload.ts:258`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `isCacheValid` | Function | `frontend/src/stores/preload.ts` | 132 |
| `init` | Function | `frontend/src/stores/preload.ts` | 182 |
| `_doInit` | Function | `frontend/src/stores/preload.ts` | 195 |
| `preloadTeams` | Function | `frontend/src/stores/preload.ts` | 226 |
| `getTeams` | Function | `frontend/src/stores/preload.ts` | 258 |
| `ensureTeamsLoaded` | Function | `frontend/src/stores/preload.ts` | 297 |
| `clearAuthState` | Function | `frontend/src/stores/auth.ts` | 123 |
| `switchTeam` | Function | `frontend/src/stores/auth.ts` | 161 |
| `login` | Function | `frontend/src/stores/auth.ts` | 279 |
| `logout` | Function | `frontend/src/stores/auth.ts` | 341 |
| `fetchCurrentAgent` | Function | `frontend/src/stores/auth.ts` | 398 |
| `setSessionStatus` | Function | `frontend/src/stores/auth.ts` | 544 |
| `initializeSession` | Function | `frontend/src/stores/auth.ts` | 549 |
| `fetchRecentNotifications` | Function | `frontend/src/stores/notifications.ts` | 173 |
| `fetchUnreadCount` | Function | `frontend/src/stores/notifications.ts` | 186 |
| `createNotification` | Function | `frontend/src/stores/notifications.ts` | 326 |
| `startPolling` | Function | `frontend/src/stores/notifications.ts` | 368 |
| `stopPolling` | Function | `frontend/src/stores/notifications.ts` | 389 |
| `setConnectionState` | Function | `frontend/src/stores/websocket.ts` | 150 |
| `handleError` | Function | `frontend/src/stores/websocket.ts` | 238 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UseWebSocketStatus → Base64UrlDecode` | cross_community | 5 |
| `UseWebSocketStatus → SetContextTeam` | cross_community | 4 |
| `HandleRealtimeUpdate → Base64UrlDecode` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 12 calls |
| Conversation | 2 calls |
| Api | 1 calls |
| Views | 1 calls |

## How to Explore

1. `gitnexus_context({name: "isCacheValid"})` — see callers and callees
2. `gitnexus_query({query: "stores"})` — find related execution flows
3. Read key files listed above for implementation details
