<template>
  <div class="completed-report">
    <!-- JSON 格式預覽 -->
    <div
      v-if="report.format === 'json' && reportData"
      class="json-preview"
    >
      <div class="preview-header">
        <h3 class="preview-title">
          &#x1F4CA; &#x8CC7;&#x6599;&#x9810;&#x89BD;
        </h3>
        <div class="preview-actions">
          <button
            class="view-toggle"
            :class="{ 'active': viewMode === 'formatted' }"
            @click="$emit('update:viewMode', 'formatted')"
          >
            &#x1F3A8; &#x683C;&#x5F0F;&#x5316;&#x6AA2;&#x8996;
          </button>
          <button
            class="view-toggle"
            :class="{ 'active': viewMode === 'raw' }"
            @click="$emit('update:viewMode', 'raw')"
          >
            &#x1F4DD; &#x539F;&#x59CB;&#x8CC7;&#x6599;
          </button>
        </div>
      </div>

      <!-- 格式化檢視 -->
      <div
        v-if="viewMode === 'formatted'"
        class="formatted-view"
      >
        <component
          :is="getDataVisualizationComponent()"
          :data="reportData"
          :options="report.metadata?.options"
        />
      </div>

      <!-- 原始資料檢視 -->
      <div
        v-else
        class="raw-view"
      >
        <pre class="json-data">{{ JSON.stringify(reportData, null, 2) }}</pre>
      </div>
    </div>

    <!-- HTML 格式預覽 -->
    <div
      v-else-if="report.format === 'html'"
      class="html-preview"
    >
      <div class="preview-header">
        <h3 class="preview-title">
          &#x1F310; HTML &#x9810;&#x89BD;
        </h3>
      </div>
      <div class="html-content">
        <iframe
          :src="report.downloadUrl"
          class="html-frame"
          sandbox="allow-same-origin"
        />
      </div>
    </div>

    <!-- 其他格式 - 顯示下載選項 -->
    <div
      v-else
      class="download-preview"
    >
      <div class="download-card">
        <div class="download-icon">
          {{ getFormatIcon(report.format) }}
        </div>
        <div class="download-info">
          <h3 class="download-title">
            {{ getFormatLabel(report.format) }} &#x5831;&#x8868;&#x5DF2;&#x6E96;&#x5099;&#x5C31;&#x7DD2;
          </h3>
          <p class="download-description">
            &#x9EDE;&#x64CA;&#x4E0B;&#x65B9;&#x6309;&#x9215;&#x4E0B;&#x8F09;&#x60A8;&#x7684;&#x5831;&#x8868;&#x6A94;&#x6848;
          </p>
          <div class="download-meta">
            <span class="file-size">&#x6A94;&#x6848;&#x5927;&#x5C0F;&#xFF1A;{{ formatFileSize(report.fileSize || 0) }}</span>
            <span class="file-type">&#x683C;&#x5F0F;&#xFF1A;{{ report.format.toUpperCase() }}</span>
          </div>
        </div>
        <div class="download-actions">
          <button
            class="btn btn-primary large"
            :disabled="downloading"
            @click="$emit('download')"
          >
            <span v-if="downloading">&#x23F3; &#x4E0B;&#x8F09;&#x4E2D;...</span>
            <span v-else>&#x1F4E5; &#x7ACB;&#x5373;&#x4E0B;&#x8F09;</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 生成記錄 -->
    <div
      v-if="report.generationLog && report.generationLog.length > 0"
      class="generation-log"
    >
      <details>
        <summary class="log-toggle">
          &#x1F4DD; &#x67E5;&#x770B;&#x751F;&#x6210;&#x8A18;&#x9304;
        </summary>
        <div class="log-content">
          <div
            v-for="(log, index) in report.generationLog"
            :key="index"
            class="log-entry"
          >
            {{ log }}
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportDetails } from '@/types/reports';
import {
  getFormatIcon,
  getFormatLabel,
  formatFileSize,
} from './reportViewerUtils';

interface Props {
  report: ReportDetails;
  reportData: Record<string, unknown> | null;
  viewMode: 'formatted' | 'raw';
  downloading: boolean;
}

defineProps<Props>();

defineEmits<{
  'download': [];
  'update:viewMode': [mode: 'formatted' | 'raw'];
}>();

const getDataVisualizationComponent = (): string => {
  return 'ReportDataVisualization';
};
</script>

<style scoped>
.completed-report {
  margin-bottom: 2rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.preview-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.view-toggle {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.view-toggle:hover {
  background: #f9fafb;
}

.view-toggle.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.formatted-view {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  min-height: 400px;
}

.raw-view {
  background: #1f2937;
  border-radius: 8px;
  overflow: hidden;
}

.json-data {
  color: #e5e7eb;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  padding: 1.5rem;
  margin: 0;
  overflow-x: auto;
  white-space: pre;
  max-height: 600px;
  overflow-y: auto;
}

.html-content {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.html-frame {
  width: 100%;
  height: 600px;
  border: none;
}

.download-preview {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.download-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  padding: 3rem 2rem;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #f9fafb;
}

.download-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.7;
}

.download-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.download-description {
  color: #6b7280;
  margin-bottom: 1.5rem;
}

.download-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
  color: #6b7280;
  font-size: 0.9rem;
}

.download-actions .btn.large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

.generation-log {
  margin-top: 2rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 2rem;
}

.log-toggle {
  cursor: pointer;
  font-weight: 500;
  color: #6b7280;
}

.log-content {
  margin-top: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  color: #374151;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.log-entry:last-child {
  border-bottom: none;
}

</style>
