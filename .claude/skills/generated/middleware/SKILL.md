---
name: middleware
description: "Skill for the Middleware area of Multi-Channel-Integration-System. 204 symbols across 55 files."
---

# Middleware

204 symbols | 55 files | Cohesion: 69%

## When to Use

- Working with code in `src/`
- Understanding how getValidatedParam, validatePaginationParams, validateCustomerId work
- Modifying middleware-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/modules/system/middleware/system-auth.ts` | checkSystemAccess, checkStatusViewPermission, checkInfoViewPermission, checkStatsViewPermission, checkSettingsViewPermission (+8) |
| `src/modules/session/middleware/session-validation.ts` | sanitizeString, validateNumberRange, validateISODate, validateUpdateSessionData, validateSessionListQuery (+7) |
| `src/modules/reports/middleware/reports-validation.ts` | sanitizeString, validateISODate, validateReportGenerationParams, validateReportListQuery, validateScheduledReportData (+6) |
| `src/modules/teams/middleware/team-validation.ts` | validateCreateTeamData, validateUpdateTeamData, validateTeamId, validateMemberId, validateAddMemberData (+5) |
| `src/modules/messaging/middleware/message-auth.ts` | authCtx, checkMessageSendPermission, checkMessageRecallPermission, checkDelayedSendPermission, checkBatchOperationPermission (+5) |
| `src/modules/customer/middleware/customer-validation.ts` | validatePaginationParams, validateCustomerId, validateCreateCustomerData, validateUpdateCustomerData, validateTagOperation (+4) |
| `src/modules/file-management/services/file-service.ts` | uploadFile, deleteFile, getFileDetails, listFiles, getFileStatistics (+2) |
| `src/utils/api-response.ts` | generateRequestId, paginatedResponse, errorResponse, validationErrorResponse, forbiddenResponse (+2) |
| `src/modules/agents/middleware/agent-validation.ts` | validateCreateAgentData, validateUpdateAgentData, validateAgentId, validateSkillData, validateStatusData (+2) |
| `src/middleware/auth.ts` | jwtAuth, sessionAuth, optionalAuth, requireRoleLevel, requireManagerOrAdmin (+2) |

## Entry Points

Start here when exploring this area:

- **`getValidatedParam`** (Function) — `src/middleware/param-validator.ts:98`
- **`validatePaginationParams`** (Function) — `src/modules/customer/middleware/customer-validation.ts:26`
- **`validateCustomerId`** (Function) — `src/modules/customer/middleware/customer-validation.ts:60`
- **`validateCreateCustomerData`** (Function) — `src/modules/customer/middleware/customer-validation.ts:92`
- **`validateUpdateCustomerData`** (Function) — `src/modules/customer/middleware/customer-validation.ts:133`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `FileHandler` | Class | `src/modules/file-management/handlers/file-handler.ts` | 69 |
| `UploadHandler` | Class | `src/modules/file-management/handlers/upload-handler.ts` | 21 |
| `WebSocketBroadcastService` | Class | `src/services/websocket-broadcast-service.ts` | 19 |
| `InvalidTeamDataError` | Class | `src/modules/teams/types/team-types.ts` | 204 |
| `InvalidAgentDataError` | Class | `src/modules/agents/types/agent-types.ts` | 203 |
| `DatabaseService` | Class | `src/services/database.ts` | 29 |
| `AppError` | Class | `src/middleware/error-handler.ts` | 20 |
| `ValidationError` | Class | `src/middleware/error-handler.ts` | 38 |
| `UnauthorizedError` | Class | `src/middleware/error-handler.ts` | 51 |
| `ForbiddenError` | Class | `src/middleware/error-handler.ts` | 61 |
| `NotFoundError` | Class | `src/middleware/error-handler.ts` | 71 |
| `ResourceSelector` | Class | `src/utils/resource-selector.ts` | 10 |
| `getValidatedParam` | Function | `src/middleware/param-validator.ts` | 98 |
| `validatePaginationParams` | Function | `src/modules/customer/middleware/customer-validation.ts` | 26 |
| `validateCustomerId` | Function | `src/modules/customer/middleware/customer-validation.ts` | 60 |
| `validateCreateCustomerData` | Function | `src/modules/customer/middleware/customer-validation.ts` | 92 |
| `validateUpdateCustomerData` | Function | `src/modules/customer/middleware/customer-validation.ts` | 133 |
| `validateTagOperation` | Function | `src/modules/customer/middleware/customer-validation.ts` | 169 |
| `validateSearchQuery` | Function | `src/modules/customer/middleware/customer-validation.ts` | 210 |
| `validateFilterParams` | Function | `src/modules/customer/middleware/customer-validation.ts` | 253 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddTagsToCustomer → Warn` | cross_community | 8 |
| `AddTagsToCustomer → NowISO` | cross_community | 8 |
| `AddTagsToCustomer → GetLevelEmoji` | cross_community | 8 |
| `RemoveTagsFromCustomer → Warn` | cross_community | 8 |
| `RemoveTagsFromCustomer → NowISO` | cross_community | 8 |
| `RemoveTagsFromCustomer → GetLevelEmoji` | cross_community | 8 |
| `SetCustomerTags → Warn` | cross_community | 8 |
| `SetCustomerTags → NowISO` | cross_community | 8 |
| `SetCustomerTags → GetLevelEmoji` | cross_community | 8 |
| `AddTagsToCustomer → OutputStructured` | cross_community | 7 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 103 calls |
| Handlers | 31 calls |

## How to Explore

1. `gitnexus_context({name: "getValidatedParam"})` — see callers and callees
2. `gitnexus_query({query: "middleware"})` — find related execution flows
3. Read key files listed above for implementation details
