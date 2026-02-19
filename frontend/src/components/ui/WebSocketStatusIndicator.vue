<template>
  <div
    class="websocket-status-indicator"
    :class="indicatorClasses"
  >
    <div class="status-content">
      <!-- Status Icon -->
      <div
        class="status-icon"
        :class="iconClasses"
      >
        <span
          class="status-dot"
          :class="dotClasses"
        />
        <span
          v-if="showIcon"
          class="protocol-icon"
        >{{ protocolIcon }}</span>
      </div>

      <!-- Status Text (shown when expanded) -->
      <div
        v-if="showDetails"
        class="status-details"
      >
        <div class="status-text">
          {{ status.statusIndicator.value.label }}
        </div>
        <div
          v-if="currentProtocol === 'websocket'"
          class="connection-quality"
        >
          {{ status.qualityBadge.value.label }}
        </div>
      </div>

      <!-- Compact indicators -->
      <div
        v-else
        class="compact-indicators"
      >
        <span
          class="protocol-badge"
          :class="protocolBadgeClasses"
        >
          {{ currentProtocol === 'websocket' ? 'WS' : 'SSE' }}
        </span>
      </div>
    </div>

    <!-- Tooltip for detailed info -->
    <div
      v-if="!showDetails"
      class="status-tooltip"
    >
      <div class="tooltip-content">
        <div class="tooltip-header">
          <span class="tooltip-title">連接狀態</span>
          <span class="tooltip-protocol">{{ currentProtocol.toUpperCase() }}</span>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row">
            <span class="tooltip-label">狀態:</span>
            <span class="tooltip-value">{{ status.statusIndicator.value.label }}</span>
          </div>
          <div
            v-if="currentProtocol === 'websocket'"
            class="tooltip-row"
          >
            <span class="tooltip-label">品質:</span>
            <span class="tooltip-value">{{ status.qualityBadge.value.label }}</span>
          </div>
          <div
            v-if="currentProtocol === 'websocket'"
            class="tooltip-row"
          >
            <span class="tooltip-label">延遲:</span>
            <span class="tooltip-value">{{ status.detailedStatus.value.connection.latency }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">運行時間:</span>
            <span class="tooltip-value">{{ status.detailedStatus.value.connection.uptime }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { useWebSocketStatus } from '@/composables/useWebSocketStatus'

interface Props {
  status: ReturnType<typeof useWebSocketStatus>
  showDetails?: boolean
  showIcon?: boolean
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false,
  showIcon: true,
  compact: false
})

// NOTE: System is 100% WebSocket — migration shim removed
const currentProtocol = 'websocket' as const

// Computed classes and states
const indicatorClasses = computed(() => ({
  'indicator-compact': props.compact,
  'indicator-detailed': props.showDetails,
  'indicator-websocket': true,
  'indicator-sse': false
}))

const iconClasses = computed(() => ({
  'icon-connected': props.status.connectionState.value === 'connected',
  'icon-connecting': props.status.connectionState.value === 'connecting',
  'icon-reconnecting': props.status.connectionState.value === 'reconnecting',
  'icon-error': props.status.connectionState.value === 'error',
  'icon-disconnected': props.status.connectionState.value === 'disconnected'
}))

const dotClasses = computed(() => ({
  'dot-connected': props.status.connectionState.value === 'connected',
  'dot-connecting': props.status.connectionState.value === 'connecting',
  'dot-reconnecting': props.status.connectionState.value === 'reconnecting',
  'dot-error': props.status.connectionState.value === 'error',
  'dot-disconnected': props.status.connectionState.value === 'disconnected'
}))

const protocolBadgeClasses = computed(() => ({
  'protocol-websocket': true,
  'protocol-sse': false
}))

const protocolIcon = computed(() => '⚡')
</script>

<style scoped>
.websocket-status-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  user-select: none;
}

.status-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.indicator-compact .status-content {
  padding: 2px 4px;
  gap: var(--space-1);
}

.indicator-detailed .status-content {
  padding: var(--space-2) var(--space-3);
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
}

.indicator-websocket .status-content {
  background-color: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
}

.indicator-sse .status-content {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
}

/* Status Icon */
.status-icon {
  display: flex;
  align-items: center;
  gap: 2px;
  position: relative;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  transition: all var(--transition-fast);
}

.dot-connected {
  background-color: var(--green-500);
  animation: pulse-gentle 2s infinite;
}

.dot-connecting {
  background-color: var(--yellow-500);
  animation: pulse-fast 1s infinite;
}

.dot-reconnecting {
  background-color: var(--orange-500);
  animation: pulse-fast 1s infinite;
}

.dot-error {
  background-color: var(--red-500);
}

.dot-disconnected {
  background-color: var(--gray-400);
}

.protocol-icon {
  font-size: 0.625rem;
  opacity: 0.8;
}

/* Status Details */
.status-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.status-text {
  font-weight: 500;
  color: var(--gray-700);
}

.connection-quality {
  font-size: 0.625rem;
  color: var(--gray-500);
}

/* Compact Indicators */
.compact-indicators {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.protocol-badge {
  padding: 1px 3px;
  border-radius: 2px;
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.protocol-websocket {
  background-color: rgba(34, 197, 94, 0.2);
  color: var(--green-700);
}

.protocol-sse {
  background-color: rgba(59, 130, 246, 0.2);
  color: var(--blue-700);
}

/* Tooltip */
.status-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  opacity: 0;
  visibility: hidden;
  transition: all var(--transition-fast);
  z-index: 1000;
  pointer-events: none;
}

.websocket-status-indicator:hover .status-tooltip {
  opacity: 1;
  visibility: visible;
}

.tooltip-content {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: 0.75rem;
  white-space: nowrap;
  position: relative;
}

.tooltip-content::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.tooltip-title {
  font-weight: 600;
}

.tooltip-protocol {
  font-size: 0.625rem;
  padding: 1px 4px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  font-weight: 500;
}

.tooltip-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.tooltip-label {
  opacity: 0.8;
}

.tooltip-value {
  font-weight: 500;
}

/* Animations */
@keyframes pulse-gentle {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

@keyframes pulse-fast {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .status-content {
    padding: 1px 3px;
    gap: 1px;
  }

  .protocol-badge {
    font-size: 0.4rem;
    padding: 0.5px 2px;
  }

  .status-dot {
    width: 4px;
    height: 4px;
  }

  .tooltip-content {
    font-size: 0.625rem;
    padding: var(--space-2);
  }
}
</style>