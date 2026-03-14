import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockCreateRule = vi.fn()
const mockUpdateRule = vi.fn()
const mockDeleteRule = vi.fn()
vi.mock('@/api/autoReply', () => ({
  createRule: (...args: unknown[]) => mockCreateRule(...args),
  updateRule: (...args: unknown[]) => mockUpdateRule(...args),
  deleteRule: (...args: unknown[]) => mockDeleteRule(...args),
}))

const mockFetchRules = vi.fn()
vi.mock('@/stores/autoReply', () => ({
  useAutoReplyStore: () => ({
    fetchRules: mockFetchRules,
  }),
}))

import { useRuleEditor } from './useRuleEditor'

const mockRule = {
  id: 1,
  teamId: 1,
  name: 'Test Rule',
  triggerType: 'keyword' as const,
  priority: 100,
  isActive: true,
  createdBy: null,
  createdAt: null,
  updatedAt: null,
  deletedAt: null,
  conditions: [
    {
      id: 1,
      conditionType: 'contains' as const,
      value: 'hello',
      caseSensitive: false,
      matchMode: 'any' as const,
    },
  ],
  actions: [
    {
      id: 1,
      actionType: 'reply_text' as const,
      content: '{"text":"Hi"}',
      sortOrder: 0,
    },
  ],
}

