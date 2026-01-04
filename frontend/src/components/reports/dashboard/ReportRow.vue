<template>
  <div
    class="report-row"
    @click="$emit('view-report', report.id)"
  >
    <!-- 類型徽章 -->
    <div class="row-cell type-cell">
      <div
        class="report-type-badge"
        :class="typeBadgeClass"
      >
        {{ typeIcon }}
      </div>
    </div>

    <!-- 標題和描述 -->
    <div class="row-cell title-cell">
      <h4 class="report-title">
        {{ report.title }}
      </h4>
      <p
        v-if="report.description"
        class="report-description"
      >
        {{ truncatedDescription }}
      </p>
    </div>

    <!-- 狀態 -->
    <div class="row-cell status-cell">
      <span
        class="status-badge"
        :class="statusClass"
      >
        {{ statusIcon }} {{ statusLabel }}
      </span>
    </div>

    <!-- 格式 -->
    <div class="row-cell format-cell">
      <span class="format-text">
        {{ formatIcon }} {{ formatLabel }}
      </span>
    </div>

    <!-- 建立時間 -->
    <div class="row-cell time-cell">
      <span class="time-text">{{ formattedTime }}</span>
    </div>

    <!-- 文件大小 -->
    <div class="row-cell size-cell">
      <span class="size-text">{{ formattedSize }}</span>
    </div>

    <!-- 操作按鈕 -->
    <div class="row-cell actions-cell">
      <div class="row-actions">
        <button
          class="action-btn"
          :disabled="!canDownload"
          title="下載"
          @click.stop="$emit('download-report', report)"
        >
          📥
        </button>
        <button
          class="action-btn"
          :disabled="!canDelete"
          title="刪除"
          @click.stop="$emit('delete-report', report)"
        >
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ReportRow Component
 *
 * 报表列表行组件（列表视图）
 *
 * @emits view-report - 查看报表详情
 * @emits download-report - 下载报表
 * @emits delete-report - 删除报表
 */

import { computed } from 'vue'
import type { ReportBase, ReportType, ReportStatus, ReportFormat } from '@/types/reports'

export interface ReportRowProps {
  /**
   * 报表数据
   */
  report: ReportBase

  /**
   * 获取类型徽章类别
   */
  getTypeBadgeClass: (_type: ReportType) => string

  /**
   * 获取报表类型图标
   */
  getReportTypeIcon: (_type: ReportType) => string

  /**
   * 获取状态图标
   */
  getStatusIcon: (_status: ReportStatus) => string

  /**
   * 获取状态标签
   */
  getStatusLabel: (_status: ReportStatus) => string

  /**
   * 获取状态类别
   */
  getStatusClass: (_status: ReportStatus) => string

  /**
   * 获取格式图标
   */
  getFormatIcon: (_format: ReportFormat) => string

  /**
   * 获取格式标签
   */
  getFormatLabel: (_format: ReportFormat) => string

  /**
   * 格式化时间
   */
  formatRelativeTime: (_time: string) => string

  /**
   * 格式化文件大小
   */
  formatFileSize: (_bytes: number) => string

  /**
   * 截断文本
   */
  truncateText: (_text: string, _length: number) => string
}

const props = defineProps<ReportRowProps>()

defineEmits<{
  'view-report': [reportId: string]
  'download-report': [report: ReportBase]
  'delete-report': [report: ReportBase]
}>()

const typeBadgeClass = computed(() => props.getTypeBadgeClass(props.report.type))
const typeIcon = computed(() => props.getReportTypeIcon(props.report.type))
const statusIcon = computed(() => props.getStatusIcon(props.report.status))
const statusLabel = computed(() => props.getStatusLabel(props.report.status))
const statusClass = computed(() => props.getStatusClass(props.report.status))
const formatIcon = computed(() => props.getFormatIcon(props.report.format))
const formatLabel = computed(() => props.getFormatLabel(props.report.format))
const formattedTime = computed(() => props.formatRelativeTime(props.report.createdAt))
const formattedSize = computed(() => props.report.fileSize ? props.formatFileSize(props.report.fileSize) : '-')
const truncatedDescription = computed(() => {
  return props.report.description ? props.truncateText(props.report.description, 60) : ''
})

const canDownload = computed(() => {
  return props.report.status === 'completed' && !!props.report.downloadUrl
})

const canDelete = computed(() => {
  return !['generating'].includes(props.report.status)
})
</script>

<style scoped>
.report-row {
  display: grid;
  grid-template-columns: 60px 1fr 140px 100px 140px 100px 100px;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.2s;
  cursor: pointer;
}

.report-row:hover {
  background: #f9fafb;
}

.row-cell {
  display: flex;
  align-items: center;
}

/* Type Badge */
.type-cell {
  justify-content: center;
}

.report-type-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 1.1rem;
}

.report-type-badge.basic {
  background: #dbeafe;
}

.report-type-badge.enterprise {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.report-type-badge.business-intelligence {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.report-type-badge.advanced {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

/* Title Cell */
.title-cell {
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.report-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.report-description {
  font-size: 0.85rem;
  color: #6b7280;
  margin: 0.25rem 0 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

/* Status Cell */
.status-cell {
  justify-content: center;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
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

/* Format Cell */
.format-cell {
  justify-content: center;
}

.format-text {
  color: #374151;
  font-weight: 500;
  font-size: 0.9rem;
  white-space: nowrap;
}

/* Time Cell */
.time-cell {
  justify-content: center;
}

.time-text {
  color: #6b7280;
  font-size: 0.9rem;
  white-space: nowrap;
}

/* Size Cell */
.size-cell {
  justify-content: center;
}

.size-text {
  color: #374151;
  font-weight: 500;
  font-size: 0.9rem;
  white-space: nowrap;
}

/* Actions Cell */
.actions-cell {
  justify-content: flex-end;
}

.row-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 1200px) {
  .report-row {
    grid-template-columns: 60px 1fr 120px 90px 120px 90px 90px;
    gap: 0.75rem;
  }

  .report-title {
    font-size: 0.95rem;
  }

  .report-description {
    font-size: 0.8rem;
  }
}

@media (max-width: 768px) {
  .report-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding: 1rem;
  }

  .row-cell {
    justify-content: flex-start !important;
  }

  .type-cell {
    display: none;
  }

  .title-cell {
    order: 1;
  }

  .status-cell {
    order: 2;
  }

  .format-cell,
  .time-cell,
  .size-cell {
    display: inline-flex;
    width: auto;
  }

  .actions-cell {
    order: 6;
    justify-content: flex-start !important;
  }

  .report-title,
  .report-description {
    white-space: normal;
  }
}
</style>
