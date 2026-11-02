<template>
  <div class="parameter-form">
    <section class="ui-card step-card">
      <div class="ui-card-head">
        <span
          class="step-n"
          :class="{ done: stepTwoDone }"
        >2</span>
        <div>
          <h3 class="ui-card-title">
            內容與時間範圍
          </h3>
          <p class="ui-card-sub">
            標題會顯示在報表列表與檔名
          </p>
        </div>
      </div>
      <div class="step-body">
        <div class="ui-field">
          <label for="title">報表標題 <span class="req">*</span></label>
          <input
            id="title"
            :value="title"
            type="text"
            class="ui-input"
            placeholder="輸入報表標題"
            :class="{ error: errors.title }"
            @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
          >
          <p
            v-if="errors.title"
            class="error-message"
          >
            {{ errors.title }}
          </p>
        </div>

        <div class="ui-field">
          <label for="description">報表描述（選填）</label>
          <textarea
            id="description"
            :value="description"
            class="ui-textarea"
            placeholder="輸入報表描述"
            rows="3"
            @input="$emit('update:description', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <div class="ui-field">
          <span
            id="timeRangeLabel"
            class="field-label"
          >時間範圍 <span class="req">*</span></span>
          <div
            class="range-seg ui-seg"
            role="group"
            aria-label="常用時間範圍"
          >
            <button
              v-for="option in commonRanges"
              :key="option.value"
              type="button"
              :aria-pressed="timeRange === option.value"
              @click="pickRange(option.value)"
            >
              {{ option.label }}
            </button>
            <button
              type="button"
              :aria-pressed="moreRangeActive"
              :aria-expanded="moreOpen || moreRangeActive"
              aria-controls="more-ranges"
              @click="moreOpen = !moreOpen"
            >
              {{ moreRangeActive ? moreRangeLabel : '更多' }}
            </button>
          </div>
          <ReportChoiceGroup
            v-if="moreOpen || moreRangeActive"
            id="more-ranges"
            class="more-ranges"
            :model-value="timeRange"
            :options="otherRanges"
            label="更多時間範圍"
            compact
            :columns="3"
            @update:model-value="emit('update:timeRange', $event as ReportTimeRange)"
          />
          <p
            v-if="errors.timeRange"
            class="error-message"
          >
            {{ errors.timeRange }}
          </p>
        </div>

        <div
          v-if="timeRange === 'custom'"
          class="ui-field"
        >
          <label for="startDate">自訂日期範圍</label>
          <div class="date-range">
            <input
              id="startDate"
              :value="startDate"
              type="date"
              class="ui-input"
              aria-label="開始日期"
              :max="endDate || today"
              @input="$emit('update:startDate', ($event.target as HTMLInputElement).value)"
            >
            <span class="date-separator">至</span>
            <input
              id="endDate"
              :value="endDate"
              type="date"
              class="ui-input"
              aria-label="結束日期"
              :min="startDate"
              :max="today"
              @input="$emit('update:endDate', ($event.target as HTMLInputElement).value)"
            >
          </div>
          <p
            v-if="errors.dateRange || errors.startDate || errors.endDate"
            class="error-message"
          >
            {{ errors.dateRange || errors.startDate || errors.endDate }}
          </p>
        </div>
      </div>
    </section>

    <section class="ui-card step-card">
      <div class="ui-card-head">
        <span
          class="step-n"
          :class="{ done: stepTwoDone }"
        >3</span>
        <div>
          <h3 class="ui-card-title">
            輸出格式
          </h3>
          <p class="ui-card-sub">
            依用途選擇
          </p>
        </div>
      </div>
      <div class="format-options">
        <ReportChoiceGroup
          :model-value="format"
          :options="formatOptions"
          label="輸出格式"
          @update:model-value="emit('update:format', $event as ReportFormat)"
        />
      </div>
      <p
        v-if="errors.format"
        class="error-message pad"
      >
        {{ errors.format }}
      </p>
    </section>

    <section class="ui-card step-card">
      <button
        type="button"
        class="adv-toggle"
        :aria-expanded="advancedOpen"
        aria-controls="advanced-body"
        @click="advancedOpen = !advancedOpen"
      >
        <span class="step-n">4</span>
        <span class="adv-text">
          <span class="ui-card-title">進階選項<span class="adv-tag">選填</span></span>
          <span class="ui-card-sub">{{ advancedSummary }}</span>
        </span>
        <span class="adv-more">{{ advancedOpen ? '收合' : '展開' }}</span>
        <svg
          class="adv-chev"
          :class="{ open: advancedOpen }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div
        v-show="advancedOpen"
        id="advanced-body"
      >
        <div class="switch-list">
          <div class="switch-row">
            <div>
              <div class="sw-title">
                包含圖表
              </div>
              <div class="sw-sub">
                在報表中加入趨勢與分布圖
              </div>
            </div>
            <button
              type="button"
              role="switch"
              class="ui-switch"
              aria-label="包含圖表"
              :aria-checked="!!options.includeCharts"
              @click="updateOption('includeCharts', !options.includeCharts)"
            />
          </div>
          <div class="switch-row">
            <div>
              <div class="sw-title">
                包含摘要
              </div>
              <div class="sw-sub">
                報表開頭列出重點數字
              </div>
            </div>
            <button
              type="button"
              role="switch"
              class="ui-switch"
              aria-label="包含摘要"
              :aria-checked="!!options.includeSummary"
              @click="updateOption('includeSummary', !options.includeSummary)"
            />
          </div>
          <div class="switch-row">
            <div>
              <div class="sw-title">
                包含詳細資料
              </div>
              <div class="sw-sub">
                附上逐筆明細，檔案會較大
              </div>
            </div>
            <button
              type="button"
              role="switch"
              class="ui-switch"
              aria-label="包含詳細資料"
              :aria-checked="!!options.includeDetails"
              @click="updateOption('includeDetails', !options.includeDetails)"
            />
          </div>
        </div>

        <div class="adv-grid">
          <div
            v-if="options.includeCharts"
            class="ui-field"
          >
            <label for="chartType">圖表類型</label>
            <select
              id="chartType"
              :value="options.chartType"
              class="ui-select"
              @change="updateOption('chartType', ($event.target as HTMLSelectElement).value)"
            >
              <option value="line">
                折線圖
              </option>
              <option value="bar">
                長條圖
              </option>
              <option value="pie">
                圓餅圖
              </option>
              <option value="donut">
                甜甜圈圖
              </option>
              <option value="area">
                面積圖
              </option>
            </select>
          </div>
          <div class="ui-field">
            <label for="maxRecords">最大記錄數（上限 50,000）</label>
            <input
              id="maxRecords"
              :value="options.maxRecords ? options.maxRecords.toLocaleString('en-US') : ''"
              type="text"
              inputmode="numeric"
              class="ui-input"
              placeholder="例如 1,000"
              @input="onMaxRecords($event)"
            >
          </div>
          <div class="ui-field">
            <label for="language">語言</label>
            <select
              id="language"
              :value="options.language"
              class="ui-select"
              @change="updateOption('language', ($event.target as HTMLSelectElement).value)"
            >
              <option value="zh-TW">
                繁體中文
              </option>
              <option value="en-US">
                English
              </option>
            </select>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ReportsAPI from '@/api/reports';
