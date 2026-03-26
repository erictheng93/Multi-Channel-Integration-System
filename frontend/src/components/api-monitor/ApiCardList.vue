<template>
  <div class="flex flex-col gap-3">
    <ApiEmptyState
      v-if="endpoints.length === 0"
      title="No matching endpoints"
      message="Adjust filters or search to find endpoints"
    />
    <ApiCard
      v-for="ep in endpoints"
      :key="ep.id"
      :endpoint="ep"
      :expanded="expandedCard === ep.id"
      @toggle="$emit('toggle-card', ep.id)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiEndpoint } from '@/types/api-monitor'
import ApiCard from './ApiCard.vue'
import ApiEmptyState from './ApiEmptyState.vue'

defineProps<{
  endpoints: ApiEndpoint[]
  expandedCard: string | null
}>()

defineEmits<{
  (_e: 'toggle-card', _id: string): void
}>()
</script>
