import { handleLineMessageQueue } from '@modules/queue/handlers/line-message-queue';
import { handleScheduledEvent } from '@modules/system/handlers/task-reminder-main';
import { ReportSchedulerService } from '@modules/reports/services/report-scheduler-service';
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
