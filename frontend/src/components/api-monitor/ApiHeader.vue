<template>
  <UiPageHead
    title="API 監控"
    :subtitle="subtitle"
  >
    <template #actions>
      <span
        v-if="showStatus"
        class="ui-pill ui-pill-dot"
        :class="statusPillClass"
      >{{ statusLabel }}</span>

      <span class="live">
        自動更新
        <button
          type="button"
          class="ui-switch"
          role="switch"
          :aria-checked="autoRefreshEnabled"
          aria-label="自動更新"
          @click="handleAutoRefreshToggle"
        />
      </span>

      <button
        type="button"
        class="btn btn-secondary btn-sm"
        aria-label="重新整理"
        :disabled="loading || isRefreshing"
        @click="$emit('refresh')"
      >
        <svg
          class="ico"
          :class="{ spinning: loading || isRefreshing }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5" /></svg>
        重新整理
      </button>
    </template>
  </UiPageHead>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { computed } from 'vue'
import type { ApiStatistics, SystemStatus } from '@/types/api-monitor'

interface Props {
  loading?: boolean
  isRefreshing?: boolean
  autoRefreshEnabled?: boolean
  systemStatus?: SystemStatus
  lastUpdated?: Date | null
  stats?: ApiStatistics | null
  /** false = endpoint metrics are not set up, so the endpoint counts are meaningless */
  metricsConfigured?: boolean
  /** Failing components, named in the subtitle (e.g. 「Facebook Messenger 連線錯誤」) */
  causes?: string[]
  /** Show the status pill; pages that carry the status in a lead metric turn it off */
  showStatus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  isRefreshing: false,
  autoRefreshEnabled: true,
  systemStatus: 'operational',
  lastUpdated: null,
  stats: null,
  metricsConfigured: true,
  causes: () => [],
  showStatus: true,
})

const emit = defineEmits<{
  (_e: 'refresh'): void
  (_e: 'toggle-auto-refresh'): void
}>()

function handleAutoRefreshToggle() {
  emit('toggle-auto-refresh')
}

const subtitle = computed(() => {
  if (!props.lastUpdated) { return '等待第一次檢查...' }
  const time = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(props.lastUpdated)
  const checked = ` · 最後檢查 ${time}`
  const causeText = props.causes.length > 0 ? `${props.causes.join('、')}。` : ''
  if (!props.metricsConfigured) {
    return `${causeText}尚未設定端點指標${checked}`
  }
  const stats = props.stats
  if (!stats || stats.totalEndpoints === 0) {
    return `${causeText}目前沒有端點資料${checked}`
  }
  if (stats.errorCount === 0 && stats.warningCount === 0) {
    return `${causeText}全部 ${stats.totalEndpoints} 個端點正常${checked}`
  }
  return `${causeText}${stats.errorCount} 個端點異常、${stats.warningCount} 個需留意${checked}`
})

const statusLabel = computed(() => {
  const map: Record<SystemStatus, string> = {
    operational: '運作正常',
    degraded: '部分降級',
    outage: '服務中斷',
  }
  return map[props.systemStatus]
})

const statusPillClass = computed(() => {
  const map: Record<SystemStatus, string> = {
    operational: 'ui-pill-green',
    degraded: 'ui-pill-orange',
    outage: 'ui-pill-red',
  }
  return map[props.systemStatus]
})
</script>

<style scoped>
.live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.ico {
  width: 14px;
  height: 14px;
}

.ico.spinning {
  animation: api-spin 0.8s linear infinite;
}

@keyframes api-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
