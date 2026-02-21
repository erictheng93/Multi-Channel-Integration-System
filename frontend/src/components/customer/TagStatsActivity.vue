<template>
  <div class="tag-stats-activity">
    <!-- Usage Trend (Last 30 Days) -->
    <div
      v-if="usageTrend && usageTrend.length > 0"
      class="section"
    >
      <h3 class="section-title">
        使用趨勢（最近30天）
      </h3>
      <div class="usage-trend">
        <div
          v-for="trend in usageTrend.slice(0, 7)"
          :key="trend.date"
          class="trend-item"
        >
          <div class="trend-date">
            {{ formatTrendDate(trend.date) }}
          </div>
          <div class="trend-bar-container">
            <div
              class="trend-bar"
              :style="{
                width: calculateBarWidth(trend.assignments, usageTrend) + '%'
              }"
            />
          </div>
          <div class="trend-count">
            {{ trend.assignments }}
          </div>
        </div>
      </div>
    </div>

    <!-- Top Assigners -->
    <div
      v-if="topAssigners && topAssigners.length > 0"
      class="section"
    >
      <h3 class="section-title">
        最活躍使用者（最近30天）
      </h3>
      <div class="assigners-list">
        <div
          v-for="(assigner, index) in topAssigners.slice(0, 5)"
          :key="index"
          class="assigner-item"
        >
          <div class="assigner-rank">
            #{{ index + 1 }}
          </div>
          <div class="assigner-info">
            <div class="assigner-name">
              {{ assigner.name }}
            </div>
            <div class="assigner-count">
              標記了 {{ assigner.assignments }} 次
            </div>
          </div>
          <div class="assigner-badge">
            <svg
              v-if="index === 0"
              class="badge-icon gold"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <svg
              v-else-if="index === 1"
              class="badge-icon silver"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <svg
              v-else-if="index === 2"
              class="badge-icon bronze"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  usageTrend: Array<{ date: string; assignments: number }>
  topAssigners: Array<{ name: string; assignments: number }>
}>()

const formatTrendDate = (dateString: string): string => {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return '今天'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  } else {
    return date.toLocaleDateString('zh-TW', {
      month: 'numeric',
      day: 'numeric'
    })
  }
}

const calculateBarWidth = (value: number, trendData: Array<{ date: string; assignments: number }>): number => {
  if (!trendData || trendData.length === 0) {return 0}
  const maxValue = Math.max(...trendData.map(t => t.assignments))
  if (maxValue === 0) {return 0}
  return Math.max((value / maxValue) * 100, 5) // Minimum 5% for visibility
}
</script>

<style scoped>
.section {
  margin-bottom: var(--space-6);
}

.section-title {
  margin: 0 0 var(--space-3) 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Usage Trend Styles */
.usage-trend {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.trend-item {
  display: grid;
  grid-template-columns: 80px 1fr 50px;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.trend-item:hover {
  border-color: var(--primary-300);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.trend-date {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--gray-700);
}

.trend-bar-container {
  height: 24px;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}

.trend-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: var(--radius-md);
  transition: width var(--transition-normal);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
}

.trend-count {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-900);
  text-align: right;
}

/* Top Assigners Styles */
.assigners-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.assigner-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.assigner-item:hover {
  border-color: var(--gray-300);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transform: translateX(4px);
}

.assigner-rank {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-100);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--gray-700);
  flex-shrink: 0;
}

.assigner-item:first-child .assigner-rank {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.assigner-item:nth-child(2) .assigner-rank {
  background: linear-gradient(135deg, #d1d5db, #9ca3af);
  color: white;
}

.assigner-item:nth-child(3) .assigner-rank {
  background: linear-gradient(135deg, #d97706, #b45309);
  color: white;
}

.assigner-info {
  flex: 1;
  min-width: 0;
}

.assigner-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
}

.assigner-count {
  font-size: 0.8125rem;
  color: var(--gray-600);
}

.assigner-badge {
  flex-shrink: 0;
}

.badge-icon {
  width: 24px;
  height: 24px;
}

.badge-icon.gold {
  color: #fbbf24;
  filter: drop-shadow(0 2px 4px rgba(251, 191, 36, 0.5));
}

.badge-icon.silver {
  color: #9ca3af;
  filter: drop-shadow(0 2px 4px rgba(156, 163, 175, 0.5));
}

.badge-icon.bronze {
  color: #d97706;
  filter: drop-shadow(0 2px 4px rgba(217, 119, 6, 0.5));
}

@media (max-width: 640px) {
  .trend-item {
    grid-template-columns: 60px 1fr 40px;
    gap: var(--space-2);
  }

  .trend-date {
    font-size: 0.75rem;
  }

  .assigner-rank {
    width: 32px;
    height: 32px;
    font-size: 0.75rem;
  }

  .assigner-name {
    font-size: 0.875rem;
  }

  .assigner-count {
    font-size: 0.75rem;
  }
}
</style>
