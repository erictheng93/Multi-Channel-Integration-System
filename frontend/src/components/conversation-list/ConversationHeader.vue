<template>
  <div class="conversation-header">
    <div class="header-content">
      <div class="header-info">
        <h1 class="page-title">
          對話管理
        </h1>
        <p class="page-subtitle">
          管理所有客戶對話，快速回應客戶需求
        </p>
      </div>

      <div class="header-actions">
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
.conversation-header {
  background-color: white;
  border-bottom: 1px solid var(--gray-200);
  padding: var(--space-6);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: var(--space-4);
  }

  .header-actions {
    width: 100%;
  }

  .page-title {
    font-size: 1.5rem;
  }
}
</style>
