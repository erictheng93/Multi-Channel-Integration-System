import { beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('@/utils/logger', () => ({ createContextLogger: () => logger }));

import { ROWS_READ_WARN_THRESHOLD, RowsReadMeter, rowsReadOf } from '@/utils/d1-rows-read';

beforeEach(() => vi.clearAllMocks());

describe('rowsReadOf', () => {
  it('reads meta.rows_read from one result or sums a batch', () => {
    expect(rowsReadOf({ meta: { rows_read: 12 } })).toBe(12);
    expect(rowsReadOf([{ meta: { rows_read: 5 } }, { meta: { rows_read: 7 } }, {}])).toBe(12);
  });

  it('treats missing, non-numeric and negative values as 0', () => {
    expect(rowsReadOf(undefined)).toBe(0);
    expect(rowsReadOf(null)).toBe(0);
    expect(rowsReadOf({ results: [] })).toBe(0);
    expect(rowsReadOf({ meta: { rows_read: 'many' } })).toBe(0);
    expect(rowsReadOf({ meta: { rows_read: -4 } })).toBe(0);
  });
});

describe('RowsReadMeter', () => {
  it('is silent at or below the threshold and returns the total', () => {
    const meter = new RowsReadMeter('dashboard.summary');
    meter.track({ meta: { rows_read: ROWS_READ_WARN_THRESHOLD } });
    expect(meter.flush()).toBe(ROWS_READ_WARN_THRESHOLD);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs one structured warning naming the endpoint and the per-query split above the threshold', () => {
    const meter = new RowsReadMeter('conversations.waiting');
    meter.track({ meta: { rows_read: 1500 } });
    meter.track([{ meta: { rows_read: 400 } }, { meta: { rows_read: 200 } }]);
    meter.flush({ scope: 'all' });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('D1 rows_read above threshold', {
      label: 'conversations.waiting',
      rowsRead: 2100,
      threshold: 2000,
      perQuery: [1500, 600],
      scope: 'all',
    });
  });

  it('honours a custom threshold, returns the tracked value unchanged and ignores results without meta', () => {
    const meter = new RowsReadMeter('x', 10);
    const result = { results: [1], meta: { rows_read: 11 } };
    expect(meter.track(result)).toBe(result);
    meter.track({ results: [] });
    meter.flush();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(meter.rowsRead).toBe(11);
  });
});
