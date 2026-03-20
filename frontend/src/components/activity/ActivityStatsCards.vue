<template>
  <div
    v-if="loading || overview !== null"
    class="stats-grid"
  >
    <template v-if="loading">
      <div
        v-for="i in 4"
        :key="i"
        class="stat-card stat-card--skeleton"
      >
        <div class="skeleton-icon shimmer" />
        <div class="skeleton-label shimmer" />
        <div class="skeleton-value shimmer" />
        <div class="skeleton-subtitle shimmer" />
      </div>
    </template>
    <template v-else-if="overview !== null">
      <div
        v-for="card in cards"
        :key="card.key"
        class="stat-card"
      >
        <div
          class="stat-icon"
          :style="{ backgroundColor: card.iconBg }"
        >
          <component
            :is="card.icon"
            :size="20"
            :style="{ color: card.iconColor }"
          />
        </div>
        <div class="stat-label">
          {{ card.label }}
        </div>
        <div class="stat-value">
          {{ card.value }}
        </div>
        <div class="stat-subtitle">
          {{ card.subtitle }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityOverview } from '@/api/activities'
import { FileIcon, UsersIcon, BarChartIcon, LoginIcon } from '@/components/icons'

const props = defineProps<{
  overview: ActivityOverview | null
  loading: boolean
}>()

const topAction = computed(() => {
  if (!props.overview) {return { name: '-', count: 0 }}
  const stats = props.overview.actionStats
  const entries = Object.entries(stats)
  if (entries.length === 0) {return { name: '-', count: 0 }}
  const [name, count] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { name, count }
})

const periodLabel = computed(() => {
  if (!props.overview) {return ''}
  return `Last ${props.overview.period.days} days`
})

const cards = computed(() => {
  if (!props.overview) {return []}
  return [
    {
      key: 'total',
      icon: FileIcon,
      iconBg: '#EFF6FF',
      iconColor: '#007AFF',
      label: 'Total Activities',
      value: props.overview.totalActivities,
      subtitle: periodLabel.value,
    },
    {
      key: 'users',
      icon: UsersIcon,
      iconBg: '#F0FDF4',
      iconColor: '#34C759',
      label: 'Top Users',
      value: props.overview.topUsers.length,
      subtitle: periodLabel.value,
    },
    {
      key: 'action',
      icon: BarChartIcon,
      iconBg: '#FFF7ED',
      iconColor: '#FF9500',
      label: 'Top Action',
      value: `${topAction.value.name} (${topAction.value.count})`,
      subtitle: periodLabel.value,
    },
    {
      key: 'logins',
      icon: LoginIcon,
      iconBg: '#F2E8FB',
      iconColor: '#AF52DE',
      label: 'Logins',
      value: props.overview.actionStats['user_login'] ?? 0,
      subtitle: periodLabel.value,
    },
  ]
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stat-card {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  padding: 20px;
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
  cursor: default;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgb(0 0 0 / 0.08);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: #8E8E93;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1C1C1E;
  margin-bottom: 4px;
  word-break: break-word;
}

.stat-subtitle {
  font-size: 12px;
  color: #AEAEB2;
}

/* Skeleton */
.stat-card--skeleton {
  cursor: default;
}

.stat-card--skeleton:hover {
  transform: none;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
}

.skeleton-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #E5E5EA;
  margin-bottom: 12px;
}

.skeleton-label {
  height: 12px;
  width: 60%;
  border-radius: 6px;
  background: #E5E5EA;
  margin-bottom: 8px;
}

.skeleton-value {
  height: 28px;
  width: 40%;
  border-radius: 6px;
  background: #E5E5EA;
  margin-bottom: 6px;
}

.skeleton-subtitle {
  height: 12px;
  width: 50%;
  border-radius: 6px;
  background: #E5E5EA;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}
</style>
