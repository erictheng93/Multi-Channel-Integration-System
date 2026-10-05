// Issue #43: LINE webhook must ack fast and hand events to the queue consumer,
// which runs the pipeline and awaits deferred work (the WebSocket broadcast).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@/services/webhook-signature-service', () => ({
  verifyWebhookSignature: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/modules/integrations/handlers/line-event-processor', () => ({
  processLineMessage: vi.fn(),
  processLineFollowEvent: vi.fn(),
  processLineUnfollowEvent: vi.fn(),
}));

vi.mock('@/utils/webhook-alert', () => ({
  alertWebhookFailure: vi.fn().mockResolvedValue(undefined),
}));

import { webhookHandler } from '@/modules/integrations/handlers/webhook';
import { LineMessageQueueConsumer } from '@/modules/queue/handlers/line-message-queue';
import { processLineMessage, processLineFollowEvent } from '@/modules/integrations/handlers/line-event-processor';

const messageEvent = {
  type: 'message',
  timestamp: 1791170000000,
  source: { type: 'user', userId: 'U1234567890abcdef' },
  replyToken: 'reply-token',
  message: { id: 'line-msg-1', type: 'text', text: 'hello' },
};

function postWebhook(env: Record<string, unknown>, events: unknown[]) {
  const app = new Hono();
  app.post('/api/webhook', (c) => webhookHandler.line(c as never));
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() };
  return app.request(
    '/api/webhook',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Line-Signature': 'sig' },
      body: JSON.stringify({ destination: 'Udest', events }),
    },
    env,
    ctx as never
  );
}

function makeBatch(body: unknown) {
  const message = { body, ack: vi.fn(), retry: vi.fn() };
  return { batch: { messages: [message] } as never, message };
}

describe('LINE webhook fast ack (issue #43)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enqueues handled events and returns 200 without processing inline', async () => {
    const sendBatch = vi.fn().mockResolvedValue(undefined);
    const res = await postWebhook(
      { LINE_CHANNEL_SECRET: 's', LINE_MESSAGE_QUEUE: { sendBatch } },
      [messageEvent, { ...messageEvent, type: 'postback' }]
    );

    expect(res.status).toBe(200);
    expect(processLineMessage).not.toHaveBeenCalled();
    expect(sendBatch).toHaveBeenCalledTimes(1);
    const sent = sendBatch.mock.calls[0][0];
    expect(sent).toHaveLength(1); // postback is not a handled type
    expect(sent[0].body).toMatchObject({ type: 'line_webhook_event', event: { message: { id: 'line-msg-1' } } });
  });

  it('returns 500 when enqueue fails so LINE redelivers', async () => {
    const sendBatch = vi.fn().mockRejectedValue(new Error('queue down'));
    const res = await postWebhook({ LINE_CHANNEL_SECRET: 's', LINE_MESSAGE_QUEUE: { sendBatch } }, [messageEvent]);
    expect(res.status).toBe(500);
  });

  it('consumer awaits deferred broadcast before acking', async () => {
    let broadcastDone = false;
    vi.mocked(processLineMessage).mockImplementation(async (_env, _event, defer) => {
      defer?.(new Promise((r) => setTimeout(() => { broadcastDone = true; r(null); }, 10)));
    });
    const { batch, message } = makeBatch({ type: 'line_webhook_event', event: messageEvent, enqueuedAt: 0 });

    await new LineMessageQueueConsumer({} as never).processBatch(batch);

    expect(broadcastDone).toBe(true);
    expect(message.ack).toHaveBeenCalled();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('consumer routes follow events and retries on failure', async () => {
    vi.mocked(processLineFollowEvent).mockRejectedValue(new Error('D1 unavailable'));
    const { batch, message } = makeBatch({
      type: 'line_webhook_event',
      event: { ...messageEvent, type: 'follow', message: undefined },
      enqueuedAt: 0,
    });

    await new LineMessageQueueConsumer({} as never).processBatch(batch);

    expect(processLineFollowEvent).toHaveBeenCalled();
    expect(message.retry).toHaveBeenCalled();
    expect(message.ack).not.toHaveBeenCalled();
  });
});
