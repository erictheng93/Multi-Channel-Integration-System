// Auto-Reply API Client
// 自動回覆系統 API 介面

import {
  autoReplyContracts,
  type AutoReplyFlatPage,
  type BulkUpsertScheduleRequest,
  type CreateRuleRequest,
  type PaginatedLogsResponse,
  type PaginatedRulesResponse,
  type RuleResponse,
  type SchedulesResponse,
  type TriggerType,
  type UpdateRuleRequest
} from '@shared/api-contracts'
import { callApiContract } from './contract-client'

// ============================================================================
// Types
// ============================================================================

/** Trigger types available for creating/editing rules (single source of truth) */
export const TRIGGER_TYPE_OPTIONS: Array<{ value: TriggerType; label: string }> = [
  { value: 'welcome', label: '歡迎訊息' },
  { value: 'keyword', label: '關鍵字' },
  { value: 'off_hours', label: '非營業時間' },
]

/** Label map for all trigger types (including legacy/display-only types) */
export const TRIGGER_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TRIGGER_TYPE_OPTIONS.map(o => [o.value, o.label]),
)

export type {
  ActionType,
  AutoReplyAction,
  AutoReplyCondition,
  AutoReplyLog,
  AutoReplyRule,
  AutoReplySchedule,
  BulkUpsertScheduleRequest,
  ConditionType,
  CreateRuleRequest,
  MatchMode,
  PaginatedLogsResponse,
  PaginatedRulesResponse,
  RuleResponse,
  SchedulesResponse,
  TriggerType,
  UpdateRuleRequest
} from '@shared/api-contracts'

function normalizeFlatPage<TItem>(raw: AutoReplyFlatPage<TItem> | undefined): {
  items: TItem[]
  pagination: { page: number; limit: number; total: number }
} {
  return {
    items: raw?.items ?? [],
    pagination: {
      page: raw?.page ?? 1,
      limit: raw?.limit ?? 20,
      total: raw?.total ?? 0
    }
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 獲取自動回覆規則列表
 */
export const getRules = async (params?: {
  teamId?: number
  page?: number
  pageSize?: number
  scope?: string
}): Promise<PaginatedRulesResponse> => {
  const response = await callApiContract(autoReplyContracts.getRules, params)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch auto-reply rules')
  }
  const page = normalizeFlatPage(response.data)
  return {
    success: response.success,
    data: page,
    message: response.message || 'Auto-reply rules retrieved successfully'
  }
}

/**
 * 創建自動回覆規則
 */
export const createRule = async (data: CreateRuleRequest, params?: { scope?: string }): Promise<RuleResponse> => {
  const response = await callApiContract(autoReplyContracts.createRule, params, data)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to create auto-reply rule')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Auto-reply rule created successfully'
  }
}

/**
 * 更新自動回覆規則
 */
export const updateRule = async (id: number, data: UpdateRuleRequest): Promise<RuleResponse> => {
  const response = await callApiContract(autoReplyContracts.updateRule, { id }, data)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to update auto-reply rule')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Auto-reply rule updated successfully'
  }
}

/**
 * 刪除自動回覆規則 (軟刪除)
 */
export const deleteRule = async (id: number): Promise<{ success: boolean; message: string }> => {
  const response = await callApiContract(autoReplyContracts.deleteRule, { id })
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete auto-reply rule')
  }
  return { success: true, message: 'Auto-reply rule deleted successfully' }
}

/**
 * 獲取自動回覆排程列表
 */
export const getSchedules = async (params?: {
  teamId?: number
}): Promise<SchedulesResponse> => {
  const response = await callApiContract(autoReplyContracts.getSchedules, params)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch auto-reply schedules')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Auto-reply schedules retrieved successfully'
  }
}

/**
 * 批量新增/更新排程
 */
export const saveSchedules = async (data: BulkUpsertScheduleRequest): Promise<SchedulesResponse> => {
  const response = await callApiContract(autoReplyContracts.saveSchedules, {}, data)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to save auto-reply schedules')
  }
  return {
    success: response.success,
    data: response.data,
    message: response.message || 'Auto-reply schedules saved successfully'
  }
}

/**
 * 獲取自動回覆日誌
 */
export const getLogs = async (params?: {
  teamId?: number
  page?: number
  pageSize?: number
  ruleId?: number
  platform?: string
  dateFrom?: string
}): Promise<PaginatedLogsResponse> => {
  const response = await callApiContract(autoReplyContracts.getLogs, params)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch auto-reply logs')
  }
  const page = normalizeFlatPage(response.data)
  return {
    success: response.success,
    data: {
      ...page,
      todayTotal: response.data.todayTotal ?? 0
    },
    message: response.message || 'Auto-reply logs retrieved successfully'
  }
}
