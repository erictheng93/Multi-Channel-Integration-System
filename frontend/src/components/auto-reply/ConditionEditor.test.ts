import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConditionEditor from './ConditionEditor.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Condition {
  conditionType: 'exact' | 'contains' | 'regex' | 'message_type'
  value: string
  caseSensitive: boolean
  matchMode: 'any' | 'all'
}

function makeCondition(overrides: Partial<Condition> = {}): Condition {
  return {
    conditionType: 'contains',
    value: 'hello',
    caseSensitive: false,
    matchMode: 'any',
    ...overrides,
  }
}

function mountEditor(conditions: Condition[] = []) {
  return mount(ConditionEditor, {
    props: { conditions },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('ConditionEditor -- rendering', () => {
  it('renders condition tags for each condition', () => {
    const conditions = [makeCondition(), makeCondition({ value: 'world' })]
    const wrapper = mountEditor(conditions)
    expect(wrapper.findAll('.condition-tag')).toHaveLength(2)
  })

  it('shows condition type label (contains -> includes Chinese label)', () => {
    const wrapper = mountEditor([makeCondition({ conditionType: 'contains' })])
    expect(wrapper.find('.condition-type-label').text()).toBe('包含')
  })

  it('shows exact match label for exact type', () => {
    const wrapper = mountEditor([makeCondition({ conditionType: 'exact' })])
    expect(wrapper.find('.condition-type-label').text()).toBe('完全匹配')
  })

  it('shows condition value text', () => {
    const wrapper = mountEditor([makeCondition({ value: 'test-keyword' })])
    expect(wrapper.find('.condition-value').text()).toBe('test-keyword')
  })

  it('shows empty state when conditions=[]', () => {
    const wrapper = mountEditor([])
    expect(wrapper.find('.condition-empty').exists()).toBe(true)
    expect(wrapper.find('.condition-empty').text()).toContain('尚未設定條件')
  })

  it('renders type selector with 4 options', () => {
    const wrapper = mountEditor()
    const options = wrapper.find('.condition-select').findAll('option')
    expect(options).toHaveLength(4)
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('ConditionEditor -- emitted events', () => {
  it('emits remove with index on remove button click', async () => {
    const conditions = [makeCondition(), makeCondition({ value: 'second' })]
    const wrapper = mountEditor(conditions)

    const removeButtons = wrapper.findAll('.condition-remove')
    await removeButtons[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([1])
  })

  it('emits add with type and value on add button click', async () => {
    const wrapper = mountEditor()

    // Set input value
    const input = wrapper.find('.condition-input-group input')
    await input.setValue('greeting')

    // Click add button
    await wrapper.find('.btn-add').trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['contains', 'greeting'])
  })

  it('clears input after adding', async () => {
    const wrapper = mountEditor()

    const input = wrapper.find('.condition-input-group input')
    await input.setValue('greeting')
    await wrapper.find('.btn-add').trigger('click')

    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('disables add button when input is empty', () => {
    const wrapper = mountEditor()
    const addBtn = wrapper.find('.btn-add')
    expect((addBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits add on Enter key press in input', async () => {
    const wrapper = mountEditor()

    const input = wrapper.find('.condition-input-group input')
    await input.setValue('enter-test')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['contains', 'enter-test'])
  })
})
