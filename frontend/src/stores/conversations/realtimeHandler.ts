import type { Ref } from 'vue'
import type { Conversation, ConversationFilters } from '@/types'
import type { WebSocketMessage } from '@/services/websocketClient'
import type { ConversationStatus } from '@/constants/conversation-status'
import { conversationApi } from '@/api/conversations'
import { conversationCache } from '@/services/cacheManager'
import { normalizeTeamId } from '@/utils/type-normalization'
import { useAuthStore } from '../auth'
import { computeStatsFromConversations } from './helpers'
import type { LiffConversation, ConversationStats, TransferredConversationState } from './types'
import type { Platform } from '@/types'
import { nowISO } from '@/utils/timestamp'

export interface RealtimeHandlerDeps {
  conversations: Ref<Conversation[]>
  currentConversation: Ref<Conversation | null>
  transferredConversation: Ref<TransferredConversationState | null>
  stats: Ref<ConversationStats>
  lastUpdateTime: Ref<Date | null>
  activeFilters: Ref<ConversationFilters>
  error: Ref<string | null>

  // Store helper functions
  updateConversationFromWebSocketMessage: (
    _conversationId: string,
    _messageData: {
      content?: string
      messageType?: string
      timestamp?: string | number
      sender?: { id?: string; name?: string; role?: string }
      senderType?: 'customer' | 'agent'
      platform?: string
    },
    _options?: { incrementUnread?: boolean; moveToTop?: boolean }
  ) => boolean
  updateConversationStatus: (
    _conversationId: string,
    _updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'unreadCount' | 'assignedTeam'>>
  ) => boolean
  updateConversationsIncrementally: (_newConversations: Conversation[], _logChanges?: boolean) => void
  updateStatsFromConversations: () => void
}

// Delay before follow-up poll to reconcile pending conversations
const PENDING_RECONCILIATION_DELAY = 5000

