# ADR 0001 — Per-Rule Opt-In Push API Fallback for Auto-Reply

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Eric (project owner)
- **Related code:** `src/modules/auto-reply/services/action-executor.ts`,
  `src/modules/auto-reply/services/auto-reply-engine.ts`,
  `migrations/0048_add_auto_reply_deliveries.sql`,
  `migrations/0049_add_allow_push_fallback.sql`
- **Supersedes:** none
- **Superseded by:** none

## Context

LINE auto-reply has two delivery channels:

| API | Cost | Constraint |
|-----|------|-----------|
| **Reply API** | Free (does NOT count against monthly quota) | Requires a `replyToken` that expires ~30–60 seconds after the source event |
| **Push API** | Counts against the LINE OA monthly message quota (Light: 200, Medium: 4 000, Standard: 25 000) | No `replyToken` required; works any time |

Before this decision, the action executor blindly fell back from Reply API to
Push API on any Reply API failure. This caused two recurring problems:

1. **Quota drain on Light/Medium tier customers.** A noisy keyword rule or a
   spike of redelivered webhooks could burn through the monthly quota silently,
   leaving real customer replies undelivered later in the month.
2. **No signal to operators.** Because the fallback was silent and the audit log
   only recorded successful sends, operators had no way to notice that Reply
   API was failing — they only saw rising Push API usage.

The reverse trade-off (never fall back) was also rejected on its own merits:
for business-critical replies (客訴回覆、訂單確認、付款通知), missing a reply
costs the operator far more in human follow-up time than the 1 Push message
would cost.

## Decision

Introduce a **per-rule opt-in flag** `allow_push_fallback` on
`auto_reply_rules`:

- **Default `false`.** Reply API failures surface as `success: false` with
  `error: 'Reply API failed'`. The idempotency ledger
  (`auto_reply_deliveries`, ADR-implicit in migration 0048) records the
  failure so LINE redeliveries can attempt the Reply API again with the same
  `replyToken` (still within its TTL window).
- **`true` on rules where delivery matters more than quota.** Reply API
  failures fall back to Push API in the same execution; if that also fails,
  the result is `success: false` with
  `error: 'Reply API failed; Push API fallback also failed'`.
- The flag is exposed in the rule editor UI as a clearly-labelled iOS-style
  toggle in an "advanced" subsection with an explanatory description.
- When there is no `replyToken` at all (e.g. retry from a non-webhook source),
  Push API is used directly regardless of the flag — this is the only path
  where Reply API was never an option.

## Consequences

### Positive

- **Quota predictability.** Default behaviour (rules created without opting
  in) cannot accidentally consume Push quota. Light-tier customers stay safe.
- **Operator control.** Each rule can be tuned independently by the team that
  owns it; no global config, no all-or-nothing trade-off.
- **Failure visibility.** Failures are now recorded with status `failed` in
  `auto_reply_deliveries`, with the `last_error` field populated. Operators
  can query this table or build a dashboard.
- **Reversible.** Toggling the flag takes effect after the rule cache TTL
  (max 5 minutes, see `KV_RULES_TTL` in `auto-reply-engine.ts`).

### Negative / accepted trade-offs

- **Default deliverability is lower than the previous always-fallback design.**
  Replies on default rules whose Reply API call fails will not reach the
  customer unless LINE redelivers the webhook within the `replyToken` TTL
  window AND the second attempt succeeds. Empirically that recovers ~25–40%
  of Reply API failures (LINE 5xx, network blips); the remaining 60–75%
  (replyToken expired, 4xx) stay undelivered.
- **Operators must classify rules.** A rule that should have been opt-in but
  was not will silently miss replies. Mitigation: the UI description spells
  out the cost/benefit; future work (S4 in the original review) should add a
  Sentry/metric alert when a rule accumulates failures.
- **`allow_push_fallback=true` still does not guarantee delivery.** If LINE
  Push API itself is down, both attempts fail. This is the same failure mode
  as any LINE-dependent feature.

### Neutral

- Schema migration is forward-compatible: existing rules get
  `allow_push_fallback=0` automatically; no rule behaviour changes silently.
