// 延遲訊息管理 Composable
import { ref, computed } from 'vue'
import { messagesApi } from '@/api/messages'
import { useAuth } from './useAuth'
import { useError } from './useError'
import type { DelayedMessageRequest, PendingMessage, DelayedMessageResponse } from '@/api/messages'

export function useDelayedMessages() {
  const { currentAgent } = useAuth()
  const { error, handleError, clearError } = useError()

  const loading = ref(false)
  const sending = ref(false)
  const recalling = ref(false)
  const pendingMessages = ref<PendingMessage[]>([])
  const currentPage = ref(1)
  const pageSize = ref(20)
  const totalCount = ref(0)

  const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

  // 發送延遲訊息
  const sendDelayedMessage = async (request: Omit<DelayedMessageRequest, 'senderId'>): Promise<DelayedMessageResponse | null> => {
    if (!currentAgent.value) {
      handleError(new Error('用戶未登入'))
      return null
    }

    sending.value = true
    clearError()

    try {
      const response = await messagesApi.sendDelayedMessage({
        ...request,
        senderId: currentAgent.value.id
      })

      if (response.success) {
        // 刷新待發送訊息列表
        await loadPendingMessages(currentPage.value)
        return response.data || null
      } else {
        handleError(new Error(response.error || '發送失敗'))
        return null
      }
    } catch (err) {
      handleError(err)
      return null
    } finally {
      sending.value = false
    }
  }

  // 撤回延遲訊息
  const recallMessage = async (messageId: string): Promise<boolean> => {
    if (!currentAgent.value) {
      handleError(new Error('用戶未登入'))
      return false
    }

    recalling.value = true
    clearError()

    try {
      const response = await messagesApi.recallMessage({
        messageId,
        userId: currentAgent.value.id
      })

      if (response.success) {
        // 從列表中移除已撤回的訊息
        pendingMessages.value = pendingMessages.value.filter(msg => msg.id !== messageId)
        totalCount.value = Math.max(0, totalCount.value - 1)
        return true
      } else {
        handleError(new Error(response.error || '撤回失敗'))
        return false
      }
    } catch (err) {
      handleError(err)
      return false
    } finally {
      recalling.value = false
    }
  }

  // 載入待發送訊息列表
  const loadPendingMessages = async (page = 1): Promise<void> => {
    loading.value = true
    clearError()

    try {
      const response = await messagesApi.getPendingMessages(page, pageSize.value)

      if (response.success && response.data) {
        pendingMessages.value = response.data.items || []
        totalCount.value = response.data.total || 0
        currentPage.value = page
      } else {
        handleError(new Error(response.error || '載入失敗'))
      }
    } catch (err) {
      handleError(err)
    } finally {
      loading.value = false
    }
  }

  // 刷新列表
  const refreshPendingMessages = () => {
    return loadPendingMessages(currentPage.value)
  }

  // 切換頁面
  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      return loadPendingMessages(page)
    }
    return Promise.resolve()
  }

  // 檢查訊息是否可撤回
  const canRecallMessage = async (messageId: string): Promise<boolean> => {
    if (!currentAgent.value) {return false}

    try {
      const response = await messagesApi.canRecallMessage(messageId, currentAgent.value.id)
      return response.success ? (response.data?.canRecall || false) : false
    } catch (err) {
      console.error('Check recall permission failed:', err)
      return false
    }
  }

  // 獲取訊息詳情
  const getMessageDetails = async (messageId: string): Promise<PendingMessage | null> => {
    try {
      const response = await messagesApi.getMessageDetails(messageId)
      return response.success ? (response.data || null) : null
    } catch (err) {
      console.error('Get message details failed:', err)
      return null
    }
  }

  // 計算倒計時
  const getCountdown = (scheduledTime: string): string => {
    const sendTime = new Date(scheduledTime)
    const now = new Date()
    const diff = sendTime.getTime() - now.getTime()
    
    if (diff <= 0) {return '即將發送'}
    
    const minutes = Math.floor(diff / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`
    }
    return `${seconds}秒`
  }

  // 檢查是否接近發送時間
  const isNearSendTime = (scheduledTime: string): boolean => {
    const sendTime = new Date(scheduledTime)
    const now = new Date()
    const diffMinutes = (sendTime.getTime() - now.getTime()) / (1000 * 60)
    return diffMinutes <= 1 && diffMinutes > 0
  }

  // 格式化日期時間
  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return {
    // 狀態
    loading,
    sending,
    recalling,
    error,
    pendingMessages,
    currentPage,
    totalPages,
    totalCount,

    // 方法
    sendDelayedMessage,
    recallMessage,
    loadPendingMessages,
    refreshPendingMessages,
    changePage,
    canRecallMessage,
    getMessageDetails,
    clearError,

    // 工具方法
    getCountdown,
    isNearSendTime,
    formatDateTime
  }
}