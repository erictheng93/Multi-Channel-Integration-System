import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const dbMocks = vi.hoisted(() => ({
  set: vi.fn(),
  where: vi.fn(),
  nowMs: vi.fn(),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    update: vi.fn(() => ({
      set: dbMocks.set,
    })),
  })),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@/utils/timestamp', () => ({
  nowMs: dbMocks.nowMs,
}));

import {
  downgradeBufferedMessage,
  scheduleOrDeliverNow,
  scheduleBufferedDelivery,
} from '@/modules/conversations/services/buffered-send-scheduler';

interface FetchingStub {
  fetch: ReturnType<typeof vi.fn>;
}

function makeEnv(stub?: FetchingStub): Bindings {
  return {
    DB: {},
    DELAYED_MESSAGE_SCHEDULER: stub
      ? {
          idFromName: vi.fn((name: string) => `do-${name}`),
          get: vi.fn(() => stub),
        }
      : undefined,
  } as unknown as Bindings;
}

describe('buffered-send-scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.set.mockReturnValue({ where: dbMocks.where });
    dbMocks.where.mockResolvedValue(undefined);
    dbMocks.nowMs.mockReturnValue(2000);
  });

  it('returns true when the scheduler DO accepts the buffered send', async () => {
    const stub = { fetch: vi.fn().mockResolvedValue(new Response('', { status: 200 })) };

    await expect(scheduleBufferedDelivery(makeEnv(stub), {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      delaySeconds: 30,
    })).resolves.toBe(true);

    expect(stub.fetch).toHaveBeenCalledWith(
      'https://delayed-message-scheduler/schedule',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          mode: 'deliver-by-ref',
          messageId: 'msg-1',
          conversationId: 'conv-1',
          delaySeconds: 30,
        }),
      })
    );
  });

  it('returns false for scheduler rejection, thrown errors, and missing binding', async () => {
    await expect(scheduleBufferedDelivery(makeEnv({
      fetch: vi.fn().mockResolvedValue(new Response('late', { status: 409 })),
    }), {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      delaySeconds: 30,
    })).resolves.toBe(false);

    await expect(scheduleBufferedDelivery(makeEnv({
      fetch: vi.fn().mockRejectedValue(new Error('network')),
    }), {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      delaySeconds: 30,
    })).resolves.toBe(false);

    await expect(scheduleBufferedDelivery(makeEnv(), {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      delaySeconds: 30,
    })).resolves.toBe(false);
  });

  it('downgrades buffered rows to pending and clears the recall deadline', async () => {
    const env = makeEnv();

    await downgradeBufferedMessage(env, 'msg-1');

    expect(dbMocks.set).toHaveBeenCalledWith({
      deliveryStatus: 'pending',
      recallDeadline: null,
    });
    expect(dbMocks.where).toHaveBeenCalledTimes(1);
  });

  it('schedules buffered delivery from the actual scheduling time and persists that deadline', async () => {
    const stub = { fetch: vi.fn().mockResolvedValue(new Response('', { status: 200 })) };
    const deliverNow = vi.fn();

    const result = await scheduleOrDeliverNow(makeEnv(stub), {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      recallWindowSeconds: 30,
      canBuffer: true,
      deliverNow,
    });

    expect(result).toEqual({
      deliveryStatus: 'buffered',
      isSent: false,
      recallDeadline: '1970-01-01T00:00:32.000Z',
    });
    expect(dbMocks.set).toHaveBeenCalledWith({
      recallDeadline: '1970-01-01T00:00:32.000Z',
    });
    expect(deliverNow).not.toHaveBeenCalled();
  });

  it('downgrades, immediately delivers, and resolves when scheduling fails', async () => {
    const stub = { fetch: vi.fn().mockResolvedValue(new Response('late', { status: 409 })) };
    const deliverNow = vi.fn().mockRejectedValue(new Error('delivery failed'));

    const result = await scheduleOrDeliverNow(makeEnv(stub), {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      recallWindowSeconds: 30,
      canBuffer: true,
      deliverNow,
    });

    expect(result).toEqual({
      deliveryStatus: 'pending',
      isSent: false,
      recallDeadline: null,
    });
    expect(dbMocks.set).toHaveBeenCalledWith({
      deliveryStatus: 'pending',
      recallDeadline: null,
    });
    expect(deliverNow).toHaveBeenCalledTimes(1);
  });
});
