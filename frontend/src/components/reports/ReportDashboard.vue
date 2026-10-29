<template>
  <div class="report-dashboard">
    <!-- 頁面標題和快速動作 -->
    <DashboardHeader
      :loading="loading"
      :subtitle="subtitle"
      @refresh="refreshData"
      @create-report="handleCreateReport"
    />

    <!-- 統計卡片區域 -->
    <StatsGrid
      :stats="stats"
      @show-failed-reports="showFailedReports"
    />

    <!-- 主要內容區域 -->
    <div class="main-content">
      <!-- 左側：篩選和報表列表 -->
      <div class="content-left">
        <!-- 篩選控制面板 -->
        <FiltersSection
          :filters="filters"
          :search-query="searchQuery"
          :has-active-filters="hasActiveFilters"
          :grouped-report-types="groupedReportTypes"
          :get-report-type-icon="getReportTypeIcon"
          @update:filters="applyFilters"
          @update:search-query="debounceSearch"
          @reset-filters="resetFilters"
        />

        <!-- 報表列表容器 -->
        <ReportsSection
          :reports="reports"
          :loading="loading"
          :view-mode="viewMode"
          :sort-order="sortOrder"
          :total="pagination.total"
          :get-report-type-label="getReportTypeLabel"
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
          @view-report="handleViewReport"
          @download-report="downloadReport"
          @delete-report="handleDeleteReport"
          @create-report="handleCreateReport"
          @update:view-mode="viewMode = $event"
          @update:sort-order="sortOrder = $event"
          @export-all="exportAllReports"
        />

        <!-- 分頁控制 -->
        <PaginationControls
          :pagination="pagination"
          :visible-pages="visiblePages"
          @change-page="changePage"
        />
      </div>

      <!-- 右側：統計圖表和活動 -->
      <div class="content-right">
        <SidebarWidgets>
          <!-- 熱門報表類型小部件 -->
          <template #popular-types>
            <PopularTypesWidget
              :popular-types="popularTypes"
              :get-report-type-icon="getReportTypeIcon"
              @filter-by-type="handleFilterByType"
            />
          </template>

          <!-- 最近活動小部件 -->
          <template #recent-activity>
            <RecentActivityWidget
              :activities="recentActivities"
              :get-status-icon="getStatusIcon"
              :format-relative-time="formatRelativeTime"
              @view-report="handleViewReport"
            />
          </template>
        </SidebarWidgets>
      </div>
    </div>

    <!-- 刪除確認對話框 -->
    <ConfirmDialog
      v-if="showDeleteDialog"
      :title="`刪除報表`"
      :message="`確定要刪除「${reportToDelete?.title}」嗎？此操作無法復原。`"
      confirm-text="刪除"
      confirm-class="danger"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useReportDashboard } from '@/composables/useReportDashboard'
import type { ReportBase, ReportType, ReportStatus } from '@/types/reports'
import type { PopularType } from './dashboard/PopularTypesWidget.vue'
import type { RecentActivity } from './dashboard/RecentActivityWidget.vue'

// 导入子组件
import DashboardHeader from './dashboard/DashboardHeader.vue'
import StatsGrid from './dashboard/StatsGrid.vue'
import FiltersSection from './dashboard/FiltersSection.vue'
import ReportsSection from './dashboard/ReportsSection.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import SidebarWidgets from './dashboard/SidebarWidgets.vue'
import PopularTypesWidget from './dashboard/PopularTypesWidget.vue'
import RecentActivityWidget from './dashboard/RecentActivityWidget.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

// Emits
const emit = defineEmits<{
  'create-report': [initialType?: ReportType]
  'view-report': [reportId: string]
  'view-templates': []
  'view-scheduled': []
}>()

// ========================================
// 使用 Composable 管理所有状态和逻辑
// ========================================

const {
  // State
  reports,
  stats,
  pagination,
  filters,
  loading,
  sortOrder,
  searchQuery,
  viewMode,

  // Computed
  hasActiveFilters,
  groupedReportTypes,
  visiblePages,

  // Methods
  refreshData,
  applyFilters,
  resetFilters,
  debounceSearch,
  changePage,
  showFailedReports,
  downloadReport,
  deleteReport,
  exportAllReports,

  // Helper Methods (所有组件需要的辅助方法)
  getReportTypeIcon: _getReportTypeIcon,
  getReportTypeLabel,
  getTypeBadgeClass,
  getStatusIcon: _getStatusIcon,
  getStatusLabel,
  getStatusClass,
  getFormatIcon,
  getFormatLabel,
  formatRelativeTime,
  formatFileSize,
  truncateText
} = useReportDashboard({
  autoLoad: true, // 自動加載數據
  pageSize: 20
})

// ========================================
// Type-safe Wrapper Functions
// ========================================

/**
 * Wrapper for getReportTypeIcon that accepts string (for widget components)
 */
const getReportTypeIcon = (type: string): string => {
  return _getReportTypeIcon(type as ReportType)
}

/**
 * Wrapper for getStatusIcon that accepts string (for widget components)
 */
const getStatusIcon = (status: string): string => {
  return _getStatusIcon(status as ReportStatus)
}

// ========================================
// UI State (不由 Composable 管理的 UI 特定狀態)
// ========================================

const showDeleteDialog = ref(false)
const reportToDelete = ref<ReportBase | null>(null)

// ========================================
// Computed Properties for Widgets
// ========================================

/**
 * 熱門報表類型（近 30 天統計，來自 /reports/stats）
 */
const popularTypes = computed<PopularType[]>(() =>
  stats.popularTypes.map(item => ({
    type: item.type,
    label: item.label,
    count: item.count,
    percentage: item.percentage
  }))
)

/**
 * One line under the title, from the list summary only
 */
const subtitle = computed(() => {
  if (stats.totalReports === 0) { return '' }
  const parts = [`已產生 ${stats.totalReports} 份報表`]
  if (stats.failedReports > 0) { parts.push(`其中 ${stats.failedReports} 份失敗`) }
  if (stats.pendingReports > 0) { parts.push(`${stats.pendingReports} 份正在處理`) }
  return `${parts.join('，')}。`
})

/**
 * 最近活动数据（用于 RecentActivityWidget）
 */
const recentActivities = computed<RecentActivity[]>(() => {
  // 取最近10个报表作为活动记录，过滤掉已过期的报表
  return reports.value
    .filter((report) => report.status !== 'expired')
    .slice(0, 10)
    .map((report) => ({
      id: report.id,
      reportId: report.id,
      title: report.title,
      typeLabel: getReportTypeLabel(report.type),
      status: report.status as 'completed' | 'generating' | 'failed' | 'pending',
      time: report.createdAt
    }))
})

// ========================================
// Event Handlers
// ========================================

function handleCreateReport() {
  emit('create-report')
}

function handleViewReport(reportId: string) {
  emit('view-report', reportId)
}

function handleDeleteReport(report: ReportBase) {
  reportToDelete.value = report
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!reportToDelete.value) {return}

  const success = await deleteReport(reportToDelete.value.id)

  if (success) {
    showDeleteDialog.value = false
    reportToDelete.value = null
  }
}

/**
 * 按类型筛选报表
 */
function handleFilterByType(type: string) {
  filters.type = type as ReportType
  applyFilters()
}

</script>

<style scoped>
.report-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px;
}

.main-content {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.content-right {
  display: flex;
  flex-direction: column;
}

@media (max-width: 1280px) {
  .main-content {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .report-dashboard {
    padding: 16px;
  }
}
</style>
