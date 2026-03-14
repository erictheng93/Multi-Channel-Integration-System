<template>
  <div class="auto-reply-stats">
    <div class="stats-grid">
      <div class="stat-card stat-card--rules">
        <div class="stat-value">
          {{ activeRules }}
        </div>
        <div class="stat-label">
          啟用規則數
        </div>
      </div>

      <div class="stat-card stat-card--replies">
        <div class="stat-value">
          {{ todayReplies }}
        </div>
        <div class="stat-label">
          今日回覆數
        </div>
      </div>

      <div class="stat-card stat-card--hours">
        <div
          class="stat-value"
          :class="isBusinessHours ? 'text-amber' : 'text-red'"
        >
          {{ isBusinessHours ? '營業中' : '非營業時間' }}
        </div>
        <div class="stat-label">
          營業狀態
        </div>
      </div>

      <div class="stat-card stat-card--rate">
        <div class="stat-value">
          {{ successRate }}%
        </div>
        <div class="stat-label">
          成功率
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeRules: number
  todayReplies: number
  isBusinessHours: boolean
  successRate: number
}>()
</script>

<style scoped>
.auto-reply-stats {
  margin-bottom: var(--space-6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.stat-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-100);
  text-align: center;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}

.stat-card--rules::before {
  background: var(--primary-600);
}

.stat-card--replies::before {
  background: #22c55e;
}

.stat-card--hours::before {
  background: #f59e0b;
}

.stat-card--rate::before {
  background: #a855f7;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1);
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: var(--space-1);
  color: var(--gray-900);
}

.stat-card--rules .stat-value {
  color: var(--primary-600);
}

.stat-card--replies .stat-value {
  color: #22c55e;
}

.stat-card--rate .stat-value {
  color: #a855f7;
}

.text-amber {
  color: #f59e0b !important;
}

.text-red {
  color: #ef4444 !important;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: var(--space-4) var(--space-5);
  }

  .stat-value {
    font-size: 1.5rem;
  }
}
</style>
