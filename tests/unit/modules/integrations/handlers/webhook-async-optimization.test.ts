/**
 * Webhook inbound pipeline: what runs inline and what is handed to `defer` (waitUntil).
 *
 * - Auto-reply stays inline: the LINE replyToken expires, so it must run before the handler returns.
 * - The WebSocket broadcast and activity log are deferred: a slow broadcast never holds the webhook.
 * - LINE media goes to LINE_MESSAGE_QUEUE (one queue message per file), never inline.
 * - Facebook media is downloaded in a deferred task.
 * - Redelivered platform messages skip the whole pipeline.
 *
 * Customer creation and its distributed lock live in webhook-customer-service (tested there).
 *
 * @see src/modules/integrations/handlers/line-message-handler.ts
 * @see src/modules/integrations/handlers/facebook-event-processor.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockBroadcastNewMessage = vi.fn();
const mockBroadcastMessageEvent = vi.fn();
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn(function () {
    return { broadcastNewMessage: mockBroadcastNewMessage, broadcastMessageEvent: mockBroadcastMessageEvent };
  }),
}));

const mockLogActivity = vi.fn();
vi.mock('@modules/activities', () => ({
  ActivityService: vi.fn(function () {
    return { logActivity: mockLogActivity };
  }),
}));

const mockAutoReplyEvaluate = vi.fn();
const mockRetryAutoReply = vi.fn();
vi.mock('@modules/auto-reply/services/auto-reply-engine', () => ({
  evaluate: (...args: unknown[]) => mockAutoReplyEvaluate(...args),
  retryAutoReplyForPlatformMessage: (...args: unknown[]) => mockRetryAutoReply(...args),
  evaluateWelcome: vi.fn().mockResolvedValue({ matched: false }),
  invalidateRulesCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn().mockReturnValue('2026-03-19T00:00:00.000Z'),
  nowMs: vi.fn().mockReturnValue(1742342400000),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockFindOrCreateConversation = vi.fn();
const mockIsDuplicateMessage = vi.fn();
const mockSaveMessage = vi.fn();
vi.mock('@modules/integrations/services/webhook-conversation-service', () => ({
  findOrCreateConversation: (...args: unknown[]) => mockFindOrCreateConversation(...args),
  isDuplicateMessage: (...args: unknown[]) => mockIsDuplicateMessage(...args),
  notifyNewConversation: vi.fn().mockResolvedValue(undefined),
  saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
}));

const mockProcessLineMedia = vi.fn();
const mockProcessFacebookMedia = vi.fn();
vi.mock('@modules/integrations/services/webhook-media-service', () => ({
  processLineMedia: (...args: unknown[]) => mockProcessLineMedia(...args),
  processFacebookMedia: (...args: unknown[]) => mockProcessFacebookMedia(...args),
}));

const mockFindOrCreateCustomer = vi.fn();
vi.mock('@modules/integrations/services/webhook-customer-service', () => ({
  findOrCreateCustomer: (...args: unknown[]) => mockFindOrCreateCustomer(...args),
  triggerBackgroundSyncIfNeeded: vi.fn().mockResolvedValue(undefined),
  updateCustomerProfile: vi.fn().mockResolvedValue(undefined),
}));

// Only the team-assignment lookup and the replyToken write reach the DB directly.
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'where', 'orderBy', 'limit']) chain[method] = vi.fn(() => chain);
    chain.get = vi.fn().mockResolvedValue(null);
    return {
      select: vi.fn(() => chain),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    };
  }),
}));

import { processLineMessage } from '@modules/integrations/handlers/line-event-processor';
import { processFacebookMessage } from '@modules/integrations/handlers/facebook-event-processor';

const lineCustomer = { id: 1, platform: 'line', platformUserId: 'U1234567890abcdef', displayName: 'Test LINE User' };
const fbCustomer = { id: 2, platform: 'facebook', platformUserId: 'fb-user-123', displayName: 'Test FB User' };

function createEnv() {
  return {
    DB: {},
    LINE_MESSAGE_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
  };
}

const lineText = { id: 'msg-line-1', type: 'text', text: 'hello' };
const fbText = { mid: 'mid-fb-1', text: 'hello from facebook' };

function lineEvent(message: Record<string, unknown> | null = lineText) {
  return {
    type: 'message',
    timestamp: 1742342399000,
    source: { type: 'user', userId: 'U1234567890abcdef' },
    replyToken: 'mock-reply-token',
    message: message ?? undefined,
  } as never;
}

function fbMessaging(message: Record<string, unknown> | null = fbText) {
  return { sender: { id: 'fb-user-123' }, recipient: { id: 'page-123' }, timestamp: 1742342399000, message: message ?? undefined } as never;
}

/** Collects what the handler defers, so a test can let the deferred work run after the handler returned. */
function collectDeferred() {
  const deferred: Promise<unknown>[] = [];
  const defer = vi.fn((p: Promise<unknown>) => { deferred.push(p); });
  return { defer, settle: () => Promise.all(deferred) };
}

