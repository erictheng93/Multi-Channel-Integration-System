import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DelayedMessageService } from '@modules/messaging/services/delayed-message-service';
import type { DelayedMessage } from '@modules/messaging/types/message-types';

const processQueueMessage = vi.hoisted(() => vi.fn());

vi.mock('@modules/delayed-message/services/MessageProcessorService', () => ({
  MessageProcessorService: vi.fn(function () {
    return {
      processQueueMessage,
    };
  }),
}));

describe('legacy DelayedMessageService processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processQueueMessage.mockResolvedValue({ success: true });
  });

  it('delegates due LINE/Facebook sends to the platform processor instead of marking sent locally first', async () => {
    const service = new DelayedMessageService({} as D1Database, {
      DB: {},
      SESSIONS: {
        delete: vi.fn(),
      },
    } as unknown as ConstructorParameters<typeof DelayedMessageService>[1]);

    vi.spyOn(service, 'findDelayedMessageById').mockResolvedValue({
      id: 'delayed-1',
      conversationId: 'conv-1',
      agentId: 'agent-1',
      content: 'hello',
      messageType: 'text',
      scheduledAt: '2026-01-01T00:00:00.000Z',
      status: 'pending',
      platform: 'line',
      recipientPlatformId: 'U123',
      metadata: {
        platform: 'line',
        recipientPlatformId: 'U123',
      },
    } as DelayedMessage);

    const result = await service.processDelayedSend('delayed-1');

    expect(result.success).toBe(true);
    expect(processQueueMessage).toHaveBeenCalledWith('delayed-1');
  });
});
