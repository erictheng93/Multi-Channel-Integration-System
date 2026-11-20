/**
 * DistributedLockService <-> LockCoordinator error contract.
 * The coordinator sends failure bodies as `{ error: '...' }`; the client must surface that text.
 */

import { describe, it, expect, vi } from 'vitest';
import { DistributedLockService, LockCoordinator } from '@/services/distributed-lock-service';

function serviceReturning(status: number, body: unknown): DistributedLockService {
  const stub = { fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) };
  const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
  return new DistributedLockService({ DISTRIBUTED_LOCK: namespace as unknown as DurableObjectNamespace });
}

describe('DistributedLockService error responses', () => {
  it('surfaces the coordinator 423 reason from acquireLock instead of "Unknown error"', async () => {
    const service = serviceReturning(423, { error: 'Resource is locked' });
    await expect(service.acquireLock('conv:1')).rejects.toThrow('Lock acquisition failed: Resource is locked');
  });

  it('surfaces the coordinator 404 reason from extendLock', async () => {
    const service = serviceReturning(404, { error: 'Lock not found or not owned' });
    await expect(service.extendLock('lock-1', 1000)).rejects.toThrow('Lock extension failed: Lock not found or not owned');
  });
});

describe('LockCoordinator fallthrough error bodies', () => {
  function coordinator(): LockCoordinator {
    const state = {
      blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
      storage: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) }
    };
    return new LockCoordinator(state as unknown as DurableObjectState, {});
  }

  it('returns a JSON { error } body with 404 for an unknown path', async () => {
    const response = await coordinator().fetch(new Request('https://lock-coordinator/nope'));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('returns a JSON 500 when a real handler rejects (non-JSON body to /acquire)', async () => {
    const request = new Request('https://lock-coordinator/acquire', { method: 'POST', body: 'not json' });
    const response = await coordinator().fetch(request);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });

  it('returns a JSON { error } body with 500 without leaking the thrown message', async () => {
    const throwingRequest = { get url(): string { throw new Error('secret detail'); } } as unknown as Request;
    const response = await coordinator().fetch(throwingRequest);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });
});
