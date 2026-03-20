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
        <div class="stat-card__top">
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
          <span class="stat-label">{{ card.label }}</span>
        </div>
        <div
          v-if="card.secondaryLabel"
          class="stat-secondary"
        >
          {{ card.secondaryLabel }}
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

/* eslint-disable camelcase */
const ACTION_LABEL_MAP: Record<string, string> = {
  user_login: '\u767b\u5165',
  user_logout: '\u767b\u51fa',
  message_send: '\u8a0a\u606f\u767c\u9001',
  message_recall: '\u8a0a\u606f\u64a4\u56de',
  conversation_assign: '\u5c0d\u8a71\u6307\u6d3e',
  conversation_transfer: '\u5c0d\u8a71\u8f49\u79fb',
  conversation_close: '\u5c0d\u8a71\u95dc\u9589',
  conversation_reopen: '\u5c0d\u8a71\u91cd\u958b',
  settings_update: '\u8a2d\u5b9a\u66f4\u65b0',
  team_invite: '\u5718\u968a\u9080\u8acb',
  team_member_update: '\u6210\u54e1\u66f4\u65b0',
  team_member_remove: '\u6210\u54e1\u79fb\u9664',
}
/* eslint-enable camelcase */

const topAction = computed(() => {
  if (!props.overview) { return { label: '-', count: 0 } }
  const stats = props.overview.actionStats
  const entries = Object.entries(stats)
  if (entries.length === 0) { return { label: '-', count: 0 } }
  const [name, count] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { label: ACTION_LABEL_MAP[name] || name, count }
})

const periodLabel = computed(() => {
  if (!props.overview) {return ''}
  return `\u8FD1 ${props.overview.period.days} \u5929`
})

const cards = computed(() => {
  if (!props.overview) {return []}
  return [
    {
      key: 'total',
      icon: FileIcon,
      iconBg: '#EFF6FF',
      iconColor: '#007AFF',
      label: '\u7E3D\u6D3B\u52D5',
      secondaryLabel: '',
      value: props.overview.totalActivities,
      subtitle: periodLabel.value,
    },
    {
      key: 'users',
      icon: UsersIcon,
      iconBg: '#F0FDF4',
      iconColor: '#34C759',
      label: '\u6D3B\u8E8D\u7528\u6236',
      secondaryLabel: '',
      value: props.overview.topUsers.length,
      subtitle: periodLabel.value,
    },
    {
      key: 'action',
      icon: BarChartIcon,
      iconBg: '#FFF7ED',
      iconColor: '#FF9500',
      label: '\u6700\u591A\u64CD\u4F5C',
      secondaryLabel: topAction.value.label,
      value: topAction.value.count,
      subtitle: periodLabel.value,
    },
    {
      key: 'logins',
      icon: LoginIcon,
      iconBg: '#F2E8FB',
      iconColor: '#AF52DE',
      label: '\u767B\u5165\u6B21\u6578',
      secondaryLabel: '',
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

.stat-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: #8E8E93;
  line-height: 1.3;
}

.stat-secondary {
  font-size: 13px;
  color: #8E8E93;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1C1C1E;
  line-height: 1.2;
  margin-bottom: 4px;
  white-space: nowrap;
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
