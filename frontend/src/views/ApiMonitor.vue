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
        summary="端點狀態"
        :rings="endpointRings"
        :center-value="statusCounts.all > 0 ? `${statusCounts.healthy}/${statusCounts.all}` : undefined"
        center-label="正常"
        :size="144"
      >
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
import type { ServiceRing } from '@/components/ui/ServiceRings.vue'
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

/** One arc: endpoints currently healthy of all tracked (only when endpoint metrics exist) */
const endpointRings = computed<ServiceRing[]>(() => {
  if (!hasMetrics.value || statusCounts.value.all === 0) { return [] }
  const { healthy, warning, all, error } = statusCounts.value
  const rings: ServiceRing[] = [{ label: '端點正常', value: healthy, total: all, of: '個端點', hue: 'var(--ui-green)' }]
  if (warning + error > 0) {
    rings.push({ label: '需要注意', value: warning + error, total: all, of: '個端點', hue: error > 0 ? 'var(--ui-red)' : 'var(--ui-orange)' })
  }
  return rings
})

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
