<template>
  <div class="side-card activity-card">
    <div class="card-header">
      <div class="card-title-group">
        <h2 class="card-title">
          {{ title }}
        </h2>
        <div class="card-subtitle">
          <!-- 連線狀態指示器 -->
          <div class="connection-indicator">
            <span :class="['connection-status', connectionStatusClass]">
              <span class="status-icon">{{ connectionStatusIcon }}</span>
              {{ connectionStatusText }}
            </span>
            <!-- 延遲顯示（僅在連線時顯示） -->
            <span
              v-if="isConnected && latency > 0"
              class="latency-badge"
              :class="latencyClass"
            >
              {{ latency }}ms
            </span>
          </div>
          <!-- 重新連線按鈕（僅在斷線或錯誤時顯示） -->
          <button
            v-if="showReconnectButton"
            class="reconnect-btn"
            :disabled="isConnecting"
            @click="$emit('reconnect')"
          >
            <span
              v-if="isConnecting"
              class="btn-loading"
            >⟳</span>
            {{ isConnecting ? '連線中...' : '重新連線' }}
          </button>
        </div>
      </div>
      <div class="activity-actions">
        <router-link
          v-if="showViewAllLink"
          to="/activities"
          class="view-all-link"
        >
          查看全部
        </router-link>
      </div>
    </div>
    <div class="card-body">
      <HamsterLoader
        v-if="loading"
        :message="loadingMessage"
      />
      <EmptyState
        v-else-if="activities.length === 0"
        :title="emptyTitle"
        :description="emptyDescription"
      />
      <div
        v-else
        class="activity-list"
      >
        <div
          v-for="activity in activities"
          :key="activity.id"
          class="activity-item"
          :class="activity.priority"
        >
          <div
            class="activity-icon"
            :class="activity.type"
          >
            <component :is="getActivityIcon(activity.type)" />
          </div>
          <div class="activity-content">
            <div class="activity-header">
              <div class="activity-title">
                {{ activity.title }}
              </div>
              <div
                v-if="activity.priority === 'high'"
                class="activity-priority"
              >
                🔴
              </div>
            </div>
            <div class="activity-description">
              {{ activity.description }}
            </div>
            <div class="activity-time">
              {{ formatTime(activity.createdAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { Component } from 'vue'
import type { WebSocketConnectionState } from '@/stores/websocket'

export interface Activity {
  id: string
  type: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  createdAt: Date
}

export interface ActivityFeedCardProps {
  /**
   * 卡片标题
   * @default '活動動態'
   */
  title?: string

  /**
   * WebSocket 连接状态（詳細）
   * @default 'disconnected'
   */
  connectionState?: WebSocketConnectionState

  /**
   * WebSocket 连接状态（簡化 boolean）
   */
  isConnected: boolean

  /**
   * 是否正在連線中
   */
  isConnecting?: boolean

  /**
   * 重連嘗試次數
   */
  reconnectAttempts?: number

  /**
   * 連線延遲（毫秒）
   */
  latency?: number

  /**
   * 活动列表
   */
  activities: Activity[]

  /**
   * 获取活动图标的函数
   */
  getActivityIcon: (_type: string) => Component

  /**
   * 格式化时间的函数
   */
  formatTime: (_date: Date) => string

  /**
   * 加载状态
   */
  loading?: boolean

  /**
   * 加载消息
   * @default '載入中...'
   */
  loadingMessage?: string

  /**
   * 空状态标题
   * @default '暫無重要活動'
   */
  emptyTitle?: string

  /**
   * 空状态描述
   * @default '當有重要的系統活動時，會顯示在這裡'
   */
  emptyDescription?: string

  /**
   * 是否显示"查看全部"链接
   * @default true
   */
  showViewAllLink?: boolean
}

const props = withDefaults(defineProps<ActivityFeedCardProps>(), {
  title: '活動動態',
  connectionState: 'disconnected',
  isConnecting: false,
  reconnectAttempts: 0,
  latency: 0,
  loading: false,
  loadingMessage: '載入中...',
  emptyTitle: '暫無重要活動',
  emptyDescription: '當有重要的系統活動時，會顯示在這裡',
  showViewAllLink: true
})

defineEmits<{
  reconnect: []
}>()

// ==================== Computed Properties ====================

/**
 * 連線狀態的 CSS 類別
 */
const connectionStatusClass = computed(() => {
  switch (props.connectionState) {
    case 'connected':
      return 'connected'
    case 'connecting':
    case 'reconnecting':
      return 'connecting'
    case 'error':
      return 'error'
    case 'disconnected':
    default:
      return 'disconnected'
  }
})

/**
 * 連線狀態圖示
 */
const connectionStatusIcon = computed(() => {
  switch (props.connectionState) {
    case 'connected':
      return '●'
    case 'connecting':
    case 'reconnecting':
      return '◐'
    case 'error':
      return '✕'
    case 'disconnected':
    default:
      return '○'
  }
})

/**
 * 用戶友善的連線狀態文字
 */
const connectionStatusText = computed(() => {
  switch (props.connectionState) {
    case 'connected':
      return '即時更新中'
    case 'connecting':
      return '正在連接...'
    case 'reconnecting':
      return `重新連線中 (${props.reconnectAttempts})`
    case 'error':
      return '連線失敗'
    case 'disconnected':
    default:
      return '即時更新已暫停'
  }
})

/**
 * 是否顯示重新連線按鈕
 */
const showReconnectButton = computed(() => {
  return props.connectionState === 'disconnected' || props.connectionState === 'error'
})

/**
 * 延遲狀態的 CSS 類別
 */
const latencyClass = computed(() => {
  if (props.latency < 100) {
    return 'latency-good'
  }
  if (props.latency < 300) {
    return 'latency-medium'
  }
  return 'latency-high'
})
</script>

<style scoped>
.side-card {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.card-header {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title-group {
  flex: 1;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--gray-600);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.connection-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.connection-status {
  font-size: 0.8125rem;
  font-weight: 500;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  transition: all var(--transition-fast);
}

.status-icon {
  font-size: 0.75rem;
}

.connection-status.connected {
  color: var(--green-700);
  background: var(--green-50);
}

.connection-status.connecting {
  color: var(--blue-700);
  background: var(--blue-50);
}

.connection-status.connecting .status-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

.connection-status.error {
  color: var(--red-700);
  background: var(--red-50);
}

.connection-status.disconnected {
  color: var(--gray-700);
  background: var(--gray-100);
}

/* 延遲指標 */
.latency-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: var(--space-0-5) var(--space-1-5);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
}

.latency-good {
  color: var(--green-700);
  background: var(--green-50);
}

.latency-medium {
  color: var(--yellow-700);
  background: var(--yellow-50);
}

.latency-high {
  color: var(--red-700);
  background: var(--red-50);
}

/* 重新連線按鈕 */
.reconnect-btn {
  font-size: 0.8125rem;
  font-weight: 500;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--primary-300);
  background: var(--primary-50);
  color: var(--primary-700);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.reconnect-btn:hover:not(:disabled) {
  background: var(--primary-100);
  border-color: var(--primary-400);
}

.reconnect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-loading {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.activity-actions {
  display: flex;
  gap: var(--space-3);
}

.view-all-link {
  color: var(--primary-600);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.view-all-link:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

.card-body {
  padding: var(--space-6);
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.activity-item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-100);
  transition: all var(--transition-fast);
}

.activity-item:hover {
  background: var(--gray-50);
  border-color: var(--gray-200);
}

.activity-item.high {
  border-left: 3px solid var(--red-500);
}

.activity-item.medium {
  border-left: 3px solid var(--yellow-500);
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--gray-100);
  color: var(--gray-600);
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.activity-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
}

.activity-priority {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.activity-description {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin-bottom: var(--space-1);
  line-height: 1.5;
}

.activity-time {
  font-size: 0.8125rem;
  color: var(--gray-500);
}
</style>
