// Auto-Reply API Client
// 自動回覆系統 API 介面

import { apiClient } from './base'

// ============================================================================
// Types
// ============================================================================

export type TriggerType = 'welcome' | 'keyword' | 'off_hours' | 'fallback'
export type ConditionType = 'exact' | 'contains' | 'regex' | 'message_type'
export type MatchMode = 'any' | 'all'
export type ActionType = 'reply_text' | 'reply_image' | 'reply_flex'

export interface AutoReplyCondition {
  id: number
  conditionType: ConditionType
  value: string
  caseSensitive: boolean
  matchMode: MatchMode
}

export interface AutoReplyAction {
  id: number
  actionType: ActionType
  content: string // JSON string
  sortOrder: number
}

export interface AutoReplyRule {
  id: number
  teamId: number | null
  name: string
  triggerType: TriggerType
  priority: number
  isActive: boolean
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  deletedAt: string | null
  conditions: AutoReplyCondition[]
  actions: AutoReplyAction[]
}

export interface AutoReplySchedule {
  id: number
  teamId: number
  dayOfWeek: number // 0-6
  startTime: string // HH:mm
  endTime: string // HH:mm
  timezone: string
  isActive: boolean
}

export interface AutoReplyLog {
  id: number
  rule_id: number | null
  rule_name: string
  conversation_id: string
  customer_id: number
  trigger_content: string
  response_content: string
  matched_condition: string
  platform: 'line' | 'facebook'
  reply_method: 'reply_api' | 'push_api'
  created_at: string
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateRuleRequest {
  name: string
  triggerType: TriggerType
  priority?: number
  isActive?: boolean
  conditions?: Array<{
    conditionType: ConditionType
    value: string
    caseSensitive?: boolean
    matchMode?: MatchMode
  }>
  actions?: Array<{
    actionType: ActionType
    content: string
    sortOrder?: number
  }>
}

export type UpdateRuleRequest = Partial<CreateRuleRequest>

export interface BulkUpsertScheduleRequest {
  timezone?: string
  schedules: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
    isActive?: boolean
  }>
}

// ============================================================================
// Response Types
// ============================================================================

export interface PaginatedRulesResponse {
  success: boolean
  data: {
    items: AutoReplyRule[]
    pagination: { page: number; limit: number; total: number }
  }
  message: string
}

export interface RuleResponse {
  success: boolean
  data: AutoReplyRule
  message: string
}

export interface SchedulesResponse {
  success: boolean
  data: AutoReplySchedule[]
  message: string
}

export interface PaginatedLogsResponse {
  success: boolean
  data: {
    items: AutoReplyLog[]
    pagination: { page: number; limit: number; total: number }
    todayTotal: number
  }
  message: string
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
  const queryString = params
    ?`?${new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<Record<string, unknown>>(`/auto-reply/rules${queryString}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch auto-reply rules')
  }
  // Backend paginatedResponse puts pagination fields flat in data
  const raw = response.data
  return {
    success: response.success,
    data: {
      items: (raw.items ?? []) as AutoReplyRule[],
      pagination: {
        page: (raw.page as number) ?? 1,
        limit: (raw.limit as number) ?? 20,
        total: (raw.total as number) ?? 0
      }
    },
    message: response.message || 'Auto-reply rules retrieved successfully'
  }
}

/**
 * 創建自動回覆規則
 */
export const createRule = async (data: CreateRuleRequest, params?: { scope?: string }): Promise<RuleResponse> => {
  const queryString = params?.scope ? `?scope=${params.scope}` : ''
  const response = await apiClient.post<AutoReplyRule>(`/auto-reply/rules${queryString}`, data)
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
  const response = await apiClient.put<AutoReplyRule>(`/auto-reply/rules/${id}`, data)
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
  const response = await apiClient.delete<void>(`/auto-reply/rules/${id}`)
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
  const queryString = params
    ?`?${new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<AutoReplySchedule[]>(`/auto-reply/schedules${queryString}`)
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
  const response = await apiClient.post<AutoReplySchedule[]>('/auto-reply/schedules', data)
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
  const queryString = params
    ?`?${new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, String(value)])
      ).toString()}`
    : ''
  const response = await apiClient.get<Record<string, unknown>>(`/auto-reply/logs${queryString}`)
  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to fetch auto-reply logs')
  }
  // Backend paginatedResponse puts pagination fields flat in data
  const raw = response.data
  return {
    success: response.success,
    data: {
      items: (raw.items ?? []) as AutoReplyLog[],
      pagination: {
        page: (raw.page as number) ?? 1,
        limit: (raw.limit as number) ?? 20,
        total: (raw.total as number) ?? 0
      },
      todayTotal: (raw.todayTotal as number) ?? 0
    },
    message: response.message || 'Auto-reply logs retrieved successfully'
  }
}
