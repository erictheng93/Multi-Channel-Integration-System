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

// ===========================================================================
// Rendering
// ===========================================================================

describe('ActionEditor -- rendering', () => {
  it('renders action tags for each action', () => {
    const actions = [makeAction(), makeAction({ sortOrder: 1 })]
    const wrapper = mountEditor(actions)
    expect(wrapper.findAll('.action-tag')).toHaveLength(2)
  })

  it('shows action type label in tag (reply_text -> text label)', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    expect(wrapper.find('.action-type-label').text()).toBe('文字')
  })

  it('shows empty state when actions=[]', () => {
    const wrapper = mountEditor([])
    expect(wrapper.find('.action-empty').exists()).toBe(true)
    expect(wrapper.find('.action-empty').text()).toContain('尚未設定動作')
  })

  it('renders actions as tag pills by default (existing content)', () => {
    const wrapper = mountEditor([makeAction()])
    const tag = wrapper.find('.action-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.find('.action-value').exists()).toBe(true)
  })

  it('shows preview text for reply_text in tag', () => {
    const wrapper = mountEditor([makeAction({ content: JSON.stringify({ text: 'Hello World' }) })])
    expect(wrapper.find('.action-value').text()).toBe('Hello World')
  })

  it('shows preview url for reply_image in tag', () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: 'https://example.com/img.jpg', previewUrl: '' }),
      }),
    ])
    expect(wrapper.find('.action-value').text()).toBe('https://example.com/img.jpg')
  })

  it('applies correct type class to tag', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_image' })])
    expect(wrapper.find('.action-tag--reply_image').exists()).toBe(true)
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
})

// ===========================================================================
// Collapse / Expand behavior
// ===========================================================================

describe('ActionEditor -- collapse/expand', () => {
  it('expands to editing card when clicking tag', async () => {
    const wrapper = mountEditor([makeAction()])
    expect(wrapper.find('.action-tag').exists()).toBe(true)
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(false)

    await wrapper.find('.action-tag').trigger('click')
    expect(wrapper.find('.action-tag').exists()).toBe(false)
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(true)
  })

  it('collapses back to tag when clicking confirm button', async () => {
    const wrapper = mountEditor([makeAction()])

    await wrapper.find('.action-tag').trigger('click')
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(true)

    await wrapper.find('.btn-confirm').trigger('click')
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(false)
    expect(wrapper.find('.action-tag').exists()).toBe(true)
  })

  it('collapses back to tag when clicking cancel button', async () => {
    const wrapper = mountEditor([makeAction()])

    await wrapper.find('.action-tag').trigger('click')
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(true)

    await wrapper.find('.btn-cancel').trigger('click')
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(false)
    expect(wrapper.find('.action-tag').exists()).toBe(true)
  })

  it('shows status-dot--editing when expanded', async () => {
    const wrapper = mountEditor([makeAction()])
    await wrapper.find('.action-tag').trigger('click')
    expect(wrapper.find('.status-dot--editing').exists()).toBe(true)
  })

  it('shows expanded-body with textarea when editing reply_text', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    await wrapper.find('.action-tag').trigger('click')
    expect(wrapper.find('.expanded-body .action-textarea').exists()).toBe(true)
  })

  it('shows expanded-body with inputs when editing reply_image', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: '', previewUrl: '' }),
      }),
    ])
    await wrapper.find('.action-tag').trigger('click')
    const inputs = wrapper.findAll('.expanded-body input[type="text"]')
    expect(inputs).toHaveLength(2)
  })

  it('shows expanded-body with JSON textarea when editing reply_flex', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_flex',
        content: JSON.stringify({ type: 'bubble' }),
      }),
    ])
    await wrapper.find('.action-tag').trigger('click')
    expect(wrapper.find('.expanded-body .action-textarea--json').exists()).toBe(true)
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('ActionEditor -- emitted events', () => {
  it('emits remove with index on tag remove button click', async () => {
    const wrapper = mountEditor([makeAction(), makeAction({ sortOrder: 1 })])
    const removeButtons = wrapper.findAll('.action-remove')
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

  it('emits update-content when editing text content in expanded card', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])

    await wrapper.find('.action-tag').trigger('click')

    const textarea = wrapper.find('.expanded-body .action-textarea')
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
  it('shifts editing state down when a card before it is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 2, content: JSON.stringify({ text: 'Third' }) }),
    ]
    const wrapper = mountEditor(actions)

    // Expand card at index 2 by clicking its tag
    const tags = wrapper.findAll('.action-tag')
    await tags[2]!.trigger('click')
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(true)

    // Delete card at index 0 via its tag remove button
    // After expanding index 2, there are 2 tags (index 0, 1) and 1 card (index 2)
    const remainingTags = wrapper.findAll('.action-tag')
    await remainingTags[0]!.find('.action-remove').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    // Simulate parent removing item 0
    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Third' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    // Card formerly at index 2 (now index 1) should still be editing
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(true)
    expect(wrapper.findAll('.action-tag')).toHaveLength(1)
  })

  it('removes editing state when the editing card itself is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
    ]
    const wrapper = mountEditor(actions)

    // Expand card at index 0
    const tags = wrapper.findAll('.action-tag')
    await tags[0]!.trigger('click')
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(true)

    // Cancel to collapse back to tag, then delete
    await wrapper.find('.btn-cancel').trigger('click')
    const tagsAfterCancel = wrapper.findAll('.action-tag')
    await tagsAfterCancel[0]!.find('.action-remove').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    // Simulate parent removing item 0
    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    // Remaining item should be a tag, not editing
    expect(wrapper.findAll('.action-tag')).toHaveLength(1)
    expect(wrapper.find('.action-card-new.editing').exists()).toBe(false)
  })
})
