<template>
  <div class="message-indicator">
    <!-- 消息統計 -->
    <div class="message-stats">
      <div class="stat-item">
        <span class="stat-label">總消息數</span>
        <span class="stat-value">{{ totalMessages }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">時間跨度</span>
        <span class="stat-value">{{ timeSpan }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/types'

interface Props {
  oldestMessage?: Message | null
  latestMessage?: Message | null
  totalMessages?: number
}

const props = withDefaults(defineProps<Props>(), {
  totalMessages: 0
})

// 計算時間跨度
const timeSpan = computed(() => {
  if (!props.oldestMessage || !props.latestMessage) {return '-'}
  
  const oldest = new Date(props.oldestMessage.createdAt)
  const latest = new Date(props.latestMessage.createdAt)
  const diffMs = latest.getTime() - oldest.getTime()
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  if (diffDays > 0) {
    return `${diffDays}天${diffHours > 0 ? ` ${diffHours}小時` : ''}`
  } else if (diffHours > 0) {
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHours}小時${diffMinutes > 0 ? ` ${diffMinutes}分鐘` : ''}`
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return `${diffMinutes}分鐘`
  }
})

</script>

<style scoped>
.message-indicator {
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(226, 232, 240, 0.6);
  font-size: 0.875rem;
}

.message-stats {
  display: flex;
  gap: var(--space-4);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 500;
}

.stat-value {
  font-size: 0.875rem;
  color: var(--gray-700);
  font-weight: 600;
}

@media (max-width: 768px) {
  .message-indicator {
    padding: var(--space-2);
    font-size: 0.8125rem;
  }
  
  .marker-text,
  .marker-time {
    font-size: 0.75rem;
  }
  
  .message-stats {
    gap: var(--space-3);
  }
}
</style>