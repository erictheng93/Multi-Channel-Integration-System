<!-- eslint-disable no-unused-vars -->
<template>
  <div
    ref="containerRef"
    class="virtual-scroll-container"
    :style="{ height: containerHeight + 'px' }"
    @scroll="handleScroll"
  >
    <!-- 上方緩衝區 -->
    <div
      class="virtual-spacer"
      :style="{ height: offsetY + 'px' }"
    />
    
    <!-- 可見項目渲染區 -->
    <div
      ref="listRef"
      class="virtual-list"
    >
      <div
        v-for="(item, index) in visibleItems"
        :key="getItemKey ? getItemKey(item, startIndex + index) : startIndex + index"
        class="virtual-item"
        :class="itemClass"
        :data-index="startIndex + index"
      >
        <slot
          :item="item"
          :index="startIndex + index"
          :is-visible="true"
        />
      </div>
    </div>
    
    <!-- 下方緩衝區 -->
    <div
      class="virtual-spacer"
      :style="{ height: bottomSpacerHeight + 'px' }"
    />
    
    <!-- 載入更多指示器 -->
    <div
      v-if="loadingMore"
      class="loading-more-indicator"
    >
      <slot name="loading">
        <div class="loading-spinner">
          <div class="spinner-icon" />
          <span>載入更多...</span>
        </div>
      </slot>
    </div>
    
    <!-- 到達底部指示器 -->
    <div
      v-if="reachedEnd && !loadingMore"
      class="end-indicator"
    >
      <slot name="end">
        <div class="end-message">
          已顯示全部內容
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { createLogger } from '@/utils/logger'

const props = withDefaults(defineProps<Props>(), {
  itemHeight: 80,
  estimatedItemHeight: 80,
  containerHeight: 400,
  overscan: 5,
  dynamicHeight: false,
  horizontal: false,
  loadingMore: false,
  reachedEnd: false,
  throttleDelay: 16,
  preloadPages: 2,
  getItemKey: (_item: T, index: number) => index,
  onScroll: () => {},
  onReachBottom: () => {},
  onReachTop: () => {},
  itemClass: ''
})
const emit = defineEmits<{
  scroll: [scrollTop: number, scrollLeft: number]
  reachBottom: []
  reachTop: []
  visibleRangeChange: [startIndex: number, endIndex: number]
}>()
const frontendLogger = createLogger('VirtualScrollList')
// 原生實現 throttle 和 debounce
const throttle = <T extends (..._args: Parameters<T>) => ReturnType<T>>(
  func: T, 
  limit: number = 16
): ((..._args: Parameters<T>) => void) => {
  let inThrottle: boolean = false
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

const debounce = <T extends (..._args: Parameters<T>) => ReturnType<T>>(
  func: T, 
  delay: number = 1000
): ((..._args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | undefined
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

interface Props {
  // 數據相關
  items: T[]
  itemHeight?: number // 固定高度模式
  estimatedItemHeight?: number // 動態高度模式的估計值
  containerHeight?: number // 容器高度
  overscan?: number // 預渲染項目數量
  
  // 功能開關
  dynamicHeight?: boolean // 是否支持動態高度
  horizontal?: boolean // 水平滾動（未實現）
  
  // 回調函數
  getItemKey?: (_item: T, _index: number) => string | number
  onScroll?: (_scrollTop: number, _scrollLeft: number) => void
  onReachBottom?: () => Promise<void> | void
  onReachTop?: () => Promise<void> | void
  
  // 樣式相關
  itemClass?: string | string[] | Record<string, boolean>
  
  // 載入狀態
  loadingMore?: boolean
  reachedEnd?: boolean
  
  // 性能配置
  throttleDelay?: number
  preloadPages?: number // 預載入頁數
}

// 引用
const containerRef = ref<HTMLElement>()
const listRef = ref<HTMLElement>()

// 狀態
const scrollTop = ref(0)
const scrollLeft = ref(0)
const containerRect = ref({ width: 0, height: 0 })
const itemHeights = ref<number[]>([]) // 動態高度緩存

// 性能監控
const performanceStats = ref({
  renderTime: 0,
  scrollFPS: 0,
  visibleItemCount: 0
})

// 計算可見範圍
const visibleRange = computed(() => {
  const totalItems = props.items.length
  if (totalItems === 0) {
    return { startIndex: 0, endIndex: 0 }
  }

  const containerHeight = containerRect.value.height || props.containerHeight
  const itemHeight = props.itemHeight
  
  // 計算可見區域的開始和結束索引
  const startIndex = Math.max(0, Math.floor(scrollTop.value / itemHeight) - props.overscan)
  const visibleItemCount = Math.ceil(containerHeight / itemHeight)
  const endIndex = Math.min(
    totalItems - 1,
    startIndex + visibleItemCount + props.overscan * 2
  )

  return { startIndex, endIndex }
})

const startIndex = computed(() => visibleRange.value.startIndex)
const endIndex = computed(() => visibleRange.value.endIndex)

// 計算偏移量
const offsetY = computed(() => {
  if (props.dynamicHeight && itemHeights.value.length > 0) {
    return itemHeights.value.slice(0, startIndex.value).reduce((sum, height) => sum + height, 0)
  }
  return startIndex.value * props.itemHeight
})

// 計算底部間距
const bottomSpacerHeight = computed(() => {
  const remainingItems = props.items.length - endIndex.value - 1
  if (remainingItems <= 0) {return 0}

  if (props.dynamicHeight && itemHeights.value.length > 0) {
    const remainingHeights = itemHeights.value.slice(endIndex.value + 1)
    return remainingHeights.reduce((sum, height) => sum + height, 0) + 
           Math.max(0, remainingItems - remainingHeights.length) * props.estimatedItemHeight
  }
  
  return remainingItems * props.itemHeight
})

// 可見項目
const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value + 1)
})

