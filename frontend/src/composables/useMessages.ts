// 現代化訊息管理 Composable with 分頁載入支持
import { ref, computed, watch } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useError } from './useError'
import { messageApi } from '@/api/message'
import type { Message, PaginatedResponse } from '@/types'

// 🔧 消息順序處理工具函數
const messageOrderUtils = {
  // 將後端降序消息轉為前端升序（最新在後）
  toAscending: (messages: Message[]): Message[] => {
    return [...messages].reverse()
  },
  
  // 合併新載入的歷史消息（保持時間順序）
  mergeHistoryMessages: (oldMessages: Message[], newMessages: Message[]): Message[] => {
    // newMessages 已經是升序，直接加到前面
    return [...newMessages, ...oldMessages]
  },
  
  // 統一排序函數（兼容分頁和非分頁模式）
  ensureAscendingOrder: (messages: Message[]): Message[] => {
    return [...messages].sort((a: Message, b: Message) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }
}

export function useMessages(conversationId?: string, options?: {
  enablePagination?: boolean
  pageSize?: number
}) {
  const messagesStore = useMessagesStore()
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
      console.log(`🔄 載入分頁消息: conversationId=${currentConversationId.value}, page=${page}, pageSize=${pageSize}`)
      const response = await messageApi.listPaginated(currentConversationId.value, {
        page,
        pageSize
      })
      
      console.log('🔍 [useMessages] Full API response:', response)
      
      if (response.success && response.data) {
        // 檢查數據結構
        console.log('🔍 [useMessages] response.data structure:', response.data)
        console.log('🔍 [useMessages] response.data type:', typeof response.data)
        console.log('🔍 [useMessages] Is response.data an array?', Array.isArray(response.data))
        
        // ✅ 處理兩種可能的響應格式
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
          console.log('📝 [useMessages] Legacy format detected: direct array')
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
          console.log('📝 [useMessages] Paginated format detected')
          const paginatedData = response.data as PaginatedResponse<Message>
          
          if (!paginatedData.items || !Array.isArray(paginatedData.items)) {
            console.error('❌ [useMessages] Invalid items in paginated data:', paginatedData.items)
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
          console.error('❌ [useMessages] Unknown data format:', response.data)
          handleError('未知的訊息數據格式')
          return
        }
        
        console.log('📊 [useMessages] Processing messages array:', messagesArray.length, 'items')
        
        // 🔄 使用工具函數處理消息順序
        const orderedMessages = messageOrderUtils.toAscending(messagesArray)
        
        if (append && page > 1) {
          // 載入歷史消息時，使用專用合併函數
          paginatedMessages.value = messageOrderUtils.mergeHistoryMessages(paginatedMessages.value, orderedMessages)
        } else {
          // 初始載入或刷新
          paginatedMessages.value = orderedMessages
        }
        
        // ✅ 使用兼容的分頁信息
        totalMessages.value = paginationInfo.total || 0
        hasMore.value = paginationInfo.hasMore || false
        currentPage.value = paginationInfo.page || 1
        
        console.log(`📊 分頁載入成功: ${messagesArray.length} 條訊息 (頁面 ${paginationInfo.page}/${paginationInfo.totalPages || 1})`)
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
  
  // 載入更多歷史消息（infinite scroll）
  const loadMoreMessages = async () => {
    if (!enablePagination || !hasMore.value || loadingHistory.value) {
      return false
    }
    
    const nextPage = currentPage.value + 1
    await fetchMessagesPaginated(nextPage, true)
    return hasMore.value
  }

  // 🎯 統一的消息排序邏輯
  const sortedMessages = computed(() => {
    if (!messages.value || messages.value.length === 0) {return []}
    
    // 分頁模式：消息已在載入時處理順序，直接返回
    if (enablePagination) {
      return messages.value
    }
    
    // 非分頁模式：使用統一排序函數確保升序
    return messageOrderUtils.ensureAscendingOrder(messages.value)
  })

  const latestMessage = computed(() => {
    if (!sortedMessages.value.length) {return null}
    return sortedMessages.value[sortedMessages.value.length - 1]
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
        const response = await messageApi.send(currentConversationId.value, {
          content,
          messageType: 'text'
        })
        
        if (response.success && response.data) {
          // ✅ 新消息直接加到末尾（符合升序排列，最新在後）
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
      // TODO: Implement deleteMessage in store
      // await messagesStore.deleteMessage(messageId)
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
    // 數據
    messages: sortedMessages,
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
    clearError
  }
}