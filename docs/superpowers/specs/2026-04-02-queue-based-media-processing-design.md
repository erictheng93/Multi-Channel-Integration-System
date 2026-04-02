# Queue-based LINE Media Processing

**Date:** 2026-04-02
**Status:** Approved
**Author:** Eric + Claude

## Problem

When a LINE user sends multiple files simultaneously (e.g., 5 PDFs + 1 image), the deferred media processing tasks all run concurrently within the same `waitUntil` budget. Cloudflare Workers have a ~30s CPU time limit for `waitUntil`, and concurrent file downloads + R2 uploads can exceed this, causing random failures.

**Observed:** 5/6 media files processed successfully; 1 failed silently. The failed file's `file_attachments` row was never created, causing it to render as plain text instead of a FileAttachmentCard.

**Root cause:** Resource contention — all deferred tasks share a single `waitUntil` budget. Not a systematic failure, but a probabilistic one under concurrent load.

## Solution

Move media processing from `waitUntil` (deferred) to **Cloudflare Queues** (async). Reuse the existing `line-message-queue` with a type discriminator to distinguish outbound messages from media processing jobs.

## Architecture

### Before (waitUntil)

```
Webhook Handler
  ├── SYNC: Save message + auto-reply
  └── DEFERRED (waitUntil, all parallel):
       ├── A. WebSocket broadcast (fast)
       ├── B. processLineMedia (SLOW)
       ├── C. message_updated broadcast
       ├── E. Activity logging (fast)
       └── F. Notifications (fast)
```

### After (queue-based)

```
Webhook Handler
  ├── SYNC: Save message + auto-reply
  ├── DEFERRED (waitUntil, fast only):
  │    ├── A. WebSocket broadcast
  │    ├── E. Activity logging
  │    └── F. Notifications
  └── QUEUE: LINE_MESSAGE_QUEUE.send({ type: 'media_processing', ... })
       ↓
Queue Consumer (separate Worker invocation, full resource budget)
  └── processLineMedia → R2 upload → file_attachments insert → message_updated broadcast
```

Each file gets its own queue message, processed in its own Worker invocation with full CPU/memory budget. No contention.

## Queue Payload

Discriminated union on the existing `line-message-queue`:

```typescript
// New media processing payload
interface MediaProcessingPayload {
  type: 'media_processing';
  messageId: string;           // DB message ID (for file_attachments.messageId)
  conversationId: string;      // For WebSocket message_updated broadcast
  teamId?: number;             // For team-scoped broadcast
  lineMessageId: string;       // LINE API message ID (for content download URL)
  lineMessageType: string;     // 'image' | 'file' | 'video' | 'audio'
  fileName?: string;           // Original filename (LINE file messages only)
  enqueuedAt: number;          // Timestamp for tracking
}

// Existing outbound message payload gets a type field
interface OutboundMessagePayload extends LineMessageQueuePayload {
  type: 'outbound_message';
}

// Union type for the queue
type LineQueuePayload = OutboundMessagePayload | MediaProcessingPayload;
```

**Backward compatibility:** Existing outbound messages that lack the `type` field are treated as `'outbound_message'` by default.

## Changes by File

### 1. `src/types/bindings.ts`

- Add `MediaProcessingPayload` interface
- Add `LineQueuePayload` union type
- Update `LINE_MESSAGE_QUEUE` generic type to `Queue<LineQueuePayload>`

### 2. `src/modules/integrations/handlers/line-message-handler.ts`

- Remove the `defer()` block for media processing (lines 260-308)
- Replace with `env.LINE_MESSAGE_QUEUE.send({ type: 'media_processing', ... })`
- Keep all other deferred tasks (WebSocket broadcast, activity logging, notifications) in `defer()`

### 3. `src/modules/queue/handlers/line-message-queue.ts`

- Update `processBatch` to check `message.body.type`
- Add `processMediaMessage()` method to `LineMessageQueueConsumer`
- Route `'media_processing'` messages to new handler
- Route `'outbound_message'` (or missing type for backward compat) to existing handler

### 4. `src/modules/integrations/services/webhook-media-service.ts`

- Remove retry logic (MAX_RETRIES loop) — queue handles retries natively at `max_retries=3`
- Simplify `processLineMedia` to single-attempt: download, store, return

### 5. `src/index.ts`

- Update queue handler type annotation from `LineMessageQueuePayload` to `LineQueuePayload`

## What Stays in waitUntil

Only fast, non-critical tasks:

| Task | Latency | Stays in defer? |
|------|---------|-----------------|
| A. WebSocket `new_message` broadcast | ~50ms | Yes |
| B. Media download + R2 upload | 1-10s | **No → Queue** |
| C. `message_updated` broadcast | ~50ms | **No → Queue** (after B completes) |
| E. Activity logging | ~20ms | Yes |
| F. Notifications | ~50ms | Yes |

## Error Handling

Queue retry flow (handled by Cloudflare Queues infrastructure):

```
Attempt 1 → fail → retry (~10s delay, automatic)
Attempt 2 → fail → retry (~30s delay, automatic)
Attempt 3 → fail → Dead Letter Queue (line-message-dlq)
```

**Frontend resilience** (already implemented):
- `file_attachments` empty + metadata has `fileName` → Priority 3 metadata synthesis renders FileAttachmentCard with LINE proxy URL
- `file_attachments` populated → FileAttachmentCard with permanent R2 URL
- No frontend changes needed

**DLQ monitoring:** Existing queue monitor dashboard already tracks DLQ messages.

## Queue Configuration

No changes to `wrangler.toml`. Existing config is suitable:

```toml
[[queues.producers]]
queue = "line-message-queue"
binding = "LINE_MESSAGE_QUEUE"

[[queues.consumers]]
queue = "line-message-queue"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 3
dead_letter_queue = "line-message-dlq"
```

## Testing

- Unit test: `processMediaMessage` correctly downloads, stores, broadcasts
- Integration test: Enqueue a media processing payload, verify file_attachments created
- Edge case: Payload with missing/expired LINE content URL → graceful failure + DLQ

## Not in Scope

- Separate queue for media processing (unnecessary complexity)
- Retry UI for failed media (DLQ + Priority 3 fallback is sufficient)
- Batch optimization (queue already serializes naturally)
