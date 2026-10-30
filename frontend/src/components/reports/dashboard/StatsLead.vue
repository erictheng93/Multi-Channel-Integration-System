<template>
  <article
    class="ui-lead lead"
    role="group"
    aria-label="本月報表"
    :aria-busy="!loaded || undefined"
  >
    <div class="lead-main">
      <div class="lead-kicker">
        本月報表
      </div>
      <div
        class="lead-num"
        :class="{ 'is-dim': loaded && stats.thisMonthGenerated === 0 }"
      >
        {{ loaded ? stats.thisMonthGenerated.toLocaleString('en-US') : '—' }}<small>份</small>
      </div>
      <div class="lead-meaning">
        本月已產生的報表數，累計 {{ stats.totalReports.toLocaleString('en-US') }} 份，完成率 {{ completionRate }}%
      </div>
      <button
        v-if="stats.failedReports > 0"
        type="button"
        class="ui-link action-link"
        @click="$emit('show-failed-reports')"
      >
        查看 {{ stats.failedReports }} 份失敗的報表
      </button>
    </div>

    <div
      v-if="stats.totalReports > 0"
      class="lead-rings"
    >
      <ServiceRings
        summary="報表狀態"
        :rings="rings"
        :size="168"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
/**
 * StatsLead: the page's lead object. The month figure is the headline; the rings are the
 * completed / processing / failed share of all reports, taken from the same summary.
 */
import { computed } from 'vue'
import ServiceRings, { type ServiceRing } from '@/components/ui/ServiceRings.vue'
import type { DashboardStats } from '@/types/reports'

const props = defineProps<{
  stats: DashboardStats
  loaded: boolean
}>()

defineEmits<{
  'show-failed-reports': []
}>()

const completionRate = computed(() => {
  if (props.stats.totalReports === 0) {
    return 0
  }
  return Math.round((props.stats.completedReports / props.stats.totalReports) * 100)
})

const rings = computed<ServiceRing[]>(() => [
  { label: '已完成', value: props.stats.completedReports, total: props.stats.totalReports, of: '份', hue: 'var(--ui-green)' },
  { label: '處理中', value: props.stats.pendingReports, total: props.stats.totalReports, of: '份', hue: 'var(--ui-orange)' },
  { label: '失敗', value: props.stats.failedReports, total: props.stats.totalReports, of: '份', hue: 'var(--ui-red)' },
])
</script>

<style scoped>
.lead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 20px 40px;
  align-items: center;
  padding: 24px 40px;
}

.lead:not(:has(.lead-rings)) {
  grid-template-columns: minmax(0, 1fr);
}

.lead-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.lead-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.lead-num {
  margin-top: 4px;
  font: 600 56px / 1.05 var(--ui-font-display);
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.lead-num.is-dim {
  color: var(--ui-muted);
}

.lead-num small {
  margin-left: 6px;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.lead-meaning {
  margin-top: 6px;
  font-size: 15px;
  color: var(--ui-ink-2);
}

.action-link {
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 14px;
}

.lead-rings {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.lead-rings::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -20px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

@media (max-width: 768px) {
  .lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .lead-num {
    font-size: 48px;
  }

  .lead-rings {
    justify-content: flex-start;
  }

  .lead-rings::before {
    display: none;
  }
}
</style>
