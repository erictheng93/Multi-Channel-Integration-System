<template>
  <div 
    class="conversation-card"
    :class="{ 'selected': selected, 'unread': hasUnreadMessages }"
    tabindex="0"
    role="button"
    :aria-selected="selected"
    :aria-label="conversationAriaLabel"
    @click="handleSelect"
    @keydown.enter="handleSelect"
    @keydown.space.prevent="handleSelect"
    @mouseenter="handleHover"
  >
    <div class="card-header">
      <div class="customer-info">
        <div class="customer-avatar">
          {{ customerInitials }}
        </div>
        <div class="customer-details">
          <h3 class="customer-name">
            {{ conversation.customer?.name || conversation.user?.name || '未知用戶' }}
          </h3>
          <div class="customer-meta">
            <PlatformBadge
              v-if="conversation.platform || conversation.user?.platform"
              :platform="conversation.platform || conversation.user?.platform || 'line'"
              show-icon
            />
            <span class="customer-id">{{ conversation.customer?.platformUserId || conversation.user?.platformUserId || '' }}</span>
          </div>
        </div>
      </div>
      
      <div class="conversation-status">
        <StatusBadge :status="conversation.status" />
        <div
          v-if="conversation.unreadCount && conversation.unreadCount > 0"
          class="unread-badge"
        >
          {{ conversation.unreadCount }}
        </div>
      </div>
    </div>

    <div class="card-body">
      <div class="last-message">
        <p class="message-content">
          {{ lastMessageText }}
        </p>
        <time class="message-time">
          {{ formatTime(conversation.updatedAt) }}
        </time>
      </div>
      
      <div
        v-if="conversation.assignedAgent"
        class="assigned-agent"
      >
        <UserIcon />
        <span>{{ conversation.assignedAgent.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Conversation } from '@/types'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { UserIcon } from '@/components/icons'
import { usePrefetch } from '@/composables/usePrefetch'

interface Props {
  conversation: Conversation
  selected?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [conversation: Conversation]
}>()

// 第五階段：簡單預載入
const { prefetchApiData } = usePrefetch()

const hasUnreadMessages = computed(() => 
  Boolean(props.conversation.unreadCount && props.conversation.unreadCount > 0)
)

const conversationAriaLabel = computed(() => {
  const customerName = props.conversation.customer?.name || props.conversation.user?.name || '未知用戶'
  const unreadText = hasUnreadMessages.value ? `，${props.conversation.unreadCount} 則未讀訊息` : ''
  const statusText = props.conversation.status === 'open' ? '待處理' : 
                    props.conversation.status === 'assigned' ? '處理中' : '已結束'
  return `與 ${customerName} 的對話，狀態：${statusText}${unreadText}`
})

const handleSelect = () => {
  emit('select', props.conversation)
}

// 第五階段：簡單懸浮預載入
const handleHover = () => {
  // 預載入對話詳細資料
  prefetchApiData(`/api/conversations/${props.conversation.id}/messages`)
}

const customerInitials = computed(() => {
  const name = props.conversation.customer?.name || props.conversation.user?.name || 'U'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

const lastMessageText = computed(() => {
  if (!props.conversation.lastMessage) {return '暫無訊息'}
  
  const content = props.conversation.lastMessage.content
  return content.length > 50 ? `${content.substring(0, 50)  }...` : content
})

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
    
    if (isNaN(messageDate.getTime())) {
      console.warn('Invalid date provided to formatTime:', date)
      return '時間未知'
    }
    
    const now = new Date()
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 0) {
      return '剛剛' // Handle future dates
    }
    
    if (diffInHours < 1) {
      const minutes = Math.max(0, Math.floor(diffInHours * 60))
      return minutes === 0 ? '剛剛' : `${minutes}分鐘前`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}小時前`
    } else {
      return messageDate.toLocaleDateString('zh-TW', {
        month: 'short',
        day: 'numeric'
      })
    }
  } catch (error) {
    console.error('Error formatting time:', error)
    return '時間未知'
  }
}
</script>

<style scoped>
.conversation-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  /* 第五階段：GPU 加速 */
  transform: translateZ(0);
  will-change: transform, box-shadow;
  backface-visibility: hidden;
}

.conversation-card:hover {
  border-color: var(--primary-300);
  box-shadow: var(--shadow-md);
  /* 簡單平滑的懸浮效果 */
  transform: translateY(-2px) translateZ(0);
}

.conversation-card.selected {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.conversation-card.unread {
  border-left: 4px solid var(--primary-500);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.customer-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.customer-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  flex-shrink: 0;
  /* 第五階段：簡單的縮放動畫 */
  transition: transform 0.2s ease;
}

.conversation-card:hover .customer-avatar {
  transform: scale(1.05) translateZ(0);
}

.customer-details {
  flex: 1;
  min-width: 0;
}

.customer-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.customer-id {
  font-size: 0.75rem;
  color: var(--gray-500);
}

.conversation-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.unread-badge {
  background: var(--primary-500);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 第五階段：微妙的脈動效果 */
  animation: subtle-pulse 2s ease-in-out infinite;
}

@keyframes subtle-pulse {
  0%, 100% {
    transform: scale(1) translateZ(0);
    opacity: 1;
  }
  50% {
    transform: scale(1.05) translateZ(0);
    opacity: 0.9;
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.last-message {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
}

.message-content {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-time {
  font-size: 0.75rem;
  color: var(--gray-400);
  flex-shrink: 0;
}

.assigned-agent {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.assigned-agent svg {
  width: 12px;
  height: 12px;
}

@media (max-width: 768px) {
  .conversation-card {
    padding: var(--space-3);
  }
  
  .customer-avatar {
    width: 36px;
    height: 36px;
  }
  
  .customer-name {
    font-size: 0.875rem;
  }
  
  .last-message {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}

/* 第五階段：尊重用戶的動畫偏好設置 */
@media (prefers-reduced-motion: reduce) {
  .conversation-card,
  .customer-avatar,
  .unread-badge {
    animation: none !important;
    transition: none !important;
  }
  
  .conversation-card:hover {
    transform: none !important;
  }
  
  .conversation-card:hover .customer-avatar {
    transform: none !important;
  }
}
</style>