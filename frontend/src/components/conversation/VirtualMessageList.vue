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
      :class="{ updating: isUpdating }"
    >
      <VirtualList
        ref="virtualListRef"
        :data="virtualItems"
        :options="virtualOptions"
        :item-size="estimateSize"
        :overscan="5"
        @scroll="handleVirtualScroll"
      >
        <template #default="{ item, index, style }">
          <div
            :style="style"
            :class="{
              'virtual-item': true,
              'date-separator-item': item.type === 'date',
              'message-item': item.type === 'message'
            }"
          >
            <!-- Date Separator -->
            <DateSeparator
              v-if="item.type === 'date'"
              :date="item.data"
            />

            <!-- Message with v-memo optimization -->
            <MessageBubble
              v-else-if="item.type === 'message'"
              v-memo="[item.data.id, item.data.content, item.data.status, item.data.updatedAt]"
              :key="item.data.id"
              :class="animationClasses[item.data.id]"
              :message="item.data"
              :delivered="true"
              @copy="$emit('messageCopy', $event)"
              @reply="$emit('messageReply', $event)"
              @forward="$emit('messageForward', $event)"
              @recall="$emit('messageRecall', $event)"
              @select="$emit('messageSelect', $event)"
            />

            <!-- Typing Indicator -->
            <div
              v-else-if="item.type === 'typing'"
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
        </template>
      </VirtualList>
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
import { ref, computed, watch, nextTick, onMounted, shallowRef } from 'vue'
import { VirtualList } from '@tanstack/vue-virtual'
import type { Message } from '@/types'
import MessageBubble from './MessageBubble.vue'
import DateSeparator from './DateSeparator.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'

// Props
interface Props {
  messages: Message[]
  isSearchActive?: boolean
  displayedMessages: Message[]
  loadingHistory?: boolean
  isUpdating?: boolean
  isTyping?: boolean
  animationClasses?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  isSearchActive: false,
  loadingHistory: false,
  isUpdating: false,
  isTyping: false,
  animationClasses: () => ({})
})

// Emits
const emit = defineEmits<{
  messageCopy: [message: Message]
  messageReply: [message: Message] 
  messageForward: [message: Message]
  messageRecall: [message: Message]
  messageSelect: [message: Message]
  searchClear: []
  loadMore: []
  scroll: [event: Event]
}>()

// Refs
const listContainer = ref<HTMLElement>()
const virtualListRef = ref()

// Virtual scrolling setup
const virtualOptions = {
  overscan: 5,
  estimateSize: () => 80, // Estimated item height
  scrollMargin: listContainer,
  lanes: 1
}

// Performance optimized refs
const cachedGroupedMessages = shallowRef<Array<{ date: string; messages: Message[] }>>([])
const lastGroupingTimestamp = ref(0)

// Virtual list items - optimized for performance
interface VirtualItem {
  id: string
  type: 'date' | 'message' | 'typing'
  data: any
  size?: number
}

const virtualItems = computed<VirtualItem[]>(() => {
  const items: VirtualItem[] = []
  
  if (props.isSearchActive) {
    // Search results: no date grouping, direct message list
    props.displayedMessages.forEach(message => {
      items.push({
        id: `msg-${message.id}`,
        type: 'message',
        data: message,
        size: estimateMessageSize(message)
      })
    })
  } else {
    // Normal view: use cached grouped messages
    const groupedMessages = getOptimizedGroupedMessages()
    
    groupedMessages.forEach(group => {
      // Add date separator
      items.push({
        id: `date-${group.date}`,
        type: 'date', 
        data: group.date,
        size: 60 // Date separator height
      })
      
      // Add messages in group
      group.messages.forEach(message => {
        items.push({
          id: `msg-${message.id}`,
          type: 'message',
          data: message,
          size: estimateMessageSize(message)
        })
      })
    })
  }
  
  // Add typing indicator if needed
  if (props.isTyping) {
    items.push({
      id: 'typing-indicator',
      type: 'typing',
      data: null,
      size: 80
    })
  }
  
  return items
})

// Optimized message grouping with caching
const getOptimizedGroupedMessages = () => {
  const messagesTimestamp = props.messages.length > 0 ? 
    Math.max(...props.messages.map(m => new Date(m.updatedAt || m.createdAt).getTime())) : 0
  
  // Use cached result if messages haven't changed
  if (messagesTimestamp <= lastGroupingTimestamp.value && cachedGroupedMessages.value.length > 0) {
    return cachedGroupedMessages.value
  }
  
  // Recalculate grouping
  const groups: Array<{ date: string; messages: Message[] }> = []
  let currentGroup: { date: string; messages: Message[] } | null = null
  
  props.messages.forEach(message => {
    const messageDate = getMessageDate(message)
    const dateKey = formatDateKey(messageDate)
    
    if (!currentGroup || currentGroup.date !== dateKey) {
      currentGroup = {
        date: dateKey,
        messages: []
      }
      groups.push(currentGroup)
    }
    
    currentGroup.messages.push(message)
  })
  
  // Update cache
  cachedGroupedMessages.value = groups
  lastGroupingTimestamp.value = messagesTimestamp
  
  return groups
}

