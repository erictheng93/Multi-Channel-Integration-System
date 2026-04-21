import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendFacebookMessage,
  sendLineMessage,
  sendToPlatform,
} from '@/durable-objects/delayed-message/retry-handler';
import type { PendingMessage, SchedulerLogger } from '@/durable-objects/delayed-message/types';
import type { Bindings } from '@/types';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const logger: SchedulerLogger = {
  info: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
};

function makeMessage(overrides: Partial<PendingMessage> = {}): PendingMessage {
  return {
    id: 'delayed-001',
    conversationId: 'conv-001',
    agentId: 'agent-001',
    content: 'Scheduled hello',
    messageType: 'text',
    platform: 'line',
    recipientPlatformId: 'recipient-001',
    scheduledAt: Date.now() + 60_000,
    status: 'pending',
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeEnv(): Bindings {
  return {
    LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
    FB_PAGE_ACCESS_TOKEN: 'facebook-token',
  } as Bindings;
}

describe('DelayedMessageScheduler platform delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('sends LINE delayed messages through the LINE push endpoint', async () => {
    const message = makeMessage({
      platform: 'line',
      recipientPlatformId: 'U123',
      content: 'LINE delayed message',
    });

    const result = await sendLineMessage(message, makeEnv(), logger);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer line-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          to: 'U123',
          messages: [{ type: 'text', text: 'LINE delayed message' }],
        }),
      })
    );
  });

  it('sends Facebook delayed messages through the Messenger endpoint', async () => {
    const message = makeMessage({
      platform: 'facebook',
      recipientPlatformId: 'FB123',
      content: 'Facebook delayed message',
    });

    const result = await sendFacebookMessage(message, makeEnv(), logger);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v18.0/me/messages?access_token=facebook-token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: 'FB123' },
          message: { text: 'Facebook delayed message' },
        }),
      })
    );
  });

  it('fails unsupported delayed-message platforms before delivery', async () => {
    await expect(
      sendToPlatform(
        { ...makeMessage(), platform: 'whatsapp' } as unknown as PendingMessage,
        makeEnv(),
        logger
      )
    ).rejects.toThrow('Unsupported platform: whatsapp');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