// 滾動處理（節流）
const handleScroll = throttle((event: Event) => {
  const target = event.target as HTMLElement
  const newScrollTop = target.scrollTop
  const newScrollLeft = target.scrollLeft
  
  scrollTop.value = newScrollTop
  scrollLeft.value = newScrollLeft
  
  // 發出滾動事件
  emit('scroll', newScrollTop, newScrollLeft)
  props.onScroll?.(newScrollTop, newScrollLeft)
  
  // 檢查是否到達底部
  const threshold = 200 // 提前200px觸發
  const isNearBottom = newScrollTop + containerRect.value.height >= 
                      target.scrollHeight - threshold
  
  if (isNearBottom && !props.loadingMore && !props.reachedEnd) {
    emit('reachBottom')
    props.onReachBottom?.()
  }
  
  // 檢查是否到達頂部
  if (newScrollTop <= threshold) {
    emit('reachTop')
    props.onReachTop?.()
  }
  
  // 性能監控
  updateScrollFPS()
}, props.throttleDelay)

// 更新滾動幀率
let lastScrollTime = 0
let scrollFrameCount = 0
const updateScrollFPS = debounce(() => {
  const now = Date.now()
  const timeDiff = now - lastScrollTime
  if (timeDiff > 0) {
    performanceStats.value.scrollFPS = Math.round(scrollFrameCount / (timeDiff / 1000))
    scrollFrameCount = 0
    lastScrollTime = now
  }
}, 1000)

// 監控可見範圍變化
watch(visibleRange, (newRange, oldRange) => {
  if (newRange.startIndex !== oldRange?.startIndex || 
      newRange.endIndex !== oldRange?.endIndex) {
    emit('visibleRangeChange', newRange.startIndex, newRange.endIndex)
    performanceStats.value.visibleItemCount = newRange.endIndex - newRange.startIndex + 1
  }
}, { immediate: true })

