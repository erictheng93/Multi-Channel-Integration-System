<template>
  <section class="ui-kpi-grid">
    <article class="ui-card ui-kpi stat-card">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-blue"><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z M14 3v5h5" /></svg></span>
        總報表數
      </div>
      <div class="ui-kpi-value">
        {{ stats.totalReports }}
      </div>
      <div class="ui-kpi-foot">
        <span>{{ stats.thisMonthGenerated > 0 ? '本月新增' : '全部狀態合計' }}</span>
        <b
          v-if="stats.thisMonthGenerated > 0"
          class="foot-val"
        >{{ stats.thisMonthGenerated.toLocaleString() }}</b>
      </div>
    </article>

    <article class="ui-card ui-kpi stat-card">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-green"><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
        已完成
      </div>
      <div class="ui-kpi-value">
        {{ stats.completedReports }}
      </div>
      <div class="ui-kpi-foot">
        <span>完成率</span>
        <b class="foot-val is-green">{{ completionRate }}%</b>
      </div>
    </article>

    <article class="ui-card ui-kpi stat-card">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-orange"><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></span>
        處理中
      </div>
      <div class="ui-kpi-value">
        {{ stats.pendingReports }}
      </div>
      <div class="ui-kpi-foot">
        <span
          v-if="stats.pendingReports > 0"
          class="ui-pill ui-pill-orange ui-pill-dot"
        >進行中</span>
        <span v-else>目前沒有進行中的報表</span>
      </div>
    </article>

    <article class="ui-card ui-kpi stat-card">
      <div class="ui-kpi-top">
        <span class="ui-kpi-ico ico-red"><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg></span>
        失敗
      </div>
      <div class="ui-kpi-value">
        {{ stats.failedReports }}
      </div>
      <div class="ui-kpi-foot">
        <span>累計失敗</span>
        <button
          v-if="stats.failedReports > 0"
          type="button"
          class="ui-link action-link"
          @click="$emit('show-failed-reports')"
        >
          查看詳情
        </button>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
/**
 * StatsGrid Component
 *
 * 显示报表仪表板的统计卡片网格（数字来自报表列表 summary）
 */
import { computed } from 'vue'
import type { DashboardStats } from '@/types/reports'

export interface StatsGridProps {
  stats: DashboardStats
}

const props = defineProps<StatsGridProps>()

defineEmits<{
  'show-failed-reports': []
}>()

const completionRate = computed(() => {
  if (props.stats.totalReports === 0) {
    return 0
  }
  return Math.round((props.stats.completedReports / props.stats.totalReports) * 100)
})
</script>

<style scoped>
/* Neutralise the legacy global .stat-card (centered flex row, border, hover lift) */
.stat-card {
  align-items: stretch;
  gap: 10px;
  padding: 18px 20px 16px;
  border: 0;
  box-shadow: var(--ui-shadow-card);
  transform: none;
}

.stat-card:hover {
  box-shadow: var(--ui-shadow-card);
  transform: none;
}

.ico-blue {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.ico-green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.ico-orange {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.ico-red {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.ui-kpi-foot {
  min-height: 24px;
}

.foot-val {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
}

.foot-val.is-green {
  color: var(--ui-green-ink);
}

.action-link {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
}
</style>
