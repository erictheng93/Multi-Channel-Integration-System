# W1 Inventory - Recall Window Phase 3

Date: 2026-07-03
Status: BLOCKED - production evidence incomplete

This report is a W1 inventory draft only. It does not approve W2 deletion work yet.
Production Cloudflare traffic and remote D1 pending-row evidence could not be collected
from the current Wrangler account context.

## Scope

Inventory window requested by the worklist: 2026-06-03 through 2026-07-03.

Targets:

- Implementation B routes: `POST/GET /api/delayed-messages/*`
- Legacy messaging routes:
  - `POST /api/messages/delayed`
  - `POST /api/messages/recall`
  - `GET /api/messages/pending`
  - `GET /api/messages/:id/can-recall`
- Backend symbols:
  - `DelayedMessageManager`
  - `MessageSchedulerService`
  - `MessageProcessorService`
  - `delayed-message-service`
- Frontend dead-code candidates:
  - `frontend/src/components/message/PendingMessagesList.vue`
  - `frontend/src/composables/useDelayedMessages.ts`

## 1. Endpoint Traffic Evidence

Production traffic evidence is not complete.

Wrangler account check:

```text
$ rtk bunx wrangler whoami
Account Name: Minimaro93@gmail.com's Account
Account ID: bdddc08c066a9abc285d75fe5947a468
Token includes: workers_tail (read), d1 (write), account (read), workers (write)
```

Project config expects a different production account context:

```text
wrangler.toml:2:# Account: admin@dacit.net (account_id via CLOUDFLARE_ACCOUNT_ID env var)
wrangler.toml:3:name = "mcis-worker"
```

Worker lookup from the current account failed:

```text
$ rtk bunx wrangler deployments list
ERROR: A request to the Cloudflare API
(/accounts/bdddc08c066a9abc285d75fe5947a468/workers/scripts/mcis-worker/deployments)
failed.

This Worker does not exist on your account. [code: 10007]
```

Because `mcis-worker` is not visible to the current Wrangler account, Cloudflare dashboard
analytics / worker log evidence for the last 30 days could not be collected here.

Traffic table:

| Route family | Route(s) | Current evidence | Deletion approval |
|---|---|---:|---|
| Implementation B | `POST/GET /api/delayed-messages/*` | BLOCKED: production worker not visible to current account | Not approved |
| Legacy delayed | `POST /api/messages/delayed` | BLOCKED: production worker not visible to current account | Not approved |
| Legacy recall | `POST /api/messages/recall` | BLOCKED: production worker not visible to current account | Not approved |
| Legacy pending | `GET /api/messages/pending` | BLOCKED: production worker not visible to current account | Not approved |
| Legacy can-recall | `GET /api/messages/:id/can-recall` | BLOCKED: production worker not visible to current account | Not approved |

Required follow-up before W2:

- Re-run the traffic check while authenticated to the Cloudflare account that owns
  `mcis-worker` / `mcis-db`, or provide dashboard screenshots / analytics export for
  2026-06-03 through 2026-07-03.
- Record per-route request counts. Only routes with zero traffic should be marked
  deletion-approved.

## 2. Backend Reference Inventory

Primary indexed discovery:

- `mcp__codebase_memory_mcp.index_status`
  - Project: `Users-eric-Documents-Code-Multi-Channel-Integration-System`
  - Status: `ready`
- `mcp__codebase_memory_mcp.search_code`
  - Pattern: `DelayedMessageManager|MessageSchedulerService|MessageProcessorService|delayed-message-service`
  - Scope: `src/**/*.ts`
  - Result: 56 raw grep matches, 19 graph-enriched results

Worklist grep command and output:

