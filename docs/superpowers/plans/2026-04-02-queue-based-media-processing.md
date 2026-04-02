# Queue-based LINE Media Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move LINE media file processing from `waitUntil` (deferred) to Cloudflare Queues to eliminate resource contention when multiple files arrive simultaneously.

**Architecture:** Add a `MediaProcessingPayload` type to the existing `line-message-queue`. The webhook handler enqueues a message instead of calling `processLineMedia` in `defer()`. The queue consumer routes by `type` field — existing outbound messages go to the current handler, media processing goes to a new handler that downloads from LINE API, uploads to R2, inserts `file_attachments`, and broadcasts `message_updated`.

**Tech Stack:** Cloudflare Queues (existing), Cloudflare Workers, R2, D1/Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-04-02-queue-based-media-processing-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/bindings.ts` | Add `MediaProcessingPayload`, `LineQueuePayload` union type |
| Modify | `src/modules/queue/handlers/line-message-queue.ts` | Add `processMediaMessage()`, route by `type` |
| Modify | `src/modules/integrations/handlers/line-message-handler.ts` | Replace `defer(processLineMedia(...))` with `queue.send()` |
| Modify | `src/modules/integrations/services/webhook-media-service.ts` | Remove retry loop (queue handles retries) |
| Modify | `src/index.ts` | Update queue type annotation |
| Create | `tests/unit/modules/queue/media-processing-queue.test.ts` | Unit tests for queue consumer media processing |

---

### Task 1: Add Queue Payload Types

**Files:**
- Modify: `src/types/bindings.ts:207-254`

- [ ] **Step 1: Add MediaProcessingPayload interface and union type**

In `src/types/bindings.ts`, after the existing `LineMessageAttachment` interface (line 254), add the new types. Also update the `LineMessageQueuePayload` to include an optional `type` field for backward compatibility:

```typescript
// After line 254 (end of LineMessageAttachment interface), add:

// =================== Media Processing Queue Types ===================

/**
 * Media Processing Queue Payload
 * Enqueued by webhook handler when LINE sends image/file/video/audio.
 * Processed by queue consumer: downloads from LINE API, stores in R2,
 * creates file_attachments row, broadcasts message_updated via WebSocket.
 */
export interface MediaProcessingPayload {
  type: 'media_processing';
  messageId: string;           // DB message ID (for file_attachments.messageId)
  conversationId: string;      // For WebSocket message_updated broadcast
  teamId?: number;             // For team-scoped broadcast
  lineMessageId: string;       // LINE API message ID (for content download URL)
  lineMessageType: string;     // 'image' | 'file' | 'video' | 'audio'
  fileName?: string;           // Original filename (LINE file messages only)
  enqueuedAt: number;          // Timestamp for tracking
}

/**
 * Union type for all queue message payloads.
 * The queue consumer uses the `type` field to route to the correct handler.
 * Messages without a `type` field are treated as outbound messages (backward compat).
 */
export type LineQueuePayload = (LineMessageQueuePayload & { type?: 'outbound_message' }) | MediaProcessingPayload;
```

- [ ] **Step 2: Update LINE_MESSAGE_QUEUE type**

In `src/types/bindings.ts`, change the queue generic type (around line 39):

```typescript
// Before:
LINE_MESSAGE_QUEUE: Queue<LineMessageQueuePayload>;
LINE_MESSAGE_DLQ: Queue<LineMessageQueuePayload>;

// After:
LINE_MESSAGE_QUEUE: Queue<LineQueuePayload>;
LINE_MESSAGE_DLQ: Queue<LineQueuePayload>;
```

- [ ] **Step 3: Run backend type check**

Run: `npx tsc --noEmit`
Expected: Type errors in `line-message-queue.ts` and `index.ts` because the queue consumer still expects `LineMessageQueuePayload` — this is expected and will be fixed in Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/types/bindings.ts
git commit -m "feat: add MediaProcessingPayload type for queue-based media processing"
```

---

### Task 2: Update Queue Consumer to Route by Type

**Files:**
- Modify: `src/modules/queue/handlers/line-message-queue.ts`
- Modify: `src/index.ts:843-849`

- [ ] **Step 1: Update queue consumer to handle both message types**

In `src/modules/queue/handlers/line-message-queue.ts`, update the imports and add type routing:

Replace the import line (line 17):
```typescript
// Before:
import type { Bindings, LineMessageQueuePayload, LineMessageQueueResult } from '@/types/bindings';

// After:
import type { Bindings, LineMessageQueuePayload, LineMessageQueueResult, MediaProcessingPayload, LineQueuePayload } from '@/types/bindings';
```