export function createRealtimeHandler(deps: RealtimeHandlerDeps) {
  const {
    conversations,
    currentConversation,
    transferredConversation,
    stats,
    lastUpdateTime,
    activeFilters,
    error,
    updateConversationFromWebSocketMessage,
    updateConversationStatus,
    updateConversationsIncrementally,
    updateStatsFromConversations
  } = deps

  // Pending reconciliation timer (debounced)
  let pendingReconciliationTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Schedule a follow-up API poll to reconcile pending conversations.
   * Debounced: multiple calls within the delay window result in a single poll.
   *
   * Why this works: pollConversations() → updateConversationsIncrementally()
   * replaces the entire conversation list with API data. Since pending conversations
   * don't exist in the DB, they are naturally removed during the list replacement.
   */
  const schedulePendingReconciliation = () => {
    if (pendingReconciliationTimer) {
      clearTimeout(pendingReconciliationTimer)
    }
    pendingReconciliationTimer = setTimeout(async () => {
      pendingReconciliationTimer = null
      const hasPending = conversations.value.some(c =>
        (c as LiffConversation)._liffMetadata?.isPending
      )
      if (hasPending) {
        console.log('[ConversationsStore] Pending reconciliation: triggering follow-up poll (5s)')
        await pollConversations()
      }
    }, PENDING_RECONCILIATION_DELAY)
    console.log('[ConversationsStore] Scheduled pending reconciliation in 5s')
  }

  /**
   * 轮询对话数据（HTTP 备份机制）
   */
  const pollConversations = async () => {
    try {
      // Build query params respecting activeFilters so polling doesn't overwrite filtered views
      const cleanFilters: Record<string, unknown> = {}
      if (activeFilters.value.status) { cleanFilters.status = activeFilters.value.status }
      if (activeFilters.value.platform) { cleanFilters.platform = activeFilters.value.platform }
      if (activeFilters.value.teamId) { cleanFilters.teamId = activeFilters.value.teamId }

      const response = await conversationApi.list({
        page: 1,
        pageSize: 50,
        ...cleanFilters
      })

      if (response.success && response.data) {
        const conversationList = Array.isArray(response.data)
          ? response.data
          : response.data.items || []

        // 使用智能增量更新
        updateConversationsIncrementally(conversationList, true)
        lastUpdateTime.value = new Date()

        // 更新统计信息
        stats.value = computeStatsFromConversations(conversationList)
      }

    } catch (err) {
      console.error('[ConversationsStore] Polling failed:', err)
      error.value = '数据同步失败'
    }
  }

  /**
   * 處理實時更新事件（Phase B4 - 直接更新）
   * 從全局 WebSocket Store 接收事件並直接更新本地狀態
   * 避免不必要的 HTTP 輪詢
   */
  const handleRealtimeUpdate = (message: WebSocketMessage) => {
    console.log('[ConversationsStore] Real-time update:', message.type, message)

    // 提取通用數據
    const data = message.data as Record<string, unknown> | undefined
    const conversationId = message.conversationId || (data?.conversationId as string)

    switch (message.type) {
      case 'new_message':
      case 'message_sent':
      case 'message_delivered': {
        // Phase B4: 直接更新對話列表，無需 HTTP 輪詢
        if (conversationId) {
          const messageContent = data?.content as string
          const messageType = data?.messageType as string
          const timestamp = message.timestamp || data?.timestamp as string | number
          const sender = data?.sender as { id?: string; name?: string; role?: string } | undefined
          const senderType = data?.senderType as 'customer' | 'agent' | undefined
          const platform = data?.platform as string | undefined

          const updated = updateConversationFromWebSocketMessage(
            conversationId,
            {
              content: messageContent,
              messageType,
              timestamp,
              sender,
              senderType,
              platform
            },
            {
              // 只有客戶發送的訊息才增加未讀計數
              incrementUnread: senderType === 'customer',
              moveToTop: true
            }
          )

          if (updated) {
            lastUpdateTime.value = new Date()
            console.log(`[ConversationsStore] Direct update for new_message in ${conversationId}`)
          }
        } else {
          // 沒有 conversationId，回退到輪詢
          console.log('[ConversationsStore] No conversationId in message, falling back to polling')
          lastUpdateTime.value = new Date()
          pollConversations()
        }
        break
      }

      case 'conversation_updated':
      case 'conversation_status_changed':
      case 'conversation_assigned': {
        // 對話狀態更新（一般指派/更新）
        // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
        if (conversationId) {
          const status = data?.status as string | undefined
          const assignedTeamId = data?.assignedTeamId as number | undefined
          const assignedTeamName = data?.assignedTeamName as string | undefined

          const updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'assignedTeam'>> = {}
          if (status) { updates.status = status as Conversation['status'] }
          if (assignedTeamId !== undefined) {
            updates.assignedTeamId = assignedTeamId
            if (assignedTeamId) {
              updates.assignedTeam = {
                id: assignedTeamId,
                name: assignedTeamName || `Team ${assignedTeamId}`,
                description: null
              }
            } else {
              updates.assignedTeam = undefined
            }
          }

          if (Object.keys(updates).length > 0) {
            updateConversationStatus(conversationId, updates)
            lastUpdateTime.value = new Date()
            console.log(`[ConversationsStore] Direct status update for ${conversationId}`, { assignedTeamName })
          } else {
            pollConversations()
          }
        } else {
          pollConversations()
        }
        break
      }

      case 'conversation_unassigned': {
        // 對話取消指派 - 清除團隊指派
        // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
        if (conversationId) {
          const previousTeamId = data?.previousTeamId as number | undefined
          const previousTeamName = data?.previousTeamName as string | undefined

          console.log('[ConversationsStore] Conversation unassigned', {
            conversationId,
            previousTeamId,
            previousTeamName
          })

          // 更新對話狀態：清除團隊指派信息
          updateConversationStatus(conversationId, {
            status: 'active',
            assignedTeamId: undefined,
            assignedTeam: undefined
          })

          lastUpdateTime.value = new Date()
          console.log(`[ConversationsStore] Cleared team assignment for ${conversationId}`)
        } else {
          pollConversations()
        }
        break
      }

      case 'conversation_transferred': {
        // 對話轉移 - 處理跨團隊轉移的三種動作
        const action = data?.action as 'removed' | 'assigned' | 'team_changed' | undefined

        console.log('[ConversationsStore] Conversation transferred event', {
          conversationId,
          action,
          data
        })

        // DEBUG: 詳細記錄完整的 data 對象
        console.log('[DEBUG] Full event data:', JSON.stringify(data, null, 2))

        if (action === 'removed') {
          // 從當前團隊移除：對話被轉移到其他團隊
          // 安全檢查：只有當用戶屬於原團隊時才處理移除事件
          // FIX: Normalize at boundary - WebSocket JSON may send string IDs
          const fromTeamId = normalizeTeamId(data?.fromTeamId)
          const toTeamId = normalizeTeamId(data?.toTeamId)
          const authStore = useAuthStore()
          const userTeamIds = authStore.allowedTeamIds || []
          const isAdmin = authStore.currentAgent?.role === 'admin'

          // FIX: 檢查用戶是否也屬於目標團隊
          const userBelongsToTargetTeam = toTeamId !== undefined && userTeamIds.includes(toTeamId)

          if (userBelongsToTargetTeam && !isAdmin) {
            console.log(`[ConversationsStore] Ignoring removed event - user belongs to target team`, {
              conversationId,
              fromTeamId,
              toTeamId,
              userTeamIds
            })
            break // 忽略此事件，對話會通過 assigned 事件更新
          }

          // 檢查用戶是否屬於原團隊（管理員可以看到所有團隊的事件）
          const shouldProcessRemoval = isAdmin ||
            (fromTeamId !== undefined && userTeamIds.includes(fromTeamId))

          if (!shouldProcessRemoval) {
            console.log(`[ConversationsStore] Ignoring removed event - user not in source team`, {
              conversationId,
              fromTeamId,
              userTeamIds,
              isAdmin
            })
            break // 忽略此事件
          }

          // 從列表中移除該對話
          if (conversationId) {
            const index = conversations.value.findIndex(c => c.id === conversationId)
            if (index !== -1) {
              const removedConv = conversations.value[index]
              const previousTeamId = removedConv?.assignedTeamId
              conversations.value.splice(index, 1)
              conversationCache.invalidateConversation(conversationId)
              updateStatsFromConversations()
              lastUpdateTime.value = new Date()
              console.log(`[ConversationsStore] Conversation removed from list (transferred to another team)`, {
                conversationId,
                toTeamId: data?.toTeamId,
                toTeamName: data?.toTeamName,
                previousTeamId
              })
            }

            // FIX: 如果是當前查看的對話，設置 transferred 狀態給詳情頁顯示
            if (currentConversation.value?.id === conversationId) {
              const toTeamName = (data?.toTeamName as string) || '其他團隊'
              transferredConversation.value = {
                conversationId,
                toTeamName,
                transferredAt: nowISO()
              }
              console.log(`[ConversationsStore] Also updated currentConversation for ${conversationId} - marked as transferred`, {
                toTeamName,
                transferredAt: transferredConversation.value.transferredAt
              })
            }
          }
        } else if (action === 'assigned') {
          // 新團隊接收：對話被轉移到當前團隊
          // 安全檢查：只有當用戶屬於目標團隊時才處理指派事件
          // FIX: Normalize at boundary - WebSocket JSON may send string IDs
          const toTeamId = normalizeTeamId(data?.toTeamId)
          const authStore = useAuthStore()
          const userTeamIds = authStore.allowedTeamIds || []
          const isAdmin = authStore.currentAgent?.role === 'admin'

          // 檢查用戶是否屬於目標團隊（管理員可以看到所有團隊的事件）
          const shouldProcessAssignment = isAdmin ||
            (toTeamId !== undefined && userTeamIds.includes(toTeamId))

          if (!shouldProcessAssignment) {
            console.log(`[ConversationsStore] Ignoring assigned event - user not in target team`, {
              conversationId,
              toTeamId,
              userTeamIds,
              isAdmin
            })
            break // 忽略此事件
          }

          // 將對話添加到列表頂部
          const incomingConversation = data?.conversation as Record<string, unknown> | undefined
          if (conversationId && incomingConversation) {
            // LIFF 預通知：檢查傳入數據是否有 LIFF metadata
            const liffMetadata = incomingConversation?._liffMetadata as {
              isPending?: boolean
              lineUserId?: string
              assignmentId?: string
              scannedAt?: number
            } | undefined

            // LIFF Reconciliation：用 lineUserId 檢查是否有對應的 pending 對話
            const existingPendingIndex = liffMetadata?.lineUserId
              ? conversations.value.findIndex(c =>
                  (c as LiffConversation)._liffMetadata?.lineUserId === liffMetadata.lineUserId
                )
              : -1

            // 如果收到的是真實對話（非 pending-），需要替換現有的 pending 對話
            if (existingPendingIndex !== -1 && !conversationId.startsWith('pending-')) {
              // Reconciliation: 移除 pending，準備添加真實對話
              const removedPending = conversations.value[existingPendingIndex]
              conversations.value.splice(existingPendingIndex, 1)
              console.log(`[ConversationsStore] Reconciled pending → real conversation`, {
                pendingId: removedPending?.id,
                realConversationId: conversationId,
                lineUserId: `${liffMetadata?.lineUserId?.substring(0, 10)  }...`
              })
            }

            // 檢查是否已存在（避免重複添加）
            const existingIndex = conversations.value.findIndex(c => c.id === conversationId)
            if (existingIndex === -1) {
              // 如果是 pending 對話，檢查是否已有相同 lineUserId 的 pending（避免重複掃碼）
              if (liffMetadata?.isPending && liffMetadata?.lineUserId) {
                const duplicatePendingIndex = conversations.value.findIndex(c =>
                  (c as LiffConversation)._liffMetadata?.lineUserId === liffMetadata.lineUserId &&
                  (c as LiffConversation)._liffMetadata?.isPending === true
                )
                if (duplicatePendingIndex !== -1) {
                  console.log(`[ConversationsStore] Ignoring duplicate pending conversation`, {
                    conversationId,
                    lineUserId: `${liffMetadata.lineUserId.substring(0, 10)  }...`
                  })
                  break // 忽略重複的 pending 對話
                }
              }

              // 從傳入數據提取信息
              const customerName = (incomingConversation.customerName as string) || '未知客戶'
              const platform = (incomingConversation.platform as string) || 'line'
              const status = (incomingConversation.status as string) || 'active'
              const customerId = String(incomingConversation.customerId || conversationId)

              // 構建完整的 Conversation 對象
              // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
              // FIX: Use already-normalized toTeamId from boundary
              const newConversation: Conversation = {
                id: conversationId,
                userId: customerId,
                platform: platform as Platform,
                status: status as ConversationStatus,
                assignedTeamId: toTeamId,
                assignedTeam: toTeamId ? {
                  id: toTeamId,
                  name: (data?.toTeamName as string) || `Team ${toTeamId}`,
                  description: null
                } : undefined,
                customer: {
                  id: customerId,
                  name: customerName,
                  platform: platform as Platform,
                  platformUserId: customerId,
                  createdAt: Date.now()
                },
                lastMessage: incomingConversation.lastMessage as Conversation['lastMessage'],
                lastMessageAt: (incomingConversation.lastMessageAt as number) || Date.now(),
                unreadCount: (incomingConversation.unreadCount as number) || 0,
                createdAt: (incomingConversation.createdAt as number) || Date.now(),
                updatedAt: Date.now(),
                // 保留 LIFF metadata 用於 UI 顯示和 Reconciliation
                ...(liffMetadata && { _liffMetadata: liffMetadata } as Partial<LiffConversation>)
              }

              // 添加到列表頂部
              conversations.value.unshift(newConversation)
              conversationCache.setConversation(newConversation)
              updateStatsFromConversations()
              lastUpdateTime.value = new Date()

              // Log 區分 pending 和真實對話
              if (liffMetadata?.isPending) {
                console.log(`[ConversationsStore] Pending conversation added (LIFF pre-notification)`, {
                  conversationId,
                  teamId: data?.toTeamId,
                  customerName,
                  lineUserId: `${liffMetadata.lineUserId?.substring(0, 10)  }...`
                })
                // Schedule a follow-up API poll to reconcile this pending conversation.
                // updateConversationsIncrementally replaces the list with API data,
                // naturally removing pending conversations that don't exist in the DB.
                schedulePendingReconciliation()
              }

              // FIX: 同步更新 currentConversation（如果用戶正在查看這個對話）
              if (currentConversation.value && currentConversation.value.id === conversationId) {
                currentConversation.value = newConversation
                console.log(`[ConversationsStore] Also updated currentConversation from assigned event`, {
                  conversationId,
                  newTeamId: data?.toTeamId,
                  newTeamName: data?.toTeamName
                })
              }

              console.log(`[ConversationsStore] Conversation added to list (transferred from another team)`, {
                conversationId,
                fromTeamId: data?.fromTeamId,
                fromTeamName: data?.fromTeamName,
                newTeamId: data?.toTeamId
              })
            } else {
              // 已存在，更新團隊資訊
              // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
              // FIX: Use already-normalized toTeamId from boundary
              updateConversationStatus(conversationId, {
                assignedTeamId: toTeamId,
                assignedTeam: toTeamId ? {
                  id: toTeamId,
                  name: (data?.toTeamName as string) || `Team ${toTeamId}`,
                  description: null
                } : undefined
              })

              lastUpdateTime.value = new Date()
              console.log(`[ConversationsStore] Conversation already exists, updated team info`, {
                conversationId
              })
            }
          } else {
            // 沒有完整數據，回退到輪詢
            console.log('[ConversationsStore] No conversation data in assigned event, polling')
            pollConversations()
          }
        } else if (action === 'team_changed') {
          // 團隊變更通知：對話房間內的用戶收到
          // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
          // FIX: Normalize at boundary - WebSocket JSON may send string IDs
          if (conversationId) {
            const toTeamId = normalizeTeamId(data?.toTeamId)
            const toTeamName = (data?.toTeamName || data?.assignedTeamName) as string | undefined
            const newTeam = data?.newTeam as { id: unknown; name: string } | undefined
            const newTeamId = normalizeTeamId(newTeam?.id)
            const effectiveTeamId = toTeamId ?? newTeamId

            updateConversationStatus(conversationId, {
              assignedTeamId: effectiveTeamId,
              assignedTeam: effectiveTeamId ? {
                id: effectiveTeamId,
                name: toTeamName || newTeam?.name || `Team ${effectiveTeamId}`,
                description: null
              } : undefined
            })
            lastUpdateTime.value = new Date()
            console.log(`[ConversationsStore] Conversation team changed in chat window`, {
              conversationId,
              newTeamId: effectiveTeamId,
              newTeamName: toTeamName || newTeam?.name
            })
          }
        } else {
          // 沒有 action 字段（舊格式），回退到原有邏輯
          // Note: Individual assignment (assignedAgentId) removed - only team assignment is supported now
          // FIX: Normalize at boundary - WebSocket JSON may send string IDs
          if (conversationId) {
            const status = data?.status as string | undefined
            const assignedTeamId = normalizeTeamId(data?.assignedTeamId)
            const assignedTeamName = data?.assignedTeamName as string | undefined

            const updates: Partial<Pick<Conversation, 'status' | 'assignedTeamId' | 'assignedTeam'>> = {}
            if (status) { updates.status = status as Conversation['status'] }
            if (assignedTeamId !== undefined) {
              updates.assignedTeamId = assignedTeamId
              if (assignedTeamId) {
                updates.assignedTeam = {
                  id: assignedTeamId,
                  name: assignedTeamName || `Team ${assignedTeamId}`,
                  description: null
                }
              } else {
                updates.assignedTeam = undefined
              }
            }

            if (Object.keys(updates).length > 0) {
              updateConversationStatus(conversationId, updates)
              lastUpdateTime.value = new Date()
              console.log(`[ConversationsStore] Legacy transfer update for ${conversationId}`)
            } else {
              pollConversations()
            }
          } else {
            pollConversations()
          }
        }
        break
      }

      case 'conversations_update': {
        // 批量更新，使用輪詢獲取完整數據
        console.log('[ConversationsStore] Batch update, using polling')
        lastUpdateTime.value = new Date()
        pollConversations()
        break
      }

      case 'message_updated':
      case 'message_deleted': {
        // 訊息更新/刪除，觸發輪詢以同步最新狀態
        lastUpdateTime.value = new Date()
        pollConversations()
        break
      }

      default:
        console.warn('[ConversationsStore] Unhandled message type:', message.type)
    }
  }

  return { handleRealtimeUpdate, pollConversations }
}
