/**
 * FiltersSection Component Unit Tests
 *
 * The filters live behind one 篩選 button (popover / bottom sheet); search stays visible and
 * active filters are echoed as removable chips. Behaviour (emits) is unchanged.
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FiltersSection from '@/components/reports/dashboard/FiltersSection.vue'
import type { ReportListQuery } from '@/types/reports'

const groupedReportTypes = [
  {
    category: 'standard',
    title: '標準報表',
    types: [
      { value: 'basic', label: '基礎報表' },
      { value: 'customer-analytics', label: '客戶分析' }
    ]
  },
  { category: 'advanced', title: '進階報表', types: [{ value: 'performance', label: '性能報表' }] }
]

const noFilters: ReportListQuery = {
  type: undefined,
  status: undefined,
  format: undefined,
  startDate: undefined,
  endDate: undefined
}

function make(filters: ReportListQuery = noFilters, extra: Record<string, unknown> = {}) {
  return mount(FiltersSection, {
    props: {
      filters,
      searchQuery: '',
      hasActiveFilters: false,
      groupedReportTypes,
      getReportTypeIcon: vi.fn(() => ''),
      ...extra
    },
    attachTo: document.body
  })
}

async function openPanel(wrapper: ReturnType<typeof make>) {
  await wrapper.find('.rf-btn').trigger('click')
}

describe('FiltersSection.vue', () => {
  it('shows search and a single 篩選 button; the panel starts closed', () => {
    const wrapper = make()
    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    expect(wrapper.find('.rf-btn').text()).toContain('篩選')
    expect(wrapper.find('.rf-btn').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('#rf-panel').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the panel with every filter group', async () => {
    const wrapper = make()
    await openPanel(wrapper)
    expect(wrapper.find('.rf-btn').attributes('aria-expanded')).toBe('true')
    const text = wrapper.find('#rf-panel').text()
    for (const label of ['報表類型', '狀態', '格式', '建立時間']) {
      expect(text).toContain(label)
    }
    expect(wrapper.findAll('#rf-type optgroup')).toHaveLength(2)
    expect(wrapper.findAll('#rf-status option').map(o => o.text())).toEqual(
      ['全部狀態', '待處理', '生成中', '已完成', '失敗', '已過期']
    )
    expect(wrapper.findAll('#rf-format option').map(o => o.text())).toEqual(['全部格式', 'JSON', 'CSV'])
    wrapper.unmount()
  })

  it('emits update:filters when a select changes and undefined for the empty option', async () => {
    const wrapper = make({ ...noFilters, status: 'failed' })
    await openPanel(wrapper)
    await wrapper.find('#rf-type').setValue('basic')
    expect(wrapper.emitted('update:filters')?.[0]?.[0]).toMatchObject({ type: 'basic', status: 'failed' })
    await wrapper.find('#rf-status').setValue('')
    expect(wrapper.emitted('update:filters')?.[1]?.[0]).toMatchObject({ status: undefined })
    wrapper.unmount()
  })

  it('a date preset sets both ends at once; 全部時間 clears them', async () => {
    const wrapper = make()
    await openPanel(wrapper)
    const preset = wrapper.findAll('.rf-presets .ui-chip').find(b => b.text() === '近 7 天')
    await preset?.trigger('click')
    const payload = wrapper.emitted('update:filters')?.[0]?.[0] as ReportListQuery
    expect(payload.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(payload.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const all = wrapper.findAll('.rf-presets .ui-chip').find(b => b.text() === '全部時間')
    await all?.trigger('click')
    expect(wrapper.emitted('update:filters')?.[1]?.[0]).toMatchObject({ startDate: undefined, endDate: undefined })
    wrapper.unmount()
  })

  it('shows date inputs for a custom range and emits their changes', async () => {
    const wrapper = make({ ...noFilters, startDate: '2020-01-01', endDate: '2020-01-31' })
    await openPanel(wrapper)
    const dates = wrapper.findAll('.rf-dates input')
    expect(dates).toHaveLength(2)
    await dates[0]!.setValue('2020-01-05')
    expect(wrapper.emitted('update:filters')?.[0]?.[0]).toMatchObject({ startDate: '2020-01-05' })
    await dates[1]!.setValue('2020-01-20')
    expect(wrapper.emitted('update:filters')?.[1]?.[0]).toMatchObject({ endDate: '2020-01-20' })
    wrapper.unmount()
  })

  it('echoes active filters as chips, counts them on the button, and removes one on click', async () => {
    const wrapper = make({ ...noFilters, type: 'basic' as ReportListQuery['type'], format: 'csv' }, { hasActiveFilters: true })
    expect(wrapper.find('.rf-count').text()).toBe('2')
    const chips = wrapper.findAll('.rf-chip')
    expect(chips.map(c => c.text())).toEqual(['基礎報表', 'CSV'])
    await chips[1]!.trigger('click')
    expect(wrapper.emitted('update:filters')?.[0]?.[0]).toMatchObject({ format: undefined, type: 'basic' })
    wrapper.unmount()
  })

  it('emits reset-filters from the panel and from 清除全部', async () => {
    const wrapper = make({ ...noFilters, format: 'json' }, { hasActiveFilters: true })
    await wrapper.find('.rf-clear').trigger('click')
    await openPanel(wrapper)
    const reset = wrapper.findAll('.rf-foot .btn').find(b => b.text() === '重設')
    await reset?.trigger('click')
    expect(wrapper.emitted('reset-filters')).toHaveLength(2)
    wrapper.unmount()
  })

  it('disables the panel reset when nothing is active', async () => {
    const wrapper = make()
    await openPanel(wrapper)
    const reset = wrapper.findAll('.rf-foot .btn').find(b => b.text() === '重設')
    expect(reset?.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('emits update:searchQuery on input', async () => {
    const wrapper = make()
    await wrapper.find('input[type="search"]').setValue('月報')
    expect(wrapper.emitted('update:searchQuery')?.[0]).toEqual(['月報'])
    wrapper.unmount()
  })

  it('closes on Escape and on 完成', async () => {
    const wrapper = make()
    await openPanel(wrapper)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#rf-panel').exists()).toBe(false)
    await openPanel(wrapper)
    await wrapper.find('.rf-foot .btn-primary').trigger('click')
    expect(wrapper.find('#rf-panel').exists()).toBe(false)
    wrapper.unmount()
  })
})
