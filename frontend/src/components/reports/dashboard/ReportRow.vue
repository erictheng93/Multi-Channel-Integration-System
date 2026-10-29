<template>
  <div
    class="report-row"
    role="row"
    tabindex="0"
    @click="$emit('view-report', report.id)"
    @keydown.enter="$emit('view-report', report.id)"
  >
    <div
      role="cell"
      class="row-cell type-cell title-cell"
    >
      <h4 class="report-title">
        {{ report.title }}
      </h4>
      <p
        v-if="report.description"
        class="report-description"
      >
        {{ truncatedDescription }}
      </p>
      <span
        class="ui-tag report-type-badge"
        :class="typeBadgeClass"
      >{{ typeLabel }}</span>
    </div>

    <div
      role="cell"
      class="row-cell status-cell"
    >
      <span
        class="ui-pill ui-pill-dot status-badge"
        :class="[pillClass, statusClass]"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div
      role="cell"
      class="row-cell format-cell"
    >
      <span class="format-text">{{ formatLabel }}</span>
    </div>

    <div
      role="cell"
      class="row-cell time-cell"
    >
      <span class="time-text"><span class="format-inline">{{ formatLabel }} · </span>{{ formattedTime }}</span>
      <span
        v-if="expiryText"
        class="expiry-text"
      >{{ expiryText }}</span>
    </div>

    <div
      role="cell"
      class="row-cell size-cell"
    >
      <span
        class="size-text"
        :class="{ 'is-empty': !report.fileSize }"
      >{{ formattedSize }}</span>
    </div>

    <div
      role="cell"
      class="row-cell actions-cell"
    >
      <div class="row-actions">
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

  /**
   * 获取报表类型标签
   */
  getReportTypeLabel?: (_type: ReportType) => string
}

const props = defineProps<ReportRowProps>()

defineEmits<{
  'view-report': [reportId: string]
  'download-report': [report: ReportBase]
  'delete-report': [report: ReportBase]
}>()

const typeBadgeClass = computed(() => props.getTypeBadgeClass(props.report.type))
const statusClass = computed(() => props.getStatusClass(props.report.status))
const truncatedDescription = computed(() => {
  return props.report.description ? props.truncateText(props.report.description, 60) : ''
})
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
// Completed files are deleted after expiresAt; show it so users know how long the download stays
const expiryText = computed(() => {
  const at = props.report.expiresAt
  if (!at || props.report.status !== 'completed') { return '' }
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? '' : `到期 ${  d.getMonth() + 1  }/${  d.getDate()}`
})
const statusLabel = computed(() => props.getStatusLabel(props.report.status))
const formatLabel = computed(() => props.getFormatLabel(props.report.format))
const formattedTime = computed(() => props.formatRelativeTime(props.report.createdAt))
const formattedSize = computed(() => props.report.fileSize ? props.formatFileSize(props.report.fileSize) : '—')

const canDownload = computed(() => {
  return props.report.status === 'completed' && !!props.report.downloadUrl
})

const canDelete = computed(() => {
  return !['generating'].includes(props.report.status)
})
</script>

<style scoped>
.report-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 110px 70px minmax(100px, 1fr) 80px 76px;
  align-items: center;
  gap: 12px;
  padding: 14px 22px;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.report-row + .report-row::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

.report-row:hover,
.report-row:focus-visible {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
  outline: none;
}

.row-cell {
  min-width: 0;
}

.title-cell {
  display: grid;
  justify-items: start;
  gap: 6px;
}

.report-title {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-description {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.format-text,
.size-text {
  font-size: 13px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.size-text.is-empty {
  color: var(--ui-muted);
}

.format-inline {
  display: none;
}

.time-cell {
  display: grid;
  gap: 2px;
}

.time-text {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.expiry-text {
  font-size: 13px;
  color: var(--ui-muted);
}

.size-cell {
  text-align: left;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
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
  transition:
    background var(--ui-dur) var(--ui-ease),
    color var(--ui-dur) var(--ui-ease);
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

@media (max-width: 768px) {
  .report-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    padding: 14px 16px;
  }

  .title-cell {
    grid-column: 1;
  }

  .status-cell {
    grid-column: 2;
    grid-row: 1;
  }

  .format-inline {
    display: inline;
    font-weight: 600;
    color: var(--ui-ink-2);
  }

  .format-cell,
  .size-cell {
    display: none;
  }

  .time-cell {
    grid-column: 1;
  }

  .actions-cell {
    grid-column: 2;
    grid-row: 2;
  }

  .action-btn {
    width: 44px;
    height: 44px;
  }
}
</style>
