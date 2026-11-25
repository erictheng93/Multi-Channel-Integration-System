// Reports pages mounted with the real components and a mocked API client.
// Each case asserts something the page derives from the API data, so a
// page that stops calling the API or stops rendering its result fails.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ReportsAPI from '@/api/reports'

vi.mock('@/api/reports', () => ({
  default: {
    listReports: vi.fn(),
    getReportDetails: vi.fn(),
    getReportStatistics: vi.fn(),
    generateReport: vi.fn(),
    getReportTemplates: vi.fn(),
    getAvailableReportTypes: vi.fn(),
    getAvailableFormats: vi.fn(),
    getGeneratableOptions: vi.fn(),
    getTimeRangeOptions: vi.fn(),
    formatReportStatus: vi.fn(),
    formatFileSize: vi.fn(),
    formatReportType: vi.fn(),
    downloadReport: vi.fn(),
    getReportJsonContent: vi.fn(),
    deleteReport: vi.fn()
  }
}))

import Reports from '@/views/Reports.vue'
import ReportDashboard from '@/components/reports/ReportDashboard.vue'
import ReportGenerator from '@/components/reports/ReportGenerator.vue'
import ReportViewer from '@/components/reports/ReportViewer.vue'
import ReportTemplates from '@/components/reports/ReportTemplates.vue'

const mockReport = {
  id: 'test-report-001',
  title: 'Weekly digest report',
  description: 'A test report',
  type: 'conversation_summary',
  format: 'pdf',
  status: 'completed',
  createdBy: 'test-user',
  createdAt: '2024-01-01T10:00:00Z',
  completedAt: '2024-01-01T10:05:00Z',
  downloadUrl: 'https://example.com/report.pdf',
  fileSize: 1024000,
  metadata: {}
}

const listOf = (reports: unknown[]) => ({
  reports,
  pagination: { page: 1, pageSize: 10, total: reports.length, totalPages: 1, hasNext: false, hasPrev: false },
  summary: {
    totalReports: reports.length,
    pendingReports: 0,
    completedReports: reports.length,
    failedReports: 0
  }
})

const typeOptions = [
  { value: 'conversation_summary', label: 'Conversation summary', description: 'Conversation stats' },
  { value: 'agent_performance', label: 'Agent performance', description: 'Agent evaluation' }
]

// The mocked client returns partial fixtures; the cast keeps them terse.
const fixture = <T>(value: unknown) => value as T

async function mountPage(component: object, props: Record<string, unknown> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  router.push('/reports/dashboard')
  await router.isReady()
  return mount(component, { props, global: { plugins: [router, createPinia()] } })
}

