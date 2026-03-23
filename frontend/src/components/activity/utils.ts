import type { ActivityLog } from '@/api/activities'
import type { ActivityDateGroup, ActionIconStyle, DetailEntry } from './types'
import {
  LoginIcon,
  LogoutIcon,
  ChatIcon,
  UsersIcon,
  ForwardIcon,
  XIcon,
  RefreshIcon,
  CogIcon,
  UserPlusIcon,
  UserIcon,
  FileIcon,
} from '@/components/icons'

// ─── groupActivitiesByDate ────────────────────────────────────────────────────

function getDateKey(isoString: string): string {
  // Use local date components to avoid timezone-crossing bugs
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTodayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getYesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateKeyToLabel(key: string): string {
  const todayKey = getTodayKey()
  const yesterdayKey = getYesterdayKey()
  if (key === todayKey) { return '\u4eca\u5929' }
  if (key === yesterdayKey) { return '\u6628\u5929' }
  const parts = key.split('-').map(Number)
  const date = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function groupActivitiesByDate(activities: ActivityLog[]): ActivityDateGroup[] {
  if (activities.length === 0) { return [] }

  const groups: Map<string, ActivityLog[]> = new Map()
  const keyOrder: string[] = []

  for (const activity of activities) {
    const key = getDateKey(activity.createdAt)
    if (!groups.has(key)) {
      groups.set(key, [])
      keyOrder.push(key)
    }
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(activity)
    }
  }

  return keyOrder.map(key => ({
    label: dateKeyToLabel(key),
    date: key,
    activities: groups.get(key) ?? [],
  }))
}

// ─── getActionIconStyle ───────────────────────────────────────────────────────

const ACTION_ICON_MAP: Record<string, ActionIconStyle> = {
  'user_login': {
    bgClass: 'bg-blue-50',
    colorClass: 'text-[#007AFF]',
    icon: LoginIcon,
  },
  'user_logout': {
    bgClass: 'bg-blue-50',
    colorClass: 'text-[#007AFF]',
    icon: LogoutIcon,
  },
  'message_send': {
    bgClass: 'bg-green-50',
    colorClass: 'text-[#34C759]',
    icon: ChatIcon,
  },
  'message_recall': {
    bgClass: 'bg-green-50',
    colorClass: 'text-[#34C759]',
    icon: ChatIcon,
  },
  'conversation_assign': {
    bgClass: 'bg-orange-50',
    colorClass: 'text-[#FF9500]',
    icon: UsersIcon,
  },
  'conversation_transfer': {
    bgClass: 'bg-orange-50',
    colorClass: 'text-[#FF9500]',
    icon: ForwardIcon,
  },
  'conversation_close': {
    bgClass: 'bg-red-50',
    colorClass: 'text-[#FF3B30]',
    icon: XIcon,
  },
  'conversation_reopen': {
    bgClass: 'bg-red-50',
    colorClass: 'text-[#FF3B30]',
    icon: RefreshIcon,
  },
  'settings_update': {
    bgClass: 'bg-[#F2E8FB]',
    colorClass: 'text-[#AF52DE]',
    icon: CogIcon,
  },
  'team_invite': {
    bgClass: 'bg-[#E6F7FA]',
    colorClass: 'text-[#30B0C7]',
    icon: UserPlusIcon,
  },
  'team_create': {
    bgClass: 'bg-[#E6F7FA]',
    colorClass: 'text-[#30B0C7]',
    icon: UserPlusIcon,
  },
  'team_update': {
    bgClass: 'bg-[#E6F7FA]',
    colorClass: 'text-[#30B0C7]',
    icon: UserPlusIcon,
  },
  'team_delete': {
    bgClass: 'bg-[#E6F7FA]',
    colorClass: 'text-[#30B0C7]',
    icon: UserPlusIcon,
  },
  'user_create': {
    bgClass: 'bg-red-50',
    colorClass: 'text-[#FF3B30]',
    icon: UserIcon,
  },
  'user_update': {
    bgClass: 'bg-red-50',
    colorClass: 'text-[#FF3B30]',
    icon: UserIcon,
  },
  'user_delete': {
    bgClass: 'bg-red-50',
    colorClass: 'text-[#FF3B30]',
    icon: UserIcon,
  },
}

const DEFAULT_ICON_STYLE: ActionIconStyle = {
  bgClass: 'bg-gray-50',
  colorClass: 'text-gray-400',
  icon: FileIcon,
}

export function getActionIconStyle(action: string): ActionIconStyle {
  const mapped = ACTION_ICON_MAP[action]
  if (mapped) {
    return mapped
  }
  // Match team_* prefix not already in the map
  if (action.startsWith('team_')) {
    return {
      bgClass: 'bg-[#E6F7FA]',
      colorClass: 'text-[#30B0C7]',
      icon: UserPlusIcon,
    }
  }
  return DEFAULT_ICON_STYLE
}

// ─── formatActivityDetails ────────────────────────────────────────────────────

function humanizeKey(key: string): string {
  const known: Record<string, string> = {
    ipAddress: 'IP Address',
    userAgent: 'User Agent',
    userId: 'User ID',
    field: 'Field',
    oldValue: 'Old Value',
    newValue: 'New Value',
    teamId: 'Team ID',
    conversationId: 'Conversation ID',
    agentId: 'Agent ID',
  }
  if (known[key]) { return known[key] }
  // camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

export function formatActivityDetails(
  details: Record<string, unknown> | null | undefined,
  action: string,
): DetailEntry[] {
  if (details === null || details === undefined) { return [] }

  // settings_update — show old/new values with typed entries
  if (action === 'settings_update') {
    const entries: DetailEntry[] = []
    if (details['field'] !== undefined) {
      entries.push({ key: 'Field', value: String(details['field']), type: 'default' })
    }
    if (details['oldValue'] !== undefined) {
      entries.push({ key: 'Old Value', value: String(details['oldValue']), type: 'old-value' })
    }
    if (details['newValue'] !== undefined) {
      entries.push({ key: 'New Value', value: String(details['newValue']), type: 'new-value' })
    }
    // Fallback for other keys not handled above
    for (const [k, v] of Object.entries(details)) {
      if (!['field', 'oldValue', 'newValue'].includes(k)) {
        entries.push({ key: humanizeKey(k), value: String(v), type: 'default' })
      }
    }
    return entries
  }

  // user_login / user_logout — special handling for known login fields
  if (action === 'user_login' || action === 'user_logout') {
    const entries: DetailEntry[] = []
    if (details['ipAddress'] !== undefined) {
      entries.push({ key: 'IP Address', value: String(details['ipAddress']), type: 'default' })
    }
    if (details['userAgent'] !== undefined) {
      entries.push({ key: 'User Agent', value: String(details['userAgent']), type: 'default' })
    }
    if (details['userId'] !== undefined) {
      entries.push({ key: 'User ID', value: String(details['userId']), type: 'default' })
    }
    // Remaining unknown keys
    for (const [k, v] of Object.entries(details)) {
      if (!['ipAddress', 'userAgent', 'userId'].includes(k)) {
        entries.push({ key: humanizeKey(k), value: String(v), type: 'default' })
      }
    }
    return entries
  }

  // Generic fallback
  return Object.entries(details).map(([k, v]) => ({
    key: humanizeKey(k),
    value: String(v),
    type: 'default' as const,
  }))
}

// ─── getActivityDescription ───────────────────────────────────────────────────

// Actions where resourceId should NOT be shown as fallback
// (because it doesn't match what the template placeholder represents)
const OMIT_RESOURCE_ID_ACTIONS = new Set([
  'conversation_assign', 'conversation_transfer', 'conversation_close',
  'conversation_reopen', 'conversation_unassign', 'conversation_bulk_assign',
  'tag_assign', 'tag_unassign',
])

type DescriptionResolver = (_details: Record<string, unknown>, _resourceId?: string) => string

function d(label: string): string { return label }

function name(details: Record<string, unknown>, key: string): string | undefined {
  const v = details[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function truncateId(resourceId: string): string {
  if (resourceId.length <= 8) {return resourceId}
  return resourceId.slice(0, 8)
}

/* eslint-disable camelcase -- keys match backend snake_case event types */
const ACTION_TEMPLATES: Record<string, DescriptionResolver> = {
  // User
  user_login: () => d('登入系統'),
  user_logout: () => d('登出系統'),
  user_create: (det, rid) => `建立用戶${name(det, 'targetName') ? ` ${  name(det, 'targetName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,
  user_update: (det, rid) => `更新用戶${name(det, 'targetName') ? ` ${  name(det, 'targetName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,
  user_delete: (det, rid) => `刪除用戶${name(det, 'targetName') ? ` ${  name(det, 'targetName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,
  user_bulk_delete: (det) => `批量刪除 ${det['deletedCount'] ?? det['count'] ?? ''} 位用戶`,
  user_bulk_update: (det) => `批量更新 ${det['updatedCount'] ?? det['count'] ?? ''} 位用戶`,
  user_restore: (det, rid) => `恢復用戶${name(det, 'targetName') ? ` ${  name(det, 'targetName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,

  // Team
  team_create: (det, rid) => `建立團隊${name(det, 'teamName') ? ` ${  name(det, 'teamName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,
  team_update: (det, rid) => `更新團隊${name(det, 'teamName') ? ` ${  name(det, 'teamName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,
  team_delete: (det, rid) => `刪除團隊${name(det, 'teamName') ? ` ${  name(det, 'teamName')}` : (rid ? ` #${  truncateId(rid)}` : '')}`,
  team_invite: (det) => {
    const email = name(det, 'invitedEmail')
    const team = name(det, 'teamName')
    if (email && team) {return `邀請 ${email} 加入 ${team}`}
    if (email) {return `邀請 ${email} 加入團隊`}
    return '邀請加入團隊'
  },
  team_member_update: (det) => {
    const agent = name(det, 'updatedAgentName')
    const team = name(det, 'teamName')
    if (agent && team) {return `更新 ${agent} 在 ${team} 的角色`}
    if (agent) {return `更新 ${agent} 的角色`}
    return '更新成員角色'
  },
  team_member_remove: (det) => {
    const team = name(det, 'teamName')
    return team ? `移除成員從 ${team}` : '移除成員'
  },
  member_add: (det) => {
    const agent = name(det, 'addedAgentName')
    const team = name(det, 'teamName')
    if (agent && team) {return `新增 ${agent} 至 ${team}`}
    if (agent) {return `新增 ${agent}`}
    if (team) {return `新增成員至 ${team}`}
    return '新增成員'
  },
  member_remove: (det) => {
    const agent = name(det, 'removedAgentName')
    const team = name(det, 'teamName')
    if (agent && team) {return `移除 ${agent} 從 ${team}`}
    if (agent) {return `移除 ${agent}`}
    if (team) {return `移除成員從 ${team}`}
    return '移除成員'
  },

  // Conversation (team-based)
  conversation_assign: (det) => {
    const team = name(det, 'teamName')
    return team ? `指派對話至 ${team}` : '指派對話'
  },
  conversation_transfer: (det) => {
    const from = name(det, 'fromTeamName')
    const to = name(det, 'toTeamName')
    if (from && to) {return `轉移對話 ${from} \u2192 ${to}`}
    return '轉移對話'
  },
  conversation_close: () => d('關閉對話'),
  conversation_reopen: () => d('重新開啟對話'),
  conversation_unassign: () => d('取消指派對話'),
  conversation_bulk_assign: (det) => `批量指派 ${det['count'] ?? ''} 個對話`,

  // Message
  message_send: () => d('發送訊息'),
  message_recall: () => d('撤回訊息'),
  message_forward: () => d('轉發訊息'),
  message_received: () => d('收到訊息'),

  // Customer
  customer_create: (det) => {
    const n = name(det, 'customerName')
    return n ? `建立客戶 ${n}` : '建立客戶'
  },
  customer_update: (det) => {
    const n = name(det, 'customerName')
    return n ? `更新客戶 ${n}` : '更新客戶'
  },
  customer_delete: (det) => {
    const n = name(det, 'customerName')
    return n ? `刪除客戶 ${n}` : '刪除客戶'
  },
  customer_followed: (det) => {
    const n = name(det, 'customerName')
    return n ? `客戶追蹤 ${n}` : '客戶追蹤'
  },
  customer_unfollowed: (det) => {
    const n = name(det, 'customerName')
    return n ? `客戶取消追蹤 ${n}` : '客戶取消追蹤'
  },

  // Tag
  tag_create: (det, rid) => {
    const n = name(det, 'tagName')
    return n ? `建立標籤 ${n}` : (rid ? `建立標籤 #${truncateId(rid)}` : '建立標籤')
  },
  tag_update: (det, rid) => {
    const n = name(det, 'tagName')
    return n ? `更新標籤 ${n}` : (rid ? `更新標籤 #${truncateId(rid)}` : '更新標籤')
  },
  tag_delete: (det, rid) => {
    const n = name(det, 'tagName')
    return n ? `刪除標籤 ${n}` : (rid ? `刪除標籤 #${truncateId(rid)}` : '刪除標籤')
  },
  tag_assign: (det) => {
    const n = name(det, 'tagName')
    return n ? `指派標籤 ${n}` : '指派標籤'
  },
  tag_unassign: (det) => {
    const n = name(det, 'tagName')
    return n ? `移除標籤 ${n}` : '移除標籤'
  },
  tag_bulk_update: () => d('批量更新標籤'),

  // Other
  qr_code_generate: () => d('產生 QR Code'),
  delayed_message_schedule: () => d('排程延遲訊息'),
  delayed_message_cancel: () => d('取消延遲訊息'),
  file_upload: () => d('上傳檔案'),
  file_delete: () => d('刪除檔案'),
  settings_update: () => d('更新系統設定'),
  system_health_check: () => d('系統健康檢查'),
  system_backup: () => d('系統備份'),
  system_restore: () => d('系統還原'),
}
/* eslint-enable camelcase */

export function getActivityDescription(activity: ActivityLog): string {
  const details = (activity.details ?? {}) as Record<string, unknown>
  const resolver = ACTION_TEMPLATES[activity.action]

  if (resolver) {
    return resolver(details, activity.resourceId)
  }

  // Unknown action — show raw action string
  // Append resourceId only if action doesn't have omit rule
  if (activity.resourceId && !OMIT_RESOURCE_ID_ACTIONS.has(activity.action)) {
    return `${activity.action} #${truncateId(activity.resourceId)}`
  }
  return activity.action
}

// ─── getRoleLabel ─────────────────────────────────────────────────────────────

const ROLE_LABEL_MAP: Record<string, string> = {
  admin: '\u7ba1\u7406\u54e1',
  team: '\u5718\u968a\u7ba1\u7406\u54e1',
  agent: '\u5ba2\u670d',
}

export function getRoleLabel(role: string): string {
  return ROLE_LABEL_MAP[role] ?? role
}

// ─── getRoleBadgeClasses ──────────────────────────────────────────────────────

export function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-blue-50 text-[#007AFF]'
    case 'team':
      return 'bg-orange-50 text-[#FF9500]'
    case 'agent':
      return 'bg-green-50 text-[#34C759]'
    default:
      return 'bg-gray-100 text-gray-500'
  }
}
