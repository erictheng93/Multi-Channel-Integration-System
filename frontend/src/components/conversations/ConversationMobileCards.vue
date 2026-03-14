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
        :style="{ animationDelay: `${index * 50}ms` }"
        @click="$emit('select', conversation.id)"
      >
        <div class="card-header">
          <div class="customer-info">
            <div class="customer-name">
              {{ conversation.customer?.name || conversation.user?.name || (conversation as any).customer_name || '未知用戶' }}
            </div>
            <div class="customer-id">
              ID: {{ conversation.userId }}
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
        <div class="card-body">
          <div class="last-message">
            {{ getLastMessageText(conversation) }}
          </div>
        </div>
        <div class="card-footer">
          <div class="assigned-agent">
            負責人: {{ getAssignedTo(conversation) }}
          </div>
          <div class="timestamp">
            {{ formatTime(conversation.updatedAt || (conversation as any).updated_at) }}
          </div>
        </div>
      </div>
    </TransitionGroup>
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

const formatTime = (date: Date | number) => {
  const dateObj = typeof date === 'number' ? new Date(date) : date
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.card-header .customer-info {
  flex: 1;
}

.customer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.customer-name {
  font-weight: 500;
  color: #333;
}

.customer-id {
  font-size: 0.85rem;
  color: #666;
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

.card-body {
  margin-bottom: 0.75rem;
}

.card-body .last-message {
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
}

.card-footer {
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

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .badges {
    width: 100%;
    justify-content: flex-start;
  }

  .card-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
