/**
 * useReportDashboard Composable 单元测试
 *
 * 测试策略:
 * 1. 状态初始化
 * 2. 数据加载
 * 3. 筛选和排序
 * 4. 报表操作 (下载、删除)
 * 5. 计算属性
 * 6. Helper 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReportDashboard } from '@/composables/useReportDashboard'
import ReportsAPI from '@/api/reports'
import type { ReportBase } from '@/types/reports'

// Mock ReportsAPI
vi.mock('@/api/reports', () => ({
  default: {
    listReports: vi.fn(),
    getReportStatistics: vi.fn(),
    downloadReport: vi.fn(),
    deleteReport: vi.fn(),
    batchOperation: vi.fn(),
    getAvailableReportTypes: vi.fn(() => [
      { value: 'conversation_summary', label: '對話摘要' },
      { value: 'agent_performance', label: '客服績效' }
    ]),
    formatReportType: vi.fn((type) => {
      const map: Record<string, string> = {
        conversation_summary: '對話摘要',
        agent_performance: '客服績效'
      }
      return map[type] || type
    }),
    formatFileSize: vi.fn((bytes) => {
      if (bytes < 1024) {return `${bytes}B`}
      if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(2)}KB`}
      return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
    })
  }
}))

describe('useReportDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('應該正確初始化狀態', () => {
      const { reports, stats, pagination, loading } = useReportDashboard({ autoLoad: false })

      expect(reports.value).toEqual([])
      expect(stats.totalReports).toBe(0)
      expect(pagination.page).toBe(1)
      expect(loading.value).toBe(true)
    })

    it('應該使用自定義選項初始化', () => {
      const { pagination, sortBy, sortOrder } = useReportDashboard({
        autoLoad: false,
        pageSize: 50,
        defaultSortBy: 'title',
        defaultSortOrder: 'asc'
      })

      expect(pagination.pageSize).toBe(50)
      expect(sortBy.value).toBe('title')
      expect(sortOrder.value).toBe('asc')
    })

    it('自動加載時應該調用 API', async () => {
      const mockReports: ReportBase[] = [
        {
          id: '1',
          title: 'Test Report',
          type: 'conversation_summary',
          format: 'json',
          status: 'completed',
          createdAt: new Date().toISOString(),
          fileSize: 1024
        }
      ]

      vi.mocked(ReportsAPI.listReports).mockResolvedValueOnce({
        reports: mockReports,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      })

      vi.mocked(ReportsAPI.getReportStatistics).mockResolvedValueOnce({
        totalReports: 1,
        reportsByStatus: { completed: 1, pending: 0, failed: 0 },
        reportsByType: { conversation_summary: 1 },
        monthlyTrends: []
      })

      const { reports } = useReportDashboard({ autoLoad: true })

      // 等待異步操作完成
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(reports.value.length).toBe(1)
      expect(reports.value[0].title).toBe('Test Report')
    })
  })

  describe('數據加載', () => {
    it('loadReports 應該正確加載報表列表', async () => {
      const { loadReports, reports, loading } = useReportDashboard({ autoLoad: false })

      const mockReports: ReportBase[] = [
        {
          id: '1',
          title: 'Report 1',
          type: 'conversation_summary',
          format: 'json',
          status: 'completed',
          createdAt: new Date().toISOString()
        }
      ]

      vi.mocked(ReportsAPI.listReports).mockResolvedValueOnce({
        reports: mockReports,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      })

      expect(loading.value).toBe(true)

      await loadReports()

      expect(reports.value).toEqual(mockReports)
      expect(loading.value).toBe(false)
      expect(ReportsAPI.listReports).toHaveBeenCalledTimes(1)
    })

    it('loadReports 應該處理錯誤', async () => {
      const { loadReports, error } = useReportDashboard({ autoLoad: false })

      vi.mocked(ReportsAPI.listReports).mockRejectedValueOnce(new Error('Network error'))

      await loadReports()

      expect(error.value).toBe('Network error')
    })

    it('loadStatistics 應該正確加載統計數據', async () => {
      const { loadStatistics, stats } = useReportDashboard({ autoLoad: false })

      vi.mocked(ReportsAPI.getReportStatistics).mockResolvedValueOnce({
        totalReports: 100,
        reportsByStatus: { completed: 80, pending: 10, failed: 10 },
        reportsByType: { conversation_summary: 50, agent_performance: 50 },
        monthlyTrends: []
      })

      await loadStatistics()

      expect(stats.totalReports).toBe(100)
      expect(stats.completedReports).toBe(80)
      expect(stats.pendingReports).toBe(10)
      expect(stats.failedReports).toBe(10)
    })
  })

  describe('計算屬性', () => {
    it('completionRate 應該正確計算完成率', () => {
      const { stats, completionRate } = useReportDashboard({ autoLoad: false })

      stats.totalReports = 100
      stats.completedReports = 75

      expect(completionRate.value).toBe(75)
    })

    it('completionRate 在總數為 0 時應該返回 0', () => {
      const { stats, completionRate } = useReportDashboard({ autoLoad: false })

      stats.totalReports = 0
      stats.completedReports = 0

      expect(completionRate.value).toBe(0)
    })

    it('hasActiveFilters 應該正確檢測活動篩選', () => {
      const { filters, hasActiveFilters } = useReportDashboard({ autoLoad: false })

      expect(hasActiveFilters.value).toBe(false)

      filters.type = 'conversation_summary'

      expect(hasActiveFilters.value).toBe(true)
    })

    it('visiblePages 應該正確計算可見頁碼', () => {
      const { pagination, visiblePages } = useReportDashboard({ autoLoad: false })

      pagination.totalPages = 10
      pagination.page = 5

      const pages = visiblePages.value

      expect(pages).toContain(5) // 當前頁應該包含在內
      expect(pages.length).toBeLessThanOrEqual(7) // 最多 7 個頁碼
    })
  })

  describe('篩選和排序', () => {
    it('applyFilters 應該重置頁碼並重新加載', async () => {
      const { applyFilters, pagination } = useReportDashboard({ autoLoad: false })

      vi.mocked(ReportsAPI.listReports).mockResolvedValueOnce({
        reports: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      })

      pagination.page = 5

      await applyFilters()

      expect(pagination.page).toBe(1)
      expect(ReportsAPI.listReports).toHaveBeenCalled()
    })

    it('resetFilters 應該清除所有篩選條件', async () => {
      const { filters, searchQuery, resetFilters } = useReportDashboard({ autoLoad: false })

      vi.mocked(ReportsAPI.listReports).mockResolvedValueOnce({
        reports: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      })

      filters.type = 'conversation_summary'
      filters.status = 'completed'
      searchQuery.value = 'test'

      await resetFilters()

      expect(filters.type).toBeUndefined()
      expect(filters.status).toBeUndefined()
      expect(searchQuery.value).toBe('')
    })

    it('toggleSortDirection 應該切換排序方向', async () => {
      const { sortOrder, toggleSortDirection } = useReportDashboard({ autoLoad: false })

      vi.mocked(ReportsAPI.listReports).mockResolvedValue({
        reports: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      })

      expect(sortOrder.value).toBe('desc')

      await toggleSortDirection()

      expect(sortOrder.value).toBe('asc')
    })
  })

  describe('報表操作', () => {
    it('canDownload 應該正確判斷是否可以下載', () => {
      const { canDownload } = useReportDashboard({ autoLoad: false })

      const completedReport: ReportBase = {
        id: '1',
        title: 'Test',
        type: 'conversation_summary',
        format: 'json',
        status: 'completed',
        downloadUrl: 'https://example.com/download',
        createdAt: new Date().toISOString()
      }

      const pendingReport: ReportBase = {
        ...completedReport,
        status: 'pending',
        downloadUrl: undefined
      }

      expect(canDownload(completedReport)).toBe(true)
      expect(canDownload(pendingReport)).toBe(false)
    })

    it('deleteReport 應該刪除報表並更新統計', async () => {
      const { deleteReport, reports, stats } = useReportDashboard({ autoLoad: false })

      vi.mocked(ReportsAPI.deleteReport).mockResolvedValueOnce(undefined)

      reports.value = [
        {
          id: '1',
          title: 'Test Report',
          type: 'conversation_summary',
          format: 'json',
          status: 'completed',
          createdAt: new Date().toISOString()
        }
      ]

      stats.totalReports = 1
      stats.completedReports = 1

      const success = await deleteReport('1')

      expect(success).toBe(true)
      expect(reports.value.length).toBe(0)
      expect(stats.totalReports).toBe(0)
      expect(stats.completedReports).toBe(0)
    })
  })

  describe('Helper 方法', () => {
    it('getReportTypeIcon 應該返回正確的圖標', () => {
      const { getReportTypeIcon } = useReportDashboard({ autoLoad: false })

      expect(getReportTypeIcon('conversation_summary')).toBe('')
      expect(getReportTypeIcon('agent_performance')).toBe('')
      expect(getReportTypeIcon('custom')).toBe('')
    })

    it('getStatusIcon 應該返回正確的圖標', () => {
      const { getStatusIcon } = useReportDashboard({ autoLoad: false })

      expect(getStatusIcon('completed')).toBe('')
      expect(getStatusIcon('pending')).toBe('')
      expect(getStatusIcon('failed')).toBe('')
    })

    it('formatRelativeTime 應該正確格式化時間', () => {
      const { formatRelativeTime } = useReportDashboard({ autoLoad: false })

      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 分鐘前')
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 小時前')
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 天前')
    })

    it('truncateText 應該正確截斷文本', () => {
      const { truncateText } = useReportDashboard({ autoLoad: false })

      expect(truncateText('Short text', 100)).toBe('Short text')
      expect(truncateText('This is a very long text that needs truncation', 20)).toBe(
        'This is a very long ...'
      )
    })
  })
})
