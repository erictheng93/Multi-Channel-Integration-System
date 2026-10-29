import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReportChoiceGroup from '@/components/reports/ReportChoiceGroup.vue'

const options = [
  { value: 'a', label: 'Alpha', description: 'first' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
]

describe('ReportChoiceGroup.vue', () => {
  it('renders a radiogroup with the selected tile checked', () => {
    const wrapper = mount(ReportChoiceGroup, { props: { modelValue: 'b', options, label: '測試' } })
    expect(wrapper.find('[role="radiogroup"]').attributes('aria-label')).toBe('測試')
    const checked = wrapper.findAll('[role="radio"]').map(t => t.attributes('aria-checked'))
    expect(checked).toEqual(['false', 'true', 'false'])
    expect(wrapper.text()).toContain('first')
  })

  it('emits the clicked value', async () => {
    const wrapper = mount(ReportChoiceGroup, { props: { modelValue: null, options, label: '測試' } })
    await wrapper.findAll('[role="radio"]')[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['c'])
  })

  it('moves the selection with the arrow keys and wraps around', async () => {
    const wrapper = mount(ReportChoiceGroup, { props: { modelValue: 'c', options, label: '測試' } })
    await wrapper.findAll('[role="radio"]')[2]!.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['a'])
    await wrapper.findAll('[role="radio"]')[2]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['b'])
  })

  it('only the selected tile is in the tab order', () => {
    const wrapper = mount(ReportChoiceGroup, { props: { modelValue: 'b', options, label: '測試' } })
    expect(wrapper.findAll('[role="radio"]').map(t => t.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })
})