describe('webhook inbound pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOrCreateCustomer.mockImplementation(async (_env: unknown, _id: unknown, platform: unknown) =>
      platform === 'line' ? lineCustomer : fbCustomer);
    mockFindOrCreateConversation.mockResolvedValue({ id: 'conv-1', customerId: 1, assignedTeamId: 1, status: 'active' });
    mockIsDuplicateMessage.mockResolvedValue(false);
    mockSaveMessage.mockResolvedValue('msg-1');
    mockAutoReplyEvaluate.mockResolvedValue({ matched: false });
    mockRetryAutoReply.mockResolvedValue({ matched: false });
    mockLogActivity.mockResolvedValue({ id: 'activity-1' });
    mockBroadcastNewMessage.mockResolvedValue({ conversationBroadcast: true, globalBroadcast: true });
    mockBroadcastMessageEvent.mockResolvedValue(true);
    mockProcessFacebookMedia.mockResolvedValue(undefined);
  });

  describe('LINE processLineMessage', () => {
    it('does not wait for the broadcast: it returns while the deferred broadcast is still pending', async () => {
      mockBroadcastNewMessage.mockReturnValue(new Promise(() => {}));
      const { defer } = collectDeferred();

      await expect(processLineMessage(createEnv() as never, lineEvent(), defer)).resolves.toBeUndefined();

      expect(defer).toHaveBeenCalledTimes(2); // broadcast + activity log
      expect(mockBroadcastNewMessage).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: 'conv-1',
        source: 'webhook',
        teamId: 1,
        message: expect.objectContaining({ id: 'msg-1', senderType: 'customer', platform: 'line', content: 'hello' }),
      }));
    });

    it('logs the inbound message through a deferred task', async () => {
      const { defer, settle } = collectDeferred();

      await processLineMessage(createEnv() as never, lineEvent(), defer);
      await settle();

      expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({
        action: 'message_received',
        resourceId: 'conv-1',
        details: expect.objectContaining({ platform: 'line', messageId: 'msg-1' }),
      }));
    });

    it('runs auto-reply inline with the replyToken, before the deferred broadcast starts', async () => {
      const { defer } = collectDeferred();

      await processLineMessage(createEnv() as never, lineEvent(), defer);

      expect(mockAutoReplyEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv-1', replyToken: 'mock-reply-token', platformMessageId: 'msg-line-1' }),
        expect.anything()
      );
      expect(mockAutoReplyEvaluate.mock.invocationCallOrder[0])
        .toBeLessThan(mockBroadcastNewMessage.mock.invocationCallOrder[0]!);
    });

    it('enqueues image media for the queue consumer instead of downloading it inline', async () => {
      const env = createEnv();
      const { defer } = collectDeferred();

      await processLineMessage(env as never, lineEvent({ id: 'msg-line-img-1', type: 'image' }), defer);

      expect(env.LINE_MESSAGE_QUEUE.send).toHaveBeenCalledWith(expect.objectContaining({
        type: 'media_processing',
        messageId: 'msg-1',
        conversationId: 'conv-1',
        lineMessageId: 'msg-line-img-1',
        lineMessageType: 'image',
      }));
      expect(mockProcessLineMedia).not.toHaveBeenCalled();
    });

    it('enqueues nothing for text and sticker messages', async () => {
      const env = createEnv();

      await processLineMessage(env as never, lineEvent(), vi.fn());
      await processLineMessage(env as never, lineEvent({ id: 'msg-sticker', type: 'sticker', packageId: '1', stickerId: '2' }), vi.fn());

      expect(env.LINE_MESSAGE_QUEUE.send).not.toHaveBeenCalled();
      expect(mockSaveMessage).toHaveBeenCalledTimes(2);
    });

    it('a failed media enqueue does not fail the webhook (the message is already saved)', async () => {
      const env = createEnv();
      env.LINE_MESSAGE_QUEUE.send.mockRejectedValue(new Error('queue down'));

      await expect(processLineMessage(env as never, lineEvent({ id: 'img', type: 'image' }), vi.fn())).resolves.toBeUndefined();
      expect(mockSaveMessage).toHaveBeenCalledTimes(1);
    });

    it('skips the whole pipeline for a redelivered message but retries its auto-reply', async () => {
      mockIsDuplicateMessage.mockResolvedValue(true);
      const defer = vi.fn();

      await processLineMessage(createEnv() as never, lineEvent(), defer);

      expect(mockFindOrCreateCustomer).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockAutoReplyEvaluate).not.toHaveBeenCalled();
      expect(defer).not.toHaveBeenCalled();
      expect(mockRetryAutoReply).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        platform: 'line', platformMessageId: 'msg-line-1', replyToken: 'mock-reply-token',
      }));
    });

    it('returns early without touching the database when the event has no message', async () => {
      const defer = vi.fn();

      await processLineMessage(createEnv() as never, lineEvent(null), defer);

      expect(mockIsDuplicateMessage).not.toHaveBeenCalled();
      expect(mockFindOrCreateConversation).not.toHaveBeenCalled();
      expect(defer).not.toHaveBeenCalled();
    });

    it('throws when the customer cannot be found or created, so the event is retried', async () => {
      mockFindOrCreateCustomer.mockResolvedValue(null);

      await expect(processLineMessage(createEnv() as never, lineEvent(), vi.fn())).rejects.toThrow('Failed to find or create LINE user');
      expect(mockSaveMessage).not.toHaveBeenCalled();
    });
  });

  describe('Facebook processFacebookMessage', () => {
    it('defers the broadcast and the activity log, and processes no media for text', async () => {
      mockBroadcastNewMessage.mockReturnValue(new Promise(() => {}));
      const { defer } = collectDeferred();

      await expect(processFacebookMessage(createEnv() as never, fbMessaging(), defer)).resolves.toBeUndefined();

      expect(defer).toHaveBeenCalledTimes(2);
      expect(mockSaveMessage).toHaveBeenCalledWith(
        expect.anything(), 'conv-1', 2, 'hello from facebook', 'text', 'mid-fb-1', 'Test FB User', null, 'facebook', expect.any(Object)
      );
      expect(mockBroadcastNewMessage).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: 'conv-1',
        message: expect.objectContaining({ id: 'msg-1', platform: 'facebook', senderType: 'customer' }),
      }));
      expect(mockProcessFacebookMedia).not.toHaveBeenCalled();
    });

    it('downloads an image attachment in a deferred task, then announces the processed media', async () => {
      const { defer, settle } = collectDeferred();
      const messaging = fbMessaging({ mid: 'mid-fb-img-1', attachments: [{ type: 'image', payload: { url: 'https://example.com/image.jpg' } }] });

      await processFacebookMessage(createEnv() as never, messaging, defer);
      expect(defer).toHaveBeenCalledTimes(3); // broadcast + media + activity log
      await settle();

      expect(mockProcessFacebookMedia).toHaveBeenCalledWith(
        expect.anything(), 'msg-1', 'https://example.com/image.jpg', 'image', 'mid-fb-img-1', undefined
      );
      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message_updated', messageId: 'msg-1', data: { mediaProcessed: true },
      }));
    });

    it('skips the whole pipeline for a redelivered message', async () => {
      mockIsDuplicateMessage.mockResolvedValue(true);
      const defer = vi.fn();

      await processFacebookMessage(createEnv() as never, fbMessaging(), defer);

      expect(mockFindOrCreateCustomer).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(defer).not.toHaveBeenCalled();
    });

    it('returns early when the event has no message', async () => {
      await processFacebookMessage(createEnv() as never, fbMessaging(null), vi.fn());

      expect(mockIsDuplicateMessage).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
    });
  });
});
