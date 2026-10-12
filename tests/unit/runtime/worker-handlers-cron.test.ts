import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  handleScheduledEvent: vi.fn(),
  processScheduledReports: vi.fn(),
}));

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
});
