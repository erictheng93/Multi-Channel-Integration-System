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
          {{ reportType ? reportTypeLabel : '尚未選擇類型' }}
        </h3>
        <p
          class="lead-sub"
          :class="{ 'is-empty': !title.trim() }"
        >
          {{ title.trim() || '尚未輸入標題' }}
        </p>
      </div>

      <ul
        class="need"
        aria-label="必填項目"
      >
        <li :class="{ done: !!reportType }">
          <span
            class="tick"
            aria-hidden="true"
          />報表類型
        </li>
        <li :class="{ done: !!title.trim() }">
          <span
            class="tick"
            aria-hidden="true"
          />報表標題
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

      <div
        v-if="includes.length"
        class="inc"
      >
        <h4 class="inc-h">
          報表會包含
        </h4>
        <ul class="inc-list">
          <li
            v-for="item in includes"
            :key="item.label"
          >
            {{ item.label }}
          </li>
        </ul>
      </div>
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
      v-if="recentReports.length > 0"
      class="recent-wrap"
    >
      <h3 class="ui-group-label">
        最近報表
      </h3>
      <ul class="ui-group recent-list">
        <li
          v-for="report in recentReports.slice(0, 5)"
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

// What the report will contain: the generator's own field labels for the chosen type
const includes = computed(() => (props.reportType ? REPORT_CONTENTS[props.reportType] ?? [] : []));

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
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 0 24px 14px;
  list-style: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.need li {
  display: flex;
  gap: 6px;
  align-items: center;
}

.tick {
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-muted);
}

.need .done .tick {
  background: var(--ui-green);
  box-shadow: none;
}

.need .done .tick::after {
  width: 8px;
  height: 4px;
  margin-top: -2px;
  border-bottom: 2px solid #fff;
  border-left: 2px solid #fff;
  transform: rotate(-45deg);
  content: '';
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
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
  text-align: right;
}

.inc {
  padding: 12px 24px 4px;
  box-shadow: 0 -0.5px 0 var(--ui-sep);
}

.inc-h {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.inc-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.inc-list li {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--ui-fill);
  font-size: 13px;
  color: var(--ui-ink-2);
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
