import { handleLineMessageQueue } from '@modules/queue/handlers/line-message-queue';
import { handleScheduledEvent } from '@modules/system/handlers/task-reminder-main';
import { ReportSchedulerService } from '@modules/reports/services/report-scheduler-service';
import {
  LINE_QUOTA_CRON,
  LineQuotaMonitorService,
} from '@modules/broadcast/services/line-quota-monitor-service';
import { recordWsMetricsSnapshot } from '@modules/websocket/services/realtime-metrics-service';
import { createDbClient } from '@/db/drizzle-factory';
import { aggregateMessageRollup, healRecentMessageRollup } from '@modules/dashboard/services/message-rollup-service';
import { healAwaitingSince } from '@modules/dashboard/services/awaiting-service';
import { RowsReadMeter } from '@/utils/d1-rows-read';
import type { Bindings } from '../types';
import type { LineQueuePayload } from '../types/bindings';
import { createContextLogger } from '../utils/logger';

const log = createContextLogger('WorkerRuntime');

export async function queue(
  batch: MessageBatch<LineQueuePayload>,
  env: Bindings
): Promise<void> {
  log.info('LINE Queue received batch', { messageCount: batch.messages.length });
  await handleLineMessageQueue(batch, env);
}

export async function scheduled(
  event: ScheduledEvent,
  env: Bindings,
  _ctx: ExecutionContext
): Promise<void> {
  log.info('Scheduled event triggered', { cron: event.cron, scheduledTime: event.scheduledTime });

  // The daily quota cron must not also run the 5-minute reminder/report work (it would run twice).
  if (event.cron === LINE_QUOTA_CRON) {
    try {
      const snapshot = await new LineQuotaMonitorService(createDbClient(env.DB), env).refresh('cron');
      log.info('LINE quota snapshot refreshed', { channels: snapshot.items.length });
    } catch (error) {
      log.error('LINE quota poll failed', {}, error instanceof Error ? error : new Error(String(error)));
    }
    // Nightly (02:00 Taipei) self-heal of the derived dashboard data. No Durable Object
    // alarm: this is the existing daily cron, runs once, and each step is bounded.
    await runNightlyHeal(env);
    return;
  }

  const [, , reportStats, rollupResult] = await Promise.allSettled([
    handleScheduledEvent(env),
    // One broadcaster request + one insert + 7-day prune; never throws, no DO alarm involved.
    recordWsMetricsSnapshot(env),
    (async () => {
      const scheduler = new ReportSchedulerService(env);
      return scheduler.processScheduledReports();
    })(),
    // Fold new messages into message_daily_stats. Reads only messages after the watermark.
    aggregateMessageRollup(env.DB, Date.now()),
  ]);
  if (rollupResult.status === 'rejected') {
    log.error('Message rollup aggregation failed', {}, rollupResult.reason instanceof Error ? rollupResult.reason : new Error(String(rollupResult.reason)));
  }
  if (reportStats.status === 'fulfilled' && reportStats.value.processed > 0) {
    log.info('Scheduled reports processed', {
      processed: reportStats.value.processed,
      succeeded: reportStats.value.succeeded,
      failed: reportStats.value.failed
    });
  }
}

/**
 * Recompute derived dashboard data that triggers and the incremental rollup cannot keep exact:
 *  - message_daily_stats for the last 2 Taipei days (recalls, soft deletes, late rows, reassignment)
 *  - conversations.awaiting_since where it disagrees with messages (recalled replies, deleted messages)
 */
async function runNightlyHeal(env: Bindings): Promise<void> {
  const meter = new RowsReadMeter('cron.nightly-heal', 20_000);
  try {
    const rollup = await healRecentMessageRollup(env.DB, Date.now());
    log.info('Message rollup healed', { fromDay: rollup.fromDay, healed: rollup.healed });
  } catch (error) {
    log.error('Message rollup heal failed', {}, error instanceof Error ? error : new Error(String(error)));
  }
  try {
    const awaiting = await healAwaitingSince(env.DB, Date.now(), meter);
    log.info('awaiting_since healed', { corrected: awaiting.corrected });
  } catch (error) {
    log.error('awaiting_since heal failed', {}, error instanceof Error ? error : new Error(String(error)));
  }
  meter.flush();
}
