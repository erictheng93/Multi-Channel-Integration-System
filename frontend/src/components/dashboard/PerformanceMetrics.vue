<template>
  <div class="performance-section">
    <div class="section-header">
      <h3 class="section-title">
        {{ title }}
      </h3>
      <p class="section-subtitle">
        {{ subtitle }}
      </p>
    </div>
    <div class="performance-grid">
      <PerformanceCard
        :value="responseTime"
        label="平均回應時間"
        :icon="ClockIcon"
        variant="response-time"
      />
      <PerformanceCard
        :value="satisfactionRateDisplay"
        label="客戶滿意度"
        :icon="SmileIcon"
        variant="satisfaction"
      />
      <PerformanceCard
        :value="resolvedToday"
        label="今日已解決"
        :icon="CheckCircleIcon"
        variant="resolved"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PerformanceCard from './PerformanceCard.vue'
import { ClockIcon, SmileIcon, CheckCircleIcon } from '@/components/icons'

export interface PerformanceMetricsProps {
  /**
   * 章节标题
   * @default '效能指標'
   */
  title?: string

  /**
   * 章节副标题
   * @default '今日系統表現概覽'
   */
  subtitle?: string

  /**
   * 平均响应时间
   * @default '0分鐘'
   */
  responseTime?: string | number

  /**
   * 客户满意度百分比（0-100）
   * @default 0
   */
  satisfactionRate?: number

  /**
   * 今日已解决数量
   * @default 0
   */
  resolvedToday?: number
}

const props = withDefaults(defineProps<PerformanceMetricsProps>(), {
  title: '效能指標',
  subtitle: '今日系統表現概覽',
  responseTime: '0分鐘',
  satisfactionRate: 0,
  resolvedToday: 0
})

/**
 * 格式化满意度显示（添加百分号）
 */
const satisfactionRateDisplay = computed(() => {
  return `${props.satisfactionRate}%`
})
</script>

<style scoped>
.performance-section {
  margin-bottom: var(--space-12);
}

.section-header {
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.section-subtitle {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 400;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(220px, 25vw, 320px), 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .performance-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

@media (max-width: 640px) {
  .section-title {
    font-size: 1.125rem;
  }

  .section-subtitle {
    font-size: 0.8125rem;
  }
}
</style>
