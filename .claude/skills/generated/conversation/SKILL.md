---
name: conversation
description: "Skill for the Conversation area of Multi-Channel-Integration-System. 41 symbols across 24 files."
---

# Conversation

41 symbols | 24 files | Cohesion: 83%

## When to Use

- Working with code in `frontend/`
- Understanding how exportMessages, getExportCount, buildExportFilters work
- Modifying conversation-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/composables/conversation/useTeamAssignment.ts` | agentToTeamMember, canAssignToTeam, toggleTeamSelector, closeTeamSelector |
| `frontend/src/components/conversation/ExportDialog.vue` | buildExportFilters, handleExport, doExport |
| `frontend/src/composables/conversation/useWebSocketIntegration.ts` | useWebSocketIntegration, handleUnifiedMessage, handleConnectionEstablished |
| `frontend/src/components/conversation/MessageInput.vue` | setMessageText, setReplyTo, focus |
| `frontend/src/composables/conversation/useConversationListController.ts` | useConversationListController, loadConversations, handleLoadError |
| `frontend/src/api/export.ts` | exportMessages, getExportCount |
| `frontend/src/views/ConversationDetail.vue` | handleQuickReplySelect, handleMessageReply |
| `frontend/tests/unit/components/conversation/AdvancedAssignActions.test.ts` | createMockConversation, createWrapper |
| `frontend/tests/unit/components/conversation/MessageBubble.test.ts` | createMessage, mountBubble |
| `frontend/tests/unit/components/conversation/MessageSearch.test.ts` | createMessage, createMessages |

## Entry Points

Start here when exploring this area:

- **`exportMessages`** (Function) — `frontend/src/api/export.ts:45`
- **`getExportCount`** (Function) — `frontend/src/api/export.ts:115`
- **`buildExportFilters`** (Function) — `frontend/src/components/conversation/ExportDialog.vue:315`
- **`handleExport`** (Function) — `frontend/src/components/conversation/ExportDialog.vue:327`
- **`doExport`** (Function) — `frontend/src/components/conversation/ExportDialog.vue:378`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `exportMessages` | Function | `frontend/src/api/export.ts` | 45 |
| `getExportCount` | Function | `frontend/src/api/export.ts` | 115 |
| `buildExportFilters` | Function | `frontend/src/components/conversation/ExportDialog.vue` | 315 |
| `handleExport` | Function | `frontend/src/components/conversation/ExportDialog.vue` | 327 |
| `doExport` | Function | `frontend/src/components/conversation/ExportDialog.vue` | 378 |
| `generatePdfExport` | Function | `frontend/src/services/pdfExportService.ts` | 302 |
| `useConversationActions` | Function | `frontend/src/composables/conversation/useConversationActions.ts` | 29 |
| `useConversationController` | Function | `frontend/src/composables/conversation/useConversationController.ts` | 54 |
| `useConversationState` | Function | `frontend/src/composables/conversation/useConversationState.ts` | 33 |
| `useMessageHandlers` | Function | `frontend/src/composables/conversation/useMessageHandlers.ts` | 97 |
| `useWebSocketIntegration` | Function | `frontend/src/composables/conversation/useWebSocketIntegration.ts` | 33 |
| `useCustomerMessages` | Function | `frontend/src/composables/useCustomerMessages.ts` | 17 |
| `setMessageText` | Function | `frontend/src/components/conversation/MessageInput.vue` | 365 |
| `setReplyTo` | Function | `frontend/src/components/conversation/MessageInput.vue` | 377 |
| `focus` | Function | `frontend/src/components/conversation/MessageInput.vue` | 430 |
| `handleQuickReplySelect` | Function | `frontend/src/views/ConversationDetail.vue` | 482 |
| `handleMessageReply` | Function | `frontend/src/views/ConversationDetail.vue` | 502 |
| `useConversationCache` | Function | `frontend/src/composables/conversation/useConversationCache.ts` | 70 |
| `useConversationFilters` | Function | `frontend/src/composables/conversation/useConversationFilters.ts` | 67 |
| `useConversationListController` | Function | `frontend/src/composables/conversation/useConversationListController.ts` | 82 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 5 calls |
| Views | 3 calls |
| Conversations | 2 calls |
| Api | 1 calls |
| Team-management | 1 calls |

## How to Explore

1. `gitnexus_context({name: "exportMessages"})` — see callers and callees
2. `gitnexus_query({query: "conversation"})` — find related execution flows
3. Read key files listed above for implementation details
