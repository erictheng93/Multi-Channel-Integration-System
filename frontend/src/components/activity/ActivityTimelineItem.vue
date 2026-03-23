<template>
  <div class="timeline-item">
    <div
      class="timeline-item__icon"
      :class="[iconStyle.bgClass, iconStyle.colorClass]"
    >
      <component
        :is="iconStyle.icon"
        :size="18"
      />
    </div>
    <div class="timeline-item__content">
      <div class="timeline-item__header">
        <span class="timeline-item__user">{{ activity.userName }}</span>
        <span
          class="timeline-item__role"
          :class="getRoleBadgeClasses(activity.userRole)"
          :aria-label="getRoleLabel(activity.userRole)"
        >{{ getRoleLabel(activity.userRole) }}</span>
        <span class="timeline-item__time">{{ formatTime(activity.createdAt) }}</span>
      </div>
      <div class="timeline-item__description">
        {{ getActivityDescription(activity) }}
      </div>
      <button
        v-if="formattedDetails.length > 0"
        class="timeline-item__details-toggle"
        :aria-expanded="detailsExpanded"
        @click="detailsExpanded = !detailsExpanded"
      >
        {{ detailsExpanded ? '隱藏詳情' : '查看詳情' }}
      </button>
      <ActivityDetailPanel
        :entries="formattedDetails"
        :show="detailsExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ActivityLog } from '@/api/activities'
import { getActionIconStyle, formatActivityDetails, getActivityDescription, getRoleLabel, getRoleBadgeClasses } from './utils'
import ActivityDetailPanel from './ActivityDetailPanel.vue'

const props = defineProps<{
  activity: ActivityLog
}>()

const detailsExpanded = ref(false)

const iconStyle = computed(() => getActionIconStyle(props.activity.action))

const formattedDetails = computed(() =>
  formatActivityDetails(props.activity.details ?? null, props.activity.action)
)

function formatTime(isoString: string): string {
  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 60) {
    return '剛剛'
  }
  if (diffMin < 60) {
    return `${diffMin} 分鐘前`
  }
  if (diffHrs < 24) {
    return `${diffHrs} 小時前`
  }
  if (diffDays < 30) {
    return `${diffDays} 天前`
  }
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

<style scoped>
.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  transition: background-color 200ms ease-out;
}

.timeline-item:hover {
  background-color: #F2F2F7;
}

.timeline-item__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timeline-item__content {
  flex: 1;
  min-width: 0;
}

.timeline-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.timeline-item__user {
  font-size: 14px;
  font-weight: 600;
  color: #1C1C1E;
}

.timeline-item__role {
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
}

.timeline-item__time {
  font-size: 12px;
  color: #8E8E93;
  margin-left: auto;
}

.timeline-item__description {
  font-size: 14px;
  color: #1C1C1E;
}

.timeline-item__details-toggle {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: #007AFF;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.timeline-item__details-toggle:hover {
  text-decoration: underline;
}
</style>
