// Customer Messages Composable - 連接到新的 Customer Conversation System
// 提供與 useMessages 相同的接口，但使用 /api/customer-conversations/* 端點
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Message } from '@/types'

export interface CustomerMessagesOptions {
  enablePagination?: boolean
  pageSize?: number
}

export function useCustomerMessages(conversationId: string, options?: CustomerMessagesOptions) {
  const authStore = useAuthStore()

  // 配置
  const pageSize = options?.pageSize ?? 30
  // enablePagination 保留供未來使用
  // const enablePagination = options?.enablePagination ?? false

  // 狀態
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const loadingHistory = ref(false)

  // API Base URL - 永遠使用遠端後端
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'

  // 獲取認證 token
  const getAuthHeaders = () => {
    const token = authStore.token || localStorage.getItem('token')
    return {
      'X-Session-Id': token || '',
      'X-Conversation-Id': conversationId
    }
  }

  /**
   * 獲取初始消息
   */
  const fetchMessages = async () => {
    loading.value = true

    try {
      const response = await fetch(
        `${apiUrl}/api/customer-conversations/${conversationId}/messages?limit=${pageSize}`,
        {
          headers: getAuthHeaders()
        }
      )

      const data = await response.json()

      if (data.success && data.messages) {
        // 按時間排序（最舊在前，最新在後）
        messages.value = data.messages.sort((a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        hasMore.value = data.hasMore || false

        console.log(`✅ [useCustomerMessages] Loaded ${messages.value.length} messages`)
      } else {
        console.error('❌ [useCustomerMessages] Failed to load messages:', data.error)
      }
    } catch (error) {
      console.error('❌ [useCustomerMessages] Error fetching messages:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新消息（重新載入最新的）
   */
  const refreshMessages = async () => {
    await fetchMessages()
  }

  /**
   * 載入更多歷史消息（分頁）
   */
  const loadMoreMessages = async () => {
    if (!hasMore.value || loadingHistory.value || messages.value.length === 0) {
      return
    }

    loadingHistory.value = true

    try {
      // 獲取最舊消息的 ID
      const oldestMessage = messages.value.reduce((oldest, current) =>
        new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
      )

      const response = await fetch(
        `${apiUrl}/api/customer-conversations/${conversationId}/messages?before=${oldestMessage.id}&limit=${pageSize}`,
        {
          headers: getAuthHeaders()
        }
      )

      const data = await response.json()

      if (data.success && data.messages) {
        // 將舊消息加到前面
        const olderMessages = data.messages.sort((a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        messages.value = [...olderMessages, ...messages.value]
        hasMore.value = data.hasMore || false

        console.log(`✅ [useCustomerMessages] Loaded ${olderMessages.length} more messages`)
      }
    } catch (error) {
      console.error('❌ [useCustomerMessages] Error loading more messages:', error)
    } finally {
      loadingHistory.value = false
    }
  }

  /**
   * 發送新消息
   */
  const sendMessage = async (content: string, _mediaUrl?: string, _mediaType?: string): Promise<boolean> => {
    if (!content.trim()) {
      return false
    }

    try {
      const response = await fetch(
        `${apiUrl}/api/customer-conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            content,
            assets: [] // TODO: 處理文件上傳
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        console.log('✅ [useCustomerMessages] Message sent successfully')
        // 注意：新消息會通過 WebSocket 實時推送，不需要手動添加
        return true
      } else {
        console.error('❌ [useCustomerMessages] Failed to send message:', data.error)
        return false
      }
    } catch (error) {
      console.error('❌ [useCustomerMessages] Error sending message:', error)
      return false
    }
  }

  /**
   * 添加新消息到列表（用於 WebSocket 實時推送）
   */
  const addMessage = (message: Message) => {
    // 避免重複添加
    const exists = messages.value.some(m => m.id === message.id)
    if (!exists) {
      messages.value.push(message)
      console.log('✅ [useCustomerMessages] Added new message via WebSocket:', message.id)
    }
  }

  return {
    // 數據
    messages: computed(() => messages.value),
    loading: computed(() => loading.value),
    hasMore,

    // 方法
    fetchMessages,
    refreshMessages,
    loadMoreMessages,
    sendMessage,
    addMessage
  }
}
