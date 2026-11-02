<template>
  <AppLayout>
    <div class="ui-page rl-page api-monitor">
      <ApiHeader
        :loading="controller.loading.value"
        :is-refreshing="controller.isRefreshing.value"
        :auto-refresh-enabled="controller.autoRefresh.value.enabled"
        :system-status="controller.systemStatus.value"
        :last-updated="controller.lastUpdated.value"
        :stats="controller.stats.value"
        :metrics-configured="controller.metricsConfigured.value"
        :causes="[]"
        :show-status="false"
        @refresh="controller.refreshAll"
        @toggle-auto-refresh="controller.toggleAutoRefresh"
      />

      <!-- Error Banner -->
      <div
        v-if="controller.error.value"
        class="error-banner"
        role="alert"
      >
        {{ controller.error.value }}
      </div>

      <!-- Lead: the overall verdict, endpoints healthy as an arc, and the four clickable counts -->
      <RingLead
        kicker="整體狀態"
        :value="leadValue ?? '—'"
        :busy="controller.loading.value && !controller.lastUpdated.value"
        :tone="leadTone"
        :meaning="leadMeaning"
      >
        <template
          v-if="endpointBars.length > 0"
          #visual
        >
          <figure
            class="p95"
            role="img"
            :aria-label="p95Aria"
          >
            <figcaption class="p95-head">
              <span>端點 P95 回應時間</span>
              <span>{{ p95Max.label }} 為滿格</span>
            </figcaption>
            <ol class="p95-list">
              <li
                v-for="row in p95Rows"
                :key="row.key"
                :class="`is-${row.tone}`"
              >
                <span class="p95-path">{{ row.path }}</span>
                <span class="p95-track">
                  <i :style="{ width: row.pct }" />
                  <u
                    v-if="p95Max.mark !== null"
                    :style="{ left: p95Max.mark }"
                  />
                </span>
                <b class="p95-val">{{ row.display }}</b>
                <span class="p95-n">{{ row.count }}/時</span>
              </li>
            </ol>
            <p class="p95-note">
              <span v-if="p95Max.mark !== null"><u />500 ms 警戒線</span>
              <span>顏色是端點目前的狀態</span>
            </p>
          </figure>
        </template>
        <div
          v-if="hasMetrics"
          class="lead-stats"
        >
          <ApiStatsGrid
            :stats="controller.stats.value"
            @stat-click="handleStatClick"
          />
        </div>
      </RingLead>

      <section class="bento">
        <div class="s8 stack">
          <ApiMetricsSetup
            v-if="!hasMetrics && !controller.loading.value"
            :error="controller.metricsError.value"
          />

          <section
            v-else-if="hasMetrics"
            aria-label="端點狀態"
          >
            <h2 class="ui-group-label">
              端點狀態
              <span class="label-note">點選一列查看延遲分布與狀態碼</span>
            </h2>
            <div class="ui-group endpoints">
              <ApiFilter
                :filters="controller.filters.value"
                :counts="statusCounts"
                @update:filters="handleFilterUpdate"
              />
              <ApiCardList
                :endpoints="controller.filteredApis.value"
                :expanded-card="controller.expandedCard.value"
                :total="controller.endpoints.value.length"
                @toggle-card="controller.toggleCard"
              />
            </div>
          </section>

          <div
            v-else
            class="ui-card loading"
          >
            載入中...
          </div>
        </div>

        <div class="s4 stack">
          <InfrastructureCard :infrastructure="controller.infrastructure.value" />
          <ChannelIntegrationsCard :channels="controller.channels.value" />
        </div>
        <div class="s12">
          <RecentEventsCard :events="controller.events.value" />
        </div>
      </section>

      <!-- Statistics Detail Modal -->
      <ApiModal
        v-if="controller.modal.value.show"
        :modal-state="controller.modal.value"
        :total-apis="controller.endpoints.value.length"
        @close="controller.closeModal"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useApiMonitorController } from '@/composables/useApiMonitorController'
import AppLayout from '@/components/ui/AppLayout.vue'
import {
  ApiHeader,
  ApiStatsGrid,
  ApiFilter,
  ApiCardList,
  ApiModal,
  InfrastructureCard,
  ChannelIntegrationsCard,
  RecentEventsCard,
} from '@/components/api-monitor'
import ApiMetricsSetup from '@/components/api-monitor/ApiMetricsSetup.vue'
import RingLead from '@/components/lead/RingLead.vue'
import type { ApiStatus, FilterState } from '@/types/api-monitor'

// Initialize controller
const controller = useApiMonitorController()

/** Endpoint metrics exist only once Analytics Engine is configured and the last query succeeded. */
const hasMetrics = computed(
  () => controller.metricsConfigured.value && !controller.metricsError.value,
)

const statusCounts = computed(() => {
  const endpoints = controller.endpoints.value
  return {
    all: endpoints.length,
    healthy: endpoints.filter(e => e.status === 'healthy').length,
    warning: endpoints.filter(e => e.status === 'warning').length,
    error: endpoints.filter(e => e.status === 'error').length,
  }
})

