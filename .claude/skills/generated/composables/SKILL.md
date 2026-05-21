---
name: composables
description: "Skill for the Composables area of Multi-Channel-Integration-System. 131 symbols across 37 files."
---

# Composables

131 symbols | 37 files | Cohesion: 81%

## When to Use

- Working with code in `frontend/`
- Understanding how retryFailedMessage, useDashboardData, useDashboardStats work
- Modifying composables-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/composables/useMessages.ts` | ensureChronologicalOrder, mergeHistoryMessages, getLatestMessage, fetchMessagesPaginated, fetchLatestMessages (+7) |
| `frontend/src/composables/useActivityStream.ts` | addActivity, createActivity, handleNewMessage, handleConversationUpdate, handleNotification (+6) |
| `frontend/src/composables/useFileUpload.ts` | useFileUpload, uploadWithPresignedUrl, validateFile, uploadSingleFile, uploadPromises (+5) |
| `frontend/src/composables/useToast.ts` | show, success, error, warning, info (+4) |
| `frontend/src/composables/useApiMonitorController.ts` | fetchApiStatus, initialize, refreshAll, handleVisibilityChange, startAutoRefresh (+3) |
| `frontend/src/composables/useConfirmDialog.ts` | show, warning, danger, info, showConfirm (+3) |
| `frontend/src/composables/useFilter.ts` | removeFilter, updateFilter, filterByText, filterByValue, addFilter (+2) |
| `frontend/src/composables/useListSorting.ts` | useSortMode, useMemberSortMode, useTeamSortMode, useListSorting, useMemberListSorting (+1) |
| `frontend/src/composables/useWebSocket.ts` | useWebSocket, clearEventCallbacks, connect, disconnect, reconnect (+1) |
| `frontend/src/composables/useWebSocketPerformance.ts` | useWebSocketPerformance, stopTracking, stopStatsUpdate, startTracking, refreshStats (+1) |

## Entry Points

Start here when exploring this area:

- **`retryFailedMessage`** (Function) — `frontend/src/composables/conversation/useMessageHandlers.ts:413`
- **`useDashboardData`** (Function) — `frontend/src/composables/dashboard/useDashboardData.ts:33`
- **`useDashboardStats`** (Function) — `frontend/src/composables/dashboard/useDashboardStats.ts:42`
- **`useAsyncData`** (Function) — `frontend/src/composables/useAsyncData.ts:13`
- **`execute`** (Function) — `frontend/src/composables/useAsyncData.ts:47`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `retryFailedMessage` | Function | `frontend/src/composables/conversation/useMessageHandlers.ts` | 413 |
| `useDashboardData` | Function | `frontend/src/composables/dashboard/useDashboardData.ts` | 33 |
| `useDashboardStats` | Function | `frontend/src/composables/dashboard/useDashboardStats.ts` | 42 |
| `useAsyncData` | Function | `frontend/src/composables/useAsyncData.ts` | 13 |
| `execute` | Function | `frontend/src/composables/useAsyncData.ts` | 47 |
| `useConversations` | Function | `frontend/src/composables/useConversations.ts` | 8 |
| `useError` | Function | `frontend/src/composables/useError.ts` | 11 |
| `useFileUpload` | Function | `frontend/src/composables/useFileUpload.ts` | 301 |
| `useSystem` | Function | `frontend/src/composables/useSystem.ts` | 7 |
| `useTeam` | Function | `frontend/src/composables/useTeam.ts` | 7 |
| `addActivity` | Function | `frontend/src/composables/useActivityStream.ts` | 80 |
| `createActivity` | Function | `frontend/src/composables/useActivityStream.ts` | 92 |
| `handleNewMessage` | Function | `frontend/src/composables/useActivityStream.ts` | 112 |
| `handleConversationUpdate` | Function | `frontend/src/composables/useActivityStream.ts` | 129 |
| `handleNotification` | Function | `frontend/src/composables/useActivityStream.ts` | 154 |
| `handleError` | Function | `frontend/src/composables/useActivityStream.ts` | 179 |
| `handleRealtimeActivity` | Function | `frontend/src/composables/useActivityStream.ts` | 195 |
| `addManualActivity` | Function | `frontend/src/composables/useActivityStream.ts` | 279 |
| `setupConnectionStateWatcher` | Function | `frontend/src/composables/useActivityStream.ts` | 303 |
| `fetchApiStatus` | Function | `frontend/src/composables/useApiMonitorController.ts` | 107 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UseWebSocketStatus → Log` | cross_community | 7 |
| `UseWebSocketStatus → StopUptimeTimer` | cross_community | 6 |
| `UseWebSocketStatus → UpdateConnectedConversations` | cross_community | 6 |
| `UseWebSocketStatus → UpdateOnlineUsers` | cross_community | 6 |
| `UseWebSocketStatus → Base64UrlDecode` | cross_community | 5 |
| `UseWebSocketStatus → SetContextTeam` | cross_community | 4 |
| `UseWebSocketStatus → RemoveAuthHeader` | cross_community | 4 |
| `UseWebSocketStatus → WebSocketManager` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 10 calls |
| Team-management | 5 calls |
| Api | 2 calls |
| Conversations | 1 calls |
| Config | 1 calls |
| CustomerTags | 1 calls |

## How to Explore

1. `gitnexus_context({name: "retryFailedMessage"})` — see callers and callees
2. `gitnexus_query({query: "composables"})` — find related execution flows
3. Read key files listed above for implementation details
