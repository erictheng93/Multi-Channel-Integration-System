<template>
  <div class="virtual-message-list">
    <!-- Search Results Header -->
    <div
      v-if="isSearchActive"
      class="search-results-header"
    >
      <span>搜索結果 ({{ displayedMessages.length }})</span>
      <button
        class="clear-search-btn"
        @click="$emit('searchClear')"
      >
        清除搜索
      </button>
    </div>

    <!-- Virtual List Container -->
    <div
      ref="listContainer"
      class="virtual-container"
      :class="{ updating: props.isUpdating }"
      :style="{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative'
      }"
    >
      <div
        v-for="virtualItem in virtualizer.getVirtualItems()"
        :key="String(virtualItem.key)"
        class="virtual-item"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualItem.size}px`,
          transform: `translateY(${virtualItem.start}px)`
        }"
      >
        <div
          :class="{
            'date-separator-item': virtualItems[virtualItem.index]?.type === 'date',
            'message-item': virtualItems[virtualItem.index]?.type === 'message'
          }"
        >
          <!-- Date Separator -->
          <DateSeparator
            v-if="virtualItems[virtualItem.index]?.type === 'date'"
            :date="virtualItems[virtualItem.index]?.data as Date"
          />

          <!-- Message with v-memo optimization -->
          <MessageBubble
            v-else-if="virtualItems[virtualItem.index]?.type === 'message'"
            :key="(virtualItems[virtualItem.index]?.data as Message).id"
            :class="props.animationClasses?.[(virtualItems[virtualItem.index]?.data as Message).id] || ''"
            :message="virtualItems[virtualItem.index]?.data as Message"
            :delivered="true"
            @copy="$emit('messageCopy', $event)"
            @reply="$emit('messageReply', $event)"
            @forward="$emit('messageForward', $event)"
            @recall="$emit('messageRecall', $event)"
            @select="$emit('messageSelect', $event)"
          />

          <!-- Typing Indicator -->
          <div
            v-else-if="virtualItems[virtualItem.index]?.type === 'typing'"
            class="typing-indicator"
          >
            <div class="typing-dots">
              <span />
              <span />
              <span />
            </div>
            <span class="typing-text">對方正在輸入...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading States -->
    <div
      v-if="loadingHistory && messages.length > 0"
      class="history-loading-wrapper"
    >
      <div class="history-loading-content">
        <HamsterLoader message="載入更多歷史訊息..." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { Message } from '@/types'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import DateSeparator from '@/components/conversation/DateSeparator.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'

interface VirtualItem {
  type: 'message' | 'date' | 'typing'
  data: Message | Date
  id: string
}


interface Props {
  messages: Message[]
  displayedMessages?: Message[]
  loadingHistory?: boolean
  showDateSeparators?: boolean
  isSearchActive?: boolean
  isUpdating?: boolean
  isTyping?: boolean
  searchTerm?: string
  enableAnimations?: boolean
  scrollBehavior?: 'auto' | 'smooth'
  animationClasses?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  displayedMessages: undefined,
  loadingHistory: false,
  showDateSeparators: true,
  isSearchActive: false,
  isUpdating: false,
  isTyping: false,
  searchTerm: '',
  enableAnimations: true,
  scrollBehavior: 'smooth',
  animationClasses: () => ({})
})

defineEmits<{
  messageCopy: [message: Message]
  messageReply: [message: Message] 
  messageForward: [message: Message]
  messageRecall: [message: Message]
  messageSelect: [message: Message]
  searchClear: []
  loadMore: []
  scroll: [scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }]
  scrollToTop: []
  scrollToBottom: []
}>()

// Refs
const listContainer = ref<HTMLElement>()

// Computed
const displayedMessages = computed(() => {
  // Use provided displayedMessages if available, otherwise use messages
  if (props.displayedMessages) {
    return props.displayedMessages
  }
  
  if (props.isSearchActive && props.searchTerm) {
    return props.messages.filter(msg => 
      msg.content.toLowerCase().includes(props.searchTerm.toLowerCase())
    )
  }
  return props.messages
})

const virtualItems = computed<VirtualItem[]>(() => {
  const items: VirtualItem[] = []
  
  if (props.showDateSeparators) {
    let currentDate = ''
    
    displayedMessages.value.forEach((message) => {
      const messageDate = new Date(message.createdAt).toDateString()
      
      if (messageDate !== currentDate) {
        currentDate = messageDate
        items.push({
          type: 'date',
          data: new Date(message.createdAt),
          id: `date-${messageDate}`
        })
      }
      
      items.push({
        type: 'message',
        data: message,
        id: `message-${message.id}`
      })
    })
  } else {
    displayedMessages.value.forEach((message) => {
      items.push({
        type: 'message',
        data: message,
        id: `message-${message.id}`
      })
    })
  }
  
  return items
})

// Virtualizer setup
const virtualizer = useVirtualizer({
  get count() { return virtualItems.value.length },
  getScrollElement: () => listContainer.value || null,
  estimateSize: () => 80,
  overscan: 5,
})

// Methods
const scrollToMessage = (messageId: string) => {
  const index = virtualItems.value.findIndex(item => 
    item.type === 'message' && (item.data as Message).id === messageId
  )
  
  if (index >= 0) {
    virtualizer.value.scrollToIndex(index, { 
      align: 'center'
    })
  }
}

const scrollToTop = () => {
  virtualizer.value.scrollToIndex(0, { 
    align: 'start'
  })
}

const scrollToBottom = () => {
  const lastIndex = virtualItems.value.length - 1
  if (lastIndex >= 0) {
    virtualizer.value.scrollToIndex(lastIndex, { 
      align: 'end'
    })
  }
}

// Animation handling  
const addMessageAnimation = () => {
  // Animation classes are handled by the parent component
  // This component just uses them via props
}

// Watchers
watch(() => props.messages.length, (newCount, oldCount) => {
  if (oldCount && newCount > oldCount) {
    nextTick(() => {
      addMessageAnimation()
      
      if (!props.isSearchActive) {
        scrollToBottom()
      }
    })
  }
})

// Lifecycle
onMounted(() => {
  nextTick(() => {
    if (!props.isSearchActive && displayedMessages.value.length > 0) {
      scrollToBottom()
    }
  })
})

// Expose methods
defineExpose({
  scrollToMessage,
  scrollToTop,
  scrollToBottom
})
</script>

<style scoped>
.virtual-message-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-results-header {
  padding: var(--space-3);
  background: var(--blue-50);
  border-bottom: 1px solid var(--blue-200);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-search-btn {
  background: var(--blue-500);
  color: white;
  border: none;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.875rem;
}

.clear-search-btn:hover {
  background: var(--blue-600);
}

.virtual-container {
  flex: 1;
  overflow: auto;
  position: relative;
  contain: layout style paint;
}

.virtual-container.updating {
  pointer-events: none;
}

.virtual-item {
  contain: layout style paint;
  will-change: transform;
}

.date-separator-item {
  display: flex;
  justify-content: center;
  padding: var(--space-2) 0;
}

.message-item {
  padding: 0 var(--space-3);
  display: flex;
  flex-direction: column;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: var(--gray-500);
  font-style: italic;
}

.typing-dots {
  display: flex;
  gap: var(--space-1);
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--gray-400);
  border-radius: 50%;
  animation: typing-pulse 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-pulse {
  0%, 60%, 100% {
    transform: initial;
    opacity: 0.5;
  }
  30% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* Message animations */
.message-enter {
  opacity: 0;
  transform: translateY(20px);
}

.message-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.history-loading-wrapper {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--background);
}

.history-loading-content {
  display: flex;
  justify-content: center;
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--gray-200);
}

/* Responsive design */
@media (max-width: 768px) {
  .message-item {
    padding: 0 var(--space-2);
  }
}

/* Performance optimizations */
@media (prefers-reduced-motion: reduce) {
  .message-enter,
  .message-enter-active {
    transition: none;
  }
  
  .typing-dots span {
    animation: none;
  }
}
</style>