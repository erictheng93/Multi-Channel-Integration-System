<template>
  <div class="main-card conversations-card">
    <div class="card-header">
      <div class="card-title-group">
        <h2 class="card-title">
          {{ title }}
        </h2>
        <p class="card-subtitle">
          {{ subtitle }}
        </p>
      </div>
      <router-link
        v-if="showViewAllLink"
        to="/conversations"
        class="view-all-link"
      >
        查看全部
      </router-link>
    </div>
    <div class="card-body">
      <HamsterLoader
        v-if="loading"
        :message="loadingMessage"
      />
      <EmptyState
        v-else-if="conversations.length === 0"
        :title="emptyTitle"
        :description="emptyDescription"
      >
        <template #actions>
          <button
            class="btn btn-primary"
            @click="handleRefresh"
          >
            {{ refreshButtonText }}
          </button>
        </template>
      </EmptyState>
      <div
        v-else
        class="conversation-list"
      >
        <ConversationCard
          v-for="conversation in conversations"
          :key="conversation.id"
          :conversation="conversation"
          @select="handleSelect"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConversationCard from '@/components/conversation/ConversationCard.vue'
import type { Conversation } from '@/types'

export interface RecentConversationsCardProps {
  /**
   * 卡片标题
   * @default '最近對話'
   */
  title?: string

  /**
   * 卡片副标题
   * @default '最新的客戶互動記錄'
   */
  subtitle?: string

  /**
   * 对话列表
   */
  conversations: Conversation[]

  /**
   * 加载状态
   */
  loading?: boolean

  /**
   * 加载消息
   * @default '載入中...'
   */
  loadingMessage?: string

  /**
   * 空状态标题
   * @default '暫無對話記錄'
   */
  emptyTitle?: string

  /**
   * 空状态描述
   * @default '當有新的客戶對話時，會顯示在這裡'
   */
  emptyDescription?: string

  /**
   * 刷新按钮文本
   * @default '刷新數據'
   */
  refreshButtonText?: string

  /**
   * 是否显示"查看全部"链接
   * @default true
   */
  showViewAllLink?: boolean
}

withDefaults(defineProps<RecentConversationsCardProps>(), {
  title: '最近對話',
  subtitle: '最新的客戶互動記錄',
  loading: false,
  loadingMessage: '載入中...',
  emptyTitle: '暫無對話記錄',
  emptyDescription: '當有新的客戶對話時，會顯示在這裡',
  refreshButtonText: '刷新數據',
  showViewAllLink: true
})

const emit = defineEmits<{
  /**
   * 选择对话事件
   */
  select: [conversation: Conversation]

  /**
   * 刷新事件
   */
  refresh: []
}>()

/**
 * 处理对话选择
 */
const handleSelect = (conversation: Conversation) => {
  emit('select', conversation)
}

/**
 * 处理刷新
 */
const handleRefresh = () => {
  emit('refresh')
}
</script>

<style scoped>
.main-card {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.card-header {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title-group {
  flex: 1;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--gray-600);
}

.view-all-link {
  color: var(--primary-600);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.view-all-link:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

.card-body {
  padding: var(--space-6);
  min-height: 200px;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

</style>
