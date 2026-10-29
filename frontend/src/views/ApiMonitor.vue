<template>
  <AppLayout>
    <div class="ui-page api-monitor">
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

      <!-- Lead metric: the overall verdict, with the four counts beside it -->
      <section
        class="top"
        :class="{ 'is-solo': !hasMetrics }"
      >
        <article class="ui-card lead-card">
          <UiLeadMetric
            label="整體狀態"
            :value="leadValue"
            :loading="controller.loading.value && !controller.lastUpdated.value"
            :meaning="leadMeaning"
            :tone="leadTone"
          />
        </article>
        <div
          v-if="hasMetrics"
          class="kpis"
        >
          <ApiStatsGrid
            :stats="controller.stats.value"
            @stat-click="handleStatClick"
          />
        </div>
      </section>

      <section class="bento">
        <div class="s8 stack">
          <ApiMetricsSetup
            v-if="!hasMetrics && !controller.loading.value"
            :error="controller.metricsError.value"
          />

          <article
            v-else-if="hasMetrics"
            class="ui-card"
          >
            <div class="ui-card-head">
              <div>
                <h2 class="ui-card-title">
                  端點狀態
                </h2>
                <div class="ui-card-sub">
                  點選一列查看延遲分布與狀態碼
                </div>
              </div>
            </div>
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
          </article>

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
import UiLeadMetric from '@/components/ui/UiLeadMetric.vue'
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
const LEAD_TONE = { operational: 'green', degraded: 'orange', outage: 'red' } as const

/** The overall verdict; null until the first check lands */
const leadValue = computed<string | null>(() =>
  controller.lastUpdated.value ? LEAD_LABEL[controller.systemStatus.value] : null,
)
const leadTone = computed(() => LEAD_TONE[controller.systemStatus.value])

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

.top {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 16px;
}

.top.is-solo {
  grid-template-columns: minmax(0, 1fr);
}

.lead-card {
  overflow: hidden;
}

/* keep the one-line reason clear of the disc crop in the corner */
.lead-card :deep(.ui-lead-meaning) {
  max-width: min(100%, 300px);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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

@media (max-width: 1024px) {
  .top {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Phone: a compact 2 x 2 grid */
@media (max-width: 768px) {
  .kpis {
    gap: 12px;
  }
}
</style>
