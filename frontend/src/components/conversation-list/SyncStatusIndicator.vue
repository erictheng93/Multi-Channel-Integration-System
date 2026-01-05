<!--
  Sync Status Indicator Component

  显示同步状态的视觉指示器（SSE/WebSocket/Polling）

  @example
  <SyncStatusIndicator status="connected" :is-syncing="false" />
-->
<template>
  <div
    class="sync-status-indicator"
    :class="`status-${status}`"
  >
    <div
      class="sync-dot"
      :class="{ 'syncing': isSyncing }"
    />
    <span class="sync-text">
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
.sync-status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.sync-status-indicator.status-connected {
  background-color: var(--green-50);
  border-color: var(--green-200);
  color: var(--green-700);
}

.sync-status-indicator.status-polling {
  background-color: var(--yellow-50);
  border-color: var(--yellow-200);
  color: var(--yellow-700);
}

.sync-status-indicator.status-connecting {
  background-color: var(--blue-50);
  border-color: var(--blue-200);
  color: var(--blue-700);
}

.sync-status-indicator.status-error {
  background-color: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-700);
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-connected .sync-dot {
  background-color: var(--green-500);
}

.status-polling .sync-dot {
  background-color: var(--yellow-500);
}

.status-connecting .sync-dot,
.sync-dot.syncing {
  background-color: var(--blue-500);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-error .sync-dot {
  background-color: var(--red-500);
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
