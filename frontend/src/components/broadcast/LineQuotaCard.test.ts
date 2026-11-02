import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import LineQuotaCard from './LineQuotaCard.vue'
import type { LineQuotaChannel, LineQuotaSnapshot } from '@/api/broadcasts'

const api = vi.hoisted(() => ({ getLineQuota: vi.fn(), refreshLineQuota: vi.fn() }))
const toast = vi.hoisted(() => ({ showError: vi.fn(), showSuccess: vi.fn() }))

vi.mock('@/api/broadcasts', () => api)
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

const channel: LineQuotaChannel = {
  channelKey: 'k1',
  label: '業務團隊',
  limited: true,
  limit: 10000,
  used: 8120,
  remaining: 1880,
  reserve: 2000,
  usableRemaining: 0,
  fetchedAt: '2026-10-12T18:00:00.000Z',
  error: null
}

const snapshot = (overrides: Partial<LineQuotaSnapshot> = {}): LineQuotaSnapshot => ({
  items: [channel],
  updatedAt: '2026-10-12T18:00:00.000Z',
  source: 'cron',
  throttled: false,
  ...overrides
})

describe('LineQuotaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLineQuota.mockResolvedValue(snapshot())
  })

  it('renders used / limit / remaining and the bar percentage', async () => {
    const wrapper = mount(LineQuotaCard)
    await flushPromises()

    expect(wrapper.text()).toContain('8,120 / 10,000')
    expect(wrapper.text()).toContain('剩餘 1,880')
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('8120')
    expect(wrapper.find('.bar-fill').attributes('style')).toContain('width: 81%')
    expect(wrapper.find('.bar-fill').classes()).toContain('warn')
  })

  it('shows only usage, with no bar, for an unlimited channel', async () => {
    api.getLineQuota.mockResolvedValue(
      snapshot({
        items: [
          { channelKey: 'k', label: '系統預設', limited: false, limit: null, used: 4300, remaining: null, reserve: null, usableRemaining: null, fetchedAt: null, error: null }
        ]
      })
    )
    const wrapper = mount(LineQuotaCard)
    await flushPromises()

    expect(wrapper.text()).toContain('已用 4,300（不限額）')
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
  })

  it('shows the empty state before the first poll', async () => {
    api.getLineQuota.mockResolvedValue(snapshot({ items: [], updatedAt: null, source: null }))
    const wrapper = mount(LineQuotaCard)
    await flushPromises()

    expect(wrapper.text()).toContain('尚未查詢過額度')
    expect(wrapper.text()).toContain('尚無查詢紀錄')
  })

  it('keeps the old numbers visible while a manual refresh is in flight', async () => {
    const refreshed = snapshot({ items: [{ ...channel, used: 9000, remaining: 1000 }], source: 'manual' })
    let finishRefresh!: () => void
    api.refreshLineQuota.mockReturnValue(
      new Promise<LineQuotaSnapshot>((resolve) => { finishRefresh = () => resolve(refreshed) })
    )
    const wrapper = mount(LineQuotaCard)
    await flushPromises()

    await wrapper.find('button').trigger('click')

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('8,120 / 10,000')

    finishRefresh()
    await flushPromises()

    expect(wrapper.text()).toContain('9,000 / 10,000')
    expect(wrapper.text()).toContain('手動查詢')
  })

  it('toasts and keeps the previous numbers when the refresh fails', async () => {
    api.refreshLineQuota.mockRejectedValue(new Error('boom'))
    const wrapper = mount(LineQuotaCard)
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(toast.showError).toHaveBeenCalledWith('boom')
    expect(wrapper.text()).toContain('8,120 / 10,000')
  })

  it('flags a channel whose latest poll failed', async () => {
    api.getLineQuota.mockResolvedValue(
      snapshot({ items: [{ ...channel, error: 'API error: 401' }] })
    )
    const wrapper = mount(LineQuotaCard)
    await flushPromises()

    expect(wrapper.text()).toContain('本次查詢失敗')
  })
})