Add the media processing imports after line 23:
```typescript
import { processLineMedia } from '@/modules/integrations/services/webhook-media-service';
```

- [ ] **Step 2: Update processBatch to route by type**

Replace the `processBatch` method (lines 45-79) with:

```typescript
  /**
   * Process a batch of messages from the queue
   * Routes to outbound message handler or media processing handler based on payload type
   */
  async processBatch(batch: MessageBatch<LineQueuePayload>): Promise<void> {
    log.info('Processing batch', { count: batch.messages.length });

    for (const message of batch.messages) {
      try {
        const payload = message.body;

        // Route by type: media_processing vs outbound_message (default)
        if (payload.type === 'media_processing') {
          await this.processMediaMessage(payload as MediaProcessingPayload);
          message.ack();
          log.info('Media processing completed', { messageId: payload.messageId });
        } else {
          // Outbound message (existing behavior, backward compatible for messages without type)
          const result = await this.processMessage(payload as LineMessageQueuePayload);
          if (result.success) {
            message.ack();
            log.info('Message delivered successfully', { messageId: result.messageId });
          } else {
            message.retry();
            log.warn('Message failed, will retry', { messageId: result.messageId, error: result.error });
          }
        }
      } catch (error) {
        const messageId = message.body.messageId || 'unknown';
        log.error('Error processing queue message', { messageId }, error instanceof Error ? error : String(error));
        message.retry();
      }
    }
  }
```

- [ ] **Step 3: Add processMediaMessage method**

Add this method to the `LineMessageQueueConsumer` class, after the `processMessage` method:

```typescript
  /**
   * Process a media processing message
   * Downloads file from LINE API, stores in R2, creates file_attachments,
   * and broadcasts message_updated via WebSocket
   */
  private async processMediaMessage(payload: MediaProcessingPayload): Promise<void> {
    const { messageId, conversationId, teamId, lineMessageId, lineMessageType, fileName } = payload;

    log.info('Processing media from queue', { messageId, lineMessageId, lineMessageType, fileName });

    // Step 1: Download from LINE API + upload to R2 + insert file_attachments
    const fileAttachmentData = await processLineMedia(
      this.env, messageId, lineMessageId, lineMessageType, fileName
    );

    if (fileAttachmentData.length === 0) {
      // processLineMedia returns [] on failure — let queue retry
      throw new Error(`Media processing failed for LINE message ${lineMessageId}`);
    }

    // Step 2: Broadcast message_updated to global WebSocket (conversation list)
    await this.broadcastService.broadcastMessageEvent({
      type: 'message_updated',
      conversationId,
      messageId,
      data: { file_attachments: fileAttachmentData },
      priority: 'high'
    });

    // Step 3: Notify CustomerConversationDO directly (conversation detail page)
    try {
      if (this.env.CUSTOMER_CONVERSATION_DO) {
        const doId = this.env.CUSTOMER_CONVERSATION_DO.idFromName(conversationId);
        const doStub = this.env.CUSTOMER_CONVERSATION_DO.get(doId);
        await doStub.fetch(new Request('https://customer-conversation-do/notify-message-updated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            messageId,
            data: { file_attachments: fileAttachmentData }
          })
        }));
      }
    } catch (doErr) {
      log.warn('CustomerConversationDO message_updated notify failed', {
        error: doErr instanceof Error ? doErr.message : String(doErr)
      });
      // Non-critical — don't throw, media is already stored
    }

    log.info('Media processing complete', { messageId, lineMessageId, attachments: fileAttachmentData.length });
  }
```

- [ ] **Step 4: Update index.ts queue handler type**

In `src/index.ts`, update the import (line 29) and queue handler (lines 843-849):

```typescript
// Line 29 - update import:
// Before:
import type { LineMessageQueuePayload } from './types/bindings';
// After:
import type { LineQueuePayload } from './types/bindings';

// Lines 843-849 - update queue handler:
  async queue(
    batch: MessageBatch<LineQueuePayload>,
    env: Bindings
  ): Promise<void> {
    log.info('LINE Queue received batch', { messageCount: batch.messages.length });
    await handleLineMessageQueue(batch, env);
  },
```

- [ ] **Step 5: Update handleLineMessageQueue signature**

In `src/modules/queue/handlers/line-message-queue.ts`, update the export function (line 289):

