<template>
  <article
    :ref="(el) => $emit('set-ref', el as HTMLElement | null, index)"
    class="notification-card"
    :class="{
      'notification-unread': !notification.isRead,
      'notification-urgent': notification.priority === 'urgent',
      'notification-high': notification.priority === 'high',
      'notification-focused': isFocused
    }"
    tabindex="0"
    role="article"
    :aria-label="`${notification.title} - ${notification.content}`"
    :aria-describedby="`notification-${notification.id}-meta`"
    @click="$emit('click', notification)"
    @keydown.enter="$emit('click', notification)"
  >
    <!-- Priority Indicator -->
    <div
      v-if="notification.priority === 'urgent' || notification.priority === 'high'"
      class="priority-indicator"
      :class="`priority-${notification.priority}`"
    />

    <!-- Icon -->
    <div
      class="notification-icon"
      :class="iconClass"
    >
      <component :is="icon" />
    </div>

    <!-- Content -->
    <div class="notification-content">
      <div class="notification-header">
        <h3 class="notification-title">
          {{ notification.title }}
        </h3>
        <time class="notification-time">{{ formattedTime }}</time>
      </div>
      <p class="notification-text">
        {{ notification.content }}
      </p>
      <div
        :id="`notification-${notification.id}-meta`"
        class="notification-meta"
      >
        <span
          class="notification-type-badge"
          :class="`type-${notification.type}`"
          role="status"
        >
          {{ typeLabel }}
        </span>
        <span
          v-if="notification.priority === 'urgent' || notification.priority === 'high'"
          class="notification-priority-badge"
          :class="`priority-${notification.priority}`"
          role="status"
          :aria-label="`優先級: ${notification.priority === 'urgent' ? '緊急' : '高優先'}`"
        >
          {{ notification.priority === 'urgent' ? '緊急' : '高優先' }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div
      class="notification-actions"
      role="group"
      aria-label="通知操作"
      @click.stop
    >
      <button
        v-if="!notification.isRead"
        class="action-btn"
        type="button"
        :aria-label="`標記 ${notification.title} 為已讀`"
        title="標記已讀 (Ctrl+M)"
        @click="$emit('mark-read', notification.id)"
      >
        <CheckIcon aria-hidden="true" />
      </button>
      <button
        class="action-btn action-btn-danger"
        type="button"
        :aria-label="`刪除 ${notification.title}`"
        title="刪除 (Delete)"
        @click="$emit('delete', notification.id)"
      >
        <TrashIcon aria-hidden="true" />
      </button>
    </div>

    <!-- Unread Indicator -->
    <div
      v-if="!notification.isRead"
      class="unread-dot"
    />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Notification, NotificationType } from '@/stores/notifications'
import {
  CheckIcon,
  TrashIcon,
  MessageIcon,
  UserPlusIcon,
  ArrowRightIcon,
  AtSignIcon,
  BellIcon,
  AlertIcon,
  ClockIcon
} from '@/components/icons'

const props = defineProps<{
  notification: Notification
  index: number
  isFocused: boolean
}>()

defineEmits<{
  click: [notification: Notification]
  'mark-read': [id: string]
  delete: [id: string]
  'set-ref': [el: HTMLElement | null, index: number]
}>()

// Icon mapping
const iconMap: Record<NotificationType, typeof MessageIcon> = {
  new_message: MessageIcon,
  conversation_assigned: UserPlusIcon,
  conversation_transferred: ArrowRightIcon,
  mention: AtSignIcon,
  system: BellIcon,
  customer_responded: MessageIcon,
  task_reminder: ClockIcon,
  // eslint-disable-next-line camelcase
  agent_removed_from_team: AlertIcon,
  // eslint-disable-next-line camelcase
  customer_followed: UserPlusIcon,
  // eslint-disable-next-line camelcase
  new_conversation: MessageIcon
}

const icon = computed(() => iconMap[props.notification.type] || BellIcon)
const iconClass = computed(() => `icon-${props.notification.type}`)

// Type label mapping
const typeLabelMap: Record<NotificationType, string> = {
  new_message: '新訊息',
  conversation_assigned: '對話指派',
  conversation_transferred: '對話轉移',
  mention: '提及',
  system: '系統',
  customer_responded: '客戶回覆',
  task_reminder: '任務提醒',
  // eslint-disable-next-line camelcase
  agent_removed_from_team: '團隊成員變更',
  // eslint-disable-next-line camelcase
  customer_followed: '新客戶加入',
  // eslint-disable-next-line camelcase
  new_conversation: '新對話創建'
}

const typeLabel = computed(() => typeLabelMap[props.notification.type] || props.notification.type)

// Time formatting
const formattedTime = computed(() => {
  const date = new Date(props.notification.createdAt)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) {
    return '剛剛'
  }
  if (minutes < 60) {
    return `${minutes} 分鐘前`
  }
  if (hours < 24) {
    return `${hours} 小時前`
  }
  if (days < 7) {
    return `${days} 天前`
  }

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
})
</script>

<style scoped>
/* Notification Card */
.notification-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-card:hover {
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.notification-card:focus {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}

.notification-card.notification-focused {
  border-color: var(--primary-400);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.notification-card:hover .notification-actions,
.notification-card:focus .notification-actions,
.notification-card.notification-focused .notification-actions {
  opacity: 1;
}

.notification-unread {
  background: linear-gradient(135deg, var(--primary-50), white);
  border-color: var(--primary-200);
}

.notification-urgent {
  border-left: 4px solid var(--red-500);
}

.notification-high {
  border-left: 4px solid var(--yellow-500);
}

.priority-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 32px 32px 0;
  border-color: transparent;
  border-radius: 0 var(--radius-xl) 0 0;
}

.priority-indicator.priority-urgent {
  border-right-color: var(--red-500);
}

.priority-indicator.priority-high {
  border-right-color: var(--yellow-500);
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.notification-icon svg {
  width: 22px;
  height: 22px;
}

.icon-new_message,
.icon-customer_responded {
  background: var(--blue-100);
  color: var(--blue-600);
}

.icon-conversation_assigned,
.icon-conversation_transferred {
  background: var(--green-100);
  color: var(--green-600);
}

.icon-mention {
  background: var(--purple-100);
  color: var(--purple-600);
}

.icon-system {
  background: var(--gray-100);
  color: var(--gray-600);
}

.icon-task_reminder {
  background: var(--orange-100);
  color: var(--orange-600);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-1);
}

.notification-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-time {
  font-size: 0.75rem;
  color: var(--gray-500);
  white-space: nowrap;
}

.notification-text {
  font-size: 0.875rem;
  color: var(--gray-600);
  line-height: 1.5;
  margin: 0 0 var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-meta {
  display: flex;
  gap: var(--space-2);
}

.notification-type-badge,
.notification-priority-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.notification-type-badge {
  background: var(--gray-100);
  color: var(--gray-600);
}

.notification-priority-badge {
  background: var(--red-100);
  color: var(--red-700);
}

.notification-priority-badge.priority-high {
  background: var(--yellow-100);
  color: var(--yellow-700);
}

.notification-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.action-btn-danger:hover {
  background: var(--red-100);
  color: var(--red-600);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.unread-dot {
  position: absolute;
  left: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
}

/* Responsive */
@media (max-width: 768px) {
  .notification-card {
    padding: var(--space-4);
  }

  .notification-actions {
    opacity: 1;
  }
}
</style>
