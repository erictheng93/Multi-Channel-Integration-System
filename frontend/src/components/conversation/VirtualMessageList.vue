<template>
  <div
    ref="scrollContainer"
    class="virtual-message-list"
  >
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

    <!-- Loading indicator -->
    <div
      v-if="loading"
      class="loading-indicator"
    >
      載入中...
    </div>

    <!-- Load more trigger -->
    <div
      v-if="hasMore && !loading"
      ref="loadTrigger"
      class="load-more-trigger"
      @click="$emit('loadMore')"
    >
      載入更多訊息
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

defineEmits<{
  loadMore: []
}>()

// Refs
const scrollContainer = ref<HTMLElement>()
const listContainer = ref<HTMLElement>()
const loadTrigger = ref<HTMLElement>()

// Virtual scrolling constants
const ITEM_HEIGHT = 80 // Approximate message height
const BUFFER_SIZE = 5 // Items to render outside viewport
const CONTAINER_HEIGHT = 600 // Default container height

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
  }
}

const updateContainerHeight = () => {
  if (scrollContainer.value) {
    containerHeight.value = scrollContainer.value.clientHeight
  }
}

// Track if this is the first load to prevent flash of old messages
const isFirstLoad = ref(true)

const scrollToBottom = () => {
  if (scrollContainer.value) {
    const targetScrollTop = scrollContainer.value.scrollHeight - scrollContainer.value.clientHeight
    scrollContainer.value.scrollTop = targetScrollTop
    console.log(`📜 [VirtualMessageList] Scrolled to bottom: scrollTop=${targetScrollTop}, scrollHeight=${scrollContainer.value.scrollHeight}`)
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

// 🔥 CRITICAL FIX: Watch messages and scroll to bottom immediately on first load
// This prevents the flash of old messages before auto-scrolling
watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength > 0) {
    if (isFirstLoad.value) {
      // 🔥 On first load, use multiple RAFs to ensure complete rendering
      console.log('🎯 [VirtualMessageList] First load detected, preparing to scroll...')

      nextTick(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              // Triple RAF to absolutely ensure DOM is ready
              scrollToBottom()
              isFirstLoad.value = false
              console.log('✅ [VirtualMessageList] First load: scrolled to bottom')
            })
          })
        })
      })
    } else if (newLength > oldLength) {
      // New messages added, scroll to show them
      nextTick(() => {
        scrollToBottom()
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
}

.virtual-content {
  position: relative;
}

.message-item {
  padding: 0.5rem 0;
}

.loading-indicator {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
}

.load-more-trigger {
  text-align: center;
  padding: 1rem;
  cursor: pointer;
  color: var(--primary-color);
  border-top: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.load-more-trigger:hover {
  background-color: var(--hover-color);
}
</style>