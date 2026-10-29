<template>
  <section class="ui-card selected-template-details">
    <div class="ui-card-head">
      <div>
        <h2 class="ui-card-title">
          {{ template.name }}
        </h2>
        <p class="ui-card-sub">
          {{ template.description }}
        </p>
      </div>
      <div class="ui-card-end">
        <button
          class="close-details"
          type="button"
          aria-label="關閉"
          @click="$emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          ><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    </div>

    <dl class="kv">
      <div class="kv-row">
        <dt>類別</dt>
        <dd>{{ getCategoryLabel(template.category) }}</dd>
      </div>
      <div class="kv-row">
        <dt>包含圖表</dt>
        <dd>{{ template.presetOptions.includeCharts ? '是' : '否' }}</dd>
      </div>
      <div class="kv-row">
        <dt>包含摘要</dt>
        <dd>{{ template.presetOptions.includeSummary ? '是' : '否' }}</dd>
      </div>
      <div class="kv-row">
        <dt>包含詳細資料</dt>
        <dd>{{ template.presetOptions.includeDetails ? '是' : '否' }}</dd>
      </div>
      <div
        v-if="template.presetOptions.chartType"
        class="kv-row"
      >
        <dt>圖表類型</dt>
        <dd>{{ getChartTypeLabel(template.presetOptions.chartType) }}</dd>
      </div>
      <div
        v-if="template.presetOptions.maxRecords"
        class="kv-row"
      >
        <dt>最大記錄數</dt>
        <dd>{{ template.presetOptions.maxRecords.toLocaleString() }}</dd>
      </div>
    </dl>

    <div class="template-actions">
      <button
        class="btn btn-primary use-template-btn"
        :disabled="generating"
        @click="$emit('use', template)"
      >
        {{ generating ? '產生中...' : '使用此模板' }}
      </button>
      <button
        class="btn btn-secondary customize-template-btn"
        @click="$emit('customize', template)"
      >
        自訂設定
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ReportTemplate } from '@/types/reports';
import {
  getCategoryLabel,
  getChartTypeLabel
} from './templateHelpers';

defineProps<{
  template: ReportTemplate;
  generating: boolean;
}>();

defineEmits<{
  close: [];
  use: [template: ReportTemplate];
  customize: [template: ReportTemplate];
}>();
</script>

<style scoped>
.close-details {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
  cursor: pointer;
}

.close-details svg {
  width: 14px;
  height: 14px;
}

.kv {
  margin: 0;
  padding: 0 22px;
}

.kv-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  font-size: 13.5px;
  box-shadow: 0 0.5px 0 var(--ui-sep);
}

.kv-row:last-child {
  box-shadow: none;
}

.kv-row dt {
  color: var(--ui-muted);
}

.kv-row dd {
  margin: 0;
  font-weight: 600;
}

.template-actions {
  display: grid;
  gap: 8px;
  padding: 14px 22px 22px;
}

.template-actions .btn {
  width: 100%;
}
</style>
