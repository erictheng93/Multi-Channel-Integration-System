# ADR 0002 - Message Lifecycle and Consistency Guarantees

- **Status:** Accepted
- **Date:** 2026-06-10
- **Deciders:** Eric (project owner)
- **Related code:** `src/index.ts`, `src/services/queue-base-service.ts`,
  `src/durable-objects/DelayedMessageScheduler.ts`,
  `src/durable-objects/services/broadcaster-delivery-service.ts`,
  `src/durable-objects/services/broadcaster-helpers.ts`,
  `src/modules/websocket/services/durable-object-client.ts`,
  `src/modules/delayed-message/services/MessageSchedulerService.ts`,
  `src/modules/delayed-message/services/MessageProcessorService.ts`,
  `src/routes/operational-drill-routes.ts`,
  `wrangler.toml`

## Context

The backend uses Cloudflare Durable Objects, Queues, KV, R2, and D1 together.
That is appropriate for this system, but message delivery crosses several
stateful boundaries:

- LINE async delivery uses `LINE_MESSAGE_QUEUE` and `LINE_MESSAGE_DLQ`.
- Delayed messages use Durable Object alarms and D1 state.
- WebSocket fan-out uses `MessageBroadcaster` queues persisted in Durable
  Object storage.
- Runtime routing and queue exports are wired from `src/index.ts`.

The primary operational risk is not one bad API call. It is inconsistent state
after retry, alarm, broadcast, or partial infrastructure failure.

## Decision

Document and preserve these guarantees:

| Area | Guarantee | Boundary |
|------|-----------|----------|
| D1 message state | D1 is the source of truth for persisted conversation and delayed-message records. | D1 writes must complete before a message is treated as durable. |
| Queue processing | Queue handlers may process at least once. | Consumers must be idempotent by message id or delivery id. |
| Durable Object alarm processing | Alarms may be delayed or retried by the platform. | Alarm handlers must re-read durable state before sending. |
| WebSocket broadcast | Broadcast is best-effort real-time delivery. | Clients must reconcile from HTTP/D1-backed APIs after reconnect. |
| DO broadcast queue | `MessageBroadcaster` persists queued events and retry metadata in DO storage. | Queue overflow may evict lower-priority events; this is acceptable only for real-time hints. |
| DLQ | `LINE_MESSAGE_DLQ` is the terminal queue for failed async LINE delivery. | Operators must inspect DLQ metrics before declaring a delivery incident resolved. |

## Required Failure Drills

Run these before changing queue, alarm, or broadcast code:

1. Queue retry drill: call the staging-only `POST /api/ops/drills/run`
   endpoint and verify the `queue-retry` result reports `ackCount: 0` and
   `retryCount: 1`.
2. Durable Object alarm drill: call the staging-only `POST /api/ops/drills/run`
   endpoint and verify the `do-alarm` result schedules an update, manually
   triggers the alarm, and drains the queue back to `queueSize: 0`.
3. Broadcast failure drill: call the staging-only `POST /api/ops/drills/run`
   endpoint and verify the `broadcast-failure` result reports `failed: 1`
   with HTTP 200 from the broadcaster.
4. Reconnect reconciliation drill: disconnect a WebSocket client during message
   creation and verify the client recovers missing state through HTTP fetch.

The operational drill endpoint is unavailable outside staging. In staging it
requires `OPERATIONAL_DRILLS_ENABLED=true` and the `OPERATIONAL_DRILL_TOKEN`
Cloudflare secret sent as `x-ops-drill-token`.

## Operational Checks

- Use `bun run check:backend` before code changes are considered ready.
- Use `bun run validate:all` when touching route or runtime config.
- Use production resource commands only with an explicit
  `MCIS_CONFIRM_PRODUCTION=allow:<target>` confirmation.
- Check `LINE_MESSAGE_DLQ`, queue metrics, and Durable Object error logs during
  incident review.

## Consequences

Positive:

- The system has a single written contract for at-least-once queue behavior,
  delayed-message alarm behavior, and best-effort WebSocket delivery.
- Future changes have concrete drills instead of relying on comments in route
  or handler registration code.

Negative / accepted trade-offs:

- WebSocket delivery is explicitly not exactly-once. This keeps the real-time
  path fast, but clients must continue to reconcile after reconnect.
- Reconnect reconciliation still needs browser-level E2E automation. Until that
  exists, it remains a manual acceptance check for risky WebSocket changes.
