<template>
  <div class="migration-status">
    <div class="migration-card">
      <div class="migration-header">
        <h2>🚀 WebSocket 遷移狀態</h2>
        <span class="migration-badge">已完成</span>
      </div>

      <div class="migration-progress">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: status.rolloutPercentage + '%' }"
          />
        </div>
        <div class="progress-info">
          <span>Rollout 進度: {{ status.rolloutPercentage }}%</span>
          <span>更新時間: {{ formatTime(status.lastCheck) }}</span>
        </div>
      </div>

      <div class="migration-details">
        <div class="detail-row">
          <span>WebSocket 狀態:</span>
          <span class="status-badge success">
            {{ status.websocketEnabled ? '✅ 已啟用' : '❌ 未啟用' }}
          </span>
        </div>
        <div class="detail-row">
          <span>Durable Objects:</span>
          <span class="status-badge success">
            {{ status.durableObjectsAvailable ? '✅ 可用' : '❌ 不可用' }}
          </span>
        </div>
        <div class="detail-row">
          <span>遷移策略:</span>
          <span>{{ getMigrationStrategyText(status.migrationStrategy) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MigrationStatus } from '@/types/api-monitor'

interface Props {
  status: MigrationStatus
}

defineProps<Props>()

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

function getMigrationStrategyText(strategy: string): string {
  const strategyMap: Record<string, string> = {
    gradual: '漸進式',
    immediate: '立即',
    canary: '金絲雀'
  }
  return strategyMap[strategy] || strategy
}
</script>

<style scoped>
.migration-status {
  margin-bottom: 2rem;
}

.migration-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
  color: white;
}

.migration-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.migration-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.migration-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
}

.migration-progress {
  margin-bottom: 1.5rem;
}

.progress-bar {
  background: rgba(255, 255, 255, 0.2);
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  transition: width 0.5s ease-in-out;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  opacity: 0.9;
}

.migration-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.status-badge.success {
  background: rgba(34, 197, 94, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-weight: 600;
}

/* Responsive */
@media (max-width: 768px) {
  .migration-card {
    padding: 1.5rem;
  }

  .migration-header {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
    text-align: center;
  }

  .migration-header h2 {
    font-size: 1.25rem;
  }

  .migration-details {
    grid-template-columns: 1fr;
  }
}
</style>
