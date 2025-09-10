<template>
  <div class="virtual-message-list" ref="scrollContainer">
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

    <!-- Virtual Content Container -->
    <div
      ref="listContainer" 
      class="virtual-content"
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

          <!-- Message with v-memo optimization and smooth entrance animation -->
          <Transition
            v-else-if="virtualItems[virtualItem.index]?.type === 'message'"
            name="message"
            mode="out-in"
            appear
          >
            <MessageBubble
              :key="(virtualItems[virtualItem.index]?.data as Message).id"
              :class="[
                'message-bubble-wrapper',
                props.animationClasses?.[(virtualItems[virtualItem.index]?.data as Message).id] || '',
                { 'message-new': isNewMessage((virtualItems[virtualItem.index]?.data as Message).id) }
              ]"
              :message="virtualItems[virtualItem.index]?.data as Message"
              :delivered="true"
              @copy="$emit('messageCopy', $event)"
              @reply="$emit('messageReply', $event)"
              @forward="$emit('messageForward', $event)"
              @recall="$emit('messageRecall', $event)"
              @select="$emit('messageSelect', $event)"
            />
          </Transition>

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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
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

const emit = defineEmits<{
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
  newMessageWhileScrolled: []
}>()

// Refs
const scrollContainer = ref<HTMLElement>()
const listContainer = ref<HTMLElement>()
const newMessageIds = ref(new Set<string>())
const isUserAtBottom = ref(true)
const lastScrollTop = ref(0)
const lastLoadMoreTime = ref(0)
const LOAD_MORE_THROTTLE_MS = 1000 // Prevent too frequent load requests

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
  getScrollElement: () => scrollContainer.value || null,
  estimateSize: () => 80,
  overscan: 5,
})

// Methods
const scrollToMessage = async (messageId: string, retries = 3, delay = 100) => {
  const index = virtualItems.value.findIndex(item => 
    item.type === 'message' && (item.data as Message).id === messageId
  )
  
  if (index < 0 || !virtualizer.value) {
    return
  }
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait for virtualizer to be ready
      await nextTick()
      
      const container = virtualizer.value.scrollElement
      if (container && virtualizer.value.options.count === virtualItems.value.length) {
        virtualizer.value.scrollToIndex(index, { 
          align: 'center'
        })
        return // Success
      }
    } catch (error) {
      console.warn(`Scroll to message attempt ${attempt + 1} failed:`, error)
    }
    
    // Wait before retry
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

const scrollToTop = async (retries = 5, delay = 150) => {
  if (!virtualizer.value || virtualItems.value.length === 0) {
    return
  }
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait a tick for the virtualizer to process any pending updates
      await nextTick()
      
      // Check if virtualizer has the correct count and container element
      const container = virtualizer.value.scrollElement
      if (container && virtualizer.value.options.count === virtualItems.value.length) {
        // Use direct scroll for more reliable scrolling
        container.scrollTop = 0
        return // Success
      }
    } catch (error) {
      console.warn(`Scroll to top attempt ${attempt + 1} failed:`, error)
    }
    
    // Wait before retry with exponential backoff
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)))
    }
  }
  
  // Final fallback: try scrollToIndex with a longer timeout
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    if (virtualizer.value) {
      virtualizer.value.scrollToIndex(0, { align: 'start' })
    }
  } catch (error) {
    console.warn('Final scroll to top attempt failed:', error)
  }
}

const scrollToBottom = async (retries = 5, delay = 150) => {
  const lastIndex = virtualItems.value.length - 1
  if (lastIndex < 0 || !virtualizer.value) {
    return
  }
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait a tick for the virtualizer to process any pending updates
      await nextTick()
      
      // Check if virtualizer has the correct count and container element
      const container = virtualizer.value.scrollElement
      if (container && virtualizer.value.options.count === virtualItems.value.length) {
        // Use scrollToOffset instead of scrollToIndex for more reliable scrolling
        const totalSize = virtualizer.value.getTotalSize()
        container.scrollTop = totalSize
        return // Success
      }
    } catch (error) {
      console.warn(`Scroll to bottom attempt ${attempt + 1} failed:`, error)
    }
    
    // Wait before retry with exponential backoff
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)))
    }
  }
  
  // Final fallback: try scrollToIndex with a longer timeout
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    if (virtualizer.value) {
      virtualizer.value.scrollToIndex(lastIndex, { align: 'end' })
    }
  } catch (error) {
    console.warn('Final scroll to bottom attempt failed:', error)
  }
}