```typescript
// Before:
export async function handleLineMessageQueue(
  batch: MessageBatch<LineMessageQueuePayload>,
  env: Bindings
): Promise<void> {

// After:
export async function handleLineMessageQueue(
  batch: MessageBatch<LineQueuePayload>,
  env: Bindings
): Promise<void> {
```

- [ ] **Step 6: Run backend type check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 7: Commit**

```bash
git add src/modules/queue/handlers/line-message-queue.ts src/index.ts
git commit -m "feat: add media processing handler to queue consumer with type routing"
```

---

### Task 3: Replace defer() with Queue.send() in Webhook Handler

**Files:**
- Modify: `src/modules/integrations/handlers/line-message-handler.ts:260-307`

- [ ] **Step 1: Replace the deferred media processing block**

In `src/modules/integrations/handlers/line-message-handler.ts`, replace lines 260-308 (the entire `// B+C. Media processing` block) with:

```typescript
    // B+C. Media processing via Queue (replaces defer for reliability)
    // Each file gets its own queue message → own Worker invocation → no resource contention
    if (mediaData && correctedMessageType !== 'location' && correctedMessageType !== 'sticker') {
      try {
        await env.LINE_MESSAGE_QUEUE.send({
          type: 'media_processing' as const,
          messageId,
          conversationId: convId,
          teamId: convTeamId ?? undefined,
          lineMessageId: message.id,
          lineMessageType: correctedMessageType,
          fileName: message.fileName,
          enqueuedAt: Date.now(),
        });
        log.debug('Enqueued media processing', { messageId, lineMessageId: message.id, type: correctedMessageType });
      } catch (queueErr) {
        log.error('Failed to enqueue media processing', {
          messageId,
          lineMessageId: message.id,
          error: queueErr instanceof Error ? queueErr.message : String(queueErr)
        });
        // Non-critical: message is already saved, frontend has metadata fallback
      }
    }
```

Also remove the `processLineMedia` import if it's no longer used in this file. Check the imports at the top of the file:

```typescript
// Remove this import if present (it's now only used in the queue consumer):
// import { processLineMedia } from '@/modules/integrations/services/webhook-media-service';
```

- [ ] **Step 2: Run backend type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/integrations/handlers/line-message-handler.ts
git commit -m "feat: replace defer(processLineMedia) with queue.send() in LINE webhook handler"
```

---

### Task 4: Simplify webhook-media-service (Remove Retry Loop)

**Files:**
- Modify: `src/modules/integrations/services/webhook-media-service.ts:17-81`

- [ ] **Step 1: Remove retry logic from processLineMedia**

The queue now handles retries at the infrastructure level (`max_retries=3` in wrangler.toml). Remove the manual retry loop and simplify to a single attempt:

Replace lines 17-81 with:

```typescript
/**
 * Process a LINE media message: download content from LINE API, upload to R2,
 * and insert a file_attachments record.
 * Returns the array of file attachment data for broadcast inclusion.
 *
 * Note: Retries are handled by Cloudflare Queue (max_retries=3).
 * This function is single-attempt — throws on failure so queue can retry.
 */
export async function processLineMedia(
  env: Bindings,
  messageId: string,
  lineMessageId: string,
  lineMessageType: string,
  fileName?: string
): Promise<any[]> {
  log.info('Processing media', { lineMessageId, lineMessageType, fileName });

  const { processLineMediaMessage } = await import('@/utils/file-storage');

  const mediaFile = await processLineMediaMessage(
    env,
    lineMessageId,
    lineMessageType,
    fileName
  );

  if (!mediaFile) {
    log.error('Media download/upload failed', { lineMessageId, lineMessageType });
    return [];
  }

  const newFileAttachment = {
    id: mediaFile.id,
    messageId: messageId,
    filename: mediaFile.filename,
    mimeType: mediaFile.mimeType,
    fileSize: mediaFile.size,
    fileUrl: mediaFile.url,
    r2Key: mediaFile.r2Key,
    createdAt: nowISO()
  };

  // Store to database
  const drizzleDb = createDbClient(env.DB);
  await drizzleDb.insert(fileAttachments).values(newFileAttachment);

  log.info('Media processed and stored', { filename: mediaFile.filename, messageId });

  return [newFileAttachment];
}
```

- [ ] **Step 2: Run backend type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/integrations/services/webhook-media-service.ts
git commit -m "refactor: remove manual retry loop from processLineMedia — queue handles retries"
```

---

### Task 5: Write Unit Tests

**Files:**
- Create: `tests/unit/modules/queue/media-processing-queue.test.ts`

