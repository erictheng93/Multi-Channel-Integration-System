<template>
  <div
    class="notification-item"
    :class="{
      'notification-item-unread': !notification.isRead,
      'notification-item-urgent': notification.priority === 'urgent',
      'notification-item-high': notification.priority === 'high'
    }"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
  >
    <!-- 圖標 -->
    <div class="notification-item-icon" :class="iconClass">
      <component :is="iconComponent" />
    </div>

    <!-- 內容 -->
    <div class="notification-item-content">
      <div class="notification-item-header">
        <span class="notification-item-title">{{ notification.title }}</span>
        <span class="notification-item-time">{{ formattedTime }}</span>
      </div>
      <p class="notification-item-text">{{ notification.content }}</p>
      <div v-if="notification.priority === 'urgent' || notification.priority === 'high'" class="notification-item-priority">
        <span class="priority-badge" :class="`priority-${notification.priority}`">
          {{ priorityLabel }}
        </span>
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="notification-item-actions">
      <button
        v-if="!notification.isRead"
        class="notification-item-action"
        title="標記已讀"
        @click.stop="$emit('mark-read')"
      >
        <CheckIcon />
      </button>
      <button
        class="notification-item-action notification-item-action-delete"
        title="刪除"
        @click.stop="$emit('delete')"
      >
        <TrashIcon />
      </button>
    </div>

    <!-- 未讀指示器 -->
    <div v-if="!notification.isRead" class="notification-item-indicator" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Notification, NotificationType } from '@/stores/notifications'
import {
  MessageIcon,
  UserPlusIcon,
  AtSignIcon,
  BellIcon,
  AlertIcon,
  CheckIcon,
  TrashIcon,
  ArrowRightIcon,
  ClockIcon
} from '@/components/icons'

interface Props {
  notification: Notification
}

defineEmits<{
  (e: 'click'): void
  (e: 'mark-read'): void
  (e: 'delete'): void
}>()

const props = defineProps<Props>()

// 圖標映射
const iconMap: Record<NotificationType, typeof MessageIcon> = {
  new_message: MessageIcon,
  conversation_assigned: UserPlusIcon,
  conversation_transferred: ArrowRightIcon,
  mention: AtSignIcon,
  system: BellIcon,
  priority_changed: AlertIcon,
  customer_responded: MessageIcon,
  task_reminder: ClockIcon
}

const iconComponent = computed(() => iconMap[props.notification.type] || BellIcon)

const iconClass = computed(() => `notification-icon-${props.notification.type}`)

const priorityLabel = computed(() => {
  const labels: Record<string, string> = {
    urgent: '緊急',
    high: '高優先'
  }
  return labels[props.notification.priority] || ''
})

const formattedTime = computed(() => {
  const date = new Date(props.notification.createdAt)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  if (hours < 24) return `${hours} 小時前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric'
  })
})
</script>

<style scoped>
.notification-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-item:hover {
  background: var(--gray-50);
}

.notification-item:focus {
  outline: none;
  background: var(--gray-50);
  box-shadow: 0 0 0 2px var(--primary-200);
}

.notification-item-unread {
  background: var(--primary-50);
}

.notification-item-unread:hover {
  background: var(--primary-100);
}

.notification-item-urgent {
  border-left: 3px solid var(--red-500);
}

.notification-item-high {
  border-left: 3px solid var(--yellow-500);
}

/* 圖標 */
.notification-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.notification-item-icon svg {
  width: 18px;
  height: 18px;
}

.notification-icon-new_message,
.notification-icon-customer_responded {
  background: var(--blue-100);
  color: var(--blue-600);
}

.notification-icon-conversation_assigned,
.notification-icon-conversation_transferred {
  background: var(--green-100);
  color: var(--green-600);
}

.notification-icon-mention {
  background: var(--purple-100);
  color: var(--purple-600);
}

.notification-icon-system {
  background: var(--gray-100);
  color: var(--gray-600);
}

.notification-icon-priority_changed {
  background: var(--yellow-100);
  color: var(--yellow-600);
}

.notification-icon-task_reminder {
  background: var(--orange-100);
  color: var(--orange-600);
}

/* 內容 */
.notification-item-content {
  flex: 1;
  min-width: 0;
}

.notification-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.notification-item-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-item-time {
  font-size: 0.75rem;
  color: var(--gray-500);
  white-space: nowrap;
  flex-shrink: 0;
}

.notification-item-text {
  font-size: 0.8125rem;
  color: var(--gray-600);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-item-priority {
  margin-top: var(--space-2);
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: var(--radius-full);
}

.priority-urgent {
  background: var(--red-100);
  color: var(--red-700);
}

.priority-high {
  background: var(--yellow-100);
  color: var(--yellow-700);
}

/* 操作按鈕 */
.notification-item-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.notification-item:hover .notification-item-actions {
  opacity: 1;
}

.notification-item-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-item-action:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}

.notification-item-action-delete:hover {
  background: var(--red-100);
  color: var(--red-600);
}

.notification-item-action svg {
  width: 14px;
  height: 14px;
}

/* 未讀指示器 */
.notification-item-indicator {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
}
</style>
