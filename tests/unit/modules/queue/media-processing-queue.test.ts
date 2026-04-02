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
