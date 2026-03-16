<template>
  <div class="reports-section">
    <!-- 區段標題和控制項 -->
    <div class="section-header">
      <div class="section-title">
        <h3 class="title-text">
          報表列表
        </h3>
        <span
          v-if="!loading"
          class="report-count"
        >
          共 {{ reports.length }} 項
        </span>
      </div>

      <div class="section-controls">
        <!-- 排序控制 -->
        <div class="sort-control">
          <label class="control-label">排序：</label>
          <select
            :value="sortOrder"
            class="sort-select"
            @change="$emit('update:sortOrder', ($event.target as HTMLSelectElement).value as 'asc' | 'desc')"
          >
            <option value="desc">
              最新優先
            </option>
            <option value="asc">
              最舊優先
            </option>
          </select>
        </div>

        <!-- 視圖模式切換 -->
        <div class="view-toggle">
          <button
            class="view-btn"
            :class="{ 'active': viewMode === 'grid' }"
            title="網格視圖"
            @click="$emit('update:viewMode', 'grid')"
          >
            網格
          </button>
          <button
            class="view-btn"
            :class="{ 'active': viewMode === 'list' }"
            title="列表視圖"
            @click="$emit('update:viewMode', 'list')"
          >
            列表
          </button>
        </div>
      </div>
    </div>

    <!-- 載入狀態 -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <div class="loading-spinner" />
      <p class="loading-text">
        載入中...
      </p>
    </div>

    <!-- 空狀態 -->
    <div
      v-else-if="reports.length === 0"
      class="empty-state"
    >
      <div class="empty-icon" />
      <h3 class="empty-title">
        暫無報表
      </h3>
      <p class="empty-description">
        {{ emptyMessage }}
      </p>
      <button
        v-if="showCreateButton"
        class="btn btn-primary"
        @click="$emit('create-report')"
      >
        建立報表
      </button>
    </div>

    <!-- 網格視圖 -->
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
        @view-report="$emit('view-report', $event)"
        @download-report="$emit('download-report', $event)"
        @delete-report="$emit('delete-report', $event)"
      />
    </div>

    <!-- 列表視圖 -->
    <div
      v-else
      class="reports-list"
    >
      <!-- 列表表頭 -->
      <div class="list-header">
        <div class="header-cell type-cell">
          類型
        </div>
        <div class="header-cell title-cell">
          標題
        </div>
        <div class="header-cell status-cell">
          狀態
        </div>
        <div class="header-cell format-cell">
          格式
        </div>
        <div class="header-cell time-cell">
          建立時間
        </div>
        <div class="header-cell size-cell">
          大小
        </div>
        <div class="header-cell actions-cell">
          操作
        </div>
      </div>

      <!-- 列表項目 -->
      <div class="list-body">
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
          @view-report="$emit('view-report', $event)"
          @download-report="$emit('download-report', $event)"
          @delete-report="$emit('delete-report', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
}

withDefaults(defineProps<ReportsSectionProps>(), {
  emptyMessage: '開始建立您的第一份報表',
  showCreateButton: true
})

defineEmits<{
  'view-report': [reportId: string]
  'download-report': [report: ReportBase]
  'delete-report': [report: ReportBase]
  'create-report': []
  'update:viewMode': [mode: 'grid' | 'list']
  'update:sortOrder': [order: 'asc' | 'desc']
}>()
</script>

<style scoped>
.reports-section {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Section Header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.report-count {
  padding: 0.25rem 0.75rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.section-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Sort Control */
.sort-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-label {
  font-size: 0.9rem;
  color: #6b7280;
  font-weight: 500;
}

.sort-select {
  padding: 0.5rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.sort-select:focus {
  outline: none;
  border-color: #3b82f6;
}

/* View Toggle */
.view-toggle {
  display: flex;
  gap: 0.5rem;
}

.view-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #6b7280;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.view-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #6b7280;
  font-size: 1rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.empty-description {
  color: #6b7280;
  font-size: 1rem;
  margin: 0 0 2rem 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

/* Grid View */
.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
}

/* List View */
.reports-list {
  display: flex;
  flex-direction: column;
}

.list-header {
  display: grid;
  grid-template-columns: 60px 1fr 140px 100px 140px 100px 100px;
  gap: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
}

.header-cell {
  display: flex;
  align-items: center;
}

.header-cell.type-cell {
  justify-content: center;
}

.header-cell.status-cell,
.header-cell.format-cell,
.header-cell.time-cell,
.header-cell.size-cell {
  justify-content: center;
}

.header-cell.actions-cell {
  justify-content: flex-end;
}

.list-body {
  background: white;
}

/* Responsive */
@media (max-width: 1200px) {
  .reports-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .list-header {
    grid-template-columns: 60px 1fr 120px 90px 120px 90px 90px;
    gap: 0.75rem;
  }
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .section-controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .sort-control {
    justify-content: space-between;
  }

  .view-toggle {
    width: 100%;
  }

  .view-btn {
    flex: 1;
  }

  .reports-grid {
    grid-template-columns: 1fr;
  }

  .list-header {
    display: none;
  }
}
</style>
