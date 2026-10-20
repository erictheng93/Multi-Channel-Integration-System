/**
 * Worker runtime configuration the installer must reproduce through the
 * Cloudflare API, because deployWorker() uploads a bundle and never reads wrangler.toml.
 *
 * Keep in sync with the repository root wrangler.toml
 * ([triggers].crons, [[queues.consumers]], and the [[migrations]] history).
 * tests/unit/constants/worker-runtime.test.ts compares them against the file.
 */

/** wrangler.toml [triggers].crons. scheduled() dispatches on the exact string. */
export const WORKER_CRON_SCHEDULES: readonly string[] = ['*/5 * * * *', '0 18 * * *'];

/** wrangler.toml [[queues.consumers]] for line-message-queue (max_batch_timeout is seconds there). */
export const LINE_QUEUE_CONSUMER_SETTINGS = {
  batch_size: 10,
  max_wait_time_ms: 1000,
  max_retries: 3
} as const;

/**
 * Durable Object migration tag the installer records on the Worker. Fresh deploys create
 * every class and set this tag; an existing Worker whose tag differs gets the removal step.
 */
export const DO_MIGRATION_TAG = 'installer-v2';

/**
 * Classes removed from the Worker (root wrangler.toml migration v7). An installer-managed
 * Worker deployed before the removal still owns the namespace, its stored counters and,
 * on bundles older than 2026-10-07, a per-minute self-renewing alarm; only a
 * deleted_classes migration removes them.
 */
export const REMOVED_DURABLE_OBJECT_CLASSES: readonly string[] = ['MetricsCollectorDO'];
