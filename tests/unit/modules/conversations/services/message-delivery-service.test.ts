import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

type SelectResult = unknown[] | Record<string, unknown> | null | undefined;

const dbMocks = vi.hoisted(() => ({
  selectResults: [] as SelectResult[],
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  pushLineMessage: vi.fn(),
  sendLineReply: vi.fn(),
  claimReturning: vi.fn(),
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
  customerConversationFetch: vi.fn(),
  customerConversationGet: vi.fn(),
  customerConversationIdFromName: vi.fn(),
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
  sendLineReply: dbMocks.sendLineReply,
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
    CUSTOMER_CONVERSATION_DO: {
      idFromName: dbMocks.customerConversationIdFromName,
      get: dbMocks.customerConversationGet,
    },
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
    dbMocks.customerConversationFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    dbMocks.customerConversationGet.mockReturnValue({ fetch: dbMocks.customerConversationFetch });
    dbMocks.customerConversationIdFromName.mockReturnValue('conversation-do-id');
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

  it('stamps first_response_at with the message time once the platform accepted the reply', async () => {
    dbMocks.selectResults = [
      makeMessage({ deliveryStatus: 'buffered', createdAt: '2026-01-15T11:59:50Z' }),
      makeConversationData(),
    ];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.updateSet).toHaveBeenCalledWith({ firstResponseAt: '2026-01-15T11:59:50Z' });
  });

  it('does not stamp first_response_at when the platform rejected the reply', async () => {
    dbMocks.pushLineMessage.mockResolvedValue(false);
    dbMocks.selectResults = [
      makeMessage({ deliveryStatus: 'buffered', createdAt: '2026-01-15T11:59:50Z' }),
      makeConversationData(),
    ];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.updateSet).not.toHaveBeenCalledWith(expect.objectContaining({ firstResponseAt: expect.anything() }));
  });

  it('pushes both text and attachments for buffered LINE messages with mixed content', async () => {
    dbMocks.selectResults = [
      makeMessage({
        content: 'Please review the attached contract',
        deliveryStatus: 'buffered',
        metadata: JSON.stringify({ attachmentIds: ['att-1'] }),
      }),
      makeConversationData(),
      [{
        id: 'att-1',
        filename: 'contract.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        fileUrl: 'https://files.test/contract.pdf',
        r2Key: null,
      }],
    ];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.pushLineMessage).toHaveBeenCalledWith(
      'line-token',
      'line-user-1',
      [
        { type: 'text', text: 'Please review the attached contract' },
        {
          type: 'flex',
          altText: 'contract.pdf',
          contents: {
            type: 'bubble',
            hero: { type: 'image', url: 'https://files.test/contract.pdf' },
          },
        },
      ]
    );
    expect(dbMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isSent: true,
      deliveryStatus: 'sent',
    }));
  });

  it('notifies CustomerConversationDO when buffered LINE delivery status changes', async () => {
    dbMocks.selectResults = [
      makeMessage({ deliveryStatus: 'buffered' }),
      makeConversationData(),
    ];

    await new MessageDeliveryService(makeEnv()).deliver('msg-1');

    expect(dbMocks.customerConversationIdFromName).toHaveBeenCalledWith('conv-1');
    expect(dbMocks.customerConversationFetch).toHaveBeenCalledTimes(1);

    const request = dbMocks.customerConversationFetch.mock.calls[0][0] as Request;
    expect(new URL(request.url).pathname).toBe('/notify-message-updated');
    expect(request.method).toBe('POST');
    await expect(request.json()).resolves.toEqual({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      data: expect.objectContaining({
        deliveryStatus: 'sent',
        isSent: true,
        platformMessageId: 'line_1768483200000',
        timestamp: '2026-01-15T12:00:00Z',
      }),
    });
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

  it('does not reject when catch-path failed-status persistence also fails', async () => {
    dbMocks.selectResults = [
      makeMessage({ deliveryStatus: 'buffered' }),
      makeConversationData(),
    ];
    dbMocks.pushLineMessage.mockRejectedValueOnce(new Error('line unavailable'));
    dbMocks.updateWhere.mockRejectedValue(new Error('d1 unavailable'));

    await expect(new MessageDeliveryService(makeEnv()).deliver('msg-1')).resolves.toBeUndefined();
  });

  describe('LINE replyToken claim', () => {
    // The claim is a compare-and-swap: its select (the last one deliver() makes) reads the token,
    // then the first update(...).where(...).returning clears it; later updates are plain awaits.
    // Call after setting selectResults.
    function mockClaim(token: string | null, won = true) {
      dbMocks.selectResults.push(token === null ? undefined : { token });
      dbMocks.claimReturning.mockResolvedValue(won ? [{ id: 'conv-1' }] : []);
      dbMocks.updateWhere.mockReturnValueOnce({ returning: dbMocks.claimReturning });
    }

    it('uses the Reply API for the first batch when a token is claimed', async () => {
      dbMocks.sendLineReply.mockResolvedValue(true);
      dbMocks.selectResults = [makeMessage({ deliveryStatus: 'buffered' }), makeConversationData()];
      mockClaim('reply-token-1');

      await new MessageDeliveryService(makeEnv()).deliver('msg-1');

      expect(dbMocks.sendLineReply).toHaveBeenCalledWith('line-token', 'reply-token-1', [{ type: 'text', text: 'hello' }]);
      expect(dbMocks.pushLineMessage).not.toHaveBeenCalled();
      const metadata = JSON.parse(
        (dbMocks.updateSet.mock.calls.find(c => c[0]?.deliveryStatus)?.[0] as { metadata: string }).metadata
      ) as Record<string, unknown>;
      expect(metadata.lineDeliveryMethod).toBe('reply');
      expect(dbMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ isSent: true, deliveryStatus: 'sent' }));
    });

    it('pushes when the token is expired or absent (claim returns no row)', async () => {
      dbMocks.selectResults = [makeMessage({ deliveryStatus: 'buffered' }), makeConversationData()];
      mockClaim(null);

      await new MessageDeliveryService(makeEnv()).deliver('msg-1');

      expect(dbMocks.sendLineReply).not.toHaveBeenCalled();
      expect(dbMocks.pushLineMessage).toHaveBeenCalledTimes(1);
      const metadata = JSON.parse(
        (dbMocks.updateSet.mock.calls.find(c => c[0]?.deliveryStatus)?.[0] as { metadata: string }).metadata
      ) as Record<string, unknown>;
      expect(metadata.lineDeliveryMethod).toBe('push');
    });

    it('pushes when another delivery cleared the token first (lost compare-and-swap)', async () => {
      dbMocks.selectResults = [makeMessage({ deliveryStatus: 'buffered' }), makeConversationData()];
      mockClaim('reply-token-1', false);

      await new MessageDeliveryService(makeEnv()).deliver('msg-1');

      expect(dbMocks.sendLineReply).not.toHaveBeenCalled();
      expect(dbMocks.pushLineMessage).toHaveBeenCalledTimes(1);
    });

    it('falls back to push for the same batch when the Reply API fails', async () => {
      dbMocks.sendLineReply.mockResolvedValue(false);
      dbMocks.selectResults = [makeMessage({ deliveryStatus: 'buffered' }), makeConversationData()];
      mockClaim('reply-token-1');

      await new MessageDeliveryService(makeEnv()).deliver('msg-1');

      expect(dbMocks.sendLineReply).toHaveBeenCalledTimes(1);
      expect(dbMocks.pushLineMessage).toHaveBeenCalledWith('line-token', 'line-user-1', [{ type: 'text', text: 'hello' }]);
      const update = dbMocks.updateSet.mock.calls.find(c => c[0]?.deliveryStatus)?.[0] as { deliveryStatus: string; metadata: string };
      expect(update.deliveryStatus).toBe('sent');
      expect((JSON.parse(update.metadata) as Record<string, unknown>).lineDeliveryMethod).toBe('reply_fallback_push');
    });

    it('replies only the first batch of five and pushes the remainder', async () => {
      dbMocks.sendLineReply.mockResolvedValue(true);
      const attachmentIds = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
      dbMocks.selectResults = [
        makeMessage({ content: '', deliveryStatus: 'buffered', metadata: JSON.stringify({ attachmentIds }) }),
        makeConversationData(),
        attachmentIds.map(id => ({ id, filename: `${id}.png`, mimeType: 'image/png', fileUrl: `https://files.test/${id}.png`, r2Key: null })),
      ];
      mockClaim('reply-token-1');

      await new MessageDeliveryService(makeEnv()).deliver('msg-1');

      expect(dbMocks.sendLineReply.mock.calls[0][2]).toHaveLength(5);
      expect(dbMocks.pushLineMessage).toHaveBeenCalledTimes(1);
      expect(dbMocks.pushLineMessage.mock.calls[0][2]).toHaveLength(1);
    });
  });
});