```text
$ grep -rn "DelayedMessageManager\|MessageSchedulerService\|MessageProcessorService\|delayed-message-service" src/ --include="*.ts" | grep -v test
src/constants/limits.ts:299: * delayed-message-buffer、DelayedMessageController、delayed-message-service）。
src/modules/delayed-message/index.ts:11:import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
src/modules/delayed-message/index.ts:23:    const manager = new DelayedMessageManager(c.env);
src/modules/delayed-message/index.ts:37:    const manager = new DelayedMessageManager(c.env);
src/modules/delayed-message/index.ts:51:    const manager = new DelayedMessageManager(c.env);
src/modules/delayed-message/index.ts:65:    const manager = new DelayedMessageManager(c.env);
src/modules/delayed-message/index.ts:83:  DelayedMessageManager,
src/modules/delayed-message/index.ts:84:  MessageSchedulerService,
src/modules/delayed-message/index.ts:85:  MessageProcessorService
src/modules/delayed-message/controllers/DelayedMessageController.ts:8:import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
src/modules/delayed-message/controllers/DelayedMessageController.ts:40:  private manager: DelayedMessageManager;
src/modules/delayed-message/controllers/DelayedMessageController.ts:44:    this.manager = new DelayedMessageManager(env);
src/modules/delayed-message/services/DelayedMessageManager.ts:17:import { MessageSchedulerService } from '@modules/delayed-message/services/MessageSchedulerService';
src/modules/delayed-message/services/DelayedMessageManager.ts:18:import { MessageProcessorService } from '@modules/delayed-message/services/MessageProcessorService';
src/modules/delayed-message/services/DelayedMessageManager.ts:23:const log = createContextLogger('DelayedMessageManager');
src/modules/delayed-message/services/DelayedMessageManager.ts:26: * DelayedMessageManager - 延遲訊息核心管理器
src/modules/delayed-message/services/DelayedMessageManager.ts:34:export class DelayedMessageManager {
src/modules/delayed-message/services/DelayedMessageManager.ts:38:  private schedulerService: MessageSchedulerService;
src/modules/delayed-message/services/DelayedMessageManager.ts:39:  private processorService: MessageProcessorService;
src/modules/delayed-message/services/DelayedMessageManager.ts:46:    this.schedulerService = new MessageSchedulerService(env);
src/modules/delayed-message/services/DelayedMessageManager.ts:47:    this.processorService = new MessageProcessorService(env);
src/modules/delayed-message/services/MessageProcessorService.ts:35: * MessageProcessorService - 訊息處理專家
src/modules/delayed-message/services/MessageProcessorService.ts:43:export class MessageProcessorService {
src/modules/delayed-message/services/index.ts:4:export { DelayedMessageManager } from './DelayedMessageManager';
src/modules/delayed-message/services/index.ts:5:export { MessageSchedulerService, SchedulingError } from './MessageSchedulerService';
src/modules/delayed-message/services/index.ts:6:export { MessageProcessorService, ProcessingError } from './MessageProcessorService';
src/modules/delayed-message/services/MessageSchedulerService.ts:22: * MessageSchedulerService - 訊息排程專家
src/modules/delayed-message/services/MessageSchedulerService.ts:30:export class MessageSchedulerService {
src/modules/messaging/index.ts:9:export { DelayedMessageService } from './services/delayed-message-service';
src/modules/messaging/handlers/messaging/routes/legacy-delayed.ts:18:import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
src/modules/messaging/handlers/messaging/routes/legacy-delayed.ts:106:    const result = await new DelayedMessageManager(c.env).sendDelayedMessage(request, user);
src/modules/messaging/handlers/messaging/routes/legacy-delayed.ts:141:    const result = await new DelayedMessageManager(c.env).recallDelayedMessage(messageId, user);
src/modules/messaging/handlers/messaging/routes/legacy-delayed.ts:170:    const result = await new DelayedMessageManager(c.env).getPendingMessages(
src/modules/messaging/services/delayed-message-service.ts:253:        const { MessageProcessorService } = await import('@modules/delayed-message/services/MessageProcessorService');
src/modules/messaging/services/delayed-message-service.ts:254:        const processor = new MessageProcessorService(this.env);
src/modules/messaging/services/index.ts:5:export { DelayedMessageService } from './delayed-message-service';
src/modules/messaging/services/index.ts:12:import { DelayedMessageService } from './delayed-message-service';
```

