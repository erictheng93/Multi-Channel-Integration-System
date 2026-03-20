import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionEditor from './ActionEditor.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Action {
  actionType: 'reply_text' | 'reply_image' | 'reply_flex'
  content: string
  sortOrder: number
}

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    actionType: 'reply_text',
    content: JSON.stringify({ text: 'Hello' }),
    sortOrder: 0,
    ...overrides,
  }
}

function mountEditor(actions: Action[] = []) {
  return mount(ActionEditor, {
    props: { actions },
  })
}

/** Find collapsed (non-editing) action rows */
function findCollapsedRows(wrapper: ReturnType<typeof mountEditor>) {
  return wrapper.findAll('.action-row:not(.action-row--editing)')
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('ActionEditor -- rendering', () => {
  it('renders action rows for each action', () => {
    const actions = [makeAction(), makeAction({ sortOrder: 1 })]
    const wrapper = mountEditor(actions)
    expect(findCollapsedRows(wrapper)).toHaveLength(2)
  })

  it('shows action type label in badge (reply_text -> text label)', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    expect(wrapper.find('.action-badge').text()).toBe('文字')
  })

  it('shows empty state when actions=[]', () => {
    const wrapper = mountEditor([])
    expect(wrapper.find('.action-empty').exists()).toBe(true)
    expect(wrapper.find('.action-empty').text()).toContain('尚未設定動作')
  })

  it('renders actions as rows by default (existing content)', () => {
    const wrapper = mountEditor([makeAction()])
    const rows = findCollapsedRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.find('.action-preview').exists()).toBe(true)
  })

  it('shows preview text for reply_text in row', () => {
    const wrapper = mountEditor([makeAction({ content: JSON.stringify({ text: 'Hello World' }) })])
    expect(wrapper.find('.action-preview').text()).toBe('Hello World')
  })

  it('shows preview url for reply_image in row', () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: 'https://example.com/img.jpg', previewUrl: '' }),
      }),
    ])
    expect(wrapper.find('.action-preview').text()).toBe('https://example.com/img.jpg')
  })

  it('applies correct type class to badge', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_image' })])
    expect(wrapper.find('.action-badge--reply_image').exists()).toBe(true)
  })

  it('shows step number in row', () => {
    const actions = [makeAction(), makeAction({ sortOrder: 1 })]
    const wrapper = mountEditor(actions)
    const steps = wrapper.findAll('.action-step')
    expect(steps[0]!.text()).toBe('1')
    expect(steps[1]!.text()).toBe('2')
  })

  it('hides dropdown by default', () => {
    const wrapper = mountEditor()
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)
  })

  it('shows dropdown menu with 3 options when open', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')
    const items = wrapper.findAll('.action-dropdown-item')
    expect(items).toHaveLength(3)
  })

  it('renders accent bar in each row', () => {
    const wrapper = mountEditor([makeAction()])
    expect(wrapper.find('.action-accent').exists()).toBe(true)
  })

  it('applies action type class to row for color theming', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_image' })])
    const row = findCollapsedRows(wrapper)[0]!
    expect(row.classes()).toContain('action-row--reply_image')
  })
})

// ===========================================================================
// Collapse / Expand behavior
// ===========================================================================

