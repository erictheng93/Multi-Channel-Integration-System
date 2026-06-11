import { Hono } from 'hono';
import type { Bindings, LineMessageQueuePayload, LineQueuePayload } from '@/types/bindings';
import type { DurableObjectEvent } from '@/types/websocket-types';
import { LineMessageQueueConsumer } from '@/modules/queue/handlers/line-message-queue';
import { nowMs } from '@/utils/timestamp';

type DrillEnv = Bindings & {
  OPERATIONAL_DRILLS_ENABLED?: string;
  OPERATIONAL_DRILL_TOKEN?: string;
};

type DrillResult = {
  name: 'queue-retry' | 'do-alarm' | 'broadcast-failure';
  success: boolean;
  details: Record<string, unknown>;
};

type FakeQueueMessage = {
  body: LineQueuePayload;
  ack: () => void;
  retry: () => void;
};

export function isOperationalDrillAuthorized(
  env: Pick<DrillEnv, 'ENVIRONMENT' | 'OPERATIONAL_DRILLS_ENABLED' | 'OPERATIONAL_DRILL_TOKEN'>,
  token: string | undefined
): { authorized: true } | { authorized: false; status: number; error: string } {
  if (env.ENVIRONMENT !== 'staging') {
    return { authorized: false, status: 404, error: 'Operational drills are only available in staging' };
  }

  if (env.OPERATIONAL_DRILLS_ENABLED !== 'true') {
    return { authorized: false, status: 404, error: 'Operational drills are disabled' };
  }

  if (!env.OPERATIONAL_DRILL_TOKEN) {
    return { authorized: false, status: 503, error: 'Operational drill token is not configured' };
  }

  if (!token || token !== env.OPERATIONAL_DRILL_TOKEN) {
    return { authorized: false, status: 401, error: 'Invalid operational drill token' };
  }

  return { authorized: true };
}

async function runQueueRetryDrill(env: Bindings): Promise<DrillResult> {
  let ackCount = 0;
  let retryCount = 0;
  const payload: LineMessageQueuePayload & { type: 'outbound_message' } = {
    type: 'outbound_message',
    messageId: `ops-drill-queue-${nowMs()}`,
    conversationId: `ops-drill-conversation-${nowMs()}`,
    recipientPlatformId: 'ops-drill-recipient',
    content: '',
    messageType: 'text',
    metadata: {
      agentId: 'ops-drill',
      agentName: 'Operational Drill',
      enqueuedAt: nowMs(),
      retryCount: 0
    }
  };
  const message: FakeQueueMessage = {
    body: payload,
    ack: () => { ackCount += 1; },
    retry: () => { retryCount += 1; }
  };
  const batch = { messages: [message] } as unknown as MessageBatch<LineQueuePayload>;

  await new LineMessageQueueConsumer(env).processBatch(batch);

  return {
    name: 'queue-retry',
    success: ackCount === 0 && retryCount === 1,
    details: {
      messageId: payload.messageId,
      ackCount,
      retryCount,
      expected: 'empty outbound message is rejected and retried'
    }
  };
}

async function runDurableObjectAlarmDrill(env: Bindings): Promise<DrillResult> {
  if (!env.LATEST_MESSAGE_COORDINATOR) {
    return {
      name: 'do-alarm',
      success: false,
      details: { error: 'LATEST_MESSAGE_COORDINATOR binding missing' }
    };
  }

  const drillId = `ops-drill-alarm-${nowMs()}`;
  const stub = env.LATEST_MESSAGE_COORDINATOR.get(env.LATEST_MESSAGE_COORDINATOR.idFromName(drillId));
  const conversationId = `ops-drill-conversation-${nowMs()}`;

  const scheduleResponse = await stub.fetch('https://latest-message-cache/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, priority: 'high' })
  });
  const schedule = await scheduleResponse.json() as Record<string, unknown>;

  const triggerResponse = await stub.fetch('https://latest-message-cache/trigger-alarm', {
    method: 'POST'
  });
  const trigger = await triggerResponse.json() as Record<string, unknown>;

  const statusResponse = await stub.fetch('https://latest-message-cache/status');
  const status = await statusResponse.json() as { queueSize?: number; stats?: { totalProcessed?: number } };

  return {
    name: 'do-alarm',
    success: scheduleResponse.ok && triggerResponse.ok && status.queueSize === 0,
    details: {
      conversationId,
      schedule,
      trigger,
      queueSize: status.queueSize,
      totalProcessed: status.stats?.totalProcessed
    }
  };
}

async function runBroadcastFailureDrill(env: Bindings): Promise<DrillResult> {
  if (!env.MESSAGE_BROADCASTER) {
    return {
      name: 'broadcast-failure',
      success: false,
      details: { error: 'MESSAGE_BROADCASTER binding missing' }
    };
  }

  const stub = env.MESSAGE_BROADCASTER.get(env.MESSAGE_BROADCASTER.idFromName('global'));
  const event: DurableObjectEvent = {
    id: `ops-drill-broadcast-${nowMs()}`,
    type: 'system_notification',
    source: 'system',
    timestamp: nowMs(),
    data: { drill: true },
    priority: 'high'
  };
  const response = await stub.fetch('https://message-broadcaster/broadcast-to-conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      targets: [`ops-drill-missing-conversation-${nowMs()}`]
    })
  });
  const result = await response.json() as {
    success?: boolean;
    successful?: number;
    failed?: number;
    eventId?: string;
  };

  return {
    name: 'broadcast-failure',
    success: response.ok && result.success === true && result.failed === 1,
    details: {
      status: response.status,
      eventId: result.eventId,
      successful: result.successful,
      failed: result.failed,
      expected: 'missing target is counted as failed without crashing broadcaster'
    }
  };
}

export const operationalDrillRoutes = new Hono<{ Bindings: DrillEnv }>();

operationalDrillRoutes.post('/run', async (c) => {
  const auth = isOperationalDrillAuthorized(c.env, c.req.header('x-ops-drill-token'));
  if (!auth.authorized) {
    return c.json({ success: false, error: auth.error }, auth.status as 401 | 404 | 503);
  }

  const results = [
    await runQueueRetryDrill(c.env),
    await runDurableObjectAlarmDrill(c.env),
    await runBroadcastFailureDrill(c.env)
  ];
  const success = results.every(result => result.success);

  return c.json({
    success,
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    results
  }, success ? 200 : 500);
});