Classification:

| Reference | Classification | Rationale | Required supporting evidence before deletion |
|---|---|---|---|
| `src/modules/delayed-message/index.ts` delayed router and service exports | Candidate delete | Implements `delayed-messages` legacy module registered under `/api/delayed-messages`; self-contained legacy path | Zero traffic for `/api/delayed-messages/*` |
| `src/modules/delayed-message/controllers/DelayedMessageController.ts` | Candidate delete | Only referenced by delayed-message module/controller factory; not used by v2 buffer path | Zero traffic for `/api/delayed-messages/*`; no non-test references after route removal |
| `src/modules/delayed-message/services/DelayedMessageManager.ts` | Candidate delete | Used by implementation B router and messaging legacy delayed routes | Zero traffic for implementation B and legacy delayed routes |
| `src/modules/delayed-message/services/MessageSchedulerService.ts` | Candidate delete | Only used through `DelayedMessageManager` and service barrel | Zero traffic for implementation B and legacy delayed routes |
| `src/modules/delayed-message/services/MessageProcessorService.ts` | Candidate delete | Used by `DelayedMessageManager` and `messaging/services/delayed-message-service.ts` | Zero traffic for implementation B and legacy delayed routes |
| `src/modules/delayed-message/services/index.ts` | Candidate delete | Barrel for candidate-delete services | No non-test references after route/service removal |
| `src/modules/messaging/handlers/messaging/routes/legacy-delayed.ts` | Candidate delete | Implements legacy delayed routes under `/api/messages` | Zero traffic for the four legacy delayed routes |
| `src/modules/messaging/services/delayed-message-service.ts` | Candidate delete | Legacy delayed delivery service; imports `MessageProcessorService` dynamically | No non-test consumers after `createMessagingServices.delayed` removal and zero route traffic |
| `src/modules/messaging/index.ts` delayed-service export | Candidate edit | Barrel export for candidate-delete service | Remove only after no consumers remain |
| `src/modules/messaging/services/index.ts` delayed-service export/import and `delayed` factory property | Candidate edit | Factory currently constructs `DelayedMessageService` | Remove only after no consumers require `MessagingServices.delayed` |
| `src/constants/limits.ts` comment mention | Candidate edit | Documentation-only reference to legacy names; constant itself may still be used by v2 buffer / validation | Preserve `DELAYED_MESSAGE_LIMITS`; only update stale comment if legacy names are removed |

Explicit preserve list:

| Path / symbol | Classification | Reason |
|---|---|---|
| `src/modules/delayed-message/handlers/delayed-message-buffer.ts` | Preserve | v2 route handler registered as `/api/delayed-messages-v2` |
| `src/durable-objects/**/DelayedMessageBuffer` / `DELAYED_MESSAGE_SCHEDULER` binding | Preserve | Durable Object path used by recall-window timer and v2 scheduling |
| `MessageRecallService.recallMessage` | Preserve | Core recall-window flow |
| Health probes in `websocket-health.ts` and `system-main.ts` | Preserve | Probe DO binding health, not legacy service traffic |
| `src/db/schema.ts` `delayedMessages` table | Preserve | Mark deprecated later; no drop migration in Phase 3 |
| `DELAYED_MESSAGE_LIMITS` value object | Preserve unless proven unused | Shared limit source may still be used by v2 buffer or validation |

## 3. Frontend Reference Confirmation

Primary indexed discovery:

- `mcp__codebase_memory_mcp.search_code`
  - Pattern: `PendingMessagesList|useDelayedMessages`
  - Scope: `frontend/src`
  - Result: 3 raw grep matches, 3 graph-enriched results
  - `useDelayedMessages` graph `in_degree`: 0
  - `PendingMessagesList.vue` graph `in_degree`: 0