// Animation handling with smooth entrance
const isNewMessage = (messageId: string) => {
  return newMessageIds.value.has(messageId)
}

const addMessageAnimation = () => {
  // Mark new messages for animation
  const existingIds = new Set(props.messages.map(m => m.id))
  displayedMessages.value.forEach(msg => {
    if (!existingIds.has(msg.id)) {
      newMessageIds.value.add(msg.id)
      // Auto-remove after animation completes
      setTimeout(() => {
        newMessageIds.value.delete(msg.id)
      }, 500)
    }
  })
}

// Smart scroll management
const checkIfUserAtBottom = () => {
  if (!scrollContainer.value) {return true}
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
  const threshold = 100 // pixels from bottom
  return scrollHeight - scrollTop - clientHeight < threshold
}

const checkIfUserAtTop = () => {
  if (!scrollContainer.value) {return false}
  const { scrollTop } = scrollContainer.value
  const threshold = 100 // pixels from top
  return scrollTop < threshold
}

const handleScroll = () => {
  if (!scrollContainer.value) {return}
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
  
  // Update user position
  const isAtBottom = checkIfUserAtBottom()
  const isAtTop = checkIfUserAtTop()
  
  isUserAtBottom.value = isAtBottom
  lastScrollTop.value = scrollTop
  
  // Load more historical messages when scrolling near top
  if (isAtTop && !props.loadingHistory && scrollTop < lastScrollTop.value) {
    // Throttle load-more requests to prevent spam
    const now = Date.now()
    if (now - lastLoadMoreTime.value > LOAD_MORE_THROTTLE_MS) {
      console.log('📜 User scrolled to top, loading more history...')
      lastLoadMoreTime.value = now
      emit('loadMore')
    }
  }
  
  // Emit scroll event
  emit('scroll', { scrollTop, scrollHeight, clientHeight })
}

// Watchers with smart scroll behavior
watch(() => props.messages.length, async (newCount, oldCount) => {
  if (oldCount && newCount > oldCount) {
    // Check if user was at bottom before new messages
    const wasAtBottom = isUserAtBottom.value
    
    await nextTick()
    addMessageAnimation()
    
    // Wait a moment for virtualizer to update
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Only auto-scroll if user was already at bottom
    if (!props.isSearchActive && wasAtBottom) {
      await scrollToBottom()
    } else if (!wasAtBottom) {
      // Show new message notification to parent
      emit('newMessageWhileScrolled')
    }
  }
})

// Lifecycle with scroll listener
onMounted(async () => {
  await nextTick()
  
  // Wait a bit for virtualizer to initialize
  await new Promise(resolve => setTimeout(resolve, 50))
  
  if (!props.isSearchActive && displayedMessages.value.length > 0) {
    await scrollToBottom()
  }
  
  // Add scroll listener for smart scroll management
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', handleScroll)
  }
})

// Expose methods
defineExpose({
  scrollToMessage,
  scrollToTop,
  scrollToBottom
})
</script>

<style scoped>
/* Modern Minimalist Container - Now the scroll container */
.virtual-message-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(to bottom, #fafbfc 0%, #ffffff 100%);
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  
  /* Modern scrollbar */
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}

.virtual-message-list::-webkit-scrollbar {
  width: 6px;
}

.virtual-message-list::-webkit-scrollbar-track {
  background: transparent;
}

.virtual-message-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
  transition: background 0.2s;
}

