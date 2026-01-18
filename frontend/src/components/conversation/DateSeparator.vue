<template>
  <div class="flex items-center my-6 mb-4 gap-3 md:my-4 md:mb-3 md:gap-2">
    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
    <div class="py-2 px-4 bg-gray-900 border border-gray-900 rounded-full text-xs font-bold text-white whitespace-nowrap text-center shadow-sm min-w-[80px] md:py-1 md:px-3 md:text-[0.7rem] md:min-w-[60px] dark:bg-gray-100 dark:border-gray-100 dark:text-gray-900">
      {{ formattedDate }}
    </div>
    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  date: Date | string | number
}

const props = defineProps<Props>()

const formattedDate = computed(() => {
  let messageDate: Date
  
  if (typeof props.date === 'number') {
    messageDate = new Date(props.date)
  } else if (typeof props.date === 'string') {
    messageDate = new Date(props.date)
  } else {
    messageDate = props.date
  }
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())
  
  if (messageDay.getTime() === today.getTime()) {
    return '今天'
  } else if (messageDay.getTime() === yesterday.getTime()) {
    return '昨天'
  } else {
    return messageDate.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }
})
</script>

<style scoped>
/* All styles converted to Tailwind utilities */
</style>