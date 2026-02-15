import type { Ref } from 'vue'
import type { Conversation } from '@/types'
import type { LiffConversation } from './types'

// Constants
const PENDING_CONVERSATION_TTL = 60000  // 60s before cleanup
const PENDING_CLEANUP_INTERVAL = 30000  // check every 30s
const BACKGROUND_SYNC_INTERVAL = 30000  // sync every 30s

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

  /**
   * 🆕 LIFF: Cleanup stale pending conversations (60s TTL)
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
        console.log(`🧹 [ConversationsStore] Cleaned up stale pending conversation`, {
          conversationId: removed?.id,
          lineUserId: `${(removed as LiffConversation)?._liffMetadata?.lineUserId?.substring(0, 10)}...`,
          age: `${Math.round((now - ((removed as LiffConversation)?._liffMetadata?.scannedAt || 0)) / 1000)}s`
        })
      })
      updateStatsFromConversations()
    }
  }

  /**
   * Start the background sync timer (30s interval)
   */
  const startBackgroundSync = () => {
    if (backgroundSyncInterval) {
      console.log('⏰ [ConversationsStore] Background sync already running, skipping')
      return
    }

    backgroundSyncInterval = setInterval(async () => {
      if (!isPageVisible) {
        console.log('⏸️ [ConversationsStore] Page hidden, skipping background sync')
        return
      }

      console.log('🔄 [ConversationsStore] Background sync triggered (30s interval)')
      await pollConversations()
    }, BACKGROUND_SYNC_INTERVAL)

    console.log('⏰ [ConversationsStore] Started background sync timer (30s interval)')
  }

  /**
   * Stop the background sync timer
   */
  const stopBackgroundSync = () => {
    if (backgroundSyncInterval) {
      clearInterval(backgroundSyncInterval)
      backgroundSyncInterval = null
      console.log('⏰ [ConversationsStore] Stopped background sync timer')
    }
  }

  /**
   * Handle page visibility changes
   */
  const handleVisibilityChange = () => {
    const wasVisible = isPageVisible
    isPageVisible = document.visibilityState === 'visible'

    if (isPageVisible && !wasVisible) {
      console.log('👁️ [ConversationsStore] Page became visible, triggering immediate sync')
      pollConversations()
    } else if (!isPageVisible && wasVisible) {
      console.log('👁️ [ConversationsStore] Page became hidden, pausing sync')
    }
  }

  /**
   * Trigger sync after WebSocket reconnection
   */
  const triggerReconnectionSync = async () => {
    console.log('🔌 [ConversationsStore] Reconnection detected, triggering immediate sync')
    await pollConversations()
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
      console.log('🕐 [ConversationsStore] Started pending conversation cleanup timer (30s interval)')
    }
  }

  /**
   * Stop the pending conversation cleanup timer
   */
  const stopPendingCleanup = () => {
    if (pendingConversationCleanupInterval) {
      clearInterval(pendingConversationCleanupInterval)
      pendingConversationCleanupInterval = null
      console.log('🕐 [ConversationsStore] Stopped pending conversation cleanup timer')
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
