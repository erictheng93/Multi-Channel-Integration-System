// Shared dependencies and base class for event broadcaster sub-modules
// Extracted from event-broadcaster.ts to avoid circular imports

import type { Bindings } from '@/types';
import type { Logger } from '@/services/logger-service';
import { createLogger } from '@/services/logger-service';
import type { DurableObjectClient } from './durable-object-client';
import type { BatchQueueManager } from './batch-queue-manager';

/**
 * Base class for event broadcaster sub-modules.
 * Provides shared access to env, doClient, batchManager, and logger.
 */
export class EventBroadcasterBase {
  protected env: Bindings;
  protected doClient: DurableObjectClient;
  protected batchManager: BatchQueueManager;
  protected logger: Logger;

  constructor(
    env: Bindings,
    doClient: DurableObjectClient,
    batchManager: BatchQueueManager,
    loggerLabel: string
  ) {
    this.env = env;
    this.doClient = doClient;
    this.batchManager = batchManager;
    this.logger = createLogger({ service: loggerLabel }, {
      serviceName: 'event-broadcaster'
    });
  }
}
