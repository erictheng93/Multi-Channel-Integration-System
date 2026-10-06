import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const state = vi.hoisted(() => ({
  record: { id: 'f-1', r2Key: 'k/shared.jpg' } as { id: string; r2Key: string } | undefined,
  remainingRefs: 0,
  deleteDbError: null as Error | null,
  storageDelete: vi.fn(async () => true),
  dbDelete: vi.fn(),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => {
    let selectCalls = 0;
    return {
      select: vi.fn(() => {
        selectCalls += 1;
        const call = selectCalls;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(async () => (call === 1 ? state.record : { n: state.remainingRefs })),
            })),
          })),
        };
      }),
      delete: vi.fn(() => ({
        where: vi.fn(async () => {
          state.dbDelete();
          if (state.deleteDbError) throw state.deleteDbError;
        }),
      })),
    };
  }),
}));

vi.mock('@modules/file-management/services/storage-service', () => ({
  createStorageService: vi.fn(() => ({ deleteFile: state.storageDelete })),
}));

import { FileService } from '@/modules/file-management/services/file-service';

describe('FileService.deleteFile with shared r2Key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.record = { id: 'f-1', r2Key: 'k/shared.jpg' };
    state.remainingRefs = 0;
    state.deleteDbError = null;
  });

  it('deletes the R2 object when no other row references the key', async () => {
    const result = await new FileService({} as Bindings).deleteFile('f-1');
    expect(result.success).toBe(true);
    expect(state.dbDelete).toHaveBeenCalledTimes(1);
    expect(state.storageDelete).toHaveBeenCalledWith('k/shared.jpg');
  });

  it('keeps the R2 object while another row still references the key', async () => {
    state.remainingRefs = 3;
    const result = await new FileService({} as Bindings).deleteFile('f-1');
    expect(result.success).toBe(true);
    expect(state.storageDelete).not.toHaveBeenCalled();
  });

  it('leaves R2 untouched when the DB delete is blocked by a foreign key', async () => {
    state.deleteDbError = new Error('FOREIGN KEY constraint failed');
    const result = await new FileService({} as Bindings).deleteFile('f-1');
    expect(result.success).toBe(false);
    expect(state.storageDelete).not.toHaveBeenCalled();
  });
});
