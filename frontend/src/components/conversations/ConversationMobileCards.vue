<template>
  <div class="mobile-cards">
    <TransitionGroup
      name="conversation-card"
      appear
    >
      <div
        v-for="(conversation, index) in conversations"
        :key="conversation.id"
        class="conversation-card"
        :class="{
          'has-unread': conversation.status !== 'closed' && conversation.unreadCount > 0,
          'is-selected': selectionMode && selectedIds.has(conversation.id)
        }"
        :style="{ animationDelay: `${index * 50}ms` }"
        @click="handleCardClick(conversation.id)"
      >
        <div class="conv-card-header">
          <div class="customer-info">
            <label
              v-if="selectionMode"
              class="select-hit"
              @click.stop
            >
              <input
                type="checkbox"
                class="select-checkbox"
                :aria-label="`選取 ${getCustomerName(conversation)} 的對話`"
                :checked="selectedIds.has(conversation.id)"
                @change="$emit('toggle-select', conversation.id)"
              >
            </label>
            <span
              class="read-badge"
              :class="readBadge(conversation).cls"
              :aria-label="readBadge(conversation).aria"
            >
              {{ readBadge(conversation).text }}
            </span>
            <span
              v-if="conversation.status !== 'closed' && conversation.unreadCount > 0"
              class="sr-only"
            >
              未讀 {{ conversation.unreadCount }} 則訊息
            </span>
            <div>
              <div class="customer-name">
                {{ getCustomerName(conversation) }}
              </div>
              <div class="customer-id">
                ID: {{ conversation.userId }}
              </div>
            </div>
          </div>
          <div class="badges">
            <div
              class="platform-badge"
              :class="conversation.platform || conversation.user?.platform"
            >
              {{ getPlatformText(conversation.platform || conversation.user?.platform || 'line') }}
            </div>
            <div
              class="status-badge"
              :class="conversation.status"
            >
              {{ getStatusText(conversation.status) }}
            </div>
          </div>
        </div>
        <div class="conv-card-body">
          <div class="last-message">
            {{ getLastMessageText(conversation) }}
          </div>
        </div>
        <div class="conv-card-footer">
          <div class="assigned-agent">
            負責人: {{ getAssignedTo(conversation) }}
          </div>
          <div class="timestamp">
            {{ formatTime(getUpdatedAt(conversation)) }}
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import type { Conversation } from '@/types'
import { convertEmojiForConversationList } from '@/utils/layered-emoji-processor'

const props = withDefaults(defineProps<{
  conversations: Conversation[]
  selectionMode?: boolean
  selectedIds?: ReadonlySet<string>
}>(), {
  selectionMode: false,
  selectedIds: () => new Set<string>()
})

const emit = defineEmits<{
  select: [id: string]
  'toggle-select': [id: string]
}>()

// 選取模式下，點擊整張卡片切換選取而非導覽
const handleCardClick = (id: string) => {
  if (props.selectionMode) {
    emit('toggle-select', id)
  } else {
    emit('select', id)
  }
}

interface LegacyConversationFields {
  customer_name?: string
  updated_at?: string
}

type ConversationWithLegacyFields = Conversation & LegacyConversationFields

const withLegacyFields = (conversation: Conversation): ConversationWithLegacyFields => {
  return conversation as ConversationWithLegacyFields
}

const getCustomerName = (conversation: Conversation) => {
  const legacyConversation = withLegacyFields(conversation)
  return conversation.customer?.name || conversation.user?.name || legacyConversation.customer_name || '未知用戶'
}

const getUpdatedAt = (conversation: Conversation) => {
  const legacyConversation = withLegacyFields(conversation)
  return conversation.updatedAt || legacyConversation.updated_at
}

const getPlatformText = (platform: string) => {
  const platformMap = {
    line: 'LINE',
    facebook: 'Facebook',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp'
  }
  return platformMap[platform as keyof typeof platformMap] || platform
}

const readBadge = (conversation: Conversation) => {
  // 已結案優先：結案的對話對所有客服都算 0 未讀（新訊息會自動重新開啟）
  if (conversation.status === 'closed') {
    return { cls: 'closed', text: '結案', aria: '已結案' }
  }
  const unread = conversation.unreadCount
  if (unread > 0) {
    return { cls: 'unread', text: unread > 1 ? `未讀 ${unread}` : '未讀', aria: `未讀 ${unread} 則訊息` }
  }
  return { cls: 'read', text: '已讀', aria: '已讀' }
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    active: '進行中',
    assigned: '已指派',
    pending: '待處理',
    'in-progress': '處理中',
    waiting: '等待中',
    closed: '已結案'
  }
  return statusMap[status] || status
}