// Estimate item size for virtual scrolling
const estimateSize = (index: number) => {
  const item = virtualItems.value[index]
  if (!item) return 80
  
  return item.size || estimateMessageSize(item.data)
}

const estimateMessageSize = (message: Message) => {
  if (!message) return 80
  
  // Base size
  let size = 60
  
  // Add size based on content length
  const contentLength = message.content?.length || 0
  size += Math.ceil(contentLength / 50) * 20 // ~20px per line
  
  // Add size for media
  if (message.messageType === 'image') {
    size += 200
  } else if (message.messageType === 'file') {
    size += 80
  }
  
  return Math.min(Math.max(size, 60), 400) // Min 60px, max 400px
}

// Helper functions
const getMessageDate = (message: Message): Date => {
  const timestamp = message.timestamp || message.createdAt || new Date()
  return typeof timestamp === 'number' ? new Date(timestamp) : 
         typeof timestamp === 'string' ? new Date(timestamp) : timestamp
}

const formatDateKey = (date: Date): string => {
  return date.toDateString()
}

// Virtual scroll event handling
const handleVirtualScroll = (event: Event) => {
  emit('scroll', event)
  
  // Check if need to load more messages
  const target = event.target as HTMLElement
  if (target.scrollTop < 200) {
    emit('loadMore')
  }
}

// Scroll to bottom method
const scrollToBottom = () => {
  if (virtualListRef.value) {
    const itemCount = virtualItems.value.length
    if (itemCount > 0) {
      virtualListRef.value.scrollToIndex(itemCount - 1, { align: 'end' })
    }
  }
}

// Scroll to message method
const scrollToMessage = (messageId: string) => {
  const index = virtualItems.value.findIndex(item => 
    item.type === 'message' && item.data.id === messageId
  )
  
  if (index >= 0 && virtualListRef.value) {
    virtualListRef.value.scrollToIndex(index, { align: 'center' })
  }
}

// Expose methods for parent component
defineExpose({
  scrollToBottom,
  scrollToMessage,
  virtualListRef
})

// Watch for message changes and auto-scroll if needed
let previousMessageCount = ref(0)

watch(() => props.messages.length, (newCount, oldCount) => {
  if (newCount > oldCount && oldCount > 0) {
    // New messages added, scroll to bottom after DOM update
    nextTick(() => {
      scrollToBottom()
    })
  }
  previousMessageCount.value = newCount
}, { immediate: true })

// Performance: Clear cache when messages change significantly  
watch(() => props.messages, () => {
  // Reset cache if message array reference changed
  lastGroupingTimestamp.value = 0
}, { flush: 'sync' })

onMounted(() => {
  // Initial scroll to bottom
  nextTick(() => {
    scrollToBottom()
  })
})
</script>

<style scoped>
.virtual-message-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--blue-50);
  border: 1px solid var(--blue-200);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: 0.875rem;
  color: var(--blue-700);
  flex-shrink: 0;
}

.clear-search-btn {
  padding: var(--space-1) var(--space-2);
  background: var(--blue-100);
  border: 1px solid var(--blue-300);
  border-radius: var(--radius-sm);
  color: var(--blue-600);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-search-btn:hover {
  background: var(--blue-200);
  border-color: var(--blue-400);
}

.virtual-container {
  flex: 1;
  min-height: 0;
  position: relative;
}

.virtual-container.updating {
  opacity: 0.9;
  transition: opacity 0.2s ease;
}

.virtual-item {
  padding: 0 var(--space-4);
}

.date-separator-item {
  padding: var(--space-2) 0;
}

.message-item {
  padding: var(--space-2) 0;
}

.history-loading-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(
    180deg, 
    rgba(248, 250, 252, 0.95) 0%,
    rgba(248, 250, 252, 0.8) 50%,
    transparent 100%
  );
  backdrop-filter: blur(4px);
}

.history-loading-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255, 255, 255, 0.9);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 200px;
  padding: var(--space-3) var(--space-4);
  background-color: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
  margin: var(--space-2) 0;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background-color: var(--gray-400);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

.typing-text {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-style: italic;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .virtual-item {
    padding: 0 var(--space-2);
  }
  
  .history-loading-content {
    padding: var(--space-2) var(--space-3);
    gap: var(--space-2);
  }
}
</style>