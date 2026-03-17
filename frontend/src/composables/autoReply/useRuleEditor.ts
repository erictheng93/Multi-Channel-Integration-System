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

  async function saveRule(): Promise<boolean> {
    if (!formData.name.trim()) {return false}
    saving.value = true
    try {
      if (isCreating.value) {
        const request: CreateRuleRequest = {
          name: formData.name,
          triggerType: formData.triggerType,
          priority: formData.priority,
          isActive: formData.isActive,
          conditions: formData.conditions,
          actions: formData.actions
        }
        await createRule(request, { scope: 'global' })
      } else if (expandedRuleId.value) {
        const request: UpdateRuleRequest = {
          name: formData.name,
          triggerType: formData.triggerType,
          priority: formData.priority,
          isActive: formData.isActive,
          conditions: formData.conditions,
          actions: formData.actions
        }
        await updateRule(expandedRuleId.value, request)
      }
      // Refresh rules list
      await store.fetchRules({ scope: 'global' })
      collapseRule()
      return true
    } catch {
      return false
    } finally {
      saving.value = false
    }
  }

  async function removeRule(id: number): Promise<boolean> {
    saving.value = true
    try {
      await deleteRule(id)
      await store.fetchRules({ scope: 'global' })
      if (expandedRuleId.value === id) {
        collapseRule()
      }
      return true
    } catch {
      return false
    } finally {
      saving.value = false
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
