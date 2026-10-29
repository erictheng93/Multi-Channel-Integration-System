<template>
  <section class="ui-card reports-section">
    <div class="ui-card-head">
      <div>
        <h3 class="ui-card-title">
          報表列表
        </h3>
        <p
          v-if="!loading"
          class="ui-card-sub report-count"
        >
          共 {{ total ?? reports.length }} 項，依建立時間{{ sortOrder === 'desc' ? '由新到舊' : '由舊到新' }}
        </p>
      </div>
      <div class="ui-card-end section-controls">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="$emit('export-all')"
        >
          匯出全部
        </button>
        <label class="sort-control"><select
          :value="sortOrder"
          class="ui-select sort-select"
          aria-label="排序"
          @change="$emit('update:sortOrder', ($event.target as HTMLSelectElement).value as 'asc' | 'desc')"
        >
          <option value="desc">
            最新優先
          </option>
          <option value="asc">
            最舊優先
          </option>
        </select></label>
        <div class="ui-seg view-toggle">
          <button
            type="button"
            class="view-btn"
            :class="{ active: viewMode === 'grid' }"
            :aria-pressed="viewMode === 'grid'"
            @click="$emit('update:viewMode', 'grid')"
          >
            網格
          </button>
          <button
            type="button"
            class="view-btn"
            :class="{ active: viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            @click="$emit('update:viewMode', 'list')"
          >
            列表
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="state-box loading-state"
    >
      <span class="loading-spinner" />載入中...
    </div>

    <UiEmptyState
      v-else-if="reports.length === 0"
      class="empty-state"
      title="暫無報表"
      :description="emptyMessage"
    >
      <template #icon>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z M14 3v5h5" /></svg>
      </template>
      <template
        v-if="showCreateButton"
        #action
      >
        <button
          class="btn btn-primary"
          @click="$emit('create-report')"
        >
          建立報表
        </button>
      </template>
    </UiEmptyState>

    <div
      v-else-if="viewMode === 'grid'"
      class="reports-grid"
    >
      <ReportCard
        v-for="report in reports"
        :key="report.id"
        :report="report"
        :get-type-badge-class="getTypeBadgeClass"
        :get-report-type-icon="getReportTypeIcon"
        :get-status-icon="getStatusIcon"
        :get-status-label="getStatusLabel"
        :get-status-class="getStatusClass"
        :get-format-icon="getFormatIcon"
        :get-format-label="getFormatLabel"
        :format-relative-time="formatRelativeTime"
        :format-file-size="formatFileSize"
        :truncate-text="truncateText"
        :get-report-type-label="getReportTypeLabel"
        @view-report="$emit('view-report', $event)"
        @download-report="$emit('download-report', $event)"
        @delete-report="$emit('delete-report', $event)"
      />
    </div>

    <div
      v-else
      class="reports-list"
      role="table"
    >
      <div
        class="list-header"
        role="row"
      >
        <div
          role="columnheader"
          class="header-cell title-cell"
        >
          報表
        </div>
        <div
          role="columnheader"
          class="header-cell"
        >
          狀態
        </div>
        <div
          role="columnheader"
          class="header-cell"
        >
          格式
        </div>
        <div
          role="columnheader"
          class="header-cell"
        >
          建立時間
        </div>
        <div
          role="columnheader"
          class="header-cell size-cell"
        >
          大小
        </div>
        <div
          role="columnheader"
          class="header-cell actions-cell"
        />
      </div>
      <ReportRow
        v-for="report in reports"
        :key="report.id"
        :report="report"
        :get-type-badge-class="getTypeBadgeClass"
        :get-report-type-icon="getReportTypeIcon"
        :get-status-icon="getStatusIcon"
        :get-status-label="getStatusLabel"
        :get-status-class="getStatusClass"
        :get-format-icon="getFormatIcon"
        :get-format-label="getFormatLabel"
        :format-relative-time="formatRelativeTime"
        :format-file-size="formatFileSize"
        :truncate-text="truncateText"
        :get-report-type-label="getReportTypeLabel"
        @view-report="$emit('view-report', $event)"
        @download-report="$emit('download-report', $event)"
        @delete-report="$emit('delete-report', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
/**
 * ReportsSection Component
 *
 * 报表列表容器组件，支持网格和列表视图切换
 *
 * @emits view-report - 查看报表详情
 * @emits download-report - 下载报表
 * @emits delete-report - 删除报表
 * @emits create-report - 创建新报表
 * @emits update:viewMode - 更新视图模式
 * @emits update:sortOrder - 更新排序顺序
 */

import ReportCard from './ReportCard.vue'
import ReportRow from './ReportRow.vue'
import type { ReportBase, ReportType, ReportStatus, ReportFormat } from '@/types/reports'

export interface ReportsSectionProps {
  /**
   * 报表列表
   */
  reports: ReportBase[]

  /**
   * 加载状态
   */
  loading: boolean

  /**
   * 视图模式（grid: 网格, list: 列表）
   */
  viewMode: 'grid' | 'list'

  /**
   * 排序顺序（asc: 升序, desc: 降序）
   */
  sortOrder: 'asc' | 'desc'

  /**
   * 空状态提示消息
   */
  emptyMessage?: string

  /**
   * 是否显示创建按钮
   */
  showCreateButton?: boolean

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

  /**
   * Total matching reports (all pages)
   */
  total?: number
}

withDefaults(defineProps<ReportsSectionProps>(), {
  emptyMessage: '開始建立您的第一份報表',
  showCreateButton: true,
  getReportTypeLabel: undefined,
  total: undefined
})

defineEmits<{
  'view-report': [reportId: string]
  'download-report': [report: ReportBase]
  'delete-report': [report: ReportBase]
  'create-report': []
  'update:viewMode': [mode: 'grid' | 'list']
  'update:sortOrder': [order: 'asc' | 'desc']
  'export-all': []
}>()
</script>

<style scoped>
.reports-section {
  overflow: hidden;
  padding-bottom: 6px;
}

.section-controls {
  flex-wrap: wrap;
}

.sort-select {
  width: auto;
  height: 34px;
  border-radius: 10px;
  font-size: 13px;
}

.state-box {
  padding: 32px 22px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  padding: 4px 22px 16px;
}

.list-header {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) 110px 70px minmax(100px, 1fr) 80px 76px;
  gap: 12px;
  padding: 10px 22px;
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
}

.header-cell {
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-muted);
}

.header-cell.size-cell {
  text-align: right;
}

@media (max-width: 768px) {
  .list-header {
    display: none;
  }

  .reports-grid {
    padding: 4px 16px 16px;
  }
}
</style>
