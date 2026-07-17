import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;

    constructor(ctx: DurableObjectState, env: Env) {
      this.ctx = ctx;
      this.env = env;
    }
  }
}));

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  selectResults: [] as unknown[],
  scheduleOrDeliverNow: vi.fn(),
  getRecallWindowSeconds: vi.fn(),
  deliver: vi.fn(),
  pushLineMessage: vi.fn(),
  createTextMessage: vi.fn(),
  createImageMessage: vi.fn(),
  createFileFlexMessage: vi.fn(),
  conversationFetch: vi.fn(),
  conversationGet: vi.fn(),
  conversationIdFromName: vi.fn(),
}));

function nextSelectResult() {
  const result = mocks.selectResults.shift();
  if (result instanceof Error) {
    throw result;
  }
  return result;
}

function makeSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => nextSelectResult()),
    all: vi.fn(async () => nextSelectResult()),
    get: vi.fn(async () => nextSelectResult()),
  };
  return chain;
}

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({ values: mocks.insertValues })),
    update: vi.fn(() => ({ set: mocks.updateSet })),
  })),
}));

vi.mock('@/services/recall-window-config', () => ({
  getRecallWindowSeconds: mocks.getRecallWindowSeconds,
}));

vi.mock('@modules/conversations/services/buffered-send-scheduler', () => ({
  scheduleOrDeliverNow: mocks.scheduleOrDeliverNow,
}));

vi.mock('@modules/conversations/services/message-delivery-service', () => ({
  MessageDeliveryService: vi.fn(function () {
    return { deliver: mocks.deliver };
  }),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000),
}));

vi.mock('@/utils/line', () => ({
  pushLineMessage: mocks.pushLineMessage,
  createTextMessage: mocks.createTextMessage,
  createImageMessage: mocks.createImageMessage,
  createFileFlexMessage: mocks.createFileFlexMessage,
}));

