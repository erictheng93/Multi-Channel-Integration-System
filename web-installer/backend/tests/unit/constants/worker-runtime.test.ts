/**
 * The installer reproduces wrangler.toml settings through the Cloudflare API.
 * These tests pin the constants to the repository root wrangler.toml.
 */
import { describe, it, expect } from 'vitest';
import rootWrangler from '../../../../../wrangler.toml?raw';
import {
  DO_MIGRATION_TAG,
  LINE_QUEUE_CONSUMER_SETTINGS,
  REMOVED_DURABLE_OBJECT_CLASSES,
  WORKER_CRON_SCHEDULES
} from '@/constants/worker-runtime';
import { DURABLE_OBJECT_CLASS_NAMES } from '@/constants/durable-objects';

describe('worker-runtime constants vs root wrangler.toml', () => {
  it('cron schedules match [triggers].crons', () => {
    const line = rootWrangler.match(/^crons\s*=\s*\[(.*)\]\s*$/m)?.[1] ?? '';
    const crons = [...line.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    expect(crons.length).toBeGreaterThan(0);
    expect([...WORKER_CRON_SCHEDULES]).toEqual(crons);
  });

  it('line queue consumer settings match [[queues.consumers]]', () => {
    const block = rootWrangler.match(/\[\[queues\.consumers\]\][\s\S]*?(?=\n\[\[|\n\[[a-z])/)?.[0] ?? '';
    const num = (key: string) => Number(block.match(new RegExp(`^${key}\\s*=\\s*(\\d+)`, 'm'))?.[1]);
    expect(LINE_QUEUE_CONSUMER_SETTINGS.batch_size).toBe(num('max_batch_size'));
    expect(LINE_QUEUE_CONSUMER_SETTINGS.max_wait_time_ms).toBe(num('max_batch_timeout') * 1000);
    expect(LINE_QUEUE_CONSUMER_SETTINGS.max_retries).toBe(num('max_retries'));
  });

  it('removed classes match the deleted_classes migrations and are no longer created', () => {
    const deleted = [...rootWrangler.matchAll(/^deleted_classes\s*=\s*\[(.*)\]/gm)]
      .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
    expect([...REMOVED_DURABLE_OBJECT_CLASSES].sort()).toEqual(deleted.sort());
    for (const removed of REMOVED_DURABLE_OBJECT_CLASSES) {
      expect(DURABLE_OBJECT_CLASS_NAMES).not.toContain(removed);
    }
    expect(DO_MIGRATION_TAG).toBeTruthy();
  });
});
