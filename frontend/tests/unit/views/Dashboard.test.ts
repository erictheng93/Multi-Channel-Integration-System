/**
 * Dashboard.vue unit tests (real-data dashboard)
 *
 * - 待回覆 (team-wide) comes from /dashboard/summary.waiting and is labelled with its definition
 * - 我的未讀 (personal) appears only as its own labelled sentence
 * - wait times are recomputed from waitingSince
 * - loading / empty / error states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import Dashboard from '@/views/Dashboard.vue'

const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString()

const summaryFixture = () => ({
  timezone: 'Asia/Taipei',
  dayStart: minutesAgo(300),
  generatedAt: minutesAgo(0),
  customerMessages: { today: 248, yesterdaySameTime: 219 },
  resolved: { today: 31, yesterdaySameTime: 27 },
  openConversations: 23,
  waiting: {
    count: 9,
    oldestWaitingSince: minutesAgo(42.5),
    oldestWaitingSeconds: 2520,
    top: [
      { conversationId: 'c1', customerId: 1, customerName: '黃建國', avatarUrl: null, platform: 'line', assignedTeamId: null, waitingSince: minutesAgo(42.5), waitingSeconds: 2520, unansweredCount: 2, lastCustomerMessage: '請問有沒有 #240？' },
      { conversationId: 'c2', customerId: 2, customerName: '林志明', avatarUrl: null, platform: 'facebook', assignedTeamId: 1, waitingSince: minutesAgo(5.5), waitingSeconds: 300, unansweredCount: 1, lastCustomerMessage: '好的' }
    ]
  },
  staleWaiting: { count: 119, neverRepliedCount: 24 },
  firstResponse: { today: { count: 14, avgSeconds: 190 }, yesterdaySameTime: { count: 11, avgSeconds: 240 } }
})

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getMessageVolume: vi.fn(),
  getStats: vi.fn(),
  getTeamPresence: vi.fn(),
  getMembers: vi.fn(),
  getTeams: vi.fn(),
  listActivities: vi.fn()
}))

vi.mock('@/api/dashboard', () => ({ dashboardApi: { getSummary: api.getSummary, getMessageVolume: api.getMessageVolume } }))
vi.mock('@/api/conversations', () => ({ conversationApi: { getStats: api.getStats } }))
vi.mock('@/api/presence', () => ({ presenceApi: { getTeamPresence: api.getTeamPresence } }))
vi.mock('@/api/team', () => ({ teamApi: { getMembers: api.getMembers, getTeams: api.getTeams } }))
vi.mock('@/api/activities', () => ({ activitiesApi: { list: api.listActivities } }))

const unreadTotal = ref(0)
vi.mock('@/stores/unread', () => ({ useUnreadStore: () => ({ get total() { return unreadTotal.value } }) }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), currentRoute: ref({ path: '/dashboard' }) })
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    currentAgent: ref({ displayName: '陳怡君', name: '陳怡君', role: 'admin', teams: [{ id: 1, name: '客服一組', isPrimary: true, roleInTeam: 'lead' }] }),
    isAdmin: ref(true)
  })
}))
vi.mock('@/composables/useTokenRefresh', () => ({ useTokenRefresh: () => ({ startTokenRefreshCheck: vi.fn(), stopTokenRefreshCheck: vi.fn() }) }))
vi.mock('@/composables/useActivityTracker', () => ({ useActivityTracker: () => ({ startTracking: vi.fn(), stopTracking: vi.fn() }) }))

const volumeFixture = (days: number) => ({
  timezone: 'Asia/Taipei', days, generatedAt: minutesAgo(0),
  current: Array.from({ length: days }, (_, i) => ({ date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, line: 10, facebook: 2, other: 0, total: 12 })),
  previous: Array.from({ length: days }, (_, i) => ({ date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, line: 8, facebook: 1, other: 0, total: 9 })),
  totals: { current: 12 * days, previous: 9 * days }
})

const ok = <T,>(data: T) => Promise.resolve({ success: true, data })

function mountDashboard() {
  return mount(Dashboard, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        'router-link': { props: ['to'], template: '<a><slot /></a>' }
      }
    }
  })
}

describe('Dashboard.vue', () => {
  beforeEach(() => {
    unreadTotal.value = 0
    api.getSummary.mockImplementation(() => ok(summaryFixture()))
    api.getMessageVolume.mockImplementation((days: number) => ok(volumeFixture(days)))
    api.getStats.mockImplementation(() => ok({ total: 30, open: 23, closed: 7, byTeam: [{ teamId: 1, open: 15, closed: 2 }, { teamId: null, open: 8, closed: 5 }], unreadConversations: 4 }))
    api.getTeamPresence.mockImplementation(() => ok({ onlineAgentIds: ['m1'], self: { id: 'm1', registered: true }, generatedAt: Date.now(), available: true }))
    api.getMembers.mockImplementation(() => ok([
      { id: 'm1', name: '陳怡君', email: 'a@x', role: 'agent', status: 'active', primaryTeamName: '客服一組', teams: [{ teamId: 1, teamName: '客服一組', roleInTeam: 'lead', isPrimary: true }] },
      { id: 'm2', name: '許家瑋', email: 'b@x', role: 'agent', status: 'active', teams: [] }
    ]))
    api.getTeams.mockImplementation(() => ok([{ id: 1, name: '客服一組' }]))
    api.listActivities.mockImplementation(() => ok({ items: [], total: 0, page: 1, pageSize: 5, totalPages: 0 }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('greets the agent and states 待回覆 from the summary, not from unread', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('.ui-page-title').text()).toContain('陳怡君')
    const sub = wrapper.find('.ui-page-sub').text()
    expect(sub).toContain('9 件待回覆')
    expect(sub).toContain('最久已等 42 分')
    expect(sub).not.toContain('未讀')
  })

  it('labels personal unread as 我的未讀 when there is any', async () => {
    unreadTotal.value = 4
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('.ui-page-sub').text()).toContain('我的未讀 4 件')
  })

  it('shows the KPI row from real numbers with the 待回覆 definition', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    const kpis = wrapper.findAll('.ui-kpi')
    expect(kpis).toHaveLength(4)
    expect(kpis[0].text()).toContain('待回覆')
    expect(kpis[0].find('.ui-kpi-value').text()).toBe('9')
    expect(kpis[0].text()).toContain('尚無客服回覆')
    expect(kpis[1].find('.ui-kpi-value').text()).toBe('23')
    expect(kpis[1].text()).toContain('客服一組 15')
    expect(kpis[1].text()).toContain('未指派 8')
    expect(kpis[2].find('.ui-kpi-value').text()).toBe('248')
    expect(kpis[2].text()).toContain('+13%')
    expect(kpis[3].find('.ui-kpi-value').text()).toContain('1')
  })

  it('lists the longest-waiting conversations with live wait times', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    const rows = wrapper.findAll('.focus .ui-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('黃建國')
    expect(rows[0].text()).toContain('未指派')
    expect(rows[0].find('.wait').text()).toBe('42 分')
    expect(rows[0].find('.wait').classes()).toContain('hot')
    expect(rows[1].find('.wait').text()).toBe('5 分')
    expect(wrapper.find('.focus-lead .big').text()).toContain('42')
  })

  it('does not show satisfaction, per-agent load or away state', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.text()).not.toContain('滿意度')
    expect(wrapper.text()).not.toContain('暫離')
    expect(wrapper.text()).not.toContain('每人上限')
  })

  it('shows team members as online or offline only', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    const people = wrapper.findAll('.person')
    expect(people).toHaveLength(2)
    expect(people[0].text()).toContain('陳怡君')
    expect(people[0].text()).toContain('在線')
    expect(people[1].text()).toContain('離線')
  })

  it('switching the volume range asks the API for that many days', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(api.getMessageVolume).toHaveBeenLastCalledWith(7)
    const tab = wrapper.findAll('.ui-seg button').find(b => b.text() === '30 天')
    await tab!.trigger('click')
    await flushPromises()
    expect(api.getMessageVolume).toHaveBeenLastCalledWith(30)
  })

  it('renders designed empty states when nothing is waiting', async () => {
    api.getSummary.mockImplementation(() => ok({
      ...summaryFixture(),
      customerMessages: { today: 0, yesterdaySameTime: 0 },
      openConversations: 0,
      waiting: { count: 0, oldestWaitingSince: null, oldestWaitingSeconds: null, top: [] },
      firstResponse: { today: { count: 0, avgSeconds: null }, yesterdaySameTime: { count: 0, avgSeconds: null } }
    }))
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('.ui-page-sub').text()).toContain('近 7 天內沒有待回覆的客戶')
    expect(wrapper.find('.focus .ui-empty').text()).toContain('目前沒有待回覆的客戶')
  })

  it('states the 7-day window on the 待回覆 KPI and the focus card', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('.ui-kpi-foot[title^="待回覆"]').text()).toContain('近 7 天內')
    expect(wrapper.find('.focus-lead .info-tip').text()).toContain('近 7 天內')
  })

  it('points to the stale list under the 等待最久 card, with the never-replied count', async () => {
    const wrapper = mountDashboard()
    await flushPromises()
    const link = wrapper.find('[data-testid="stale-waiting-link"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('另有 119 件超過 7 天未回覆，其中 24 位從未獲得回覆 →')
  })

  it('omits the never-replied clause when everyone got a reply, and hides the line at zero', async () => {
    api.getSummary.mockImplementation(() => ok({ ...summaryFixture(), staleWaiting: { count: 3, neverRepliedCount: 0 } }))
    const some = mountDashboard()
    await flushPromises()
    expect(some.find('[data-testid="stale-waiting-link"]').text()).toBe('另有 3 件超過 7 天未回覆 →')

    api.getSummary.mockImplementation(() => ok({ ...summaryFixture(), staleWaiting: { count: 0, neverRepliedCount: 0 } }))
    const none = mountDashboard()
    await flushPromises()
    expect(none.find('[data-testid="stale-waiting-link"]').exists()).toBe(false)
  })

  it('does not break on a cached summary without staleWaiting', async () => {
    const { staleWaiting: _omitted, ...legacy } = summaryFixture()
    api.getSummary.mockImplementation(() => ok(legacy))
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('[data-testid="stale-waiting-link"]').exists()).toBe(false)
  })

  it('shows system-initiated activity as 系統, not as a member name', async () => {
    api.listActivities.mockImplementation(() => ok({
      items: [{ id: 1, userId: 'system', userName: 'System', userRole: 'system', action: 'conversation_auto_close', resourceType: 'conversation', createdAt: minutesAgo(5) }],
      total: 1, page: 1, pageSize: 5, totalPages: 1
    }))
    const wrapper = mountDashboard()
    await flushPromises()
    const row = wrapper.find('.feed li')
    expect(row.text()).toContain('系統')
    expect(row.text()).not.toContain('System')
    expect(row.find('.ico-tile').classes()).toContain('tone-system')
  })

  it('shows an error state with retry when the summary fails', async () => {
    api.getSummary.mockImplementation(() => Promise.resolve({ success: false, error: 'boom' }))
    const wrapper = mountDashboard()
    await flushPromises()
    expect(wrapper.find('.focus .ui-empty').text()).toContain('無法載入待回覆清單')
    const callsBefore = api.getSummary.mock.calls.length
    await wrapper.find('.focus .ui-empty button').trigger('click')
    await flushPromises()
    expect(api.getSummary.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})
