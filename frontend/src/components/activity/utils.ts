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

const ACTION_DESCRIPTION_MAP: Record<string, string> = {
  'user_login': '\u767b\u5165\u7cfb\u7d71',
  'user_logout': '\u767b\u51fa\u7cfb\u7d71',
  'user_create': '\u5efa\u7acb\u7528\u6236',
  'user_update': '\u66f4\u65b0\u7528\u6236\u8cc7\u6599',
  'user_delete': '\u522a\u9664\u7528\u6236',
  'message_send': '\u767c\u9001\u8a0a\u606f',
  'message_recall': '\u64a4\u56de\u8a0a\u606f',
  'conversation_assign': '\u6307\u6d3e\u5c0d\u8a71',
  'conversation_transfer': '\u8f49\u79fb\u5c0d\u8a71',
  'conversation_close': '\u95dc\u9589\u5c0d\u8a71',
  'conversation_reopen': '\u91cd\u958b\u5c0d\u8a71',
  'settings_update': '\u66f4\u65b0\u8a2d\u5b9a',
  'team_invite': '\u9080\u8acb\u52a0\u5165\u5718\u968a',
  'team_create': '\u5efa\u7acb\u5718\u968a',
  'team_update': '\u66f4\u65b0\u5718\u968a',
  'team_delete': '\u522a\u9664\u5718\u968a',
}

export function getActivityDescription(activity: ActivityLog): string {
  const base = ACTION_DESCRIPTION_MAP[activity.action] ?? activity.action
  if (activity.resourceId) {
    return `${base} #${activity.resourceId}`
  }
  return base
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