describe('ActionEditor -- collapse/expand', () => {
  it('expands to editing row when clicking collapsed row', async () => {
    const wrapper = mountEditor([makeAction()])
    expect(findCollapsedRows(wrapper)).toHaveLength(1)
    expect(wrapper.find('.action-row--editing').exists()).toBe(false)

    await findCollapsedRows(wrapper)[0]!.trigger('click')
    expect(findCollapsedRows(wrapper)).toHaveLength(0)
    expect(wrapper.find('.action-row--editing').exists()).toBe(true)
  })

  it('collapses back to row when clicking confirm button', async () => {
    const wrapper = mountEditor([makeAction()])

    await findCollapsedRows(wrapper)[0]!.trigger('click')
    expect(wrapper.find('.action-row--editing').exists()).toBe(true)

    await wrapper.find('.btn-confirm').trigger('click')
    expect(wrapper.find('.action-row--editing').exists()).toBe(false)
    expect(findCollapsedRows(wrapper)).toHaveLength(1)
  })

  it('collapses back to row when clicking cancel button', async () => {
    const wrapper = mountEditor([makeAction()])

    await findCollapsedRows(wrapper)[0]!.trigger('click')
    expect(wrapper.find('.action-row--editing').exists()).toBe(true)

    await wrapper.find('.btn-cancel').trigger('click')
    expect(wrapper.find('.action-row--editing').exists()).toBe(false)
    expect(findCollapsedRows(wrapper)).toHaveLength(1)
  })

  it('shows status-dot when expanded', async () => {
    const wrapper = mountEditor([makeAction()])
    await findCollapsedRows(wrapper)[0]!.trigger('click')
    expect(wrapper.find('.status-dot').exists()).toBe(true)
  })

  it('shows action-row-body with textarea when editing reply_text', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    await findCollapsedRows(wrapper)[0]!.trigger('click')
    expect(wrapper.find('.action-row-body .action-textarea').exists()).toBe(true)
  })

  it('shows action-row-body with inputs when editing reply_image', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: '', previewUrl: '' }),
      }),
    ])
    await findCollapsedRows(wrapper)[0]!.trigger('click')
    const inputs = wrapper.findAll('.action-row-body input[type="text"]')
    expect(inputs).toHaveLength(2)
  })

  it('shows action-row-body with JSON textarea when editing reply_flex', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_flex',
        content: JSON.stringify({ type: 'bubble' }),
      }),
    ])
    await findCollapsedRows(wrapper)[0]!.trigger('click')
    expect(wrapper.find('.action-row-body .action-textarea--json').exists()).toBe(true)
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('ActionEditor -- emitted events', () => {
  it('emits remove with index on row remove button click', async () => {
    const wrapper = mountEditor([makeAction(), makeAction({ sortOrder: 1 })])
    const removeButtons = wrapper.findAll('.action-row-remove')
    await removeButtons[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([1])
  })

  it('toggles dropdown on add button click', async () => {
    const wrapper = mountEditor()
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)

    await wrapper.find('.btn-add-action').trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(true)

    await wrapper.find('.btn-add-action').trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)
  })

  it('emits add with reply_text when selecting text option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[0]!.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_text'])
  })

  it('emits add with reply_image when selecting image option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[1]!.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_image'])
  })

  it('emits add with reply_flex when selecting flex option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[2]!.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_flex'])
  })

  it('closes dropdown after selecting action type', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(true)

    const items = wrapper.findAll('.action-dropdown-item')
    await items[0]!.trigger('click')
    expect(wrapper.find('.action-dropdown').exists()).toBe(false)
  })

  it('emits update-content when editing text content in expanded row', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])

    await findCollapsedRows(wrapper)[0]!.trigger('click')

    const textarea = wrapper.find('.action-row-body .action-textarea')
    const el = textarea.element as HTMLTextAreaElement
    el.value = 'new text'
    await textarea.trigger('input')

    expect(wrapper.emitted('update-content')).toBeTruthy()
    const payload = wrapper.emitted('update-content')![0]!
    expect(payload[0]).toBe(0)
    expect(JSON.parse(payload[1] as string)).toEqual({ text: 'new text' })
  })
})

// ===========================================================================
// Index management on delete
// ===========================================================================

describe('ActionEditor -- editing index recalculation', () => {
  it('shifts editing state down when a row before it is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 2, content: JSON.stringify({ text: 'Third' }) }),
    ]
    const wrapper = mountEditor(actions)

    // Expand row at index 2 by clicking it
    const rows = findCollapsedRows(wrapper)
    await rows[2]!.trigger('click')
    expect(wrapper.find('.action-row--editing').exists()).toBe(true)

    // Delete row at index 0 via its remove button
    // After expanding index 2, there are 2 collapsed rows (index 0, 1) and 1 editing row (index 2)
    const remainingRows = findCollapsedRows(wrapper)
    await remainingRows[0]!.find('.action-row-remove').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    // Simulate parent removing item 0
    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Third' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    // Row formerly at index 2 (now index 1) should still be editing
    expect(wrapper.find('.action-row--editing').exists()).toBe(true)
    expect(findCollapsedRows(wrapper)).toHaveLength(1)
  })

  it('removes editing state when the editing row itself is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
    ]
    const wrapper = mountEditor(actions)

    // Expand row at index 0
    const rows = findCollapsedRows(wrapper)
    await rows[0]!.trigger('click')
    expect(wrapper.find('.action-row--editing').exists()).toBe(true)

    // Cancel to collapse back to row, then delete
    await wrapper.find('.btn-cancel').trigger('click')
    const rowsAfterCancel = findCollapsedRows(wrapper)
    await rowsAfterCancel[0]!.find('.action-row-remove').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    // Simulate parent removing item 0
    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    // Remaining item should be a collapsed row, not editing
    expect(findCollapsedRows(wrapper)).toHaveLength(1)
    expect(wrapper.find('.action-row--editing').exists()).toBe(false)
  })
})
