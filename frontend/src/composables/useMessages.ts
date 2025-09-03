// 現代化訊息管理 Composable
import { ref, computed } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useError } from './useError'
import type { Message } from '@/types'

export function useMessages(conversationId?: string) {
  const messagesStore = useMessagesStore()
  const { error, handleError, clearError } = useError()
  
  // 狀態
  const currentConversationId = ref(conversationId)
  const isTyping = ref(false)
  const typingTimeout = ref<NodeJS.Timeout | null>(null)

  // 直接使用 messagesStore 的數據
  const messages = computed(() => {
    if (!currentConversationId.value) {return []}
    return messagesStore.messagesByConversation(currentConversationId.value)
  })
  
  const loading = computed(() => messagesStore.loading)

  // 獲取消息的函數
  const fetchMessages = async () => {
    if (!currentConversationId.value) {return}
    await messagesStore.fetchMessages(currentConversationId.value)
  }

  const refreshMessages = fetchMessages

  // 計算屬性
  const sortedMessages = computed(() => {
    if (!messages.value) {return []}
    return [...messages.value].sort((a: Message, b: Message) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
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
      await messagesStore.sendMessage(currentConversationId.value, content)
      
      // 刷新訊息列表
      await refreshMessages()
      return true
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

  return {
    // 數據
    messages: sortedMessages,
    latestMessage,
    unreadMessages,
    loading,
    error,
    isTyping,

    // 方法
    setConversationId,
    fetchMessages,
    refreshMessages,
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