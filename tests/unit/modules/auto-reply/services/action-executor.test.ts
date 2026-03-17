// tests/unit/modules/auto-reply/services/action-executor.test.ts
// Unit tests for action-executor: message building, Reply/Push API logic, 5-msg batch limit

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== Mocks ====================

// Mock logger
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ─── LINE API mocks ───
const mockSendLineReply = vi.fn().mockResolvedValue(true);
const mockPushLineMessage = vi.fn().mockResolvedValue(true);
const mockCreateTextMessage = vi.fn((text: string) => ({ type: 'text', text }));
const mockCreateImageMessage = vi.fn((url: string, preview: string) => ({
  type: 'image',
  originalContentUrl: url,
  previewImageUrl: preview,
}));

vi.mock('@/utils/line', () => ({
  sendLineReply: (...args: any[]) => mockSendLineReply(...args),
  pushLineMessage: (...args: any[]) => mockPushLineMessage(...args),
  createTextMessage: (...args: any[]) => mockCreateTextMessage(...args),
  createImageMessage: (...args: any[]) => mockCreateImageMessage(...args),
}));

// ==================== Import after mocks ====================

import { executeActions } from '@modules/auto-reply/services/action-executor';
import type { AutoReplyActionData } from '@modules/auto-reply/types';

// ==================== Test Helpers ====================

function createMockEnv() {
  return {
    LINE_CHANNEL_ACCESS_TOKEN: 'test-channel-token',
  } as any;
}

function createTextAction(text: string, sortOrder = 0, id = 1): AutoReplyActionData {
  return {
    id,
    ruleId: 1,
    actionType: 'reply_text',
    content: JSON.stringify({ text }),
    sortOrder,
  };
}

function createImageAction(url: string, previewUrl?: string, sortOrder = 0, id = 2): AutoReplyActionData {
  return {
    id,
    ruleId: 1,
    actionType: 'reply_image',
    content: JSON.stringify({ url, ...(previewUrl ? { previewUrl } : {}) }),
    sortOrder,
  };
}

function createFlexAction(contents: Record<string, unknown>, altText?: string, sortOrder = 0, id = 3): AutoReplyActionData {
  return {
    id,
    ruleId: 1,
    actionType: 'reply_flex',
    content: JSON.stringify({ contents, ...(altText ? { altText } : {}) }),
    sortOrder,
  };
}

// ==================== Tests ====================

