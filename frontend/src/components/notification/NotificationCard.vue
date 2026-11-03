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
        <span class="meta-when">
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
        <span
          v-if="notification.priority === 'urgent'"
          class="ui-pill ui-pill-red"
          role="status"
          aria-label="優先級: 緊急"
        >緊急</span>
        <span
          v-else-if="notification.priority === 'high'"
          class="ui-pill ui-pill-orange"
          role="status"
          aria-label="優先級: 高"
        >高優先</span>
        <span
          v-if="platform"
          class="ch-tag"
        >
          <span
            class="ui-ch"
            :class="platform === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
            aria-hidden="true"
          ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>{{ platform === 'line' ? 'LINE' : 'Messenger' }}
        </span>
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
          <span
            class="action-label"
            aria-hidden="true"
          >已讀</span>
        </button>
        <button
          class="action-btn action-btn-danger"
          :class="{ 'is-confirming': confirmingDelete }"
          type="button"
          :aria-label="confirmingDelete ? `再按一次刪除 ${notification.title}` : `刪除 ${notification.title}`"
          :title="confirmingDelete ? '再按一次確認刪除' : '刪除 (Delete)'"
          @click="onDeleteClick"
        >
          <span
            v-if="confirmingDelete"
            class="confirm-text"
          >刪除？</span>
          <template v-else>
            <TrashIcon aria-hidden="true" />
            <span
              class="action-label"
              aria-hidden="true"
            >刪除</span>
          </template>
        </button>
      </div>
      <!-- Phone and touch: one quiet overflow replaces the inline actions, so every row looks the same -->
      <div
        ref="moreEl"
        class="notification-more"
        @click.stop
      >
        <button
          class="more-btn"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          :aria-label="`更多操作：${notification.title}`"
          @click="menuOpen = !menuOpen"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle
              cx="5"
              cy="12"
              r="1.8"
            />
            <circle
              cx="12"
              cy="12"
              r="1.8"
            />
            <circle
              cx="19"
              cy="12"
              r="1.8"
            />
          </svg>
        </button>
        <div
          v-if="menuOpen"
          class="more-menu"
          role="menu"
        >
          <button
            v-if="!notification.isRead"
            type="button"
            role="menuitem"
            @click="onMenuMarkRead"
          >
            <CheckIcon aria-hidden="true" />標記已讀
          </button>
          <button
            type="button"
            role="menuitem"
            class="is-danger"
            @click="onDeleteClick"
          >
            <TrashIcon aria-hidden="true" />{{ confirmingDelete ? '再按一次刪除' : '刪除' }}
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Notification, NotificationType } from '@/stores/notifications'
import {
  CheckIcon,
  TrashIcon,
  MessageIcon,
  UserPlusIcon,
  ArrowLeftRightIcon,
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

const emit = defineEmits<{
  click: [notification: Notification]
  'mark-read': [id: string]
  delete: [id: string]
  'set-ref': [el: HTMLElement | null, index: number]
}>()

// Icon mapping
const iconMap: Record<NotificationType, typeof MessageIcon> = {
  new_message: MessageIcon,
  conversation_assigned: UserPlusIcon,
  conversation_transferred: ArrowLeftRightIcon,
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

// Delete is two taps: the first turns the button into a red 刪除？ for 3 s, the second deletes
const confirmingDelete = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null
function onDeleteClick(): void {
  if (confirmingDelete.value) {
    if (confirmTimer) { clearTimeout(confirmTimer) }
    confirmingDelete.value = false
    emit('delete', props.notification.id)
    return
  }
  confirmingDelete.value = true
  confirmTimer = setTimeout(() => { confirmingDelete.value = false }, 3000)
}

// Overflow menu (phone): closes on any outside tap
const menuOpen = ref(false)
const moreEl = ref<HTMLElement | null>(null)
function onDocPointer(e: Event): void {
  if (menuOpen.value && moreEl.value && !moreEl.value.contains(e.target as HTMLElement)) { menuOpen.value = false }
}
function onMenuMarkRead(): void {
  menuOpen.value = false
  emit('mark-read', props.notification.id)
}
onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
  if (confirmTimer) { clearTimeout(confirmTimer) }
})

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
  margin: 0;
  padding: 14px 24px;
  border-radius: 0;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.notification-card + .notification-card::before {
  position: absolute;
  top: 0;
  right: 24px;
  left: 78px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.notification-card:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

/* Unread: coloured icon tile, bold ink title and a dot by the time. Read: grey tile, receding title. No tinted slab (it read as a selected row). */
.notification-unread .notification-title {
  font-weight: 700;
  color: var(--ui-ink);
}

.notification-card:not(.notification-unread) .notification-icon {
  opacity: 0.62;
}

/* One accent for "needs you" (unread); the type is the glyph, not a colour. Read rows go quiet grey. */
.notification-unread .notification-icon {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

/* Unread is a faint wash across the row plus the dot by the time (no hard edge bar); a wash this light does not read as a selection */
.notification-unread {
  background: color-mix(in srgb, var(--ui-accent) 9%, var(--ui-surface));
}

/* The Mail gutter dot: a glance down the left edge counts what still needs you */
.notification-unread::after {
  position: absolute;
  top: 31px;
  left: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-accent);
  content: '';
}

/* Urgent: the same pastel tile language, in red, whatever the type (the pill says why) */
.notification-urgent .notification-icon {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
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
  font-size: 15px;
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
  font-size: 14px;
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

.notification-meta:not(:has(> :not(.sr-only, .meta-when))) {
  display: none;
}

.notification-meta > :not(.sr-only):first-of-type,
.notification-meta > .ui-pill {
  margin-top: 8px;
}

/* Pills sit on a solid surface mix so the tinted unread row cannot dip their text below AA */
.notification-meta > .ui-pill-red {
  background: color-mix(in srgb, var(--ui-red) 12%, var(--ui-surface));
}

.notification-meta > .ch-tag {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

/* The inline time belongs to the phone layout; desktop keeps it in the trailing column */
.meta-when {
  display: none;
}

.action-btn-danger.is-confirming {
  width: auto;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.action-label {
  display: none;
}

.confirm-text {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

/* Overflow control: phone and touch only */
.notification-more {
  display: none;
}

/* Row actions live under the time in the trailing column and appear on hover or focus */
.notification-actions {
  position: absolute;
  right: 14px;
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

/* Phone and touch: a grid. Title and its single trailing control share the first line, the copy
   follows, and the time sits at the right end of the one meta line. Unread rows offer mark-read,
   read rows offer delete (one control per row; Delete / Ctrl+M still work from the keyboard). */
@media (max-width: 768px), (hover: none) {
  .notification-card {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    grid-template-areas:
      'icon head head'
      'icon text text'
      'icon meta act';
    gap: 0 14px;
    align-items: start;
  }

  .notification-icon {
    grid-area: icon;
  }

  .notification-content,
  .notification-trail {
    display: contents;
  }

  .notification-header {
    grid-area: head;
    align-self: center;
    min-height: 24px;
  }

  .notification-text {
    grid-area: text;
  }

  .notification-meta {
    grid-area: meta;
    align-self: center;
    justify-self: start;
  }

  .notification-when {
    display: none;
  }

  .notification-card .notification-meta,
  .notification-card .notification-meta:not(:has(> :not(.sr-only, .meta-when))) {
    display: flex;
  }

  .meta-when {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }

  .notification-meta > .ui-pill,
  .notification-meta > .ch-tag {
    margin-top: 8px;
  }

  /* the inline actions are replaced by the overflow control */
  .notification-actions {
    display: none;
  }

  .notification-more {
    position: relative;
    display: block;
    grid-area: act;
    align-self: center;
    margin: -8px -10px -8px 0;
  }
}

.more-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
}

.more-btn svg {
  width: 20px;
  height: 20px;
}

.more-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 20;
  display: grid;
  min-width: 168px;
  padding: 6px;
  border-radius: 14px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
}

.more-menu button {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-ink);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.more-menu button:hover {
  background: var(--ui-fill);
}

.more-menu button.is-danger {
  color: var(--ui-red-ink);
}

.more-menu svg {
  width: 18px;
  height: 18px;
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

  .notification-unread::after {
    left: 4px;
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

</style>
