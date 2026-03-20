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
            <!-- eslint-disable vue/no-v-html -->
            <span
              class="stat-icon__svg"
              :style="{ color: card.iconColor }"
              v-html="card.svgIcon"
            />
            <!-- eslint-enable vue/no-v-html -->
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

const props = defineProps<{
  overview: ActivityOverview | null
  loading: boolean
}>()

// Apple SF Symbols-inspired filled SVG icons for stat cards (Premium Redesigned)
const SVG_ICONS = {
  // list.bullet.rectangle.fill — filled document with list lines
  activities: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" opacity="0.1" /><path d="M20 8h-6V2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" /><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><path d="M8 13h2l1-2 2 4 1-2h2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  // person.2.fill — two filled person silhouettes
  users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4" opacity="0.15" /><path d="M12 11c-3.5 0-7 2-7 5v2h14v-2c0-3-3.5-5-7-5z" opacity="0.15" /><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M5 18v-2c0-3 3.5-5 7-5s7 2 7 5v2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><path d="M17 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="currentColor" opacity="0.4" /><path d="M7 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor" opacity="0.4" /></svg>',
  // chart.bar.fill — filled bar chart
  topAction: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="13" width="4" height="8" rx="1.5" opacity="0.2" /><rect x="10" y="8" width="4" height="13" rx="1.5" opacity="0.5" /><rect x="17" y="3" width="4" height="18" rx="1.5" /><path d="M3 21h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3" /><path d="M18 5l2 2-2 2M20 7H14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>',
  // key.fill — filled key icon
  logins: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V5l-8-3z" opacity="0.1" /><path d="M12 2L4 5v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V5l-8-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /><circle cx="12" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M12 14v3M10.5 17h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>',
}

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
      svgIcon: SVG_ICONS.activities,
      iconBg: '#EFF6FF',
      iconColor: '#007AFF',
      label: '\u7E3D\u6D3B\u52D5',
      secondaryLabel: '',
      value: props.overview.totalActivities,
      subtitle: periodLabel.value,
    },
    {
      key: 'users',
      svgIcon: SVG_ICONS.users,
      iconBg: '#F0FDF4',
      iconColor: '#34C759',
      label: '\u6D3B\u8E8D\u7528\u6236',
      secondaryLabel: '',
      value: props.overview.topUsers.length,
      subtitle: periodLabel.value,
    },
    {
      key: 'action',
      svgIcon: SVG_ICONS.topAction,
      iconBg: '#FFF7ED',
      iconColor: '#FF9500',
      label: '\u6700\u591A\u64CD\u4F5C',
      secondaryLabel: topAction.value.label,
      value: topAction.value.count,
      subtitle: periodLabel.value,
    },
    {
      key: 'logins',
      svgIcon: SVG_ICONS.logins,
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
  margin-bottom: 16px;
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

.stat-icon__svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.stat-label {
  font-size: 13px;
  font-weight: 500;
  color: #8E8E93;
  line-height: 1.3;
  white-space: nowrap;
}

.stat-secondary {
  font-size: 13px;
  color: #8E8E93;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #1C1C1E;
  line-height: 1.1;
  margin-bottom: 6px;
  white-space: nowrap;
  letter-spacing: -0.02em;
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
