<template>
  <div class="log-console">
    <div class="log-header">
      <h3 class="log-title">
        <span class="log-icon"></span>
        Deployment Logs
      </h3>
      <button v-if="logs.length > 0" @click="clearLogs" class="btn btn-sm">
        Clear
      </button>
    </div>

    <div ref="logContainer" class="log-body">
      <div v-if="logs.length === 0" class="log-empty">
        No logs yet. Waiting for deployment to start...
      </div>

      <div
        v-for="(log, index) in logs"
        :key="index"
        class="log-entry"
        :class="`log-${log.level}`"
      >
        <span class="log-timestamp">{{ formatTime(log.timestamp) }}</span>
        <span class="log-level-badge">{{ log.level.toUpperCase() }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { LogEntry } from '@/types';

// ========================================
// PROPS
// ========================================

interface Props {
  logs: LogEntry[];
}

const props = defineProps<Props>();

// ========================================
// EMITS
// ========================================

const emit = defineEmits<{
  clear: [];
}>();

// ========================================
// STATE
// ========================================

const logContainer = ref<HTMLDivElement | null>(null);

// ========================================
// METHODS
// ========================================

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function clearLogs(): void {
  emit('clear');
}

function scrollToBottom(): void {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
}

// ========================================
// WATCHERS
// ========================================

watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);
</script>

<style scoped>
.log-console {
  background: var(--color-gray-900);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-gray-800);
  border-bottom: 1px solid var(--color-gray-700);
}

.log-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: 0;
  font-size: var(--font-size-base);
  color: white;
}

.log-icon {
  font-size: var(--font-size-lg);
}

.log-body {
  height: 300px;
  overflow-y: auto;
  padding: var(--spacing-md);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.log-body::-webkit-scrollbar {
  width: 8px;
}

.log-body::-webkit-scrollbar-track {
  background: var(--color-gray-800);
}

.log-body::-webkit-scrollbar-thumb {
  background: var(--color-gray-600);
  border-radius: var(--radius-sm);
}

.log-body::-webkit-scrollbar-thumb:hover {
  background: var(--color-gray-500);
}

.log-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-gray-500);
  font-style: italic;
}

.log-entry {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-xs) 0;
  color: white;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.log-timestamp {
  flex-shrink: 0;
  color: var(--color-gray-400);
}

.log-level-badge {
  flex-shrink: 0;
  min-width: 60px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-align: center;
}

.log-info .log-level-badge {
  background: var(--color-info);
  color: white;
}

.log-success .log-level-badge {
  background: var(--color-success);
  color: white;
}

.log-warning .log-level-badge {
  background: var(--color-warning);
  color: white;
}

.log-error .log-level-badge {
  background: var(--color-error);
  color: white;
}

.log-message {
  flex: 1;
  word-break: break-word;
}
</style>
