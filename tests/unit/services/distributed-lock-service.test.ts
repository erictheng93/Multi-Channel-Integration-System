/**
 * DistributedLockService <-> LockCoordinator error contract.
 * The coordinator sends failure bodies as `{ error: '...' }`; the client must surface that text.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Issue #277 section 3: lock TTL expiry and behaviour across a LockCoordinator restart.
// Only Date is faked, so the coordinator's retry sleep still uses real timers.
describe('LockCoordinator TTL expiry and restart (issue #277)', () => {
  type Storage = Map<string, unknown>;

  interface Instance { fetch(request: Request): Promise<Response> }

  // Mirrors DO storage: values are structured-cloned on put and get, and the map outlives
  // any single LockCoordinator instance, the way ctx.storage outlives eviction or a deploy.
  // Like the runtime, no request reaches the instance until blockConcurrencyWhile settles.
  function coordinatorOn(storage: Storage): Instance {
    let ready: Promise<unknown> = Promise.resolve();
    const state = {
      blockConcurrencyWhile: (fn: () => Promise<unknown>) => { ready = fn(); return ready; },
      storage: {
        get: vi.fn(async (key: string) => structuredClone(storage.get(key))),
        put: vi.fn(async (key: string, value: unknown) => { storage.set(key, structuredClone(value)); })
      }
    };
    const coord = new LockCoordinator(state as unknown as DurableObjectState, {});
    return { fetch: async (request: Request) => { await ready; return coord.fetch(request); } };
  }

  // The stub is resolved per request, so swapping `current.coord` simulates the platform
  // routing the same client to a freshly constructed instance after a restart.
  function serviceVia(current: { coord: Instance }): DistributedLockService {
    const stub = { fetch: (request: Request) => current.coord.fetch(request) };
    const namespace = { idFromName: vi.fn().mockReturnValue('id'), get: vi.fn().mockReturnValue(stub) };
    return new DistributedLockService({ DISTRIBUTED_LOCK: namespace as unknown as DurableObjectNamespace });
  }

  const T0 = 1_700_000_000_000;
  const opts = { ttl: 1000, timeout: 100, retryInterval: 5, maxRetries: 3 };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('TTL expiry', () => {
    it('treats an expired lock as free: another holder acquires it on the first attempt', async () => {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);

      vi.setSystemTime(T0 + 999);
      expect(await holderB.tryLock('res', 1000)).toBeNull();

      vi.setSystemTime(T0 + 1001);
      expect(await holderB.isLocked('res')).toBe(false);
      const lockB = await holderB.acquireLock('res', opts);

      expect((await holderB.getLockInfo(lockB))?.metadata).toMatchObject({ attempts: 1 });
      // The expired lock record is removed when it is taken over.
      expect(await holderA.getLockInfo(lockA)).toBeNull();
    });

    it('refuses the original holder release and extend once its expired lock was taken over', async () => {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);

      vi.setSystemTime(T0 + 1001);
      const lockB = await holderB.acquireLock('res', opts);

      await holderA.releaseLock(lockA);
      expect(await holderB.isLocked('res')).toBe(true);
      expect(await holderB.getLockInfo(lockB)).not.toBeNull();
      await expect(holderA.extendLock(lockA, 5000)).rejects.toThrow('Lock extension failed: Lock not found or not owned');
      expect(await holderA.tryLock('res', 1000)).toBeNull();
    });

    it('refuses to extend (revive) an expired lock, the same way as an unknown lock, and drops it from state', async () => {
      const storage: Storage = new Map();
      const current = { coord: coordinatorOn(storage) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);

      vi.setSystemTime(T0 + 1500);
      expect(await holderA.isLocked('res')).toBe(false);
      await expect(holderA.extendLock(lockA, 5000)).rejects.toThrow('Lock extension failed: Lock not found or not owned');

      // The stale record is gone, in memory and in storage, and the resource stays free.
      expect(await holderA.getLockInfo(lockA)).toBeNull();
      expect(storage.get('activeLocks')).toEqual([]);
      expect(storage.get('resourceLocks')).toEqual([]);
      expect(await holderA.isLocked('res')).toBe(false);
      await expect(holderA.extendLock(lockA, 5000)).rejects.toThrow('Lock extension failed: Lock not found or not owned');
      await expect(holderB.tryLock('res', 1000)).resolves.toEqual(expect.any(String));
    });

    it('refuses to extend a lock exactly at its deadline (now === expiresAt counts as expired)', async () => {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);

      vi.setSystemTime(T0 + 1000);
      await expect(holderA.extendLock(lockA, 5000)).rejects.toThrow('Lock extension failed: Lock not found or not owned');
      expect(await holderA.getLockInfo(lockA)).toBeNull();
    });

    it('still lets the holder release its expired, untaken lock', async () => {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);

      vi.setSystemTime(T0 + 1500);
      await holderA.releaseLock(lockA);
      expect(await holderA.getLockInfo(lockA)).toBeNull();
      expect(await holderA.isLocked('res')).toBe(false);
    });

    it('extendLock pushes expiry: the lock stays held past the original TTL and frees after the new one', async () => {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);

      await expect(holderA.extendLock(lockA, 5000)).resolves.toBe(T0 + 6000);

      vi.setSystemTime(T0 + 3000);
      expect(await holderB.isLocked('res')).toBe(true);
      await expect(holderB.acquireLock('res', opts)).rejects.toThrow('Lock acquisition failed');

      vi.setSystemTime(T0 + 6001);
      await expect(holderB.acquireLock('res', opts)).resolves.toEqual(expect.any(String));
    });

    it('cleanupExpiredLocks removes only expired locks, persists the result, and also runs lazily after 60s', async () => {
      const storage: Storage = new Map();
      const current = { coord: coordinatorOn(storage) };
      const service = serviceVia(current);
      await service.acquireLock('short', opts);
      const longLock = await service.acquireLock('long', { ...opts, ttl: 120_000 });

      vi.setSystemTime(T0 + 2000);
      expect(await service.cleanupExpiredLocks()).toBe(1);
      expect((await service.getActiveLocks()).map(lock => lock.lockId)).toEqual([longLock]);
      expect((storage.get('resourceLocks') as [string, string][]).map(([resource]) => resource)).toEqual(['long']);

      // Lazy GC: the first request more than 60s after the last cleanup sweeps expired locks.
      await service.acquireLock('short2', opts);
      vi.setSystemTime(T0 + 2000 + 60_001);
      expect((await service.getActiveLocks()).map(lock => lock.resource)).toEqual(['long']);
    });

    it('does not fence a critical section that outlives its TTL: a second holder enters while the first still runs', async () => {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      let finishA!: () => void;
      const aBlocked = new Promise<void>(resolve => { finishA = resolve; });
      let inside = 0;
      let maxInside = 0;
      const critical = async (wait: Promise<void>): Promise<void> => {
        inside++;
        maxInside = Math.max(maxInside, inside);
        await wait;
        inside--;
      };

      let aEntered!: () => void;
      const aInside = new Promise<void>(resolve => { aEntered = resolve; });
      const runA = holderA.withLock('res', () => { aEntered(); return critical(aBlocked); }, opts);
      // Not vi.waitFor: under fake timers it advances the faked clock while it polls.
      await aInside;
      expect(inside).toBe(1);

      vi.setSystemTime(T0 + 1001);
      await holderB.withLock('res', () => critical(Promise.resolve()), opts);
      expect(maxInside).toBe(2);

      // A finishes late; its release is refused, so it cannot free a lock it no longer owns.
      const lockB = await holderB.acquireLock('res', { ...opts, ttl: 30_000 });
      finishA();
      await runA;
      expect(await holderB.isLocked('res')).toBe(true);
      await holderB.releaseLock(lockB);
    });
  });

  // One rule everywhere: a lock is expired when now >= expiresAt. The lock below is acquired at
  // T0 with ttl 1000, so expiresAt === T0 + 1000.
  describe('deadline boundary (now === expiresAt is expired)', () => {
    async function heldUntilT0Plus1000(): Promise<{ holderB: DistributedLockService; lockA: string; holderA: DistributedLockService }> {
      const current = { coord: coordinatorOn(new Map()) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      const lockA = await holderA.acquireLock('res', opts);
      expect((await holderA.getLockInfo(lockA))?.expiresAt).toBe(T0 + 1000);
      return { holderA, holderB, lockA };
    }

    it('isLocked: held 1ms before the deadline, free at it', async () => {
      const { holderB } = await heldUntilT0Plus1000();
      vi.setSystemTime(T0 + 999);
      expect(await holderB.isLocked('res')).toBe(true);
      vi.setSystemTime(T0 + 1000);
      expect(await holderB.isLocked('res')).toBe(false);
    });

    it('tryLock: refused 1ms before the deadline, granted at it', async () => {
      const { holderA, holderB, lockA } = await heldUntilT0Plus1000();
      vi.setSystemTime(T0 + 999);
      expect(await holderB.tryLock('res', 1000)).toBeNull();
      vi.setSystemTime(T0 + 1000);
      const lockB = await holderB.tryLock('res', 1000);
      expect(lockB).toEqual(expect.any(String));
      expect(await holderA.getLockInfo(lockA)).toBeNull();
    });

    it('acquireLock: times out 1ms before the deadline, granted on the first attempt at it', async () => {
      const { holderA, holderB, lockA } = await heldUntilT0Plus1000();
      vi.setSystemTime(T0 + 999);
      await expect(holderB.acquireLock('res', opts)).rejects.toThrow('Lock acquisition failed');
      vi.setSystemTime(T0 + 1000);
      const lockB = await holderB.acquireLock('res', opts);
      expect((await holderB.getLockInfo(lockB))?.metadata).toMatchObject({ attempts: 1 });
      expect(await holderA.getLockInfo(lockA)).toBeNull();
    });

    it('cleanupExpiredLocks: removes a lock exactly at its deadline', async () => {
      const { holderB } = await heldUntilT0Plus1000();
      vi.setSystemTime(T0 + 999);
      expect(await holderB.cleanupExpiredLocks()).toBe(0);
      vi.setSystemTime(T0 + 1000);
      expect(await holderB.cleanupExpiredLocks()).toBe(1);
    });
  });

  describe('restart (new instance, same storage)', () => {
    it('restores a held lock: a new instance keeps it held and only the original owner can release it', async () => {
      const storage: Storage = new Map();
      const current = { coord: coordinatorOn(storage) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      const lockA = await holderA.acquireLock('res', { ...opts, ttl: 30_000 });

      current.coord = coordinatorOn(storage); // eviction, deploy or crash: the constructor reloads storage

      expect(await holderB.isLocked('res')).toBe(true);
      expect((await holderB.getLockInfo(lockA))?.resource).toBe('res');
      expect(await holderB.tryLock('res', 1000)).toBeNull();
      await expect(holderB.acquireLock('res', opts)).rejects.toThrow('Lock acquisition failed');
      await holderB.releaseLock(lockA);
      expect(await holderB.isLocked('res')).toBe(true);

      await holderA.releaseLock(lockA);
      expect(await holderB.isLocked('res')).toBe(false);
      await expect(holderB.acquireLock('res', opts)).resolves.toEqual(expect.any(String));
    });

    it('keeps the TTL across a restart: a restored lock still expires at its original deadline', async () => {
      const storage: Storage = new Map();
      const current = { coord: coordinatorOn(storage) };
      const holderA = serviceVia(current);
      const holderB = serviceVia(current);
      await holderA.acquireLock('res', opts);

      vi.setSystemTime(T0 + 500);
      current.coord = coordinatorOn(storage);
      expect(await holderB.tryLock('res', 1000)).toBeNull();

      vi.setSystemTime(T0 + 1001);
      current.coord = coordinatorOn(storage);
      await expect(holderB.acquireLock('res', opts)).resolves.toEqual(expect.any(String));
    });

    it('persists every release too, so a restart never resurrects a released lock', async () => {
      const storage: Storage = new Map();
      const current = { coord: coordinatorOn(storage) };
      const service = serviceVia(current);
      const lockId = await service.acquireLock('res', opts);
      await service.releaseLock(lockId);

      current.coord = coordinatorOn(storage);
      expect(await service.isLocked('res')).toBe(false);
      expect(await service.getActiveLocks()).toEqual([]);
    });
  });
});