.virtual-message-list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Clean Search Header */
.search-results-header {
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 10;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.clear-search-btn {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #dbeafe;
  padding: 0.375rem 1rem;
  border-radius: 2rem;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.clear-search-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

/* Smooth Scrollable Container */
/* Virtual Content Container - No longer scrollable, just content */
.virtual-content {
  position: relative;
  contain: layout style paint;
  flex-shrink: 0; /* Don't shrink this container */
}

.virtual-content.updating {
  pointer-events: none;
  opacity: 0.98;
}

/* Optimized Virtual Items */
.virtual-item {
  contain: layout style paint;
  will-change: transform;
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Elegant Date Separator */
.date-separator-item {
  display: flex;
  justify-content: center;
  padding: 1.25rem 0;
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(to bottom, 
    rgba(250, 251, 252, 0.95) 0%, 
    rgba(250, 251, 252, 0.8) 50%,
    transparent 100%);
  backdrop-filter: blur(8px);
}

/* Clean Message Item Container */
.message-item {
  padding: 0.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Modern Typing Indicator */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.5rem;
  margin: 0.5rem 1.5rem;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 1.5rem;
  width: fit-content;
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #64748b, #94a3b8);
  border-radius: 50%;
  animation: typing-pulse 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.typing-text {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 400;
  letter-spacing: 0.01em;
}

@keyframes typing-pulse {
  0%, 60%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  30% {
    transform: scale(1.3);
    opacity: 1;
  }
}

/* Smooth Message Animations */
.message-bubble-wrapper {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center;
}

/* Elegant Entrance Animations */
.message-enter-from,
.message-appear-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.message-enter-active,
.message-appear-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.message-enter-to,
.message-appear-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Subtle Leave Animation */
.message-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.message-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 1, 1);
  position: absolute;
  width: 100%;
}

.message-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* New Message Animation */
.message-new {
  animation: messageSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Smooth Loading Animation */
.message-fade-in {
  animation: smoothFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes smoothFadeIn {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Clean Loading State */
.history-loading-wrapper {
  position: sticky;
  top: 0;
  z-index: 15;
  background: linear-gradient(to bottom, 
    rgba(255, 255, 255, 0.98) 0%, 
    rgba(255, 255, 255, 0.9) 100%);
  backdrop-filter: blur(16px);
}

.history-loading-content {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 500;
}

/* Responsive Design - Mobile First */
@media (max-width: 768px) {
  .virtual-message-list {
    background: #ffffff;
  }
  
  .message-item {
    padding: 0.375rem 1rem;
  }
  
  .date-separator-item {
    padding: 1rem 0;
  }
  
  .search-results-header {
    padding: 0.875rem 1rem;
    font-size: 0.8125rem;
  }
  
  .clear-search-btn {
    padding: 0.3125rem 0.875rem;
    font-size: 0.75rem;
  }
  
  .typing-indicator {
    margin: 0.375rem 1rem;
    padding: 0.75rem 1.25rem;
  }
  
  .virtual-message-list::-webkit-scrollbar {
    width: 4px;
  }
}

/* Tablet Adjustments */
@media (min-width: 769px) and (max-width: 1024px) {
  .message-item {
    padding: 0.5rem 1.25rem;
  }
}

/* Large Screens */
@media (min-width: 1440px) {
  .message-item {
    padding: 0.625rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  
  .date-separator-item {
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }
  
  .typing-indicator {
    margin: 0.5rem 2rem;
  }
}

/* Accessibility & Performance */
@media (prefers-reduced-motion: reduce) {
  .message-enter-from,
  .message-enter-active,
  .message-appear-from,
  .message-appear-active,
  .message-leave-from,
  .message-leave-active,
  .message-bubble-wrapper,
  .message-new,
  .message-fade-in {
    animation: none !important;
    transition: opacity 0.15s ease !important;
  }
  
  .typing-dots span {
    animation: none;
    opacity: 0.6;
  }
  
  .virtual-message-list {
    scroll-behavior: auto;
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .search-results-header {
    border-bottom: 2px solid currentColor;
  }
  
  .clear-search-btn {
    border-width: 2px;
  }
  
  .typing-indicator {
    border: 1px solid currentColor;
  }
}

/* Dark Mode Support (Future Enhancement) */
@media (prefers-color-scheme: dark) {
  .virtual-message-list {
    background: linear-gradient(to bottom, #0f172a 0%, #1e293b 100%);
  }
  
  .search-results-header {
    background: rgba(15, 23, 42, 0.95);
    border-bottom-color: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
  }
  
  .typing-indicator {
    background: rgba(30, 41, 59, 0.8);
    color: #94a3b8;
  }
  
  .virtual-message-list::-webkit-scrollbar-thumb {
    background: #475569;
  }
  
  .virtual-message-list::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
}
</style>