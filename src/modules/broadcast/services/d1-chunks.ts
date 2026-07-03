export const D1_MAX_BOUND_PARAMETERS = 100;

export const BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE = 14;
export const BROADCAST_IN_ARRAY_CHUNK_SIZE = 90;
export const BROADCAST_MESSAGE_INSERT_CHUNK_SIZE = 7;

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than zero');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
