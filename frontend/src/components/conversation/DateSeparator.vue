<template>
  <div class="date-separator">
    <span class="date-label">{{ formattedDate }}</span>
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
/* Quiet centered date label (no hard pill) */
.date-separator {
  display: flex;
  justify-content: center;
  margin: 20px 0 12px;
}

.date-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
  white-space: nowrap;
}
</style>
