<template>
  <AppLayout>
    <div class="api-monitor">
      <!-- Header with refresh controls -->
      <ApiHeader
        :loading="controller.isRefreshing.value"
        :auto-refresh-enabled="controller.autoRefresh.value.enabled"
        @refresh="controller.refreshAll"
        @toggle-auto-refresh="controller.toggleAutoRefresh"
      />

      <!-- Statistics Overview Grid -->
      <ApiStatsGrid
        :stats="controller.stats.value"
        @stat-click="handleStatClick"
      />

      <!-- Filter Controls -->
      <ApiFilter
        :filters="controller.filters.value"
        @update:filters="handleFilterUpdate"
      />

      <!-- API Cards List -->
      <ApiCardList
        :endpoints="controller.filteredApis.value"
        :expanded-card="controller.expandedCard.value"
        @toggle-card="controller.toggleCard"
      />

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
import { onMounted, onUnmounted } from 'vue'
import { useApiMonitorController } from '@/composables/useApiMonitorController'
import AppLayout from '@/components/ui/AppLayout.vue'
import {
  ApiHeader,
  ApiStatsGrid,
  ApiFilter,
  ApiCardList,
  ApiModal,
} from '@/components/api-monitor'
import type { ApiStatus, FilterState } from '@/types/api-monitor'

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
function handleStatClick(type: string) {
  if (type === 'all') { return }
  controller.showStatDetails(type as ApiStatus)
}

function handleFilterUpdate(filters: FilterState) {
  controller.filters.value = filters
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