const formatTime = (date?: Date | number | string) => {
  if (!date) {
    return ''
  }
  const dateObj = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(dateObj.getTime())) {
    return ''
  }
  return dateObj.toLocaleString('zh-TW')
}

const getLastMessageText = (conversation: Conversation) => {
  const content = conversation.lastMessage?.content || '暫無訊息'
  return convertEmojiForConversationList(content)
}

const getAssignedTo = (conversation: Conversation) => {
  if (conversation.assignedTeam?.name) {
    return ` ${conversation.assignedTeam.name}`
  }
  return '未指派'
}
</script>

<style scoped>
.mobile-cards {
  display: none;
}

.conversation-card {
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  animation: slideInFromLeft var(--animation-duration, 0.4s) cubic-bezier(0.4, 0, 0.2, 1) backwards;
}

.conversation-card:hover {
  background-color: #f8f9fa;
  transform: translateX(4px);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.08),
    -4px 0 0 rgba(59, 130, 246, 0.3);
}

.conversation-card:active {
  transform: translateX(2px);
  transition-duration: 0.1s;
}

@keyframes slideInFromLeft {
  0% {
    opacity: 0;
    transform: translateX(-30px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

/* Animation duration per card */
.conversation-card:nth-child(1) { --animation-duration: 0.3s; }
.conversation-card:nth-child(2) { --animation-duration: 0.4s; }
.conversation-card:nth-child(3) { --animation-duration: 0.5s; }
.conversation-card:nth-child(4) { --animation-duration: 0.6s; }
.conversation-card:nth-child(5) { --animation-duration: 0.7s; }

.conversation-card:last-child {
  border-bottom: none;
}

/* TransitionGroup Animation */
.conversation-card-enter-active,
.conversation-card-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.conversation-card-enter-from {
  opacity: 0;
  transform: translateX(-30px) scale(0.98);
}

.conversation-card-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.98);
}

.conversation-card-move {
  transition: transform 0.3s ease;
}

.select-hit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px 0 -10px -10px;
  flex-shrink: 0;
  cursor: pointer;
}

.select-checkbox {
  width: 22px;
  height: 22px;
  accent-color: #007AFF;
  cursor: pointer;
}

.conversation-card.is-selected {
  background: #EAF3FF;
}

.conv-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.conv-card-header .customer-info {
  flex: 1;
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.customer-name {
  font-weight: 500;
  color: #333;
}

.customer-id {
  font-size: 0.85rem;
  color: #666;
}

.read-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.read-badge.unread {
  background: #FF3B30;
  color: #FFFFFF;
}

.read-badge.read {
  background: #F2F2F7;
  color: #8E8E93;
  font-weight: 500;
}

/* 已結案：同尺寸但更淡，不搶注意力 */
.read-badge.closed {
  background: #F7F7FA;
  color: #C7C7CC;
  font-weight: 500;
}

.conversation-card.has-unread {
  background: #F8FAFF;
}

.conversation-card.has-unread .customer-name {
  font-weight: 700;
  color: #1C1C1E;
}

.conversation-card.has-unread .last-message {
  font-weight: 600;
  color: #1C1C1E;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.platform-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  text-align: center;
}

.platform-badge.line {
  background-color: #00c300;
}

.platform-badge.facebook {
  background-color: #1877f2;
}

.platform-badge.instagram {
  background-color: #e4405f;
}

.platform-badge.whatsapp {
  background-color: #25d366;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  text-align: center;
}

.status-badge.active {
  background-color: #27ae60;
}

.status-badge.assigned {
  background-color: #3498db;
}

.status-badge.pending {
  background-color: #f39c12;
}

.status-badge.in-progress {
  background-color: #2980b9;
}

.status-badge.waiting {
  background-color: #e67e22;
}

.status-badge.closed {
  background-color: #E5E5EA;
  color: #8E8E93;
}

.conv-card-body {
  margin-bottom: 0.75rem;
}

.conv-card-body .last-message {
  max-width: none;
  -webkit-line-clamp: 3;
}

.last-message {
  color: #555;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* line-clamp does not ellipsize an unbreakable string (URL, long ID); wrap it instead of cutting it */
  overflow-wrap: anywhere;
}

.conv-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

.assigned-agent {
  color: #3498db;
  font-weight: 500;
}

.timestamp {
  color: #666;
  font-size: 0.85rem;
}

/* Performance */
.conversation-card {
  contain: layout style paint;
  will-change: transform, opacity;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .conversation-card {
    animation: none;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .mobile-cards {
    display: block;
  }

  .conversation-card:hover {
    transform: translateX(2px);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.06),
      -2px 0 0 rgba(59, 130, 246, 0.2);
  }
}

@media (max-width: 480px) {
  .conversation-card {
    padding: 0.75rem;
  }

  .conv-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .badges {
    width: 100%;
    justify-content: flex-start;
  }

  .conv-card-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
