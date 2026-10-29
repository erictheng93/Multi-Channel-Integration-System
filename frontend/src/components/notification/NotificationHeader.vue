<template>
  <UiPageHead
    title="通知"
    :subtitle="subtitle"
  >
    <template #actions>
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        title="通知設定"
        @click="$emit('open-settings')"
      >
        <SettingsIcon />
        通知設定
      </button>
      <button
        v-if="hasUnread"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="markingAllRead"
        @click="$emit('mark-all-read')"
      >
        <CheckAllIcon v-if="!markingAllRead" />
        <LoadingSpinner
          v-else
          size="sm"
        />
        <span>全部標記已讀</span>
      </button>
    </template>
  </UiPageHead>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { computed } from 'vue'
import { CheckAllIcon, SettingsIcon } from '@/components/icons'
import { LoadingSpinner } from '@/components/ui'
import type { NotificationStats } from '@/stores/notifications'

const props = defineProps<{
  hasUnread: boolean
  markingAllRead: boolean
  stats?: NotificationStats | null
}>()

defineEmits<{
  'mark-all-read': []
  'open-settings': []
}>()

// "3 則未讀，其中 1 則為緊急。今天新增 7 則、本週共 23 則通知。" from /notifications/stats
const subtitle = computed(() => {
  const s = props.stats
  if (!s) { return ' ' }
  const urgent = s.byPriority?.urgent?.unread ?? 0
  const lead = s.unread > 0
    ? `${s.unread} 則未讀${urgent > 0 ? `，其中 ${urgent} 則為緊急` : ''}。`
    : '沒有未讀通知。'
  return `${lead}今天新增 ${s.timeRange?.today ?? 0} 則、本週共 ${s.timeRange?.thisWeek ?? 0} 則通知。`
})
</script>

<style scoped>
.btn svg {
  width: 16px;
  height: 16px;
}
</style>