Raw grep output:

```text
$ grep -rn "PendingMessagesList\|useDelayedMessages" frontend/src --include="*.ts" --include="*.vue"
frontend/src/composables/useDelayedMessages.ts:13:export function useDelayedMessages() {
frontend/src/composables/index.ts:18:export { useDelayedMessages } from './useDelayedMessages'
frontend/src/components/message/PendingMessagesList.vue:209:const frontendLogger = createLogger('PendingMessagesList')
```

Classification:

| Reference | Classification | Rationale |
|---|---|---|
| `frontend/src/components/message/PendingMessagesList.vue` | Candidate delete | No indexed inbound references; raw grep only finds the component's own logger name |
| `frontend/src/composables/useDelayedMessages.ts` | Candidate delete | No indexed inbound references; raw grep only finds the function declaration and barrel export |
| `frontend/src/composables/index.ts:18` | Candidate edit | Barrel export only; remove with composable deletion |

Frontend deletion is still gated by W3, after W1 and W2 approval.

## 4. D1 In-Flight Data

Remote production D1 evidence is not complete.

Configured database:

```text
wrangler.toml:55:[[d1_databases]]
wrangler.toml:56:binding = "DB"
wrangler.toml:57:database_name = "mcis-db"
wrangler.toml:58:database_id = "f58a1c9f-a739-4873-944e-39038e1008c2"
```

Remote query attempts:

```text
$ rtk bunx wrangler d1 execute mcis-db --remote --command="SELECT status, COUNT(*) AS count FROM delayed_messages GROUP BY status ORDER BY status;"
ERROR: A request to the Cloudflare API
(/accounts/bdddc08c066a9abc285d75fe5947a468/d1/database/f58a1c9f-a739-4873-944e-39038e1008c2/query)
failed.

The database f58a1c9f-a739-4873-944e-39038e1008c2 could not be found [code: 7404]

$ rtk bunx wrangler d1 execute mcis-db --remote --command="SELECT id, conversation_id, status, scheduled_at, created_at, sender_id FROM delayed_messages WHERE status='pending' ORDER BY scheduled_at ASC LIMIT 50;"
ERROR: The database f58a1c9f-a739-4873-944e-39038e1008c2 could not be found [code: 7404]
```

Current-account D1 list confirms `mcis-db` is not visible:

```text
$ rtk bunx wrangler d1 list
Visible databases: lottery-db, makanmasak-management-prod, makanmasak-prod,
makanmasak-management-staging, makanmasak-staging
```

Local D1 is not a usable substitute for production pending-row evidence:

```text
$ rtk bunx wrangler d1 execute mcis-db --local --command="SELECT status, COUNT(*) AS count FROM delayed_messages GROUP BY status ORDER BY status;"
ERROR: no such table: delayed_messages: SQLITE_ERROR
```

Disposition plan:

- Pending-row count is unknown until the correct production D1 account context is used.
- No W2 deletion should proceed while pending-row count is unknown.
- If the correct remote query returns `pending = 0`, proceed with route/service deletion after
  traffic evidence is also zero.
- If the correct remote query returns `pending > 0`, list pending rows and choose one of:
  - wait until all pending rows pass `scheduled_at` / `recall_deadline`, then re-query; or
  - explicitly void the pending rows through an approved operational action before deletion.

## W1 Acceptance Checklist

- [x] Backend references collected by codebase-memory and raw grep.
- [x] Frontend references collected by codebase-memory and raw grep.
- [ ] Production 30-day traffic evidence collected.
- [ ] Remote D1 pending-row count collected.
- [ ] Every candidate-delete row has zero-traffic or no-reference evidence.
- [ ] In-flight data disposition finalized.

Conclusion: W1 is not ready for approval. The next required action is to run the
production traffic and D1 queries from the Cloudflare account that owns `mcis-worker`
and `mcis-db`.
