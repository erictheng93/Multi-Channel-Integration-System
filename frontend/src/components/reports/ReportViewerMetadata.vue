<template>
  <div
    v-if="report.metadata"
    class="report-metadata"
  >
    <div class="metadata-header">
      <h3 class="metadata-title">
        &#x1F4C8; &#x7D71;&#x8A08;&#x8CC7;&#x8A0A;
      </h3>
    </div>
    <div class="metadata-grid">
      <div
        v-if="report.executionTime"
        class="metadata-item"
      >
        <span class="metadata-label">&#x57F7;&#x884C;&#x6642;&#x9593;&#xFF1A;</span>
        <span class="metadata-value">{{ formatTime(report.executionTime) }}</span>
      </div>
      <div
        v-if="report.metadata.recordCount"
        class="metadata-item"
      >
        <span class="metadata-label">&#x8A18;&#x9304;&#x6578;&#x91CF;&#xFF1A;</span>
        <span class="metadata-value">{{ (report.metadata.recordCount as number).toLocaleString() }}</span>
      </div>
      <div
        v-if="report.metadata.generatedBy"
        class="metadata-item"
      >
        <span class="metadata-label">&#x751F;&#x6210;&#x8005;&#xFF1A;</span>
        <span class="metadata-value">{{ report.metadata.generatedBy }}</span>
      </div>
      <div
        v-if="report.metadata.version"
        class="metadata-item"
      >
        <span class="metadata-label">&#x7248;&#x672C;&#xFF1A;</span>
        <span class="metadata-value">{{ report.metadata.version }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportDetails } from '@/types/reports';
import { formatTime } from './reportViewerUtils';

interface Props {
  report: ReportDetails;
}

defineProps<Props>();
</script>

<style scoped>
.report-metadata {
  margin-top: 2rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 2rem;
}

.metadata-header {
  margin-bottom: 1rem;
}

.metadata-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.metadata-label {
  font-weight: 500;
  color: #6b7280;
}

.metadata-value {
  font-weight: 600;
  color: #1f2937;
}

@media (max-width: 768px) {
  .metadata-grid {
    grid-template-columns: 1fr;
  }
}
</style>
