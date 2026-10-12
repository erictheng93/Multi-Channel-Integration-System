import { handleLineMessageQueue } from '@modules/queue/handlers/line-message-queue';
import { handleScheduledEvent } from '@modules/system/handlers/task-reminder-main';
import { ReportSchedulerService } from '@modules/reports/services/report-scheduler-service';
import {
  LINE_QUOTA_CRON,
  LineQuotaMonitorService,
} from '@modules/broadcast/services/line-quota-monitor-service';
import { createDbClient } from '@/db/drizzle-factory';
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
    return;
  }

  const [, reportStats] = await Promise.allSettled([
    handleScheduledEvent(env),
    (async () => {
      const scheduler = new ReportSchedulerService(env);
      return scheduler.processScheduledReports();
    })(),
  ]);
  if (reportStats.status === 'fulfilled' && reportStats.value.processed > 0) {
    log.info('Scheduled reports processed', {
      processed: reportStats.value.processed,
      succeeded: reportStats.value.succeeded,
      failed: reportStats.value.failed
    });
  }
}
