<template>
  <Modal
    :show="true"
    :title="modalState.title"
    size="xl"
    @close="$emit('close')"
  >
    <div class="api-detail-content">
      <div class="stat-detail-summary">
        <div class="summary-item">
          <span class="summary-label">總數量:</span>
          <span class="summary-value">{{ modalState.apis.length }}</span>
        </div>
        <div
          v-if="modalState.type !== 'all'"
          class="summary-item"
        >
          <span class="summary-label">佔比:</span>
          <span class="summary-value">{{ percentage }}%</span>
        </div>
      </div>

      <div
        v-if="modalState.apis.length === 0"
        class="empty-stat-detail"
      >
        <div class="empty-icon" />
        <p>目前沒有{{ modalState.title }}的API端點</p>
      </div>

      <div
        v-else
        class="stat-detail-list"
      >
        <div
          v-for="api in modalState.apis"
          :key="api.id"
          class="stat-detail-item"
          :class="`status-${api.status}`"
        >
          <div class="detail-item-header">
            <div
              class="api-method-badge"
              :class="api.method.toLowerCase()"
            >
              {{ api.method }}
            </div>
            <div class="api-endpoint-text">
              {{ api.endpoint }}
            </div>
            <div
              class="api-status-indicator"
              :class="api.status"
            >
              <span class="status-dot" />
              {{ getStatusText(api.status) }}
            </div>
          </div>

          <div class="detail-item-info">
            <div class="info-row">
              <span class="info-label">描述:</span>
              <span class="info-value">{{ api.description }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">分類:</span>
              <span class="info-value">{{ getCategoryText(api.category) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">響應時間:</span>
              <span
                class="info-value"
                :class="getResponseTimeClass(api.responseTime)"
              >
                {{ api.responseTime }}ms
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">成功率:</span>
              <span
                class="info-value"
                :class="getSuccessRateClass(api.successRate)"
              >
                {{ api.successRate }}%
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">最後檢查:</span>
              <span class="info-value">{{ formatTime(api.lastCheck) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import type { ModalState, ApiStatus } from '@/types/api-monitor'

interface Props {
  modalState: ModalState
  totalApis?: number
}

interface Emits {
  (_e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  totalApis: 0
})

defineEmits<Emits>()

const percentage = computed(() => {
  if (props.totalApis === 0) {return 0}
  return Math.round((props.modalState.apis.length / props.totalApis) * 100)
})

function getStatusText(status: ApiStatus): string {
  const statusMap = {
    healthy: '正常',
    warning: '警告',
    error: '錯誤'
  }
  return statusMap[status]
}

function getCategoryText(category: string): string {
  const categoryMap: Record<string, string> = {
    system: '系統',
    auth: '認證',
    conversation: '對話',
    customer: '客戶',
    team: '團隊',
    message: '訊息',
    integration: '整合'
  }
  return categoryMap[category] || category
}

function getResponseTimeClass(time: number): string {
  if (time < 200) {return 'excellent'}
  if (time < 500) {return 'good'}
  if (time < 1000) {return 'fair'}
  return 'poor'
}

function getSuccessRateClass(rate: number): string {
  if (rate >= 98) {return 'excellent'}
  if (rate >= 95) {return 'good'}
  if (rate >= 90) {return 'fair'}
  return 'poor'
}

function formatTime(date: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date))
}
</script>

<style scoped>
.api-detail-content {
  padding: 0;
}

.stat-detail-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: #e5e7eb;
  border-radius: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 14px;
  color: #6b7280;
}

.summary-value {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.stat-detail-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-detail-item {
  background: white;
  border-radius: 12px;
  border: 1px solid #d1d5db;
  padding: 16px;
  transition: all 0.2s;
}

.stat-detail-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-detail-item.status-healthy {
  border-left: 4px solid #22c55e;
}

.stat-detail-item.status-warning {
  border-left: 4px solid #fbbf24;
}

.stat-detail-item.status-error {
  border-left: 4px solid #ef4444;
}

.detail-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.api-method-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  min-width: 60px;
  text-align: center;
}

.api-method-badge.get { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.api-method-badge.post { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.api-method-badge.put { background: rgba(251, 191, 36, 0.1); color: #fbbf24; }
.api-method-badge.delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.api-endpoint-text {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #111827;
  flex: 1;
  min-width: 200px;
}

.api-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.api-status-indicator.healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.api-status-indicator.warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.api-status-indicator.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.detail-item-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.info-label {
  font-size: 13px;
  color: #6b7280;
  min-width: 80px;
}

.info-value {
  font-size: 13px;
  color: #111827;
  text-align: right;
}

.info-value.excellent { color: #22c55e; }
.info-value.good { color: #84cc16; }
.info-value.fair { color: #fbbf24; }
.info-value.poor { color: #ef4444; }

.error-row .info-label,
.error-row .error-text {
  color: #ef4444;
}

.error-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.empty-stat-detail {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.empty-stat-detail .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .stat-detail-summary {
    flex-direction: column;
    gap: 12px;
  }

  .detail-item-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .api-endpoint-text {
    min-width: auto;
  }

  .detail-item-info {
    grid-template-columns: 1fr;
  }
}
</style>
