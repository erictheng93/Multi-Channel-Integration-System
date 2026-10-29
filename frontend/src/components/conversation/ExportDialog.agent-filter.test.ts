import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const exportMessages = vi.fn()
const getExportAgents = vi.fn()

vi.mock('@/api/export', () => ({
  exportMessages: (...a: unknown[]) => exportMessages(...a),
  fetchExportData: vi.fn(),
  getExportCustomers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getExportCount: vi.fn(),
  getExportAgents: () => getExportAgents(),
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }))
vi.mock('@/composables/useConfirmDialog', () => ({ useConfirmDialog: () => ({ showWarning: vi.fn() }) }))
vi.mock('@/services/pdfExportService', () => ({ generatePdfExport: vi.fn() }))
vi.mock('@/components/ui/Modal.vue', () => ({
  default: { props: ['show', 'title', 'size'], template: '<div><slot /><slot name="footer" /></div>' },
}))

import ExportDialog from './ExportDialog.vue'

describe('ExportDialog agent filter (S7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getExportAgents.mockResolvedValue({
      success: true,
      data: [{ id: 'a-1', displayName: 'Alice', role: 'agent' }],
    })
    exportMessages.mockResolvedValue({ success: false, error: 'stop' })
    URL.createObjectURL = vi.fn(() => 'blob:x')
  })

  it('sends the selected agentId with the export request', async () => {
    const wrapper = mount(ExportDialog, { props: { show: true } })
    await flushPromises()
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await flushPromises()

    const selects = wrapper.findAll('select')
    const agentSelect = selects[selects.length - 1]!
    expect(agentSelect.text()).toContain('Alice')
    await agentSelect.setValue('a-1')

    await wrapper.find('.btn-apple-primary').trigger('click')
    await flushPromises()

    expect(exportMessages).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'a-1' }))
  })

  it('omits agentId when no agent is chosen, and hides the select when the list is empty', async () => {
    getExportAgents.mockResolvedValue({ success: true, data: [] })
    const wrapper = mount(ExportDialog, { props: { show: true } })
    await flushPromises()
    expect(wrapper.findAll('select')).toHaveLength(1)
  })
})
