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
  it('renders action cards for each action', () => {
    const actions = [makeAction(), makeAction({ sortOrder: 1 })]
    const wrapper = mountEditor(actions)
    expect(wrapper.findAll('.action-card-new')).toHaveLength(2)
  })

  it('shows action type label badge (reply_text -> text label)', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    expect(wrapper.find('.badge').text()).toBe('文字')
  })

  it('shows empty state when actions=[]', () => {
    const wrapper = mountEditor([])
    expect(wrapper.find('.action-empty').exists()).toBe(true)
    expect(wrapper.find('.action-empty').text()).toContain('尚未設定動作')
  })

  it('renders cards in collapsed state by default (existing content)', () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')
    expect(card.classes()).not.toContain('editing')
    expect(card.find('.collapsed-preview').exists()).toBe(true)
  })

  it('shows preview text for reply_text in collapsed state', () => {
    const wrapper = mountEditor([makeAction({ content: JSON.stringify({ text: 'Hello World' }) })])
    expect(wrapper.find('.collapsed-preview').text()).toBe('Hello World')
  })

  it('shows preview url for reply_image in collapsed state', () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: 'https://example.com/img.jpg', previewUrl: '' }),
      }),
    ])
    expect(wrapper.find('.collapsed-preview').text()).toBe('https://example.com/img.jpg')
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
  it('expands card when clicking collapsed header', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')
    expect(card.classes()).not.toContain('editing')

    await card.find('.collapsed-header').trigger('click')
    expect(card.classes()).toContain('editing')
  })

  it('expands card when clicking edit icon button', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')
    await card.find('.btn-icon--edit').trigger('click')
    expect(card.classes()).toContain('editing')
  })

  it('collapses card when clicking confirm button', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')

    await card.find('.collapsed-header').trigger('click')
    expect(card.classes()).toContain('editing')

    await card.find('.btn-confirm').trigger('click')
    expect(card.classes()).not.toContain('editing')
  })

  it('collapses card when clicking cancel button', async () => {
    const wrapper = mountEditor([makeAction()])
    const card = wrapper.find('.action-card-new')

    await card.find('.collapsed-header').trigger('click')
    expect(card.classes()).toContain('editing')

    await card.find('.btn-cancel').trigger('click')
    expect(card.classes()).not.toContain('editing')
  })

  it('shows status-dot--done when collapsed', () => {
    const wrapper = mountEditor([makeAction()])
    expect(wrapper.find('.status-dot--done').exists()).toBe(true)
  })

  it('shows status-dot--editing when expanded', async () => {
    const wrapper = mountEditor([makeAction()])
    await wrapper.find('.collapsed-header').trigger('click')
    expect(wrapper.find('.status-dot--editing').exists()).toBe(true)
  })

  it('shows expanded-body with textarea when editing reply_text', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    await wrapper.find('.collapsed-header').trigger('click')
    expect(wrapper.find('.expanded-body .action-textarea').exists()).toBe(true)
  })

  it('shows expanded-body with inputs when editing reply_image', async () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: '', previewUrl: '' }),
      }),
    ])
    await wrapper.find('.collapsed-header').trigger('click')
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
    await wrapper.find('.collapsed-header').trigger('click')
    expect(wrapper.find('.expanded-body .action-textarea--json').exists()).toBe(true)
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('ActionEditor -- emitted events', () => {
  it('emits remove with index on delete button click', async () => {
    const wrapper = mountEditor([makeAction(), makeAction({ sortOrder: 1 })])
    const deleteButtons = wrapper.findAll('.btn-icon--delete')
    await deleteButtons[1]!.trigger('click')

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

    await wrapper.find('.collapsed-header').trigger('click')

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

    const cards = wrapper.findAll('.action-card-new')
    await cards[2]!.find('.collapsed-header').trigger('click')
    expect(cards[2]!.classes()).toContain('editing')

    await cards[0]!.find('.btn-icon--delete').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Third' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    const newCards = wrapper.findAll('.action-card-new')
    expect(newCards).toHaveLength(2)
    expect(newCards[1]!.classes()).toContain('editing')
    expect(newCards[0]!.classes()).not.toContain('editing')
  })

  it('removes editing state when the editing card itself is deleted', async () => {
    const actions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'First' }) }),
      makeAction({ sortOrder: 1, content: JSON.stringify({ text: 'Second' }) }),
    ]
    const wrapper = mountEditor(actions)

    const cards = wrapper.findAll('.action-card-new')
    await cards[0]!.find('.collapsed-header').trigger('click')
    expect(cards[0]!.classes()).toContain('editing')

    await wrapper.find('.btn-cancel').trigger('click')
    await cards[0]!.find('.btn-icon--delete').trigger('click')
    expect(wrapper.emitted('remove')![0]).toEqual([0])

    const updatedActions = [
      makeAction({ sortOrder: 0, content: JSON.stringify({ text: 'Second' }) }),
    ]
    await wrapper.setProps({ actions: updatedActions })

    const newCards = wrapper.findAll('.action-card-new')
    expect(newCards).toHaveLength(1)
    expect(newCards[0]!.classes()).not.toContain('editing')
  })
})
