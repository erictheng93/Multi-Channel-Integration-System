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
    allowPushFallback: false,
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
  allowPushFallback: false,
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
  hits?: number | null
  hitsMax?: number
} = {}) {
  return shallowMount(RuleCard, {
    props: {
      rule: overrides.rule ?? makeRule(),
      isExpanded: overrides.isExpanded ?? false,
      formData: overrides.formData ?? defaultFormData,
      saving: overrides.saving ?? false,
      hits: overrides.hits ?? null,
      hitsMax: overrides.hitsMax ?? 0,
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

  it('renders priority as the numbered rung', () => {
    const wrapper = mountRuleCard({ rule: makeRule({ priority: 50 }) })
    expect(wrapper.find('.rule-card__rung').text()).toBe('50')
  })

  it('keeps the condition and action counts in the priority tooltip', () => {
    const rule = makeRule()
    // 1 condition, 2 actions from fixture
    const wrapper = mountRuleCard({ rule })
    const title = wrapper.find('.rule-card__rung').attributes('title') ?? ''
    expect(title).toContain('1 個條件')
    expect(title).toContain('2 個動作')
  })

  it('shows how often the rule fired when hit counts are known', () => {
    const wrapper = mountRuleCard({ rule: makeRule(), hits: 7, hitsMax: 14 })
    expect(wrapper.find('.rule-card__hits b').text()).toBe('7')
  })

  it('shows no hit count while the log view is filtered (hits unknown)', () => {
    const wrapper = mountRuleCard({ rule: makeRule() })
    expect(wrapper.find('.rule-card__hits').exists()).toBe(false)
  })

  it('applies rule-card--expanded class when expanded', () => {
    const wrapper = mountRuleCard({ isExpanded: true })
    expect(wrapper.find('.rule-card').classes()).toContain('rule-card--expanded')
  })

  it('does not apply rule-card--expanded class when collapsed', () => {
    const wrapper = mountRuleCard({ isExpanded: false })
    expect(wrapper.find('.rule-card').classes()).not.toContain('rule-card--expanded')
  })

  it('rotates the chevron when expanded', () => {
    const wrapper = mountRuleCard({ isExpanded: true })
    expect(wrapper.find('.rule-card__arrow svg').exists()).toBe(true)
    expect(wrapper.find('.rule-card__arrow').classes()).toContain('is-open')
  })

  it('keeps the chevron closed when collapsed', () => {
    const wrapper = mountRuleCard({ isExpanded: false })
    expect(wrapper.find('.rule-card__arrow').classes()).not.toContain('is-open')
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
