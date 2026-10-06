export const D1_MAX_BOUND_PARAMETERS = 100;

export const BROADCAST_RECIPIENT_INSERT_CHUNK_SIZE = 14;
export const BROADCAST_IN_ARRAY_CHUNK_SIZE = 90;
export const BROADCAST_MESSAGE_INSERT_CHUNK_SIZE = 7;
// file_attachments insert: 11 columns x 9 rows = 99 <= 100 bound parameters.
export const BROADCAST_ATTACHMENT_INSERT_CHUNK_SIZE = 9;
export const BROADCAST_WRITE_BATCH_SIZE = 50;

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

// Sequential on purpose: each batch is one D1 transaction, and later batches
// (file_attachments) depend on rows written by earlier ones (messages FK).
export async function runInBatches<T>(
  statements: T[],
  size: number,
  execute: (batch: [T, ...T[]]) => Promise<unknown>
): Promise<void> {
  for (const [first, ...rest] of chunkItems(statements, size)) {
    await execute([first, ...rest]);
  }
}
