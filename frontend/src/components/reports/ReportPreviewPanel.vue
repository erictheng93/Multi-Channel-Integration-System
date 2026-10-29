<template>
  <aside class="preview-section">
    <section class="ui-card preview-card">
      <div class="ui-card-head">
        <div>
          <h3 class="ui-card-title">
            即將產生
          </h3>
          <p class="ui-card-sub">
            依目前設定
          </p>
        </div>
      </div>
      <dl
        v-if="reportType"
        class="kv"
      >
        <div class="kv-row">
          <dt>報表類型</dt>
          <dd>{{ reportTypeLabel }}</dd>
        </div>
        <div
          v-if="title"
          class="kv-row"
        >
          <dt>標題</dt>
          <dd>{{ title }}</dd>
        </div>
        <div class="kv-row">
          <dt>格式</dt>
          <dd>{{ formatLabel }}</dd>
        </div>
        <div
          v-if="timeRange"
          class="kv-row"
        >
          <dt>時間範圍</dt>
          <dd>{{ timeRangeLabel }}</dd>
        </div>
      </dl>
      <p
        v-else
        class="hint"
      >
        選擇報表類型後會在這裡顯示設定摘要。
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

    <section
      v-if="recentReports.length > 0"
      class="ui-card recent-reports"
    >
      <div class="ui-card-head">
        <h3 class="ui-card-title">
          最近報表
        </h3>
      </div>
      <ul class="recent-list">
        <li
          v-for="report in recentReports.slice(0, 3)"
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
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
import type {
  ReportType,
  ReportFormat,
  ReportTimeRange,
  ReportBase
} from '@/types/reports';

interface Props {
  reportType: ReportType | null;
  title: string;
  format: ReportFormat;
  timeRange: ReportTimeRange | '';
  isGenerating: boolean;
  currentStep: string;
  recentReports: ReportBase[];
}

const props = defineProps<Props>();

defineEmits<{
  'view-report': [reportId: string];
}>();

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

.kv {
  margin: 0;
  padding: 0 22px;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  font-size: 13.5px;
  box-shadow: 0 0.5px 0 var(--ui-sep);
}

.kv-row:last-child {
  box-shadow: none;
}

.kv-row dt {
  flex: none;
  color: var(--ui-muted);
}

.kv-row dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
  text-align: right;
}

.hint {
  margin: 0;
  padding: 0 22px 18px;
  font-size: 13.5px;
  color: var(--ui-muted);
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
  font-size: 12.5px;
  color: var(--ui-muted);
}

.recent-list {
  margin: 0;
  padding: 0 8px 10px;
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
  font-size: 12px;
  color: var(--ui-muted);
}
</style>
