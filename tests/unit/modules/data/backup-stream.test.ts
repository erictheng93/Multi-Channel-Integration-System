import { describe, it, expect } from 'vitest';
import { putDump } from '@/modules/data/handlers/backup';

function fakeBucket() {
  const parts: Uint8Array[] = [];
  const state = { completed: false, aborted: false };
  const bucket = {
    createMultipartUpload: async () => ({
      uploadPart: async (n: number, body: Uint8Array) => {
        parts.push(body);
        return { partNumber: n, etag: `e${n}` };
      },
      complete: async () => {
        state.completed = true;
      },
      abort: async () => {
        state.aborted = true;
      },
    }),
  };
  return { bucket: bucket as unknown as R2Bucket, parts, state };
}

describe('putDump', () => {
  it('uploads in bounded parts and reports byte size', async () => {
    const { bucket, parts, state } = fakeBucket();
    const stmt = 'x'.repeat(1024 * 1024) + '\n';
    const size = await putDump(bucket, 'k', (async function* () { for (let i = 0; i < 11; i++) yield stmt; yield '界\n'; })(), {});
    expect(parts.length).toBe(3); // 5 MiB + 5 MiB + remainder
    expect(parts.slice(0, -1).every((p) => p.length >= 5 * 1024 * 1024)).toBe(true);
    expect(size).toBe(11 * (1024 * 1024 + 1) + 4); // bytes, not chars
    expect(state.completed).toBe(true);
  });

  it('aborts the multipart upload when the dump fails', async () => {
    const { bucket, state } = fakeBucket();
    await expect(putDump(bucket, 'k', (async function* () { yield 'a'; throw new Error('d1 down'); })(), {})).rejects.toThrow('d1 down');
    expect(state.aborted).toBe(true);
    expect(state.completed).toBe(false);
  });
});