import ReportChoiceGroup from './ReportChoiceGroup.vue';
import type {
  ReportFormat,
  ReportTimeRange,
  ReportOptions
} from '@/types/reports';

interface Props {
  title: string;
  description: string;
  format: ReportFormat;
  timeRange: ReportTimeRange | '';
  startDate: string;
  endDate: string;
  options: ReportOptions;
  errors: Record<string, string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:title': [value: string];
  'update:description': [value: string];
  'update:format': [value: ReportFormat];
  'update:timeRange': [value: ReportTimeRange | ''];
  'update:startDate': [value: string];
  'update:endDate': [value: string];
  'update:options': [value: ReportOptions];
}>();

const today = computed(() => {
  return new Date().toISOString().split('T')[0];
});

const FORMAT_HINTS: Record<string, string> = {
  json: '完整結構，適合串接其他系統',
  csv: '可直接用 Excel 開啟'
};

const formatOptions = computed(() =>
  (ReportsAPI.getAvailableFormats() || []).map(fmt => ({
    value: fmt.value,
    label: fmt.label,
    description: FORMAT_HINTS[fmt.value]
  }))
);

const timeRangeOptions = computed(() => {
  return ReportsAPI.getTimeRangeOptions() || [];
});

// The five ranges people use most sit in the segmented control; the rest hide behind 更多
const COMMON_RANGES = ['last_24_hours', 'last_7_days', 'last_30_days', 'last_90_days', 'current_month'];
const commonRanges = computed(() => timeRangeOptions.value.filter(o => COMMON_RANGES.includes(o.value)));
const otherRanges = computed(() => timeRangeOptions.value.filter(o => !COMMON_RANGES.includes(o.value)));
const moreOpen = ref(false);
const advancedOpen = ref(false);
// Steps 2 and 3 read as done once the report has a title (the format always has a value)
const stepTwoDone = computed(() => props.title.trim().length > 0);
const advancedSummary = computed(() => {
  const o = props.options;
  const parts = [o.includeCharts && '圖表', o.includeSummary && '摘要', o.includeDetails && '明細'].filter(Boolean);
  const limit = o.maxRecords ? `上限 ${o.maxRecords.toLocaleString('en-US')}` : '';
  return [parts.join('、') || '僅基本資料', limit].filter(Boolean).join(' · ');
});
const moreRangeActive = computed(() => !!props.timeRange && !COMMON_RANGES.includes(props.timeRange));
const moreRangeLabel = computed(() => otherRanges.value.find(o => o.value === props.timeRange)?.label ?? '更多');
const pickRange = (value: string) => {
  moreOpen.value = false;
  emit('update:timeRange', value as ReportTimeRange);
};

