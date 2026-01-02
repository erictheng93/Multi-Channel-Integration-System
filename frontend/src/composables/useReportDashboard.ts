/**
 * useReportDashboard Composable
 *
 * 管理报表仪表板的所有状态和业务逻辑
 *
 * 职责:
 * - 报表数据加载和管理
 * - 统计数据计算
 * - 筛选、排序、分页逻辑
 * - 报表操作 (下载、删除、重新生成)
 *
 * @example
 * const {
 *   reports,
 *   stats,
 *   pagination,
 *   loadReports,
 *   deleteReport
 * } = useReportDashboard()
 */

import { ref, reactive, computed, watch } from 'vue'
import ReportsAPI from '@/api/reports'
import type {
  ReportBase,
  ReportListQuery,
  DashboardStats,
  ReportType,
  ReportFormat,
  ReportStatus
} from '@/types/reports'

export interface UseReportDashboardOptions {
  /**
   * 是否自动加载数据
   * @default true
   */
  autoLoad?: boolean

  /**
   * 默认分页大小
   * @default 20
   */
  pageSize?: number

  /**
   * 默认排序字段
   * @default 'createdAt'
   */
  defaultSortBy?: string

  /**
   * 默认排序方向
   * @default 'desc'
   */
  defaultSortOrder?: 'asc' | 'desc'
}

export interface ReportDashboardState {
  reports: ReportBase[]
  stats: DashboardStats
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: ReportListQuery
  loading: boolean
  error: string | null
  sortBy: string
  sortOrder: 'asc' | 'desc'
  searchQuery: string
  viewMode: 'grid' | 'list'
}

