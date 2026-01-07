/**
 * ⚠️ DEPRECATED: 此 Composable 已废弃
 *
 * Conversation Sync Composable
 *
 * 负责管理对话列表的混合同步机制（SSE → WebSocket → Polling）
 *
 * @deprecated 请使用 conversationsStore.initializeRealtime() 替代
 * @see frontend/src/stores/conversations.ts (方案 B 阶段 2)
 *
 * @module composables/conversation/useConversationSync
 *
 * @example 旧用法（已废弃）:
 * ```ts
 * const { syncStatus, isConnected, lastUpdate, startSync, stopSync } = useConversationSync()
 * await startSync()
 * stopSync()
 * ```
 *
 * @example 新用法（推荐）:
 * ```ts
 * import { useConversationsStore } from '@/stores/conversations'
 *
 * const store = useConversationsStore()
 *
 * // 在 onMounted 中
 * store.initializeRealtime()
 *
 * // 在 onUnmounted 中
 * store.cleanup()
 *
 * // 访问状态
 * console.log(store.syncStatus) // 'connected' | 'disconnected' | 'connecting' | 'polling' | 'error'
 * ```
 */

import { ref, computed, type Ref } from 'vue'
import { conversationSync } from '@/services/conversationSync'
import type { Conversation } from '@/types'

/**
 * 同步状态类型
 */
export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'

export interface ConversationSyncComposable {
  /** 同步状态 */
  syncStatus: Ref<SyncStatus>
  /** 是否已连接 */
  isConnected: Ref<boolean>
  /** 是否正在同步 */
  isSyncing: Ref<boolean>
  /** 最后更新时间 */
  lastUpdate: Ref<Date | null>
  /** 同步错误信息 */
  syncError: Ref<string | null>
  /** 启动同步服务 */
  startSync: (onData?: (data: Conversation[]) => void) => Promise<void>
  /** 停止同步服务 */
  stopSync: () => void
  /** 手动刷新 */
  refresh: () => Promise<void>
  /** 设置数据回调 */
  onDataUpdate: (callback: (data: Conversation[]) => void) => void
  /** 设置状态回调 */
  onStatusChange: (callback: (status: SyncStatus) => void) => void
}

/**
 * 使用对话同步功能
 *
 * @returns {ConversationSyncComposable} 同步相关的状态和方法
 */
export function useConversationSync(): ConversationSyncComposable {
  // 状态
  const syncStatus = ref<SyncStatus>('disconnected')
  const isSyncing = ref(false)
  const lastUpdate = ref<Date | null>(null)
  const syncError = ref<string | null>(null)

  // 计算属性：是否已连接
  const isConnected = computed(() => {
    return syncStatus.value === 'connected' || syncStatus.value === 'polling'
  })

  /**
   * 启动同步服务
   *
   * @param {Function} onData - 数据更新回调（可选）
   * @async
   *
   * @example
   * await startSync((conversations) => {
   *   console.log('Received conversations:', conversations.length)
   * })
   */
  async function startSync(onData?: (data: Conversation[]) => void): Promise<void> {
    console.log('🔄 [ConversationSync] Starting sync service')
    isSyncing.value = true
    syncStatus.value = 'connecting'
    syncError.value = null

    try {
      // 设置数据回调
      if (onData) {
        conversationSync.onData((data: Conversation[]) => {
          console.log('📥 [ConversationSync] Received data:', data.length)
          lastUpdate.value = new Date()
          onData(data)
        })
      }

      // 设置状态回调
      conversationSync.onStatus((status: SyncStatus) => {
        console.log('📊 [ConversationSync] Status changed:', status)
        syncStatus.value = status

        // 更新同步状态
        if (status === 'connecting') {
          isSyncing.value = true
        } else if (status === 'connected' || status === 'polling') {
          isSyncing.value = false
        } else if (status === 'error') {
          isSyncing.value = false
          syncError.value = '同步服务连接失败'
        } else if (status === 'disconnected') {
          isSyncing.value = false
        }
      })

      // 启动同步服务
      await conversationSync.start()

      console.log('✅ [ConversationSync] Sync service started')
    } catch (error) {
      console.error('[ConversationSync] Failed to start sync:', error)
      syncStatus.value = 'error'
      syncError.value = error instanceof Error ? error.message : '同步服务启动失败'
      isSyncing.value = false
      throw error
    }
  }

  /**
   * 停止同步服务
   *
   * @example
   * stopSync()
   */
  function stopSync(): void {
    console.log('🛑 [ConversationSync] Stopping sync service')
    conversationSync.stop()
    syncStatus.value = 'disconnected'
    isSyncing.value = false
    lastUpdate.value = null
  }

  /**
   * 手动刷新数据
   *
   * @async
   *
   * @example
   * await refresh()
   */
  async function refresh(): Promise<void> {
    console.log('🔄 [ConversationSync] Manual refresh triggered')
    isSyncing.value = true

    try {
      await conversationSync.refresh()
      lastUpdate.value = new Date()
      syncError.value = null
    } catch (error) {
      console.error('[ConversationSync] Refresh failed:', error)
      syncError.value = error instanceof Error ? error.message : '刷新失败'
      throw error
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * 设置数据更新回调
   *
   * @param {Function} callback - 数据更新时的回调函数
   *
   * @example
   * onDataUpdate((conversations) => {
   *   console.log('Updated:', conversations.length)
   * })
   */
  function onDataUpdate(callback: (data: Conversation[]) => void): void {
    conversationSync.onData(callback)
  }

  /**
   * 设置状态变化回调
   *
   * @param {Function} callback - 状态变化时的回调函数
   *
   * @example
   * onStatusChange((status) => {
   *   console.log('Status:', status)
   * })
   */
  function onStatusChange(callback: (status: SyncStatus) => void): void {
    conversationSync.onStatus(callback)
  }

  return {
    syncStatus,
    isConnected,
    isSyncing,
    lastUpdate,
    syncError,
    startSync,
    stopSync,
    refresh,
    onDataUpdate,
    onStatusChange
  }
}