vi.mock('@/utils/file-url', () => ({
  getPublicFileUrl: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock('@/utils/sender-name-repair', () => ({
  resolveDisplaySenderName: vi.fn(),
}));

import { CustomerMessageDO } from '@/durable-objects/CustomerMessageDO';

function makeEnv(): Bindings {
  return {
    DB: {},
    CUSTOMER_CONVERSATION_DO: {
      idFromName: mocks.conversationIdFromName,
      get: mocks.conversationGet,
    },
  } as unknown as Bindings;
}

describe('CustomerMessageDO buffered delivery fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults = [];
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.getRecallWindowSeconds.mockResolvedValue(30);
    mocks.scheduleOrDeliverNow.mockResolvedValue({
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
      needsImmediateDelivery: true,
    });
    mocks.deliver.mockResolvedValue(undefined);
    mocks.conversationFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    mocks.conversationGet.mockReturnValue({ fetch: mocks.conversationFetch });
    mocks.conversationIdFromName.mockReturnValue('conversation-do-id');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('msg-1');
  });

  it('broadcasts and returns downgraded message state when scheduling buffered delivery fails', async () => {
    mocks.selectResults = [{ platform: 'line' }];

    const durableObject = new CustomerMessageDO({} as DurableObjectState, makeEnv());
    const response = await durableObject.fetch(new Request('https://customer-message-do/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conversation-Id': 'conv-1',
        'X-Session-Id': 'agent-1',
        'X-Authenticated-User-Id': 'agent-1',
        'X-Authenticated-Display-Name': 'Agent One',
      },
      body: JSON.stringify({
        content: 'hello',
        attachmentIds: [],
        platform: 'line',
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.scheduleOrDeliverNow).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      recallWindowSeconds: 30,
      canBuffer: true,
    }));
    expect(mocks.deliver).toHaveBeenCalledWith('msg-1');

    // Regression guard: when scheduling fails, delivery must run *after* the
    // initial new_message broadcast, never before — otherwise deliver()'s
    // message_updated event can race ahead of new_message on the wire and
    // the FE silently drops the update for a message it doesn't know yet.
    expect(mocks.conversationFetch.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deliver.mock.invocationCallOrder[0]);

    const notifyRequest = mocks.conversationFetch.mock.calls[0][0] as Request;
    const notifyBody = await notifyRequest.json() as {
      message: { deliveryStatus: string; isSent: boolean; recallDeadline: string | null };
    };
    expect(notifyBody.message).toEqual(expect.objectContaining({
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
    }));

    const body = await response.json() as {
      message: { deliveryStatus: string; isSent: boolean; recallDeadline: string | null };
    };
    expect(body.message).toEqual(expect.objectContaining({
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
    }));
  });

  it('falls back to immediate message creation when the optional platform lookup fails', async () => {
    mocks.selectResults = [
      new Error('temporary D1 failure'),
      [],
    ];

    const durableObject = new CustomerMessageDO({} as DurableObjectState, makeEnv());
    const response = await durableObject.fetch(new Request('https://customer-message-do/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conversation-Id': 'conv-1',
        'X-Session-Id': 'agent-1',
        'X-Authenticated-User-Id': 'agent-1',
        'X-Authenticated-Display-Name': 'Agent One',
      },
      body: JSON.stringify({
        content: 'hello',
        attachmentIds: [],
        platform: 'line',
      }),
    }));

    const body = await response.json() as {
      message: { deliveryStatus: string; isSent: boolean; recallDeadline: string | null };
    };

    expect(response.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      deliveryStatus: 'delivered',
      isSent: true,
      recallDeadline: null,
    }));
    expect(mocks.scheduleOrDeliverNow).not.toHaveBeenCalled();
    expect(body.message).toEqual(expect.objectContaining({
      deliveryStatus: 'delivered',
      isSent: true,
      recallDeadline: null,
    }));
  });

  it('survives post-insert attachment linking failure: alarm already armed, request still succeeds', async () => {
    mocks.selectResults = [{ platform: 'line' }];
    mocks.scheduleOrDeliverNow.mockResolvedValue({
      deliveryStatus: 'buffered',
      isSent: false,
      recallDeadline: '2026-01-15T12:00:30Z',
      needsImmediateDelivery: false,
    });
    mocks.updateWhere.mockRejectedValueOnce(new Error('attachment link failed'));

    const durableObject = new CustomerMessageDO({} as DurableObjectState, makeEnv());
    const response = await durableObject.fetch(new Request('https://customer-message-do/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conversation-Id': 'conv-1',
        'X-Session-Id': 'agent-1',
        'X-Authenticated-User-Id': 'agent-1',
        'X-Authenticated-Display-Name': 'Agent One',
      },
      body: JSON.stringify({
        content: 'hello',
        attachmentIds: ['att-1'],
        platform: 'line',
      }),
    }));

    // The alarm was armed before the linking failure, and the failure is
    // non-critical: the response must stay 200 (message row exists and the
    // buffered alarm will deliver it) instead of the previous 500-after-insert.
    const body = await response.json() as {
      success: boolean;
      message: { deliveryStatus: string; isSent: boolean };
    };
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toEqual(expect.objectContaining({
      deliveryStatus: 'buffered',
      isSent: false,
    }));
    expect(mocks.scheduleOrDeliverNow).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      messageId: 'msg-1',
      conversationId: 'conv-1',
      recallWindowSeconds: 30,
      canBuffer: true,
    }));
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('routes non-buffered LINE sends through MessageDeliveryService after the initial broadcast', async () => {
    mocks.getRecallWindowSeconds.mockResolvedValue(0);
    mocks.selectResults = [{
      customerId: 'customer-1',
      platform: 'line',
      platformUserId: 'line-user-1',
    }];

    const durableObject = new CustomerMessageDO({} as DurableObjectState, makeEnv());
    const response = await durableObject.fetch(new Request('https://customer-message-do/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conversation-Id': 'conv-1',
        'X-Session-Id': 'agent-1',
        'X-Authenticated-User-Id': 'agent-1',
        'X-Authenticated-Display-Name': 'Agent One',
      },
      body: JSON.stringify({
        content: 'hello',
        attachmentIds: [],
        platform: 'line',
      }),
    }));

    const body = await response.json() as {
      message: { deliveryStatus: string; isSent: boolean; recallDeadline: string | null };
    };

    expect(response.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
    }));
    expect(body.message).toEqual(expect.objectContaining({
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
    }));
    expect(mocks.scheduleOrDeliverNow).not.toHaveBeenCalled();
    expect(mocks.conversationFetch).toHaveBeenCalledTimes(1);
    expect(mocks.deliver).toHaveBeenCalledWith('msg-1');
    expect(mocks.conversationFetch.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deliver.mock.invocationCallOrder[0]);
    expect(mocks.pushLineMessage).not.toHaveBeenCalled();
    expect(mocks.createTextMessage).not.toHaveBeenCalled();
    expect(mocks.createImageMessage).not.toHaveBeenCalled();
    expect(mocks.createFileFlexMessage).not.toHaveBeenCalled();
  });

  it('memoizes recall-window reads within the same durable object instance', async () => {
    mocks.getRecallWindowSeconds.mockResolvedValue(30);
    mocks.selectResults = [
      { customerId: 'customer-1', platform: 'facebook', platformUserId: 'fb-user-1' },
      { customerId: 'customer-1', platform: 'facebook', platformUserId: 'fb-user-1' },
    ];

    const durableObject = new CustomerMessageDO({} as DurableObjectState, makeEnv());
    const makeRequest = () => new Request('https://customer-message-do/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Conversation-Id': 'conv-1',
        'X-Session-Id': 'agent-1',
        'X-Authenticated-User-Id': 'agent-1',
        'X-Authenticated-Display-Name': 'Agent One',
      },
      body: JSON.stringify({
        content: 'hello',
        attachmentIds: [],
        platform: 'facebook',
      }),
    });

    expect((await durableObject.fetch(makeRequest())).status).toBe(200);
    expect((await durableObject.fetch(makeRequest())).status).toBe(200);

    expect(mocks.getRecallWindowSeconds).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleOrDeliverNow).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});
