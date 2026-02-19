// Broadcaster Lock Service
// Distributed locking for event queue processing coordination

import type { DistributedLock, LockAcquisitionOptions } from '../../types/websocket-types';
import type { BroadcasterContext } from './broadcaster-helpers';
import { createContextLogger } from '../../utils/logger';
import { nowMs } from '@/utils/timestamp'

const log = createContextLogger('MessageBroadcaster');

/**
 * Manages distributed locks for MessageBroadcaster queue processing.
 * Prevents concurrent processing of the same queue.
 */
export class BroadcasterLockService {
  constructor(private ctx: BroadcasterContext) {}

  async acquireLock(resource: string, options: LockAcquisitionOptions = {}): Promise<string> {
    const {
      ttl = this.ctx.config.LOCK_TTL,
      timeout: _timeout = 5000,
      retryInterval = 100,
      maxRetries = 50
    } = options;

    const lockId = this.generateLockId();
    const expiresAt = Date.now() + ttl;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const existingLock = await this.ctx.state.storage.get(`lock:${resource}`);

        if (!existingLock || (existingLock as DistributedLock).expiresAt < nowMs()) {
          const lock: DistributedLock = {
            lockId,
            resource,
            ownerId: 'MessageBroadcaster',
            acquiredAt: nowMs(),
            expiresAt,
            isActive: true
          };

          await this.ctx.state.storage.put(`lock:${resource}`, lock);
          this.ctx.locks.set(lockId, lock);

          return lockId;
        }

        await this.sleep(retryInterval);
      } catch (error) {
        log.error('Lock acquisition error', { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }

    throw new Error(`Failed to acquire lock for ${resource}`);
  }

  async releaseLock(lockId: string): Promise<void> {
    try {
      const lock = this.ctx.locks.get(lockId);
      if (!lock) return;

      await this.ctx.state.storage.delete(`lock:${lock.resource}`);
      this.ctx.locks.delete(lockId);
    } catch (error) {
      log.error('Lock release error', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  async cleanupExpiredLocks(): Promise<void> {
    const now = nowMs();
    const expiredLocks = Array.from(this.ctx.locks.entries())
      .filter(([_, lock]) => lock.expiresAt < now);

    for (const [lockId, lock] of expiredLocks) {
      await this.ctx.state.storage.delete(`lock:${lock.resource}`);
      this.ctx.locks.delete(lockId);
    }

    if (expiredLocks.length > 0) {
      console.log(`🧹 [MessageBroadcaster] Cleaned up ${expiredLocks.length} expired locks`);
    }
  }

  private generateLockId(): string {
    return `lock_${nowMs()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
