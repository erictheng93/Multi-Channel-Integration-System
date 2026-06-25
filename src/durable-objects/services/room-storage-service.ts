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
export class RoomStorageService {
  constructor(
    private ctx: RoomContext,
    private helpers: RoomHelpers
  ) {}

  async initializeFromStorage(): Promise<void> {
    try {
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
    this.ctx.storageFlushDeadline = Date.now() + this.ctx.STORAGE_WRITE_DEBOUNCE_MS;
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
        testSafeLog(`\uD83D\uDCBE [ConversationRoom] Message history force-saved (${this.ctx.messageHistory.length} messages)`);
      } catch (error) {
        testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Force storage write error:`, error);
        this.ctx.storageFlushDeadline = Date.now() + 1000;
      }
    }
  }

  async flushDueMessageHistory(now = Date.now()): Promise<void> {
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
    const deadlines = [
      this.ctx.storageFlushDeadline,
      this.getNextTokenExpiryDeadline()
    ].filter((deadline): deadline is number => typeof deadline === 'number' && Number.isFinite(deadline));

    if (deadlines.length === 0) {
      if (typeof this.ctx.state.storage.deleteAlarm === 'function') {
        await this.ctx.state.storage.deleteAlarm();
      }
      return;
    }

    await this.ctx.state.storage.setAlarm(Math.min(...deadlines));
  }
}
