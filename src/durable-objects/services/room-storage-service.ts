// Room Storage Service
// Debounced storage writes, message history load/save, state initialization

import type { RealtimeEvent } from '../../types';
import type { RoomContext, RoomHelpers } from './room-helpers';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../../utils/test-logger';

/**
 * Manages all persistent storage operations for ConversationRoom:
 * - State initialization from DO storage
 * - Debounced message history writes
 * - Force storage writes on shutdown
 */
/** Flush retry policy: 1s, 2s, 4s ... capped at 60s, at most 5 consecutive failed attempts. */
const FLUSH_RETRY_BASE_MS = 1000;
const FLUSH_RETRY_MAX_MS = 60000;
const FLUSH_MAX_ATTEMPTS = 5;

export class RoomStorageService {
  /**
   * Consecutive failed flushes. In memory on purpose: eviction only costs a few
   * extra bounded retries, and persisting it would add a storage write per failure.
   */
  private flushFailures = 0;
  /**
   * Set once the retry budget is spent. Unrelated wakes (the five-minute access check)
   * must not treat the missing deadline as "due" and keep writing during an outage;
   * only new message work (scheduleStorageWrite) clears it.
   */
  private flushExhausted = false;
  private alarmSeed: Promise<void> | null = null;

  constructor(
    private ctx: RoomContext,
    private helpers: RoomHelpers
  ) {}

