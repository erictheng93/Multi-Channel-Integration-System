// DEPRECATED: 此文件已废弃，逻辑已整合到 conversationsStore.ts
// 對話數據混合同步服務 - WebSocket + 智能輪詢備份
// Phase 3 Migration: SSE → WebSocket (2025-10-17)
// 專案名稱：Multi-Channel Support MVP
//
// 迁移说明：
// - 新实现：frontend/src/stores/conversations.ts (方案 B 阶段 2)
// - 使用方式：conversationsStore.initializeRealtime() / conversationsStore.cleanup()
// - 此文件仍然保留以支持旧组件，但建议迁移到新 API
//
/* eslint-disable no-unused-vars */

import { ref, type Ref } from 'vue'
import { conversationApi } from '@/api/conversations'
import { useAuthStore } from '@/stores/auth'
import type { Conversation } from '@/types'
import { createWebSocketClient, type WebSocketClient, type WebSocketMessage } from './websocketClient'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('conversationSync')

// 同步狀態類型
type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'

// 混合同步配置
interface SyncConfig {
  pollbackupInterval: number;  // 備份輪詢間隔
  heartbeatTimeout: number; // 心跳超時
  reconnectDelay: number; // 重連延遲
  maxReconnectAttempts: number; // 最大重連次數
}

// 默認配置
const DEFAULT_CONFIG: SyncConfig = {
  pollbackupInterval: 300000, // 5分鐘備份輪詢（減少頻率）
  heartbeatTimeout: 30000, // 30秒心跳超時（配合15秒心跳間隔）
  reconnectDelay: 5000, // 5秒重連延遲
  maxReconnectAttempts: 3 // 最多重連3次
}

export class ConversationSyncService {
  // WebSocket 客戶端
  private wsClient: WebSocketClient | null = null
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null

  // 輪詢備份
  private pollbackupTimer: NodeJS.Timeout | null = null
  private lastWSUpdate = 0

  // 狀態管理
  private config: SyncConfig
  public status: Ref<SyncStatus> = ref('disconnected')
  public lastUpdate: Ref<Date | null> = ref(null)
  public errorMessage: Ref<string | null> = ref(null)

  // 回調函數
  private onDataUpdate: ((conversations: Conversation[]) => void) | null = null
  private onStatusChange: ((status: SyncStatus) => void) | null = null

