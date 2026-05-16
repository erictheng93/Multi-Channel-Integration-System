/**
 * WorkerBundleService integration tests
 *
 * Verifies generated Cloudflare bindings match the runtime names used by the
 * bundled CRM Worker.
 */

import { describe, expect, it } from 'vitest';
import { WorkerBundleService } from '@/services/WorkerBundleService';
import type { CloudflareResources } from '@/types/deployment';

describe('WorkerBundleService', () => {
  it('generates storage binding names expected by the bundled Worker runtime', () => {
    const service = new WorkerBundleService();
    const resources: CloudflareResources = {
      d1DatabaseId: 'db-uuid',
      kvSessionNamespaceId: 'session-kv',
      kvCacheNamespaceId: 'cache-kv',
      r2BucketName: 'files-bucket',
      queueName: 'message-queue',
    };

    const names = service.generateBindings(resources, 'test-project').map(binding => binding.name);

    expect(names).toContain('DB');
    expect(names).toContain('SESSIONS');
    expect(names).toContain('CACHE');
    expect(names).toContain('R2_BUCKET');
    expect(names).toContain('LINE_MESSAGE_QUEUE');
    expect(names).toContain('METRICS_COLLECTOR');
    expect(names).not.toContain('SESSION_KV');
    expect(names).not.toContain('CACHE_KV');
    expect(names).not.toContain('FILE_STORAGE');
    expect(names).not.toContain('MESSAGE_QUEUE');
  });
});