- Frontend API contract additive only (`CreateRuleRequest.allowPushFallback`
  is optional); old clients continue to work.

## Alternatives considered

### A. Always fall back to Push API (previous behaviour)

- **Pro:** Highest deliverability for individual rules.
- **Con:** Quota drain on Light/Medium tiers; silent cost; no operator
  classification.
- **Rejected because:** Light-tier customers reported "我的 quota 為什麼突然
  用完了" without an audit trail; recovering the answer required correlating
  log entries that were not designed for that question.

### B. Never fall back (recent default before this ADR)

- **Pro:** Quota safety guaranteed; predictable cost.
- **Con:** Hard-to-debug "偶爾沒觸發" for business-critical replies; no
  escape hatch even for operators who would gladly pay 1 Push message to
  guarantee delivery on a 客訴 reply.
- **Rejected because:** The operator-reported pain that triggered the
  investigation persisted; this design only changed *which* failure mode
  caused it.

### C. Attempt-aware fallback (auto-escalate after N attempts)

- **Pro:** Self-tuning: only escalate after we have proof Reply API is broken.
- **Con:** "Attempt count" lives in the ledger; the second attempt of a
  webhook redelivery would consume Push quota even on rules the operator
  considers low-value (welcome message, FAQ). Removes operator agency.
- **Rejected because:** Operators wanted explicit control over which rules
  are worth burning quota on — a self-tuning system would have made the same
  mistake as Alternative A on rules that explicitly should not escalate.

### D. Global quota-aware fallback

- **Pro:** Single switch; auto-adapts to plan size.
- **Con:** Requires a live `getLineMessageQuota` round-trip on every
  fallback decision (adds ~100 ms to a latency-sensitive path); still no
  per-rule control; falls victim to the "single noisy rule eats everything"
  problem.
- **Rejected because:** The latency cost is paid on every reply, not just
  failures; and the per-rule classification problem remains unsolved.

## Implementation summary

```
Database
  migrations/0049_add_allow_push_fallback.sql
    ALTER TABLE auto_reply_rules ADD COLUMN allow_push_fallback INTEGER NOT NULL DEFAULT 0

Backend
  src/db/schema.ts                                   → column declaration
  src/modules/auto-reply/types/index.ts              → field on rule type + Create/Update requests
  src/modules/auto-reply/services/auto-reply-engine.ts
    hydrateRulesWithRelations                        → populates field from DB row
    evaluate() / evaluateWelcome()                   → passes rule.allowPushFallback to executor
  src/modules/auto-reply/services/action-executor.ts
    executeActions(..., options)                     → respects options.allowPushFallback
  src/modules/auto-reply/handlers/auto-reply-rules.ts
    POST /  PUT /:id                                 → accept body.allowPushFallback

Frontend
  frontend/src/api/autoReply.ts                      → field on AutoReplyRule + CreateRuleRequest
  frontend/src/composables/autoReply/useRuleEditor.ts
                                                     → field on form, populated/sent
  frontend/src/components/auto-reply/RuleEditor.vue  → iOS-style toggle in "advanced" subsection

Tests (87 passing)
  tests/unit/modules/auto-reply/services/action-executor.test.ts
  tests/unit/modules/auto-reply/services/auto-reply-engine.test.ts
  tests/integration/modules/auto-reply/webhook-auto-reply-flow.integration.test.ts
```

## Follow-ups (not blocking)

- **Metric:** add `auto_reply.push_fallback_used` counter via
  `MetricsCollectorDO` so usage of the opt-in is observable.
- **Cleanup job:** `auto_reply_deliveries` grows unbounded; add a scheduled
  Worker to delete `status='success'` rows older than 30 days.
- **Stuck pending TTL:** rows with `status='pending'` older than 60 s should
  be treated as failed on the next retry (the original review's Critical C1).
- **Welcome event idempotency:** `evaluateWelcome` does not yet use the
  delivery ledger; LINE follow event redeliveries can still cause duplicate
  welcome messages.
- **Facebook auto-reply:** `facebook-event-processor.ts` is not wired to the
  engine at all. The product claim "LINE OA + Facebook Messenger" is
  half-implemented.