  // Store visibility listener reference for cleanup
  private visibilityChangeHandler: (() => void) | null = null

  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.setupVisibilityListener()
  }

  // 設置數據更新回調
  onData(callback: (conversations: Conversation[]) => void) {
    this.onDataUpdate = callback
  }

  // 設置狀態變化回調
  onStatus(callback: (status: SyncStatus) => void) {
    this.onStatusChange = callback
  }

  // 開始同步
  async start() {
    frontendLogger.debug('[Sync Service] Starting WebSocket-based hybrid sync...')

    // 清理現有連接
    this.stop()

    // 設置狀態
    this.setStatus('connecting')

    // 嘗試 WebSocket 連接
    this.startWebSocket()

    // 開始備份輪詢
    this.startPollbackup()
  }

  // 停止同步
  stop() {
    frontendLogger.debug('[Sync Service] Stopping sync service...')

    this.closeWebSocket()
    this.stopPollbackup()
    this.stopReconnect()
    this.removeVisibilityListener()

    this.setStatus('disconnected')
    this.errorMessage.value = null
  }

  // Remove visibility listener to prevent memory leaks
  private removeVisibilityListener() {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler)
      this.visibilityChangeHandler = null
    }
  }

  // 手動刷新
  async refresh() {
    frontendLogger.debug('[Sync Service] Manual refresh requested')
    return this.pollConversations()
  }

  // 啟動 WebSocket 連接
  private startWebSocket() {
    const authStore = useAuthStore()
    if (!authStore.token) {
      console.warn('[Sync Service] No auth token, falling back to polling')
      this.setStatus('polling')
      return
    }

    try {
      frontendLogger.debug('[Sync Service] Initializing WebSocket connection...')

      // 創建 WebSocket 客戶端（用於 conversations 列表同步）
      this.wsClient = createWebSocketClient({
        enableLogging: true,
        reconnect: true,
        reconnectInterval: this.config.reconnectDelay,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        heartbeatInterval: 30000,
        heartbeatTimeout: this.config.heartbeatTimeout,
        // 不指定 conversationId，用於全局 conversations 更新
        deviceId: 'web-sync-service',
        clientVersion: '1.0.0'
      })

      // 設置事件處理器
      this.wsClient.setEventHandlers({
        onMessage: (message) => {
          this.handleWebSocketMessage(message)
        },
        onConnectionChange: (state) => {
          switch (state) {
            case 'connected':
              frontendLogger.debug('[Sync Service] WebSocket connected')
              this.setStatus('connected')
              this.reconnectAttempts = 0
              this.errorMessage.value = null
              break
            case 'connecting':
            case 'reconnecting':
              this.setStatus('connecting')
              break
            case 'disconnected':
            case 'closed':
              this.setStatus('disconnected')
              break
            case 'error':
              this.handleWebSocketError()
              break
          }
        },
        onError: (error) => {
          console.error('[Sync Service] WebSocket error:', error)
          this.errorMessage.value = error.message
        },
        onHeartbeat: () => {
          // 心跳收到，保持連接活躍
          this.lastWSUpdate = Date.now()
        }
      })

      // 連接到 WebSocket
      this.wsClient.connect()
        .catch((error) => {
          console.error('[Sync Service] WebSocket connection failed:', error)
          this.handleWebSocketError()
        })

    } catch (error) {
      console.error('[Sync Service] Failed to initialize WebSocket:', error)
      this.handleWebSocketError()
    }
  }

  // 處理 WebSocket 消息
  private handleWebSocketMessage(message: WebSocketMessage) {
    frontendLogger.debug('[Sync Service] WebSocket message:', message.type)

    switch (message.type) {
      case 'heartbeat':
      case 'pong':
        // 心跳已由 client 處理
        break

      case 'conversations_update':
      case 'conversation_updated':
      case 'new_message':
      case 'message_updated':
        // 對話列表更新
        this.lastWSUpdate = Date.now()
        this.lastUpdate.value = new Date()

        // 觸發輪詢以獲取最新數據
        // WebSocket 只發送通知，實際數據通過 API 獲取
        this.pollConversations()
        break

      case 'connection_ack':
        frontendLogger.debug('[Sync Service] Connection acknowledged')
        // 訂閱全局 conversations 更新
        if (this.wsClient) {
          this.wsClient.send({
            type: 'subscribe_conversations',
            timestamp: Date.now()
          })
        }
        break

      default:
        console.warn('[Sync Service] Unknown WebSocket message type:', message.type)
    }
  }

  // 處理 WebSocket 錯誤
  private handleWebSocketError() {
    this.closeWebSocket()

    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++
      frontendLogger.debug(`[Sync Service] Reconnecting WebSocket (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`)

      this.setStatus('connecting')
      this.reconnectTimer = setTimeout(() => {
        this.startWebSocket()
      }, this.config.reconnectDelay * this.reconnectAttempts)

    } else {
      console.warn('[Sync Service] Max reconnect attempts reached, falling back to polling')
      this.setStatus('polling')
      this.errorMessage.value = 'WebSocket 連接失敗，使用輪詢模式'
    }
  }

  // 關閉 WebSocket 連接
  private closeWebSocket() {
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }
  }

  // 開始備份輪詢
  private startPollbackup() {
    this.pollbackupTimer = setInterval(() => {
      // 只有當 WebSocket 長時間沒有更新時才執行輪詢
      const timeSinceWSUpdate = Date.now() - this.lastWSUpdate
      const shouldPoll = this.status.value === 'polling' ||
                        timeSinceWSUpdate > this.config.pollbackupInterval

      // 添加頁面檢測：支持所有頁面的備份輪詢，但頻率不同
      const currentPath = window.location.pathname
      const isConversationListPage = currentPath === '/conversations' || currentPath === '/'
      const isConversationDetailPage = currentPath.startsWith('/conversations/')

      if (shouldPoll && isConversationListPage && !isConversationDetailPage) {
        frontendLogger.debug('[Sync Service] Backup polling triggered for conversation list')
        this.pollConversations()
      } else if (shouldPoll && isConversationDetailPage) {
        // 對話詳情頁面也提供備份輪詢，但頻率較低避免與頁面內 WebSocket 衝突
        frontendLogger.debug('[Sync Service] Backup polling triggered for conversation detail page')
        this.pollConversations()
      }
    }, this.config.pollbackupInterval)
  }

  // 停止備份輪詢
  private stopPollbackup() {
    if (this.pollbackupTimer) {
      clearInterval(this.pollbackupTimer)
      this.pollbackupTimer = null
    }
  }

  // 輪詢對話數據
  private async pollConversations() {
    try {
      const response = await conversationApi.list({
        page: 1,
        pageSize: 50
      })

      if (response.success && response.data && this.onDataUpdate) {
        this.onDataUpdate(response.data.items || [])
        this.lastUpdate.value = new Date()

        // 如果輪詢成功且 WebSocket 斷開，嘗試重新連接
        if (this.status.value === 'polling' && this.reconnectAttempts === 0) {
          frontendLogger.debug('[Sync Service] Attempting to restore WebSocket connection...')
          this.startWebSocket()
        }
      }

    } catch (error) {
      console.error('[Sync Service] Polling failed:', error)
      this.errorMessage.value = '數據同步失敗'
    }
  }

  // 停止重連定時器
  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // 設置狀態
  private setStatus(status: SyncStatus) {
    if (this.status.value !== status) {
      this.status.value = status
      if (this.onStatusChange) {
        this.onStatusChange(status)
      }
      frontendLogger.debug(`[Sync Service] Status: ${status}`)
    }
  }

  // 監聽頁面可見性
  private setupVisibilityListener() {
    // Remove existing listener first to prevent duplicates
    this.removeVisibilityListener()

    // Create and store the handler for later cleanup
    this.visibilityChangeHandler = () => {
      if (document.hidden) {
        frontendLogger.debug('[Sync Service] Page hidden, maintaining connection')
      } else {
        frontendLogger.debug('[Sync Service] Page visible, refreshing data')
        this.refresh()
      }
    }

    document.addEventListener('visibilitychange', this.visibilityChangeHandler)
  }
}

// 創建單例實例
export const conversationSync = new ConversationSyncService()
