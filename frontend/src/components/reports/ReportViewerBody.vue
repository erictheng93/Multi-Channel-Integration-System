<template>
  <div class="report-body">
    <!-- 生成中狀態 -->
    <div
      v-if="report.status === 'generating'"
      class="generating-status"
    >
      <div class="progress-section">
        <div class="progress-icon">
          &#x2699;&#xFE0F;
        </div>
        <div class="progress-info">
          <h3 class="progress-title">
            &#x5831;&#x8868;&#x751F;&#x6210;&#x4E2D;
          </h3>
          <p class="progress-description">
            &#x6B63;&#x5728;&#x8655;&#x7406;&#x60A8;&#x7684;&#x8CC7;&#x6599;&#xFF0C;&#x8ACB;&#x7A0D;&#x5019;...
          </p>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <div class="progress-text">
            {{ progress }}% &#x5B8C;&#x6210;
          </div>
        </div>
      </div>
      <div
        v-if="estimatedTimeRemaining"
        class="estimated-time"
      >
        &#x9810;&#x4F30;&#x5269;&#x9918;&#x6642;&#x9593;&#xFF1A;{{ formatTime(estimatedTimeRemaining) }}
      </div>
    </div>

    <!-- 失敗狀態 -->
    <div
      v-else-if="report.status === 'failed'"
      class="failed-status"
    >
      <div class="failure-section">
        <div class="failure-icon">
          &#x274C;
        </div>
        <div class="failure-info">
          <h3 class="failure-title">
            &#x5831;&#x8868;&#x751F;&#x6210;&#x5931;&#x6557;
          </h3>
          <p class="failure-description">
            &#x5F88;&#x62B1;&#x6B49;&#xFF0C;&#x5831;&#x8868;&#x751F;&#x6210;&#x904E;&#x7A0B;&#x4E2D;&#x767C;&#x751F;&#x932F;&#x8AA4;
          </p>
          <div
            v-if="report.errorMessage"
            class="error-details"
          >
            <details>
              <summary>&#x932F;&#x8AA4;&#x8A73;&#x60C5;</summary>
              <pre class="error-message">{{ report.errorMessage }}</pre>
            </details>
          </div>
          <div class="failure-actions">
            <button
              class="btn btn-primary"
              @click="$emit('regenerate')"
            >
              &#x1F504; &#x91CD;&#x65B0;&#x751F;&#x6210;
            </button>
            <button
              class="btn btn-secondary"
              @click="$emit('back')"
            >
              &#x2190; &#x8FD4;&#x56DE;
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 已完成 - 顯示報表內容 -->
    <ReportViewerContent
      v-else-if="report.status === 'completed'"
      :report="report"
      :report-data="reportData"
      :view-mode="viewMode"
      :downloading="downloading"
      @update:view-mode="$emit('update:viewMode', $event)"
      @download="$emit('download')"
    />

    <!-- 已過期狀態 -->
    <div
      v-else-if="report.status === 'expired'"
      class="expired-status"
    >
      <div class="expired-section">
        <div class="expired-icon">
          &#x23F0;
        </div>
        <div class="expired-info">
          <h3 class="expired-title">
            &#x5831;&#x8868;&#x5DF2;&#x904E;&#x671F;
          </h3>
          <p class="expired-description">
            &#x6B64;&#x5831;&#x8868;&#x5DF2;&#x8D85;&#x904E;&#x4FDD;&#x5B58;&#x671F;&#x9650;&#xFF0C;&#x8ACB;&#x91CD;&#x65B0;&#x751F;&#x6210;
          </p>
          <div class="expired-actions">
            <button
              class="btn btn-primary"
              @click="$emit('regenerate')"
            >
              &#x1F504; &#x91CD;&#x65B0;&#x751F;&#x6210;
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportDetails } from '@/types/reports';
import { formatTime } from './reportViewerUtils';
import ReportViewerContent from './ReportViewerContent.vue';

interface Props {
  report: ReportDetails;
  reportData: Record<string, unknown> | null;
  viewMode: 'formatted' | 'raw';
  progress: number;
  estimatedTimeRemaining: number | null;
  downloading: boolean;
}

defineProps<Props>();

defineEmits<{
  'regenerate': [];
  'back': [];
  'download': [];
  'update:viewMode': [mode: 'formatted' | 'raw'];
}>();
</script>

<style scoped>
.report-body {
  padding: 2rem;
}

.generating-status,
.failed-status,
.expired-status {
  text-align: center;
  padding: 3rem 2rem;
}

.progress-section,
.failure-section,
.expired-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 500px;
  margin: 0 auto;
}

.progress-icon,
.failure-icon,
.expired-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
}

.progress-icon {
  animation: spin 2s linear infinite;
}

.progress-title,
.failure-title,
.expired-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.progress-description,
.failure-description,
.expired-description {
  color: #6b7280;
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.estimated-time {
  color: #6b7280;
  font-style: italic;
}

.error-details {
  margin: 1rem 0;
  text-align: left;
  width: 100%;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
}

.error-message {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 0.5rem;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.failure-actions,
.expired-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

/* Shared button styles */
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .failure-actions,
  .expired-actions {
    flex-direction: column;
    width: 100%;
  }

  .failure-actions .btn,
  .expired-actions .btn {
    width: 100%;
  }
}
</style>
