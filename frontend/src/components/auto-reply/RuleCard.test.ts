import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import RuleCard from './RuleCard.vue'
import type { AutoReplyRule } from '@/api/autoReply'
import type { RuleFormData } from './RuleEditor.vue'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<AutoReplyRule> = {}): AutoReplyRule {
  return {
    id: 1,
    teamId: 1,
    name: 'Test Rule',
    triggerType: 'keyword',
    priority: 100,
    isActive: true,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    conditions: [
      { id: 1, conditionType: 'contains', value: 'hello', caseSensitive: false, matchMode: 'any' },
    ],
    actions: [
      { id: 1, actionType: 'reply_text', content: '{}', sortOrder: 0 },
      { id: 2, actionType: 'reply_text', content: '{}', sortOrder: 1 },
    ],
    ...overrides,
  }
}

const defaultFormData: RuleFormData = {
  name: '',
  triggerType: 'keyword',
  priority: 100,
  isActive: true,
  conditions: [],
  actions: [],
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mountRuleCard(overrides: {
  rule?: AutoReplyRule
  isExpanded?: boolean
  formData?: RuleFormData
  saving?: boolean
} = {}) {
  return shallowMount(RuleCard, {
    props: {
      rule: overrides.rule ?? makeRule(),
      isExpanded: overrides.isExpanded ?? false,
      formData: overrides.formData ?? defaultFormData,
      saving: overrides.saving ?? false,
    },
    global: {
      stubs: {
        RuleEditor: { template: '<div class="stub-rule-editor" />' },
      },
    },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('RuleCard -- rendering', () => {
  it('renders rule name in .rule-card__name', () => {
    const wrapper = mountRuleCard({ rule: makeRule({ name: 'My Rule' }) })
    expect(wrapper.find('.rule-card__name').text()).toBe('My Rule')
  })

  it('renders trigger type badge with correct label (keyword -> 關鍵字)', () => {
    const wrapper = mountRuleCard({ rule: makeRule({ triggerType: 'keyword' }) })
    expect(wrapper.find('.rule-card__trigger-badge').text()).toBe('關鍵字')
  })

  it('renders priority badge with P prefix', () => {
    const wrapper = mountRuleCard({ rule: makeRule({ priority: 50 }) })
    expect(wrapper.find('.rule-card__priority-badge').text()).toBe('P50')
  })

  it('renders condition and action counts in meta', () => {
    const rule = makeRule()
    // 1 condition, 2 actions from fixture
    const wrapper = mountRuleCard({ rule })
    const meta = wrapper.find('.rule-card__meta').text()
    expect(meta).toContain('1')
    expect(meta).toContain('2')
  })

  it('applies rule-card--expanded class when expanded', () => {
    const wrapper = mountRuleCard({ isExpanded: true })
    expect(wrapper.find('.rule-card').classes()).toContain('rule-card--expanded')
  })

  it('does not apply rule-card--expanded class when collapsed', () => {
    const wrapper = mountRuleCard({ isExpanded: false })
    expect(wrapper.find('.rule-card').classes()).not.toContain('rule-card--expanded')
  })

  it('shows down arrow when expanded', () => {
    const wrapper = mountRuleCard({ isExpanded: true })
    // U+25BC = down arrow
    expect(wrapper.find('.rule-card__arrow').text()).toBe('\u25BC')
  })

  it('shows right arrow when collapsed', () => {
    const wrapper = mountRuleCard({ isExpanded: false })
    // U+25B6 = right arrow
    expect(wrapper.find('.rule-card__arrow').text()).toBe('\u25B6')
  })

  it('shows RuleEditor when isExpanded is true', () => {
    const wrapper = mountRuleCard({ isExpanded: true })
    expect(wrapper.find('.stub-rule-editor').exists()).toBe(true)
  })

  it('hides RuleEditor when isExpanded is false', () => {
    const wrapper = mountRuleCard({ isExpanded: false })
    expect(wrapper.find('.stub-rule-editor').exists()).toBe(false)
  })

  it('renders active toggle with active class when rule.isActive', () => {
    const wrapper = mountRuleCard({ rule: makeRule({ isActive: true }) })
    expect(wrapper.find('.rule-card__toggle').classes()).toContain('rule-card__toggle--active')
  })

  it('renders inactive toggle without active class', () => {
    const wrapper = mountRuleCard({ rule: makeRule({ isActive: false }) })
    expect(wrapper.find('.rule-card__toggle').classes()).not.toContain('rule-card__toggle--active')
  })
})

// ===========================================================================
// Emitted events
// ===========================================================================

describe('RuleCard -- emitted events', () => {
  it('emits toggle-expand on header click', async () => {
    const wrapper = mountRuleCard()
    await wrapper.find('.rule-card__header').trigger('click')
    expect(wrapper.emitted('toggle-expand')).toBeTruthy()
    expect(wrapper.emitted('toggle-expand')).toHaveLength(1)
  })

  it('emits toggle-active on toggle click', async () => {
    const wrapper = mountRuleCard()
    await wrapper.find('.rule-card__toggle').trigger('click')
    expect(wrapper.emitted('toggle-active')).toBeTruthy()
    expect(wrapper.emitted('toggle-active')).toHaveLength(1)
  })
})
