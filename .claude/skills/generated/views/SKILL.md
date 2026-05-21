---
name: views
description: "Skill for the Views area of Multi-Channel-Integration-System. 29 symbols across 16 files."
---

# Views

29 symbols | 16 files | Cohesion: 80%

## When to Use

- Working with code in `frontend/`
- Understanding how handleLoadMore, handleVisibleRangeChange, handlePredictiveLoad work
- Modifying views-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/stores/conversations.ts` | fetchConversations, loadMore, refresh, clearTransferredState |
| `frontend/src/views/ConversationList.vue` | handleLoadMore, handleVisibleRangeChange, handlePredictiveLoad |
| `frontend/src/views/ConversationDetail.vue` | handleRefreshMessages, handleMessageRecall, handleTransferredBack |
| `frontend/src/views/WebSocketMonitoring.vue` | refreshData, checkAlerts |
| `scripts/websocket-load-test.cjs` | connect, sendTestMessage |
| `frontend/src/views/AutoReply.vue` | handleSaveRule, confirmDelete |
| `frontend/src/composables/useToast.ts` | showSuccess, showError |
| `frontend/src/views/TeamManagement.vue` | handleMemberSortChange, handleTeamSortChange |
| `web-installer/frontend/src/views/SuccessPage.vue` | loadDeploymentData, retryLoad |
| `frontend/src/composables/conversation/useConversationVirtualScroll.ts` | handleReachBottom |

## Entry Points

Start here when exploring this area:

- **`handleLoadMore`** (Function) — `frontend/src/views/ConversationList.vue:271`
- **`handleVisibleRangeChange`** (Function) — `frontend/src/views/ConversationList.vue:278`
- **`handlePredictiveLoad`** (Function) — `frontend/src/views/ConversationList.vue:285`
- **`handleReachBottom`** (Function) — `frontend/src/composables/conversation/useConversationVirtualScroll.ts:150`
- **`fetchConversations`** (Function) — `frontend/src/stores/conversations.ts:400`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `handleLoadMore` | Function | `frontend/src/views/ConversationList.vue` | 271 |
| `handleVisibleRangeChange` | Function | `frontend/src/views/ConversationList.vue` | 278 |
| `handlePredictiveLoad` | Function | `frontend/src/views/ConversationList.vue` | 285 |
| `handleReachBottom` | Function | `frontend/src/composables/conversation/useConversationVirtualScroll.ts` | 150 |
| `fetchConversations` | Function | `frontend/src/stores/conversations.ts` | 400 |
| `loadMore` | Function | `frontend/src/stores/conversations.ts` | 643 |
| `refresh` | Function | `frontend/src/stores/conversations.ts` | 648 |
| `refreshData` | Function | `frontend/src/views/WebSocketMonitoring.vue` | 299 |
| `checkAlerts` | Function | `frontend/src/views/WebSocketMonitoring.vue` | 331 |
| `handleSaveRule` | Function | `frontend/src/views/AutoReply.vue` | 175 |
| `confirmDelete` | Function | `frontend/src/views/AutoReply.vue` | 202 |
| `handleRefreshMessages` | Function | `frontend/src/views/ConversationDetail.vue` | 473 |
| `handleMessageRecall` | Function | `frontend/src/views/ConversationDetail.vue` | 514 |
| `showSuccess` | Function | `frontend/src/composables/useToast.ts` | 127 |
| `showError` | Function | `frontend/src/composables/useToast.ts` | 130 |
| `handleMemberSortChange` | Function | `frontend/src/views/TeamManagement.vue` | 208 |
| `handleTeamSortChange` | Function | `frontend/src/views/TeamManagement.vue` | 214 |
| `setSortField` | Function | `frontend/src/composables/useListSorting.ts` | 116 |
| `fetchDeploymentStatus` | Function | `web-installer/frontend/src/stores/deploymentStore.ts` | 126 |
| `loadDeploymentData` | Function | `web-installer/frontend/src/views/SuccessPage.vue` | 250 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Stores | 4 calls |
| Composables | 3 calls |
| Api | 1 calls |
| AutoReply | 1 calls |

## How to Explore

1. `gitnexus_context({name: "handleLoadMore"})` — see callers and callees
2. `gitnexus_query({query: "views"})` — find related execution flows
3. Read key files listed above for implementation details
