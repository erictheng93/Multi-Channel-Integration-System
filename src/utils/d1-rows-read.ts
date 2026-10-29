/**
 * D1 rows-read guardrail.
 *
 * D1 bills per row READ, and a query that quietly turns into a table scan shows
 * up only on the invoice (2026-07: unread-count scans, USD 22). Every dashboard
 * query reports its `meta.rows_read` through a meter; when one request adds up to
 * more than the threshold the meter logs a structured warning that names the
 * endpoint, so the regression is visible in `wrangler tail` / logs the day it ships.
 *
 * Only `.all()`, `.run()` and `.batch()` results carry `meta`; `.first()` drops it,
 * so guarded queries use `.all()`. Results without meta (test doubles, older
 * runtimes) count as 0 and never warn.
 */

import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('D1RowsRead');

/** One dashboard request should read a few hundred rows; 2,000 means something scans history. */
export const ROWS_READ_WARN_THRESHOLD = 2000;

interface MetaLike {
  rows_read?: unknown;
}

/** Sum rows_read over one D1 result or an array of results (batch). */
export function rowsReadOf(result: unknown): number {
  if (Array.isArray(result)) {
    return result.reduce<number>((sum, item) => sum + rowsReadOf(item), 0);
  }
  if (result === null || typeof result !== 'object') { return 0; }
  const meta = (result as { meta?: MetaLike }).meta;
  const value = Number(meta?.rows_read ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export class RowsReadMeter {
  private total = 0;
  private readonly queries: number[] = [];

  constructor(
    private readonly label: string,
    private readonly threshold: number = ROWS_READ_WARN_THRESHOLD
  ) {}

  /** Record a D1 result (or batch of results) and return it unchanged. */
  track<T>(result: T): T {
    const rows = rowsReadOf(result);
    this.total += rows;
    this.queries.push(rows);
    return result;
  }

  get rowsRead(): number {
    return this.total;
  }

  /** Log a structured warning when the request read more than the threshold. Returns the total. */
  flush(context: Record<string, unknown> = {}): number {
    if (this.total > this.threshold) {
      log.warn('D1 rows_read above threshold', {
        label: this.label,
        rowsRead: this.total,
        threshold: this.threshold,
        perQuery: this.queries,
        ...context
      });
    }
    return this.total;
  }
}