// 動態高度測量
const measureItemHeights = async () => {
  if (!props.dynamicHeight || !listRef.value) {return}
  
  await nextTick()
  
  const items = listRef.value.querySelectorAll('.virtual-item')
  items.forEach((item, relativeIndex) => {
    const actualIndex = startIndex.value + relativeIndex
    const height = item.getBoundingClientRect().height
    
    // 更新高度緩存
    if (itemHeights.value.length <= actualIndex) {
      itemHeights.value.length = actualIndex + 1
    }
    itemHeights.value[actualIndex] = height
  })
}

// 初始化容器尺寸
const initializeContainer = () => {
  if (!containerRef.value) {return}
  
  const rect = containerRef.value.getBoundingClientRect()
  containerRect.value = {
    width: rect.width,
    height: rect.height
  }
  
  frontendLogger.debug('[VirtualScroll] Container initialized:', containerRect.value)
}

// 滾動到指定項目
const scrollToItem = (index: number, position: 'start' | 'center' | 'end' = 'start') => {
  if (!containerRef.value || index < 0 || index >= props.items.length) {return}
  
  let targetScrollTop = index * props.itemHeight
  
  if (position === 'center') {
    targetScrollTop -= containerRect.value.height / 2
  } else if (position === 'end') {
    targetScrollTop -= containerRect.value.height - props.itemHeight
  }
  
  targetScrollTop = Math.max(0, targetScrollTop)
  containerRef.value.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  
  frontendLogger.debug(`[VirtualScroll] Scrolled to item ${index} (${position})`)
}

// 滾動到頂部
const scrollToTop = () => {
  if (containerRef.value) {
    containerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 滾動到底部
const scrollToBottom = () => {
  if (containerRef.value) {
    containerRef.value.scrollTo({ 
      top: containerRef.value.scrollHeight, 
      behavior: 'smooth' 
    })
  }
}

// 獲取性能統計
const getPerformanceStats = () => ({
  ...performanceStats.value,
  totalItems: props.items.length,
  visibleRange: visibleRange.value,
  memoryUsage: itemHeights.value.length
})

// 窗口大小變化處理
const handleResize = debounce(() => {
  initializeContainer()
}, 100)

// 生命週期
onMounted(() => {
  initializeContainer()
  window.addEventListener('resize', handleResize)
  
  // 動態高度初始測量
  if (props.dynamicHeight) {
    nextTick(() => {
      measureItemHeights()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 監聽項目變化，重新測量高度
watch(() => props.items.length, () => {
  if (props.dynamicHeight) {
    nextTick(() => {
      measureItemHeights()
    })
  }
})

// 暴露方法
defineExpose({
  scrollToItem,
  scrollToTop,
  scrollToBottom,
  getPerformanceStats
})
</script>

<style scoped>
.virtual-scroll-container {
  overflow: auto;
  contain: strict;
  /* 優化渲染性能 */
  will-change: scroll-position;
}

.virtual-spacer {
  width: 100%;
  pointer-events: none;
}

.virtual-list {
  position: relative;
}

.virtual-item {
  width: 100%;
  contain: layout style paint;
}

.loading-more-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-6);
  color: var(--gray-600);
}

.loading-spinner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.spinner-icon {
  width: 16px;
  height: 16px;
  border: 2px solid var(--gray-300);
  border-top: 2px solid var(--primary-500);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.end-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-4);
  color: var(--gray-500);
  font-size: 0.875rem;
}

.end-message {
  padding: var(--space-2) var(--space-4);
  background: var(--gray-100);
  border-radius: var(--radius-md);
}

/* 滾動條優化 */
.virtual-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.virtual-scroll-container::-webkit-scrollbar-track {
  background: var(--gray-100);
  border-radius: 3px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb {
  background: var(--gray-400);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--gray-500);
}

/* 性能優化 */
@media (prefers-reduced-motion: reduce) {
  .virtual-scroll-container {
    will-change: auto;
  }
}
</style>
