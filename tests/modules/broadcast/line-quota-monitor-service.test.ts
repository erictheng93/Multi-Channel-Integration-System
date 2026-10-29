import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import type { Database } from '@/db/drizzle-factory';

const mocks = vi.hoisted(() => ({
  getQuota: vi.fn(),
  getUsage: vi.fn(),
}));

vi.mock('@/utils/line', () => ({
  getLineMessageQuota: mocks.getQuota,
  getLineMessageUsage: mocks.getUsage,
}));

vi.mock('@modules/integrations/services/channel-credential-service', () => ({
  ChannelCredentialService: vi.fn(function () {
    return {
      // The test rows carry the "decrypted" token directly in `credentials`.
      getDecryptedCredentials: async (row: { credentials: string }) => ({ accessToken: row.credentials }),
    };
  }),
}));

import {
  LineQuotaMonitorService,
  type LineQuotaSnapshotSet,
} from '@/modules/broadcast/services/line-quota-monitor-service';

function makeDb(rows: Array<{ credentials: string; teamName: string | null }>): Database {
  const chain = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    where: async () => rows,
  };
  return chain as unknown as Database;
}

function makeEnv(extra: Partial<Bindings> = {}): Bindings {
  const store = new Map<string, string>();
  return {
    CACHE: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value);
      },
    },
    ...extra,
  } as unknown as Bindings;
}

describe('LineQuotaMonitorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQuota.mockResolvedValue({ success: true, type: 'limited', value: 10000 });
    mocks.getUsage.mockResolvedValue({ success: true, totalUsage: 8120 });
  });

  it('computes remaining for a limited channel', async () => {
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), makeEnv());

    const snapshot = await service.refresh('cron');

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      label: 'Sales',
      limited: true,
      limit: 10000,
      used: 8120,
      remaining: 1880,
      error: null,
    });
    expect(snapshot.source).toBe('cron');
  });

  it('exposes the support-reply reserve and the usable remainder', async () => {
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), makeEnv());

    const [item] = (await service.refresh('cron')).items;

    // default ratio 0.2 of 10000 = 2000 reserved; 1880 remaining is already inside the reserve
    expect(item).toMatchObject({ reserve: 2000, remaining: 1880, usableRemaining: 0 });
  });

  it('subtracts the reserve from remaining and honours the env ratio, also for stored snapshots', async () => {
    mocks.getUsage.mockResolvedValue({ success: true, totalUsage: 5000 });
    const env = makeEnv({ BROADCAST_QUOTA_RESERVE_RATIO: '0.1' });
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), env);
    await service.refresh('cron');

    const [item] = (await service.getSnapshot()).items;

    expect(item).toMatchObject({ reserve: 1000, remaining: 5000, usableRemaining: 4000 });
  });

  it('has no reserve for an unlimited channel', async () => {
    mocks.getQuota.mockResolvedValue({ success: true, type: 'none' });
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), makeEnv());

    const [item] = (await service.refresh('cron')).items;

    expect(item).toMatchObject({ reserve: null, usableRemaining: null });
  });

  it('reports only usage for a channel without a target limit', async () => {
    mocks.getQuota.mockResolvedValue({ success: true, type: 'none' });
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), makeEnv());

    const [item] = (await service.refresh('cron')).items;

    expect(item).toMatchObject({ limited: false, limit: null, used: 8120, remaining: null });
  });

  it('merges teams and the env default that share one token into a single channel', async () => {
    const service = new LineQuotaMonitorService(
      makeDb([
        { credentials: 'shared', teamName: 'Sales' },
        { credentials: 'shared', teamName: 'Support' },
      ]),
      makeEnv({ LINE_CHANNEL_ACCESS_TOKEN: 'shared' })
    );

    const snapshot = await service.refresh('cron');

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].label).toBe('Sales、Support、系統預設');
    expect(mocks.getQuota).toHaveBeenCalledTimes(1);
  });

  it('never exposes the access token in the snapshot', async () => {
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'super-secret-token', teamName: 'Sales' }]), makeEnv());

    const snapshot = await service.refresh('cron');

    expect(JSON.stringify(snapshot)).not.toContain('super-secret-token');
  });

  it('keeps the last known numbers and flags the error when LINE fails', async () => {
    const env = makeEnv();
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), env);
    await service.refresh('cron');

    mocks.getQuota.mockResolvedValue({ success: false, error: 'API error: 401' });
    const [item] = (await service.refresh('cron')).items;

    expect(item).toMatchObject({ used: 8120, limit: 10000, error: 'API error: 401' });
    expect(item.fetchedAt).not.toBeNull();
  });

  it('answers a manual refresh inside 30s from the stored snapshot without calling LINE', async () => {
    const env = makeEnv();
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), env);
    await service.refresh('cron');
    mocks.getQuota.mockClear();

    const result: LineQuotaSnapshotSet = await service.refresh('manual');

    expect(result.throttled).toBe(true);
    expect(mocks.getQuota).not.toHaveBeenCalled();
  });

  it('lets the cron bypass the manual throttle', async () => {
    const env = makeEnv();
    const service = new LineQuotaMonitorService(makeDb([{ credentials: 'tok-a', teamName: 'Sales' }]), env);
    await service.refresh('manual');
    mocks.getQuota.mockClear();

    await service.refresh('cron');

    expect(mocks.getQuota).toHaveBeenCalledTimes(1);
  });

  it('returns an empty set before the first poll', async () => {
    const service = new LineQuotaMonitorService(makeDb([]), makeEnv());

    expect(await service.getSnapshot()).toMatchObject({ items: [], updatedAt: null });
  });
});
