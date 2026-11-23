import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import { agents } from '@/db/schema';

const mocks = vi.hoisted(() => ({
  getQuota: vi.fn(),
  getUsage: vi.fn(),
  createBulk: vi.fn(),
}));

vi.mock('@/utils/line', () => ({
  getLineMessageQuota: mocks.getQuota,
  getLineMessageUsage: mocks.getUsage,
}));

vi.mock('@modules/integrations/services/channel-credential-service', () => ({
  ChannelCredentialService: vi.fn(function () {
    return {
      getDecryptedCredentials: async (row: { credentials: string }) => ({ accessToken: row.credentials }),
    };
  }),
}));

vi.mock('@/utils/notification-trigger', () => ({
  createNotificationService: vi.fn(() => ({ createBulk: mocks.createBulk })),
}));

import { LineQuotaMonitorService } from '@/modules/broadcast/services/line-quota-monitor-service';
import {
  LINE_QUOTA_ALERT_STATE_KV_KEY,
  type LineQuotaAlertState,
} from '@/modules/broadcast/services/line-quota-alert-service';

interface ChannelRow {
  credentials: string;
  teamName: string | null;
}

interface Fixture {
  channels: ChannelRow[];
  admins: Array<{ id: string }>;
  adminQueryError: Error | null;
}

/** Channel query (channel_integrations) and admin query (agents) share the chain; `from()` picks the rows. */
function makeDb(fixture: Fixture): Database {
  let table: unknown = null;
  const chain = {
    select: () => chain,
    from: (t: unknown) => {
      table = t;
      return chain;
    },
    leftJoin: () => chain,
    where: async () => {
      if (table === agents) {
        if (fixture.adminQueryError) {
          throw fixture.adminQueryError;
        }
        return fixture.admins;
      }
      return fixture.channels;
    },
  };
  return chain as unknown as Database;
}

function makeEnv() {
  const store = new Map<string, string>();
  const alertPuts: string[] = [];
  const failGetFor = new Set<string>();
  const env = {
    CACHE: {
      get: async (key: string) => {
        if (failGetFor.has(key)) {
          throw new Error('kv down');
        }
        return store.get(key) ?? null;
      },
      put: async (key: string, value: string) => {
        if (key === LINE_QUOTA_ALERT_STATE_KV_KEY) {
          alertPuts.push(value);
        }
        store.set(key, value);
      },
    },
  } as unknown as Bindings;
  const alertState = (): LineQuotaAlertState => JSON.parse(store.get(LINE_QUOTA_ALERT_STATE_KV_KEY) ?? '{}');
  return { env, alertPuts, failGetFor, alertState };
}

function setUsage(used: number, limit = 10000): void {
  mocks.getQuota.mockResolvedValue({ success: true, type: 'limited', value: limit });
  mocks.getUsage.mockResolvedValue({ success: true, totalUsage: used });
}

function setFailure(error = 'API error: 401'): void {
  mocks.getQuota.mockResolvedValue({ success: false, error });
}

type BulkCall = { notifications: Array<{ userId: string; type: string; priority: string; title: string; content: string; data: Record<string, unknown>; expiresAt: Date }> };
const calls = (): BulkCall[] => mocks.createBulk.mock.calls.map((call) => call[0] as BulkCall);
const titles = (): string[] => calls().map((call) => call.notifications[0].title);