  async initializeFromStorage(): Promise<void> {
    try {
      this.ctx.accessCheckDeadline = await this.ctx.state.storage.get<number>('accessCheckDeadline') ?? null;
      // Restore participants
      const participants = await this.ctx.state.storage.get('participants') as string[];
      if (participants) {
        this.ctx.participants = new Set([
          ...this.ctx.participants,
          ...participants
        ]);
      }

      // Restore message history (full mode only)
      if (this.helpers.isFullMode()) {
        const messageHistory = await this.ctx.state.storage.get('messageHistory') as RealtimeEvent[];
        if (messageHistory) {
          this.ctx.messageHistory = messageHistory;
        }
      }

      // Restore shard metadata (Week 2: Sharding Implementation)
      const storedMetadata = await this.ctx.state.storage.get('shardMetadata') as typeof this.ctx.shardMetadata;
      if (storedMetadata) {
        this.ctx.shardMetadata = {
          ...this.ctx.shardMetadata, // Keep default maxConnections
          ...storedMetadata
        };
        testSafeLog(`[ConversationRoom] Shard metadata restored: ${this.ctx.shardMetadata.shardId || 'uninitialized'}`);
      }

      testSafeLog(`[ConversationRoom] State restored: ${this.ctx.participants.size} participants${this.helpers.isFullMode() ? `, ${this.ctx.messageHistory.length} messages` : ''}`);
    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] State restoration error:`, error);
    }
  }

  /**
   * Debounced storage write for message history
   *
   * Schedules an alarm-backed write to DO storage after STORAGE_WRITE_DEBOUNCE_MS (5 seconds).
   * If called multiple times within the debounce window, the alarm deadline is reset.
   * This significantly reduces storage write frequency in high-message scenarios.
   */
  scheduleStorageWrite(): void {
    // Fixed window, not sliding: steady traffic flushes every 5s and leaves the alarm untouched.
    if (!this.ctx.storageFlushDeadline) {
      // New window (also the wake-up after a given-up failure): fresh message work resets the retry budget.
      this.flushFailures = 0;
      this.flushExhausted = false;
      this.ctx.storageFlushDeadline = Date.now() + this.ctx.STORAGE_WRITE_DEBOUNCE_MS;
    }
    this.scheduleNextAlarm().catch((error) => {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Alarm scheduling error:`, error);
    });
  }

  /**
   * Force immediate storage write (called on DO shutdown/cleanup)
   */
  async forceStorageWrite(): Promise<void> {
    if (this.ctx.messageDirty) {
      try {
        await this.ctx.state.storage.put('messageHistory', this.ctx.messageHistory);
        this.ctx.messageDirty = false;
        this.ctx.storageFlushDeadline = null;
        this.flushFailures = 0;
        testSafeLog(`\uD83D\uDCBE [ConversationRoom] Message history force-saved (${this.ctx.messageHistory.length} messages)`);
      } catch (error) {
        testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Force storage write error:`, error);
        this.flushFailures += 1;
        if (this.flushFailures >= FLUSH_MAX_ATTEMPTS) {
          // Give up re-arming: stop condition for the flush alarm chain. The data stays dirty,
          // so the next message (scheduleStorageWrite) or any other wake retries with a fresh budget.
          this.ctx.storageFlushDeadline = null;
          this.flushExhausted = true;
        } else {
          const delay = Math.min(FLUSH_RETRY_BASE_MS * 2 ** (this.flushFailures - 1), FLUSH_RETRY_MAX_MS);
          this.ctx.storageFlushDeadline = Date.now() + delay;
        }
      }
    }
  }

  async flushDueMessageHistory(now = Date.now()): Promise<void> {
    if (this.flushExhausted) return; // budget spent: wait for new message work, not for the next unrelated wake
    if (this.ctx.messageDirty && (!this.ctx.storageFlushDeadline || this.ctx.storageFlushDeadline <= now)) {
      await this.forceStorageWrite();
    }
  }

  getNextTokenExpiryDeadline(now = Date.now()): number | null {
    let nextDeadline: number | null = null;
    for (const connection of this.ctx.connections.values()) {
      const tokenExp = connection.metadata?.tokenExp;
      if (typeof tokenExp !== 'number' || !Number.isFinite(tokenExp) || tokenExp <= 0) {
        continue;
      }

      const deadline = Math.max(now, tokenExp * 1000);
      if (nextDeadline === null || deadline < nextDeadline) {
        nextDeadline = deadline;
      }
    }
    return nextDeadline;
  }

  async scheduleNextAlarm(): Promise<void> {
    // Cold start: learn the persisted alarm with a cheap read so an idle object
    // never pays for a deleteAlarm/setAlarm write that changes nothing.
    // Memoised so concurrent (un-awaited per-message) callers share one read and cannot each arm.
    if (this.ctx.alarmAt === undefined && typeof this.ctx.state.storage.getAlarm === 'function') {
      this.alarmSeed ??= Promise.resolve(this.ctx.state.storage.getAlarm()).then((at) => {
        if (this.ctx.alarmAt === undefined) this.ctx.alarmAt = at ?? null;
      }).finally(() => { this.alarmSeed = null; });
      await this.alarmSeed;
    }
    if (this.ctx.connections.size > 0 && !this.ctx.accessCheckDeadline) {
      this.ctx.accessCheckDeadline = Date.now() + 300000;
      await this.ctx.state.storage.put('accessCheckDeadline', this.ctx.accessCheckDeadline);
    } else if (this.ctx.connections.size === 0 && this.ctx.accessCheckDeadline) {
      this.ctx.accessCheckDeadline = null;
      await this.ctx.state.storage.delete('accessCheckDeadline');
      await this.ctx.state.storage.delete('accessCheckFailures'); // no sockets left: backoff state is moot
    }
    const deadlines = [
      this.ctx.storageFlushDeadline,
      this.getNextTokenExpiryDeadline(),
      this.ctx.accessCheckDeadline
    ].filter((deadline): deadline is number => typeof deadline === 'number' && Number.isFinite(deadline));

    // Skip the storage write when the alarm is already where it needs to be.
    if (deadlines.length === 0) {
      // alarmAt is null when no alarm is pending (known), so an idle object writes nothing.
      if (this.ctx.alarmAt !== null && typeof this.ctx.state.storage.deleteAlarm === 'function') {
        this.ctx.alarmAt = null;
        await this.ctx.state.storage.deleteAlarm();
      }
      this.ctx.alarmAt = null;
      return;
    }

    const next = Math.min(...deadlines);
    // An alarm already in the past fires immediately; re-arming it to a newer "now" would only add writes.
    const alreadyImminent = typeof this.ctx.alarmAt === 'number'
      && this.ctx.alarmAt <= Date.now() && next <= Date.now();
    if (next !== this.ctx.alarmAt && !alreadyImminent) {
      // Re-arm stop condition: only while a deadline (flush, token expiry, access check) is stored.
      // Claimed before the await so concurrent callers (un-awaited per-message calls) see it.
      this.ctx.alarmAt = next;
      try {
        await this.ctx.state.storage.setAlarm(next);
      } catch (error) {
        this.ctx.alarmAt = undefined;
        throw error;
      }
    }
  }
}
