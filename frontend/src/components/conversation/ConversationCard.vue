<template>
  <div
    class="conversation-card-apple"
    :class="{
      'is-selected': selected,
      'has-unread': hasUnreadMessages,
      'is-closed': conversation.status === CONVERSATION_STATUS.CLOSED,
      'is-hovered': isHovered
    }"
    :data-status="effectiveStatus"
    tabindex="0"
    role="button"
    :aria-selected="selected"
    :aria-label="conversationAriaLabel"
    @click="handleSelect"
    @keydown.enter="handleSelect"
    @keydown.space.prevent="handleSelect"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- Glass Background Layer -->
    <div class="card-glass-bg" />

    <!-- Content Layer -->
    <div class="card-inner">
      <!-- Avatar Section -->
      <div class="avatar-section">
        <div class="avatar-wrapper">
          <div
            class="avatar"
            :class="{ 'is-active': isOnline }"
          >
            <span class="avatar-text">{{ customerInitials }}</span>
          </div>
          <!-- Platform Badge - iOS Style -->
          <div
            v-if="platformInfo"
            class="platform-indicator"
            :class="`platform-${platformInfo.key}`"
          >
            <component
              :is="getPlatformIcon(platformInfo.key)"
              class="platform-icon"
            />
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="content-section">
        <!-- Header Row -->
        <div class="content-header">
          <h3 class="customer-name">
            {{ customerName }}
          </h3>
          <time class="timestamp">{{ formatTime(conversation.updatedAt) }}</time>
        </div>

        <!-- Message Preview -->
        <p
          class="message-preview"
          :class="{ 'is-unread': hasUnreadMessages }"
        >
          {{ lastMessageText }}
        </p>

        <!-- Status Row -->
        <div class="status-row">
          <div
            class="status-pill"
            :class="`status-${effectiveStatus}`"
          >
            <span class="status-dot" />
            <span class="status-text">{{ statusDisplayText }}</span>
          </div>

          <!-- Assigned Badge -->
          <div
            v-if="assignedToDisplay"
            class="assigned-badge"
          >
            <UserCheckIcon class="assigned-icon" />
            <span>{{ assignedToDisplay }}</span>
          </div>
        </div>
      </div>

      <!-- Right Section - Unread & Chevron -->
      <div class="end-section">
        <!-- Unread Count -->
        <Transition name="scale-pop">
          <div
            v-if="hasUnreadMessages"
            class="unread-badge"
          >
            {{ formattedUnreadCount }}
          </div>
        </Transition>

        <!-- Chevron -->
        <ChevronRightIcon class="chevron-icon" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, h } from 'vue'
import type { Conversation } from '@/types'
import { usePrefetch } from '@/composables/usePrefetch'
import { convertEmojiForConversationList } from '@/utils/layered-emoji-processor'
import { CONVERSATION_STATUS } from '@/constants/conversation-status'
import {
  UserCheckIcon,
  ChevronRightIcon
} from '@/components/icons'

interface Props {
  conversation: Conversation
  selected?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [conversation: Conversation]
}>()

// Composables
const { prefetchApiData } = usePrefetch()

// State
const isHovered = ref(false)

// Platform config
const platformConfig: Record<string, { name: string; key: string }> = {
  line: { name: 'LINE', key: 'line' },
  facebook: { name: 'Facebook', key: 'facebook' },
  instagram: { name: 'Instagram', key: 'instagram' },
  whatsapp: { name: 'WhatsApp', key: 'whatsapp' },
  telegram: { name: 'Telegram', key: 'telegram' }
}

// Platform icons as render functions
const getPlatformIcon = (platform: string) => ({
  render: () => {
    if (platform === 'line') {
      return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
        h('path', { d: 'M12 2C6.48 2 2 5.81 2 10.46c0 2.57 1.42 4.86 3.65 6.37-.14.5-.51 1.83-.59 2.12-.1.37.14.36.29.26.12-.08 1.87-1.23 2.63-1.73.65.09 1.32.14 2.02.14 5.52 0 10-3.81 10-8.46C22 5.81 17.52 2 12 2z' })
      ])
    }
    return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('circle', { cx: '12', cy: '12', r: '10' })
    ])
  }
})

// Computed
const hasUnreadMessages = computed(() =>
  Boolean(props.conversation.unreadCount && props.conversation.unreadCount > 0)
)

const formattedUnreadCount = computed(() => {
  const count = props.conversation.unreadCount || 0
  return count > 99 ? '99+' : String(count)
})

