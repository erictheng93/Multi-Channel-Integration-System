// 平滑載入 Composable - 解決對話記錄閃爍問題
import { ref, computed, nextTick, onUnmounted } from 'vue'
import type { Message } from '@/types'

interface SmoothLoadingOptions {
  /** 動畫持續時間（毫秒） */
  animationDuration?: number
  /** 批量更新的最大等待時間（毫秒） */
  batchTimeout?: number
  /** 是否啟用虛擬滾動 */
  enableVirtualScroll?: boolean
  /** 虛擬滾動的緩衝區大小 */
  virtualScrollBuffer?: number
}

interface SmoothUpdate {
  type: 'add' | 'update' | 'remove'
  messages: Message[]
  animate?: boolean
}

const DEFAULT_OPTIONS: Required<SmoothLoadingOptions> = {
  animationDuration: 300,
  batchTimeout: 16, // 一幀的時間
  enableVirtualScroll: false,
  virtualScrollBuffer: 5
}

export function useSmoothLoading(options: SmoothLoadingOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  // 狀態管理
  const messages = ref<Message[]>([])
  const isUpdating = ref(false)
  const pendingUpdates = ref<SmoothUpdate[]>([])
  const animatingItems = ref(new Set<string>())
  
  // 批量更新相關
  let updateTimer: NodeJS.Timeout | null = null
  let animationFrameId: number | null = null
  
  // 計算屬性
  const displayMessages = computed(() => {
    return messages.value.map(message => ({
      ...message,
      isAnimating: animatingItems.value.has(message.id),
      shouldAnimate: animatingItems.value.has(message.id)
    }))
  })

  // 平滑更新消息列表
  const updateMessages = (newMessages: Message[], animate = true) => {
    const update: SmoothUpdate = {
      type: 'update',
      messages: newMessages,
      animate
    }
    
    pendingUpdates.value.push(update)
    scheduleBatchUpdate()
  }

  // 添加新消息
  const addMessages = (newMessages: Message[], animate = true) => {
    const update: SmoothUpdate = {
      type: 'add',
      messages: newMessages,
      animate
    }
    
    pendingUpdates.value.push(update)
    scheduleBatchUpdate()
  }

  // 移除消息
  const removeMessages = (messagesToRemove: Message[], animate = true) => {
    const update: SmoothUpdate = {
      type: 'remove',
      messages: messagesToRemove,
      animate
    }
    
    pendingUpdates.value.push(update)
    scheduleBatchUpdate()
  }

  // 調度批量更新
  const scheduleBatchUpdate = () => {
    if (updateTimer) {return}
    
    updateTimer = setTimeout(() => {
      processBatchUpdates()
      updateTimer = null
    }, config.batchTimeout)
  }

  // 處理批量更新
  const processBatchUpdates = async () => {
    if (pendingUpdates.value.length === 0) {return}
    
    isUpdating.value = true
    
    // 使用 globalThis.requestAnimationFrame 確保DOM更新在下一幀執行
    animationFrameId = globalThis.requestAnimationFrame(async () => {
      await processUpdatesInOrder()
      isUpdating.value = false
      animationFrameId = null
    })
  }

  // 按順序處理更新
  const processUpdatesInOrder = async () => {
    const updates = [...pendingUpdates.value]
    pendingUpdates.value = []
    
    for (const update of updates) {
      await processUpdate(update)
    }
  }

  // 處理單個更新
  const processUpdate = async (update: SmoothUpdate) => {
    switch (update.type) {
      case 'add':
        await processAddUpdate(update)
        break
      case 'update':
        await processUpdateMessages(update)
        break
      case 'remove':
        await processRemoveUpdate(update)
        break
    }
  }

  // 處理添加更新
  const processAddUpdate = async (update: SmoothUpdate) => {
    const newMessages = update.messages
    const shouldAnimate = update.animate ?? true
    
    if (shouldAnimate) {
      // 標記新消息為動畫狀態
      newMessages.forEach(msg => animatingItems.value.add(msg.id))
    }
    
    // 智能合併：找出真正的新消息
    const existingIds = new Set(messages.value.map(m => m.id))
    const actuallyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id))
    
    if (actuallyNewMessages.length > 0) {
      // 按時間順序插入新消息
      const allMessages = [...messages.value, ...actuallyNewMessages]
      messages.value = sortMessagesByTime(allMessages)
      
      if (shouldAnimate) {
        await nextTick()
        // 移除動畫狀態
        setTimeout(() => {
          newMessages.forEach(msg => animatingItems.value.delete(msg.id))
        }, config.animationDuration)
      }
    }
  }

  // 處理消息更新
  const processUpdateMessages = async (update: SmoothUpdate) => {
    const newMessages = update.messages
    const shouldAnimate = update.animate ?? false
    
    // 差異檢測：只更新變化的消息
    const changes = detectChanges(messages.value, newMessages)
    
    if (changes.hasChanges) {
      if (shouldAnimate && changes.newMessages.length > 0) {
        // 標記新消息為動畫狀態
        changes.newMessages.forEach(msg => animatingItems.value.add(msg.id))
      }
      
      // 平滑替換
      messages.value = newMessages
      
      if (shouldAnimate) {
        await nextTick()
        setTimeout(() => {
          changes.newMessages.forEach(msg => animatingItems.value.delete(msg.id))
        }, config.animationDuration)
      }
    }
  }

  // 處理移除更新
  const processRemoveUpdate = async (update: SmoothUpdate) => {
    const messagesToRemove = update.messages
    const shouldAnimate = update.animate ?? true
    
    if (shouldAnimate) {
      // 標記要移除的消息為動畫狀態
      messagesToRemove.forEach(msg => animatingItems.value.add(msg.id))
      
      await nextTick()
      
      // 延遲移除，讓動畫播放完成
      setTimeout(() => {
        const removeIds = new Set(messagesToRemove.map(m => m.id))
        messages.value = messages.value.filter(msg => !removeIds.has(msg.id))
        messagesToRemove.forEach(msg => animatingItems.value.delete(msg.id))
      }, config.animationDuration)
    } else {
      // 直接移除
      const removeIds = new Set(messagesToRemove.map(m => m.id))
      messages.value = messages.value.filter(msg => !removeIds.has(msg.id))
    }
  }

  // 檢測變化
  const detectChanges = (oldMessages: Message[], newMessages: Message[]) => {
    const oldIds = new Set(oldMessages.map(m => m.id))
    const newIds = new Set(newMessages.map(m => m.id))
    
    const newMessages_filtered = newMessages.filter(msg => !oldIds.has(msg.id))
    const removedMessages = oldMessages.filter(msg => !newIds.has(msg.id))
    const updatedMessages = newMessages.filter(msg => {
      if (!oldIds.has(msg.id)) {return false}
      const oldMsg = oldMessages.find(m => m.id === msg.id)
      return oldMsg && (
        oldMsg.content !== msg.content ||
        JSON.stringify(oldMsg.metadata) !== JSON.stringify(msg.metadata)
      )
    })
    
    return {
      hasChanges: newMessages_filtered.length > 0 || removedMessages.length > 0 || updatedMessages.length > 0,
      newMessages: newMessages_filtered,
      removedMessages,
      updatedMessages
    }
  }

  // 按時間排序消息
  const sortMessagesByTime = (messages: Message[]): Message[] => {
    return [...messages].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  // 立即更新（無動畫）
  const setMessagesImmediate = (newMessages: Message[]) => {
    messages.value = sortMessagesByTime(newMessages)
    animatingItems.value.clear()
  }

  // 清空消息
  const clearMessages = (animate = false) => {
    if (animate) {
      removeMessages([...messages.value], true)
    } else {
      messages.value = []
      animatingItems.value.clear()
    }
  }

  // 獲取動畫 CSS 類
  const getAnimationClasses = (messageId: string) => {
    return {
      'message-enter': animatingItems.value.has(messageId),
      'message-enter-active': animatingItems.value.has(messageId),
      'message-fade-in': animatingItems.value.has(messageId)
    }
  }

  // 檢查是否正在更新
  const isMessageAnimating = (messageId: string) => {
    return animatingItems.value.has(messageId)
  }

  // 等待所有動畫完成
  const waitForAnimations = async () => {
    return new Promise<void>(resolve => {
      const checkAnimations = () => {
        if (animatingItems.value.size === 0) {
          resolve()
        } else {
          setTimeout(checkAnimations, 50)
        }
      }
      checkAnimations()
    })
  }

  // 清理
  onUnmounted(() => {
    if (updateTimer) {
      clearTimeout(updateTimer)
      updateTimer = null
    }
    if (animationFrameId) {
      globalThis.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    animatingItems.value.clear()
  })

  return {
    // 狀態
    messages: displayMessages,
    isUpdating,
    
    // 方法
    updateMessages,
    addMessages,
    removeMessages,
    setMessagesImmediate,
    clearMessages,
    
    // 工具方法
    getAnimationClasses,
    isMessageAnimating,
    waitForAnimations,
    
    // 狀態檢查
    hasMessages: computed(() => messages.value.length > 0),
    messageCount: computed(() => messages.value.length)
  }
}

// CSS 動畫類的導出（用於組件樣式）
export const SMOOTH_LOADING_CLASSES = {
  messageEnter: 'message-enter',
  messageEnterActive: 'message-enter-active',
  messageFadeIn: 'message-fade-in',
  messageLeave: 'message-leave',
  messageLeaveActive: 'message-leave-active',
  messageFadeOut: 'message-fade-out'
} as const