<template>
  <div
    ref="scrollContainer"
    class="virtual-message-list"
    @scroll="handleScroll"
  >
    <!-- Load more trigger at TOP (for loading older messages) -->
    <div
      v-if="hasMore && !loading"
      ref="loadTrigger"
      class="load-more-trigger load-more-top"
      @click="handleLoadMore"
    >
      <div class="load-more-content">
        <span class="load-more-icon">↑</span>
        <span>載入更早的訊息</span>
      </div>
    </div>

    <!-- Loading indicator at TOP -->
    <div
      v-if="loading"
      class="loading-indicator loading-top"
    >
      <span class="loading-spinner">⏳</span>
      <span>載入中...</span>
    </div>

    <!-- Simple Virtual Content -->
    <div
      ref="listContainer"
      class="virtual-content"
      :style="{ height: `${totalHeight}px`, position: 'relative' }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="message-item"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${item.top}px)`
        }"
      >
        <MessageBubble
          :message="item.message"
          :is-loading="false"
          :show-avatar="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import MessageBubble from './MessageBubble.vue'
import type { Message } from '@/types'

interface Props {
  messages: Message[]
  loading?: boolean
  hasMore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasMore: false
})

// Refs
const scrollContainer = ref<HTMLElement>()
const listContainer = ref<HTMLElement>()
const loadTrigger = ref<HTMLElement>()

// 🚀 Dynamic Virtual Scrolling Configuration
// 根據設備和內容動態調整參數以優化性能
const BASE_ITEM_HEIGHT = 80 // 基礎消息高度
const CONTAINER_HEIGHT = 600 // Default container height

// 🎯 動態計算最佳 ITEM_HEIGHT（基於實際渲染）
const getOptimalItemHeight = () => {
  // 可以基於屏幕尺寸、消息複雜度動態調整
  const screenHeight = window.innerHeight
  if (screenHeight > 1080) {return BASE_ITEM_HEIGHT * 1.2} // 大屏幕
  if (screenHeight < 720) {return BASE_ITEM_HEIGHT * 0.8}  // 小屏幕
  return BASE_ITEM_HEIGHT
}

// 🎯 動態計算最佳 BUFFER_SIZE（基於視口大小）
const getOptimalBufferSize = () => {
  const screenHeight = window.innerHeight
  const itemsInViewport = Math.ceil(screenHeight / BASE_ITEM_HEIGHT)
  // 緩衝區為視口項目數的 50%，至少 3 個，最多 10 個
  return Math.max(3, Math.min(10, Math.floor(itemsInViewport * 0.5)))
}

const ITEM_HEIGHT = getOptimalItemHeight()
const BUFFER_SIZE = getOptimalBufferSize()

console.log(`🚀 [VirtualScrolling] Optimized params:`, {
  ITEM_HEIGHT,
  BUFFER_SIZE,
  screenHeight: window.innerHeight,
  itemsInViewport: Math.ceil(window.innerHeight / ITEM_HEIGHT)
})

// State
const scrollTop = ref(0)
const containerHeight = ref(CONTAINER_HEIGHT)

// Computed properties
const totalHeight = computed(() => props.messages.length * ITEM_HEIGHT)

const visibleRange = computed(() => {
  // 🔥 On first load, force show bottom items to prevent flash of old messages
  if (isFirstLoad.value && props.messages.length > 0 && scrollTop.value === 0) {
    // Calculate range to show last items
    const itemsToShow = Math.ceil(containerHeight.value / ITEM_HEIGHT) + BUFFER_SIZE
    const start = Math.max(0, props.messages.length - itemsToShow)
    const end = props.messages.length
    console.log(`🎯 [visibleRange] First load: showing bottom items ${start} to ${end}`)
    return { start, end }
  }

  const start = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - BUFFER_SIZE)
  const end = Math.min(
    props.messages.length,
    Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT) + BUFFER_SIZE
  )
  return { start, end }
})

const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  return props.messages.slice(start, end).map((message, index) => ({
    id: message.id,
    message,
    top: (start + index) * ITEM_HEIGHT
  }))
})

// Methods
const handleScroll = () => {
  if (scrollContainer.value) {
    scrollTop.value = scrollContainer.value.scrollTop

    // 🎯 自動觸發加載更多：當滾動到頂部附近時（距離頂部 < 100px）
    if (props.hasMore && !props.loading && scrollTop.value < 100) {
      console.log('📜 [VirtualMessageList] Near top, auto-loading more messages...')
      handleLoadMore()
    }
  }
}

const updateContainerHeight = () => {
  if (scrollContainer.value) {
    containerHeight.value = scrollContainer.value.clientHeight
  }
}

// 🔼 處理加載更多（加載更早的消息）
const emit = defineEmits<{
  loadMore: []
}>()

