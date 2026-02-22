<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="`標籤「${tag?.name}」的對話列表`"
      @click.self="$emit('update:visible', false)"
    >
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-title-area">
            <span
              class="tag-color-dot"
              :style="{ background: tag?.color }"
            />
            <h2 class="modal-title">
              {{ tag?.name }}
            </h2>
            <span class="conversation-count-badge">
              {{ pagination.total }} 個對話
            </span>
          </div>
          <button
            class="close-btn"
            aria-label="關閉"
            @click="$emit('update:visible', false)"
          >
            <XIcon />
          </button>
        </div>

        <!-- Content -->
        <div class="modal-body">
          <!-- Loading -->
          <div
            v-if="loading"
            class="state-container"
          >
            <LoadingSpinner size="lg" />
            <p>載入對話中...</p>
          </div>

          <!-- Empty -->
          <div
            v-else-if="conversations.length === 0"
            class="state-container"
          >
            <MessageCircleIcon class="empty-icon" />
            <p>此標籤尚未被應用到任何對話</p>
          </div>

          <!-- Conversation List -->
          <ul
            v-else
            class="conversation-list"
            role="list"
          >
            <li
              v-for="conversation in conversations"
              :key="conversation.id"
              class="conversation-item"
              role="listitem"
            >
              <!-- Avatar -->
              <div class="avatar">
                <img
                  v-if="conversation.customer_avatar"
                  :src="conversation.customer_avatar"
                  :alt="conversation.customer_name"
                  class="avatar-img"
                >
                <span
                  v-else
                  class="avatar-fallback"
                >
                  {{ conversation.customer_name?.charAt(0) || '?' }}
                </span>
              </div>

              <!-- Conversation Info -->
              <div class="conversation-info">
                <div class="conversation-top">
                  <span class="customer-name">{{ conversation.customer_name }}</span>
                  <span
                    class="status-badge"
                    :class="`status-${conversation.status}`"
                  >
                    {{ statusLabel(conversation.status) }}
                  </span>
                </div>
                <div class="conversation-meta">
                  <span class="platform-badge">{{ platformLabel(conversation.customer_platform) }}</span>
                  <span class="assigned-at">標記於 {{ formatDate(conversation.assigned_at) }}</span>
                </div>
              </div>

              <!-- Action -->
              <router-link
                :to="`/conversations/${conversation.id}`"
                class="view-link"
                title="前往對話"
                @click="$emit('update:visible', false)"
              >
                <ExternalLinkIcon />
              </router-link>
            </li>
          </ul>

          <!-- Pagination -->
          <div
            v-if="pagination.totalPages > 1"
            class="pagination"
          >
            <button
              class="pagination-btn"
              :disabled="pagination.page <= 1"
              @click="loadPage(pagination.page - 1)"
            >
              上一頁
            </button>
            <span class="pagination-info">
              第 {{ pagination.page }} / {{ pagination.totalPages }} 頁
            </span>
            <button
              class="pagination-btn"
              :disabled="pagination.page >= pagination.totalPages"
              @click="loadPage(pagination.page + 1)"
            >
              下一頁
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoadingSpinner } from '@/components/ui'
import { XIcon, MessageCircleIcon, ExternalLinkIcon } from '@/components/icons'
import { getTagConversations } from '@/api/tags'
import type { Tag } from '@/types/tag'
import type { TagConversation } from '@/api/tags'

// ==================== Props & Emits ====================

const props = defineProps<{
  visible: boolean
  tag: Tag | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

// ==================== State ====================

const loading = ref(false)
const conversations = ref<TagConversation[]>([])
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })

// ==================== Data Loading ====================

async function loadPage(page: number) {
  if (!props.tag) { return }
  loading.value = true
  try {
    const res = await getTagConversations(props.tag.id, { page, limit: 20 })
    conversations.value = res.data.conversations
    pagination.value = res.data.pagination
  } catch {
    conversations.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.visible, props.tag?.id] as const,
  ([visible]) => {
    if (visible && props.tag) {
      conversations.value = []
      pagination.value = { page: 1, limit: 20, total: 0, totalPages: 0 }
      loadPage(1)
    }
  }
)

// ==================== Helpers ====================

function statusLabel(status: string): string {
  return status === 'active' ? '進行中' : status === 'closed' ? '已關閉' : status
}

function platformLabel(platform: string): string {
  return platform === 'line' ? 'LINE' : platform === 'facebook' ? 'Facebook' : platform
}

function formatDate(dateStr: string): string {
  if (!dateStr) { return '' }
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal-container {
  background: white;
  border-radius: var(--radius-2xl);
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-100);
  flex-shrink: 0;
}

.modal-title-area {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tag-color-dot {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.conversation-count-badge {
  font-size: 0.75rem;
  color: var(--gray-500);
  background: var(--gray-100);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--gray-600);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.close-btn svg {
  width: 16px;
  height: 16px;
}

.modal-body {
  overflow-y: auto;
  flex: 1;
  padding: var(--space-4) var(--space-6);
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-12) 0;
  color: var(--gray-500);
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--gray-300);
}

.conversation-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-100);
  transition: background var(--transition-fast);
}

.conversation-item:hover {
  background: var(--gray-50);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-600);
  text-transform: uppercase;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.customer-name {
  font-weight: 500;
  color: var(--gray-900);
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  font-size: 0.6875rem;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-weight: 500;
  flex-shrink: 0;
}

.status-active {
  background: var(--green-100);
  color: var(--green-700);
}

.status-closed {
  background: var(--gray-100);
  color: var(--gray-600);
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.platform-badge {
  background: var(--blue-50);
  color: var(--blue-600);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: 0.6875rem;
}

.view-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--gray-400);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.view-link:hover {
  background: var(--primary-50);
  color: var(--primary-600);
}

.view-link svg {
  width: 16px;
  height: 16px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--gray-100);
}

.pagination-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--gray-700);
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--gray-500);
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: var(--space-2);
  }

  .modal-body {
    padding: var(--space-3) var(--space-4);
  }
}
</style>