const LEAD_LABEL = { operational: '運作正常', degraded: '部分降級', outage: '服務中斷' } as const
const LEAD_TONE = { operational: 'good', degraded: 'warn', outage: 'bad' } as const

/** The overall verdict; null until the first check lands */
const leadValue = computed<string | null>(() =>
  controller.lastUpdated.value ? LEAD_LABEL[controller.systemStatus.value] : null,
)
const leadTone = computed(() => (leadValue.value ? LEAD_TONE[controller.systemStatus.value] : 'none'))

const STATUS_TONE = { healthy: 'good', warning: 'warn', error: 'bad' } as const
const STATUS_ORDER = { error: 0, warning: 1, healthy: 2 } as const

/** One row per tracked endpoint, the bar as long as its P95, coloured by its state; worst first (only when endpoint metrics exist) */
const WARN_MS = 500
const p95Source = computed(() => {
  if (!hasMetrics.value) { return [] }
  return [...controller.endpoints.value]
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || b.responseTime - a.responseTime)
    .slice(0, 6)
})
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`)
const p95Ceiling = computed(() => Math.max(WARN_MS, ...p95Source.value.map(e => e.responseTime)))
const p95Max = computed(() => ({
  label: fmtMs(p95Ceiling.value),
  mark: p95Ceiling.value > WARN_MS ? `${(WARN_MS / p95Ceiling.value) * 100}%` : null
}))
const p95Rows = computed(() => p95Source.value.map(e => ({
  key: e.id,
  path: e.endpoint.replace(/^\/api/, ''),
  pct: e.responseTime <= 0 ? '2px' : `${Math.max(2, Math.round((e.responseTime / p95Ceiling.value) * 100))}%`,
  display: fmtMs(e.responseTime),
  count: e.requestCount.toLocaleString('en-US'),
  tone: STATUS_TONE[e.status] ?? 'muted'
})))
const p95Aria = computed(() => `端點 P95 回應時間：${p95Rows.value.map(r => `${r.path} ${r.display}`).join('；')}`)
const endpointBars = p95Rows

/** One line of why: the failing components (the header subtitle carries the endpoint counts) */
const leadMeaning = computed(() => {
  const causes = controller.statusCauses.value.map(c => c.text)
  if (causes.length > 0) {
    return `${causes.join('、')}。`
  }
  if (!hasMetrics.value) {
    return '尚未設定端點指標，僅檢查基礎設施與頻道。'
  }
  return controller.systemStatus.value === 'operational' ? '基礎設施、頻道與端點皆正常。' : '部分端點延遲或錯誤率偏高。'
})

// Lifecycle
onMounted(async () => {
  await controller.initialize()
})

onUnmounted(() => {
  controller.cleanup()
})

// Event Handlers
function handleStatClick(type: string) {
  if (type === 'all') {return}
  controller.showStatDetails(type as ApiStatus)
}

function handleFilterUpdate(filters: FilterState) {
  controller.filters.value = filters
}
</script>

<style scoped>

.error-banner {
  padding: 12px 16px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-red-soft);
  font-size: 13.5px;
  color: var(--ui-red-ink);
}

.endpoints {
  padding-top: 14px;
}

.p95 {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  margin: 0;
}

.p95-head,
.p95-note {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.p95-head span:first-child {
  font-weight: 600;
  color: var(--ui-ink);
}

.p95-list {
  display: grid;
  gap: 9px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.p95-list li {
  --c: var(--ui-green);
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 64px 70px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.p95-list li.is-warn { --c: var(--ui-orange); }
.p95-list li.is-bad { --c: var(--ui-red); }

.p95-path {
  overflow: hidden;
  font: 13px var(--ui-font-mono);
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p95-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--ui-fill);
}

.p95-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--c);
}

.p95-track u {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 0;
  border-left: 1.5px dashed var(--ui-muted);
}

.p95-val {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.p95-n {
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.p95-note u {
  display: inline-block;
  width: 0;
  height: 11px;
  margin-right: 6px;
  border-left: 1.5px dashed var(--ui-muted);
  vertical-align: -1px;
}

.p95-note span:first-child:not(:only-child) {
  margin-right: auto;
}

@media (max-width: 768px) {
  .p95-list li {
    grid-template-columns: minmax(0, 1fr) 64px;
    gap: 4px 10px;
  }

  .p95-path {
    grid-column: 1;
  }

  .p95-val {
    grid-column: 2;
    grid-row: 1;
  }

  .p95-track {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .p95-n {
    display: none;
  }
}

.lead-stats {
  margin-top: 14px;
}

.label-note {
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.s8 {
  grid-column: span 8;
}

.s4 {
  grid-column: span 4;
}

.s12 {
  grid-column: span 12;
}

.stack {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.loading {
  padding: 40px;
  text-align: center;
  color: var(--ui-muted);
}

@media (max-width: 1280px) {
  .s8,
  .s4 {
    grid-column: span 12;
  }
}

</style>
