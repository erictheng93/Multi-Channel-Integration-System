// Idle DelayedMessageScheduler must never arm an alarm (DO alarm rule: idle -> no alarm).
// The bounded-retry and drained cases live in tests/unit/durable-objects/delayed-scheduler-alarm.test.ts.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@modules/conversations/services/message-delivery-service', () => ({
  MessageDeliveryService: class { deliver = vi.fn(); },
}));

import { DelayedMessageScheduler } from '@/durable-objects/DelayedMessageScheduler';

function idleHarness(seed: Array<[string, unknown]> = []) {
  let ready: Promise<void> = Promise.resolve();
  const values = new Map<string, unknown>(seed);
  const storage = {
    get: vi.fn(async (key: string) => values.get(key)),
    put: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }),
    delete: vi.fn(async (key: string | string[]) => { for (const k of [key].flat()) values.delete(k); }),
    list: vi.fn(async ({ prefix }: { prefix: string }) =>
      new Map([...values].filter(([k]) => k.startsWith(prefix)))),
    getAlarm: vi.fn(async () => null),
    setAlarm: vi.fn(async () => undefined),
    deleteAlarm: vi.fn(async () => undefined),
  };
  const state = {
    id: { toString: () => 'do-idle' },
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn(); },
    storage,
  };
  const scheduler = new DelayedMessageScheduler(state as never, {} as never);
  return { scheduler, storage, ready: () => ready };
}

describe('DelayedMessageScheduler idle alarm', () => {
  it('a cold start with empty storage arms no alarm', async () => {
    const h = idleHarness();
    await h.ready();

    expect(h.storage.setAlarm).not.toHaveBeenCalled();
  });

  it('a cold start holding only failed/sent records arms no alarm', async () => {
    const h = idleHarness([
      ['msg:f1', { id: 'f1', status: 'failed', scheduledAt: Date.now() - 1000, failedAt: Date.now() - 1000 }],
      ['msg:s1', { id: 's1', status: 'sent', scheduledAt: Date.now() - 1000 }],
    ]);
    await h.ready();

    expect(h.storage.setAlarm).not.toHaveBeenCalled();
  });

  it('a stray alarm firing with nothing pending does not re-arm', async () => {
    const h = idleHarness();
    await h.ready();

    await h.scheduler.alarm();

    expect(h.storage.setAlarm).not.toHaveBeenCalled();
  });
});
