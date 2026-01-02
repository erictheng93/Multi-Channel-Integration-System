<template>
  <div
    class="api-card"
    :class="[`status-${api.status}`, { 'expanded': expanded }]"
    @click="$emit('toggle', api.id)"
  >
    <div class="api-header">
      <div class="api-basic-info">
        <div
          class="api-method"
          :class="api.method.toLowerCase()"
        >
          {{ api.method }}
        </div>
        <div class="api-endpoint">
          {{ api.endpoint }}
        </div>
        <div
          class="api-status-badge"
          :class="api.status"
        >
          <span class="status-dot" />
          {{ statusText }}
        </div>
      </div>
      <div class="api-metrics">
        <div class="metric">
          <span class="metric-label">響應時間</span>
          <span
            class="metric-value"
            :class="responseTimeClass"
          >
            {{ api.responseTime }}ms
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">成功率</span>
          <span
            class="metric-value"
            :class="successRateClass"
          >
            {{ api.successRate }}%
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="expanded"
      class="api-details"
    >
      <div class="details-grid">
        <div class="detail-section">
          <h4>基本信息</h4>
          <div class="detail-item">
            <span class="label">描述:</span>
            <span>{{ api.description }}</span>
          </div>
          <div class="detail-item">
            <span class="label">分類:</span>
            <span>{{ categoryText }}</span>
          </div>
          <div class="detail-item">
            <span class="label">最後檢查:</span>
            <span>{{ lastCheckTime }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>性能指標</h4>
          <div class="detail-item">
            <span class="label">平均響應時間:</span>
            <span>{{ api.avgResponseTime }}ms</span>
          </div>
          <div class="detail-item">
            <span class="label">24h請求數:</span>
            <span>{{ api.requestCount }}</span>
          </div>
          <div class="detail-item">
            <span class="label">錯誤數:</span>
            <span>{{ api.errorCount }}</span>
          </div>
        </div>
      </div>

      <div class="detail-actions">
        <button
          class="test-btn"
          :disabled="api.testing"
          @click.stop="$emit('test', api)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {{ api.testing ? '測試中...' : '測試API' }}
        </button>
        <button
          class="logs-btn"
          @click.stop="$emit('view-logs', api)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line
              x1="16"
              y1="13"
              x2="8"
              y2="13"
            />
            <line
              x1="16"
              y1="17"
              x2="8"
              y2="17"
            />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          查看日誌
        </button>
        <button
          class="docs-btn"
          @click.stop="$emit('view-docs', api)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          API文檔
        </button>
      </div>

      <div
        v-if="api.error"
        class="error-info"
      >
        <h4>錯誤信息</h4>
        <div class="error-message">
          {{ api.error }}
        </div>
        <div
          v-if="api.errorTime"
          class="error-time"
        >
          {{ formatErrorTime(api.errorTime) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApiEndpoint } from '@/types/api-monitor'

interface Props {
  api: ApiEndpoint
  expanded: boolean
}

interface Emits {
  (e: 'toggle', id: string): void
  (e: 'test', api: ApiEndpoint): void
  (e: 'view-logs', api: ApiEndpoint): void
  (e: 'view-docs', api: ApiEndpoint): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const statusText = computed(() => {
  const statusMap = {
    healthy: '正常',
    warning: '警告',
    error: '錯誤'
  }
  return statusMap[props.api.status]
})

const categoryText = computed(() => {
  const categoryMap: Record<string, string> = {
    system: '系統',
    auth: '認證',
    conversation: '對話',
    customer: '客戶',
    team: '團隊',
    message: '訊息',
    integration: '整合'
  }
  return categoryMap[props.api.category] || props.api.category
})

const responseTimeClass = computed(() => {
  const time = props.api.responseTime
  if (time < 200) return 'excellent'
  if (time < 500) return 'good'
  if (time < 1000) return 'fair'
  return 'poor'
})

const successRateClass = computed(() => {
  const rate = props.api.successRate
  if (rate >= 98) return 'excellent'
  if (rate >= 95) return 'good'
  if (rate >= 90) return 'fair'
  return 'poor'
})

const lastCheckTime = computed(() => {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(props.api.lastCheck)
})

function formatErrorTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(date)
}
</script>

<style scoped>
.api-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.api-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.api-card.status-healthy {
  border-left-color: #22c55e;
}

.api-card.status-warning {
  border-left-color: #fbbf24;
}

.api-card.status-error {
  border-left-color: #ef4444;
}

.api-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.api-basic-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.api-method {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}

.api-method.get { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.api-method.post { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.api-method.put { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }
.api-method.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.api-endpoint {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #111827;
  flex: 1;
}

.api-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.api-status-badge.healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.api-status-badge.warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.api-status-badge.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.api-metrics {
  display: flex;
  gap: 24px;
}

.metric {
  text-align: right;
}

.metric-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: bold;
}

.metric-value.excellent { color: #22c55e; }
.metric-value.good { color: #84cc16; }
.metric-value.fair { color: #fbbf24; }
.metric-value.poor { color: #ef4444; }

.api-details {
  border-top: 1px solid #e5e7eb;
  padding: 20px;
  background: rgba(248, 250, 252, 0.5);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 20px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: #111827;
  font-size: 14px;
  font-weight: 600;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-item .label {
  color: #6b7280;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.detail-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  border-radius: 0.375rem;
  border: 1px solid #d1d5db;
  background-color: #f3f4f6;
  color: #111827;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  text-decoration: none;
  white-space: nowrap;
}

.detail-actions button:hover:not(:disabled) {
  background-color: #e5e7eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.detail-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-info {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.error-info h4 {
  margin: 0 0 8px 0;
  color: #dc2626;
  font-size: 14px;
}

.error-message {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #7f1d1d;
  margin-bottom: 4px;
}

.error-time {
  font-size: 12px;
  color: #6b7280;
}

/* Responsive */
@media (max-width: 768px) {
  .api-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .api-metrics {
    justify-content: space-between;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-actions {
    flex-direction: column;
    gap: 0.5rem;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .api-card {
    transition: none !important;
  }

  .api-card:hover {
    transform: none !important;
  }
}
</style>
