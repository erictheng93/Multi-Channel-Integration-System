/**
 * Auto-Reply Store
 * Manages auto-reply state using Pinia
 */

import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import {
  getRules,
  getSchedules,
  getLogs,
  updateRule,
  type AutoReplyRule,
  type AutoReplySchedule,
  type AutoReplyLog
} from '@/api/autoReply'

export const useAutoReplyStore = defineStore('autoReply', () => {
  // State
  const rules = ref<AutoReplyRule[]>([])
  const schedules = ref<AutoReplySchedule[]>([])
  const logs = ref<AutoReplyLog[]>([])
  const rulesPagination = ref<{ page: number; limit: number; total: number }>({
    page: 1,
    limit: 20,
    total: 0
  })
  const logsPagination = ref<{ page: number; limit: number; total: number }>({
    page: 1,
    limit: 20,
    total: 0
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Track in-flight toggle requests to prevent double-clicks
  const togglingRuleIds = reactive(new Set<number>())

  // Actions
  async function fetchRules(params?: {
    teamId?: number
    page?: number
    pageSize?: number
    scope?: string
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await getRules(params)
      rules.value = response.data.items
      rulesPagination.value = response.data.pagination
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch auto-reply rules'
      throw err
    } finally {
      loading.value = false
    }
  }


  async function fetchSchedules(params?: {
    teamId?: number
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await getSchedules(params)
      schedules.value = response.data
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch auto-reply schedules'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchLogs(params?: {
    teamId?: number
    page?: number
    pageSize?: number
    ruleId?: number
    platform?: string
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await getLogs(params)
      logs.value = response.data.items
      logsPagination.value = response.data.pagination
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch auto-reply logs'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Optimistic toggle: flips local state instantly, syncs to backend,
   * rolls back on failure. Prevents double-click via togglingRuleIds guard.
   */
  async function toggleRuleActive(ruleId: number): Promise<boolean> {
    // Double-click guard: skip if already toggling this rule
    if (togglingRuleIds.has(ruleId)) {return false}

    const rule = rules.value.find(r => r.id === ruleId)
    if (!rule) {return false}

    const previousValue = rule.isActive
    const newValue = !previousValue

    // Optimistic update — UI flips instantly
    rule.isActive = newValue
    togglingRuleIds.add(ruleId)

    try {
      await updateRule(ruleId, { isActive: newValue })
      return true
    } catch {
      // Rollback on failure
      rule.isActive = previousValue
      return false
    } finally {
      togglingRuleIds.delete(ruleId)
    }
  }

  function isToggling(ruleId: number): boolean {
    return togglingRuleIds.has(ruleId)
  }

  function $reset() {
    rules.value = []
    schedules.value = []
    logs.value = []
    rulesPagination.value = { page: 1, limit: 20, total: 0 }
    logsPagination.value = { page: 1, limit: 20, total: 0 }
    loading.value = false
    error.value = null
    togglingRuleIds.clear()
  }

  return {
    // State
    rules,
    schedules,
    logs,
    rulesPagination,
    logsPagination,
    loading,
    error,
    togglingRuleIds,

    // Actions
    fetchRules,
    fetchSchedules,
    fetchLogs,
    toggleRuleActive,
    isToggling,
    $reset
  }
})
