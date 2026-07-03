import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import { KV_KEY_PATTERNS, KV_TTL } from '@/config/kv-config';

const dbMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: dbMocks.get,
        })),
      })),
    })),
  })),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import {
  getRecallWindowSeconds,
  isValidRecallWindow,
} from '@/services/recall-window-config';

function makeEnv(overrides: {
  cacheGet?: () => Promise<string | null>;
  cachePut?: (key: string, value: string, options: { expirationTtl: number }) => Promise<void>;
} = {}): Bindings {
  return {
    DB: {},
    CACHE: {
      get: vi.fn(overrides.cacheGet ?? (async () => null)),
      put: vi.fn(overrides.cachePut ?? (async () => undefined)),
      delete: vi.fn(),
    },
  } as unknown as Bindings;
}

describe('recall-window-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.get.mockResolvedValue(undefined);
  });

  it('accepts only the configured numeric recall-window values', () => {
    expect([0, 30, 60, 120, 300].every(isValidRecallWindow)).toBe(true);

    expect(isValidRecallWindow(45)).toBe(false);
    expect(isValidRecallWindow(-1)).toBe(false);
    expect(isValidRecallWindow('60')).toBe(false);
  });

  it('returns a valid KV cache hit without reading D1', async () => {
    const env = makeEnv({ cacheGet: async () => '60' });

    await expect(getRecallWindowSeconds(env)).resolves.toBe(60);

    expect(dbMocks.get).not.toHaveBeenCalled();
  });

  it('reads D1 on KV miss and backfills the cache', async () => {
    dbMocks.get.mockResolvedValueOnce({ value: '120' });
    const env = makeEnv();

    await expect(getRecallWindowSeconds(env)).resolves.toBe(120);

    expect(env.CACHE.put).toHaveBeenCalledWith(
      KV_KEY_PATTERNS.cache.settingsRecallWindow,
      '120',
      { expirationTtl: KV_TTL.CACHE_SETTINGS }
    );
  });

  it('falls back to 0 without throwing when KV and D1 both fail', async () => {
    dbMocks.get.mockRejectedValueOnce(new Error('D1 unavailable'));
    const env = makeEnv({
      cacheGet: async () => {
        throw new Error('KV unavailable');
      },
    });

    await expect(getRecallWindowSeconds(env)).resolves.toBe(0);
  });
});
