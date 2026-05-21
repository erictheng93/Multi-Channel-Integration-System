---
name: autoreply
description: "Skill for the AutoReply area of Multi-Channel-Integration-System. 20 symbols across 7 files."
---

# AutoReply

20 symbols | 7 files | Cohesion: 80%

## When to Use

- Working with code in `frontend/`
- Understanding how useAutoReplyController, useRuleEditor, useScheduleEditor work
- Modifying autoreply-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/composables/autoReply/useAutoReplyController.ts` | useAutoReplyController, resolveTeamId, initialize, cleanup, startPolling (+2) |
| `frontend/src/composables/autoReply/useRuleEditor.ts` | useRuleEditor, getEmptyForm, resetForm, collapseRule, removeRule |
| `frontend/src/composables/autoReply/useScheduleEditor.ts` | useScheduleEditor, autoSave, debouncedAutoSave |
| `frontend/src/api/autoReply.ts` | deleteRule, saveSchedules |
| `frontend/src/services/preloadService.ts` | store |
| `frontend/src/stores/autoReply.ts` | useAutoReplyStore |
| `frontend/src/stores/preload.ts` | usePreloadStore |

## Entry Points

Start here when exploring this area:

- **`useAutoReplyController`** (Function) — `frontend/src/composables/autoReply/useAutoReplyController.ts:9`
- **`useRuleEditor`** (Function) — `frontend/src/composables/autoReply/useRuleEditor.ts:23`
- **`useScheduleEditor`** (Function) — `frontend/src/composables/autoReply/useScheduleEditor.ts:16`
- **`useAutoReplyStore`** (Function) — `frontend/src/stores/autoReply.ts:17`
- **`usePreloadStore`** (Function) — `frontend/src/stores/preload.ts:62`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useAutoReplyController` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 9 |
| `useRuleEditor` | Function | `frontend/src/composables/autoReply/useRuleEditor.ts` | 23 |
| `useScheduleEditor` | Function | `frontend/src/composables/autoReply/useScheduleEditor.ts` | 16 |
| `useAutoReplyStore` | Function | `frontend/src/stores/autoReply.ts` | 17 |
| `usePreloadStore` | Function | `frontend/src/stores/preload.ts` | 62 |
| `resolveTeamId` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 73 |
| `initialize` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 89 |
| `cleanup` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 107 |
| `startPolling` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 117 |
| `stopPolling` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 146 |
| `loadLogsPage` | Function | `frontend/src/composables/autoReply/useAutoReplyController.ts` | 172 |
| `deleteRule` | Function | `frontend/src/api/autoReply.ts` | 223 |
| `getEmptyForm` | Function | `frontend/src/composables/autoReply/useRuleEditor.ts` | 30 |
| `resetForm` | Function | `frontend/src/composables/autoReply/useRuleEditor.ts` | 41 |
| `collapseRule` | Function | `frontend/src/composables/autoReply/useRuleEditor.ts` | 70 |
| `removeRule` | Function | `frontend/src/composables/autoReply/useRuleEditor.ts` | 236 |
| `saveSchedules` | Function | `frontend/src/api/autoReply.ts` | 258 |
| `autoSave` | Function | `frontend/src/composables/autoReply/useScheduleEditor.ts` | 53 |
| `debouncedAutoSave` | Function | `frontend/src/composables/autoReply/useScheduleEditor.ts` | 75 |
| `store` | Method | `frontend/src/services/preloadService.ts` | 53 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Api | 2 calls |
| Team-management | 1 calls |
| Services | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useAutoReplyController"})` — see callers and callees
2. `gitnexus_query({query: "autoreply"})` — find related execution flows
3. Read key files listed above for implementation details