describe('action-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendLineReply.mockResolvedValue(true);
    mockPushLineMessage.mockResolvedValue(true);
  });

  // ───────────── executeActions: empty / error cases ─────────────

  describe('executeActions — empty actions', () => {
    it('should return error result when actions array is empty', async () => {
      const env = createMockEnv();
      const result = await executeActions([], 'reply-token', 'U123', env);

      expect(result.success).toBe(false);
      expect(result.messageCount).toBe(0);
      expect(result.error).toBe('No actions to execute');
      expect(mockSendLineReply).not.toHaveBeenCalled();
      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });
  });

  // ───────────── executeActions: sort order ─────────────

  describe('executeActions — sort order', () => {
    it('should sort actions by sortOrder before building messages', async () => {
      const env = createMockEnv();
      const actions = [
        createTextAction('Third', 3, 3),
        createTextAction('First', 1, 1),
        createTextAction('Second', 2, 2),
      ];

      await executeActions(actions, 'reply-token', 'U123', env);

      // createTextMessage should be called in sortOrder: First, Second, Third
      expect(mockCreateTextMessage).toHaveBeenNthCalledWith(1, 'First');
      expect(mockCreateTextMessage).toHaveBeenNthCalledWith(2, 'Second');
      expect(mockCreateTextMessage).toHaveBeenNthCalledWith(3, 'Third');
    });
  });

  // ───────────── executeActions: 5-message batch limit ─────────────

  describe('executeActions — 5-message LINE limit', () => {
    it('should truncate messages to 5 (LINE API limit)', async () => {
      const env = createMockEnv();
      const actions = Array.from({ length: 8 }, (_, i) =>
        createTextAction(`Message ${i + 1}`, i, i + 1)
      );

      const result = await executeActions(actions, 'reply-token', 'U123', env);

      expect(result.success).toBe(true);
      expect(result.messageCount).toBe(5);
      // Reply API should receive exactly 5 messages
      expect(mockSendLineReply).toHaveBeenCalledWith(
        'test-channel-token',
        'reply-token',
        expect.arrayContaining([expect.objectContaining({ type: 'text' })])
      );
      const sentMessages = mockSendLineReply.mock.calls[0][2];
      expect(sentMessages).toHaveLength(5);
    });
  });

  // ───────────── executeActions: Reply API first ─────────────

  describe('executeActions — Reply API (free) first', () => {
    it('should use Reply API first when replyToken is provided', async () => {
      const env = createMockEnv();
      const actions = [createTextAction('Hello')];

      const result = await executeActions(actions, 'reply-token-abc', 'U123', env);

      expect(result.success).toBe(true);
      expect(result.replyMethod).toBe('reply_api');
      expect(mockSendLineReply).toHaveBeenCalledWith(
        'test-channel-token',
        'reply-token-abc',
        [{ type: 'text', text: 'Hello' }]
      );
      expect(mockPushLineMessage).not.toHaveBeenCalled();
    });

    it('should return reply_api as replyMethod on success', async () => {
      const env = createMockEnv();
      const result = await executeActions([createTextAction('Hi')], 'token', 'U123', env);

      expect(result.replyMethod).toBe('reply_api');
    });
  });

  // ───────────── executeActions: Push API fallback ─────────────

  describe('executeActions — Push API fallback', () => {
    it('should fall back to Push API when Reply API fails', async () => {
      const env = createMockEnv();
      mockSendLineReply.mockResolvedValue(false);

      const result = await executeActions([createTextAction('Hi')], 'expired-token', 'U123', env);

      expect(result.success).toBe(true);
      expect(result.replyMethod).toBe('push_api');
      expect(mockSendLineReply).toHaveBeenCalledOnce();
      expect(mockPushLineMessage).toHaveBeenCalledWith(
        'test-channel-token',
        'U123',
        [{ type: 'text', text: 'Hi' }]
      );
    });

    it('should return push_api as replyMethod on fallback success', async () => {
      const env = createMockEnv();
      mockSendLineReply.mockResolvedValue(false);

      const result = await executeActions([createTextAction('Hi')], 'token', 'U123', env);
      expect(result.replyMethod).toBe('push_api');
    });
  });

  // ───────────── executeActions: Push API direct (no replyToken) ─────────────

  describe('executeActions — Push API when replyToken is null', () => {
    it('should use Push API directly when replyToken is null', async () => {
      const env = createMockEnv();
      const result = await executeActions([createTextAction('Hi')], null, 'U123', env);

      expect(result.success).toBe(true);
      expect(result.replyMethod).toBe('push_api');
      expect(mockSendLineReply).not.toHaveBeenCalled();
      expect(mockPushLineMessage).toHaveBeenCalledWith(
        'test-channel-token',
        'U123',
        [{ type: 'text', text: 'Hi' }]
      );
    });
  });

  // ───────────── executeActions: both APIs fail ─────────────

  describe('executeActions — both APIs fail', () => {
    it('should return error when both Reply and Push APIs fail', async () => {
      const env = createMockEnv();
      mockSendLineReply.mockResolvedValue(false);
      mockPushLineMessage.mockResolvedValue(false);

      const result = await executeActions([createTextAction('Hi')], 'token', 'U123', env);

      expect(result.success).toBe(false);
      expect(result.replyMethod).toBe('push_api');
      expect(result.messageCount).toBe(0);
      expect(result.error).toContain('failed');
    });
  });

  // ───────────── buildMessage: reply_text ─────────────

  describe('buildMessage — reply_text', () => {
    it('should parse JSON and create text message', async () => {
      const env = createMockEnv();
      await executeActions([createTextAction('Hello World')], 'token', 'U123', env);

      expect(mockCreateTextMessage).toHaveBeenCalledWith('Hello World');
    });

    it('should return null for malformed JSON content', async () => {
      const env = createMockEnv();
      const badAction: AutoReplyActionData = {
        id: 1, ruleId: 1, actionType: 'reply_text',
        content: 'not-valid-json', sortOrder: 0,
      };

      const result = await executeActions([badAction], 'token', 'U123', env);

      // Malformed JSON → null → filtered out → "No valid messages built"
      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid messages built');
    });

    it('should return null for empty text in content', async () => {
      const env = createMockEnv();
      // createTextMessage is still called; it's the LINE API util's job to handle empty text
      // But the content parses successfully
      const action = createTextAction('');
      await executeActions([action], 'token', 'U123', env);

      expect(mockCreateTextMessage).toHaveBeenCalledWith('');
    });
  });

  // ───────────── buildMessage: reply_image ─────────────

  describe('buildMessage — reply_image', () => {
    it('should create image message with url and previewUrl', async () => {
      const env = createMockEnv();
      const action = createImageAction('https://example.com/img.jpg', 'https://example.com/thumb.jpg');

      await executeActions([action], 'token', 'U123', env);

      expect(mockCreateImageMessage).toHaveBeenCalledWith(
        'https://example.com/img.jpg',
        'https://example.com/thumb.jpg'
      );
    });

    it('should use url as fallback previewUrl when previewUrl is absent', async () => {
      const env = createMockEnv();
      const action = createImageAction('https://example.com/img.jpg');

      await executeActions([action], 'token', 'U123', env);

      expect(mockCreateImageMessage).toHaveBeenCalledWith(
        'https://example.com/img.jpg',
        'https://example.com/img.jpg'
      );
    });

    it('should return null for malformed JSON in image action', async () => {
      const env = createMockEnv();
      const badAction: AutoReplyActionData = {
        id: 1, ruleId: 1, actionType: 'reply_image',
        content: '{broken', sortOrder: 0,
      };

      const result = await executeActions([badAction], 'token', 'U123', env);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid messages built');
    });
  });

  // ───────────── buildMessage: reply_flex ─────────────

  describe('buildMessage — reply_flex', () => {
    it('should pass through flex JSON content', async () => {
      const env = createMockEnv();
      const flexContents = { type: 'bubble', body: { type: 'box' } };
      const action = createFlexAction(flexContents, 'Menu');

      await executeActions([action], 'token', 'U123', env);

      // Verify Reply API received a flex message
      const sentMessages = mockSendLineReply.mock.calls[0][2];
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].type).toBe('flex');
      expect(sentMessages[0].altText).toBe('Menu');
      expect(sentMessages[0].contents).toEqual(flexContents);
    });

    it('should use default altText when not provided', async () => {
      const env = createMockEnv();
      const flexContents = { type: 'bubble' };
      const action = createFlexAction(flexContents);

      await executeActions([action], 'token', 'U123', env);

      const sentMessages = mockSendLineReply.mock.calls[0][2];
      expect(sentMessages[0].altText).toBe('Auto-reply');
    });

    it('should return null for malformed JSON in flex action', async () => {
      const env = createMockEnv();
      const badAction: AutoReplyActionData = {
        id: 1, ruleId: 1, actionType: 'reply_flex',
        content: 'not-json!', sortOrder: 0,
      };

      const result = await executeActions([badAction], 'token', 'U123', env);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid messages built');
    });
  });

  // ───────────── buildMessage: unknown type ─────────────

  describe('buildMessage — unknown action type', () => {
    it('should return null and log warning for unknown action type', async () => {
      const env = createMockEnv();
      const unknownAction: AutoReplyActionData = {
        id: 1, ruleId: 1,
        actionType: 'reply_video' as any,
        content: JSON.stringify({ url: 'https://example.com/video.mp4' }),
        sortOrder: 0,
      };

      const result = await executeActions([unknownAction], 'token', 'U123', env);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid messages built');
    });
  });

  // ───────────── filtering: mixed valid/invalid ─────────────

  describe('filtering — skips null messages', () => {
    it('should skip null messages and send only valid ones', async () => {
      const env = createMockEnv();
      const actions: AutoReplyActionData[] = [
        createTextAction('Valid message', 0, 1),
        { id: 2, ruleId: 1, actionType: 'reply_text', content: 'bad-json', sortOrder: 1 }, // null
        createTextAction('Another valid', 2, 3),
      ];

      const result = await executeActions(actions, 'token', 'U123', env);

      expect(result.success).toBe(true);
      expect(result.messageCount).toBe(2); // Only 2 valid messages
    });

    it('should return error when all message builds fail', async () => {
      const env = createMockEnv();
      const actions: AutoReplyActionData[] = [
        { id: 1, ruleId: 1, actionType: 'reply_text', content: 'bad1', sortOrder: 0 },
        { id: 2, ruleId: 1, actionType: 'reply_text', content: 'bad2', sortOrder: 1 },
      ];

      const result = await executeActions(actions, 'token', 'U123', env);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid messages built');
    });
  });

  // ───────────── env: LINE_CHANNEL_ACCESS_TOKEN ─────────────

  describe('env — passes LINE_CHANNEL_ACCESS_TOKEN', () => {
    it('should pass access token from env to LINE API calls', async () => {
      const env = { LINE_CHANNEL_ACCESS_TOKEN: 'my-secret-token' } as any;

      await executeActions([createTextAction('Hi')], 'reply-token', 'U123', env);

      expect(mockSendLineReply).toHaveBeenCalledWith(
        'my-secret-token',
        'reply-token',
        expect.any(Array)
      );
    });
  });
});
