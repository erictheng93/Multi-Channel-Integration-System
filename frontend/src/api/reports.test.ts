import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    downloadFile: vi.fn()
  }
}))

import ReportsAPI from './reports'
import { apiClient } from './base'
import type { ReportHealthResponse } from '@shared/api-contracts'
import type { ReportBase, ReportListResponse, ReportStatistics } from '@/types/reports'

describe('ReportsAPI transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads health check data from the reports health endpoint', async () => {
    const healthResponse: ReportHealthResponse = {
      status: 'ok',
      module: 'reports',
      timestamp: '2026-01-01T00:00:00.000Z',
      version: '1.0.0'
    }
    vi.mocked(apiClient.get).mockResolvedValueOnce(
      healthResponse as unknown as Awaited<ReturnType<typeof apiClient.get>>
    )

    const result = await ReportsAPI.healthCheck()

    expect(apiClient.get).toHaveBeenCalledWith('/reports/health')
    expect(result.status).toBe('ok')
    expect(result.version).toBe('1.0.0')
  })

  it('generates a report through POST /reports and reads direct response data', async () => {
    const report: ReportBase = {
      id: 'report-1',
      title: 'Daily',
      type: 'conversation_summary',
      format: 'json',
      status: 'completed',
      createdBy: 'agent-1',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true, data: report })

    const result = await ReportsAPI.generateReport({
      type: 'conversation_summary',
      title: 'Daily',
      format: 'json',
      timeRange: 'last_7_days'
    })

    expect(apiClient.post).toHaveBeenCalledWith('/reports', {
      type: 'conversation_summary',
      title: 'Daily',
      format: 'json',
      timeRange: 'last_7_days'
    })
    expect(result.id).toBe('report-1')
  })

  it('builds report list query string', async () => {
    const list: ReportListResponse = {
      reports: [],
      pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: true },
      summary: { totalReports: 0, pendingReports: 0, completedReports: 0, failedReports: 0 }
    }
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: list })

    const result = await ReportsAPI.listReports({
      type: 'conversation_summary',
      status: 'completed',
      page: 2,
      pageSize: 10
    })

    expect(apiClient.get).toHaveBeenCalledWith(
      '/reports?type=conversation_summary&status=completed&page=2&pageSize=10'
    )
    expect(result.pagination.page).toBe(2)
  })

  it('downloads report files through downloadFile', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' })
    vi.mocked(apiClient.downloadFile).mockResolvedValueOnce({
      blob,
      filename: 'report.json',
      contentType: 'application/json'
    })

    const result = await ReportsAPI.downloadReport('report-1')

    expect(apiClient.downloadFile).toHaveBeenCalledWith('/reports/report-1/download')
    expect(result.filename).toBe('report.json')
  })

  it('deletes reports through DELETE /reports/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      success: true,
      message: 'Report deleted successfully'
    })

    const result = await ReportsAPI.deleteReport('report-1')

    expect(apiClient.delete).toHaveBeenCalledWith('/reports/report-1')
    expect(result.message).toBe('Report deleted successfully')
  })

  it('reads report statistics from direct response data', async () => {
    const stats: ReportStatistics = {
      totalReports: 1,
      reportsByType: { conversation_summary: 1 } as ReportStatistics['reportsByType'],
      reportsByFormat: { json: 1 } as ReportStatistics['reportsByFormat'],
      reportsByStatus: { completed: 1 } as ReportStatistics['reportsByStatus'],
      averageGenerationTime: 10,
      popularReports: [],
      usageByUser: [],
      monthlyTrends: []
    }
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: stats })

    const result = await ReportsAPI.getReportStatistics('last_30_days')

    expect(apiClient.get).toHaveBeenCalledWith('/reports/stats?timeRange=last_30_days')
    expect(result.totalReports).toBe(1)
  })
})
