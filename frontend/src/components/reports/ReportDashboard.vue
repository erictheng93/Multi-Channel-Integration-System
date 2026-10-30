<template>
  <div class="ui-page report-dashboard ui-rise">
    <!-- 頁面標題和快速動作 -->
    <DashboardHeader
      :loading="loading"
      :subtitle="subtitle"
      @refresh="refreshData"
      @create-report="handleCreateReport"
    />

    <!-- Lead: this month's reports + rings of completed / processing / failed -->
    <StatsLead
      :stats="stats"
      :reports="reports"
      :loaded="loaded"
      @show-failed-reports="showFailedReports"
    />

    <!-- Phone: what needs a look comes before the long list (the rail is below it) -->
    <div
      v-if="attention.length > 0"
      class="ui-card attn-top"
    >
      <AttentionList
        :items="attention"
        @open="handleViewReport"
      />
    </div>

    <!-- 主要內容區域 -->
    <div class="main-content">
      <!-- 左側：篩選和報表列表 -->
      <div class="content-left">
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
          <template #toolbar>
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
          </template>
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
          <!-- 需要留意：由報表列表的真實狀態推導（手機版移到列表上方） -->
          <template
            v-if="attention.length > 0"
            #quick-actions
          >
            <AttentionList
              class="rail-attn"
              :items="attention"
              @open="handleViewReport"
            />
          </template>
          <StorageWidget :reports="reports" />
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
import StatsLead from './dashboard/StatsLead.vue'
import FiltersSection from './dashboard/FiltersSection.vue'
import ReportsSection from './dashboard/ReportsSection.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import SidebarWidgets from './dashboard/SidebarWidgets.vue'
import PopularTypesWidget from './dashboard/PopularTypesWidget.vue'
import AttentionList from './dashboard/AttentionList.vue'
import StorageWidget from './dashboard/StorageWidget.vue'
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

// What needs a look, derived from the loaded rows: failures, work in progress, downloads about to expire
const attention = computed(() => {
  const soon = Date.now() + 3 * 864e5
  const items: Array<{ id: string; title: string; note: string; tone: 'red' | 'orange' | 'grey'; rank: number }> = []
  for (const report of reports.value) {
    const when = formatRelativeTime(report.createdAt)
    if (report.status === 'failed') {
      items.push({ id: report.id, title: report.title, note: `產生失敗 ・ ${when}`, tone: 'red', rank: 0 })
    } else if (report.status === 'generating' || report.status === 'pending') {
      items.push({ id: report.id, title: report.title, note: `生成中 ・ ${when}開始`, tone: 'orange', rank: 1 })
    } else if (report.status === 'completed' && report.expiresAt && new Date(report.expiresAt).getTime() < soon) {
      items.push({ id: report.id, title: report.title, note: `下載連結即將到期 ・ ${new Date(report.expiresAt).getMonth() + 1}/${new Date(report.expiresAt).getDate()}`, tone: 'grey', rank: 2 })
    }
  }
  return items.sort((x, y) => x.rank - y.rank).slice(0, 5)
})

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
  const parts: string[] = []
  if (stats.failedReports > 0) { parts.push(`${stats.failedReports} 份失敗需要處理`) }
  if (stats.pendingReports > 0) { parts.push(`${stats.pendingReports} 份正在產生`) }
  return parts.length > 0 ? `${parts.join('，')}。` : '所有報表都已完成。'
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

/* The right column is shorter than the list: it stays in view while the list scrolls */
.content-right {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
}

.content-right :deep(.widgets-container) {
  display: grid;
  gap: 16px;
}

.attn-top {
  display: none;
}

@media (max-width: 1280px) {
  .main-content {
    grid-template-columns: minmax(0, 1fr);
  }

  .content-right {
    position: static;
  }
}

@media (max-width: 768px) {
  .attn-top {
    display: block;
  }

  /* the phone shows this block above the list instead */
  .content-right :deep(.widget-wrapper:has(.rail-attn)),
  .content-right :deep(.widget-wrapper:has(.stor)) {
    display: none;
  }
}
</style>
