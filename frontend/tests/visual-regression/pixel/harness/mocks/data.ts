/**
 * ============================================================================
 * Pixel VRT — fixed mock entities
 * ============================================================================
 *
 * Every value here is hard-coded. Nothing derives from the wall clock, the
 * network, or `Math.random()`. Text is intentionally ASCII/CJK-stable and never
 * contains emoji (project rule), and string lengths are chosen so that
 * truncation / ellipsis / wrap paths are exercised deterministically.
 * ============================================================================
 */

import type { Agent, Conversation, ConversationFilters, Team, TeamMember } from '@/types'
import { FROZEN_NOW_MS } from '../determinism'

/** ISO form of the frozen instant, for fields typed as strings. */
export const FROZEN_NOW_ISO = '2026-01-15T01:30:00.000Z'

/** A slightly older fixed instant, for "last login" style fields. */
export const FROZEN_EARLIER_ISO = '2026-01-14T22:05:00.000Z'

/**
 * Inline SVG avatar. A data URI keeps the image path covered (object-fit,
 * rounding, `loading="lazy"`) without a single network request.
 */
export const MOCK_AVATAR_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E" +
  "%3Crect width='96' height='96' fill='%23FF9500'/%3E" +
  "%3Ccircle cx='48' cy='36' r='16' fill='%23FFFFFF'/%3E" +
  "%3Crect x='20' y='60' width='56' height='28' rx='14' fill='%23FFFFFF'/%3E" +
  '%3C/svg%3E'

/**
 * Signed-in agent seeded into the auth store.
 *
 * `role: 'admin'` is deliberate: `PermissionService` grants admins
 * ASSIGN_CONVERSATIONS + VIEW_TEAM_MEMBERS, which is what makes both
 * QuickAssignActions buttons render. An 'agent' role would silently collapse
 * that component to an empty box.
 */
export const MOCK_AGENT: Agent = {
  id: 'agent-0001',
  email: 'ada.lin@example.test',
  name: 'Ada Lin',
  displayName: 'Ada Lin',
  role: 'admin',
  primaryTeamId: 7,
  allowedTeamIds: [7, 8],
  teamRoles: { 7: 'supervisor', 8: 'member' },
  isActive: true,
  isOnline: true,
  createdAt: FROZEN_NOW_MS,
  lastActive: FROZEN_NOW_MS,
}

/**
 * Unassigned conversation. `assignedTeamId` is absent so
 * QuickAssignActions renders the "assign to me" affordance.
 */
export const MOCK_CONVERSATION_UNASSIGNED: Conversation = {
  id: 'conv-0001',
  userId: 'user-0001',
  status: 'pending',
  platform: 'line',
  lastMessageAt: FROZEN_NOW_MS,
  unreadCount: 3,
  createdAt: FROZEN_NOW_MS,
  updatedAt: FROZEN_NOW_MS,
}

/** Conversation already routed to a team, to pin the green assigned pill. */
export const MOCK_CONVERSATION_ASSIGNED: Conversation = {
  id: 'conv-0002',
  userId: 'user-0002',
  status: 'in-progress',
  platform: 'facebook',
  assignedTeamId: 9,
  assignedTeam: { id: 9, name: '第一線客服組' },
  lastMessageAt: FROZEN_NOW_MS,
  unreadCount: 0,
  createdAt: FROZEN_NOW_MS,
  updatedAt: FROZEN_NOW_MS,
}

export const MOCK_TEAM_ACTIVE: Team = {
  id: 21,
  name: '客服一組',
  description: '負責 LINE 官方帳號的第一線回覆與轉單',
  isActive: true,
  memberCount: 12,
  createdAt: FROZEN_NOW_ISO,
  updatedAt: FROZEN_NOW_ISO,
}

export const MOCK_TEAM_INACTIVE: Team = {
  id: 22,
  name: 'Facebook Messenger Escalation Desk',
  description: '',
  isActive: false,
  memberCount: 0,
  createdAt: FROZEN_NOW_ISO,
  updatedAt: FROZEN_NOW_ISO,
}

export const MOCK_TEAMS: Team[] = [MOCK_TEAM_ACTIVE, MOCK_TEAM_INACTIVE]

export const MOCK_MEMBER_ADMIN: TeamMember = {
  id: 'member-0001',
  loginId: 'ada.lin',
  name: 'Ada Lin',
  email: 'ada.lin@example.test',
  role: 'admin',
  status: 'active',
  createdAt: FROZEN_NOW_ISO,
  updatedAt: FROZEN_NOW_ISO,
  lastLoginAt: FROZEN_EARLIER_ISO,
  primaryTeamId: 21,
  teamCount: 2,
}

export const MOCK_MEMBER_INACTIVE: TeamMember = {
  id: 'member-0002',
  loginId: 'bruno.tsai',
  name: 'Bruno Tsai',
  email: 'bruno.tsai@example.test',
  role: 'agent',
  status: 'inactive',
  createdAt: FROZEN_NOW_ISO,
  updatedAt: FROZEN_NOW_ISO,
  primaryTeamId: 21,
  teamCount: 1,
}

export const MOCK_MEMBER_WITH_AVATAR: TeamMember = {
  id: 'member-0003',
  loginId: 'chloe.wu',
  name: 'Chloe Wu',
  email: 'chloe.wu@example.test',
  role: 'agent',
  status: 'active',
  avatar: MOCK_AVATAR_DATA_URI,
  createdAt: FROZEN_NOW_ISO,
  updatedAt: FROZEN_NOW_ISO,
  lastLoginAt: FROZEN_EARLIER_ISO,
  primaryTeamId: 21,
  teamCount: 1,
}

export const MOCK_FILTERS_EMPTY: ConversationFilters = {}

export const MOCK_FILTERS_ACTIVE: ConversationFilters = {
  customerName: '王小明',
  platform: 'line',
  status: 'assigned',
  tagIds: [3, 5],
  lastMessageSearch: '退款',
}

export const MOCK_TAGS = [
  { id: 3, name: '退款申請', color: '#FF9500' },
  { id: 5, name: 'VIP', color: '#007AFF' },
  { id: 8, name: '待回覆', color: '#34C759' },
]

/** Fully specified PlatformStatus metrics — no defaults, no clock reads. */
export const MOCK_PLATFORM_METRICS = {
  messagesCount: 18432,
  activeConversations: 27,
  averageResponseTime: 1450,
  successRate: 0.987,
}

/** Webhook block with an explicit fixed `lastVerified`. */
export const MOCK_WEBHOOK_OK = {
  endpoint: 'https://example.test/api/webhook',
  isActive: true,
  lastVerified: new Date(FROZEN_NOW_MS),
}

export const MOCK_WEBHOOK_FAILING = {
  endpoint: 'https://example.test/api/webhook',
  isActive: false,
  lastVerified: new Date(FROZEN_NOW_MS),
  lastError: 'HTTP 502 from upstream after 3 retries',
}
