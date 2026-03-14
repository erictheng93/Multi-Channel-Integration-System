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
    expect(wrapper.findAll('.action-card')).toHaveLength(2)
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

  it('renders textarea for reply_text action', () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    expect(wrapper.find('.action-textarea').exists()).toBe(true)
  })

  it('renders url inputs for reply_image action (2 inputs)', () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_image',
        content: JSON.stringify({ url: '', previewUrl: '' }),
      }),
    ])
    const inputs = wrapper.findAll('.action-body input[type="text"]')
    expect(inputs).toHaveLength(2)
  })

  it('renders JSON textarea for reply_flex action', () => {
    const wrapper = mountEditor([
      makeAction({
        actionType: 'reply_flex',
        content: JSON.stringify({ type: 'bubble' }),
      }),
    ])
    expect(wrapper.find('.action-textarea--json').exists()).toBe(true)
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
// Emitted events
// ===========================================================================

describe('ActionEditor -- emitted events', () => {
  it('emits remove with index on delete button click', async () => {
    const wrapper = mountEditor([makeAction(), makeAction({ sortOrder: 1 })])
    const deleteButtons = wrapper.findAll('.btn-danger')
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
    await items[0]!.trigger('click') // first item = text

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_text'])
  })

  it('emits add with reply_image when selecting image option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[1]!.trigger('click') // second item = image

    expect(wrapper.emitted('add')).toBeTruthy()
    expect(wrapper.emitted('add')![0]).toEqual(['reply_image'])
  })

  it('emits add with reply_flex when selecting flex option', async () => {
    const wrapper = mountEditor()
    await wrapper.find('.btn-add-action').trigger('click')

    const items = wrapper.findAll('.action-dropdown-item')
    await items[2]!.trigger('click') // third item = flex

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

  it('emits update-content when editing text content', async () => {
    const wrapper = mountEditor([makeAction({ actionType: 'reply_text' })])
    const textarea = wrapper.find('.action-textarea')

    // Trigger input event with a new value
    const el = textarea.element as HTMLTextAreaElement
    el.value = 'new text'
    await textarea.trigger('input')

    expect(wrapper.emitted('update-content')).toBeTruthy()
    const payload = wrapper.emitted('update-content')![0]!
    expect(payload[0]).toBe(0) // index
    expect(JSON.parse(payload[1] as string)).toEqual({ text: 'new text' })
  })
})