const handleLoadMore = () => {
  if (props.loading || !props.hasMore) {
    console.log('⚠️ [VirtualMessageList] Cannot load more:', { loading: props.loading, hasMore: props.hasMore })
    return
  }

  // 記錄當前滾動高度，用於加載後恢復位置
  const currentScrollHeight = scrollContainer.value?.scrollHeight || 0

  console.log('🔼 [VirtualMessageList] Loading more messages...', { currentScrollHeight })

  // 發出 loadMore 事件
  emit('loadMore')

  // 加載完成後恢復滾動位置（防止跳動）
  nextTick(() => {
    if (scrollContainer.value) {
      const newScrollHeight = scrollContainer.value.scrollHeight
      const heightDifference = newScrollHeight - currentScrollHeight

      if (heightDifference > 0) {
        scrollContainer.value.scrollTop += heightDifference
        console.log('✅ [VirtualMessageList] Scroll position restored', { heightDifference })
      }
    }
  })
}

// Track if this is the first load to prevent flash of old messages
const isFirstLoad = ref(true)

const scrollToBottom = (smooth = false) => {
  if (scrollContainer.value) {
    const targetScrollTop = scrollContainer.value.scrollHeight - scrollContainer.value.clientHeight

    if (smooth) {
      // 🎨 平滑滾動動畫
      scrollContainer.value.style.scrollBehavior = 'smooth'
      scrollContainer.value.scrollTop = targetScrollTop

      // 恢復為 auto，避免影響用戶手動滾動
      setTimeout(() => {
        if (scrollContainer.value) {
          scrollContainer.value.style.scrollBehavior = 'auto'
        }
      }, 500)
    } else {
      scrollContainer.value.style.scrollBehavior = 'auto'
      scrollContainer.value.scrollTop = targetScrollTop
    }

    console.log(`📜 [VirtualMessageList] Scrolled to bottom: scrollTop=${targetScrollTop}, ${smooth ? 'smooth' : 'instant'}`)
  }
}

// Lifecycle
onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
    updateContainerHeight()

    // 🔥 CRITICAL: Set initial scrollTop to bottom BEFORE rendering
    // This prevents visibleRange from calculating based on scrollTop=0
    if (props.messages.length > 0) {
      const maxScrollTop = scrollContainer.value.scrollHeight - scrollContainer.value.clientHeight
      scrollContainer.value.scrollTop = maxScrollTop
      scrollTop.value = maxScrollTop
      console.log(`🎯 [VirtualMessageList] Initial scrollTop set to ${maxScrollTop}`)
    }
  }

  // Resize observer for container height
  const resizeObserver = new (window as { ResizeObserver: new (_callback: () => void) => { observe: (_element: HTMLElement) => void; disconnect: () => void } }).ResizeObserver(() => {
    updateContainerHeight()
  })

  if (scrollContainer.value) {
    resizeObserver.observe(scrollContainer.value)
  }

  onUnmounted(() => {
    if (scrollContainer.value) {
      scrollContainer.value.removeEventListener('scroll', handleScroll)
    }
    resizeObserver.disconnect()
  })
})

// 🔥 CRITICAL FIX: Watch messages and scroll to bottom with smooth animation
// This prevents the flash of old messages before auto-scrolling
watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength > 0) {
    if (isFirstLoad.value) {
      // 🔥 On first load, instant scroll without animation
      console.log('🎯 [VirtualMessageList] First load detected, preparing to scroll...')

      nextTick(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              // Triple RAF to absolutely ensure DOM is ready
              scrollToBottom(false) // Instant scroll on first load
              isFirstLoad.value = false
              console.log('✅ [VirtualMessageList] First load: scrolled to bottom')
            })
          })
        })
      })
    } else if (newLength > oldLength) {
      // 🎨 New messages added, smooth scroll to show them
      nextTick(() => {
        scrollToBottom(true) // Smooth scroll for new messages
      })
    }
  }
})

// Expose scrollToBottom method to parent component
defineExpose({
  scrollToBottom
})
</script>

<style scoped>
.virtual-message-list {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  /* 🎨 平滑滾動 - 由 JS 動態控制 */
  scroll-behavior: auto;
}

.virtual-content {
  position: relative;
}

.message-item {
  padding: 0.5rem 0;
  /* 🎨 消息淡入動畫 */
  animation: message-fade-in 0.3s ease-out;
  transform-origin: top;
}

/* 🎨 消息淡入動畫關鍵幀 */
@keyframes message-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 🔼 載入指示器（頂部） */
.loading-indicator {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
}

.loading-top {
  position: sticky;
  top: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
  backdrop-filter: blur(8px);
  z-index: 10;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 🔼 載入更多按鈕（頂部） */
.load-more-trigger {
  text-align: center;
  padding: 1rem;
  cursor: pointer;
  color: var(--primary-color);
  transition: all 0.2s;
}

.load-more-top {
  position: sticky;
  top: 0;
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.02));
  backdrop-filter: blur(4px);
  z-index: 10;
  border-bottom: 2px solid var(--primary-color);
  margin-bottom: 0.5rem;
}

.load-more-top:hover {
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
  border-bottom-color: var(--primary-color);
}

.load-more-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
}

.load-more-icon {
  font-size: 1.2rem;
  animation: bounce-up 1.5s ease-in-out infinite;
}

@keyframes bounce-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>