<template>
  <div class="date-separator">
    <div class="separator-line"></div>
    <div class="separator-label">
      {{ formattedDate }}
    </div>
    <div class="separator-line"></div>
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
.date-separator {
  display: flex;
  align-items: center;
  margin: var(--space-6) 0 var(--space-4) 0;
  gap: var(--space-3);
}

.separator-line {
  flex: 1;
  height: 1px;
  background: var(--gray-300);
}

.separator-label {
  padding: var(--space-2) var(--space-4);
  background: var(--gray-100);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gray-600);
  white-space: nowrap;
  text-align: center;
  min-width: 80px;
}

/* 深色主題支持 */
@media (prefers-color-scheme: dark) {
  .separator-line {
    background: var(--gray-600);
  }
  
  .separator-label {
    background: var(--gray-800);
    border-color: var(--gray-600);
    color: var(--gray-300);
  }
}

/* 移動端優化 */
@media (max-width: 768px) {
  .date-separator {
    margin: var(--space-4) 0 var(--space-3) 0;
    gap: var(--space-2);
  }
  
  .separator-label {
    padding: var(--space-1) var(--space-3);
    font-size: 0.7rem;
    min-width: 60px;
  }
}
</style>