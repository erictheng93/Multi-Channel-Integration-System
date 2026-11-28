// POST /api/webhook/shopee: verify, enqueue, 200 with an empty body (spec §5).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/webhook-alert', () => ({
  alertWebhookFailure: vi.fn().mockResolvedValue(undefined),
  recordWebhookSignatureFailure: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/modules/integrations/handlers/shopee-event-processor', () => ({
  processShopeePush: vi.fn().mockResolvedValue(undefined),
}));

import { webhookRouter } from '@/modules/integrations/handlers/webhook';
import { LineMessageQueueConsumer } from '@/modules/queue/handlers/line-message-queue';
import { processShopeePush } from '@/modules/integrations/handlers/shopee-event-processor';
import { recordWebhookSignatureFailure } from '@/utils/webhook-alert';

const KEY = 'test-push-key';
const URL = 'https://example.test/api/webhook/shopee';
// python3: hmac.new(KEY, (URL + '|' + body).encode(), sha256).hexdigest()
const BODY = '{"shop_id":228029969,"code":10}';
const SIG = '052d2a7b0e9d07c1e0de60f35ed533d67743d65c272f435755f64e669d1c9963';
const EMPTY_OBJ_SIG = 'e96294d41c3439de4bba55c68b2e4cad9595b6de403e9ef94e6457b141c97b26';
const NOT_JSON_SIG = 'f3a861814a5365869c0aae7de3d3b3d06b3affc5c17c8beb8568c6865a805219';

function post(body: string, auth: string | undefined, envOverrides: Record<string, unknown> = {}) {
  const send = vi.fn().mockResolvedValue(undefined);
  const env = {
    SHOPEE_PUSH_PARTNER_KEY: KEY,
    SHOPEE_PUSH_CALLBACK_URL: URL,
    LINE_MESSAGE_QUEUE: { send },
    ...envOverrides,
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
  return {
    send,
    res: webhookRouter.request('/shopee', { method: 'POST', headers, body }, env, ctx as never),
  };
}

describe('Shopee webhook route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enqueues a signed push and returns 200 with an empty body', async () => {
    const { send, res } = post(BODY, SIG);
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'shopee_webhook_event', rawBody: BODY }));
  });

  it('returns 401 and records the failure on a bad signature', async () => {
    const { send, res } = post(BODY, 'deadbeef');
    expect((await res).status).toBe(401);
    expect(recordWebhookSignatureFailure).toHaveBeenCalledWith(expect.anything(), 'shopee', expect.any(String));
    expect(send).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    expect((await post(BODY, undefined).res).status).toBe(401);
  });

  it('returns 503 when the push key or callback URL is not configured', async () => {
    expect((await post(BODY, SIG, { SHOPEE_PUSH_PARTNER_KEY: undefined }).res).status).toBe(503);
    expect((await post(BODY, SIG, { SHOPEE_PUSH_CALLBACK_URL: '' }).res).status).toBe(503);
  });

  it('returns 500 when enqueue fails so Shopee retries', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'));
    const { res } = post(BODY, SIG, { LINE_MESSAGE_QUEUE: { send } });
    expect((await res).status).toBe(500);
  });

  it.each([
    ['{}', EMPTY_OBJ_SIG],
    ['not json', NOT_JSON_SIG],
  ])('acks a signed body without a push code (Console verify): %s', async (body, sig) => {
    const { send, res } = post(body, sig);
    const r = await res;
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('queue consumer shopee branch', () => {
  beforeEach(() => vi.clearAllMocks());

  function batchOf(body: unknown) {
    const message = { body, ack: vi.fn(), retry: vi.fn() };
    return { batch: { messages: [message] } as never, message };
  }

  it('dispatches to the processor and acks', async () => {
    const { batch, message } = batchOf({ type: 'shopee_webhook_event', rawBody: BODY, enqueuedAt: 0 });
    await new LineMessageQueueConsumer({} as never).processBatch(batch);
    expect(processShopeePush).toHaveBeenCalledWith(expect.anything(), BODY);
    expect(message.ack).toHaveBeenCalled();
  });

  it('retries when the processor throws', async () => {
    vi.mocked(processShopeePush).mockRejectedValueOnce(new Error('D1 down'));
    const { batch, message } = batchOf({ type: 'shopee_webhook_event', rawBody: BODY, enqueuedAt: 0 });
    await new LineMessageQueueConsumer({} as never).processBatch(batch);
    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
  });
});