export function useReportDashboard(options: UseReportDashboardOptions = {}) {
  const {
    autoLoad = true,
    pageSize = 20,
    defaultSortBy = 'createdAt',
    defaultSortOrder = 'desc'
  } = options

  // ========================================
  // State
  // ========================================

  const loading = ref(true)
  const error = ref<string | null>(null)
  const reports = ref<ReportBase[]>([])

  const stats = reactive<DashboardStats>({
    totalReports: 0,
    pendingReports: 0,
    completedReports: 0,
    failedReports: 0,
    todayGenerated: 0,
    thisWeekGenerated: 0,
    thisMonthGenerated: 0,
    popularTypes: [],
    recentActivity: []
  })

  const pagination = reactive({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })

  const filters = reactive<ReportListQuery>({
    type: undefined,
    status: undefined,
    format: undefined,
    startDate: undefined,
    endDate: undefined
  })

  const sortBy = ref(defaultSortBy)
  const sortOrder = ref<'asc' | 'desc'>(defaultSortOrder)
  const searchQuery = ref('')
  const viewMode = ref<'grid' | 'list'>('grid')

  // ========================================
  // Computed
  // ========================================

  /**
   * 报表完成率百分比
   */
  const completionRate = computed(() => {
    if (stats.totalReports === 0) return 0
    return Math.round((stats.completedReports / stats.totalReports) * 100)
  })

  /**
   * 是否有活动的筛选条件
   */
  const hasActiveFilters = computed(() => {
    return !!(
      filters.type ||
      filters.status ||
      filters.format ||
      filters.startDate ||
      filters.endDate ||
      searchQuery.value
    )
  })

  /**
   * 报表类型分组
   */
  const groupedReportTypes = computed(() => {
    const types = ReportsAPI.getAvailableReportTypes() || []

    return [
      {
        category: 'basic',
        title: '📊 基礎報表',
        types: types.filter(t =>
          [
            'conversation_summary',
            'agent_performance',
            'team_analytics',
            'customer_satisfaction',
            'platform_usage',
            'message_statistics',
            'response_time_analysis',
            'workload_distribution',
            'system_health',
            'custom'
          ].includes(t.value)
        )
      },
      {
        category: 'enterprise',
        title: '👑 企業級報表',
        types: types.filter(t =>
          [
            'cost_analysis',
            'sla_compliance',
            'anomaly_detection',
            'audit_trail',
            'resource_utilization'
          ].includes(t.value)
        )
      },
      {
        category: 'business_intelligence',
        title: '📈 商業智能',
        types: types.filter(t =>
          [
            'trend_forecast',
            'customer_insights',
            'channel_integration',
            'goal_achievement',
            'automation_effectiveness'
          ].includes(t.value)
        )
      },
      {
        category: 'advanced_analytics',
        title: '🔬 高級分析',
        types: types.filter(t =>
          ['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(
            t.value
          )
        )
      }
    ]
  })

  /**
   * 可见的分页页码
   */
  const visiblePages = computed(() => {
    const pages: number[] = []
    const totalPages = pagination.totalPages
    const currentPage = pagination.page

    // 最多顯示7個頁碼
    let start = Math.max(1, currentPage - 3)
    const end = Math.min(totalPages, start + 6)

    // 調整開始位置
    if (end - start < 6) {
      start = Math.max(1, end - 6)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    return pages
  })

  // ========================================
  // Methods - Data Loading
  // ========================================

  /**
   * 加载报表列表
   */
  async function loadReports() {
    loading.value = true
    error.value = null

    try {
      const query: ReportListQuery = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: sortBy.value,
        sortOrder: sortOrder.value,
        ...filters
      }

      // 添加搜尋查詢
      if (searchQuery.value.trim()) {
        // 搜尋功能暫時通過客戶端過濾實現
        // query.search = searchQuery.value.trim();
      }

      const response = await ReportsAPI.listReports(query)

      reports.value = response.reports

      // 更新分頁資料
      Object.assign(pagination, response.pagination)
    } catch (err) {
      console.error('載入報表列表失敗:', err)
      error.value = err instanceof Error ? err.message : '載入報表列表失敗'
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载统计数据
   */
  async function loadStatistics() {
    try {
      const statistics = await ReportsAPI.getReportStatistics('last_30_days')

      // 更新統計資料
      stats.totalReports = statistics.totalReports
      stats.pendingReports = statistics.reportsByStatus.pending || 0
      stats.completedReports = statistics.reportsByStatus.completed || 0
      stats.failedReports = statistics.reportsByStatus.failed || 0

      // 計算熱門類型
      stats.popularTypes = Object.entries(statistics.reportsByType)
        .map(([type, count]) => ({
          type: type as ReportType,
          label: getReportTypeLabel(type as ReportType),
          count,
          percentage: Math.round((count / statistics.totalReports) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // 模擬最近活動（在實際實現中應該從API獲取）
      stats.recentActivity = [
        {
          id: '1',
          action: '已生成',
          reportTitle: '客服績效報告',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          user: '張小明'
        },
        {
          id: '2',
          action: '已下載',
          reportTitle: '對話摘要報告',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          user: '李小華'
        },
        {
          id: '3',
          action: '已刪除',
          reportTitle: '系統健康報告',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          user: '王小美'
        }
      ]

      // 計算本月生成數量
      const thisMonth = new Date().getMonth()
      const thisMonthData = statistics.monthlyTrends?.find(
        trend => new Date(trend.month).getMonth() === thisMonth
      )
      stats.thisMonthGenerated = thisMonthData?.reportsGenerated || 0
    } catch (err) {
      console.error('載入統計資料失敗:', err)
    }
  }

  /**
   * 刷新所有数据
   */
  async function refreshData() {
    await Promise.all([loadReports(), loadStatistics()])
  }

  // ========================================
  // Methods - Filter & Sort & Pagination
  // ========================================

  /**
   * 应用筛选
   */
  function applyFilters() {
    pagination.page = 1 // 重置到第一頁
    loadReports()
  }

  /**
   * 重置筛选
   */
  function resetFilters() {
    filters.type = undefined
    filters.status = undefined
    filters.format = undefined
    filters.startDate = undefined
    filters.endDate = undefined
    searchQuery.value = ''
    applyFilters()
  }

  /**
   * 应用排序
   */
  function applySort() {
    pagination.page = 1 // 重置到第一頁
    loadReports()
  }

  /**
   * 切换排序方向
   */
  function toggleSortDirection() {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
    applySort()
  }

  /**
   * 搜索防抖
   */
  let searchTimeout: NodeJS.Timeout | null = null
  function debounceSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    searchTimeout = setTimeout(() => {
      applyFilters()
    }, 500)
  }

  /**
   * 切换页码
   */
  function changePage(page: number) {
    if (page >= 1 && page <= pagination.totalPages) {
      pagination.page = page
      loadReports()
    }
  }

  /**
   * 显示失败的报表
   */
  function showFailedReports() {
    filters.status = 'failed'
    applyFilters()
  }

  // ========================================
  // Methods - Report Operations
  // ========================================

  /**
   * 检查是否可以下载
   */
  function canDownload(report: ReportBase): boolean {
    return report.status === 'completed' && !!report.downloadUrl
  }

  /**
   * 检查是否可以重新生成
   */
  function canRegenerate(report: ReportBase): boolean {
    return ['failed', 'expired'].includes(report.status)
  }

  /**
   * 检查是否可以删除
   */
  function canDelete(report: ReportBase): boolean {
    return !['generating'].includes(report.status)
  }

  /**
   * 下载报表
   */
  async function downloadReport(report: ReportBase) {
    if (!canDownload(report)) return

    try {
      const downloadInfo = await ReportsAPI.downloadReport(report.id)

      // 創建下載連結
      const link = document.createElement('a')
      link.href = downloadInfo.url
      link.download = downloadInfo.filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      return true
    } catch (err) {
      console.error('下載報表失敗:', err)
      error.value = '下載報表失敗'
      return false
    }
  }

  /**
   * 删除报表
   */
  async function deleteReport(reportId: string) {
    try {
      await ReportsAPI.deleteReport(reportId)

      // 從列表中移除
      const reportIndex = reports.value.findIndex(r => r.id === reportId)
      if (reportIndex !== -1) {
        const deletedReport = reports.value[reportIndex]
        if (!deletedReport) return false // 類型守卫：確保 deletedReport 存在

        reports.value.splice(reportIndex, 1)

        // 更新統計
        stats.totalReports--
        if (deletedReport.status === 'completed') {
          stats.completedReports--
        } else if (deletedReport.status === 'failed') {
          stats.failedReports--
        } else if (deletedReport.status === 'pending') {
          stats.pendingReports--
        }
      }

      return true
    } catch (err) {
      console.error('刪除報表失敗:', err)
      error.value = '刪除報表失敗'
      return false
    }
  }

  /**
   * 批量导出报表
   */
  async function exportAllReports() {
    try {
      const batchOperation = {
        reportIds: (reports.value || []).filter(r => r.status === 'completed').map(r => r.id),
        action: 'export' as const,
        options: {
          format: 'csv' as ReportFormat,
          mergeReports: true
        }
      }

      const result = await ReportsAPI.batchOperation(batchOperation)

      if (result.success) {
        // 處理批量匯出成功
        console.log('批量匯出成功:', result)
        return true
      }

      return false
    } catch (err) {
      console.error('批量匯出失敗:', err)
      error.value = '批量匯出失敗'
      return false
    }
  }

  // ========================================
  // Helper Methods (extracted from component)
  // ========================================

  /**
   * 获取报表类型图标
   */
  function getReportTypeIcon(type: ReportType): string {
    const iconMap: Record<ReportType, string> = {
      conversation_summary: '💬',
      agent_performance: '👤',
      team_analytics: '👥',
      customer_satisfaction: '😊',
      platform_usage: '📱',
      message_statistics: '📊',
      response_time_analysis: '⏱️',
      workload_distribution: '⚖️',
      system_health: '🏥',
      custom: '🔧',
      cost_analysis: '💰',
      sla_compliance: '⚖️',
      anomaly_detection: '🚨',
      audit_trail: '📋',
      resource_utilization: '⚡',
      trend_forecast: '📈',
      customer_insights: '💡',
      channel_integration: '🌐',
      goal_achievement: '🎯',
      automation_effectiveness: '🤖',
      security_risk: '🔒',
      knowledge_base: '📚',
      call_quality: '📞',
      executive_summary: '💼'
    }
    return iconMap[type] || '📊'
  }

  /**
   * 获取报表类型标签
   */
  function getReportTypeLabel(type: ReportType): string {
    return ReportsAPI.formatReportType(type)
  }

  /**
   * 获取报表类型徽章类别
   */
  function getTypeBadgeClass(type: ReportType): string {
    if (
      ['cost_analysis', 'sla_compliance', 'anomaly_detection', 'audit_trail', 'resource_utilization'].includes(type)
    ) {
      return 'enterprise'
    }
    if (
      ['trend_forecast', 'customer_insights', 'channel_integration', 'goal_achievement', 'automation_effectiveness'].includes(type)
    ) {
      return 'business-intelligence'
    }
    if (['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(type)) {
      return 'advanced'
    }
    return 'basic'
  }

  /**
   * 获取状态图标
   */
  function getStatusIcon(status: ReportStatus): string {
    const statusMap = {
      pending: '⏳',
      generating: '⚙️',
      completed: '✅',
      failed: '❌',
      expired: '⏰'
    }
    return statusMap[status] || '❓'
  }

  /**
   * 获取状态标签
   */
  function getStatusLabel(status: ReportStatus): string {
    const statusMap = {
      pending: '待處理',
      generating: '生成中',
      completed: '已完成',
      failed: '失敗',
      expired: '已過期'
    }
    return statusMap[status] || status
  }

  /**
   * 获取状态类别
   */
  function getStatusClass(status: ReportStatus): string {
    const classMap = {
      pending: 'pending',
      generating: 'generating',
      completed: 'completed',
      failed: 'failed',
      expired: 'expired'
    }
    return classMap[status] || ''
  }

  /**
   * 获取格式图标
   */
  function getFormatIcon(format: ReportFormat): string {
    const formatMap = {
      json: '📄',
      csv: '📊',
      excel: '📗',
      pdf: '📕',
      html: '🌐'
    }
    return formatMap[format] || '📄'
  }

  /**
   * 获取格式标签
   */
  function getFormatLabel(format: ReportFormat): string {
    const formatMap = {
      json: 'JSON',
      csv: 'CSV',
      excel: 'Excel',
      pdf: 'PDF',
      html: 'HTML'
    }
    return formatMap[format] || format.toUpperCase()
  }

  /**
   * 获取活动图标
   */
  function getActivityIcon(action: string): string {
    const actionMap: Record<string, string> = {
      已生成: '✨',
      已下載: '📥',
      已刪除: '🗑️',
      已分享: '🔗',
      已匯出: '📤'
    }
    return actionMap[action] || '📋'
  }

  /**
   * 格式化相对时间
   */
  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) {
      return '剛剛'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} 分鐘前`
    } else if (diffHours < 24) {
      return `${diffHours} 小時前`
    } else if (diffDays < 7) {
      return `${diffDays} 天前`
    } else {
      return date.toLocaleDateString('zh-TW')
    }
  }

  /**
   * 格式化文件大小
   */
  function formatFileSize(bytes: number): string {
    return ReportsAPI.formatFileSize(bytes)
  }

  /**
   * 截断文本
   */
  function truncateText(text: string, length: number): string {
    if (text.length <= length) return text
    return `${text.substring(0, length)}...`
  }

  // ========================================
  // Watchers
  // ========================================

  watch([sortBy, sortOrder], () => {
    applySort()
  })

  // ========================================
  // Lifecycle
  // ========================================

  if (autoLoad) {
    refreshData()
  }

  // ========================================
  // Return
  // ========================================

  return {
    // State
    reports,
    stats,
    pagination,
    filters,
    loading,
    error,
    sortBy,
    sortOrder,
    searchQuery,
    viewMode,

    // Computed
    completionRate,
    hasActiveFilters,
    groupedReportTypes,
    visiblePages,

    // Methods - Data Loading
    loadReports,
    loadStatistics,
    refreshData,

    // Methods - Filter & Sort & Pagination
    applyFilters,
    resetFilters,
    applySort,
    toggleSortDirection,
    debounceSearch,
    changePage,
    showFailedReports,

    // Methods - Report Operations
    canDownload,
    canRegenerate,
    canDelete,
    downloadReport,
    deleteReport,
    exportAllReports,

    // Helper Methods
    getReportTypeIcon,
    getReportTypeLabel,
    getTypeBadgeClass,
    getStatusIcon,
    getStatusLabel,
    getStatusClass,
    getFormatIcon,
    getFormatLabel,
    getActivityIcon,
    formatRelativeTime,
    formatFileSize,
    truncateText
  }
}
