<template>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon stat-icon-total">
        <InboxIcon />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ stats?.total || 0 }}</span>
        <span class="stat-label">全部通知</span>
      </div>
    </div>
    <div class="stat-card stat-card-highlight">
      <div class="stat-icon stat-icon-unread">
        <BellIcon />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ stats?.unread || 0 }}</span>
        <span class="stat-label">未讀通知</span>
      </div>
      <div
        v-if="stats?.unread"
        class="stat-pulse"
      />
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-today">
        <CalendarIcon />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ stats?.timeRange?.today || 0 }}</span>
        <span class="stat-label">今日新增</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-week">
        <TrendingUpIcon />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ stats?.timeRange?.thisWeek || 0 }}</span>
        <span class="stat-label">本週通知</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BellIcon, InboxIcon, CalendarIcon, TrendingUpIcon } from '@/components/icons'

defineProps<{
  stats: {
    total: number
    unread: number
    timeRange: {
      today: number
      thisWeek: number
    }
  } | null
}>()
</script>

<style scoped>
/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-fast);
}

.stat-card:hover {
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.stat-card-highlight {
  border-color: var(--primary-200);
  background: linear-gradient(135deg, var(--primary-50), white);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-icon-total {
  background: var(--gray-100);
  color: var(--gray-600);
}

.stat-icon-unread {
  background: var(--primary-100);
  color: var(--primary-600);
}

.stat-icon-today {
  background: var(--green-100);
  color: var(--green-600);
}

.stat-icon-week {
  background: var(--blue-100);
  color: var(--blue-600);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--gray-500);
}

.stat-pulse {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 8px;
  height: 8px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
