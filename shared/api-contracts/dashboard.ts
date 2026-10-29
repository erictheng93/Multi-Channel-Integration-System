import { defineApiContract } from './core'
import type { WaitingConversation } from './conversations'

/** "now" vs the same elapsed time yesterday, both in Asia/Taipei days */
export interface DashboardComparison {
  today: number
  /** Count from yesterday 00:00 Taipei up to the same elapsed time as today */
  yesterdaySameTime: number
}

export interface DashboardSummary {
  timezone: 'Asia/Taipei'
  /** ISO instant of today's 00:00 Taipei */
  dayStart: string
  generatedAt: string
  /** Customer-sent messages in the caller's visible conversations */
  customerMessages: DashboardComparison
  /** Conversations moved to closed (已結案) with closedAt in the day */
  resolved: DashboardComparison
  /** Not-closed conversations visible to the caller */
  openConversations: number
  waiting: {
    /** Open conversations with an unanswered customer message */
    count: number
    /** The oldest unanswered customer message across them (ISO), null when nothing waits */
    oldestWaitingSince: string | null
    oldestWaitingSeconds: number | null
    /** The longest-waiting conversations, oldest first (max 5) */
    top: WaitingConversation[]
  }
  /** Conversations created in the day whose first human reply is recorded */
  firstResponse: {
    today: { count: number; avgSeconds: number | null }
    yesterdaySameTime: { count: number; avgSeconds: number | null }
  }
}

export type MessageVolumePlatform = 'line' | 'facebook' | 'other'

export interface MessageVolumeDay {
  /** Taipei calendar date YYYY-MM-DD */
  date: string
  line: number
  facebook: number
  other: number
  total: number
}

export interface MessageVolumeData {
  timezone: 'Asia/Taipei'
  days: 7 | 30 | 90
  generatedAt: string
  /** Oldest first; always `days` entries (zero-filled), last entry is today (partial) */
  current: MessageVolumeDay[]
  /** The `days` days immediately before `current`, oldest first, same length */
  previous: MessageVolumeDay[]
  totals: { current: number; previous: number }
}

export const dashboardContracts = {
  summary: defineApiContract<Record<string, never>, void, DashboardSummary>({
    method: 'GET',
    path: () => '/dashboard/summary'
  }),

  messageVolume: defineApiContract<{ days?: 7 | 30 | 90 }, void, MessageVolumeData>({
    method: 'GET',
    path: ({ days }) => `/dashboard/message-volume${days ? `?days=${days}` : ''}`
  })
} as const
