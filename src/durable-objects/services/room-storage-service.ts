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
        this.ctx.participants = new Set(participants);
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
   * Schedules a write to DO storage after STORAGE_WRITE_DEBOUNCE_MS (5 seconds).
   * If called multiple times within the debounce window, the timer is reset.
   * This significantly reduces storage write frequency in high-message scenarios.
   */
  scheduleStorageWrite(): void {
    // Clear existing timer if any
    if (this.ctx.writeDebounceTimer) {
      clearTimeout(this.ctx.writeDebounceTimer);
    }

    // Schedule write after debounce period
    this.ctx.writeDebounceTimer = setTimeout(async () => {
      if (this.ctx.messageDirty) {
        try {
          await this.ctx.state.storage.put('messageHistory', this.ctx.messageHistory);
          this.ctx.messageDirty = false;
          testSafeLog(`\uD83D\uDCBE [ConversationRoom] Message history persisted (${this.ctx.messageHistory.length} messages, debounced)`);
        } catch (error) {
          testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Storage write error:`, error);
          // Retry after 1 second if write fails
          setTimeout(() => this.scheduleStorageWrite(), 1000);
        }
      }
    }, this.ctx.STORAGE_WRITE_DEBOUNCE_MS);
  }

  /**
   * Force immediate storage write (called on DO shutdown/cleanup)
   */
  async forceStorageWrite(): Promise<void> {
    if (this.ctx.writeDebounceTimer) {
      clearTimeout(this.ctx.writeDebounceTimer);
      this.ctx.writeDebounceTimer = null;
    }

    if (this.ctx.messageDirty) {
      try {
        await this.ctx.state.storage.put('messageHistory', this.ctx.messageHistory);
        this.ctx.messageDirty = false;
        testSafeLog(`\uD83D\uDCBE [ConversationRoom] Message history force-saved (${this.ctx.messageHistory.length} messages)`);
      } catch (error) {
        testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Force storage write error:`, error);
      }
    }
  }
}