describe('useRuleEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCreateRule.mockResolvedValue({})
    mockUpdateRule.mockResolvedValue({})
    mockDeleteRule.mockResolvedValue({})
    mockFetchRules.mockResolvedValue(undefined)
  })

  it('has correct initial state', () => {
    const { expandedRuleId, isCreating, saving, formData } = useRuleEditor()

    expect(expandedRuleId.value).toBeNull()
    expect(isCreating.value).toBe(false)
    expect(saving.value).toBe(false)
    expect(formData.name).toBe('')
    expect(formData.triggerType).toBe('keyword')
    expect(formData.priority).toBe(100)
    expect(formData.isActive).toBe(true)
    expect(formData.conditions).toEqual([])
    expect(formData.actions).toEqual([])
  })

  it('startCreate sets isCreating true and resets form', () => {
    const { isCreating, expandedRuleId, formData, startCreate, expandRule } =
      useRuleEditor()

    // First expand a rule to populate state
    expandRule(mockRule)
    expect(expandedRuleId.value).toBe(1)

    startCreate()

    expect(isCreating.value).toBe(true)
    expect(expandedRuleId.value).toBeNull()
    expect(formData.name).toBe('')
    expect(formData.conditions).toEqual([])
    expect(formData.actions).toEqual([])
  })

  it('expandRule sets expandedRuleId and populates form from rule', () => {
    const { expandedRuleId, isCreating, formData, expandRule } =
      useRuleEditor()

    expandRule(mockRule)

    expect(expandedRuleId.value).toBe(1)
    expect(isCreating.value).toBe(false)
    expect(formData.name).toBe('Test Rule')
    expect(formData.triggerType).toBe('keyword')
    expect(formData.priority).toBe(100)
    expect(formData.isActive).toBe(true)
    expect(formData.conditions).toHaveLength(1)
    expect(formData.conditions[0]!.conditionType).toBe('contains')
    expect(formData.conditions[0]!.value).toBe('hello')
    expect(formData.actions).toHaveLength(1)
    expect(formData.actions[0]!.actionType).toBe('reply_text')
    expect(formData.actions[0]!.content).toBe('{"text":"Hi"}')
  })

  it('expandRule on same rule collapses (toggles)', () => {
    const { expandedRuleId, formData, expandRule } = useRuleEditor()

    expandRule(mockRule)
    expect(expandedRuleId.value).toBe(1)

    expandRule(mockRule)
    expect(expandedRuleId.value).toBeNull()
    expect(formData.name).toBe('')
  })

  it('collapseRule resets all state', () => {
    const { expandedRuleId, isCreating, formData, expandRule, collapseRule } =
      useRuleEditor()

    expandRule(mockRule)
    collapseRule()

    expect(expandedRuleId.value).toBeNull()
    expect(isCreating.value).toBe(false)
    expect(formData.name).toBe('')
    expect(formData.conditions).toEqual([])
    expect(formData.actions).toEqual([])
  })

  it('addCondition pushes to conditions with trimmed value', () => {
    const { formData, addCondition } = useRuleEditor()

    addCondition('contains', '  hello world  ')

    expect(formData.conditions).toHaveLength(1)
    expect(formData.conditions[0]).toEqual({
      conditionType: 'contains',
      value: 'hello world',
      caseSensitive: false,
      matchMode: 'any',
    })
  })

  it('addCondition with empty value does nothing', () => {
    const { formData, addCondition } = useRuleEditor()

    addCondition('contains', '')
    addCondition('contains', '   ')

    expect(formData.conditions).toHaveLength(0)
  })

  it('removeCondition splices at given index', () => {
    const { formData, addCondition, removeCondition } = useRuleEditor()

    addCondition('contains', 'first')
    addCondition('exact', 'second')
    addCondition('regex', 'third')

    removeCondition(1)

    expect(formData.conditions).toHaveLength(2)
    expect(formData.conditions[0]!.value).toBe('first')
    expect(formData.conditions[1]!.value).toBe('third')
  })

  it('addAction pushes with default content from map', () => {
    const { formData, addAction } = useRuleEditor()

    addAction('reply_text')
    addAction('reply_image')

    expect(formData.actions).toHaveLength(2)
    expect(formData.actions[0]!.actionType).toBe('reply_text')
    expect(formData.actions[0]!.content).toBe(JSON.stringify({ text: '' }))
    expect(formData.actions[0]!.sortOrder).toBe(0)
    expect(formData.actions[1]!.actionType).toBe('reply_image')
    expect(formData.actions[1]!.content).toBe(
      JSON.stringify({ url: '', previewUrl: '' }),
    )
    expect(formData.actions[1]!.sortOrder).toBe(1)
  })

  it('removeAction splices and re-indexes sortOrder', () => {
    const { formData, addAction, removeAction } = useRuleEditor()

    addAction('reply_text')
    addAction('reply_image')
    addAction('reply_flex')

    removeAction(0)

    expect(formData.actions).toHaveLength(2)
    expect(formData.actions[0]!.actionType).toBe('reply_image')
    expect(formData.actions[0]!.sortOrder).toBe(0)
    expect(formData.actions[1]!.actionType).toBe('reply_flex')
    expect(formData.actions[1]!.sortOrder).toBe(1)
  })

  it('saveRule in create mode calls createRule, fetchRules, collapses, returns true', async () => {
    const { formData, startCreate, saveRule, isCreating, expandedRuleId } =
      useRuleEditor()

    startCreate()
    formData.name = 'New Rule'
    formData.triggerType = 'keyword'

    const result = await saveRule()

    expect(result).toBe(true)
    expect(mockCreateRule).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Rule', triggerType: 'keyword' }),
    )
    expect(mockFetchRules).toHaveBeenCalled()
    expect(isCreating.value).toBe(false)
    expect(expandedRuleId.value).toBeNull()
  })

  it('saveRule in update mode calls updateRule with expandedRuleId, returns true', async () => {
    const { expandRule, saveRule, formData } = useRuleEditor()

    expandRule(mockRule)
    formData.name = 'Updated Rule'

    const result = await saveRule()

    expect(result).toBe(true)
    expect(mockUpdateRule).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'Updated Rule' }),
    )
    expect(mockFetchRules).toHaveBeenCalled()
  })

  it('saveRule with empty name returns false without API call', async () => {
    const { startCreate, formData, saveRule } = useRuleEditor()

    startCreate()
    formData.name = '   '

    const result = await saveRule()

    expect(result).toBe(false)
    expect(mockCreateRule).not.toHaveBeenCalled()
    expect(mockUpdateRule).not.toHaveBeenCalled()
  })

  it('removeRule calls deleteRule, fetchRules, returns true', async () => {
    const { removeRule } = useRuleEditor()

    const result = await removeRule(42)

    expect(result).toBe(true)
    expect(mockDeleteRule).toHaveBeenCalledWith(42)
    expect(mockFetchRules).toHaveBeenCalled()
  })

  it('toggleRuleActive calls updateRule with toggled isActive', async () => {
    const { toggleRuleActive } = useRuleEditor()

    const result = await toggleRuleActive(mockRule)

    expect(result).toBe(true)
    expect(mockUpdateRule).toHaveBeenCalledWith(1, { isActive: false })
    expect(mockFetchRules).toHaveBeenCalled()
  })
})