const effectiveStatus = computed(() => {
  if (props.conversation.assignedTeam || props.conversation.assignedAgent) {
    return 'assigned'
  }
  return props.conversation.status
})

const statusDisplayText = computed(() => {
  const statusMap: Record<string, string> = {
    'open': '待處理',
    'pending': '待處理',
    'active': '進行中',
    'assigned': '處理中',
    'in-progress': '處理中',
    'closed': '已結束'
  }
  return statusMap[effectiveStatus.value] || effectiveStatus.value
})

const isOnline = computed(() =>
  effectiveStatus.value === 'active' || effectiveStatus.value === 'pending'
)

const customerName = computed(() =>
  props.conversation.customer?.name || props.conversation.user?.name || '未知用戶'
)

const customerInitials = computed(() => {
  const name = customerName.value
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

const platformInfo = computed(() => {
  const platform = props.conversation.platform || props.conversation.user?.platform
  return platform ? platformConfig[platform] || { name: platform?.toUpperCase(), key: platform } : null
})

const lastMessageText = computed(() => {
  if (!props.conversation.lastMessage) {return '暫無訊息'}
  const content = props.conversation.lastMessage.content
  const convertedContent = convertEmojiForConversationList(content)
  return convertedContent.length > 50 ? `${convertedContent.substring(0, 50)}...` : convertedContent
})

const assignedToDisplay = computed(() => {
  if (props.conversation.assignedAgent?.name) {
    return props.conversation.assignedAgent.name
  }
  if (props.conversation.assignedTeam?.name) {
    return props.conversation.assignedTeam.name
  }
  return null
})

const conversationAriaLabel = computed(() => {
  const unreadText = hasUnreadMessages.value ? `，${props.conversation.unreadCount} 則未讀訊息` : ''
  const statusText = props.conversation.status === CONVERSATION_STATUS.PENDING ? '待處理' :
                    props.conversation.status === CONVERSATION_STATUS.IN_PROGRESS ? '處理中' : '已結束'
  return `與 ${customerName.value} 的對話，狀態：${statusText}${unreadText}`
})

// Methods
const handleMouseEnter = () => {
  isHovered.value = true
  prefetchApiData(`/api/conversations/${props.conversation.id}/messages`)
}

const handleMouseLeave = () => {
  isHovered.value = false
}

const handleSelect = () => {
  emit('select', props.conversation)
}

const formatTime = (date: Date | string | number) => {
  try {
    let messageDate: Date
    if (typeof date === 'number') {
      messageDate = new Date(date)
    } else if (typeof date === 'string') {
      messageDate = new Date(date)
    } else {
      messageDate = date
    }

    if (isNaN(messageDate.getTime())) {return ''}

    const now = new Date()
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 0) {return '剛剛'}
    if (diffInHours < 1) {
      const minutes = Math.max(0, Math.floor(diffInHours * 60))
      return minutes === 0 ? '剛剛' : `${minutes}分鐘`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小時`
    } else {
      return messageDate.toLocaleDateString('zh-TW', {
        month: 'numeric',
        day: 'numeric'
      })
    }
  } catch {
    return ''
  }
}
</script>

<style scoped>
/* ============================================
   APPLE DESIGN SYSTEM - iOS 15+ Style
   ============================================ */

.conversation-card-apple {
  /* System Colors - iOS */
  --apple-bg: #ffffff;
  --apple-bg-secondary: #f2f2f7;
  --apple-bg-tertiary: #e5e5ea;
  --apple-separator: rgba(60, 60, 67, 0.12);
  --apple-label: #000000;
  --apple-label-secondary: rgba(60, 60, 67, 0.6);
  --apple-label-tertiary: rgba(60, 60, 67, 0.3);

  /* Accent Colors */
  --apple-blue: #007aff;
  --apple-green: #34c759;
  --apple-orange: #ff9500;
  --apple-red: #ff3b30;
  --apple-gray: #8e8e93;

  /* Glass Effect */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-blur: 20px;

  /* Sizing */
  --radius-large: 20px;
  --radius-medium: 14px;
  --radius-small: 10px;

  /* Typography - SF Pro approximation */
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ============================================
   MAIN CARD
   ============================================ */
.conversation-card-apple {
  position: relative;
  background: var(--apple-bg);
  border-radius: var(--radius-large);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Glass Background */
.card-glass-bg {
  position: absolute;
  inset: 0;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.conversation-card-apple:hover .card-glass-bg {
  opacity: 1;
}

.conversation-card-apple:hover {
  transform: scale(1.01);
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 12px 32px rgba(0, 0, 0, 0.06);
}

.conversation-card-apple.is-selected {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(0, 122, 255, 0.04) 100%);
  box-shadow:
    0 0 0 2px var(--apple-blue),
    0 4px 20px rgba(0, 122, 255, 0.2);
}

.conversation-card-apple.has-unread {
  background: linear-gradient(135deg, rgba(255, 59, 48, 0.04) 0%, var(--apple-bg) 50%);
}

.conversation-card-apple.is-closed {
  opacity: 0.6;
}

/* ============================================
   CARD INNER LAYOUT
   ============================================ */
.card-inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  z-index: 1;
}

/* ============================================
   AVATAR SECTION
   ============================================ */
.avatar-section {
  flex-shrink: 0;
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-medium);
  background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.avatar.is-active {
  box-shadow:
    0 0 0 3px var(--apple-bg),
    0 0 0 5px var(--apple-green);
}

.conversation-card-apple:hover .avatar {
  transform: scale(1.04);
}

.avatar-text {
  color: white;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.3px;
}

/* Platform Indicator */
.platform-indicator {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2.5px solid var(--apple-bg);
  transition: transform 0.2s ease;
}

.platform-indicator.platform-line {
  background: #06c755;
}

.platform-indicator.platform-facebook {
  background: #1877f2;
}

.platform-indicator.platform-instagram {
  background: linear-gradient(45deg, #f09433, #dc2743, #bc1888);
}

.platform-icon {
  width: 12px;
  height: 12px;
  color: white;
}

/* ============================================
   CONTENT SECTION
   ============================================ */
.content-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.content-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.customer-name {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--apple-label);
  letter-spacing: -0.4px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timestamp {
  font-size: 15px;
  font-weight: 400;
  color: var(--apple-label-secondary);
  flex-shrink: 0;
}

/* Message Preview */
.message-preview {
  margin: 0;
  font-size: 15px;
  font-weight: 400;
  color: var(--apple-label-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-preview.is-unread {
  font-weight: 500;
  color: var(--apple-label);
}

/* Status Row */
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 7px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill.status-open,
.status-pill.status-pending,
.status-pill.status-active {
  background: rgba(255, 149, 0, 0.12);
  color: #c77700;
}

.status-pill.status-open .status-dot,
.status-pill.status-pending .status-dot,
.status-pill.status-active .status-dot {
  background: var(--apple-orange);
}

.status-pill.status-assigned,
.status-pill.status-in-progress {
  background: rgba(0, 122, 255, 0.12);
  color: #0066d6;
}

.status-pill.status-assigned .status-dot,
.status-pill.status-in-progress .status-dot {
  background: var(--apple-blue);
}

.status-pill.status-closed {
  background: rgba(142, 142, 147, 0.12);
  color: var(--apple-gray);
}

.status-pill.status-closed .status-dot {
  background: var(--apple-gray);
}

/* Assigned Badge */
.assigned-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(52, 199, 89, 0.12);
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  color: #248a3d;
}

.assigned-icon {
  width: 12px;
  height: 12px;
}

/* ============================================
   END SECTION
   ============================================ */
.end-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.unread-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--apple-red);
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: white;
}

.chevron-icon {
  width: 16px;
  height: 16px;
  color: var(--apple-label-tertiary);
  transition: transform 0.2s ease;
}

.conversation-card-apple:hover .chevron-icon {
  transform: translateX(2px);
  color: var(--apple-label-secondary);
}

/* ============================================
   TRANSITIONS
   ============================================ */
.scale-pop-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scale-pop-leave-active {
  transition: all 0.2s ease;
}

.scale-pop-enter-from,
.scale-pop-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

/* ============================================
   RESPONSIVE
   ============================================ */
@media (max-width: 768px) {
  .card-inner {
    padding: 12px 14px;
  }

  .avatar {
    width: 48px;
    height: 48px;
  }

  .customer-name {
    font-size: 16px;
  }

  .message-preview {
    font-size: 14px;
  }
}

/* ============================================
   ACCESSIBILITY
   ============================================ */
@media (prefers-reduced-motion: reduce) {
  .conversation-card-apple,
  .avatar,
  .chevron-icon,
  .action-button {
    transition: none !important;
  }
}

.conversation-card-apple:focus {
  outline: none;
}

.conversation-card-apple:focus-visible {
  box-shadow:
    0 0 0 4px rgba(0, 122, 255, 0.4),
    0 0 0 2px var(--apple-blue);
}
</style>
