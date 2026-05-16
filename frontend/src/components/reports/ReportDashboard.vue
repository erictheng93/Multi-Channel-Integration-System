<template>
  <div class="report-dashboard">
    <!-- 頁面標題和快速動作 -->
    <DashboardHeader
      :loading="loading"
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
          <!-- 快速操作小部件 -->
          <template #quick-actions>
            <QuickActionsWidget
              :loading="loading"
              :total-reports="stats.totalReports"
              @create-report="handleCreateReport"
              @refresh="refreshData"
              @export-all="exportAllReports"
            />
          </template>

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
import QuickActionsWidget from './dashboard/QuickActionsWidget.vue'
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
 * 热门报表类型数据（用于 PopularTypesWidget）
 */
const popularTypes = computed<PopularType[]>(() => {
  // 统计每种类型的报表数量
  const typeCounts: Record<string, number> = {}
  reports.value.forEach((report) => {
    typeCounts[report.type] = (typeCounts[report.type] || 0) + 1
  })

  // 转换为数组并排序
  const types = Object.entries(typeCounts)
    .map(([type, count]) => ({
      type,
      label: getReportTypeLabel(type as ReportType),
      count,
      percentage: stats.totalReports > 0 ? Math.round((count / stats.totalReports) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // 只显示前5个

  return types
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
  max-width: 1600px;
  margin: 0 auto;
  padding: 2rem;
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.content-right {
  display: flex;
  flex-direction: column;
}

/* 響應式設計 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .content-right {
    order: -1;
  }
}

@media (max-width: 768px) {
  .report-dashboard {
    padding: 1rem;
  }
}
</style>
