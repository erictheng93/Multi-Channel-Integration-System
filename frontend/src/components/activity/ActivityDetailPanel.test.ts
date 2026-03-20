import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityDetailPanel from './ActivityDetailPanel.vue'
import type { DetailEntry } from './types'

function makeEntries(overrides: Partial<DetailEntry>[] = []): DetailEntry[] {
  return overrides.map((o, i) => ({
    key: `key-${i}`,
    value: `value-${i}`,
    type: 'default' as const,
    ...o,
  }))
}

function mountPanel(props: { entries: DetailEntry[]; show: boolean }) {
  return mount(ActivityDetailPanel, { props })
}

describe('ActivityDetailPanel', () => {
  it('renders all detail entries when show=true', () => {
    const entries = makeEntries([{}, {}, {}])
    const wrapper = mountPanel({ entries, show: true })
    const detailEntries = wrapper.findAll('.detail-entry')
    expect(detailEntries).toHaveLength(3)
  })

  it('displays key and value text', () => {
    const entries = makeEntries([{ key: 'IP Address', value: '192.168.1.1' }])
    const wrapper = mountPanel({ entries, show: true })
    expect(wrapper.text()).toContain('IP Address')
    expect(wrapper.text()).toContain('192.168.1.1')
  })

  it('applies detail-value--old class for old-value type entries', () => {
    const entries = makeEntries([{ key: 'Old Value', value: 'OldName', type: 'old-value' }])
    const wrapper = mountPanel({ entries, show: true })
    const valueEl = wrapper.find('.detail-value--old')
    expect(valueEl.exists()).toBe(true)
    expect(valueEl.text()).toBe('OldName')
  })

  it('applies detail-value--new class for new-value type entries', () => {
    const entries = makeEntries([{ key: 'New Value', value: 'NewName', type: 'new-value' }])
    const wrapper = mountPanel({ entries, show: true })
    const valueEl = wrapper.find('.detail-value--new')
    expect(valueEl.exists()).toBe(true)
    expect(valueEl.text()).toBe('NewName')
  })

  it('does not render content when show=false', () => {
    const entries = makeEntries([{ key: 'Field', value: 'x' }])
    const wrapper = mountPanel({ entries, show: false })
    expect(wrapper.find('.detail-panel').exists()).toBe(false)
    expect(wrapper.find('.detail-entry').exists()).toBe(false)
  })

  it('renders empty when entries is []', () => {
    const wrapper = mountPanel({ entries: [], show: true })
    expect(wrapper.find('.detail-panel').exists()).toBe(false)
  })
})
