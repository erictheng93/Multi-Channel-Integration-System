# ADR 0003 - Recall Window Delivery Architecture

- **Status:** Accepted
- **Date:** 2026-07-04
- **Deciders:** Eric (project owner)
- **Related code:** `src/modules/conversations/handlers/conversation-messages.ts`,
  `src/modules/conversations/services/message-delivery-service.ts`,
  `src/modules/conversations/services/buffered-send-scheduler.ts`,
  `src/modules/messaging/services/message-recall-service.ts`,
  `src/durable-objects/DelayedMessageScheduler.ts`,
  `src/services/recall-window-config.ts`,
  `frontend/src/composables/message/useRecallCountdown.ts`
- **Supersedes:** none
- **Superseded by:** none

## Context

The recall-window feature delays outbound agent messages before they reach LINE
or Facebook. During that window an agent can recall the message and guarantee
that the customer never receives it.

Before this decision, the codebase had three incompatible delayed-message
paths:

- legacy route/services that were not on the production send path,
- a v2 `DelayedMessageScheduler` Durable Object path, and
- the normal conversation message path, which pushed immediately in
  `waitUntil`.

The hard part is not just scheduling. The system must preserve the existing
message delivery behavior: text, images, files, Flex cards, LINE's 5-message
batch limit, D1 message state, and WebSocket `message_updated` broadcasts.
Duplicating delivery logic inside the Durable Object would create two delivery
engines with different capabilities.

## Decision

### 1. D1 unified delivery

All real platform delivery runs through
`MessageDeliveryService.deliver(messageId)`.

The Durable Object stores and alarms only the reference:
`{ messageId, conversationId, delaySeconds }`. It does not own message body,
attachment payload, LINE/Facebook send code, D1 status updates, or WebSocket
broadcasts. On alarm, `DelayedMessageScheduler.deliverByRef()` imports
`MessageDeliveryService` and calls `deliver(messageId)`.

Reason:

- D1 remains the single source of truth for message content, metadata, and
  attachment ids.
- Immediate send and delayed send use the same delivery implementation.
- Attachment handling and LINE batching stay in one place.

### 2. State idempotency

Delivery idempotency is based on D1 message state:

- `isRecalled=true` means the message was recalled and must never be pushed.
- `isSent=true` means the message already reached the platform and must not be
  sent again.

`MessageDeliveryService.deliver()` re-reads the message row first and returns
without calling LINE/Facebook when either flag is set.

Reason:

- The previous "row exists means already delivered" check is incompatible with
  recall windows because buffered messages are inserted before delivery.
- Durable Object alarms can be retried; state-based idempotency protects
  duplicate alarms and recall/send races.

### 3. Durable Object as the only recall race arbiter

For buffered messages, the recall handler calls the conversation-scoped
`DelayedMessageScheduler` DO `/cancel` endpoint before marking the message
recalled. If the DO rejects the cancel, the handler returns HTTP 400 and does
not mutate the message.

The HTTP handler does not re-decide the buffered deadline using its own clock.
The DO owns the pending schedule and serializes cancel vs alarm inside one
conversation-scoped instance.

Reason:

- Cancel and alarm must have one authoritative ordering.
- A separate Worker clock check can reject a recall that the DO would still
  accept, or accept a recall after the DO has already released delivery.
- The result is clear: cancel succeeds means no customer delivery; cancel
  fails means the recall deadline has passed.

### 4. Schedule failure degrades to immediate delivery

When `scheduleBufferedDelivery()` cannot reach the DO, receives a non-2xx
response, or the DO binding is missing, the send handler downgrades the row
from `deliveryStatus='buffered'` back to `deliveryStatus='pending'` with
`recallDeadline=null`, then schedules immediate delivery via the existing
`processBackgroundSending()` path.

Reason:

- A message must never remain stuck in `buffered` without an alarm.
- Availability is preferred over a failed recall window setup. If the timer
  cannot be established, the system falls back to the pre-feature immediate
  send behavior and logs the downgrade.

## Consequences

Positive:

- One platform delivery implementation covers immediate sends, recall-window
  sends, attachments, batching, status updates, and WebSocket broadcasts.
- The recall race has one authoritative arbiter.
- Duplicate alarms and late recalls do not double-send messages.
- DO outage or missing binding does not strand outbound messages.

Negative / accepted trade-offs:

- The DO does not retry platform push itself; it delegates to
  `MessageDeliveryService`, which records delivery failure on the message row.
- If scheduling fails, the recall window is skipped for that message. This is
  explicit and logged, but the customer receives the message immediately.

## Operational checks

- Unit coverage:
  `tests/unit/modules/conversations/services/message-delivery-service.test.ts`
  verifies state idempotency, normal delivery, broadcast, and LINE batching.
- Unit coverage:
  `tests/unit/modules/conversations/services/buffered-send-scheduler.test.ts`
  verifies schedule success/failure and downgrade behavior.
- Handler coverage:
  `tests/unit/modules/conversations/handlers/message-recall-handler.test.ts`
  verifies buffered cancel success/failure, LINE delivered rejection, Facebook
  delivered allow path, and already-recalled rejection.
- Service coverage:
  `tests/unit/modules/messaging/services/message-recall-service.recall-window.test.ts`
  verifies the Facebook Graph DELETE branch.
- Frontend coverage:
  `frontend/src/composables/message/useRecallCountdown.test.ts`
  verifies buffered countdown, recalled exclusion, awaiting-delivery state, and
  non-buffered false state.

## Follow-ups

- Production/manual validation remains required for the complete UI flow:
  send message, refresh immediately, confirm countdown restores, recall within
  the window, and confirm no customer delivery.
- `DelayedMessagePanel.vue` currently targets the retained v2 API but has no
  mount point. Decide later whether to wire it into a scheduling UI or remove
  it with the v2 frontend client if the feature is abandoned.
