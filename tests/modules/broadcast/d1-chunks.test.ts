import { describe, expect, it, vi } from 'vitest';
import {
  BROADCAST_IN_ARRAY_CHUNK_SIZE,
  BROADCAST_MESSAGE_INSERT_CHUNK_SIZE,
  BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE,
  D1_MAX_BOUND_PARAMETERS,
  chunkItems,
  runInBatches,
} from '@/modules/broadcast/services/d1-chunks';

describe('broadcast D1 chunking limits', () => {
  it('keeps recipient snapshot inserts under D1 bound parameter limits', () => {
    expect(BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE * 7).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);

    const chunks = chunkItems(Array.from({ length: 15 }, (_, index) => index), BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE);

    expect(chunks.map((chunk) => chunk.length)).toEqual([14, 1]);
  });

  it('keeps inArray updates and lookups under D1 bound parameter limits', () => {
    expect(BROADCAST_IN_ARRAY_CHUNK_SIZE).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);

    const chunks = chunkItems(Array.from({ length: 91 }, (_, index) => index), BROADCAST_IN_ARRAY_CHUNK_SIZE);

    expect(chunks.map((chunk) => chunk.length)).toEqual([90, 1]);
  });

  it('keeps conversation message inserts under D1 bound parameter limits', () => {
    expect(BROADCAST_MESSAGE_INSERT_CHUNK_SIZE * 13).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);

    const chunks = chunkItems(Array.from({ length: 8 }, (_, index) => index), BROADCAST_MESSAGE_INSERT_CHUNK_SIZE);

    expect(chunks.map((chunk) => chunk.length)).toEqual([7, 1]);
  });
});

describe('runInBatches', () => {
  it('executes every statement exactly once, in order, in batches of the given size', async () => {
    const execute = vi.fn(async () => undefined);
    await runInBatches(['a', 'b', 'c', 'd', 'e'], 2, execute);
    expect(execute.mock.calls.map(([batch]) => batch)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('does nothing for an empty list', async () => {
    const execute = vi.fn(async () => undefined);
    await runInBatches([], 50, execute);
    expect(execute).not.toHaveBeenCalled();
  });

  it('waits for each batch before starting the next', async () => {
    const order: string[] = [];
    await runInBatches(['a', 'b'], 1, async ([item]) => {
      order.push(`start-${item}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push(`end-${item}`);
    });
    expect(order).toEqual(['start-a', 'end-a', 'start-b', 'end-b']);
  });
});
