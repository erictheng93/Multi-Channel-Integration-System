<template>
  <div
    v-if="shouldShowStatus"
    class="connection-status-bar"
    :class="statusClass"
  >
    <div class="status-content">
      <!-- 狀態圖標 -->
      <div
        class="status-icon"
        :class="iconClass"
      >
        <svg
          v-if="connectionState === 'connected'"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>

        <svg
          v-else-if="connectionState === 'connecting' || connectionState === 'reconnecting'"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="spinner"
        >
          <line
            x1="12"
            y1="2"
            x2="12"
            y2="6"
          />
          <line
            x1="12"
            y1="18"
            x2="12"
            y2="22"
          />
          <line
            x1="4.93"
            y1="4.93"
            x2="7.76"
            y2="7.76"
          />
          <line
            x1="16.24"
            y1="16.24"
            x2="19.07"
            y2="19.07"
          />
          <line
            x1="2"
            y1="12"
            x2="6"
            y2="12"
          />
          <line
            x1="18"
            y1="12"
            x2="22"
            y2="12"
          />
          <line
            x1="4.93"
            y1="19.07"
            x2="7.76"
            y2="16.24"
          />
          <line
            x1="16.24"
            y1="7.76"
            x2="19.07"
            y2="4.93"
          />
        </svg>

        <svg
          v-else
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <line
            x1="12"
            y1="8"
            x2="12"
            y2="12"
          />
          <line
            x1="12"
            y1="16"
            x2="12.01"
            y2="16"
          />
        </svg>
      </div>

      <!-- 狀態文字 -->
      <span class="status-text">{{ statusText }}</span>

      <!-- 連線協定標籤 -->
      <span
        v-if="showProtocol && connectionProtocol"
        class="protocol-badge"
      >
        {{ connectionProtocol === 'websocket' ? 'WS' : 'SSE' }}
      </span>

      <!-- 連線質量指示器 -->
      <div
        v-if="showQuality && connectionQuality"
        class="quality-indicator"
      >
        <div
          class="quality-bar"
          :class="`quality-${connectionQuality}`"
          :style="{ width: qualityPercentage }"
        />
      </div>

      <!-- 重新連線按鈕 -->
      <button
        v-if="connectionState === 'error' || connectionState === 'disconnected'"
        class="reconnect-btn"
        @click="$emit('reconnect')"
      >
        重新連線
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ConnectionStatusBar - 連線狀態欄組件
 *
 * 顯示 WebSocket/SSE 連線狀態，包含視覺指示器和重連按鈕。
 *
 * 使用示例：
 * <ConnectionStatusBar
 *   connection-state="connected"
 *   connection-protocol="websocket"
 *   connection-quality="excellent"
 *   :show-protocol="true"
 *   :show-quality="true"
 *   @reconnect="handleReconnect"
 * />
 */

import { computed } from 'vue'

// ===== Types =====
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
export type ConnectionProtocol = 'websocket' | 'sse' | null
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | null

// ===== Props =====
const props = defineProps<{
  /** 連線狀態 */
  connectionState: ConnectionState
  /** 連線協定 */
  connectionProtocol?: ConnectionProtocol
  /** 連線質量 */
  connectionQuality?: ConnectionQuality
  /** 是否顯示協定標籤 */
  showProtocol?: boolean
  /** 是否顯示質量指示器 */
  showQuality?: boolean
  /** 自動隱藏（連線成功後 3 秒自動隱藏） */
  autoHide?: boolean
}>()

// ===== Emits =====
defineEmits<{
  reconnect: []
}>()

// ===== Computed =====

/**
 * 是否應該顯示狀態欄
 * - 自動隱藏模式下，連線成功時不顯示
 * - 非自動隱藏模式下，總是顯示
 */
const shouldShowStatus = computed(() => {
  if (props.autoHide && props.connectionState === 'connected') {
    return false
  }
  return true
})

/**
 * 狀態樣式類名
 */
const statusClass = computed(() => {
  return `status-${props.connectionState}`
})

/**
 * 圖標樣式類名
 */
const iconClass = computed(() => {
  return `icon-${props.connectionState}`
})

/**
 * 狀態文字
 */
const statusText = computed(() => {
  switch (props.connectionState) {
    case 'connected':
      return '已連線'
    case 'connecting':
      return '連線中...'
    case 'reconnecting':
      return '重新連線中...'
    case 'error':
      return '連線失敗'
    case 'disconnected':
      return '未連線'
    default:
      return '未知狀態'
  }
})

/**
 * 連線質量百分比
 */
const qualityPercentage = computed(() => {
  switch (props.connectionQuality) {
    case 'excellent':
      return '100%'
    case 'good':
      return '75%'
    case 'fair':
      return '50%'
    case 'poor':
      return '25%'
    default:
      return '0%'
  }
})
</script>

<style scoped>
.connection-status-bar {
  padding: 8px 16px;
  border-top: 1px solid #e5e7eb;
  transition: all 0.3s;
}

.status-connected {
  background: linear-gradient(to right, #ecfdf5, #f0fdf4);
  border-top-color: #a7f3d0;
}

.status-connecting,
.status-reconnecting {
  background: linear-gradient(to right, #fef3c7, #fef9c3);
  border-top-color: #fde68a;
}

.status-error,
.status-disconnected {
  background: linear-gradient(to right, #fee2e2, #fef2f2);
  border-top-color: #fca5a5;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.icon-connected {
  background: #d1fae5;
  color: #059669;
}

.icon-connecting,
.icon-reconnecting {
  background: #fef3c7;
  color: #f59e0b;
}

.icon-error,
.icon-disconnected {
  background: #fee2e2;
  color: #dc2626;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.protocol-badge {
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
  font-family: monospace;
}

.quality-indicator {
  flex: 1;
  max-width: 80px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.quality-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.quality-excellent {
  background: linear-gradient(to right, #10b981, #059669);
}

.quality-good {
  background: linear-gradient(to right, #3b82f6, #2563eb);
}

.quality-fair {
  background: linear-gradient(to right, #f59e0b, #d97706);
}

.quality-poor {
  background: linear-gradient(to right, #ef4444, #dc2626);
}

.reconnect-btn {
  padding: 4px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.reconnect-btn:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.reconnect-btn:active {
  transform: scale(0.95);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .connection-status-bar {
    padding: 6px 12px;
  }

  .status-text {
    font-size: 12px;
  }

  .protocol-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .quality-indicator {
    max-width: 60px;
  }

  .reconnect-btn {
    font-size: 11px;
    padding: 3px 10px;
  }
}
</style>
