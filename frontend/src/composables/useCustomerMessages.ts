// Customer Messages Composable - 連接到新的 Customer Conversation System
// 提供與 useMessages 相同的接口，但使用 /api/customer-conversations/* 端點
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Message } from '@/types'
import { conversationCache } from '@/utils/conversationCache'
import { getApiUrl } from '@/config/runtime'

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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 FIX: 使用統一的 getApiUrl (from @/config/runtime)
  // 開發環境使用相對路徑 (通過 Vite Proxy)，生產環境使用絕對路徑
  // ═══════════════════════════════════════════════════════════════════════════

  // 獲取認證 token - 🔧 FIX: 同時支援兩種認證方式
  const getAuthHeaders = () => {
    const token = authStore.token || localStorage.getItem('token') || localStorage.getItem('authToken')
    return {
      'Authorization': token ? `Bearer ${token}` : '',
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
        getApiUrl(`/api/customer-conversations/${conversationId}/messages?limit=${initialLimit}`),
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
        getApiUrl(`/api/customer-conversations/${conversationId}/messages?before=${oldestMessage.id}&limit=${remainingLimit}`),
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
        getApiUrl(`/api/customer-conversations/${conversationId}/messages?limit=${pageSize}`),
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
        getApiUrl(`/api/customer-conversations/${conversationId}/messages?before=${oldestMessage.id}&limit=${pageSize}`),
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
        getApiUrl(`/api/customer-conversations/${conversationId}/messages`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            content,
            assets: [] // Note: File attachments can be added using useFileUpload composable
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
   * 發送帶附件的消息（使用正確的 customer-conversations 端點以支持 WebSocket 廣播）
   * 🔧 FIX: 確保帶附件的訊息也使用 CustomerMessageDO，觸發 WebSocket 廣播
   */
  const sendMessageWithAttachments = async (
    content: string,
    attachmentIds: string[],
    options?: {
      messageType?: 'text' | 'file'
      platform?: string
    }
  ): Promise<{ success: boolean; message?: unknown; error?: string }> => {
    // 允許純附件訊息（沒有文字內容）
    if (!content?.trim() && (!attachmentIds || attachmentIds.length === 0)) {
      return { success: false, error: '訊息內容或附件不能為空' }
    }

    try {
      const response = await fetch(
        getApiUrl(`/api/customer-conversations/${conversationId}/messages`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            content: content?.trim() || '',
            attachmentIds,
            messageType: options?.messageType || (attachmentIds.length > 0 ? 'file' : 'text'),
            platform: options?.platform || 'system'
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        console.log('✅ [useCustomerMessages] Message with attachments sent successfully')
        // 注意：新消息會通過 WebSocket 實時推送給所有連接的客服
        return { success: true, message: data.message }
      } else {
        console.error('❌ [useCustomerMessages] Failed to send message with attachments:', data.error)
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('❌ [useCustomerMessages] Error sending message with attachments:', error)
      return { success: false, error: error instanceof Error ? error.message : '發送失敗' }
    }
  }

  /**
   * 添加新消息到列表（用於 WebSocket 實時推送）
   * 🔧 FIX: 合併式去重機制 - 解決競態條件導致的重複問題
   *
   * 競態條件場景：
   * 1. 用戶發送訊息 → 創建 temp-xxx 臨時訊息
   * 2. HTTP POST 發送到後端
   * 3. 後端創建訊息 (realId) → 廣播 WebSocket → 返回 HTTP 響應
   * 4. WebSocket 比 HTTP 響應先到達
   * 5. 如果只做 ID 去重，會添加重複訊息（因為 temp-xxx ≠ realId）
   *
   * 解決方案：當 WebSocket 訊息到達時，如果發現有相同內容的 pending 訊息，
   * 則「合併」（更新 ID）而非「添加」
   */
  const addMessage = (message: Message) => {
    // 1. 基本 ID 去重：防止完全相同的訊息被添加多次
    const existsById = messages.value.some(m => m.id === message.id)
    if (existsById) {
      console.log('⚠️ [useCustomerMessages] Message already exists by ID, skipping:', message.id)
      return
    }

    // 2. 🔧 FIX: 合併式去重 - 檢查是否有 pending (temp-xxx) 訊息可以合併
    // 這解決了 WebSocket 比 HTTP 響應先到達的競態條件
    const pendingMessage = messages.value.find(m => {
      // 只檢查 temp- 開頭的訊息（pending 訊息）
      if (!m.id.startsWith('temp-')) {return false}

      // 內容必須相同
      if (m.content !== message.content) {return false}

      // 發送者類型必須相同
      if (m.senderType !== message.senderType) {return false}

      // 時間戳必須在合理範圍內（5秒內）
      const timeDiff = Math.abs(
        new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime()
      )
      if (timeDiff > 5000) {return false}

      return true
    })

    if (pendingMessage) {
      // 找到匹配的 pending 訊息 → 合併（更新 ID 而非添加）
      console.log(`🔀 [useCustomerMessages] Merging WebSocket message with pending: ${pendingMessage.id} → ${message.id}`)

      // 更新 pending 訊息的關鍵字段
      pendingMessage.id = message.id
      pendingMessage.deliveryStatus = message.deliveryStatus || 'delivered'
      // 🔧 FIX: 同時更新 status 為 'sent'，解決旋轉圖標不消失的問題
      // 當 WebSocket 比 HTTP 響應先到達時，handleMessageConfirmed 無法找到訊息
      // 因為 ID 已從 temp-xxx 變為 realId，所以需要在這裡設置 status
      pendingMessage.status = 'sent' as const

      // 如果 WebSocket 訊息有附件，也更新
      /* eslint-disable camelcase -- API response uses snake_case */
      if (message.file_attachments && message.file_attachments.length > 0) {
        pendingMessage.file_attachments = message.file_attachments
      }
      /* eslint-enable camelcase */

      console.log('✅ [useCustomerMessages] Pending message merged successfully with status=sent')
      return
    }

    // 3. 沒有匹配的 pending 訊息 → 正常添加並排序
    const newMessages = [...messages.value, message]

    // 按 createdAt 排序（升序，最舊的在前）
    newMessages.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return timeA - timeB
    })

    messages.value = newMessages
    console.log('✅ [useCustomerMessages] Added new message via WebSocket:', message.id)
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
    sendMessageWithAttachments, // 🔧 FIX: 新增帶附件訊息發送方法（支持 WebSocket 廣播）
    addMessage
  }
}
