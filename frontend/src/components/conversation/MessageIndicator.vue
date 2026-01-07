<template>
  <div class="flex flex-col p-3 bg-white/70 backdrop-blur-md rounded-lg border border-gray-200/60 text-sm md:p-2 md:text-[0.8125rem]">
    <!-- 消息統計 -->
    <div class="flex gap-4 md:gap-3">
      <div class="flex flex-col gap-1 flex-1">
        <span class="text-xs text-gray-500 font-medium md:text-xs">總消息數</span>
        <span class="text-sm text-gray-700 font-semibold">{{ totalMessages }}</span>
      </div>
      <div class="flex flex-col gap-1 flex-1">
        <span class="text-xs text-gray-500 font-medium md:text-xs">時間跨度</span>
        <span class="text-sm text-gray-700 font-semibold">{{ timeSpan }}</span>
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
  oldestMessage: null,
  latestMessage: null,
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
/* All styles converted to Tailwind utilities */
</style>