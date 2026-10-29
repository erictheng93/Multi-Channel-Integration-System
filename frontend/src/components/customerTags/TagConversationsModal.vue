<template>
  <Teleport
    to="body"
    :disabled="inline"
  >
    <div
      v-if="visible"
      class="modal-overlay"
      :class="{ 'is-inline': inline }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-conversations-modal-title"
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
            <h2
              id="tag-conversations-modal-title"
              class="modal-title"
            >
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
              role="listitem"
            >
              <router-link
                :to="`/conversations/${conversation.id}`"
                class="conversation-item"
                @click="$emit('update:visible', false)"
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
                    <span class="assigned-at">客戶標記於 {{ formatDate(conversation.assigned_at) }}</span>
                  </div>
                </div>

                <!-- Arrow Icon -->
                <span class="view-arrow">
                  <ExternalLinkIcon />
                </span>
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
import { ref, watch, onUnmounted } from 'vue'
import { LoadingSpinner } from '@/components/ui'
import { XIcon, MessageCircleIcon, ExternalLinkIcon } from '@/components/icons'
import { getTagConversations } from '@/api/tags'
import type { Tag } from '@/types/tag'
import type { TagConversation } from '@/api/tags'
import { getConversationStatusLabel, type ConversationStatus } from '@/constants/conversation-status'

// ==================== Props & Emits ====================

const props = defineProps<{
  visible: boolean
  tag: Tag | null
  /** Render in place as a side panel (no overlay, no scroll lock) */
  inline?: boolean
}>()

const emit = defineEmits<{
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
  },
  // Inline panel is mounted already open, so it must load on mount
  { immediate: props.inline }
)

// Handle Escape key and body scroll lock
watch(
  () => props.visible,
  (visible) => {
    if (visible && !props.inline) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeydown)
    }
  }
)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('update:visible', false)
  }
}

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
})

// ==================== Helpers ====================

function statusLabel(status: string): string {
  return getConversationStatusLabel(status as ConversationStatus)
}

function platformLabel(platform: string): string {
  return platform === 'line' ? 'LINE' : platform === 'facebook' ? 'Facebook' : platform
}

function formatDate(dateStr: string): string {
  if (!dateStr) { return '' }
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) { return dateStr }
    return `${d.getMonth() + 1}/${d.getDate()}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.4);
}

.modal-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  max-height: 80dvh;
  background: var(--ui-surface);
  border-radius: var(--ui-r-card);
  box-shadow: var(--ui-shadow-raised);
  overflow: hidden;
}

/* Inline: the sticky side panel next to the tag grid */
.modal-overlay.is-inline {
  position: sticky;
  inset: auto;
  top: 16px;
  z-index: auto;
  display: block;
  padding: 0;
  background: none;
}

.is-inline .modal-container {
  max-width: none;
  max-height: calc(100vh - 96px);
  max-height: calc(100dvh - 96px);
  box-shadow: var(--ui-shadow-card);
}

.modal-header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px 12px;
}

.modal-title-area {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  min-width: 0;
}

.tag-color-dot {
  flex: none;
  width: 10px;
  height: 10px;
  align-self: center;
  border-radius: 50%;
}

.modal-title {
  margin: 0;
  font: 600 20px var(--ui-font-display);
  letter-spacing: -0.02em;
  color: var(--ui-ink);
}

.conversation-count-badge {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.close-btn {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.close-btn:hover {
  background: var(--ui-fill-strong);
}

.close-btn svg {
  width: 15px;
  height: 15px;
}

.is-inline .close-btn {
  display: none;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 8px;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 44px 24px;
  font-size: 13.5px;
  color: var(--ui-muted);
  text-align: center;
}

.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--ui-faint);
}

.conversation-list {
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
}

.conversation-list > li + li .conversation-item::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 72px;
  height: 0.5px;
  background: var(--ui-sep);
}

.conversation-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px;
  color: inherit;
  text-decoration: none;
  transition: background var(--ui-dur) var(--ui-ease);
}

.conversation-item:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.avatar {
  display: grid;
  flex: none;
  width: 38px;
  height: 38px;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--ui-fill-strong);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
  text-transform: uppercase;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.customer-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ui-muted);
}

.platform-badge::after {
  content: ' ·';
}

.status-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 22px;
  margin-left: auto;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ui-ink-2);
  white-space: nowrap;
}

.status-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-active {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.status-pending {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.status-closed {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.view-arrow {
  display: none;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px 8px;
  font-size: 12.5px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.pagination-info {
  order: -1;
  margin-right: auto;
}

.pagination-btn {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink);
  cursor: pointer;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal-container {
    max-width: none;
    border-radius: var(--ui-r-card) var(--ui-r-card) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .pagination-btn {
    height: 44px;
  }
}
</style>
