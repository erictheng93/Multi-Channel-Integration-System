import type { Ref } from 'vue'
import type { Conversation } from '@/types'
import type { LiffConversation } from './types'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('backgroundSync')

// Constants
const PENDING_CONVERSATION_TTL = 60000  // 60s before cleanup
const PENDING_CLEANUP_INTERVAL = 30000  // check every 30s
const BACKGROUND_SYNC_INTERVAL = 120000  // WebSocket is primary; poll as a fallback every 2 minutes
const BACKGROUND_SYNC_MIN_GAP = 10000
const BACKGROUND_SYNC_LOCK_KEY = 'mcis:conversations:background-sync-lock'
const BACKGROUND_SYNC_LOCK_TTL = BACKGROUND_SYNC_INTERVAL + 30000

export interface BackgroundSyncDeps {
  conversations: Ref<Conversation[]>
  pollConversations: () => Promise<void>
  updateStatsFromConversations: () => void
}

export function createBackgroundSync(deps: BackgroundSyncDeps) {
  const { conversations, pollConversations, updateStatsFromConversations } = deps

  // Mutable state
  let backgroundSyncInterval: ReturnType<typeof setInterval> | null = null
  let pendingConversationCleanupInterval: ReturnType<typeof setInterval> | null = null
  let isPageVisible = true
  let lastSyncStartedAt = 0
  const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const acquireBackgroundSyncLock = () => {
    if (typeof localStorage === 'undefined') {
      return true
    }

    const now = Date.now()
    try {
      const current = localStorage.getItem(BACKGROUND_SYNC_LOCK_KEY)
      const lock = current ? JSON.parse(current) as { tabId?: string; updatedAt?: number } : null
      const isExpired = !lock?.updatedAt || now - lock.updatedAt > BACKGROUND_SYNC_LOCK_TTL

      if (!lock?.tabId || lock.tabId === tabId || isExpired) {
        localStorage.setItem(BACKGROUND_SYNC_LOCK_KEY, JSON.stringify({ tabId, updatedAt: now }))
        return true
      }
    } catch (error) {
      frontendLogger.warn('[ConversationsStore] Failed to acquire background sync lock', { error })
      return true
    }

    return false
  }

  const releaseBackgroundSyncLock = () => {
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const current = localStorage.getItem(BACKGROUND_SYNC_LOCK_KEY)
      const lock = current ? JSON.parse(current) as { tabId?: string } : null
      if (lock?.tabId === tabId) {
        localStorage.removeItem(BACKGROUND_SYNC_LOCK_KEY)
      }
    } catch (error) {
      frontendLogger.warn('[ConversationsStore] Failed to release background sync lock', { error })
    }
  }

  const runBackgroundSync = async (reason: string) => {
    if (!isPageVisible) {
      frontendLogger.debug('[ConversationsStore] Page hidden, skipping background sync')
      return
    }

    const now = Date.now()
    if (now - lastSyncStartedAt < BACKGROUND_SYNC_MIN_GAP) {
      frontendLogger.debug('[ConversationsStore] Background sync skipped by min-gap', { reason })
      return
    }

    if (!acquireBackgroundSyncLock()) {
      frontendLogger.debug('[ConversationsStore] Another tab owns background sync, skipping')
      return
    }

    lastSyncStartedAt = now
    frontendLogger.debug('[ConversationsStore] Background sync triggered', { reason })
    await pollConversations()
  }

  /**
   * LIFF: Cleanup stale pending conversations (60s TTL)
   */
  const cleanupStalePendingConversations = () => {
    const now = Date.now()
    const staleIndices: number[] = []

    conversations.value.forEach((conv, index) => {
      const metadata = (conv as LiffConversation)._liffMetadata
      if (metadata?.isPending && metadata?.scannedAt) {
        if (now - metadata.scannedAt > PENDING_CONVERSATION_TTL) {
          staleIndices.push(index)
        }
      }
    })

    if (staleIndices.length > 0) {
      // Reverse removal to avoid index shifts
      staleIndices.reverse().forEach(index => {
        const removed = conversations.value[index]
        conversations.value.splice(index, 1)
        frontendLogger.debug(`[ConversationsStore] Cleaned up stale pending conversation`, {
          conversationId: removed?.id,
          lineUserId: `${(removed as LiffConversation)?._liffMetadata?.lineUserId?.substring(0, 10)}...`,
          age: `${Math.round((now - ((removed as LiffConversation)?._liffMetadata?.scannedAt || 0)) / 1000)}s`
        })
      })
      updateStatsFromConversations()
    }
  }

  /**
   * Start the fallback background sync timer.
   */
  const startBackgroundSync = () => {
    if (backgroundSyncInterval) {
      frontendLogger.debug('[ConversationsStore] Background sync already running, skipping')
      return
    }

    backgroundSyncInterval = setInterval(() => {
      void runBackgroundSync('interval')
    }, BACKGROUND_SYNC_INTERVAL)

    frontendLogger.debug('[ConversationsStore] Started background sync timer', {
      intervalMs: BACKGROUND_SYNC_INTERVAL
    })
  }

  /**
   * Stop the background sync timer
   */
  const stopBackgroundSync = () => {
    if (backgroundSyncInterval) {
      clearInterval(backgroundSyncInterval)
      backgroundSyncInterval = null
      releaseBackgroundSyncLock()
      frontendLogger.debug('[ConversationsStore] Stopped background sync timer')
    }
  }

  /**
   * Handle page visibility changes
   */
  const handleVisibilityChange = () => {
    const wasVisible = isPageVisible
    isPageVisible = document.visibilityState === 'visible'

    if (isPageVisible && !wasVisible) {
      frontendLogger.debug('[ConversationsStore] Page became visible, triggering immediate sync')
      void runBackgroundSync('visible')
    } else if (!isPageVisible && wasVisible) {
      releaseBackgroundSyncLock()
      frontendLogger.debug('[ConversationsStore] Page became hidden, pausing sync')
    }
  }

  /**
   * Trigger sync after WebSocket reconnection
   */
  const triggerReconnectionSync = async () => {
    frontendLogger.debug('[ConversationsStore] Reconnection detected, triggering immediate sync')
    await runBackgroundSync('reconnect')
  }

  /**
   * Start the pending conversation cleanup timer
   */
  const startPendingCleanup = () => {
    if (!pendingConversationCleanupInterval) {
      pendingConversationCleanupInterval = setInterval(
        cleanupStalePendingConversations,
        PENDING_CLEANUP_INTERVAL
      )
      frontendLogger.debug('[ConversationsStore] Started pending conversation cleanup timer (30s interval)')
    }
  }

  /**
   * Stop the pending conversation cleanup timer
   */
  const stopPendingCleanup = () => {
    if (pendingConversationCleanupInterval) {
      clearInterval(pendingConversationCleanupInterval)
      pendingConversationCleanupInterval = null
      frontendLogger.debug('[ConversationsStore] Stopped pending conversation cleanup timer')
    }
  }

  return {
    cleanupStalePendingConversations,
    startBackgroundSync,
    stopBackgroundSync,
    handleVisibilityChange,
    triggerReconnectionSync,
    startPendingCleanup,
    stopPendingCleanup
  }
}
