<template>
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-[#1C1C1E] m-0">
        System Status
      </h1>
      <p class="text-[15px] text-[#8E8E93] mt-1 m-0">
        {{ lastUpdatedText }}
      </p>
    </div>

    <div class="flex items-center gap-3">
      <!-- Auto-refresh toggle -->
      <button
        class="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-200"
        :class="autoRefreshEnabled
          ? 'bg-[#007AFF]/10 text-[#007AFF]'
          : 'bg-[#F2F2F7] text-[#8E8E93]'"
        @click="handleAutoRefreshToggle"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-3-6.74" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        Auto
      </button>

      <!-- System status badge -->
      <span
        class="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium"
        :class="statusBadgeClass"
      >
        <span
          class="w-2 h-2 rounded-full"
          :class="statusDotClass"
        />
        {{ statusLabel }}
      </span>

      <!-- Refresh button -->
      <button
        class="flex items-center justify-center w-9 h-9 rounded-full bg-[#F2F2F7] text-[#1C1C1E] transition-colors duration-200 hover:bg-[#E5E5EA] border-none cursor-pointer"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="transition-transform duration-300"
          :class="{ 'animate-spin': loading }"
        >
          <path d="M21 12a9 9 0 1 1-3-6.74" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SystemStatus } from '@/types/api-monitor'

interface Props {
  loading?: boolean
  isRefreshing?: boolean
  autoRefreshEnabled?: boolean
  systemStatus?: SystemStatus
  lastUpdated?: Date | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  isRefreshing: false,
  autoRefreshEnabled: true,
  systemStatus: 'operational',
  lastUpdated: null,
})

const emit = defineEmits<{
  (_e: 'refresh'): void
  (_e: 'toggle-auto-refresh'): void
}>()

const autoRefreshEnabled = ref(props.autoRefreshEnabled)

watch(() => props.autoRefreshEnabled, (v) => {
  autoRefreshEnabled.value = v
})

function handleAutoRefreshToggle() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  emit('toggle-auto-refresh')
}

const lastUpdatedText = computed(() => {
  if (!props.lastUpdated) { return 'Waiting for first check...' }
  const now = Date.now()
  const then = props.lastUpdated.getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 5) { return 'Updated just now' }
  if (diffSec < 60) { return `Updated ${diffSec}s ago` }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) { return `Updated ${diffMin}m ago` }
  return `Updated ${Math.floor(diffMin / 60)}h ago`
})

const statusLabel = computed(() => {
  const map: Record<SystemStatus, string> = {
    operational: 'Operational',
    degraded: 'Degraded',
    outage: 'Outage',
  }
  return map[props.systemStatus]
})

const statusBadgeClass = computed(() => {
  const map: Record<SystemStatus, string> = {
    operational: 'bg-[#34C759]/10 text-[#34C759]',
    degraded: 'bg-[#FF9500]/10 text-[#FF9500]',
    outage: 'bg-[#FF3B30]/10 text-[#FF3B30]',
  }
  return map[props.systemStatus]
})

const statusDotClass = computed(() => {
  const map: Record<SystemStatus, string> = {
    operational: 'bg-[#34C759]',
    degraded: 'bg-[#FF9500]',
    outage: 'bg-[#FF3B30]',
  }
  return map[props.systemStatus]
})
</script>
