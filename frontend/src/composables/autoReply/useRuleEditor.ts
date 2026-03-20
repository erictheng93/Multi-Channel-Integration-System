import { ref, reactive } from 'vue'
import type { AutoReplyRule, CreateRuleRequest, UpdateRuleRequest } from '@/api/autoReply'
import { createRule, updateRule, deleteRule } from '@/api/autoReply'
import { useAutoReplyStore } from '@/stores/autoReply'

interface RuleFormData {
  name: string
  triggerType: 'welcome' | 'keyword' | 'off_hours' | 'fallback'
  priority: number
  isActive: boolean
  conditions: Array<{
    conditionType: 'exact' | 'contains' | 'regex' | 'message_type'
    value: string
    caseSensitive: boolean
    matchMode: 'any' | 'all'
  }>
  actions: Array<{
    actionType: 'reply_text' | 'reply_image' | 'reply_flex'
    content: string
    sortOrder: number
  }>
}

export function useRuleEditor() {
  const store = useAutoReplyStore()
  const expandedRuleId = ref<number | null>(null)
  const isCreating = ref(false)
  const saving = ref(false)
  const formData = reactive<RuleFormData>(getEmptyForm())

  function getEmptyForm(): RuleFormData {
    return {
      name: '',
      triggerType: 'keyword',
      priority: 100,
      isActive: true,
      conditions: [],
      actions: []
    }
  }

  function resetForm() {
    Object.assign(formData, getEmptyForm())
  }

  function expandRule(rule: AutoReplyRule) {
    if (expandedRuleId.value === rule.id) {
      collapseRule()
      return
    }
    isCreating.value = false
    expandedRuleId.value = rule.id
    // Populate form from rule
    formData.name = rule.name
    formData.triggerType = rule.triggerType
    formData.priority = rule.priority
    formData.isActive = rule.isActive
    formData.conditions = rule.conditions.map(c => ({
      conditionType: c.conditionType,
      value: c.value,
      caseSensitive: c.caseSensitive,
      matchMode: c.matchMode
    }))
    formData.actions = rule.actions.map(a => ({
      actionType: a.actionType,
      content: a.content,
      sortOrder: a.sortOrder
    }))
  }

  function collapseRule() {
    expandedRuleId.value = null
    isCreating.value = false
    resetForm()
  }

  function startCreate() {
    expandedRuleId.value = null
    isCreating.value = true
    resetForm()
  }

  // Condition management
  function addCondition(conditionType: 'exact' | 'contains' | 'regex' | 'message_type', value: string) {
    if (!value.trim()) {return}
    formData.conditions.push({
      conditionType,
      value: value.trim(),
      caseSensitive: false,
      matchMode: 'any'
    })
  }

  function removeCondition(index: number) {
    formData.conditions.splice(index, 1)
  }

  // Action management
  function addAction(actionType: 'reply_text' | 'reply_image' | 'reply_flex') {
    const defaultContentMap = new Map<string, string>([
      ['reply_text', JSON.stringify({ text: '' })],
      ['reply_image', JSON.stringify({ url: '', previewUrl: '' })],
      ['reply_flex', JSON.stringify({})]
    ])
    formData.actions.push({
      actionType,
      content: defaultContentMap.get(actionType) ?? '',
      sortOrder: formData.actions.length
    })
  }

  function removeAction(index: number) {
    formData.actions.splice(index, 1)
    // Re-index sortOrder
    formData.actions.forEach((a, i) => { a.sortOrder = i })
  }

  function updateActionContent(index: number, content: string) {
    const action = formData.actions[index]
    if (action) {
      action.content = content
    }
  }

  /**
   * Optimistic save: updates store and collapses editor instantly,
   * then syncs to backend in the background. Rolls back on failure.
   */
  async function saveRule(): Promise<boolean> {
    if (!formData.name.trim()) {return false}

    const wasCreating = isCreating.value
    const editedRuleId = expandedRuleId.value

    if (!wasCreating && !editedRuleId) {return false}

    const request: CreateRuleRequest = {
      name: formData.name,
      triggerType: formData.triggerType,
      priority: formData.priority,
      isActive: formData.isActive,
      conditions: [...formData.conditions],
      actions: [...formData.actions]
    }

    // --- Optimistic: build a local preview rule ---
    const now = new Date().toISOString()
    const tempId = wasCreating ? -(Date.now()) : editedRuleId!
    const optimisticRule: AutoReplyRule = {
      id: tempId,
      teamId: null,
      name: request.name,
      triggerType: request.triggerType,
      priority: request.priority ?? 100,
      isActive: request.isActive ?? true,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      conditions: (request.conditions ?? []).map((c, i) => ({
        id: -(i + 1),
        conditionType: c.conditionType,
        value: c.value,
        caseSensitive: c.caseSensitive ?? false,
        matchMode: c.matchMode ?? 'any'
      })),
      actions: (request.actions ?? []).map((a, i) => ({
        id: -(i + 1),
        actionType: a.actionType,
        content: a.content,
        sortOrder: a.sortOrder ?? i
      }))
    }

    // Snapshot previous state for rollback
    const previousRule = wasCreating
      ? null
      : store.rules.find(r => r.id === editedRuleId) ?? null
    const previousSnapshot = previousRule
      ? JSON.parse(JSON.stringify(previousRule)) as AutoReplyRule
      : null

    // --- Apply optimistic update instantly ---
    store.upsertRule(optimisticRule)
    collapseRule()

    // --- Background sync to server ---
    try {
      let serverRule: AutoReplyRule
      if (wasCreating) {
        const response = await createRule(request, { scope: 'global' })
        serverRule = response.data
      } else {
        const response = await updateRule(editedRuleId!, request as UpdateRuleRequest)
        serverRule = response.data
      }

      // Replace optimistic placeholder with server-confirmed data
      if (wasCreating) {
        // Swap tempId entry with real server rule
        const tempIdx = store.rules.findIndex(r => r.id === tempId)
        if (tempIdx !== -1) {
          store.rules.splice(tempIdx, 1, serverRule)
        }
      } else {
        store.upsertRule(serverRule)
      }
      return true
    } catch {
      // --- Rollback on failure ---
      if (wasCreating) {
        const tempIdx = store.rules.findIndex(r => r.id === tempId)
        if (tempIdx !== -1) {
          store.rules.splice(tempIdx, 1)
          store.rulesPagination.total -= 1
        }
      } else if (previousSnapshot) {
        store.upsertRule(previousSnapshot)
      }

      // Re-expand editor with the user's unsaved form data so they can retry
      isCreating.value = wasCreating
      expandedRuleId.value = wasCreating ? null : editedRuleId
      Object.assign(formData, {
        name: request.name,
        triggerType: request.triggerType,
        priority: request.priority,
        isActive: request.isActive,
        conditions: request.conditions,
        actions: request.actions
      })
      return false
    }
  }

  async function removeRule(id: number): Promise<boolean> {
    // Optimistic: remove from local list instantly
    const ruleIndex = store.rules.findIndex(r => r.id === id)
    const removedRule = ruleIndex !== -1 ? store.rules[ruleIndex] : null
    if (ruleIndex !== -1) {
      store.rules.splice(ruleIndex, 1)
    }
    if (expandedRuleId.value === id) {
      collapseRule()
    }

    try {
      await deleteRule(id)
      // Sync with server to ensure consistency
      await store.fetchRules({ scope: 'global' })
      return true
    } catch {
      // Rollback: restore removed rule at original position
      if (removedRule && ruleIndex !== -1) {
        store.rules.splice(ruleIndex, 0, removedRule)
      }
      return false
    }
  }

  async function toggleRuleActive(rule: AutoReplyRule): Promise<boolean> {
    return store.toggleRuleActive(rule.id)
  }

  return {
    expandedRuleId,
    isCreating,
    saving,
    formData,
    expandRule,
    collapseRule,
    startCreate,
    addCondition,
    removeCondition,
    addAction,
    removeAction,
    updateActionContent,
    saveRule,
    removeRule,
    toggleRuleActive
  }
}
