import { describe, expect, it } from 'vitest';
import {
  BROADCAST_IN_ARRAY_CHUNK_SIZE,
  BROADCAST_MESSAGE_INSERT_CHUNK_SIZE,
  BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE,
  D1_MAX_BOUND_PARAMETERS,
  chunkItems,
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
