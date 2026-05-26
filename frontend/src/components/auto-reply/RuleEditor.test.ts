import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import RuleEditor from './RuleEditor.vue'
import type { RuleFormData } from './RuleEditor.vue'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFormData(overrides: Partial<RuleFormData> = {}): RuleFormData {
  return {
    name: 'Test Rule',
    triggerType: 'keyword',
    priority: 100,
    isActive: true,
    allowPushFallback: false,
    conditions: [],
    actions: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mountEditor(overrides: {
  formData?: RuleFormData
  saving?: boolean
  isNew?: boolean
} = {}) {
  return shallowMount(RuleEditor, {
    props: {
      formData: overrides.formData ?? makeFormData(),
      saving: overrides.saving ?? false,
      isNew: overrides.isNew ?? false,
    },
    global: {
      stubs: {
        ConditionEditor: { template: '<div class="stub-condition-editor" />' },
        ActionEditor: { template: '<div class="stub-action-editor" />' },
      },
    },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('RuleEditor -- rendering', () => {
  it('renders rule name input with formData.name', () => {
    const wrapper = mountEditor({ formData: makeFormData({ name: 'My Rule' }) })
    const input = wrapper.find('.rule-editor__name input')
    expect((input.element as HTMLInputElement).value).toBe('My Rule')
  })

  it('renders trigger type select with formData.triggerType', () => {
    const wrapper = mountEditor({ formData: makeFormData({ triggerType: 'welcome' }) })
    const select = wrapper.find('.rule-editor__trigger select')
    expect((select.element as HTMLSelectElement).value).toBe('welcome')
  })

  it('renders priority input with formData.priority', () => {
    const wrapper = mountEditor({ formData: makeFormData({ priority: 50 }) })
    const input = wrapper.find('.rule-editor__priority input')
    expect((input.element as HTMLInputElement).value).toBe('50')
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('RuleEditor -- emitted events', () => {
  it('emits save on save button click', async () => {
    const wrapper = mountEditor()
    const saveBtn = wrapper.find('.btn-primary')
    await saveBtn.trigger('click')
    expect(wrapper.emitted('save')).toBeTruthy()
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('emits cancel on cancel button click', async () => {
    const wrapper = mountEditor()
    const cancelBtn = wrapper.find('.btn-secondary')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits delete on delete button click when isNew=false', async () => {
    const wrapper = mountEditor({ isNew: false })
    const deleteBtn = wrapper.find('.rule-editor__delete-btn')
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('emits update-field with allowPushFallback=true when toggle is clicked from off', async () => {
    const wrapper = mountEditor({ formData: makeFormData({ allowPushFallback: false }) })
    const toggle = wrapper.find('.rule-editor__toggle')
    await toggle.trigger('click')
    const updates = wrapper.emitted('update-field') as unknown[][]
    expect(updates).toBeTruthy()
    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual(['allowPushFallback', true])
  })

  it('emits update-field with allowPushFallback=false when toggle is clicked from on', async () => {
    const wrapper = mountEditor({ formData: makeFormData({ allowPushFallback: true }) })
    const toggle = wrapper.find('.rule-editor__toggle')
    await toggle.trigger('click')
    const updates = wrapper.emitted('update-field') as unknown[][]
    expect(updates).toBeTruthy()
    expect(updates[0]).toEqual(['allowPushFallback', false])
  })

  it('toggle has aria-pressed reflecting current state', () => {
    const wrapperOff = mountEditor({ formData: makeFormData({ allowPushFallback: false }) })
    expect(wrapperOff.find('.rule-editor__toggle').attributes('aria-pressed')).toBe('false')

    const wrapperOn = mountEditor({ formData: makeFormData({ allowPushFallback: true }) })
    expect(wrapperOn.find('.rule-editor__toggle').attributes('aria-pressed')).toBe('true')
  })

  it('toggle gains --active modifier class when allowPushFallback=true', () => {
    const wrapper = mountEditor({ formData: makeFormData({ allowPushFallback: true }) })
    expect(wrapper.find('.rule-editor__toggle').classes()).toContain('rule-editor__toggle--active')
  })
})

// ===========================================================================
// Delete button visibility
// ===========================================================================

describe('RuleEditor -- delete button visibility', () => {
  it('hides delete button when isNew=true', () => {
    const wrapper = mountEditor({ isNew: true })
    expect(wrapper.find('.rule-editor__delete-btn').exists()).toBe(false)
  })

  it('shows delete button when isNew=false', () => {
    const wrapper = mountEditor({ isNew: false })
    expect(wrapper.find('.rule-editor__delete-btn').exists()).toBe(true)
  })
})

// ===========================================================================
// Saving state
// ===========================================================================

describe('RuleEditor -- saving state', () => {
  it('disables save button when saving=true', () => {
    const wrapper = mountEditor({ saving: true })
    const saveBtn = wrapper.find('.btn-primary')
    expect((saveBtn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows saving text when saving=true', () => {
    const wrapper = mountEditor({ saving: true })
    const saveBtn = wrapper.find('.btn-primary')
    expect(saveBtn.text()).toBe('儲存中...')
  })
})
