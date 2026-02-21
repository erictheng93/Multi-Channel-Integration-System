<template>
  <div class="parameter-form">
    <!-- 基本資訊：標題 -->
    <div class="form-group">
      <label
        for="title"
        class="form-label required"
      >報表標題</label>
      <input
        id="title"
        :value="title"
        type="text"
        class="form-input"
        placeholder="輸入報表標題"
        :class="{ 'error': errors.title }"
        @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
      >
      <div
        v-if="errors.title"
        class="error-message"
      >
        {{ errors.title }}
      </div>
    </div>

    <!-- 基本資訊：描述 -->
    <div class="form-group">
      <label
        for="description"
        class="form-label"
      >報表描述</label>
      <textarea
        id="description"
        :value="description"
        class="form-textarea"
        placeholder="輸入報表描述（可選）"
        rows="3"
        @input="$emit('update:description', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- 格式選擇 -->
    <div class="form-group">
      <label class="form-label required">輸出格式</label>
      <div class="format-options">
        <div
          v-for="fmt in availableFormats"
          :key="fmt.value"
          class="format-option"
          :class="{ 'selected': format === fmt.value }"
          @click="$emit('update:format', fmt.value)"
        >
          <div class="format-icon">
            {{ fmt.icon }}
          </div>
          <div class="format-label">
            {{ fmt.label }}
          </div>
        </div>
      </div>
      <div
        v-if="errors.format"
        class="error-message"
      >
        {{ errors.format }}
      </div>
    </div>

    <!-- 時間範圍 -->
    <div class="form-group">
      <label class="form-label required">時間範圍</label>
      <select
        :value="timeRange"
        class="form-select"
        :class="{ 'error': errors.timeRange }"
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
      <div
        v-if="errors.timeRange"
        class="error-message"
      >
        {{ errors.timeRange }}
      </div>
    </div>

    <!-- 自定義日期範圍 -->
    <div
      v-if="timeRange === 'custom'"
      class="form-group"
    >
      <label class="form-label">自定義日期範圍</label>
      <div class="date-range">
        <div class="date-input">
          <label
            for="startDate"
            class="date-label"
          >開始日期</label>
          <input
            id="startDate"
            :value="startDate"
            type="date"
            class="form-input"
            :max="endDate || today"
            @input="$emit('update:startDate', ($event.target as HTMLInputElement).value)"
          >
        </div>
        <div class="date-separator">
          至
        </div>
        <div class="date-input">
          <label
            for="endDate"
            class="date-label"
          >結束日期</label>
          <input
            id="endDate"
            :value="endDate"
            type="date"
            class="form-input"
            :min="startDate"
            :max="today"
            @input="$emit('update:endDate', ($event.target as HTMLInputElement).value)"
          >
        </div>
      </div>
    </div>

    <!-- 進階選項 -->
    <div class="form-group">
      <details class="advanced-options">
        <summary class="options-toggle">
          進階選項
        </summary>
        <div class="options-content">
          <!-- 圖表選項 -->
          <div class="option-row">
            <label class="checkbox-label">
              <input
                :checked="options.includeCharts"
                type="checkbox"
                class="checkbox"
                @change="updateOption('includeCharts', ($event.target as HTMLInputElement).checked)"
              >
              <span class="checkmark" />
              包含圖表
            </label>
          </div>

          <div class="option-row">
            <label class="checkbox-label">
              <input
                :checked="options.includeSummary"
                type="checkbox"
                class="checkbox"
                @change="updateOption('includeSummary', ($event.target as HTMLInputElement).checked)"
              >
              <span class="checkmark" />
              包含摘要
            </label>
          </div>

          <div class="option-row">
            <label class="checkbox-label">
              <input
                :checked="options.includeDetails"
                type="checkbox"
                class="checkbox"
                @change="updateOption('includeDetails', ($event.target as HTMLInputElement).checked)"
              >
              <span class="checkmark" />
              包含詳細資料
            </label>
          </div>

          <!-- 圖表類型 -->
          <div
            v-if="options.includeCharts"
            class="option-row"
          >
            <label
              for="chartType"
              class="option-label"
            >圖表類型</label>
            <select
              id="chartType"
              :value="options.chartType"
              class="form-select small"
              @change="updateOption('chartType', ($event.target as HTMLSelectElement).value)"
            >
              <option value="line">
                線圖
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

          <!-- 記錄限制 -->
          <div class="option-row">
            <label
              for="maxRecords"
              class="option-label"
            >最大記錄數</label>
            <input
              id="maxRecords"
              :value="options.maxRecords"
              type="number"
              class="form-input small"
              placeholder="例如: 1000"
              min="1"
              max="50000"
              @input="updateOption('maxRecords', Number(($event.target as HTMLInputElement).value))"
            >
          </div>

          <!-- 語言選擇 -->
          <div class="option-row">
            <label
              for="language"
              class="option-label"
            >語言</label>
            <select
              id="language"
              :value="options.language"
              class="form-select small"
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
      </details>
    </div>
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
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.format-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
}

.format-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-option:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.format-option.selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.format-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.format-label {
  font-weight: 500;
  text-align: center;
}

.advanced-options {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
}

.options-toggle {
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  list-style: none;
}

.options-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox {
  margin-right: 0.5rem;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.date-input {
  flex: 1;
}

.date-label {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.date-separator {
  font-weight: 500;
  color: #6b7280;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.error,
.form-select.error {
  border-color: #ef4444;
}

.form-input.small,
.form-select.small {
  width: auto;
  min-width: 120px;
}

.error-message {
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

@media (max-width: 1024px) {
  .format-options {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .date-range {
    flex-direction: column;
    align-items: stretch;
  }

  .date-separator {
    text-align: center;
    padding: 0.5rem 0;
  }
}
</style>
