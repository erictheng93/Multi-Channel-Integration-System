<!-- eslint-disable no-unused-vars -->
<template>
  <div
    ref="containerRef"
    class="smart-virtual-scroll-container"
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
        :ref="el => setItemRef(el, startIndex + index)"
        :key="getItemKey ? getItemKey(item, startIndex + index) : startIndex + index"
        class="virtual-item"
        :class="[itemClass, { 'item-entering': enteringItems.has(startIndex + index) }]"
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
    
    <!-- 預載入指示器 -->
    <div
      v-if="isPreloading"
      class="preload-indicator"
    >
      <div class="preload-shimmer" />
      <span class="preload-text">智能預載入中...</span>
    </div>
    
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
import { ref, computed, onMounted, onUnmounted, nextTick, watch, type ComponentPublicInstance } from 'vue'

interface Props {
  // 數據相關
  items: T[]
  itemHeight?: number
  estimatedItemHeight?: number
  containerHeight?: number
  overscan?: number
  
  // 功能開關
  dynamicHeight?: boolean
  horizontal?: boolean
  
  // 回調函數
  getItemKey?: (_item: T, _index: number) => string | number
  onScroll?: (_scrollTop: number, _scrollLeft: number) => void
  onReachBottom?: () => Promise<void> | void
  onReachTop?: () => Promise<void> | void
  onVisibleRangeChange?: (_startIndex: number, _endIndex: number) => void
  
  // 樣式相關
  itemClass?: string | string[] | Record<string, boolean>
  
  // 載入狀態
  loadingMore?: boolean
  reachedEnd?: boolean
  
  // 性能配置
  throttleDelay?: number
  preloadPages?: number
  
  // 新增：智能預載入配置
  enableSmartPreload?: boolean
  predictiveLoadThreshold?: number
  intersectionThreshold?: number
  rootMargin?: string
}

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
  enableSmartPreload: true,
  predictiveLoadThreshold: 0.8,
  intersectionThreshold: 0.5,
  rootMargin: '200px',
  getItemKey: (_item: T, index: number) => index,
  onScroll: () => {},
  onReachBottom: () => {},
  onReachTop: () => {},
  onVisibleRangeChange: () => {},
  itemClass: ''
})

const emit = defineEmits<{
  scroll: [scrollTop: number, scrollLeft: number]
  reachBottom: []
  reachTop: []
  visibleRangeChange: [startIndex: number, endIndex: number]
  predictiveLoad: [direction: 'up' | 'down', estimatedDistance: number]
}>()

// 引用
const containerRef = ref<HTMLElement>()
const listRef = ref<HTMLElement>()
const itemRefs = new Map<number, HTMLElement>()

// 狀態
const scrollTop = ref(0)
const scrollLeft = ref(0)
const containerRect = ref({ width: 0, height: 0 })
const itemHeights = ref<number[]>([])
const enteringItems = ref(new Set<number>())
const isPreloading = ref(false)

// Intersection Observer
let intersectionObserver: globalThis.IntersectionObserver | null = null
let preloadObserver: globalThis.IntersectionObserver | null = null

// 性能監控
const performanceStats = ref({
  renderTime: 0,
  scrollFPS: 0,
  visibleItemCount: 0,
  predictiveHits: 0
})

// 節流函數
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

// 計算可見範圍
const visibleRange = computed(() => {
  const totalItems = props.items.length
  if (totalItems === 0) {
    return { startIndex: 0, endIndex: 0 }
  }

  const containerHeight = containerRect.value.height || props.containerHeight
  const itemHeight = props.itemHeight
  
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

// 設置項目引用
const setItemRef = (el: globalThis.Element | ComponentPublicInstance | null, index: number) => {
  if (el) {
    itemRefs.set(index, el as HTMLElement)
  } else {
    itemRefs.delete(index)
  }
}

// 設置 Intersection Observer
const setupIntersectionObserver = () => {
  if (!props.enableSmartPreload || !containerRef.value) {return}

  // 主要觀察器 - 用於項目可見性檢測
  intersectionObserver = new globalThis.IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const index = parseInt((entry.target as HTMLElement).dataset.index || '0')
        
        if (entry.isIntersecting) {
          // 項目變為可見時的處理
          handleItemVisible(index, entry)
        }
      })
    },
    {
      root: containerRef.value,
      rootMargin: props.rootMargin,
      threshold: [0, props.intersectionThreshold, 1]
    }
  )

  // 預載入觀察器 - 用於預測性載入
  if (props.enableSmartPreload) {
    preloadObserver = new globalThis.IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            handlePreloadTrigger(entry)
          }
        })
      },
      {
        root: containerRef.value,
        rootMargin: '400px', // 更大的邊距用於預載入
        threshold: 0
      }
    )
  }
}

// 處理項目可見
const handleItemVisible = (index: number, entry: globalThis.IntersectionObserverEntry) => {
  const ratio = entry.intersectionRatio
  
  // 預測性載入邏輯
  if (ratio > props.predictiveLoadThreshold) {
    const direction = index > props.items.length / 2 ? 'down' : 'up'
    const distanceFromEdge = direction === 'down' 
      ? props.items.length - index 
      : index
    
    if (distanceFromEdge < props.preloadPages * 10) { // 假設每頁10項
      emit('predictiveLoad', direction, distanceFromEdge)
      performanceStats.value.predictiveHits++
    }
  }
}

// 處理預載入觸發
const handlePreloadTrigger = (entry: globalThis.IntersectionObserverEntry) => {
  const target = entry.target as HTMLElement
  const index = parseInt(target.dataset.index || '0')
  
  // 判斷是否接近邊界
  const nearTop = index < props.overscan * 2
  const nearBottom = index > props.items.length - props.overscan * 2
  
  if (nearBottom && !props.reachedEnd && !props.loadingMore) {
    isPreloading.value = true
    emit('reachBottom')
  } else if (nearTop) {
    emit('reachTop')
  }
}

