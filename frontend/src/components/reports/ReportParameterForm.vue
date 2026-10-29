<template>
  <div class="parameter-form">
    <section class="ui-card step-card">
      <div class="ui-card-head">
        <span class="step-n">2</span>
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

        <div class="range-row">
          <div class="ui-field">
            <label for="timeRange">時間範圍 <span class="req">*</span></label>
            <select
              id="timeRange"
              :value="timeRange"
              class="ui-select"
              :class="{ error: errors.timeRange }"
              @change="emit('update:timeRange', ($event.target as HTMLSelectElement).value as ReportTimeRange | '')"
            >
              <option value="">
                請選擇時間範圍
              </option>
              <option
                v-for="range in timeRangeOptions"
                :key="range.value"
                :value="range.value"
              >
                {{ range.label }}
              </option>
            </select>
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
      </div>
    </section>

    <section class="ui-card step-card">
      <div class="ui-card-head">
        <span class="step-n">3</span>
        <div>
          <h3 class="ui-card-title">
            輸出格式
          </h3>
          <p class="ui-card-sub">
            依用途選擇
          </p>
        </div>
      </div>
      <div
        class="format-options"
        role="radiogroup"
        aria-label="輸出格式"
      >
        <button
          v-for="fmt in availableFormats"
          :key="fmt.value"
          type="button"
          role="radio"
          class="format-option"
          :class="{ selected: format === fmt.value }"
          :aria-checked="format === fmt.value"
          @click="$emit('update:format', fmt.value)"
        >
          {{ fmt.label }}
        </button>
      </div>
      <p
        v-if="errors.format"
        class="error-message pad"
      >
        {{ errors.format }}
      </p>
    </section>

    <section class="ui-card step-card">
      <div class="ui-card-head">
        <span class="step-n">4</span>
        <div>
          <h3 class="ui-card-title">
            進階選項
          </h3>
          <p class="ui-card-sub">
            預設值已適合大多數報表
          </p>
        </div>
      </div>
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
          <label for="maxRecords">最大記錄數</label>
          <input
            id="maxRecords"
            :value="options.maxRecords"
            type="number"
            class="ui-input"
            placeholder="例如 1000"
            min="1"
            max="50000"
            @input="updateOption('maxRecords', Number(($event.target as HTMLInputElement).value))"
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
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
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

const availableFormats = computed(() => {
  return ReportsAPI.getAvailableFormats() || [];
});

const timeRangeOptions = computed(() => {
  return ReportsAPI.getTimeRangeOptions() || [];
});

const updateOption = (key: string, value: unknown) => {
  emit('update:options', {
    ...props.options,
    [key]: value
  });
};
</script>

<style scoped>
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
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ui-muted);
}

.step-body {
  display: grid;
  gap: 16px;
  padding: 4px 22px 22px;
}

.req {
  color: var(--ui-red);
}

.range-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-separator {
  font-size: 12.5px;
  color: var(--ui-muted);
}

.error-message {
  margin: 0;
  font-size: 12.5px;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 4px 22px 20px;
}

.format-option {
  padding: 16px 12px;
  border: 0;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  box-shadow: inset 0 0 0 0.5px var(--ui-sep);
  color: inherit;
  font: 600 14px var(--ui-font-display);
  cursor: pointer;
  transition:
    background var(--ui-dur) var(--ui-ease),
    box-shadow var(--ui-dur) var(--ui-ease);
}

.format-option.selected {
  background: color-mix(in srgb, var(--ui-accent-soft) 60%, var(--ui-surface));
  box-shadow: var(--ui-sel-ring);
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
  font-size: 12.5px;
  color: var(--ui-muted);
}

.adv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 8px 22px 22px;
}

@media (max-width: 768px) {
  .step-body,
  .adv-grid {
    padding-right: 16px;
    padding-left: 16px;
  }

  .range-row,
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
</style>
