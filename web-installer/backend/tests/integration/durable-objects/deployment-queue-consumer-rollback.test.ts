/**
 * Queue consumer rollback: a reused queue's original consumer must survive retries
 * and be restorable by a freshly rebuilt Durable Object (cancel after eviction).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DeploymentOrchestrator } from '@/durable-objects/DeploymentOrchestrator';
import { CloudflareAPI } from '@/services/CloudflareAPI';
import type { DeploymentState } from '@/types/deployment';

const original = {
  consumerId: 'c1',
  scriptName: 'old-worker',
  settings: { batch_size: 5, max_wait_time_ms: 500, max_retries: 1 },
  deadLetterQueue: 'old-dlq'
};

let consumerScript: string;
let calls: { method: string; path: string; body?: Record<string, unknown> }[];
let realFetch: typeof globalThis.fetch;

function orchestrator() {
  const stored = new Map<string, unknown>();
  const state = { storage: { put: async (k: string, v: unknown) => { stored.set(k, v); } } };
  const o = new DeploymentOrchestrator(state as never, {} as never);
  const internals = o as unknown as Record<string, unknown>;
  internals.deploymentState = {
    deploymentId: 'd1',
    config: { projectName: 'p', accountId: 'acc', oauthToken: 'tok' },
    status: 'in_progress',
    currentStep: 'deploying_worker',
    resources: { queueId: 'q1', queueName: 'p-queue' },
    createdResources: [],
    logs: []
  } as unknown as DeploymentState;
  return { o, internals };
}

describe('queue consumer rollback on a reused queue', () => {
  beforeEach(() => {
    consumerScript = original.scriptName;
    calls = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      const text = request.method === 'GET' ? '' : await request.text();
      calls.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
      if (request.method === 'GET') {
        return Response.json({
          success: true,
          result: [{ consumer_id: 'c1', script: consumerScript, settings: original.settings, dead_letter_queue: original.deadLetterQueue }]
        });
      }
      if (request.method === 'PUT') consumerScript = (JSON.parse(text) as { script_name: string }).script_name;
      return Response.json({ success: true, result: {} });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => { globalThis.fetch = realFetch; });

  it('keeps the first snapshot when registration is retried', async () => {
    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    const register = (internals.registerQueueConsumer as (name: string) => Promise<void>).bind(internals);

    await register('new-worker');
    await register('new-worker'); // retry after a later step failed: the consumer already points at new-worker

    expect((internals.deploymentState as DeploymentState).priorQueueConsumer).toMatchObject({ scriptName: 'old-worker' });
  });

  it('restores the original consumer when a rebuilt object cancels the deployment', async () => {
    const { o, internals } = orchestrator();
    (internals.deploymentState as DeploymentState).priorQueueConsumer = original;
    // A rebuilt object has neither api nor rollbackService.
    const response = await (internals.cancelDeployment as () => Promise<Response>).call(o);

    expect(response.status).toBe(200);
    const restore = calls.find(c => c.method === 'PUT' && c.path.endsWith('/queues/q1/consumers/c1'));
    expect(restore?.body).toMatchObject({ script_name: 'old-worker', dead_letter_queue: 'old-dlq', settings: original.settings });
  });
});
