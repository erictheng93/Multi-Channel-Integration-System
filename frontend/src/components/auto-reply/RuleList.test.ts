import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import RuleList from './RuleList.vue'
import type { AutoReplyRule } from '@/api/autoReply'
import type { RuleFormData } from './RuleEditor.vue'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockRule: AutoReplyRule = {
  id: 1,
  teamId: 1,
  name: 'Test',
  triggerType: 'keyword' as const,
  priority: 100,
  isActive: true,
  allowPushFallback: false,
  createdBy: null,
  createdAt: null,
  updatedAt: null,
  deletedAt: null,
  conditions: [],
  actions: [],
}

const defaultFormData: RuleFormData = {
  name: '',
  triggerType: 'keyword' as const,
  priority: 100,
  isActive: true,
  allowPushFallback: false,
  conditions: [],
  actions: [],
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mountRuleList(overrides: {
  rules?: AutoReplyRule[]
  expandedRuleId?: number | null
  isCreating?: boolean
  formData?: RuleFormData
  saving?: boolean
  searchQuery?: string
  filterTriggerType?: string
} = {}) {
  return shallowMount(RuleList, {
    props: {
      rules: overrides.rules ?? [],
      expandedRuleId: overrides.expandedRuleId ?? null,
      isCreating: overrides.isCreating ?? false,
      formData: overrides.formData ?? defaultFormData,
      saving: overrides.saving ?? false,
      searchQuery: overrides.searchQuery ?? '',
      filterTriggerType: overrides.filterTriggerType ?? '',
    },
    global: {
      stubs: {
        RuleEditor: { template: '<div class="stub-rule-editor" />' },
        RuleCard: { template: '<div class="stub-rule-card" />' },
      },
    },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('RuleList -- rendering', () => {
  it('renders search input with searchQuery value', () => {
    const wrapper = mountRuleList({ searchQuery: 'hello' })
    const input = wrapper.find('.rule-list__search')
    expect((input.element as HTMLInputElement).value).toBe('hello')
  })

  it('renders filter select with filterTriggerType value', () => {
    const wrapper = mountRuleList({ filterTriggerType: 'keyword' })
    const select = wrapper.find('.rule-list__filter-select')
    expect((select.element as HTMLSelectElement).value).toBe('keyword')
  })

  it('renders create button', () => {
    const wrapper = mountRuleList()
    const btn = wrapper.find('.btn-primary')
    expect(btn.exists()).toBe(true)
  })

  it('renders RuleCard for each rule', () => {
    const rules = [
      { ...mockRule, id: 1 },
      { ...mockRule, id: 2, name: 'Rule 2' },
    ]
    const wrapper = mountRuleList({ rules })
    const cards = wrapper.findAll('.stub-rule-card')
    expect(cards).toHaveLength(2)
  })

  it('shows empty state when rules=[] and isCreating=false', () => {
    const wrapper = mountRuleList({ rules: [], isCreating: false })
    expect(wrapper.find('.rule-list__empty').exists()).toBe(true)
  })

  it('empty state has create button', () => {
    const wrapper = mountRuleList({ rules: [], isCreating: false })
    const emptyBtn = wrapper.find('.rule-list__empty .btn-primary')
    expect(emptyBtn.exists()).toBe(true)
  })

  it('shows new rule editor when isCreating=true', () => {
    const wrapper = mountRuleList({ isCreating: true })
    expect(wrapper.find('.rule-list__new-card').exists()).toBe(true)
    expect(wrapper.find('.stub-rule-editor').exists()).toBe(true)
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('RuleList -- emitted events', () => {
  it('emits start-create on create button click', async () => {
    const wrapper = mountRuleList()
    await wrapper.find('.rule-list__toolbar .btn-primary').trigger('click')
    expect(wrapper.emitted('start-create')).toBeTruthy()
    expect(wrapper.emitted('start-create')).toHaveLength(1)
  })

  it('emits update:searchQuery on search input', async () => {
    const wrapper = mountRuleList({ searchQuery: '' })
    const input = wrapper.find('.rule-list__search')
    await input.setValue('test')
    expect(wrapper.emitted('update:searchQuery')).toBeTruthy()
  })

  it('emits update:filterTriggerType on filter change', async () => {
    const wrapper = mountRuleList({ filterTriggerType: '' })
    const select = wrapper.find('.rule-list__filter-select')
    await select.setValue('keyword')
    expect(wrapper.emitted('update:filterTriggerType')).toBeTruthy()
  })
})
