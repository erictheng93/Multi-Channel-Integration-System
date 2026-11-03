<template>
  <aside class="preview-section">
    <section class="ui-lead preview-card">
      <div class="lead-head">
        <p class="lead-kicker">
          報表標題
        </p>
        <h3
          class="lead-title"
          :class="{ 'is-empty': !title.trim() }"
        >
          {{ title.trim() || '填寫標題後即可產生' }}
        </h3>
      </div>

      <div
        v-if="reportType"
        class="sample"
      >
        <h4 class="sample-cap">
          報表會包含
        </h4>
        <ul class="sample-chips">
          <li
            v-for="item in contents"
            :key="item.label"
            :title="item.hint"
          >
            {{ item.label }}
          </li>
        </ul>
        <p class="sample-opts">
          {{ optionsLine }}
        </p>
      </div>
      <p
        v-else
        class="sample-empty"
      >
        選擇類型後，這裡會列出報表包含的內容。
      </p>

      <slot name="action" />
    </section>

    <section
      v-if="isGenerating"
      class="ui-card progress-card"
      aria-live="polite"
    >
      <div class="ui-card-head">
        <h3 class="ui-card-title">
          產生中
        </h3>
      </div>
      <div class="progress-content">
        <div
          class="progress-bar"
          role="progressbar"
          aria-label="報表產生中"
        >
          <div class="progress-fill" />
        </div>
        <p
          v-if="currentStep"
          class="progress-status"
        >
          {{ currentStep }}
        </p>
      </div>
    </section>

    <div
      v-if="shownRecent.length > 0"
      class="recent-wrap"
    >
      <h3 class="ui-group-label">
        {{ reportType ? `最近的${reportTypeLabel}` : '最近報表' }}
      </h3>
      <ul class="ui-group recent-list">
        <li
          v-for="report in shownRecent"
          :key="report.id"
        >
          <button
            type="button"
            class="recent-item"
            @click="$emit('view-report', report.id)"
          >
            <span
              class="recent-dot"
              :class="report.status"
              aria-hidden="true"
            />
            <span class="recent-info">
              <span class="recent-name">{{ report.title }}</span>
              <span class="recent-meta">{{ formatDate(report.createdAt) }} · {{ statusLabel(report.status) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
import { REPORT_CONTENTS } from './templates/templateHelpers';
import type {
  ReportType,
  ReportFormat,
  ReportTimeRange,
  ReportBase,
  ReportOptions
} from '@/types/reports';

interface Props {
  reportType: ReportType | null;
  title: string;
  format: ReportFormat;
  timeRange: ReportTimeRange | '';
  isGenerating: boolean;
  currentStep: string;
  recentReports: ReportBase[];
  options?: ReportOptions;
}

const props = defineProps<Props>();

defineEmits<{
  'view-report': [reportId: string];
}>();

// Same type as the one being set up (the list is long on the dashboard already); all types until one is chosen
const shownRecent = computed(() => {
  const same = props.reportType ? props.recentReports.filter(item => item.type === props.reportType) : props.recentReports
  return same.slice(0, 4)
});

const contents = computed(() => (props.reportType ? REPORT_CONTENTS[props.reportType] ?? [] : []));

const optionsLine = computed(() => {
  const o = props.options;
  if (!o) { return '' }
  const parts = [o.includeSummary && '摘要', o.includeCharts && '圖表', o.includeDetails && '明細'].filter(Boolean);
  const body = parts.length > 0 ? parts.join('、') : '僅基本資料';
  return o.maxRecords ? `${body} ・ 上限 ${o.maxRecords.toLocaleString('en-US')} 筆` : body;
});

const reportTypeLabel = computed(() => {
  if (!props.reportType) {
    return '';
  }
  return ReportsAPI.formatReportType(props.reportType);
});

const statusLabel = (status: string): string => ReportsAPI.formatReportStatus(status).label;

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};
</script>

<style scoped>
.preview-section {
  display: grid;
  gap: 16px;
}

.preview-card {
  padding: 24px 0 0;
}

.lead-head {
  padding: 0 24px 14px;
}

.lead-kicker {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.lead-title {
  margin: 2px 0 0;
  font: 700 24px / 1.2 var(--ui-font-display);
  letter-spacing: -0.025em;
}

.lead-title.is-empty {
  color: var(--ui-muted);
}

.lead-title.is-empty {
  font-weight: 600;
}


.sample {
  padding: 4px 24px 0;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.sample-cap {
  margin: 14px 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.sample-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
}

.sample-chips li {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--ui-green-soft);
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-green-ink);
}

.sample-opts {
  margin: 4px 0 0;
  padding: 12px 0 14px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.sample-empty {
  margin: 0;
  padding: 16px 24px 8px;
  font-size: 14px;
  color: var(--ui-muted);
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.progress-content {
  padding: 0 22px 20px;
}

.progress-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

/* Indeterminate: the server gives no percentage, so none is shown */
.progress-fill {
  width: 35%;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-accent);
  animation: report-indeterminate 1.4s var(--ui-ease) infinite;
}

@keyframes report-indeterminate {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(300%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    width: 100%;
    animation: none;
    opacity: 0.6;
  }
}

.progress-status {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.recent-list {
  margin: 0;
  padding: 6px 8px;
  list-style: none;
}

.recent-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 0;
  border-radius: 12px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.recent-item:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.recent-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-orange);
}

.recent-dot.completed {
  background: var(--ui-green);
}

.recent-dot.failed {
  background: var(--ui-red);
}

.recent-dot.expired {
  background: var(--ui-faint);
}

.recent-info {
  display: grid;
  min-width: 0;
}

.recent-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-meta {
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  /* Past reports are not part of filling the form in on a phone */
  .recent-wrap {
    display: none;
  }
}
</style>
