---
name: api
description: "Skill for the Api area of Multi-Channel-Integration-System. 100 symbols across 23 files."
---

# Api

100 symbols | 23 files | Cohesion: 80%

## When to Use

- Working with code in `frontend/`
- Understanding how list, getOverview, getRules work
- Modifying api-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/api/base.ts` | get, post, redirectToLogin, processQueue, refreshAuthToken (+10) |
| `frontend/src/api/reports.ts` | healthCheck, getModuleInfo, getReportDetails, getReportStatus, listScheduledReports (+9) |
| `frontend/src/api/tags.ts` | getTagById, getTagUsageStats, getCustomerTags, getTagCustomers, getTagConversations (+7) |
| `frontend/src/api/conversations.ts` | list, bulkOperation, adaptConversationData, getConversation, assignConversation (+2) |
| `frontend/src/api/system.ts` | getSettings, getMetrics, getStats, testIntegration, testWebhook (+1) |
| `frontend/src/api/team.ts` | getTeamMembers, getTeamMembersWithTeams, undoBatchEdit, addMemberToTeam, bulkRemoveMembersFromTeam (+1) |
| `frontend/src/api/modern-client.ts` | makeRequest, refreshAuthToken, get, post, delete (+1) |
| `frontend/src/api/autoReply.ts` | getRules, getSchedules, getLogs, createRule, updateRule |
| `frontend/src/api/channels.ts` | create, verify, update, parseWebhookConfig, parseStats |
| `frontend/src/composables/useReportDashboard.ts` | deleteReport, loadStatistics, getReportTypeLabel, downloadReport |

## Entry Points

Start here when exploring this area:

- **`list`** (Function) — `frontend/src/api/activities.ts:85`
- **`getOverview`** (Function) — `frontend/src/api/activities.ts:117`
- **`getRules`** (Function) — `frontend/src/api/autoReply.ts:156`
- **`getSchedules`** (Function) — `frontend/src/api/autoReply.ts:234`
- **`getLogs`** (Function) — `frontend/src/api/autoReply.ts:273`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `list` | Function | `frontend/src/api/activities.ts` | 85 |
| `getOverview` | Function | `frontend/src/api/activities.ts` | 117 |
| `getRules` | Function | `frontend/src/api/autoReply.ts` | 156 |
| `getSchedules` | Function | `frontend/src/api/autoReply.ts` | 234 |
| `getLogs` | Function | `frontend/src/api/autoReply.ts` | 273 |
| `list` | Function | `frontend/src/api/conversations.ts` | 215 |
| `getExportCustomers` | Function | `frontend/src/api/export.ts` | 148 |
| `getExportAgents` | Function | `frontend/src/api/export.ts` | 181 |
| `getSettings` | Function | `frontend/src/api/system.ts` | 101 |
| `getMetrics` | Function | `frontend/src/api/system.ts` | 119 |
| `getStats` | Function | `frontend/src/api/system.ts` | 197 |
| `getTagById` | Function | `frontend/src/api/tags.ts` | 142 |
| `getTagUsageStats` | Function | `frontend/src/api/tags.ts` | 183 |
| `getCustomerTags` | Function | `frontend/src/api/tags.ts` | 211 |
| `getTagCustomers` | Function | `frontend/src/api/tags.ts` | 323 |
| `getTagConversations` | Function | `frontend/src/api/tags.ts` | 359 |
| `getTeamMembers` | Function | `frontend/src/api/team.ts` | 344 |
| `getTeamMembersWithTeams` | Function | `frontend/src/api/team.ts` | 696 |
| `loadFilterOptions` | Function | `frontend/src/components/conversation/ExportDialog.vue` | 282 |
| `create` | Function | `frontend/src/api/channels.ts` | 206 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UseWebSocketStatus → RemoveAuthHeader` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 2 calls |
| Analytics | 1 calls |
| AutoReply | 1 calls |

## How to Explore

1. `gitnexus_context({name: "list"})` — see callers and callees
2. `gitnexus_query({query: "api"})` — find related execution flows
3. Read key files listed above for implementation details
