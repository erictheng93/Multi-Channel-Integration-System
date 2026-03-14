<template>
  <div
    class="stat-card"
    :class="type"
  >
    <div class="stat-icon">
      {{ icon }}
    </div>
    <div class="stat-content">
      <div class="stat-number">
        {{ number }}
      </div>
      <div class="stat-label">
        {{ label }}
      </div>
    </div>
    <!-- Slot for additional content (trend, progress, indicator, action) -->
    <slot name="extra" />
  </div>
</template>

<script setup lang="ts">
/**
 * StatCard Component
 *
 * 可复用的统计卡片组件
 *
 * @example
 * <StatCard
 * icon=""
 * :number="totalReports"
 * label="總報表數"
 * type="total"
 * >
 * <template #extra>
 * <div class="stat-trend">...</div>
 * </template>
 * </StatCard>
 */

export interface StatCardProps {
  /**
   * 卡片图标 (emoji)
   */
  icon: string

  /**
   * 统计数字
   */
  number: number | string

  /**
   * 标签文本
   */
  label: string

  /**
   * 卡片类型 (影响颜色和样式)
   * @default 'default'
   */
  type?: 'total' | 'completed' | 'generating' | 'failed' | 'default'
}

withDefaults(defineProps<StatCardProps>(), {
  type: 'default'
})
</script>

<style scoped>
.stat-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  position: relative;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 3rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #6b7280;
  font-size: 1.1rem;
  font-weight: 500;
}

/* Type-specific styling can be added here if needed */
.stat-card.total {
  /* Custom styling for total type */
}

.stat-card.completed {
  /* Custom styling for completed type */
}

.stat-card.generating {
  /* Custom styling for generating type */
}

.stat-card.failed {
  /* Custom styling for failed type */
}
</style>
