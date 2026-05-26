<template>
  <div class="desktop-table">
    <table class="conversations-table">
      <thead>
        <tr>
          <th class="customer-col">
            客戶
          </th>
          <th class="platform-col">
            平台
          </th>
          <th class="status-col">
            狀態
          </th>
          <th class="message-col">
            最後訊息
          </th>
          <th class="agent-col">
            負責人
          </th>
          <th class="time-col">
            更新時間
          </th>
        </tr>
      </thead>
      <TransitionGroup
        name="conversation-list"
        tag="tbody"
        appear
      >
        <tr
          v-for="(conversation, index) in conversations"
          :key="conversation.id"
          class="conversation-row"
          :class="{ 'has-unread': conversation.unreadCount > 0 }"
          :style="{ animationDelay: `${index * 50}ms` }"
          @click="$emit('select', conversation.id)"
        >
          <td class="customer-cell">
            <div class="customer-info">
              <span
                class="read-badge"
                :class="conversation.unreadCount > 0 ? 'unread' : 'read'"
                :aria-label="conversation.unreadCount > 0 ? `未讀 ${conversation.unreadCount} 則訊息` : '已讀'"
              >
                {{ conversation.unreadCount > 0
                  ? (conversation.unreadCount > 1 ? `未讀 ${conversation.unreadCount}` : '未讀')
                  : '已讀' }}
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
          </td>
          <td class="platform-cell">
            <div
              class="platform-badge"
              :class="conversation.platform || conversation.user?.platform"
            >
              {{ getPlatformText(conversation.platform || conversation.user?.platform || 'line') }}
            </div>
          </td>
          <td class="status-cell">
            <div
              class="status-badge"
              :class="conversation.status"
            >
              {{ getStatusText(conversation.status) }}
            </div>
          </td>
          <td class="message-cell">
            <div class="last-message">
              {{ getLastMessageText(conversation) }}
            </div>
          </td>
          <td class="agent-cell">
            <div class="assigned-agent">
              {{ getAssignedTo(conversation) }}
            </div>
          </td>
          <td class="time-cell">
            <div class="timestamp">
              {{ formatTime(getUpdatedAt(conversation)) }}
            </div>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { Conversation } from '@/types'
import { convertEmojiForConversationList } from '@/utils/layered-emoji-processor'

defineProps<{
  conversations: Conversation[]
}>()

defineEmits<{
  select: [id: string]
}>()

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

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    active: '進行中',
    assigned: '已指派',
    pending: '待處理',
    'in-progress': '處理中',
    waiting: '等待中'
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
.desktop-table {
  display: block;
  overflow-x: auto;
}

.conversations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.conversations-table thead {
  background-color: #f8f9fa;
}

.conversations-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #e9ecef;
  white-space: nowrap;
}

.conversations-table td {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  vertical-align: top;
}

/* TransitionGroup Animation */
.conversation-list-enter-active,
.conversation-list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.conversation-list-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.conversation-list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.conversation-list-move {
  transition: transform 0.3s ease;
}

.conversation-row {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  animation: slideInFromBottom var(--animation-duration, 0.4s) cubic-bezier(0.4, 0, 0.2, 1) backwards;
}

.conversation-row:hover {
  background-color: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.conversation-row:active {
  transform: translateY(0);
  transition-duration: 0.1s;
}

@keyframes slideInFromBottom {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Animation duration per row */
.conversation-row:nth-child(1) { --animation-duration: 0.3s; }
.conversation-row:nth-child(2) { --animation-duration: 0.4s; }
.conversation-row:nth-child(3) { --animation-duration: 0.5s; }
.conversation-row:nth-child(4) { --animation-duration: 0.6s; }
.conversation-row:nth-child(5) { --animation-duration: 0.7s; }

/* Table Column Widths */
.customer-col { width: 20%; }
.platform-col { width: 10%; }
.status-col { width: 10%; }
.message-col { width: 35%; }
.agent-col { width: 15%; }
.time-col { width: 10%; }

/* Cell Content Styles */
.customer-info {
  display: flex;
  align-items: center;
  gap: 10px;
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

.conversation-row.has-unread {
  background: #F8FAFF;
}

.conversation-row.has-unread .customer-name {
  font-weight: 700;
  color: #1C1C1E;
}

.conversation-row.has-unread .last-message {
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

.customer-name {
  font-weight: 500;
  color: #333;
}

.customer-id {
  font-size: 0.85rem;
  color: #666;
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

.last-message {
  color: #555;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 350px;
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
.conversation-row {
  contain: layout style paint;
  will-change: transform, opacity;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .conversation-row {
    animation: none;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .conversations-table {
    font-size: 13px;
  }

  .conversations-table th,
  .conversations-table td {
    padding: 0.75rem 0.5rem;
  }

  .last-message {
    max-width: 250px;
  }
}

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }
}
</style>
