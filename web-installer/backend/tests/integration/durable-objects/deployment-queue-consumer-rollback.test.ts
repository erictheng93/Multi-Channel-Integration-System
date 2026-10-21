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

describe('queue consumer added to a reused queue that had none', () => {
  let consumers: { consumer_id: string; script: string }[];
  // What the create response carries: the consumer, or (as the API allows) nothing.
  let createResult: 'consumer' | 'empty';
  let listShowsCreated: boolean;

  beforeEach(() => {
    consumers = [];
    createResult = 'consumer';
    listShowsCreated = true;
    calls = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      const text = request.method === 'GET' || request.method === 'DELETE' ? '' : await request.text();
      calls.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
      if (request.method === 'GET') return Response.json({ success: true, result: consumers });
      if (request.method === 'POST') {
        const created = { consumer_id: 'new-c', script: (JSON.parse(text) as { script_name: string }).script_name };
        if (listShowsCreated) consumers.push(created);
        return Response.json({ success: true, result: createResult === 'consumer' ? created : {} });
      }
      return Response.json({ success: true, result: {} });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => { globalThis.fetch = realFetch; });

  it('records the added consumer and does not mistake it for a prior one on retry', async () => {
    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    const register = (internals.registerQueueConsumer as (name: string) => Promise<void>).bind(internals);

    await register('new-worker');
    await register('new-worker'); // retry: finds the consumer the first attempt added

    const state = internals.deploymentState as DeploymentState;
    expect(state.createdQueueConsumerId).toBe('new-c');
    expect(state.priorQueueConsumer).toBeUndefined();
  });

  it('deletes the added consumer when a rebuilt object cancels the deployment', async () => {
    const { o, internals } = orchestrator();
    (internals.deploymentState as DeploymentState).createdQueueConsumerId = 'new-c';

    const response = await (internals.cancelDeployment as () => Promise<Response>).call(o);

    expect(response.status).toBe(200);
    expect(calls.some(c => c.method === 'DELETE' && c.path.endsWith('/queues/q1/consumers/new-c'))).toBe(true);
    expect(calls.some(c => c.method === 'PUT')).toBe(false);
  });

  it('looks up the added consumer when the create response omits its ID', async () => {
    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    createResult = 'empty';

    await (internals.registerQueueConsumer as (name: string) => Promise<void>).call(internals, 'new-worker');

    expect((internals.deploymentState as DeploymentState).createdQueueConsumerId).toBe('new-c');
  });

  it('fails the step when the added consumer ID cannot be found', async () => {
    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    createResult = 'empty';
    listShowsCreated = false;

    await expect((internals.registerQueueConsumer as (name: string) => Promise<void>).call(internals, 'new-worker'))
      .rejects.toThrow(/could not read the consumer ID/);
  });

  it('does not record a consumer on a queue this deployment created', async () => {
    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    (internals.deploymentState as DeploymentState).createdResources = ['queueId'];

    await (internals.registerQueueConsumer as (name: string) => Promise<void>).call(internals, 'new-worker');

    expect((internals.deploymentState as DeploymentState).createdQueueConsumerId).toBeUndefined();
  });
});

describe('dead-letter queue jurisdiction', () => {
  afterEach(() => { globalThis.fetch = realFetch; });

  it('creates the DLQ in the jurisdiction of a reused main queue', async () => {
    calls = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname;
      const text = request.method === 'GET' ? '' : await request.text();
      const body = text ? JSON.parse(text) as { queue_name: string; jurisdiction?: string } : undefined;
      calls.push({ method: request.method, path, body });
      if (request.method === 'GET') {
        return Response.json({ success: true, result: [{ queue_id: 'q1', queue_name: 'p-queue', jurisdiction: 'eu' }] });
      }
      if (body?.queue_name === 'p-queue') {
        return Response.json({ success: false, errors: [{ message: 'Queue name already exists' }] }, { status: 409 });
      }
      return Response.json({ success: true, result: { queue_id: 'dlq1', queue_name: body?.queue_name, jurisdiction: body?.jurisdiction } });
    }) as typeof globalThis.fetch;

    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    const state = internals.deploymentState as DeploymentState;
    state.resources = {};

    await (internals.stepCreateQueue as () => Promise<void>).call(internals);

    const dlqCreate = calls.find(c => c.method === 'POST' && c.body?.queue_name === 'p-dlq');
    expect(dlqCreate?.body).toEqual({ queue_name: 'p-dlq', jurisdiction: 'eu' });
    expect(state.resources).toMatchObject({ queueId: 'q1', dlqId: 'dlq1', dlqName: 'p-dlq' });
    expect(state.createdResources).toEqual(['dlqId']);
  });

  it('refuses to reuse a DLQ whose jurisdiction differs from the main queue', async () => {
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.method === 'GET') {
        return Response.json({ success: true, result: [
          { queue_id: 'q1', queue_name: 'p-queue', jurisdiction: 'eu' },
          { queue_id: 'dlq1', queue_name: 'p-dlq' }
        ] });
      }
      return Response.json({ success: false, errors: [{ message: 'Queue name already exists' }] }, { status: 409 });
    }) as typeof globalThis.fetch;

    const { internals } = orchestrator();
    internals.api = new CloudflareAPI({ accountId: 'acc', apiToken: 'tok' });
    const state = internals.deploymentState as DeploymentState;
    state.resources = {};

    await expect((internals.stepCreateQueue as () => Promise<void>).call(internals))
      .rejects.toThrow(/jurisdiction 'default' but its source queue is in 'eu'/);
    expect(state.resources.dlqId).toBeUndefined();
  });
});
