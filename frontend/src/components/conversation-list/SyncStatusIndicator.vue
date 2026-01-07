<!--
  Sync Status Indicator Component

  显示同步状态的视觉指示器（SSE/WebSocket/Polling）

  @example
  <SyncStatusIndicator status="connected" :is-syncing="false" />
-->
<template>
  <div
    class="flex items-center gap-2 py-2 px-3 border rounded-md text-xs font-medium whitespace-nowrap"
    :class="{
      'bg-green-50 border-green-200 text-green-700': status === 'connected',
      'bg-yellow-50 border-yellow-200 text-yellow-700': status === 'polling',
      'bg-blue-50 border-blue-200 text-blue-700': status === 'connecting',
      'bg-red-50 border-red-200 text-red-700': status === 'error'
    }"
  >
    <div
      class="sync-dot flex-shrink-0"
      :class="{
        'bg-green-500': status === 'connected' && !isSyncing,
        'bg-yellow-500': status === 'polling' && !isSyncing,
        'bg-blue-500': status === 'connecting' || isSyncing,
        'bg-red-500': status === 'error' && !isSyncing,
        'syncing': isSyncing || status === 'connecting'
      }"
    />
    <span>
      <template v-if="status === 'connected'">SSE連線</template>
      <template v-else-if="status === 'polling'">輪詢模式</template>
      <template v-else-if="status === 'connecting'">連線中</template>
      <template v-else-if="isSyncing">更新中</template>
      <template v-else>{{ status }}</template>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { SyncStatus } from '@/composables/conversation/useConversationSync'

export interface SyncStatusIndicatorProps {
  /** 同步状态 */
  status?: SyncStatus
  /** 是否正在同步 */
  isSyncing?: boolean
}

withDefaults(defineProps<SyncStatusIndicatorProps>(), {
  status: 'disconnected',
  isSyncing: false
})
</script>

<style scoped>
/* Sync dot - Size and animation */
.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.sync-dot.syncing {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}
</style>
