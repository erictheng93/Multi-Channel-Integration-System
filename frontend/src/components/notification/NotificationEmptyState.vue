<template>
  <UiEmptyState
    :title="hasActiveFilters ? '沒有符合條件的通知' : '暫無通知'"
    :description="hasActiveFilters ? '請嘗試調整篩選條件' : '新的通知將會顯示在這裡'"
  >
    <template #icon>
      <BellOffIcon />
    </template>
    <template
      v-if="hasActiveFilters"
      #action
    >
      <button
        class="btn btn-primary btn-sm"
        @click="$emit('clear-filters')"
      >
        清除篩選條件
      </button>
    </template>
  </UiEmptyState>
</template>

<script setup lang="ts">
import { BellOffIcon } from '@/components/icons'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'

defineProps<{
  hasActiveFilters: boolean
}>()

defineEmits<{
  'clear-filters': []
}>()
</script>
