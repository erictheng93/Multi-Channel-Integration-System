/**
 * Dashboard overview data (real data only).
 *
 * Sources:
 * - GET /dashboard/summary           KPI numbers, 待回覆 (waiting) block, first response
 * - GET /dashboard/message-volume    chart series + per-channel split
 * - GET /conversations/stats         處理中 split by team (byTeam)
 * - GET /team/presence + /teams/members   團隊狀態 (online / offline only)
 * - GET /activities                  recent feed (server scopes it to the caller)
 *
 * Terms: 待回覆 = team-wide, customer wrote and no agent replied (summary.waiting).
 *        未讀  = personal, not used here except the sidebar badge.
 * Wait times are recomputed on the client from waitingSince, never from a cached seconds value.
 */

import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { dashboardApi, type DashboardSummary, type MessageVolumeData } from '@/api/dashboard'
import { conversationApi } from '@/api/conversations'
import { presenceApi, type TeamPresenceDto } from '@/api/presence'
import { teamApi } from '@/api/team'
import { activitiesApi, type ActivityLog } from '@/api/activities'
import type { ConversationStats } from '@shared/api-contracts'
import type { TeamMember } from '@/types'
import { createVisibleInterval } from '@/utils/visibleInterval'

export type VolumeDays = 7 | 30 | 90

export interface Section<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<boolean>
}

const SUMMARY_REFRESH_MS = 60_000
// The server caches presence for 15 s; never poll faster
const PRESENCE_REFRESH_MS = 30_000
const CLOCK_TICK_MS = 30_000

function section<T>(): Section<T> {
  return { data: ref(null) as Ref<T | null>, loading: ref(true), error: ref(false) }
}

async function load<T>(target: Section<T>, fetcher: () => Promise<{ success: boolean; data?: T }>): Promise<void> {
  // Only the first load shows a skeleton; refreshes replace data silently
  if (target.data.value === null) { target.loading.value = true }
  try {
    const response = await fetcher()
    if (response.success && response.data !== undefined) {
      target.data.value = response.data
      target.error.value = false
    } else if (target.data.value === null) {
      target.error.value = true
    }
  } catch {
    if (target.data.value === null) { target.error.value = true }
  } finally {
    target.loading.value = false
  }
}

/** Seconds -> compact Chinese duration for wait times: 45 秒 / 42 分 / 3 小時 5 分 */
export function formatWait(seconds: number): { value: string; unit: string } {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) { return { value: String(s), unit: '秒' } }
  const m = Math.floor(s / 60)
  if (m < 60) { return { value: String(m), unit: '分' } }
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? { value: String(h), unit: '小時' } : { value: `${h} 小時 ${rest}`, unit: '分' }
}

export function formatWaitText(seconds: number): string {
  const { value, unit } = formatWait(seconds)
  return `${value} ${unit}`
}

/** Today vs yesterday-same-time as a delta label; null when there is nothing to compare */
export function compareDelta(today: number, yesterday: number): { text: string; direction: 'up' | 'down' | 'flat' } | null {
  if (yesterday === 0) {
    if (today === 0) { return null }
    return { text: `+${today}`, direction: 'up' }
  }
  const pct = Math.round(((today - yesterday) / yesterday) * 100)
  if (pct === 0) { return { text: '持平', direction: 'flat' } }
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, direction: pct > 0 ? 'up' : 'down' }
}

export function useDashboardOverview() {
  const summary = section<DashboardSummary>()
  const volume = section<MessageVolumeData>()
  const stats = section<ConversationStats>()
  const presence = section<TeamPresenceDto>()
  const members = section<TeamMember[]>()
  const teamNames = ref<Record<number, string>>({})
  const activities = section<ActivityLog[]>()
  const volumeDays = ref<VolumeDays>(7)

  // Live clock for wait times (recomputed from timestamps)
  const now = ref(Date.now())

  const loadSummary = () => load(summary, () => dashboardApi.getSummary())
  const loadVolume = () => load(volume, () => dashboardApi.getMessageVolume(volumeDays.value))
  const loadStats = () => load(stats, () => conversationApi.getStats())
  const loadPresence = () => load(presence, () => presenceApi.getTeamPresence())
  const loadMembers = () => load(members, () => teamApi.getMembers())
  const loadActivities = () => load(activities, async () => {
    const response = await activitiesApi.list({ page: 1, pageSize: 5 })
    return { success: response.success, data: response.data?.items }
  })
  const loadTeamNames = async (): Promise<void> => {
    try {
      const response = await teamApi.getTeams()
      if (response.success && response.data) {
        const map: Record<number, string> = {}
        for (const t of response.data) { map[t.id] = t.name }
        teamNames.value = map
      }
    } catch {
      // Names fall back to the agent's own teams in the view
    }
  }

  const setVolumeDays = async (days: VolumeDays): Promise<void> => {
    if (volumeDays.value === days) { return }
    volumeDays.value = days
    // Switching range shows the skeleton for the new range
    volume.data.value = null
    await loadVolume()
  }

  const refresh = async (): Promise<void> => {
    await Promise.all([loadSummary(), loadVolume(), loadStats(), loadPresence(), loadActivities()])
  }

  // Polling stops while the tab is hidden and refreshes once on return (D1 is billed per row read).
  const refreshSummary = (): void => { void Promise.all([loadSummary(), loadStats()]) }
  const summaryPoll = createVisibleInterval(refreshSummary, SUMMARY_REFRESH_MS, { onVisible: refreshSummary })
  const presencePoll = createVisibleInterval(() => { void loadPresence() }, PRESENCE_REFRESH_MS, {
    onVisible: () => { void loadPresence() }
  })
  let clockTimer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    void Promise.all([refresh(), loadMembers(), loadTeamNames()])
    summaryPoll.start()
    presencePoll.start()
    clockTimer = setInterval(() => { now.value = Date.now() }, CLOCK_TICK_MS)
  })

  onUnmounted(() => {
    summaryPoll.stop()
    presencePoll.stop()
    if (clockTimer) { clearInterval(clockTimer) }
  })

  /** Wait in seconds, recomputed live from the backend's waitingSince */
  const waitSeconds = (since: string): number => Math.max(0, (now.value - Date.parse(since)) / 1000)

  const waitingCount = computed(() => summary.data.value?.waiting.count ?? 0)
  const oldestWaitSeconds = computed(() => {
    const since = summary.data.value?.waiting.oldestWaitingSince
    return since ? waitSeconds(since) : null
  })

  const onlineIds = computed(() => new Set((presence.data.value?.onlineAgentIds ?? []).map(String)))

  const activeMembers = computed(() => (members.data.value ?? []).filter((m) => m.status === 'active'))

  return {
    summary, volume, stats, presence, members, activities,
    teamNames, volumeDays, now,
    waitingCount, oldestWaitSeconds, waitSeconds, onlineIds, activeMembers,
    setVolumeDays, refresh
  }
}
