<template>
  <div class="activity-timeline">
    <section
      v-for="group in dateGroups"
      :key="group.date"
      class="daygroup"
    >
      <div class="timeline__date-header">
        <h2 class="timeline__date-label">
          {{ groupTitle(group) }}
        </h2>
        <span class="timeline__date-meta">{{ dateMeta(group) }}</span>
      </div>
      <div class="ui-card group-card">
        <template
          v-for="(activity, index) in group.activities"
          :key="activity.id"
        >
          <ActivityTimelineItem
            :activity="activity"
            @restored="(id) => emit('restored', id)"
          />
          <div
            v-if="index < group.activities.length - 1"
            class="timeline__divider"
          />
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityLog } from '@/api/activities'
import { groupActivitiesByDate } from './utils'
import type { ActivityDateGroup } from './types'
import ActivityTimelineItem from './ActivityTimelineItem.vue'

const props = defineProps<{
  activities: ActivityLog[]
}>()

const emit = defineEmits<{
  (_e: 'restored', _activityId: number): void
}>()

const dateGroups = computed(() => groupActivitiesByDate(props.activities))

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function groupDate(group: ActivityDateGroup): Date {
  const [y, m, d] = group.date.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

const isRelativeLabel = (group: ActivityDateGroup) => group.label === '今天' || group.label === '昨天'

/** 今天 / 昨天, otherwise "10 月 27 日" (year added for other years) */
function groupTitle(group: ActivityDateGroup): string {
  if (isRelativeLabel(group)) { return group.label }
  const date = groupDate(group)
  const base = `${date.getMonth() + 1} 月 ${date.getDate()} 日`
  return date.getFullYear() === new Date().getFullYear() ? base : `${date.getFullYear()} 年 ${base}`
}

/** "10 月 29 日 星期四 · 5 筆" (the count is for the rows loaded on this page) */
function dateMeta(group: ActivityDateGroup): string {
  const date = groupDate(group)
  const day = isRelativeLabel(group) ? `${date.getMonth() + 1} 月 ${date.getDate()} 日 ` : ''
  return `${day}星期${WEEKDAYS[date.getDay()]} · ${group.activities.length} 筆`
}
</script>

<style scoped>
.activity-timeline {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.daygroup {
  display: grid;
  gap: 8px;
}

.timeline__date-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 6px 0;
}

.timeline__date-label {
  margin: 0;
  font: 600 17px var(--ui-font-display);
  letter-spacing: -0.01em;
  color: var(--ui-ink);
}

.timeline__date-meta {
  font-size: 12.5px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.group-card {
  overflow: hidden;
}

.timeline__divider {
  height: 0.5px;
  margin: 0 22px 0 74px;
  background: var(--ui-sep);
}

@media (max-width: 768px) {
  .timeline__divider {
    margin: 0 16px 0 62px;
  }
}
</style>
