<template>
  <div
    v-if="hasAssignment"
    class="assignment-badge"
    :class="badgeClass"
    :title="tooltipText"
  >
    <UserGroupIcon class="badge-icon" />
    <span class="badge-text">{{ displayText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UserGroupIcon } from '@/components/icons'

interface Props {
  teamId?: number | null
  teamName?: string | null
  agentId?: string | null
  agentName?: string | null
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  teamId: null,
  teamName: null,
  agentId: null,
  agentName: null,
  compact: false
})

const hasAssignment = computed(() => {
  return !!(props.teamId || props.agentId)
})

const displayText = computed(() => {
  if (props.agentId && props.agentName) {
    // 如果指派給個人，優先顯示個人
    return props.compact ? props.agentName : ` ${props.agentName}`
  } else if (props.teamId && props.teamName) {
    // 如果只指派給團隊
    return props.compact ? props.teamName : props.teamName
  }
  return '未指派'
})

const tooltipText = computed(() => {
  const parts: string[] = []

  if (props.teamId && props.teamName) {
    parts.push(`團隊：${props.teamName}`)
  }

  if (props.agentId && props.agentName) {
    parts.push(`負責人：${props.agentName}`)
  }

  return parts.length > 0 ? parts.join('\n') : '未指派'
})

const badgeClass = computed(() => {
  return {
    'has-agent': !!props.agentId,
    'team-only': !!props.teamId && !props.agentId,
    'compact': props.compact
  }
})
</script>

<style scoped>
.assignment-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;
  cursor: help;
}

/* 團隊指派（藍色） */
.assignment-badge.team-only {
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.assignment-badge.team-only:hover {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
}

/* 個人指派（綠色） */
.assignment-badge.has-agent {
  background-color: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.assignment-badge.has-agent:hover {
  background-color: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
}

.badge-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.badge-text {
  line-height: 1;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Compact 模式 */
.assignment-badge.compact {
  padding: 2px 8px;
  font-size: 12px;
}

.assignment-badge.compact .badge-icon {
  width: 12px;
  height: 12px;
}

.assignment-badge.compact .badge-text {
  max-width: 80px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .assignment-badge.team-only {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border-color: rgba(59, 130, 246, 0.4);
  }

  .assignment-badge.has-agent {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.4);
  }
}
</style>
