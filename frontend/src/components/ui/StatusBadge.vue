<template>
  <div 
    class="status-badge"
    :class="[
      `status-${status}`,
      status,
      size || 'medium',
      {
        'clickable': clickable
      }
    ]"
    @click="handleClick"
  >
    <div class="status-indicator" />
    <span class="status-text">{{ displayText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  status: string
  size?: 'small' | 'medium' | 'large'
  clickable?: boolean
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  clickable: false,
  text: ''
})

const emit = defineEmits<{
  click: []
}>()

const statusConfig: Record<string, { text: string; color: string }> = {
  // Conversation statuses
  open: { text: '待處理', color: 'orange' },
  assigned: { text: '處理中', color: 'blue' },
  closed: { text: '已結束', color: 'gray' },
  
  // Extended statuses for tests
  pending: { text: '待處理', color: 'orange' },
  'in-progress': { text: '處理中', color: 'blue' },
  resolved: { text: '已解決', color: 'green' },
  active: { text: '活躍', color: 'green' },
  inactive: { text: '非活躍', color: 'gray' },
  online: { text: '在線', color: 'green' },
  offline: { text: '離線', color: 'gray' }
}

const displayText = computed(() => {
  if (props.text) {return props.text}
  
  const config = statusConfig[props.status]
  if (config) {return config.text}
  
  if (props.status === 'unknown' || !props.status) {return '未知'}
  
  return props.status
})

const handleClick = () => {
  if (props.clickable) {
    emit('click')
  }
}
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid;
}

.status-badge.small {
  padding: 2px 6px;
  font-size: 0.625rem;
}

.status-badge.medium {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.status-badge.large {
  padding: 6px 12px;
  font-size: 0.875rem;
}

.status-badge.clickable {
  cursor: pointer;
  transition: all var(--transition-fast);
}

.status-badge.clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-text {
  line-height: 1;
}

/* Status-specific colors */
.status-open,
.status-pending {
  background: var(--orange-50);
  border-color: var(--orange-200);
  color: var(--orange-700);
}

.status-open .status-indicator,
.status-pending .status-indicator {
  background: var(--orange-500);
}

.status-assigned,
.status-in-progress {
  background: var(--blue-50);
  border-color: var(--blue-200);
  color: var(--blue-700);
}

.status-assigned .status-indicator,
.status-in-progress .status-indicator {
  background: var(--blue-500);
}

.status-closed {
  background: var(--gray-50);
  border-color: var(--gray-200);
  color: var(--gray-700);
}

.status-closed .status-indicator {
  background: var(--gray-400);
}

.status-resolved,
.status-active,
.status-online {
  background: var(--green-50);
  border-color: var(--green-200);
  color: var(--green-700);
}

.status-resolved .status-indicator,
.status-active .status-indicator,
.status-online .status-indicator {
  background: var(--green-500);
}

.status-inactive,
.status-offline {
  background: var(--gray-50);
  border-color: var(--gray-200);
  color: var(--gray-700);
}

.status-inactive .status-indicator,
.status-offline .status-indicator {
  background: var(--gray-400);
}

.status-unknown {
  background: var(--gray-50);
  border-color: var(--gray-200);
  color: var(--gray-700);
}

.status-unknown .status-indicator {
  background: var(--gray-400);
}
</style>