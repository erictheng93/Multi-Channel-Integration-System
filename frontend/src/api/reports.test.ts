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
import type { ReportBase, ReportListResponse } from '@/types/reports'

describe('ReportsAPI transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads health check data from the reports health endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      success: true,
      data: { status: 'ok', module: 'reports', timestamp: '2026-01-01T00:00:00.000Z' }
    })

    const result = await ReportsAPI.healthCheck()

    expect(apiClient.get).toHaveBeenCalledWith('/reports/health')
    expect(result.status).toBe('ok')
  })

  it('generates a report through POST /reports and unwraps nested data', async () => {
    const report: ReportBase = {
      id: 'report-1',
      title: 'Daily',
      type: 'conversation_summary',
      format: 'json',
      status: 'completed',
      createdBy: 'agent-1',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ success: true, data: { data: report } })

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
    vi.mocked(apiClient.get).mockResolvedValueOnce({ success: true, data: { data: list } })

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
      data: { success: true, message: 'deleted' }
    })

    const result = await ReportsAPI.deleteReport('report-1')

    expect(apiClient.delete).toHaveBeenCalledWith('/reports/report-1')
    expect(result.message).toBe('deleted')
  })
})