// 滾動處理（節流）
const handleScroll = throttle((event: Event) => {
  const target = event.target as HTMLElement
  const newScrollTop = target.scrollTop
  const newScrollLeft = target.scrollLeft
  
  scrollTop.value = newScrollTop
  scrollLeft.value = newScrollLeft
  
  emit('scroll', newScrollTop, newScrollLeft)
  props.onScroll?.(newScrollTop, newScrollLeft)
  
  updateScrollFPS()
}, props.throttleDelay)

// 更新滾動幀率
let lastScrollTime = 0
let scrollFrameCount = 0
const updateScrollFPS = () => {
  scrollFrameCount++
  const now = Date.now()
  const timeDiff = now - lastScrollTime
  
  if (timeDiff >= 1000) {
    performanceStats.value.scrollFPS = Math.round(scrollFrameCount / (timeDiff / 1000))
    scrollFrameCount = 0
    lastScrollTime = now
  }
}

// 監控可見範圍變化
watch(visibleRange, (newRange, oldRange) => {
  if (newRange.startIndex !== oldRange?.startIndex || 
      newRange.endIndex !== oldRange?.endIndex) {
    
    emit('visibleRangeChange', newRange.startIndex, newRange.endIndex)
    props.onVisibleRangeChange?.(newRange.startIndex, newRange.endIndex)
    
    performanceStats.value.visibleItemCount = newRange.endIndex - newRange.startIndex + 1
    
    // 更新 Intersection Observer 觀察的元素
    nextTick(() => {
      updateObservedElements()
    })
  }
}, { immediate: true })

// 更新被觀察的元素
const updateObservedElements = () => {
  if (!intersectionObserver || !preloadObserver) {return}

  // 清除舊的觀察
  intersectionObserver.disconnect()
  preloadObserver.disconnect()

  // 觀察當前可見的元素
  itemRefs.forEach((element, index) => {
    if (index >= startIndex.value && index <= endIndex.value && intersectionObserver && preloadObserver) {
      intersectionObserver.observe(element)
      preloadObserver.observe(element)
    }
  })
}

// 處理項目進入動畫
const handleItemEnter = (index: number) => {
  enteringItems.value.add(index)
  setTimeout(() => {
    enteringItems.value.delete(index)
  }, 300) // 動畫持續時間
}

// 項目變化時的處理
watch(() => props.items.length, (newLength, oldLength) => {
  if (newLength > oldLength) {
    // 新增了項目，觸發進入動畫
    const startNewIndex = oldLength
    const endNewIndex = newLength - 1
    
    for (let i = startNewIndex; i <= endNewIndex; i++) {
      handleItemEnter(i)
    }
  }
  
  nextTick(() => {
    updateObservedElements()
    if (props.dynamicHeight) {
      measureItemHeights()
    }
  })
})

// 動態高度測量
const measureItemHeights = async () => {
  if (!props.dynamicHeight || !listRef.value) {return}
  
  await nextTick()
  
  const items = listRef.value.querySelectorAll('.virtual-item')
  items.forEach((item, relativeIndex) => {
    const actualIndex = startIndex.value + relativeIndex
    const height = item.getBoundingClientRect().height
    
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
}

// 獲取性能統計
const getPerformanceStats = () => ({
  ...performanceStats.value,
  totalItems: props.items.length,
  visibleRange: visibleRange.value,
  memoryUsage: itemHeights.value.length,
  observedElements: itemRefs.size
})

// 清理預載入狀態
watch(() => props.loadingMore, (newValue) => {
  if (!newValue) {
    isPreloading.value = false
  }
})

// 生命週期
onMounted(() => {
  initializeContainer()
  setupIntersectionObserver()
  
  if (props.dynamicHeight) {
    nextTick(() => {
      measureItemHeights()
    })
  }

  // 監聽窗口大小變化
  const handleResize = () => {
    initializeContainer()
    nextTick(() => updateObservedElements())
  }
  
  window.addEventListener('resize', handleResize)
  
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    intersectionObserver?.disconnect()
    preloadObserver?.disconnect()
  })
})

onUnmounted(() => {
  intersectionObserver?.disconnect()
  preloadObserver?.disconnect()
})

// 暴露方法
defineExpose({
  scrollToItem,
  getPerformanceStats,
  itemRefs: () => itemRefs,
  refreshObserver: updateObservedElements
})
</script>

<style scoped>
.smart-virtual-scroll-container {
  overflow: auto;
  contain: strict;
  will-change: scroll-position;
  position: relative;
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.virtual-item.item-entering {
  animation: slideInFromRight 0.3s ease-out;
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.preload-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #3b82f6, transparent);
  z-index: 10;
}

.preload-shimmer {
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.preload-text {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 8px;
  border-radius: 12px;
  z-index: 11;
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
.smart-virtual-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.smart-virtual-scroll-container::-webkit-scrollbar-track {
  background: var(--gray-100);
  border-radius: 4px;
}

.smart-virtual-scroll-container::-webkit-scrollbar-thumb {
  background: var(--gray-400);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.smart-virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--gray-500);
  transform: scaleX(1.2);
}

/* 減少動畫偏好 */
@media (prefers-reduced-motion: reduce) {
  .virtual-item,
  .virtual-item.item-entering,
  .preload-shimmer {
    animation: none !important;
    transition: none !important;
  }
}

/* 性能優化 */
.virtual-item {
  transform: translateZ(0);
  backface-visibility: hidden;
}
</style>