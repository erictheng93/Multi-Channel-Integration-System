<template>
  <div
    class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    @click="$emit('toggle')"
  >
    <!-- Main row -->
    <div class="flex items-center gap-3 px-5 py-4">
      <!-- Status dot -->
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
        :class="statusDotClass"
      />

      <!-- Method badge -->
      <span
        class="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide flex-shrink-0"
        :class="methodBadgeClass"
      >
        {{ endpoint.method }}
      </span>

      <!-- Path -->
      <span class="font-mono text-[13px] text-[#1C1C1E] truncate flex-1">
        {{ endpoint.endpoint }}
      </span>

      <!-- Description (hidden on small screens) -->
      <span class="hidden lg:block text-[12px] text-[#8E8E93] truncate max-w-[200px]">
        {{ endpoint.description }}
      </span>

      <!-- Metrics -->
      <div class="flex items-center gap-4 flex-shrink-0 ml-2">
        <span
          class="text-[13px] font-semibold tabular-nums"
          :class="p95ColorClass"
        >
          {{ endpoint.responseTime }}ms
        </span>
        <span
          class="text-[13px] font-semibold tabular-nums"
          :class="successRateColorClass"
        >
          {{ endpoint.successRate }}%
        </span>
        <span class="text-[12px] text-[#8E8E93] tabular-nums hidden sm:inline">
          {{ endpoint.requestCount }}/h
        </span>
      </div>

      <!-- Chevron -->
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8E8E93"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="flex-shrink-0 transition-transform duration-200"
        :class="{ 'rotate-90': expanded }"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>

    <!-- Expanded detail panel -->
    <EndpointDetailPanel
      v-if="expanded"
      :endpoint="endpoint"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint } from '@/types/api-monitor'
import EndpointDetailPanel from './EndpointDetailPanel.vue'

const props = defineProps<{
  endpoint: ApiEndpoint
  expanded: boolean
}>()

defineEmits<{
  (_e: 'toggle'): void
}>()

const statusDotClass = computed(() => {
  const map: Record<string, string> = {
    healthy: 'bg-[#34C759]',
    warning: 'bg-[#FF9500]',
    error: 'bg-[#FF3B30]',
  }
  return map[props.endpoint.status] ?? 'bg-[#8E8E93]'
})

const methodBadgeClass = computed(() => {
  const map: Record<string, string> = {
    GET: 'bg-[#34C759]/10 text-[#34C759]',
    POST: 'bg-[#007AFF]/10 text-[#007AFF]',
    PUT: 'bg-[#FF9500]/10 text-[#FF9500]',
    PATCH: 'bg-[#AF52DE]/10 text-[#AF52DE]',
    DELETE: 'bg-[#FF3B30]/10 text-[#FF3B30]',
    HEAD: 'bg-[#8E8E93]/10 text-[#8E8E93]',
  }
  return map[props.endpoint.method] ?? 'bg-[#8E8E93]/10 text-[#8E8E93]'
})

const p95ColorClass = computed(() => {
  const ms = props.endpoint.responseTime
  if (ms < 200) { return 'text-[#34C759]' }
  if (ms < 500) { return 'text-[#FF9500]' }
  return 'text-[#FF3B30]'
})

const successRateColorClass = computed(() => {
  const rate = props.endpoint.successRate
  if (rate >= 99) { return 'text-[#34C759]' }
  if (rate >= 95) { return 'text-[#FF9500]' }
  return 'text-[#FF3B30]'
})
</script>
