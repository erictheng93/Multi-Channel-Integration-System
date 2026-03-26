<template>
  <!-- Renders 4 individual cards (no wrapper) so they participate in parent Bento Grid -->
  <div
    class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    @click="$emit('stat-click', 'healthy')"
  >
    <div class="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider mb-2">
      Healthy
    </div>
    <div class="text-[32px] font-bold text-[#34C759] leading-none mb-3">
      {{ stats.healthyCount }}
    </div>
    <div class="h-1 rounded-full bg-[#34C759]/10 overflow-hidden">
      <div
        class="h-full rounded-full bg-[#34C759] transition-all duration-300"
        :style="{ width: healthyPct + '%' }"
      />
    </div>
  </div>

  <div
    class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    @click="$emit('stat-click', 'warning')"
  >
    <div class="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider mb-2">
      Warnings
    </div>
    <div class="text-[32px] font-bold text-[#FF9500] leading-none mb-3">
      {{ stats.warningCount }}
    </div>
    <div class="h-1 rounded-full bg-[#FF9500]/10 overflow-hidden">
      <div
        class="h-full rounded-full bg-[#FF9500] transition-all duration-300"
        :style="{ width: warningPct + '%' }"
      />
    </div>
  </div>

  <div
    class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    @click="$emit('stat-click', 'error')"
  >
    <div class="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider mb-2">
      Errors
    </div>
    <div class="text-[32px] font-bold text-[#FF3B30] leading-none mb-3">
      {{ stats.errorCount }}
    </div>
    <div class="h-1 rounded-full bg-[#FF3B30]/10 overflow-hidden">
      <div
        class="h-full rounded-full bg-[#FF3B30] transition-all duration-300"
        :style="{ width: errorPct + '%' }"
      />
    </div>
  </div>

  <div
    class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5 cursor-pointer transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
    @click="$emit('stat-click', 'all')"
  >
    <div class="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider mb-2">
      Avg Response
    </div>
    <div class="text-[32px] font-bold text-[#007AFF] leading-none mb-3">
      {{ stats.avgResponseTime }}<span class="text-[16px] font-semibold ml-0.5">ms</span>
    </div>
    <div class="h-1 rounded-full bg-[#007AFF]/10 overflow-hidden">
      <div
        class="h-full rounded-full bg-[#007AFF] transition-all duration-300"
        :style="{ width: responsePct + '%' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiStatistics } from '@/types/api-monitor'

const props = defineProps<{
  stats: ApiStatistics
}>()

defineEmits<{
  (_e: 'stat-click', _type: string): void
}>()

const total = computed(() => props.stats.totalEndpoints || 1)

const healthyPct = computed(() =>
  Math.min(100, Math.round((props.stats.healthyCount / total.value) * 100)),
)

const warningPct = computed(() =>
  Math.min(100, Math.round((props.stats.warningCount / total.value) * 100)),
)

const errorPct = computed(() =>
  Math.min(100, Math.round((props.stats.errorCount / total.value) * 100)),
)

// Avg response time bar: cap at 1000ms for visual scale
const responsePct = computed(() =>
  Math.min(100, Math.round((props.stats.avgResponseTime / 1000) * 100)),
)
</script>