describe('Reports pages', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(ReportsAPI.listReports).mockResolvedValue(fixture(listOf([mockReport])))
    vi.mocked(ReportsAPI.getReportDetails).mockResolvedValue(fixture(mockReport))
    vi.mocked(ReportsAPI.getReportStatistics).mockResolvedValue(
      fixture({
        totalReports: 1,
        reportsByStatus: { completed: 1 },
        reportsByType: { conversation_summary: 1 },
        reportsByFormat: { pdf: 1 },
        popularReports: [],
        usageByUser: [],
        monthlyTrends: []
      })
    )
    vi.mocked(ReportsAPI.generateReport).mockResolvedValue(fixture(mockReport))
    vi.mocked(ReportsAPI.getReportTemplates).mockResolvedValue([])
    vi.mocked(ReportsAPI.getAvailableReportTypes).mockReturnValue(fixture(typeOptions))
    const formatOptions = [
      { value: 'json', label: 'JSON file', icon: '' },
      { value: 'pdf', label: 'PDF file', icon: '' }
    ]
    vi.mocked(ReportsAPI.getAvailableFormats).mockReturnValue(fixture(formatOptions))
    vi.mocked(ReportsAPI.getGeneratableOptions).mockReturnValue(
      fixture({ types: typeOptions, formats: formatOptions })
    )
    vi.mocked(ReportsAPI.getTimeRangeOptions).mockReturnValue(
      fixture([
        { value: 'last_7_days', label: '7 days' },
        { value: 'last_30_days', label: '30 days' }
      ])
    )
    vi.mocked(ReportsAPI.formatReportStatus).mockReturnValue(
      fixture({ label: 'Completed', color: 'green', icon: '' })
    )
    vi.mocked(ReportsAPI.formatFileSize).mockReturnValue('1.0 MB')
    vi.mocked(ReportsAPI.formatReportType).mockImplementation(
      type => typeOptions.find(option => option.value === type)?.label ?? String(type)
    )
  })

  it('Reports view exposes the three section links in the layout submenu', async () => {
    const wrapper = await mountPage(Reports)

    const labels = wrapper.findAll('.submenu-item').map(item => item.text().trim())
    expect(labels).toEqual(expect.arrayContaining(['報表總覽', '報表模板', '產生報表']))
  })

  it('dashboard requests the report list and renders the returned report', async () => {
    const wrapper = await mountPage(ReportDashboard)
    await flushPromises()

    expect(ReportsAPI.listReports).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Weekly digest report')
  })

  it('dashboard does not render a report the API did not return', async () => {
    vi.mocked(ReportsAPI.listReports).mockResolvedValue(fixture(listOf([])))

    const wrapper = await mountPage(ReportDashboard)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Weekly digest report')
  })

  it('dashboard survives a failing list request without showing stale reports', async () => {
    vi.mocked(ReportsAPI.listReports).mockRejectedValue(new Error('network down'))

    const wrapper = await mountPage(ReportDashboard)
    await flushPromises()

    expect(wrapper.find('.report-dashboard').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Weekly digest report')
  })

  it('generator offers every report type the API reports', async () => {
    const wrapper = await mountPage(ReportGenerator)
    await flushPromises()

    const selector = wrapper.find('.report-type-selector')
    expect(selector.text()).toContain('Conversation summary')
    expect(selector.text()).toContain('Agent performance')
  })

  it('generator submits the preselected type with the default format and range', async () => {
    const wrapper = await mountPage(ReportGenerator)
    await flushPromises()

    await wrapper.find('form.report-generator-form').trigger('submit')
    await flushPromises()

    expect(ReportsAPI.generateReport).toHaveBeenCalledTimes(1)
    expect(ReportsAPI.generateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'conversation_summary',
        format: 'json',
        timeRange: 'last_30_days'
      })
    )
  })

  it('generator does not call the API when the title is empty', async () => {
    const wrapper = await mountPage(ReportGenerator)
    await flushPromises()
    await wrapper.find('input#title').setValue('')

    await wrapper.find('form.report-generator-form').trigger('submit')
    await flushPromises()

    expect(ReportsAPI.generateReport).not.toHaveBeenCalled()
  })

  it('templates page lists recent output from the API', async () => {
    const wrapper = await mountPage(ReportTemplates)
    await flushPromises()

    expect(ReportsAPI.listReports).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Weekly digest report')
  })

  it('viewer loads the report by id and shows its title and download action', async () => {
    const wrapper = await mountPage(ReportViewer, { reportId: 'test-report-001' })
    await flushPromises()

    expect(ReportsAPI.getReportDetails).toHaveBeenCalledWith('test-report-001')
    expect(wrapper.text()).toContain('Weekly digest report')
    expect(wrapper.text()).toContain('下載')
  })

  it('viewer does not show a report when the lookup fails', async () => {
    vi.mocked(ReportsAPI.getReportDetails).mockRejectedValue(new Error('not found'))

    const wrapper = await mountPage(ReportViewer, { reportId: 'non-existent-report' })
    await flushPromises()

    expect(ReportsAPI.getReportDetails).toHaveBeenCalledWith('non-existent-report')
    expect(wrapper.text()).not.toContain('Weekly digest report')
  })
})
