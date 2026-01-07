<template>
  <div class="bg-white border-b border-gray-200 p-6">
    <div class="flex items-start justify-between md:flex-col md:gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 m-0 mb-2 md:text-2xl">
          對話管理
        </h1>
        <p class="text-base text-gray-600 m-0">
          管理所有客戶對話，快速回應客戶需求
        </p>
      </div>

      <div class="flex items-center gap-3 md:w-full">
        <!-- 智能快取狀態指示器 -->
        <CacheStatusIndicator
          v-if="cacheHitRate > 0"
          :hit-rate="cacheHitRate"
        />

        <!-- 混合同步狀態指示器 -->
        <SyncStatusIndicator
          v-if="syncStatus !== 'disconnected'"
          :status="syncStatus"
          :is-syncing="isSyncing"
        />

        <button
          class="btn btn-secondary"
          :disabled="isRefreshing"
          @click="onRefresh"
        >
          <RefreshIcon :spinning="isRefreshing" />
          重新整理
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SyncStatus } from '@/composables/conversation/useConversationSync'
import { RefreshIcon } from '@/components/icons'
import CacheStatusIndicator from './CacheStatusIndicator.vue'
import SyncStatusIndicator from './SyncStatusIndicator.vue'

export interface ConversationHeaderProps {
  /** 缓存命中率（百分比） */
  cacheHitRate: number
  /** 同步状态 */
  syncStatus: SyncStatus
  /** 是否正在同步 */
  isSyncing: boolean
  /** 是否正在刷新 */
  isRefreshing: boolean
}

defineProps<ConversationHeaderProps>()

const emit = defineEmits<{
  refresh: []
}>()

function onRefresh() {
  emit('refresh')
}
</script>

<style scoped>
/* All styles converted to Tailwind utilities */
</style>
