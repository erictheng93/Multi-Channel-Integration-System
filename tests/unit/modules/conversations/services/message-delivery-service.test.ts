import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

type SelectResult = unknown[] | Record<string, unknown> | null | undefined;

const dbMocks = vi.hoisted(() => ({
  selectResults: [] as SelectResult[],
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  pushLineMessage: vi.fn(),
  createTextMessage: vi.fn((text: string) => ({ type: 'text', text })),
  createImageMessage: vi.fn((url: string) => ({
    type: 'image',
    originalContentUrl: url,
    previewImageUrl: url,
  })),
  createFileFlexMessage: vi.fn((url: string, name: string) => ({
    type: 'flex',
    altText: name,
    contents: { type: 'bubble', hero: { type: 'image', url } },
  })),
  broadcastMessageEvent: vi.fn(),
}));

function nextSelectResult(): SelectResult {
  return dbMocks.selectResults.shift();
}

function makeSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    get: vi.fn(async () => nextSelectResult()),
    then: (
      resolve: (value: SelectResult) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(nextSelectResult()).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => makeSelectChain()),
    update: vi.fn(() => ({
      set: dbMocks.updateSet,
    })),
  })),
}));

vi.mock('@/utils/line', () => ({
  pushLineMessage: dbMocks.pushLineMessage,
  createTextMessage: dbMocks.createTextMessage,
  createImageMessage: dbMocks.createImageMessage,
  createFileFlexMessage: dbMocks.createFileFlexMessage,
}));

vi.mock('@/utils/file-url', () => ({
  getSignedFileUrl: vi.fn(async (_bindings: Bindings, r2Key: string) => `https://files.test/${r2Key}`),
}));

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn(function () {
    return {
    broadcastMessageEvent: dbMocks.broadcastMessageEvent,
    };
  }),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { MessageDeliveryService } from '@/modules/conversations/services/message-delivery-service';

function makeEnv(): Bindings {
  return {
    DB: {},
    LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
  } as unknown as Bindings;
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    agentSenderId: 'agent-1',
    content: 'hello',
    metadata: null,
    isRecalled: false,
    isSent: false,
    ...overrides,
  };
}

function makeConversationData() {
  return [{
    conversation: { id: 'conv-1', customerId: 'customer-1' },
    customer: {
      id: 'customer-1',
      platform: 'line',
      platformUserId: 'line-user-1',
    },
  }];
}

describe('MessageDeliveryService.deliver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.selectResults = [];
    dbMocks.updateSet.mockReturnValue({ where: dbMocks.updateWhere });
    dbMocks.updateWhere.mockResolvedValue(undefined);
    dbMocks.pushLineMessage.mockResolvedValue(true);
    dbMocks.broadcastMessageEvent.mockResolvedValue(undefined);
  });

  it.each([
    ['recalled', { isRecalled: true }],
    ['already sent', { isSent: true }],
  ])('skips LINE delivery when the message is %s', async (_label, overrides) => {
    dbMocks.selectResults = [makeMessage(overrides)];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.pushLineMessage).not.toHaveBeenCalled();
    expect(dbMocks.updateSet).not.toHaveBeenCalled();
    expect(dbMocks.broadcastMessageEvent).not.toHaveBeenCalled();
  });

  it('pushes a normal buffered LINE message, marks it sent, and broadcasts the update', async () => {
    dbMocks.selectResults = [
      makeMessage({ deliveryStatus: 'buffered' }),
      makeConversationData(),
    ];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.pushLineMessage).toHaveBeenCalledWith(
      'line-token',
      'line-user-1',
      [{ type: 'text', text: 'hello' }]
    );
    expect(dbMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isSent: true,
      deliveryStatus: 'sent',
      platformMessageId: 'line_1768483200000',
      sentAt: '2026-01-15T12:00:00Z',
    }));
    expect(dbMocks.broadcastMessageEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'message_updated',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      data: expect.objectContaining({
        deliveryStatus: 'sent',
        isSent: true,
      }),
    }));
  });

  it('splits more than five LINE messages into multiple push batches', async () => {
    const attachmentIds = ['att-1', 'att-2', 'att-3', 'att-4', 'att-5', 'att-6'];
    const attachments = attachmentIds.map(id => ({
      id,
      filename: `${id}.png`,
      mimeType: 'image/png',
      fileUrl: `https://files.test/${id}.png`,
      r2Key: null,
    }));
    dbMocks.selectResults = [
      makeMessage({
        content: '',
        deliveryStatus: 'buffered',
        metadata: JSON.stringify({ attachmentIds }),
      }),
      makeConversationData(),
      attachments,
    ];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.pushLineMessage).toHaveBeenCalledTimes(2);
    expect(dbMocks.pushLineMessage.mock.calls[0][2]).toHaveLength(5);
    expect(dbMocks.pushLineMessage.mock.calls[1][2]).toHaveLength(1);
    expect(dbMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isSent: true,
      deliveryStatus: 'sent',
    }));
  });
});
