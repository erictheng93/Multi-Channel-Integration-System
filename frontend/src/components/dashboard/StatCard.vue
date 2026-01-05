<template>
  <div :class="['stat-card', variant]">
    <div class="stat-content">
      <div class="stat-number">
        {{ value }}
      </div>
      <div class="stat-label">
        {{ label }}
      </div>
    </div>
    <div class="stat-icon">
      <component :is="icon" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

export interface StatCardProps {
  /**
   * 统计数值
   */
  value: number | string

  /**
   * 标签文字
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
  variant?: 'pending' | 'active' | 'messages' | 'agents' | 'default'
}

withDefaults(defineProps<StatCardProps>(), {
  variant: 'default'
})
</script>

<style scoped>
.stat-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gray-200);
  transition: background-color var(--transition-fast);
}

/* Variant colors */
.stat-card.pending::before {
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.stat-card.active::before {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
}

.stat-card.messages::before {
  background: linear-gradient(180deg, #10b981, #059669);
}

.stat-card.agents::before {
  background: linear-gradient(180deg, #8b5cf6, #7c3aed);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  line-height: 1;
  margin-bottom: var(--space-2);
}

.stat-label {
  font-size: 0.9375rem;
  color: var(--gray-600);
  font-weight: 500;
}

.stat-icon {
  width: 56px;
  height: 56px;
  background: var(--gray-50);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-600);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.stat-card:hover .stat-icon {
  background: var(--gray-100);
  transform: scale(1.05);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .stat-number {
    font-size: 2rem;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }
}
</style>