const MAX_RECORDS = 50000;

// Digits only, shown with thousands separators (10,000); clamped to the backend cap
const onMaxRecords = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const digits = input.value.replace(/\D/g, '');
  const value = digits ? Math.min(Number(digits), MAX_RECORDS) : 0;
  updateOption('maxRecords', value || undefined);
  input.value = value ? value.toLocaleString('en-US') : '';
};

const updateOption = (key: string, value: unknown) => {
  emit('update:options', {
    ...props.options,
    [key]: value
  });
};
</script>

<style scoped>
.range-seg {
  display: flex;
  flex-wrap: wrap;
  width: fit-content;
  max-width: 100%;
}

.more-ranges {
  margin-top: 10px;
}

@media (max-width: 768px) {
  .range-seg {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }

  .range-seg > button {
    justify-content: center;
    padding: 0 6px;
  }
}

.parameter-form {
  display: grid;
  gap: 16px;
}

.step-n {
  display: grid;
  flex: none;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 700;
  color: var(--ui-muted);
}

.step-n.done {
  background: var(--ui-accent);
  font-size: 0;
  color: #fff;
}

.step-n.done::after {
  font-size: 13px;
  content: '\2713';
}

.step-body {
  display: grid;
  gap: 16px;
  padding: 4px 22px 22px;
}

.req {
  color: var(--ui-red);
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-separator {
  font-size: 13px;
  color: var(--ui-muted);
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: var(--ui-red-ink);
}

.error-message.pad {
  padding: 0 22px 16px;
}

.ui-input.error,
.ui-select.error {
  box-shadow: inset 0 0 0 1px var(--ui-red);
}

.format-options {
  padding: 4px 22px 20px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.field-hint {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.adv-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border: 0;
  border-radius: inherit;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.adv-toggle:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.adv-text {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.adv-text .ui-card-title {
  font: 600 17px / 1.25 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.adv-text .ui-card-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.adv-tag {
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ui-fill);
  font: 500 12px var(--ui-font-ui);
  color: var(--ui-muted);
  vertical-align: 2px;
}

.adv-more {
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-accent);
}

.adv-chev {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--ui-muted);
  transition: transform var(--ui-dur) var(--ui-ease);
}

.adv-chev.open {
  transform: rotate(180deg);
}

.switch-list {
  padding: 0 22px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  box-shadow: 0 0.5px 0 var(--ui-sep);
}

.switch-row:last-child {
  box-shadow: none;
}

.sw-title {
  font-size: 14px;
  font-weight: 600;
}

.sw-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.adv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 8px 22px 22px;
}

@media (max-width: 768px) {
  .adv-toggle {
    padding: 16px;
  }

  .step-body,
  .adv-grid {
    padding-right: 16px;
    padding-left: 16px;
  }

  .adv-grid {
    grid-template-columns: 1fr;
  }

  .switch-list {
    padding: 0 16px;
  }

  .format-options {
    padding-right: 16px;
    padding-left: 16px;
  }
}

/* placeholder text must read at AA on the grey field fill */
.ui-input::placeholder,
.ui-textarea::placeholder {
  color: var(--ui-muted);
}
</style>
