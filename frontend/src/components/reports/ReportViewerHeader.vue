<template>
  <div class="report-header">
    <div class="header-info">
      <div
        class="report-type-badge"
        :class="getTypeBadgeClass(report.type)"
      >
        {{ getReportTypeIcon(report.type) }} {{ getReportTypeLabel(report.type) }}
      </div>
      <h1 class="report-title">
        {{ report.title }}
      </h1>
      <p
        v-if="report.description"
        class="report-description"
      >
        {{ report.description }}
      </p>
      <div class="report-meta">
        <div class="meta-item">
          <span class="meta-label">&#x72C0;&#x614B;&#xFF1A;</span>
          <span
            class="status-badge"
            :class="getStatusClass(report.status)"
          >
            {{ getStatusIcon(report.status) }} {{ getStatusLabel(report.status) }}
          </span>
        </div>
        <div class="meta-item">
          <span class="meta-label">&#x683C;&#x5F0F;&#xFF1A;</span>
          <span class="format-badge">
            {{ getFormatIcon(report.format) }} {{ getFormatLabel(report.format) }}
          </span>
        </div>
        <div class="meta-item">
          <span class="meta-label">&#x5EFA;&#x7ACB;&#x6642;&#x9593;&#xFF1A;</span>
          <span class="time-text">{{ formatDateTime(report.createdAt) }}</span>
        </div>
        <div
          v-if="report.completedAt"
          class="meta-item"
        >
          <span class="meta-label">&#x5B8C;&#x6210;&#x6642;&#x9593;&#xFF1A;</span>
          <span class="time-text">{{ formatDateTime(report.completedAt) }}</span>
        </div>
        <div
          v-if="report.fileSize"
          class="meta-item"
        >
          <span class="meta-label">&#x6A94;&#x6848;&#x5927;&#x5C0F;&#xFF1A;</span>
          <span class="size-text">{{ formatFileSize(report.fileSize) }}</span>
        </div>
      </div>
    </div>

    <div class="header-actions">
      <!-- 主要動作按鈕 -->
      <div class="primary-actions">
        <button
          v-if="canDownload"
          class="btn btn-primary"
          :disabled="downloading"
          @click="$emit('download')"
        >
          <span v-if="downloading">&#x23F3; &#x4E0B;&#x8F09;&#x4E2D;...</span>
          <span v-else>&#x1F4E5; &#x4E0B;&#x8F09;&#x5831;&#x8868;</span>
        </button>

        <button
          v-if="canRegenerate"
          class="btn btn-secondary"
          :disabled="regenerating"
          @click="$emit('regenerate')"
        >
          <span v-if="regenerating">&#x2699;&#xFE0F; &#x91CD;&#x65B0;&#x751F;&#x6210;&#x4E2D;...</span>
          <span v-else>&#x1F504; &#x91CD;&#x65B0;&#x751F;&#x6210;</span>
        </button>
      </div>

      <!-- 次要動作選單 -->
      <div class="secondary-actions">
        <div
          class="action-dropdown"
          :class="{ 'open': showActionMenu }"
        >
          <button
            class="dropdown-toggle"
            @click="$emit('toggle-menu')"
          >
            &#x22EF;
          </button>
          <div class="dropdown-menu">
            <button
              class="dropdown-item"
              :disabled="!canShare"
              @click="$emit('share')"
            >
              &#x1F517; &#x5206;&#x4EAB;&#x9023;&#x7D50;
            </button>
            <button
              class="dropdown-item"
              :disabled="!canExport"
              @click="$emit('export')"
            >
              &#x1F4E4; &#x532F;&#x51FA;&#x5176;&#x4ED6;&#x683C;&#x5F0F;
            </button>
            <button
              class="dropdown-item"
              :disabled="!canSchedule"
              @click="$emit('schedule')"
            >
              &#x23F0; &#x5EFA;&#x7ACB;&#x6392;&#x7A0B;
            </button>
            <div class="dropdown-divider" />
            <button
              class="dropdown-item danger"
              :disabled="!canDelete"
              @click="$emit('delete')"
            >
              &#x1F5D1;&#xFE0F; &#x522A;&#x9664;&#x5831;&#x8868;
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportDetails } from '@/types/reports';
import {
  getReportTypeIcon,
  getReportTypeLabel,
  getTypeBadgeClass,
  getStatusIcon,
  getStatusLabel,
  getStatusClass,
  getFormatIcon,
  getFormatLabel,
  formatDateTime,
  formatFileSize,
} from './reportViewerUtils';

interface Props {
  report: ReportDetails;
  downloading: boolean;
  regenerating: boolean;
  showActionMenu: boolean;
  canDownload: boolean;
  canRegenerate: boolean;
  canShare: boolean;
  canExport: boolean;
  canSchedule: boolean;
  canDelete: boolean;
}

defineProps<Props>();

defineEmits<{
  'download': [];
  'regenerate': [];
  'toggle-menu': [];
  'share': [];
  'export': [];
  'schedule': [];
  'delete': [];
}>();
</script>

<style scoped>
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.header-info {
  flex: 1;
}

.report-type-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.report-type-badge.basic {
  background: #dbeafe;
  color: #1e40af;
}

.report-type-badge.enterprise {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.report-type-badge.business-intelligence {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
}

.report-type-badge.advanced {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.report-title {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.report-description {
  color: #6b7280;
  font-size: 1.1rem;
  margin: 0 0 1.5rem 0;
}

.report-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-label {
  font-weight: 500;
  color: #6b7280;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.generating {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.completed {
  background: #dcfce7;
  color: #166534;
}

.status-badge.failed {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.expired {
  background: #f3f4f6;
  color: #374151;
}

.format-badge {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
}

.time-text,
.size-text {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
  font-size: 0.9rem;
  color: #374151;
}

.header-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
}

.primary-actions {
  display: flex;
  gap: 1rem;
}

.secondary-actions {
  position: relative;
}

.action-dropdown {
  position: relative;
}

.dropdown-toggle {
  width: 40px;
  height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 1.2rem;
  color: #6b7280;
  transition: all 0.2s;
}

.dropdown-toggle:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 100;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.2s;
}

.action-dropdown.open .dropdown-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  border: none;
  background: none;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
}

.dropdown-item:hover:not(:disabled) {
  background: #f9fafb;
}

.dropdown-item:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.dropdown-item.danger {
  color: #dc2626;
}

.dropdown-item.danger:hover:not(:disabled) {
  background: #fef2f2;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.5rem 0;
}

@media (max-width: 768px) {
  .report-header {
    flex-direction: column;
    gap: 1.5rem;
  }

  .header-actions {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
  }

  .report-meta {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
