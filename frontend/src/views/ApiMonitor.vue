<template>
  <AppLayout>
    <div class="api-monitor">
      <!-- Header with refresh controls -->
      <ApiHeader
        :loading="controller.isRefreshing.value"
        :auto-refresh="controller.autoRefresh.enabled"
        @refresh="controller.refreshAll"
        @toggle-auto-refresh="handleAutoRefreshToggle"
      />

      <!-- WebSocket Migration Status Card -->
      <MigrationStatus :status="controller.migrationStatus.value" />

      <!-- Statistics Overview Grid -->
      <ApiStatsGrid
        :stats="controller.stats.value"
        @stat-click="controller.showStatDetails"
      />

      <!-- Filter Controls -->
      <ApiFilter v-model="controller.filters" />

      <!-- API Cards List -->
      <ApiCardList
        :apis="controller.filteredApis.value"
        :expanded-card="controller.expandedCard.value"
        @card-click="controller.toggleCard"
        @test="controller.testApi"
        @view-logs="handleViewLogs"
        @view-docs="handleViewDocs"
      />

      <!-- Statistics Detail Modal -->
      <ApiModal
        v-if="controller.modal.show"
        :modal-state="controller.modal"
        :total-apis="controller.apis.value.length"
        @close="controller.closeModal"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useApiMonitorController } from '@/composables/useApiMonitorController'
import AppLayout from '@/components/ui/AppLayout.vue'
import {
  ApiHeader,
  ApiStatsGrid,
  ApiFilter,
  ApiCardList,
  ApiModal,
  MigrationStatus
} from '@/components/api-monitor'
import type { ApiEndpoint } from '@/types/api-monitor'

// Initialize controller
const controller = useApiMonitorController()

// Lifecycle
onMounted(async () => {
  await controller.initialize()
})

onUnmounted(() => {
  controller.cleanup()
})

// Event Handlers
function handleAutoRefreshToggle(enabled: boolean) {
  controller.autoRefresh.enabled = enabled
  controller.toggleAutoRefresh()
}

function handleViewLogs(api: ApiEndpoint) {
  // Stub: Log viewer — requires backend /api/system/logs endpoint
  console.info('API logs requested for:', api.endpoint)
}

function handleViewDocs(api: ApiEndpoint) {
  // Stub: API docs viewer — render OpenAPI spec when available
  console.info('API documentation requested for:', api.endpoint)
}
</script>

<style scoped>
.api-monitor {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .api-monitor {
    padding: 0;
  }
}
</style>
