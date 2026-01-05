<template>
  <div :class="['performance-card', variant]">
    <div :class="['performance-icon', variant]">
      <component :is="icon" />
    </div>
    <div class="performance-content">
      <div class="performance-value">
        {{ value }}
      </div>
      <div class="performance-label">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

export interface PerformanceCardProps {
  /**
   * 性能指标数值
   */
  value: string | number

  /**
   * 性能指标标签
   */
  label: string

  /**
   * 图标组件
   */
  icon: Component

  /**
   * 卡片变体（决定颜色主题）
   * @default 'default'
   */
  variant?: 'response-time' | 'satisfaction' | 'resolved' | 'default'
}

withDefaults(defineProps<PerformanceCardProps>(), {
  variant: 'default'
})
</script>

<style scoped>
.performance-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  border: 1px solid var(--gray-100);
  transition: all var(--transition-fast);
}

.performance-card:hover {
  box-shadow: 0 4px 12px -2px rgb(0 0 0 / 0.1);
  transform: translateY(-1px);
}

.performance-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

/* Icon variant colors */
.performance-icon.response-time {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
}

.performance-icon.satisfaction {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
}

.performance-icon.resolved {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: #9f1239;
}

.performance-icon.default {
  background: var(--gray-100);
  color: var(--gray-600);
}

.performance-card:hover .performance-icon {
  transform: scale(1.05);
}

.performance-content {
  flex: 1;
  min-width: 0;
}

.performance-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  line-height: 1.2;
  margin-bottom: var(--space-1);
}

.performance-label {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .performance-card {
    padding: var(--space-4);
  }

  .performance-icon {
    width: 40px;
    height: 40px;
  }

  .performance-value {
    font-size: 1.25rem;
  }

  .performance-label {
    font-size: 0.8125rem;
  }
}
</style>
