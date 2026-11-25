import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/modules/integrations/services/webhook-media-service', () => ({
  processLineMedia: vi.fn(),
}));

const mockBroadcastMessageEvent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(function () {
    return {
      broadcastMessageEvent: mockBroadcastMessageEvent,
    };
  }),
}));

import { processLineMedia } from '@/modules/integrations/services/webhook-media-service';
import { LineMessageQueueConsumer } from '@/modules/queue/handlers/line-message-queue';
import type { MediaProcessingPayload } from '@/types/bindings';

const mockProcessLineMedia = vi.mocked(processLineMedia);

const mockDoFetch = vi.fn(async () => new Response('ok'));

function mediaPayload(overrides: Partial<MediaProcessingPayload> = {}): MediaProcessingPayload {
  return {
    type: 'media_processing',
    messageId: 'msg-1',
    conversationId: 'conv-1',
    lineMessageId: 'line-msg-1',
    lineMessageType: 'file',
    fileName: 'a.pdf',
    enqueuedAt: 0,
    ...overrides,
  };
}

// Minimal mock env
const mockEnv = {
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_MESSAGE_QUEUE: { send: vi.fn() },
  CUSTOMER_CONVERSATION_DO: {
    idFromName: vi.fn().mockReturnValue('mock-do-id'),
    get: vi.fn(() => ({ fetch: mockDoFetch })),
  },
  DB: {},
} as any;

describe('Media Processing Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBroadcastMessageEvent.mockResolvedValue(undefined);
  });

  describe('media processing queue retries', () => {
    it('acks media job when message_updated broadcast fails after media is stored', async () => {
      const attachment = {
        id: 'att-1',
        messageId: 'msg-1',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        fileUrl: 'https://example.com/test.jpg',
        r2Key: 'media/line/2026/6/att-1.jpg',
      };
      const payload: MediaProcessingPayload = {
        type: 'media_processing',
        messageId: 'msg-1',
        conversationId: 'conv-1',
        lineMessageId: 'line-msg-1',
        lineMessageType: 'image',
        enqueuedAt: Date.now(),
      };
      const queueMessage = {
        body: payload,
        ack: vi.fn(),
        retry: vi.fn(),
      };
      const batch = { messages: [queueMessage] } as any;

      mockProcessLineMedia.mockResolvedValue([attachment]);
      mockBroadcastMessageEvent.mockRejectedValueOnce(new Error('websocket down'));

      const consumer = new LineMessageQueueConsumer(mockEnv);
      await consumer.processBatch(batch);

      expect(mockProcessLineMedia).toHaveBeenCalledWith(
        mockEnv,
        'msg-1',
        'line-msg-1',
        'image',
        undefined
      );
      expect(queueMessage.ack).toHaveBeenCalledOnce();
      expect(queueMessage.retry).not.toHaveBeenCalled();
    });

    it('stores, broadcasts message_updated, notifies the conversation DO, then acks', async () => {
      const attachment = { id: 'att-2', filename: 'a.pdf' };
      mockProcessLineMedia.mockResolvedValue([attachment] as never);
      const queueMessage = { body: mediaPayload(), ack: vi.fn(), retry: vi.fn() };

      await new LineMessageQueueConsumer(mockEnv).processBatch({ messages: [queueMessage] } as any);

      expect(mockBroadcastMessageEvent).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message_updated',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        data: { file_attachments: [attachment] },
      }));
      expect(mockEnv.CUSTOMER_CONVERSATION_DO.idFromName).toHaveBeenCalledWith('conv-1');
      const doRequest = mockDoFetch.mock.calls[0]?.[0] as Request;
      expect(new URL(doRequest.url).pathname).toBe('/notify-message-updated');
      expect(queueMessage.ack).toHaveBeenCalledOnce();
      expect(queueMessage.retry).not.toHaveBeenCalled();
    });

    it('retries (does not ack) when processLineMedia stored nothing', async () => {
      mockProcessLineMedia.mockResolvedValue([]);
      const queueMessage = { body: mediaPayload(), ack: vi.fn(), retry: vi.fn() };

      await new LineMessageQueueConsumer(mockEnv).processBatch({ messages: [queueMessage] } as any);

      expect(queueMessage.retry).toHaveBeenCalledOnce();
      expect(queueMessage.ack).not.toHaveBeenCalled();
      expect(mockBroadcastMessageEvent).not.toHaveBeenCalled();
    });

    it('one failing job does not stop the rest of the batch', async () => {
      mockProcessLineMedia.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'att-3' }] as never);
      const failing = { body: mediaPayload(), ack: vi.fn(), retry: vi.fn() };
      const ok = { body: mediaPayload({ messageId: 'msg-2' }), ack: vi.fn(), retry: vi.fn() };

      await new LineMessageQueueConsumer(mockEnv).processBatch({ messages: [failing, ok] } as any);

      expect(failing.retry).toHaveBeenCalledOnce();
      expect(ok.ack).toHaveBeenCalledOnce();
    });
  });
});