- [ ] **Step 1: Write tests for queue consumer media processing**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/modules/integrations/services/webhook-media-service', () => ({
  processLineMedia: vi.fn(),
}));

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { processLineMedia } from '@/modules/integrations/services/webhook-media-service';
import type { MediaProcessingPayload } from '@/types/bindings';

const mockProcessLineMedia = vi.mocked(processLineMedia);

// Minimal mock env
const mockEnv = {
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_MESSAGE_QUEUE: { send: vi.fn() },
  CUSTOMER_CONVERSATION_DO: {
    idFromName: vi.fn().mockReturnValue('mock-do-id'),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response('ok')),
    }),
  },
  DB: {},
} as any;

describe('Media Processing Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('payload type routing', () => {
    it('should treat messages without type field as outbound messages', () => {
      const payload = { messageId: 'msg-1', conversationId: 'conv-1', content: 'hello' };
      // type is undefined → should NOT be treated as media_processing
      expect(payload.type).toBeUndefined();
      expect((payload as any).type !== 'media_processing').toBe(true);
    });

    it('should identify media_processing payloads by type field', () => {
      const payload: MediaProcessingPayload = {
        type: 'media_processing',
        messageId: 'msg-1',
        conversationId: 'conv-1',
        lineMessageId: '12345',
        lineMessageType: 'file',
        fileName: 'test.pdf',
        enqueuedAt: Date.now(),
      };
      expect(payload.type).toBe('media_processing');
    });
  });

  describe('processLineMedia integration', () => {
    it('should return file attachment data on success', async () => {
      const mockAttachment = {
        id: 'att-1',
        messageId: 'msg-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        fileUrl: 'https://s3.example.com/test.pdf',
        r2Key: 'media/line/2026/4/att-1.pdf',
      };

      mockProcessLineMedia.mockResolvedValue([mockAttachment]);

      const result = await processLineMedia(
        mockEnv, 'msg-1', '12345', 'file', 'test.pdf'
      );

      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('test.pdf');
      expect(result[0].mimeType).toBe('application/pdf');
    });

    it('should return empty array on download failure', async () => {
      mockProcessLineMedia.mockResolvedValue([]);

      const result = await processLineMedia(
        mockEnv, 'msg-1', '12345', 'file', 'test.pdf'
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('queue enqueue from webhook', () => {
    it('should create correct media processing payload', () => {
      const payload: MediaProcessingPayload = {
        type: 'media_processing',
        messageId: 'db-msg-id',
        conversationId: 'conv-123',
        teamId: 1,
        lineMessageId: '607779918352744688',
        lineMessageType: 'file',
        fileName: 'report.pdf',
        enqueuedAt: 1775096368979,
      };

      expect(payload.type).toBe('media_processing');
      expect(payload.lineMessageId).toBe('607779918352744688');
      expect(payload.lineMessageType).toBe('file');
      expect(payload.fileName).toBe('report.pdf');
    });

    it('should omit teamId when not assigned', () => {
      const payload: MediaProcessingPayload = {
        type: 'media_processing',
        messageId: 'db-msg-id',
        conversationId: 'conv-123',
        lineMessageId: '12345',
        lineMessageType: 'image',
        enqueuedAt: Date.now(),
      };

      expect(payload.teamId).toBeUndefined();
      expect(payload.fileName).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `bunx vitest run tests/unit/modules/queue/media-processing-queue.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/modules/queue/media-processing-queue.test.ts
git commit -m "test: add unit tests for queue-based media processing"
```

---

### Task 6: Deploy and Verify

- [ ] **Step 1: Run full backend type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Deploy backend**

Run: `bun run deploy`
Expected: Successful deployment with no errors

- [ ] **Step 3: Verify by sending a LINE file message**

Send a file (PDF, image, etc.) from LINE to the system. Check:
1. Message appears in chat immediately as text or metadata-synthesized FileAttachmentCard
2. Within 10-30 seconds, FileAttachmentCard upgrades to R2 URL (permanent)
3. Worker logs show `Enqueued media processing` in webhook handler
4. Worker logs show `Media processing completed` in queue consumer

- [ ] **Step 4: Verify batch sending (multiple files at once)**

Send 3+ files simultaneously from LINE. Check:
1. All files eventually get `file_attachments` rows (no silent failures)
2. Each file processed by a separate queue consumer invocation
3. No more random failures under concurrent load

- [ ] **Step 5: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix: adjustments from production verification"
```
