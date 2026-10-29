<template>
  <div class="ui-page report-dashboard">
    <!-- 頁面標題和快速動作 -->
    <DashboardHeader
      :loading="loading"
      :subtitle="subtitle"
      @refresh="refreshData"
      @create-report="handleCreateReport"
    />

    <!-- 統計區域：本月報表為唯一的主指標，其餘為狀態分佈 -->
    <section class="overview-top">
      <article
        class="ui-card ui-kpi lead-card"
        role="group"
        aria-label="本月報表"
        :aria-busy="!loaded || undefined"
      >
        <div class="ui-kpi-top">
          <span class="ui-kpi-ico ico-lead"><svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg></span>
          本月報表
        </div>
        <div
          class="ui-kpi-value"
          :class="{ 'is-dim': loaded && stats.thisMonthGenerated === 0 }"
        >
          {{ loaded ? stats.thisMonthGenerated.toLocaleString('en-US') : '—' }}
        </div>
        <div class="ui-kpi-foot">
          <span>本月已產生的報表數</span>
        </div>
      </article>
      <StatsGrid
        :stats="stats"
        @show-failed-reports="showFailedReports"
      />
    </section>

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
        >
          <template
            v-if="pagination.totalPages > 1"
            #footer
          >
            <PaginationControls
              :pagination="pagination"
              :visible-pages="visiblePages"
              @change-page="changePage"
            />
          </template>
        </ReportsSection>
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
          <!-- 最近活動：由報表列表的真實狀態推導 -->
          <template
            v-if="recentActivities.length > 0"
            #recent-activity
          >
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

// 导入子组件
import DashboardHeader from './dashboard/DashboardHeader.vue'
import StatsGrid from './dashboard/StatsGrid.vue'
import FiltersSection from './dashboard/FiltersSection.vue'
import ReportsSection from './dashboard/ReportsSection.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import SidebarWidgets from './dashboard/SidebarWidgets.vue'
import PopularTypesWidget from './dashboard/PopularTypesWidget.vue'
import RecentActivityWidget, { type RecentActivity } from './dashboard/RecentActivityWidget.vue'
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
// The lead metric stays a skeleton until the first list response has arrived
const loaded = computed(() => !loading.value || reports.value.length > 0 || stats.totalReports > 0)

// Feed derived from the loaded report rows (newest first); the status is the row's own
const recentActivities = computed<RecentActivity[]>(() =>
  reports.value
    .filter(report => report.status === 'completed' || report.status === 'generating' || report.status === 'failed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map(report => ({
      id: report.id,
      reportId: report.id,
      title: report.title,
      typeLabel: getReportTypeLabel(report.type),
      status: report.status === 'completed' || report.status === 'failed' ? report.status : 'generating',
      time: report.createdAt
    }))
)

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

/* One row of five identical KPI cards: the month figure is the first of them */
.overview-top {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.overview-top :deep(.ui-kpi-grid) {
  display: contents;
}

.lead-card {
  gap: 10px;
  padding: 18px 20px 16px;
  box-shadow: var(--ui-shadow-card);
}

.ico-lead {
  background: var(--ui-indigo-soft);
  color: var(--ui-indigo);
}

.ui-kpi-value.is-dim {
  color: var(--ui-muted);
}

.main-content {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.content-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* Both columns end on the same line; the last widget absorbs the difference (capped for long lists) */
.content-right {
  display: flex;
  flex-direction: column;
}

.content-right :deep(.sidebar-widgets),
.content-right :deep(.widgets-container) {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.content-right :deep(.widget-wrapper:last-child) {
  flex: 1;
  max-height: 720px;
}

@media (max-width: 1280px) {
  .main-content {
    grid-template-columns: minmax(0, 1fr);
  }

  .content-right :deep(.widget-wrapper:last-child) {
    max-height: none;
  }
}

@media (max-width: 1024px) {
  .overview-top {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lead-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .overview-top {
    gap: 12px;
  }
}
</style>
