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
    <!-- Icon tile, pastel per type -->
    <div
      class="notification-icon"
      :class="iconClass"
      :title="typeLabel"
    >
      <component :is="icon" />
    </div>

    <!-- Content -->
    <div class="notification-content">
      <div class="notification-header">
        <h3 class="notification-title">
          {{ notification.title }}
        </h3>
        <span
          v-if="!notification.isRead"
          class="sr-only"
        >未讀</span>
      </div>
      <p class="notification-text">
        {{ notification.content }}
      </p>
      <div
        :id="`notification-${notification.id}-meta`"
        class="notification-meta"
      >
        <span class="sr-only">{{ typeLabel }}</span>
        <span
          v-if="notification.priority === 'urgent'"
          class="ui-pill ui-pill-red"
          role="status"
          aria-label="優先級: 緊急"
        >緊急</span>
        <span
          v-else-if="notification.priority === 'low'"
          class="ui-pill"
          role="status"
          aria-label="優先級: 低"
        >低優先</span>
        <span
          v-if="platform"
          class="ui-ch"
          :class="platform === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
          :title="platform === 'line' ? 'LINE' : 'Messenger'"
        ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
      </div>
    </div>

    <!-- Trailing column at the card edge: unread dot + time, then the row actions -->
    <div class="notification-trail">
      <span class="notification-when">
        <span
          v-if="!notification.isRead"
          class="notification-dot"
          aria-hidden="true"
        />
        <time
          class="notification-time"
          :datetime="notification.createdAt"
        >{{ formattedTime }}</time>
      </span>
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
    </div>
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

// Channel glyph only when the notification really carries a platform
const platform = computed<'line' | 'facebook' | null>(() => {
  const value = props.notification.data?.platform
  return value === 'line' || value === 'facebook' ? value : null
})

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
.notification-card {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 22px;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.notification-card + .notification-card::before {
  position: absolute;
  top: 0;
  right: 22px;
  left: 78px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.notification-card:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

/* Unread rows are tinted and carry a dot by the time; urgent ones also carry a red lead bar */
.notification-unread {
  background: color-mix(in srgb, var(--ui-accent-soft) 45%, transparent);
}

.notification-unread:hover {
  background: color-mix(in srgb, var(--ui-accent-soft) 70%, transparent);
}

.notification-urgent::after {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--ui-red);
  content: '';
}

/* Urgent: a solid red icon tile whatever the type */
.notification-urgent .notification-icon {
  background: var(--ui-red);
  color: #fff;
}

.notification-card:focus-visible,
.notification-focused {
  outline: none;
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

/* Read notifications recede */
.notification-card:not(.notification-unread) .notification-title {
  font-weight: 500;
  color: var(--ui-ink-2);
}

.notification-card:not(.notification-unread) .notification-text {
  color: var(--ui-muted);
}

.notification-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.notification-icon svg {
  width: 19px;
  height: 19px;
}

.icon-new_message,
.icon-new_conversation {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.icon-customer_responded {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.icon-conversation_assigned,
.icon-customer_followed {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.icon-conversation_transferred {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.icon-mention,
.icon-task_reminder {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.icon-agent_removed_from_team {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

/* Copy takes the whole row; the trailing column sits on the card's right edge */
.notification-content {
  min-width: 0;
  flex: 1;
}

.notification-header {
  display: flex;
  gap: 10px;
  align-items: center;
}

.notification-title {
  min-width: 0;
  flex: 1;
  margin: 0;
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-trail {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
  min-width: 92px;
}

.notification-when {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  height: 22px;
}

.notification-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-accent);
}

.notification-time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-muted);
  white-space: nowrap;
}

.notification-text {
  margin: 2px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ui-ink-2);
  word-break: break-word;
}

.notification-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.notification-meta:not(:has(> :not(.sr-only))) {
  display: none;
}

.notification-meta > :not(.sr-only):first-of-type,
.notification-meta > .ui-pill {
  margin-top: 8px;
}

.notification-meta > .ui-ch {
  margin-top: 8px;
}

/* Row actions live under the time in the trailing column and appear on hover or focus */
.notification-actions {
  position: absolute;
  right: 22px;
  bottom: 10px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--ui-dur) var(--ui-ease);
}

.notification-card:hover .notification-actions,
.notification-card:focus-within .notification-actions {
  opacity: 1;
}

/* Phone and touch: time hugs the right edge, the actions drop to their own row under the copy */
@media (max-width: 768px), (hover: none) {
  .notification-card {
    flex-wrap: wrap;
  }

  .notification-trail {
    display: contents;
  }

  .notification-when {
    order: 2;
  }

  .notification-actions {
    position: static;
    order: 3;
    flex-basis: 100%;
    justify-content: flex-end;
    margin: -12px -12px -14px 0;
    opacity: 1;
  }
}

.action-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease), color var(--ui-dur) var(--ui-ease);
}

.action-btn:hover {
  background: var(--ui-fill-strong);
}

.action-btn-danger:hover {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.action-btn svg {
  width: 15px;
  height: 15px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .notification-card {
    padding: 14px 16px;
  }

  .notification-card + .notification-card::before {
    right: 16px;
    left: 70px;
  }

  /* The title wraps (two lines at most) instead of cutting the customer name off */
  .notification-title {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    white-space: normal;
    text-overflow: clip;
  }
}

@media (max-width: 768px), (hover: none) {
  /* 44px touch target, but drawn as quiet glyphs so the row reads as part of the item, not a toolbar */
  .action-btn {
    width: 44px;
    height: 44px;
    background: transparent;
    color: var(--ui-ink-2);
  }

  .action-btn svg {
    width: 20px;
    height: 20px;
  }
}
</style>