describe('LINE quota alerts', () => {
  let fixture: Fixture;
  let kv: ReturnType<typeof makeEnv>;
  let service: LineQuotaMonitorService;
  let clock: number;

  /** Each poll is a minute apart so a manual refresh never hits the 30s throttle. */
  const poll = async (source: 'cron' | 'manual' = 'cron') => {
    clock += 60_000;
    vi.setSystemTime(clock);
    return service.refresh(source);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    clock = Date.parse('2026-11-23T00:00:00.000Z');
    vi.setSystemTime(clock);
    fixture = {
      channels: [{ credentials: 'tok-a', teamName: 'Sales' }],
      admins: [{ id: 'admin-1' }, { id: 'admin-2' }],
      adminQueryError: null,
    };
    kv = makeEnv();
    service = new LineQuotaMonitorService(makeDb(fixture), kv.env);
    mocks.createBulk.mockImplementation(async (request: BulkCall) => ({
      successful: request.notifications.map((_, index) => `n-${index}`),
      failed: [],
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends nothing while the channel is above every level', async () => {
    setUsage(7000);
    await poll();

    expect(mocks.createBulk).not.toHaveBeenCalled();
  });

  it('notifies every admin once when remaining drops to 20%', async () => {
    setUsage(8500);
    await poll();

    expect(mocks.createBulk).toHaveBeenCalledTimes(1);
    const [call] = calls();
    expect(call.notifications.map((n) => n.userId)).toEqual(['admin-1', 'admin-2']);
    const [notice] = call.notifications;
    expect(notice).toMatchObject({
      type: 'system',
      priority: 'high',
      title: 'LINE 額度剩餘不到 20%',
      data: { kind: 'line_quota_alert', level: 20 },
    });
    expect(notice.data.channelKey).toEqual(expect.any(String));
    // remaining 1500 sits inside the 2000-message reserve (default ratio), so broadcasts are out.
    expect(notice.content).toBe(
      '「Sales」本月已用 8,500 / 10,000 則，剩餘 1,500 則（15%）。群發已無可用額度（保留 2,000 則給客服回覆），客服回覆不受影響。'
    );
    expect(notice.expiresAt.getTime() - Date.now()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(JSON.stringify(call)).not.toContain('tok-a');
  });

  it('omits the broadcast line while broadcasts still have usable quota', async () => {
    const env = makeEnv();
    env.env.BROADCAST_QUOTA_RESERVE_RATIO = '0.05';
    service = new LineQuotaMonitorService(makeDb(fixture), env.env);
    setUsage(8500);
    await poll();

    expect(calls()[0].notifications[0].content).toBe('「Sales」本月已用 8,500 / 10,000 則，剩餘 1,500 則（15%）。');
  });

  it('sends one 10% notice when one poll crosses both levels', async () => {
    setUsage(9200);
    await poll();

    expect(titles()).toEqual(['LINE 額度剩餘不到 10%']);
    expect(kv.alertState()[Object.keys(kv.alertState())[0]].notifiedLevels).toEqual([10, 20]);
  });

  it('sends the 10% notice after the 20% one as usage keeps growing', async () => {
    setUsage(8500);
    await poll();
    setUsage(9200);
    await poll();

    expect(titles()).toEqual(['LINE 額度剩餘不到 20%', 'LINE 額度剩餘不到 10%']);
  });

  it('does not repeat a level on later polls and does not rewrite unchanged state', async () => {
    setUsage(8500);
    await poll();
    await poll();
    await poll('manual');

    expect(mocks.createBulk).toHaveBeenCalledTimes(1);
    expect(kv.alertPuts).toHaveLength(1);
  });

  it('re-arms a level once the channel is back above it (monthly reset) and fires again', async () => {
    setUsage(9200);
    await poll();
    setUsage(100); // new month: usage back near zero
    await poll();
    expect(Object.values(kv.alertState())[0].notifiedLevels).toEqual([]);

    setUsage(8500);
    await poll();

    expect(titles()).toEqual(['LINE 額度剩餘不到 10%', 'LINE 額度剩餘不到 20%']);
  });

  it('never alerts for an unlimited channel and clears its levels', async () => {
    setUsage(9200);
    await poll();
    mocks.getQuota.mockResolvedValue({ success: true, type: 'none' });
    mocks.getUsage.mockResolvedValue({ success: true, totalUsage: 99999 });
    await poll();
    await poll();

    expect(mocks.createBulk).toHaveBeenCalledTimes(1);
    expect(Object.values(kv.alertState())[0].notifiedLevels).toEqual([]);
  });

  it('notifies once after 3 failed cron polls, not on the 4th, and again after a success and 3 more', async () => {
    setUsage(1000);
    await poll();
    setFailure();
    await poll();
    await poll();
    expect(mocks.createBulk).not.toHaveBeenCalled();

    await poll();
    expect(titles()).toEqual(['LINE 額度查詢連續失敗']);
    const [notice] = calls()[0].notifications;
    expect(notice.content).toBe(
      '「Sales」已連續 3 次無法查詢額度，用量數字可能已過期。請檢查此頻道的 Access Token。（錯誤：API error: 401）'
    );
    expect(notice).toMatchObject({ type: 'system', priority: 'high', data: { kind: 'line_quota_query_failed' } });
    expect(notice.data).not.toHaveProperty('level');

    await poll();
    expect(mocks.createBulk).toHaveBeenCalledTimes(1);

    setUsage(1000);
    await poll();
    expect(Object.values(kv.alertState())[0]).toMatchObject({ consecutiveFailures: 0, failureNotified: false });

    setFailure();
    await poll();
    await poll();
    await poll();
    expect(titles()).toEqual(['LINE 額度查詢連續失敗', 'LINE 額度查詢連續失敗']);
  });

  it('does not count manual failures toward the streak', async () => {
    setFailure();
    await poll();
    await poll();
    await poll('manual');
    await poll('manual');
    expect(mocks.createBulk).not.toHaveBeenCalled();

    await poll();
    expect(titles()).toEqual(['LINE 額度查詢連續失敗']);
  });

  it('does not judge thresholds on the stale numbers of a failed poll', async () => {
    // The 20% notice is still pending (its send failed), and the failed polls keep the 15% numbers.
    mocks.createBulk.mockResolvedValueOnce({ successful: [], failed: [{ index: 0, error: 'd1 down' }] });
    setUsage(8500);
    await poll();
    setFailure();
    await poll('manual');
    await poll();

    expect(mocks.createBulk).toHaveBeenCalledTimes(1);
  });

  it('masks long token-like runs in the error text', async () => {
    setFailure(`Invalid token ${'x'.repeat(40)}`);
    await poll();
    await poll();
    await poll();

    expect(calls()[0].notifications[0].content).toContain('（錯誤：Invalid token ***）');
  });

  it('keeps the level unmarked when no notification was created, and retries on the next poll', async () => {
    mocks.createBulk.mockResolvedValueOnce({ successful: [], failed: [{ index: 0, error: 'd1 down' }] });
    setUsage(8500);
    await poll();
    expect(Object.values(kv.alertState())[0]?.notifiedLevels ?? []).toEqual([]);

    mocks.createBulk.mockRejectedValueOnce(new Error('d1 down'));
    await poll();

    await poll();
    await poll();
    expect(mocks.createBulk).toHaveBeenCalledTimes(3);
    expect(Object.values(kv.alertState())[0].notifiedLevels).toEqual([20]);
  });

  it('keeps a failure notice unmarked when its send fails, and retries on the next failed cron poll', async () => {
    setFailure();
    await poll();
    await poll();
    mocks.createBulk.mockRejectedValueOnce(new Error('d1 down'));
    await poll();
    await poll();
    await poll();

    expect(mocks.createBulk).toHaveBeenCalledTimes(2);
    expect(Object.values(kv.alertState())[0]).toMatchObject({ consecutiveFailures: 5, failureNotified: true });
  });

  it('sends nothing without an active admin, and sends once one exists', async () => {
    fixture.admins = [];
    setUsage(8500);
    await expect(poll()).resolves.toMatchObject({ items: [expect.objectContaining({ remaining: 1500 })] });
    expect(mocks.createBulk).not.toHaveBeenCalled();

    fixture.admins = [{ id: 'admin-1' }];
    await poll();
    expect(mocks.createBulk).toHaveBeenCalledTimes(1);
  });

  it('drops state for channels that left the snapshot', async () => {
    fixture.channels = [
      { credentials: 'tok-a', teamName: 'Sales' },
      { credentials: 'tok-b', teamName: 'Support' },
    ];
    setUsage(8500);
    await poll();
    expect(Object.keys(kv.alertState())).toHaveLength(2);

    fixture.channels = [{ credentials: 'tok-a', teamName: 'Sales' }];
    await poll();
    expect(Object.keys(kv.alertState())).toHaveLength(1);
  });

  it('never breaks or changes the refresh result when alert evaluation throws', async () => {
    setUsage(8500);
    fixture.adminQueryError = new Error('d1 down');
    const failing = await poll();
    expect(failing.items[0]).toMatchObject({ remaining: 1500, usableRemaining: 0, error: null });
    expect(kv.alertPuts).toHaveLength(0);

    kv.failGetFor.add(LINE_QUOTA_ALERT_STATE_KV_KEY);
    await expect(poll()).resolves.toMatchObject({ source: 'cron', items: [expect.objectContaining({ used: 8500 })] });
    expect(mocks.createBulk).not.toHaveBeenCalled();
  });
});
