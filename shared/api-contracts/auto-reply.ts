import { defineApiContract } from './core'

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
  content: string
  sortOrder: number
}

export interface AutoReplyRule {
  id: number
  teamId: number | null
  name: string
  triggerType: TriggerType
  priority: number
  isActive: boolean
  allowPushFallback: boolean
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
  dayOfWeek: number
  startTime: string
  endTime: string
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
  platform: 'line' | 'facebook' | 'whatsapp'
  reply_method: 'reply_api' | 'push_api'
  created_at: string
}

export interface CreateRuleRequest {
  name: string
  triggerType: TriggerType
  priority?: number
  isActive?: boolean
  allowPushFallback?: boolean
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

export interface AutoReplyListParams {
  teamId?: number
  page?: number
  pageSize?: number
  scope?: string
}

export interface AutoReplyScopeParams {
  scope?: string
}

export interface AutoReplyScheduleParams {
  teamId?: number
}

export interface AutoReplyLogParams {
  teamId?: number
  page?: number
  pageSize?: number
  ruleId?: number
  platform?: string
  dateFrom?: string
}

export interface AutoReplyFlatPage<TItem> {
  items?: TItem[]
  page?: number
  limit?: number
  total?: number
  todayTotal?: number
}

export function buildAutoReplyQuery<TParams extends object>(params?: TParams): string {
  if (!params) {
    return ''
  }

  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  ).toString()

  return query ? `?${query}` : ''
}

export const autoReplyContracts = {
  getRules: defineApiContract<AutoReplyListParams | undefined, void, AutoReplyFlatPage<AutoReplyRule>>({
    method: 'GET',
    path: params => `/auto-reply/rules${buildAutoReplyQuery(params)}`
  }),

  createRule: defineApiContract<AutoReplyScopeParams | undefined, CreateRuleRequest, AutoReplyRule>({
    method: 'POST',
    path: params => `/auto-reply/rules${buildAutoReplyQuery(params)}`
  }),

  updateRule: defineApiContract<{ id: number }, UpdateRuleRequest, AutoReplyRule>({
    method: 'PUT',
    path: ({ id }) => `/auto-reply/rules/${id}`
  }),

  deleteRule: defineApiContract<{ id: number }, void, void>({
    method: 'DELETE',
    path: ({ id }) => `/auto-reply/rules/${id}`
  }),

  getSchedules: defineApiContract<AutoReplyScheduleParams | undefined, void, AutoReplySchedule[]>({
    method: 'GET',
    path: params => `/auto-reply/schedules${buildAutoReplyQuery(params)}`
  }),

  saveSchedules: defineApiContract<Record<string, never>, BulkUpsertScheduleRequest, AutoReplySchedule[]>({
    method: 'POST',
    path: () => '/auto-reply/schedules'
  }),

  getLogs: defineApiContract<AutoReplyLogParams | undefined, void, AutoReplyFlatPage<AutoReplyLog>>({
    method: 'GET',
    path: params => `/auto-reply/logs${buildAutoReplyQuery(params)}`
  })
} as const
