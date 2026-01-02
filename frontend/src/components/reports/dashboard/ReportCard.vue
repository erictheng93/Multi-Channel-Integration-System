<template>
  <div
    class="report-card"
    @click="$emit('view-report', report.id)"
  >
    <div class="card-header">
      <div
        class="report-type-badge"
        :class="typeBadgeClass"
      >
        {{ typeIcon }}
      </div>
      <div class="card-actions">
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
    <div class="card-content">
      <h4 class="report-title">
        {{ report.title }}
      </h4>
      <p
        v-if="report.description"
        class="report-description"
      >
        {{ truncatedDescription }}
      </p>
      <div class="report-meta">
        <div class="meta-row">
          <span class="meta-label">狀態：</span>
          <span
            class="status-badge"
            :class="statusClass"
          >
            {{ statusIcon }} {{ statusLabel }}
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">格式：</span>
          <span class="format-text">
            {{ formatIcon }} {{ formatLabel }}
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">建立：</span>
          <span class="time-text">{{ formattedTime }}</span>
        </div>
        <div
          v-if="report.fileSize"
          class="meta-row"
        >
          <span class="meta-label">大小：</span>
          <span class="size-text">{{ formattedSize }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ReportCard Component
 *
 * 报表卡片组件（网格视图）
 *
 * @emits view-report - 查看报表详情
 * @emits download-report - 下载报表
 * @emits delete-report - 删除报表
 */

import { computed } from 'vue'
import type { ReportBase, ReportType, ReportStatus, ReportFormat } from '@/types/reports'

export interface ReportCardProps {
  /**
   * 报表数据
   */
  report: ReportBase

  /**
   * 获取类型徽章类别
   */
  getTypeBadgeClass: (type: ReportType) => string

  /**
   * 获取报表类型图标
   */
  getReportTypeIcon: (type: ReportType) => string

  /**
   * 获取状态图标
   */
  getStatusIcon: (status: ReportStatus) => string

  /**
   * 获取状态标签
   */
  getStatusLabel: (status: ReportStatus) => string

  /**
   * 获取状态类别
   */
  getStatusClass: (status: ReportStatus) => string

  /**
   * 获取格式图标
   */
  getFormatIcon: (format: ReportFormat) => string

  /**
   * 获取格式标签
   */
  getFormatLabel: (format: ReportFormat) => string

  /**
   * 格式化时间
   */
  formatRelativeTime: (time: string) => string

  /**
   * 格式化文件大小
   */
  formatFileSize: (bytes: number) => string

  /**
   * 截断文本
   */
  truncateText: (text: string, length: number) => string
}

const props = defineProps<ReportCardProps>()

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
  return props.report.description ? props.truncateText(props.report.description, 100) : ''
})

const canDownload = computed(() => {
  return props.report.status === 'completed' && !!props.report.downloadUrl
})

const canDelete = computed(() => {
  return !['generating'].includes(props.report.status)
})
</script>

<style scoped>
.report-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s;
  cursor: pointer;
}

.report-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.report-type-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 1.2rem;
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

.card-actions {
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
}

.action-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-content {
  flex: 1;
}

.report-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.report-description {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.report-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.meta-label {
  color: #6b7280;
  font-weight: 500;
  min-width: 40px;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
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

.format-text,
.time-text,
.size-text {
  color: #374151;
  font-weight: 500;
}
</style>
