// Customer Messages Composable - 連接到新的 Customer Conversation System
// 提供與 useMessages 相同的接口，但使用 /api/customer-conversations/* 端點
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Message } from '@/types'
import { conversationCache } from '@/utils/conversationCache'

export interface CustomerMessagesOptions {
  enablePagination?: boolean
  pageSize?: number
  enableProgressiveLoading?: boolean // 🚀 啟用漸進式加載
}

export function useCustomerMessages(conversationId: string, options?: CustomerMessagesOptions) {
  const authStore = useAuthStore()

  // 配置
  const pageSize = options?.pageSize ?? 30
  // 🔧 FIX: Disabled progressive loading by default to prevent flicker/shaking
  // Progressive loading causes two-phase render which leads to layout shifts
  // Set to true only if you want faster initial display at the cost of visual stability
  const enableProgressiveLoading = options?.enableProgressiveLoading ?? false
  // enablePagination 保留供未來使用
  // const enablePagination = options?.enablePagination ?? false

  // 狀態
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const loadingHistory = ref(false)
  const isLoadingInitial = ref(false) // 🚀 初始加載狀態
  const initialLoadComplete = ref(false) // 🚀 初始加載是否完成
  const isHistoryPrepending = ref(false) // 🔧 FIX: 標記歷史消息正在前插（用於滾動位置保持）
  const historyPrependCount = ref(0) // 🔧 FIX: 前插的歷史消息數量

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
   * 🚀 漸進式加載：先加載最近消息，然後加載歷史
   */
  const fetchMessages = async () => {
    if (enableProgressiveLoading) {
      await fetchProgressively()
    } else {
      await fetchAllMessages()
    }
  }

  /**
   * 🚀 漸進式加載實現
   */
  const fetchProgressively = async () => {
    loading.value = true
    isLoadingInitial.value = true

    try {
      // ========== 階段 1: 快速加載最近 10 條消息 ==========
      console.log('🚀 [Progressive] Phase 1: Loading recent messages...')
      const initialLimit = 10

      const initialResponse = await fetch(
        `${apiUrl}/api/customer-conversations/${conversationId}/messages?limit=${initialLimit}`,
        {
          headers: getAuthHeaders()
        }
      )

      const initialData = await initialResponse.json()

      if (initialData.success && initialData.messages) {
        // 快速顯示最近的消息
        messages.value = initialData.messages.sort((a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        hasMore.value = initialData.hasMore || false
        initialLoadComplete.value = true

        console.log(`✅ [Progressive] Phase 1 complete: ${messages.value.length} recent messages`)

        // 更新緩存
        const lastMessage = messages.value[messages.value.length - 1]
        const lastTime = lastMessage?.createdAt
        conversationCache.set(conversationId, {
          messageCount: messages.value.length,
          lastMessageTime: typeof lastTime === 'string' ? lastTime : new Date(lastTime || Date.now()).toISOString()
        })
      }

      isLoadingInitial.value = false
      loading.value = false

      // ========== 階段 2: 背景加載更多歷史消息 ==========
      if (initialData.hasMore && pageSize > initialLimit) {
        setTimeout(async () => {
          await loadMoreHistoryInBackground()
        }, 300) // 300ms 後開始背景加載
      }
    } catch (error) {
      console.error('❌ [Progressive] Error in progressive loading:', error)
      isLoadingInitial.value = false
      loading.value = false
    }
  }

  /**
   * 🚀 背景加載歷史消息
   */
  const loadMoreHistoryInBackground = async () => {
    if (!messages.value.length || loadingHistory.value) {
      return
    }

    loadingHistory.value = true
    console.log('🔄 [Progressive] Phase 2: Loading history in background...')

    try {
      const oldestMessage = messages.value[0]

      if (!oldestMessage) {
        loadingHistory.value = false
        return
      }

      const remainingLimit = pageSize - messages.value.length

      if (remainingLimit <= 0) {
        loadingHistory.value = false
        return
      }

      const response = await fetch(
        `${apiUrl}/api/customer-conversations/${conversationId}/messages?before=${oldestMessage.id}&limit=${remainingLimit}`,
        {
          headers: getAuthHeaders()
        }
      )

      const data = await response.json()

      if (data.success && data.messages && data.messages.length > 0) {
        const olderMessages = data.messages.sort((a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        // 🔧 FIX: 標記歷史前插開始，讓 VirtualMessageList 可以保持滾動位置
        isHistoryPrepending.value = true
        historyPrependCount.value = olderMessages.length
        console.log(`📌 [Progressive] Setting isHistoryPrepending=true, count=${olderMessages.length}`)

        messages.value = [...olderMessages, ...messages.value]
        hasMore.value = data.hasMore || false

        console.log(`✅ [Progressive] Phase 2 complete: ${olderMessages.length} history messages loaded`)

        // 更新緩存
        conversationCache.set(conversationId, {
          messageCount: messages.value.length
        })

        // 🔧 FIX: 在下一個 tick 重置標記（讓 VirtualMessageList 有時間處理）
        setTimeout(() => {
          isHistoryPrepending.value = false
          historyPrependCount.value = 0
          console.log(`📌 [Progressive] Reset isHistoryPrepending=false`)
        }, 100)
      }
    } catch (error) {
      console.error('❌ [Progressive] Error loading history:', error)
    } finally {
      loadingHistory.value = false
    }
  }

  /**
   * 傳統方式：一次性加載所有消息
   */
  const fetchAllMessages = async () => {
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
        messages.value = data.messages.sort((a: Message, b: Message) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        hasMore.value = data.hasMore || false

        console.log(`✅ [useCustomerMessages] Loaded ${messages.value.length} messages`)

        // 更新緩存
        const lastMessage = messages.value[messages.value.length - 1]
        const lastTime = lastMessage?.createdAt
        conversationCache.set(conversationId, {
          messageCount: messages.value.length,
          lastMessageTime: typeof lastTime === 'string' ? lastTime : new Date(lastTime || Date.now()).toISOString()
        })
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

        // 🔧 FIX: 標記歷史前插開始
        isHistoryPrepending.value = true
        historyPrependCount.value = olderMessages.length
        console.log(`📌 [loadMoreMessages] Setting isHistoryPrepending=true, count=${olderMessages.length}`)

        messages.value = [...olderMessages, ...messages.value]
        hasMore.value = data.hasMore || false

        console.log(`✅ [useCustomerMessages] Loaded ${olderMessages.length} more messages`)

        // 🔧 FIX: 重置標記
        setTimeout(() => {
          isHistoryPrepending.value = false
          historyPrependCount.value = 0
        }, 100)
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
   * 🔧 智能去重：會識別並替換臨時消息（optimistic UI）
   */
  const addMessage = (message: Message) => {
    // 第一步：檢查是否已存在相同ID的消息
    const existsById = messages.value.some(m => m.id === message.id)
    if (existsById) {
      console.log('⚠️ [useCustomerMessages] Message already exists, skipping:', message.id)
      return
    }

    // 第二步：檢查是否存在需要替換的臨時消息（optimistic UI）
    // 匹配條件：
    // 1. ID以"temp-"開頭（臨時消息）
    // 2. 內容完全相同
    // 3. 發送者相同
    // 4. 時間戳接近（10秒內）
    const tempMessageIndex = messages.value.findIndex(m => {
      const isTempMessage = m.id.startsWith('temp-')
      const sameContent = m.content === message.content
      const sameSender = m.senderId === message.senderId

      // 計算時間差（允許10秒誤差）
      const msgTime = new Date(message.createdAt).getTime()
      const tempTime = new Date(m.createdAt).getTime()
      const timeDiff = Math.abs(msgTime - tempTime)
      const withinTimeWindow = timeDiff < 10000 // 10秒內

      // 🔍 調試日誌：檢查匹配條件
      if (isTempMessage) {
        console.log('🔍 [Dedupe Debug] Checking temp message:', m.id)
        console.log('  - Content match:', sameContent, `("${m.content}" === "${message.content}")`)
        console.log('  - Sender match:', sameSender, `(${m.senderId} === ${message.senderId})`)
        console.log('  - Time diff:', timeDiff, 'ms, within window:', withinTimeWindow)
        console.log('  - All match:', isTempMessage && sameContent && sameSender && withinTimeWindow)
      }

      return isTempMessage && sameContent && sameSender && withinTimeWindow
    })


    if (tempMessageIndex !== -1) {
      // 找到匹配的臨時消息，替換它
      const tempMessage = messages.value[tempMessageIndex]
      if (tempMessage) {
        console.log(`🔄 [useCustomerMessages] Replacing temp message ${tempMessage.id} with real message ${message.id}`)
        messages.value[tempMessageIndex] = message
      }
    } else {
      // 沒有找到臨時消息，正常添加
      messages.value.push(message)
      console.log('✅ [useCustomerMessages] Added new message via WebSocket:', message.id)
    }
  }

  return {
    // 數據
    messages: computed(() => messages.value),
    loading: computed(() => loading.value),
    hasMore,
    isLoadingInitial: computed(() => isLoadingInitial.value), // 🚀 初始加載狀態
    initialLoadComplete: computed(() => initialLoadComplete.value), // 🚀 初始加載完成
    loadingHistory: computed(() => loadingHistory.value), // 🚀 歷史加載狀態
    isHistoryPrepending: computed(() => isHistoryPrepending.value), // 🔧 FIX: 歷史消息正在前插
    historyPrependCount: computed(() => historyPrependCount.value), // 🔧 FIX: 前插的消息數量

    // 方法
    fetchMessages,
    refreshMessages,
    loadMoreMessages,
    sendMessage,
    addMessage
  }
}
