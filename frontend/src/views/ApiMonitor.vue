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
        :causes="controller.statusCauses.value.map(c => c.text)"
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

      <template v-if="hasMetrics">
        <!-- KPI tiles: click opens the endpoint list for that status -->
        <section class="grid-4">
          <ApiStatsGrid
            :stats="controller.stats.value"
            @stat-click="handleStatClick"
          />
        </section>
      </template>

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

          <RecentEventsCard :events="controller.events.value" />
        </div>

        <div class="s4 stack">
          <InfrastructureCard :infrastructure="controller.infrastructure.value" />
          <ChannelIntegrationsCard :channels="controller.channels.value" />
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

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
  .grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Phone: a compact 2 x 2 grid */
@media (max-width: 768px) {
  .grid-4 {
    gap: 12px;
  }
}
</style>
