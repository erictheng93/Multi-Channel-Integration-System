<template>
  <div class="activity-timeline">
    <template
      v-for="group in dateGroups"
      :key="group.date"
    >
      <div class="timeline__date-header">
        <span class="timeline__date-label">{{ group.label }}</span>
      </div>
      <template
        v-for="(activity, index) in group.activities"
        :key="activity.id"
      >
        <ActivityTimelineItem :activity="activity" />
        <div
          v-if="index < group.activities.length - 1"
          class="timeline__divider"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityLog } from '@/api/activities'
import { groupActivitiesByDate } from './utils'
import ActivityTimelineItem from './ActivityTimelineItem.vue'

const props = defineProps<{
  activities: ActivityLog[]
}>()

const dateGroups = computed(() => groupActivitiesByDate(props.activities))
</script>

<style scoped>
.activity-timeline {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  overflow: hidden;
}

.timeline__date-header {
  background: #F2F2F7;
  padding: 10px 20px;
}

.timeline__date-label {
  font-size: 12px;
  font-weight: 600;
  color: #8E8E93;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.timeline__divider {
  border-bottom: 1px solid #F3F4F6;
  margin-left: 68px;
}
</style>
