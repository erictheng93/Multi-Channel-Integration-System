import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  handleScheduledEvent: vi.fn(),
  processScheduledReports: vi.fn(),
  aggregate: vi.fn(),
  healRollup: vi.fn(),
  healAwaiting: vi.fn(),
}));

vi.mock('@modules/dashboard/services/message-rollup-service', () => ({
  aggregateMessageRollup: mocks.aggregate,
  healRecentMessageRollup: mocks.healRollup,
}));
vi.mock('@modules/dashboard/services/awaiting-service', () => ({ healAwaitingSince: mocks.healAwaiting }));
vi.mock('@modules/queue/handlers/line-message-queue', () => ({ handleLineMessageQueue: vi.fn() }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: vi.fn(() => ({})) }));
vi.mock('@modules/system/handlers/task-reminder-main', () => ({
  handleScheduledEvent: mocks.handleScheduledEvent,
}));
vi.mock('@modules/reports/services/report-scheduler-service', () => ({
  ReportSchedulerService: vi.fn(function () {
    return { processScheduledReports: mocks.processScheduledReports };
  }),
}));
vi.mock('@modules/broadcast/services/line-quota-monitor-service', () => ({
  LINE_QUOTA_CRON: '0 18 * * *',
  LineQuotaMonitorService: vi.fn(function () {
    return { refresh: mocks.refresh };
  }),
}));

import { scheduled } from '@/runtime/worker-handlers';

const env = { DB: {} } as Bindings;
const ctx = {} as ExecutionContext;
const event = (cron: string) => ({ cron, scheduledTime: Date.now() }) as ScheduledEvent;

describe('scheduled() cron dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refresh.mockResolvedValue({ items: [] });
    mocks.handleScheduledEvent.mockResolvedValue(undefined);
    mocks.processScheduledReports.mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 });
    mocks.aggregate.mockResolvedValue({ status: 'aggregated', watermark: 'x' });
    mocks.healRollup.mockResolvedValue({ fromDay: '2026-10-28', healed: true });
    mocks.healAwaiting.mockResolvedValue({ corrected: 0 });
  });

  it('runs only the quota poll on the daily cron', async () => {
    await scheduled(event('0 18 * * *'), env, ctx);

    expect(mocks.refresh).toHaveBeenCalledWith('cron');
    expect(mocks.handleScheduledEvent).not.toHaveBeenCalled();
    expect(mocks.processScheduledReports).not.toHaveBeenCalled();
  });

  it('keeps the 5-minute cron on reminders and reports without polling quota', async () => {
    await scheduled(event('*/5 * * * *'), env, ctx);

    expect(mocks.handleScheduledEvent).toHaveBeenCalledTimes(1);
    expect(mocks.processScheduledReports).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('does not throw when the quota poll fails', async () => {
    mocks.refresh.mockRejectedValue(new Error('kv down'));

    await expect(scheduled(event('0 18 * * *'), env, ctx)).resolves.toBeUndefined();
  });

  it('5-minute cron with the broadcaster unavailable records nothing and does not throw', async () => {
    const insert = vi.fn();
    const remove = vi.fn(async () => undefined);
    const { createDbClient } = await import('@/db/drizzle-factory');
    vi.mocked(createDbClient).mockReturnValueOnce({
      insert: () => ({ values: insert }),
      delete: () => ({ where: remove }),
    } as never);
    const broken = {
      DB: {},
      MESSAGE_BROADCASTER: {
        idFromName: (n: string) => n,
        get: () => ({ fetch: async () => { throw new Error('broadcaster down'); } }),
      },
    } as unknown as Bindings;

    await expect(scheduled(event('*/5 * * * *'), broken, ctx)).resolves.toBeUndefined();

    expect(insert).not.toHaveBeenCalled();
    expect(mocks.processScheduledReports).toHaveBeenCalledTimes(1);
  });

  it('does not snapshot realtime metrics on the daily cron', async () => {
    const fetch = vi.fn();
    const withBroadcaster = {
      DB: {},
      MESSAGE_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ fetch }) },
    } as unknown as Bindings;
    await scheduled(event('0 18 * * *'), withBroadcaster, ctx);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('folds new messages into the rollup on the 5-minute cron only', async () => {
    await scheduled(event('*/5 * * * *'), env, ctx);
    expect(mocks.aggregate).toHaveBeenCalledTimes(1);
    expect(mocks.healRollup).not.toHaveBeenCalled();
    expect(mocks.healAwaiting).not.toHaveBeenCalled();
  });

  it('a failing rollup aggregation never breaks the other 5-minute work', async () => {
    mocks.aggregate.mockRejectedValue(new Error('d1 down'));
    await expect(scheduled(event('*/5 * * * *'), env, ctx)).resolves.toBeUndefined();
    expect(mocks.handleScheduledEvent).toHaveBeenCalledTimes(1);
    expect(mocks.processScheduledReports).toHaveBeenCalledTimes(1);
  });

  it('self-heals rollup days and awaiting_since once on the daily cron, and each step fails independently', async () => {
    mocks.healRollup.mockRejectedValue(new Error('boom'));
    await expect(scheduled(event('0 18 * * *'), env, ctx)).resolves.toBeUndefined();
    expect(mocks.healRollup).toHaveBeenCalledTimes(1);
    expect(mocks.healAwaiting).toHaveBeenCalledTimes(1);
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
