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

describe('DistributedLockService ownership through a real LockCoordinator', () => {
  function realCoordinator(): LockCoordinator {
    const state = {
      blockConcurrencyWhile: (fn: () => Promise<void>) => fn(),
      storage: { get: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) }
    };
    return new LockCoordinator(state as unknown as DurableObjectState, {});
  }

  function serviceFor(coord: LockCoordinator): DistributedLockService {
    const stub = { fetch: (request: Request) => coord.fetch(request) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    return new DistributedLockService({ DISTRIBUTED_LOCK: namespace as unknown as DurableObjectNamespace });
  }

  const fast = { ttl: 30000, timeout: 200, retryInterval: 10 };

  it('releases an acquired lock so the resource can be taken again immediately', async () => {
    const service = serviceFor(realCoordinator());
    const lockId = await service.acquireLock('res', fast);
    await service.releaseLock(lockId);
    expect(await service.isLocked('res')).toBe(false);
    await expect(service.acquireLock('res', fast)).resolves.toEqual(expect.any(String));
  });

  it('withLock frees the resource after the callback resolves and after it throws', async () => {
    const service = serviceFor(realCoordinator());
    await expect(service.withLock('res', async () => 'ok', fast)).resolves.toBe('ok');
    expect(await service.isLocked('res')).toBe(false);
    await expect(service.withLock('res', async () => { throw new Error('boom'); }, fast)).rejects.toThrow('boom');
    expect(await service.isLocked('res')).toBe(false);
  });

  it('lets the holder extend its lock', async () => {
    const service = serviceFor(realCoordinator());
    const lockId = await service.acquireLock('res', fast);
    const before = (await service.getLockInfo(lockId))!.expiresAt;
    await expect(service.extendLock(lockId, 1000)).resolves.toBe(before + 1000);
  });

  it('refuses release, extend and tryLock from a different service instance', async () => {
    const coord = realCoordinator();
    const holder = serviceFor(coord);
    const other = serviceFor(coord);
    const lockId = await holder.acquireLock('res', fast);

    await other.releaseLock(lockId);
    expect(await holder.isLocked('res')).toBe(true);
    await expect(other.extendLock(lockId, 1000)).rejects.toThrow('Lock extension failed: Lock not found or not owned');
    expect(await other.tryLock('res')).toBeNull();
  });
});
