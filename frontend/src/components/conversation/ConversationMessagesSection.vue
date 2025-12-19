<template>
  <div class="conversation-messages-section">
    <!-- 消息搜索組件 -->
    <MessageSearch
      v-if="enableSearch"
      :messages="messages"
      @search-results="handleSearchResults"
    />

    <!-- 虛擬滾動消息列表 -->
    <VirtualMessageList
      ref="messageListRef"
      :messages="messages"
      :displayed-messages="displayedMessages"
      :is-search-active="isSearchActive"
      :search-term="searchTerm"
      :loading="loading"
      :has-more="hasMore"
      :is-updating="isUpdating"
      :animation-classes="animationClasses"
      :show-date-separators="showDateSeparators"
      @search-clear="handleClearSearch"
      @message-copy="$emit('message-copy', $event)"
      @message-reply="$emit('message-reply', $event)"
      @message-forward="$emit('message-forward', $event)"
      @message-recall="$emit('message-recall', $event)"
      @retry="$emit('retry-message', $event)"
      @load-more="$emit('load-more')"
      @scroll="handleScroll"
      @new-message-while-scrolled="$emit('new-message-while-scrolled')"
    />

    <!-- 空狀態提示 -->
    <div
      v-if="showEmptyState"
      class="empty-state"
    >
      <div class="empty-icon">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div class="empty-text">
        <h3>{{ emptyStateTitle }}</h3>
        <p>{{ emptyStateMessage }}</p>
      </div>
    </div>

    <!-- 骨架屏加載狀態 -->
    <div
      v-if="showSkeleton"
      class="skeleton-container"
    >
      <div
        v-for="i in skeletonCount"
        :key="`skeleton-${i}`"
        class="skeleton-message"
        :class="{ 'skeleton-right': i % 2 === 0 }"
      >
        <div class="skeleton-avatar" />
        <div class="skeleton-content">
          <div class="skeleton-line skeleton-line-short" />
          <div class="skeleton-line skeleton-line-long" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ConversationMessagesSection - 對話消息區域組件
 *
 * 這是一個容器組件，整合消息顯示相關的所有功能：
 * - MessageSearch: 消息搜索功能
 * - VirtualMessageList: 虛擬滾動消息列表
 * - EmptyState: 空狀態提示
 * - Skeleton: 骨架屏加載
 *
 * 使用示例：
 * <ConversationMessagesSection
 *   :messages="messages"
 *   :displayed-messages="displayedMessages"
 *   :loading="loading"
 *   :has-more="hasMore"
 *   @message-copy="handleCopy"
 *   @message-reply="handleReply"
 *   @load-more="loadMoreMessages"
 * />
 */

import { ref, computed } from 'vue'
import MessageSearch from './MessageSearch.vue'
import VirtualMessageList from './VirtualMessageList.vue'
import type { Message } from '@/types'

// ===== Props =====
const props = withDefaults(
  defineProps<{
    /** 消息列表 */
    messages: Message[]
    /** 顯示的消息列表（搜索結果或平滑加載） */
    displayedMessages?: Message[]
    /** 是否正在加載 */
    loading?: boolean
    /** 是否還有更多消息 */
    hasMore?: boolean
    /** 是否正在更新 */
    isUpdating?: boolean
    /** 動畫類名映射 */
    animationClasses?: Record<string, string>
    /** 是否顯示日期分隔符 */
    showDateSeparators?: boolean
    /** 是否啟用搜索功能 */
    enableSearch?: boolean
    /** 骨架屏數量 */
    skeletonCount?: number
    /** 空狀態標題 */
    emptyStateTitle?: string
    /** 空狀態訊息 */
    emptyStateMessage?: string
  }>(),
  {
    displayedMessages: undefined,
    loading: false,
    hasMore: false,
    isUpdating: false,
    animationClasses: () => ({}),
    showDateSeparators: true,
    enableSearch: true,
    skeletonCount: 5,
    emptyStateTitle: '還沒有消息',
    emptyStateMessage: '開始對話，發送第一條消息吧！'
  }
)

// ===== Emits =====
const emit = defineEmits<{
  /** 消息複製 */
  'message-copy': [message: Message]
  /** 消息回覆 */
  'message-reply': [message: Message]
  /** 消息轉發 */
  'message-forward': [message: Message]
  /** 消息撤回 */
  'message-recall': [message: Message]
  /** 重試失敗消息 */
  'retry-message': [messageId: string]
  /** 加載更多消息 */
  'load-more': []
  /** 滾動事件 */
  scroll: [scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }]
  /** 有新消息但用戶不在底部 */
  'new-message-while-scrolled': []
  /** 搜索結果變化 */
  'search-results': [results: Message[]]
  /** 清除搜索 */
  'clear-search': []
}>()

// ===== Refs =====
const messageListRef = ref<InstanceType<typeof VirtualMessageList> | null>(null)

// ===== State =====
const isSearchActive = ref(false)
const searchTerm = ref('')
const searchResults = ref<Message[]>([])

// ===== Computed =====

/**
 * 是否顯示空狀態
 */
const showEmptyState = computed(() => {
  return !props.loading && props.messages.length === 0
})

/**
 * 是否顯示骨架屏
 */
const showSkeleton = computed(() => {
  return props.loading && props.messages.length === 0
})

// ===== Methods =====

/**
 * 處理搜索結果
 */
function handleSearchResults(results: Message[]) {
  isSearchActive.value = results.length > 0
  searchResults.value = results
  emit('search-results', results)
}

/**
 * 處理清除搜索
 */
function handleClearSearch() {
  isSearchActive.value = false
  searchTerm.value = ''
  searchResults.value = []
  emit('clear-search')
}

/**
 * 處理滾動事件
 */
function handleScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  emit('scroll', scrollInfo)
}

/**
 * 暴露滾動到底部方法
 */
function scrollToBottom() {
  messageListRef.value?.scrollToBottom()
}

/**
 * 暴露滾動到指定消息方法
 */
function scrollToMessage(messageId: string) {
  messageListRef.value?.scrollToMessage(messageId)
}

// ===== Expose =====
defineExpose({
  scrollToBottom,
  scrollToMessage
})
</script>

<style scoped>
.conversation-messages-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f9fafb;
}

/* 空狀態 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  margin-bottom: 24px;
  color: #d1d5db;
}

.empty-text h3 {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px;
}

.empty-text p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* 骨架屏 */
.skeleton-container {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-message {
  display: flex;
  gap: 12px;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-right {
  flex-direction: row-reverse;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  max-width: 60%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
}

.skeleton-line-short {
  width: 40%;
}

.skeleton-line-long {
  width: 80%;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .empty-state {
    padding: 32px 16px;
  }

  .empty-icon svg {
    width: 48px;
    height: 48px;
  }

  .empty-text h3 {
    font-size: 16px;
  }

  .empty-text p {
    font-size: 13px;
  }

  .skeleton-container {
    padding: 16px;
    gap: 12px;
  }

  .skeleton-avatar {
    width: 32px;
    height: 32px;
  }

  .skeleton-content {
    max-width: 70%;
  }
}
</style>
