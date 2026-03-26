<template>
  <div class="bg-[#FAFBFC] border-t border-[#F2F2F7] px-5 py-4">
    <!-- Metrics grid -->
    <div class="grid grid-cols-4 gap-4 mb-4">
      <div>
        <div class="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">
          p50 Latency
        </div>
        <div class="text-[17px] font-semibold text-[#1C1C1E]">
          {{ endpoint.p50ResponseTime }}ms
        </div>
      </div>
      <div>
        <div class="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">
          p95 Latency
        </div>
        <div
          class="text-[17px] font-semibold"
          :class="p95ColorClass"
        >
          {{ endpoint.responseTime }}ms
        </div>
      </div>
      <div>
        <div class="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">
          Requests/h
        </div>
        <div class="text-[17px] font-semibold text-[#1C1C1E]">
          {{ endpoint.requestCount }}
        </div>
      </div>
      <div>
        <div class="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-1">
          Errors/h
        </div>
        <div
          class="text-[17px] font-semibold"
          :class="endpoint.errorCount > 0 ? 'text-[#FF3B30]' : 'text-[#1C1C1E]'"
        >
          {{ endpoint.errorCount }}
        </div>
      </div>
    </div>

    <!-- Mini bar chart (CSS-only placeholder) -->
    <div class="mb-4">
      <div class="text-[11px] text-[#8E8E93] uppercase tracking-wide mb-2">
        Response Time Distribution
      </div>
      <div class="flex items-end gap-[2px] h-10">
        <div
          v-for="(bar, i) in responseBars"
          :key="i"
          class="flex-1 rounded-t-sm transition-all duration-200"
          :style="{ height: bar.height + '%', backgroundColor: bar.color }"
        />
      </div>
    </div>

    <!-- Bottom row -->
    <div class="flex items-center justify-between">
      <span class="text-[12px] text-[#8E8E93]">
        Last checked: {{ relativeLastCheck }}
      </span>
      <button
        disabled
        class="px-4 py-1.5 rounded-full text-[12px] font-medium bg-[#007AFF] text-white opacity-50 cursor-not-allowed"
      >
        Test Now
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint } from '@/types/api-monitor'

const props = defineProps<{
  endpoint: ApiEndpoint
}>()

const p95ColorClass = computed(() => {
  const ms = props.endpoint.responseTime
  if (ms < 200) {return 'text-[#34C759]'}
  if (ms < 500) {return 'text-[#FF9500]'}
  return 'text-[#FF3B30]'
})

const relativeLastCheck = computed(() => {
  const now = Date.now()
  const then = new Date(props.endpoint.lastCheck).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) {return `${diffSec}s ago`}
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {return `${diffMin}m ago`}
  return `${Math.floor(diffMin / 60)}h ago`
})

// Generate pseudo-random bar chart from endpoint data
const responseBars = computed(() => {
  const count = 16
  const bars: Array<{ height: number; color: string }> = []
  const avg = props.endpoint.avgResponseTime
  const p50 = props.endpoint.p50ResponseTime
  const p95 = props.endpoint.responseTime

  // Seed simple deterministic variation from endpoint id
  let seed = 0
  for (let i = 0; i < props.endpoint.id.length; i++) {
    seed = ((seed << 5) - seed + props.endpoint.id.charCodeAt(i)) | 0
  }

  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const variation = (seed % 100) / 100
    const value = p50 + (p95 - p50) * variation
    const maxVal = p95 * 1.2 || 1
    const pct = Math.max(10, Math.min(100, (value / maxVal) * 100))

    let color = '#34C759'
    if (value >= avg * 1.5) {color = '#FF3B30'}
    else if (value >= avg) {color = '#FF9500'}

    bars.push({ height: pct, color })
  }
  return bars
})
</script>
