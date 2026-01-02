<template>
  <div class="stats-section">
    <div class="stats-grid">
      <!-- 總報表數 -->
      <StatCard
        icon="📊"
        :number="stats.totalReports"
        label="總報表數"
        type="total"
      >
        <template #extra>
          <div
            v-if="stats.thisMonthGenerated > 0"
            class="stat-trend"
          >
            <span class="trend-indicator up">↗</span>
            <span class="trend-text">本月 +{{ stats.thisMonthGenerated }}</span>
          </div>
        </template>
      </StatCard>

      <!-- 已完成 -->
      <StatCard
        icon="✅"
        :number="stats.completedReports"
        label="已完成"
        type="completed"
      >
        <template #extra>
          <div class="stat-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${completionRate}%` }"
              />
            </div>
            <span class="progress-text">{{ completionRate }}%</span>
          </div>
        </template>
      </StatCard>

      <!-- 處理中 -->
      <StatCard
        icon="⚙️"
        :number="stats.pendingReports"
        label="處理中"
        type="generating"
      >
        <template #extra>
          <div
            v-if="stats.pendingReports > 0"
            class="stat-indicator"
          >
            <span class="indicator-dot" />
            <span class="indicator-text">進行中</span>
          </div>
        </template>
      </StatCard>

      <!-- 失敗 -->
      <StatCard
        icon="❌"
        :number="stats.failedReports"
        label="失敗"
        type="failed"
      >
        <template #extra>
          <div
            v-if="stats.failedReports > 0"
            class="stat-action"
          >
            <button
              class="action-link"
              @click="$emit('show-failed-reports')"
            >
              查看詳情
            </button>
          </div>
        </template>
      </StatCard>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * StatsGrid Component
 *
 * 显示报表仪表板的统计卡片网格
 *
 * @emits show-failed-reports - 用户点击查看失败报表详情
 */

import { computed } from 'vue'
import StatCard from './StatCard.vue'
import type { DashboardStats } from '@/types/reports'

export interface StatsGridProps {
  /**
   * 统计数据
   */
  stats: DashboardStats
}

const props = defineProps<StatsGridProps>()

defineEmits<{
  'show-failed-reports': []
}>()

/**
 * 报表完成率百分比
 */
const completionRate = computed(() => {
  if (props.stats.totalReports === 0) {
    return 0
  }
  return Math.round((props.stats.completedReports / props.stats.totalReports) * 100)
})
</script>

<style scoped>
.stats-section {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Trend styles */
.stat-trend {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.trend-indicator.up {
  color: #10b981;
}

.trend-text {
  color: #6b7280;
}

/* Progress styles */
.stat-progress {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  width: 80px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

/* Indicator styles */
.stat-indicator {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  animation: pulse 2s infinite;
}

.indicator-text {
  color: #3b82f6;
  font-weight: 500;
}

/* Action styles */
.stat-action {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
}

.action-link {
  color: #ef4444;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: underline;
}

.action-link:hover {
  color: #dc2626;
}

/* Animation */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
