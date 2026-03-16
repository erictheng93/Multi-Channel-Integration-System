<!-- 選中模板詳情面板 -->
<!-- Panel showing details and actions for the selected template -->

<template>
  <div class="selected-template-details">
    <div class="details-header">
      <h2>模板詳情</h2>
      <button
        class="close-details"
        @click="$emit('close')"
      />
    </div>

    <div class="details-content">
      <div class="template-summary">
        <div class="summary-icon">
          {{ template.icon }}
        </div>
        <div class="summary-info">
          <h3>{{ template.name }}</h3>
          <p>{{ template.description }}</p>
          <div class="summary-meta">
            <span class="meta-item">
              類別：{{ getCategoryLabel(template.category) }}
            </span>
            <span class="meta-item">
              預估時間：{{ formatEstimatedTime(template.estimatedTime) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 預設選項預覽 -->
      <div class="preset-options">
        <h4>預設選項</h4>
        <div class="options-grid">
          <div class="option-item">
            <strong>包含圖表：</strong>
            <span>{{ template.presetOptions.includeCharts ? '是' : '否' }}</span>
          </div>
          <div class="option-item">
            <strong>包含摘要：</strong>
            <span>{{ template.presetOptions.includeSummary ? '是' : '否' }}</span>
          </div>
          <div class="option-item">
            <strong>包含詳細資料：</strong>
            <span>{{ template.presetOptions.includeDetails ? '是' : '否' }}</span>
          </div>
          <div
            v-if="template.presetOptions.chartType"
            class="option-item"
          >
            <strong>圖表類型：</strong>
            <span>{{ getChartTypeLabel(template.presetOptions.chartType) }}</span>
          </div>
          <div
            v-if="template.presetOptions.maxRecords"
            class="option-item"
          >
            <strong>最大記錄數：</strong>
            <span>{{ template.presetOptions.maxRecords.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- 動作按鈕 -->
      <div class="template-actions">
        <button
          class="use-template-btn primary"
          :disabled="generating"
          @click="$emit('use', template)"
        >
          <span v-if="!generating">使用此模板</span>
          <span v-else>
            <div class="button-spinner" />
            生成中...
          </span>
        </button>

        <button
          class="customize-template-btn secondary"
          @click="$emit('customize', template)"
        >
          自定義設定
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportTemplate } from '@/types/reports';
import {
  getCategoryLabel,
  getChartTypeLabel,
  formatEstimatedTime
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
.selected-template-details {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 2px solid #007bff;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f4f8;
}

.details-header h2 {
  color: #1a1a1a;
  font-size: 1.5rem;
  margin: 0;
}

.close-details {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-details:hover {
  background: #f0f4f8;
}

.template-summary {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9ff;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.summary-icon {
  font-size: 3rem;
}

.summary-info h3 {
  font-size: 1.4rem;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.summary-info p {
  color: #666;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.summary-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #333;
  border: 1px solid #e1e5e9;
}

.preset-options h4 {
  color: #1a1a1a;
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.option-item {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  border-left: 3px solid #007bff;
}

.option-item strong {
  display: block;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.option-item span {
  color: #007bff;
  font-weight: 500;
}

.template-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.use-template-btn,
.customize-template-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  min-width: 150px;
  justify-content: center;
}

.use-template-btn.primary {
  background: #007bff;
  color: white;
}

.use-template-btn.primary:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.use-template-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.customize-template-btn.secondary {
  background: white;
  color: #007bff;
  border: 2px solid #007bff;
}

.customize-template-btn.secondary:hover {
  background: #007bff;
  color: white;
  transform: translateY(-1px);
}

.button-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 0.5rem 0 0;
  display: inline-block;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .template-summary {
    flex-direction: column;
    text-align: center;
  }

  .template-actions {
    flex-direction: column;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }

  .summary-meta {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .selected-template-details {
    padding: 1rem;
  }
}
</style>
