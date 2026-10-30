<template>
  <aside class="preview-section">
    <section class="ui-lead preview-card">
      <div class="lead-head">
        <p class="lead-kicker">
          即將產生
        </p>
        <h3
          class="lead-title"
          :class="{ 'is-empty': !reportType }"
        >
          {{ reportType ? reportTypeLabel : '新報表' }}
        </h3>
        <p
          class="lead-sub"
          :class="{ 'is-empty': !title.trim() }"
        >
          {{ title.trim() || '填完下方兩項就能產生' }}
        </p>
      </div>

      <ul
        class="need"
        aria-label="必填項目"
      >
        <li :class="{ done: !!reportType }">
          <svg
            v-if="reportType"
            class="need-ok"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="m5 12 5 5 9-10" /></svg>
          <span class="need-name">報表類型</span>
          <span class="need-state">{{ reportType ? '已選擇' : '尚未選擇' }}</span>
        </li>
        <li :class="{ done: !!title.trim() }">
          <svg
            v-if="title.trim()"
            class="need-ok"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="m5 12 5 5 9-10" /></svg>
          <span class="need-name">報表標題</span>
          <span class="need-state">{{ title.trim() ? '已填寫' : '尚未填寫' }}</span>
        </li>
      </ul>

      <dl class="kv">
        <div
          v-if="timeRange"
          class="kv-row"
        >
          <dt>時間範圍</dt>
          <dd>{{ timeRangeLabel }}</dd>
        </div>
        <div class="kv-row">
          <dt>格式</dt>
          <dd>{{ formatLabel }}</dd>
        </div>
        <div class="kv-row">
          <dt>內容</dt>
          <dd>{{ contentLabel }}</dd>
        </div>
        <div
          v-if="options?.maxRecords"
          class="kv-row"
        >
          <dt>筆數上限</dt>
          <dd>{{ options.maxRecords.toLocaleString('en-US') }}</dd>
        </div>
      </dl>

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
  return same.slice(0, 5)
});

const contentLabel = computed(() => {
  const o = props.options;
  if (!o) { return '預設' }
  const parts = [o.includeSummary && '摘要', o.includeCharts && '圖表', o.includeDetails && '明細'].filter(Boolean);
  return parts.length > 0 ? parts.join('、') : '僅基本資料';
});

const reportTypeLabel = computed(() => {
  if (!props.reportType) {
    return '';
  }
  return ReportsAPI.formatReportType(props.reportType);
});

const formatLabel = computed(() => {
  const formats = ReportsAPI.getAvailableFormats() || [];
  const found = formats.find(f => f.value === props.format);
  return found?.label || props.format;
});

const timeRangeLabel = computed(() => {
  const ranges = ReportsAPI.getTimeRangeOptions() || [];
  const found = ranges.find(r => r.value === props.timeRange);
  return found?.label || props.timeRange;
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

.lead-title.is-empty,
.lead-sub.is-empty {
  color: var(--ui-muted);
}

.lead-title.is-empty {
  font-weight: 600;
}

.lead-sub {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.need {
  display: grid;
  margin: 0;
  padding: 0 24px 6px;
  list-style: none;
  font-size: 14px;
}

.need li {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 32px;
  color: var(--ui-ink-2);
}

.need-name {
  font-weight: 600;
}

.need-state {
  margin-left: auto;
  font-size: 13px;
  color: var(--ui-muted);
}

.need-ok {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--ui-green-ink);
}

.need .done .need-state {
  color: var(--ui-green-ink);
}

.kv {
  margin: 0;
  padding: 0 24px;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  font-size: 14px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.kv-row dt {
  flex: none;
  color: var(--ui-ink-2);
}

.kv-row dd {
  margin: 0;
  font-size: 15px;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
  text-align: right;
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
  .recent-list li:nth-child(n + 4) {
    display: none;
  }
}
</style>
