import { beforeEach, describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { TeamMember } from '@/types'
import { compareDelta, formatWait, formatWaitText, useDashboardOverview } from './useDashboardOverview'

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getMessageVolume: vi.fn(),
  getStats: vi.fn(),
  getTeamPresence: vi.fn(),
  getMembers: vi.fn(),
  getTeamMembersByTeam: vi.fn(),
  getTeams: vi.fn(),
  list: vi.fn()
}))

vi.mock('@/api/dashboard', () => ({
  dashboardApi: { getSummary: api.getSummary, getMessageVolume: api.getMessageVolume }
}))
vi.mock('@/api/conversations', () => ({ conversationApi: { getStats: api.getStats } }))
vi.mock('@/api/presence', () => ({ presenceApi: { getTeamPresence: api.getTeamPresence } }))
vi.mock('@/api/team', () => ({
  teamApi: {
    getMembers: api.getMembers,
    getTeamMembersByTeam: api.getTeamMembersByTeam,
    getTeams: api.getTeams
  }
}))
vi.mock('@/api/activities', () => ({ activitiesApi: { list: api.list } }))

describe('dashboard overview helpers', () => {
  it('formats waits in seconds, minutes and hours', () => {
    expect(formatWait(45)).toEqual({ value: '45', unit: '秒' })
    expect(formatWait(2520)).toEqual({ value: '42', unit: '分' })
    expect(formatWaitText(3 * 3600 + 5 * 60)).toBe('3 小時 5 分')
  })

  it('compares today with yesterday at the same time', () => {
    expect(compareDelta(0, 0)).toBeNull()
    expect(compareDelta(5, 0)).toEqual({ text: '+5', direction: 'up' })
    expect(compareDelta(248, 219)).toEqual({ text: '+13%', direction: 'up' })
    expect(compareDelta(10, 10)).toEqual({ text: '持平', direction: 'flat' })
    expect(compareDelta(5, 10)?.direction).toBe('down')
  })
})

describe('dashboard overview loading', () => {
  const ok = <T>(data: T) => ({ success: true, data })
  const member = (id: string) => ({ id, status: 'active' }) as TeamMember
  const volumeOf = (days: number) => ({ days })

  const mountOverview = async () => {
    let overview!: ReturnType<typeof useDashboardOverview>
    const wrapper = mount(defineComponent({
      setup() {
        overview = useDashboardOverview()
        return () => null
      }
    }))
    await flushPromises()
    return { overview, wrapper }
  }

  const signIn = (role: 'admin' | 'agent', teamIds: number[] = []) => {
    const auth = useAuthStore()
    auth.currentAgent = { role } as never
    auth.allowedTeamIds = teamIds
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.getSummary.mockResolvedValue({ success: false })
    api.getMessageVolume.mockResolvedValue(ok(volumeOf(7)))
    api.getStats.mockResolvedValue({ success: false })
    api.getTeamPresence.mockResolvedValue({ success: false })
    api.getMembers.mockResolvedValue(ok([]))
    api.getTeams.mockResolvedValue({ success: false })
    api.list.mockResolvedValue({ success: false })
  })

  it('reads the all-members endpoint for admins', async () => {
    signIn('admin')
    api.getMembers.mockResolvedValue(ok([member('a')]))

    const { overview, wrapper } = await mountOverview()

    expect(api.getTeamMembersByTeam).not.toHaveBeenCalled()
    expect(overview.members.data.value).toHaveLength(1)
    wrapper.unmount()
  })

  it('reads each own team for agents, de-duplicating people in several teams', async () => {
    signIn('agent', [1, 2])
    api.getTeamMembersByTeam.mockImplementation(async (id: number) =>
      id === 1 ? ok([member('a'), member('b')]) : ok([member('b'), member('c')]))

    const { overview, wrapper } = await mountOverview()

    expect(api.getMembers).not.toHaveBeenCalled()
    expect(overview.members.data.value?.map((m) => m.id)).toEqual(['a', 'b', 'c'])
    expect(overview.members.error.value).toBe(false)
    wrapper.unmount()
  })

  it('shows an empty roster, not an error, for an agent with no teams', async () => {
    signIn('agent')

    const { overview, wrapper } = await mountOverview()

    expect(overview.members.data.value).toEqual([])
    expect(overview.members.error.value).toBe(false)
    wrapper.unmount()
  })

  it('errors only when every team request failed', async () => {
    signIn('agent', [1, 2])
    api.getTeamMembersByTeam.mockResolvedValue({ success: false })

    const { overview, wrapper } = await mountOverview()

    expect(overview.members.error.value).toBe(true)
    wrapper.unmount()
  })

  it('keeps the newest range when an older volume response lands last', async () => {
    signIn('admin')
    const { overview, wrapper } = await mountOverview()

    let resolve30!: (_value: unknown) => void
    api.getMessageVolume.mockImplementation((days: number) => days === 30
      ? new Promise((resolve) => { resolve30 = resolve })
      : Promise.resolve(ok(volumeOf(days))))

    const first = overview.setVolumeDays(30)
    await overview.setVolumeDays(90)
    expect(overview.volume.loading.value).toBe(false)

    resolve30(ok(volumeOf(30)))
    await first

    expect(overview.volume.data.value).toEqual(volumeOf(90))
    wrapper.unmount()
  })

  it('stays loading while the newest range is pending, even if an older one lands', async () => {
    signIn('admin')
    const { overview, wrapper } = await mountOverview()

    const pending: Record<number, (_value: unknown) => void> = {}
    api.getMessageVolume.mockImplementation((days: number) =>
      new Promise((resolve) => { pending[days] = resolve }))

    const first = overview.setVolumeDays(30)
    const second = overview.setVolumeDays(90)
    pending[30]?.(ok(volumeOf(30)))
    await first

    expect(overview.volume.data.value).toBeNull()
    expect(overview.volume.loading.value).toBe(true)

    pending[90]?.(ok(volumeOf(90)))
    await second
    expect(overview.volume.data.value).toEqual(volumeOf(90))
    wrapper.unmount()
  })
})
