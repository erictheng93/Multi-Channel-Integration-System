<template>
  <div class="ui-empty">
    <div class="ui-empty-art">
      <BellOffIcon />
    </div>
    <h3>{{ hasActiveFilters ? '沒有符合條件的通知' : '暫無通知' }}</h3>
    <p>{{ hasActiveFilters ? '請嘗試調整篩選條件' : '新的通知將會顯示在這裡' }}</p>
    <button
      v-if="hasActiveFilters"
      class="btn btn-primary btn-sm"
      @click="$emit('clear-filters')"
    >
      清除篩選條件
    </button>
  </div>
</template>

<script setup lang="ts">
import { BellOffIcon } from '@/components/icons'

defineProps<{
  hasActiveFilters: boolean
}>()

defineEmits<{
  'clear-filters': []
}>()
</script>
