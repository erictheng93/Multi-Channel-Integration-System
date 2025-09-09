// 簡化高性能載入 Composable - 專注於性能而非複雜動畫
import { shallowRef, computed, onUnmounted } from 'vue'
import type { Message } from '@/types'

interface SmoothLoadingOptions {
  /** 動畫持續時間（毫秒） */
  animationDuration?: number
  /** 是否啟用簡單動畫 */
  enableAnimations?: boolean
  /** 防抖延遲（毫秒） */
  debounceDelay?: number
}

const DEFAULT_OPTIONS: Required<SmoothLoadingOptions> = {
  animationDuration: 200,
  enableAnimations: false, // 默認關閉動畫提高性能
  debounceDelay: 50
}

export function useSmoothLoading(options: SmoothLoadingOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  // 使用 shallowRef 大幅優化大數組性能
  const messages = shallowRef<Message[]>([])
  const isUpdating = shallowRef(false)
  const animatingItems = shallowRef(new Set<string>())
  
  // 簡化的防抖更新
  let updateTimer: NodeJS.Timeout | null = null
  let animationTimer: NodeJS.Timeout | null = null

  // 高性能消息更新
  const performUpdate = (newMessages: Message[], animate = false) => {
    if (animate && config.enableAnimations) {
      // 標記新消息進行簡單動畫
      const existingIds = new Set(messages.value.map(m => m.id))
      const newItems = newMessages.filter(msg => !existingIds.has(msg.id))
      
      if (newItems.length > 0) {
        isUpdating.value = true
        newItems.forEach(msg => animatingItems.value.add(msg.id))
      }
    }
    
    // 直接替換數組引用，觸發 shallowRef 更新
    messages.value = [...newMessages]
    
    if (animate && config.enableAnimations) {
      // 簡單的動畫清理
      if (animationTimer) {clearTimeout(animationTimer)}
      
      animationTimer = setTimeout(() => {
        animatingItems.value.clear()
        isUpdating.value = false
      }, config.animationDuration)
    }
  }

  // 簡化的消息更新 - 移除複雜的批次處理
  const updateMessages = (newMessages: Message[], animate = false) => {
    // 防抖更新以避免頻繁重渲染
    if (updateTimer) {
      clearTimeout(updateTimer)
    }
    
    updateTimer = setTimeout(() => {
      performUpdate(newMessages, animate)
    }, config.debounceDelay)
  }

  // 立即更新（無動畫，無防抖） - 用於初始載入
  const setMessagesImmediate = (newMessages: Message[]) => {
    if (updateTimer) {
      clearTimeout(updateTimer)
      updateTimer = null
    }
    if (animationTimer) {
      clearTimeout(animationTimer) 
      animationTimer = null
    }
    
    // 清理動畫狀態
    animatingItems.value.clear()
    isUpdating.value = false
    
    // 直接設置消息
    messages.value = [...newMessages]
  }

  // 添加新消息到末尾（高性能）
  const addMessages = (newMessages: Message[], animate = false) => {
    if (newMessages.length === 0) {return}
    
    const combined = [...messages.value, ...newMessages]
    updateMessages(combined, animate)
  }

  // 清空消息
  const clearMessages = () => {
    setMessagesImmediate([])
  }

  // 簡化的動畫類獲取
  const getAnimationClasses = (messageId: string) => {
    if (!config.enableAnimations) {return {}}
    
    return {
      'message-fade-in': animatingItems.value.has(messageId)
    }
  }

  // 檢查是否正在更新
  const isMessageAnimating = (messageId: string) => {
    return config.enableAnimations && animatingItems.value.has(messageId)
  }

  // 按時間排序消息（使用緩存優化）
  let lastSortedMessages: Message[] = []
  let lastSortedTimestamp = 0
  
  const sortMessagesByTime = (messagesToSort: Message[]): Message[] => {
    // 簡單的緩存檢查
    const currentTimestamp = messagesToSort.length > 0 ? 
      new Date(messagesToSort[messagesToSort.length - 1]?.createdAt || 0).getTime() : 0
    
    if (messagesToSort === lastSortedMessages && currentTimestamp === lastSortedTimestamp) {
      return lastSortedMessages
    }
    
    const sorted = [...messagesToSort].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    
    lastSortedMessages = sorted
    lastSortedTimestamp = currentTimestamp
    
    return sorted
  }

  // 清理函數
  onUnmounted(() => {
    if (updateTimer) {
      clearTimeout(updateTimer)
      updateTimer = null
    }
    if (animationTimer) {
      clearTimeout(animationTimer)
      animationTimer = null
    }
    animatingItems.value.clear()
  })

  return {
    // 狀態 - 使用原始 shallowRef 以獲得最佳性能
    messages: computed(() => messages.value),
    isUpdating: computed(() => isUpdating.value),
    
    // 高性能方法
    updateMessages,
    addMessages,
    setMessagesImmediate,
    clearMessages,
    sortMessagesByTime,
    
    // 動畫工具（可選）
    getAnimationClasses,
    isMessageAnimating,
    
    // 狀態檢查
    hasMessages: computed(() => messages.value.length > 0),
    messageCount: computed(() => messages.value.length)
  }
}

// 簡化的 CSS 動畫類
export const SMOOTH_LOADING_CLASSES = {
  messageFadeIn: 'message-fade-in'
} as const