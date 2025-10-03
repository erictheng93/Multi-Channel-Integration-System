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

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
}

// Lifecycle
onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
    updateContainerHeight()

    // Scroll to bottom initially
    nextTick(() => {
      scrollToBottom()
    })
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

// Watch for new messages and scroll to bottom
watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength > oldLength) {
    nextTick(() => {
      scrollToBottom()
    })
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