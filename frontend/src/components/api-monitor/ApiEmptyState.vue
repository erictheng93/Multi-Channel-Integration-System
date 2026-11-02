<template>
  <UiEmptyState
    class="empty-state"
    :title="title"
    :description="message"
  >
    <template #icon>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><circle
        cx="11"
        cy="11"
        r="7"
      /><path d="m21 21-4.3-4.3" /></svg>
    </template>
  </UiEmptyState>
</template>

<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
interface Props {
  title?: string
  message?: string
}

withDefaults(defineProps<Props>(), {
  title: '未找到匹配的API',
  message: '請調整篩選條件或搜索關鍵詞'
})
</script>
