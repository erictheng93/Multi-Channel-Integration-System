<template>
  <AppLayout>
    <div class="max-w-[1400px] mx-auto px-5 pb-8">
      <!-- Header -->
      <ApiHeader
        :loading="controller.loading.value"
        :is-refreshing="controller.isRefreshing.value"
        :auto-refresh-enabled="controller.autoRefresh.value.enabled"
        :system-status="controller.systemStatus.value"
        :last-updated="controller.lastUpdated.value"
        @refresh="controller.refreshAll"
        @toggle-auto-refresh="controller.toggleAutoRefresh"
      />

      <!-- Error Banner -->
      <div
        v-if="controller.error.value"
        class="mb-4 bg-[#FFF3F0] rounded-2xl p-4 text-[#FF3B30] text-sm"
      >
        {{ controller.error.value }}
      </div>

      <!-- Bento Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Row 1: Stat Cards (4 individual cards) -->
        <ApiStatsGrid
          :stats="controller.stats.value"
          @stat-click="handleStatClick"
        />

        <!-- Row 2: Endpoints (span 3) + Infrastructure (span 1) -->
        <div class="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5">
          <ApiFilter
            :filters="controller.filters.value"
            @update:filters="handleFilterUpdate"
          />
          <ApiCardList
            :endpoints="controller.filteredApis.value"
            :expanded-card="controller.expandedCard.value"
            @toggle-card="controller.toggleCard"
          />
        </div>

        <InfrastructureCard
          class="col-span-1"
          :infrastructure="controller.infrastructure.value"
        />

        <!-- Row 3: Channels (span 2) + Events (span 2) -->
        <ChannelIntegrationsCard
          class="col-span-1 md:col-span-1 lg:col-span-2"
          :channels="controller.channels.value"
        />
        <RecentEventsCard
          class="col-span-1 md:col-span-1 lg:col-span-2"
          :events="controller.events.value"
        />
      </div>

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
  InfrastructureCard,
  ChannelIntegrationsCard,
  RecentEventsCard,
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
  if (type === 'all') {return}
  controller.showStatDetails(type as ApiStatus)
}

function handleFilterUpdate(filters: FilterState) {
  controller.filters.value = filters
}
</script>
