<template>
  <article
    class="ui-card report-card"
    tabindex="0"
    @click="$emit('view-report', report.id)"
    @keydown.enter="$emit('view-report', report.id)"
  >
    <div class="card-top">
      <span class="ui-tag report-type-badge">{{ typeLabel }}</span>
      <div class="card-actions">
        <button
          class="action-btn"
          :disabled="!canDownload"
          title="下載"
          aria-label="下載"
          @click.stop="$emit('download-report', report)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" /></svg>
        </button>
        <button
          class="action-btn action-btn--danger"
          :disabled="!canDelete"
          title="刪除"
          aria-label="刪除"
          @click.stop="$emit('delete-report', report)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      </div>
    </div>

    <h4 class="report-title">
      {{ report.title }}
    </h4>
    <p
      v-if="report.description"
      class="report-description"
    >
      {{ truncatedDescription }}
    </p>

    <div class="card-foot">
      <span
        class="ui-pill ui-pill-dot status-badge"
        :class="pillClass"
      >{{ statusLabel }}</span>
      <span class="meta-text">{{ formatLabel }} · {{ formattedTime }}<template v-if="report.fileSize"> · {{ formattedSize }}</template></span>
    </div>
  </article>
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

  /**
   * 获取报表类型标签
   */
  getReportTypeLabel?: (_type: ReportType) => string
}

const props = defineProps<ReportCardProps>()

defineEmits<{
  'view-report': [reportId: string]
  'download-report': [report: ReportBase]
  'delete-report': [report: ReportBase]
}>()

const typeLabel = computed(() => props.getReportTypeLabel ? props.getReportTypeLabel(props.report.type) : props.report.type)
const pillClass = computed(() => {
  switch (props.report.status) {
    case 'completed':
      return 'ui-pill-green'
    case 'failed':
      return 'ui-pill-red'
    case 'generating':
    case 'pending':
      return 'ui-pill-orange'
    default:
      return ''
  }
})
const statusLabel = computed(() => props.getStatusLabel(props.report.status))
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
.report-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  cursor: pointer;
  transition:
    box-shadow var(--ui-dur) var(--ui-ease),
    transform var(--ui-dur) var(--ui-ease);
}

.report-card:hover,
.report-card:focus-visible {
  box-shadow: var(--ui-shadow-raised);
  outline: none;
  transform: translateY(-1px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-actions {
  display: flex;
  gap: 2px;
}

.action-btn {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover:not(:disabled) {
  background: var(--ui-fill);
  color: var(--ui-ink);
}

.action-btn--danger:hover:not(:disabled) {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.report-title {
  margin: 0;
  font: 600 15px / 1.3 var(--ui-font-display);
}

.report-description {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.card-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-top: 4px;
}

.meta-text {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .action-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
