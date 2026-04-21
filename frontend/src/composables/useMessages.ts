// 現代化訊息管理 Composable with 分頁載入支持
import { ref, computed, watch } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useAuthStore } from '@/stores/auth'
import { useError } from './useError'
import { messageApi } from '@/api/message'
import type { Message, PaginatedResponse } from '@/types'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useMessages')

// Helper function to extract userId from JWT token
function getUserIdFromToken(): string | null {
  const token = localStorage.getItem('token')
  if (!token) {return null}

  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts[1]) {return null}
    const payload = JSON.parse(atob(parts[1]))
    return payload.userId || payload.id || null
  } catch {
    return null
  }
}

// 簡化消息處理工具函數 - 只分為最舊和最新兩種
const messageOrderUtils = {
  // 確保消息按時間順序排列（最舊在前，最新在後）
  ensureChronologicalOrder: (messages: Message[]): Message[] => {
    return [...messages].sort((a: Message, b: Message) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  },
  
  // 合併歷史消息（新載入的歷史消息放在前面）
  mergeHistoryMessages: (existingMessages: Message[], newHistoryMessages: Message[]): Message[] => {
    // 確保兩個數組都是按時間排序的
    const sortedExisting = messageOrderUtils.ensureChronologicalOrder(existingMessages)
    const sortedHistory = messageOrderUtils.ensureChronologicalOrder(newHistoryMessages)
    
    // 合併並重新排序（歷史消息應該更舊，放在前面）
    return messageOrderUtils.ensureChronologicalOrder([...sortedHistory, ...sortedExisting])
  },
  
  // 獲取最舊消息
  getOldestMessage: (messages: Message[]): Message | null => {
    if (messages.length === 0) {return null}
    return messages.reduce((oldest, current) => 
      new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
    )
  },
  
  // 獲取最新消息  
  getLatestMessage: (messages: Message[]): Message | null => {
    if (messages.length === 0) {return null}
    return messages.reduce((latest, current) => 
      new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
    )
  }
}

export function useMessages(conversationId?: string, options?: {
  enablePagination?: boolean
  pageSize?: number
}) {
  const messagesStore = useMessagesStore()
  const authStore = useAuthStore()
  const { error, handleError, clearError } = useError()

  // 配置
  const enablePagination = options?.enablePagination ?? false
  const pageSize = options?.pageSize ?? 30
  
  // 狀態
  const currentConversationId = ref(conversationId)
  const isTyping = ref(false)
  const typingTimeout = ref<NodeJS.Timeout | null>(null)
  
  // 分頁狀態
  const currentPage = ref(1)
  const hasMore = ref(true)
  const loadingHistory = ref(false)
  const paginatedMessages = ref<Message[]>([])
  const totalMessages = ref(0)

  // 根據是否啟用分頁返回不同的數據源
  const messages = computed(() => {
    if (!currentConversationId.value) {return []}
    
    if (enablePagination) {
      return paginatedMessages.value
    }
    
    return messagesStore.messagesByConversation(currentConversationId.value)
  })
  
  const loading = computed(() => 
    enablePagination ? loadingHistory.value : messagesStore.loading
  )

  // 分頁載入最新消息
  const fetchMessagesPaginated = async (page = 1, append = false) => {
    if (!currentConversationId.value) {return}
    
    loadingHistory.value = true
    clearError()
    
    try {
      frontendLogger.debug(` 載入分頁消息: conversationId=${currentConversationId.value}, page=${page}, pageSize=${pageSize}`)
      const response = await messageApi.listPaginated(currentConversationId.value, {
        page,
        pageSize
      })
      
      frontendLogger.debug('[useMessages] Full API response:', response)
      
      if (response.success && response.data) {
        // 檢查數據結構
        frontendLogger.debug('[useMessages] response.data structure:', response.data)
        frontendLogger.debug('[useMessages] response.data type:', typeof response.data)
        frontendLogger.debug('[useMessages] Is response.data an array?', Array.isArray(response.data))
        
        // 處理兩種可能的響應格式
        let messagesArray: Message[]
        let paginationInfo: {
          page?: number
          pageSize?: number
          total?: number
          totalPages?: number
          hasMore?: boolean
        } = {}
        
        if (Array.isArray(response.data)) {
          // 舊格式：直接返回消息數組
          frontendLogger.debug('[useMessages] Legacy format detected: direct array')
          messagesArray = response.data
          paginationInfo = {
            page: 1,
            pageSize: response.data.length,
            total: response.data.length,
            totalPages: 1,
            hasMore: false
          }
        } else if (response.data && typeof response.data === 'object' && 'items' in response.data) {
          // 新格式：分頁響應格式
          frontendLogger.debug('[useMessages] Paginated format detected')
          const paginatedData = response.data as PaginatedResponse<Message>
          
          if (!paginatedData.items || !Array.isArray(paginatedData.items)) {
            console.error('[useMessages] Invalid items in paginated data:', paginatedData.items)
            handleError('訊息數據格式錯誤')
            return
          }
          
          messagesArray = paginatedData.items
          paginationInfo = {
            page: paginatedData.page,
            pageSize: paginatedData.pageSize,
            total: paginatedData.total,
            totalPages: paginatedData.totalPages,
            hasMore: paginatedData.hasMore
          }
        } else {
          console.error('[useMessages] Unknown data format:', response.data)
          handleError('未知的訊息數據格式')
          return
        }
        
        frontendLogger.debug('[useMessages] Processing messages array:', messagesArray.length, 'items')
        
        // 確保消息按時間順序排列（最舊→最新）
        const orderedMessages = messageOrderUtils.ensureChronologicalOrder(messagesArray)
        
        if (append && page > 1) {
          // 載入歷史消息時，使用專用合併函數
          frontendLogger.debug(`[useMessages] Merging history: existing ${paginatedMessages.value.length} + new ${orderedMessages.length}`)
          const oldestExisting = paginatedMessages.value.length > 0 ? paginatedMessages.value[0]?.createdAt : 'none'
          const oldestNew = orderedMessages.length > 0 ? orderedMessages[0]?.createdAt : 'none'
          frontendLogger.debug(`[useMessages] Oldest existing: ${oldestExisting}, oldest new: ${oldestNew}`)

          paginatedMessages.value = messageOrderUtils.mergeHistoryMessages(paginatedMessages.value, orderedMessages)

          frontendLogger.debug(`[useMessages] After merge: ${paginatedMessages.value.length} total messages`)
        } else {
          // 初始載入或刷新
          frontendLogger.debug(`[useMessages] Initial load: ${orderedMessages.length} messages`)
          paginatedMessages.value = orderedMessages
        }
        
        // 使用兼容的分頁信息
        totalMessages.value = paginationInfo.total || 0
        hasMore.value = paginationInfo.hasMore || false
        currentPage.value = paginationInfo.page || 1

        frontendLogger.debug(`[useMessages] Pagination updated:`, {
          page: paginationInfo.page,
          totalPages: paginationInfo.totalPages,
          hasMore: paginationInfo.hasMore,
          totalMessages: paginationInfo.total,
          currentCount: paginatedMessages.value.length
        })

        frontendLogger.debug(` 分頁載入成功: ${messagesArray.length} 條訊息 (頁面 ${paginationInfo.page}/${paginationInfo.totalPages || 1})`)
      } else {
        handleError(response.error || '無法載入訊息')
      }
    } catch (err) {
      handleError(err)
    } finally {
      loadingHistory.value = false
    }
  }
  
  // 獲取消息的函數
  const fetchMessages = async () => {
    if (!currentConversationId.value) {return}
    
    if (enablePagination) {
      await fetchMessagesPaginated(1, false)
    } else {
      await messagesStore.fetchMessages(currentConversationId.value)
    }
  }

  const refreshMessages = async () => {
    if (enablePagination) {
      currentPage.value = 1
      hasMore.value = true
      await fetchMessagesPaginated(1, false)
    } else {
      await fetchMessages()
    }
  }

  // 專門用於polling的函數，在分頁模式下不重置已載入的歷史訊息
  const fetchLatestMessages = async () => {
    if (!currentConversationId.value) {return}

    if (enablePagination) {
      // 在分頁模式下，只更新第1頁的最新訊息，但保持已載入的歷史訊息
      frontendLogger.debug('[fetchLatestMessages] Polling latest messages without resetting pagination')

      try {
        const response = await messageApi.listPaginated(currentConversationId.value, {
          page: 1,
          pageSize
        })

        if (response.success && response.data) {
          let latestMessagesArray: Message[]

          if (Array.isArray(response.data)) {
            latestMessagesArray = response.data
          } else if (response.data && typeof response.data === 'object' && 'items' in response.data) {
            const paginatedData = response.data as PaginatedResponse<Message>
            latestMessagesArray = paginatedData.items || []
          } else {
            console.error('[fetchLatestMessages] Unknown data format:', response.data)
            return
          }

          // 確保最新訊息按時間排序
          const orderedLatestMessages = messageOrderUtils.ensureChronologicalOrder(latestMessagesArray)

          if (paginatedMessages.value.length === 0) {
            // 如果還沒有任何訊息，直接設置
            paginatedMessages.value = orderedLatestMessages
          } else {
            // 找到最新的已載入訊息時間
            const latestLoadedMessage = messageOrderUtils.getLatestMessage(paginatedMessages.value)
            const latestLoadedTime = latestLoadedMessage ? new Date(latestLoadedMessage.createdAt).getTime() : 0

            // 只添加比已載入訊息更新的訊息
            const newMessages = orderedLatestMessages.filter(msg =>
              new Date(msg.createdAt).getTime() > latestLoadedTime
            )

            if (newMessages.length > 0) {
              frontendLogger.debug(`[fetchLatestMessages] Found ${newMessages.length} new messages`)
              // 將新訊息添加到現有訊息末尾（保持時間順序）
              paginatedMessages.value = messageOrderUtils.ensureChronologicalOrder([
                ...paginatedMessages.value,
                ...newMessages
              ])
              // 更新總訊息數
              totalMessages.value += newMessages.length
            } else {
              frontendLogger.debug('[fetchLatestMessages] No new messages found')
            }
          }
        }
      } catch (err) {
        console.error('[fetchLatestMessages] Error:', err)
        // 如果polling失敗，不影響現有的分頁狀態
      }
    } else {
      // 非分頁模式下，使用原來的邏輯
      await messagesStore.fetchMessages(currentConversationId.value)
    }
  }
  
  // 載入更多歷史消息（infinite scroll）
  const loadMoreMessages = async () => {
    frontendLogger.debug('[loadMoreMessages] Called with state:', {
      enablePagination,
      hasMore: hasMore.value,
      loadingHistory: loadingHistory.value,
      currentPage: currentPage.value,
      totalMessages: totalMessages.value
    })

    if (!enablePagination || !hasMore.value || loadingHistory.value) {
      frontendLogger.debug('[loadMoreMessages] Blocked:', {
        enablePagination,
        hasMore: hasMore.value,
        loadingHistory: loadingHistory.value
      })
      return false
    }

    const nextPage = currentPage.value + 1
    frontendLogger.debug(`[loadMoreMessages] Loading page ${nextPage}...`)
    await fetchMessagesPaginated(nextPage, true)
    frontendLogger.debug(`[loadMoreMessages] Page ${nextPage} loaded, hasMore: ${hasMore.value}`)
    return hasMore.value
  }

  // 簡化的消息排序邏輯 - 只關注時間順序
  const sortedMessages = computed(() => {
    if (!messages.value || messages.value.length === 0) {return []}
    
    // 統一使用時間排序，確保最舊在前、最新在後
    return messageOrderUtils.ensureChronologicalOrder(messages.value)
  })

  // 最舊消息
  const oldestMessage = computed(() => {
    return messageOrderUtils.getOldestMessage(sortedMessages.value)
  })

  // 最新消息
  const latestMessage = computed(() => {
    return messageOrderUtils.getLatestMessage(sortedMessages.value)
  })

  const unreadMessages = computed(() => {
    if (!messages.value) {return []}
    return messages.value.filter((m: Message) => 
      m.senderType === 'customer' && !(m.metadata as Record<string, unknown>)?.isRead
    )
  })

  // 方法
  const setConversationId = async (id: string) => {
    // 重置分頁狀態
    if (enablePagination) {
      currentPage.value = 1
      hasMore.value = true
      paginatedMessages.value = []
      totalMessages.value = 0
    }
    
    currentConversationId.value = id
    if (id) {
      await fetchMessages()
    }
  }

  const sendMessage = async (content: string, _mediaUrl?: string, _mediaType?: string) => {
    if (!currentConversationId.value) {
      handleError(new Error('未選擇對話'))
      return false
    }

    clearError()
    try {
      if (enablePagination) {
        // 使用 API 直接發送
        // Get senderId from JWT token or authStore
        const senderId = getUserIdFromToken() || authStore.currentAgent?.id

        const response = await messageApi.send(currentConversationId.value, {
          content,
          messageType: 'text',
          senderId
        })
        
        if (response.success && response.data) {
          // 新消息直接加到末尾（符合升序排列，最新在後）
          paginatedMessages.value.push(response.data)
          // 更新總消息數
          totalMessages.value += 1
          return true
        } else {
          handleError(response.error || '發送失敗')
          return false
        }
      } else {
        await messagesStore.sendMessage(currentConversationId.value, content)
        await refreshMessages()
        return true
      }
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const markAsRead = async (messageId: string) => {
    clearError()
    try {
      await messagesStore.markAsRead(messageId)
      await refreshMessages()
    } catch (err) {
      handleError(err)
    }
  }

  const markAllAsRead = async () => {
    if (!currentConversationId.value) {return}
    
    clearError()
    try {
      const unreadIds = unreadMessages.value.map((m: Message) => m.id)
      await Promise.all(unreadIds.map((id: string) => messagesStore.markAsRead(id)))
      await refreshMessages()
    } catch (err) {
      handleError(err)
    }
  }

  const startTyping = () => {
    isTyping.value = true
    
    // 清除之前的計時器
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
    }
    
    // 設置自動停止打字狀態
    typingTimeout.value = setTimeout(() => {
      stopTyping()
    }, 3000)
  }

  const stopTyping = () => {
    isTyping.value = false
    if (typingTimeout.value) {
      clearTimeout(typingTimeout.value)
      typingTimeout.value = null
    }
  }

  const deleteMessage = async (_messageId: string) => {
    clearError()
    try {
      // Delete message functionality will be implemented when required
      await refreshMessages()
    } catch (err) {
      handleError(err)
    }
  }

  const searchMessages = (query: string) => {
    if (!messages.value || !query.trim()) {return []}
    
    const searchLower = query.toLowerCase()
    return messages.value.filter((message: Message) => 
      message.content.toLowerCase().includes(searchLower)
    )
  }

  const getMessagesByType = (senderType: 'user' | 'agent') => {
    if (!messages.value) {return []}
    return messages.value.filter((m: Message) => m.senderType === senderType)
  }

  const getMessagesInDateRange = (startDate: Date, endDate: Date) => {
    if (!messages.value) {return []}
    return messages.value.filter((m: Message) => {
      const messageDate = new Date(m.createdAt)
      return messageDate >= startDate && messageDate <= endDate
    })
  }

  // 監聽對話ID變化
  watch(currentConversationId, async (newId) => {
    if (newId && enablePagination) {
      await setConversationId(newId)
    }
  })

  return {
    // 數據 - 簡化為兩種關鍵狀態
    messages: sortedMessages,
    oldestMessage,
    latestMessage,
    unreadMessages,
    loading,
    error,
    isTyping,
    
    // 分頁相關數據
    hasMore: enablePagination ? hasMore : ref(false),
    loadingHistory: enablePagination ? loadingHistory : ref(false),
    totalMessages: enablePagination ? totalMessages : ref(0),
    currentPage: enablePagination ? currentPage : ref(1),

    // 方法
    setConversationId,
    fetchMessages,
    fetchLatestMessages,
    refreshMessages,
    loadMoreMessages: enablePagination ? loadMoreMessages : async () => false,
    sendMessage,
    markAsRead,
    markAllAsRead,
    startTyping,
    stopTyping,
    deleteMessage,
    searchMessages,
    getMessagesByType,
    getMessagesInDateRange,
    clearError,
    
    // 工具方法
    messageUtils: {
      getOldest: () => oldestMessage.value,
      getLatest: () => latestMessage.value,
      isOldest: (message: Message) => oldestMessage.value?.id === message.id,
      isLatest: (message: Message) => latestMessage.value?.id === message.id
    }
  }
}