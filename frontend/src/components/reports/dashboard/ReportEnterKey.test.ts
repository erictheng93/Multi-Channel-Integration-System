// Enter on a report opens it, but Enter on an inner action button must only run that action.
// The buttons stop click propagation, which does nothing for the keydown that bubbles first.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import ReportCard from './ReportCard.vue'
import ReportRow from './ReportRow.vue'
import type { ReportBase } from '@/types/reports'

const props = {
  report: { id: 'r1', title: 'T', type: 'daily', status: 'completed', format: 'pdf', createdAt: '2026-11-01T00:00:00Z', downloadUrl: '/d' } as unknown as ReportBase,
  getTypeBadgeClass: () => '',
  getReportTypeIcon: () => '',
  getStatusIcon: () => '',
  getStatusLabel: () => '',
  getStatusClass: () => '',
  getFormatIcon: () => '',
  getFormatLabel: () => '',
  formatRelativeTime: () => '',
  formatFileSize: () => '',
  truncateText: (text: string) => text
}

describe.each<[string, Component]>([['ReportRow', ReportRow], ['ReportCard', ReportCard]])('%s Enter key', (_name, component) => {
  it('does not open the report when Enter lands on an action button', async () => {
    const wrapper = mount(component, { props })
    await wrapper.find('.action-btn').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('view-report')).toBeUndefined()
  })

  it('opens the report when Enter lands on the report itself', async () => {
    const wrapper = mount(component, { props })
    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('view-report')).toEqual([['r1']])
  })
})
