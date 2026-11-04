// Leaving the page while its first requests are in flight must not leave anything behind: the store is
// shared, so a late default-detail load or a surviving resize listener would overwrite it from a dead page.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import BroadcastView from './BroadcastView.vue'

const broadcasts = vi.hoisted(() => ({
  broadcasts: [{ id: 'b1', content: 'hello' }],
  fetchBroadcasts: vi.fn(),
  fetchBroadcast: vi.fn(),
  fetchRecipients: vi.fn()
}))
vi.mock('@/stores/broadcasts', () => ({ useBroadcastsStore: () => broadcasts }))
vi.mock('@/stores/tags', () => ({ useTagsStore: () => ({ tags: [], fetchTags: vi.fn().mockResolvedValue(undefined) }) }))

type ChangeListener = (_event: { matches: boolean }) => void

describe('BroadcastView leaving during the first load', () => {
  let listeners: Set<ChangeListener>

  beforeEach(() => {
    vi.clearAllMocks()
    listeners = new Set()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width: 1281px'),
      addEventListener: (_type: string, fn: ChangeListener) => listeners.add(fn),
      removeEventListener: (_type: string, fn: ChangeListener) => listeners.delete(fn)
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('leaves no media-query listener and does not load the default detail', async () => {
    let finishLoad!: () => void
    broadcasts.fetchBroadcasts.mockReturnValueOnce(new Promise<void>((resolve) => { finishLoad = resolve }))

    const wrapper = shallowMount(BroadcastView)
    wrapper.unmount()
    finishLoad()
    await flushPromises()

    expect(listeners.size).toBe(0)
    expect(broadcasts.fetchBroadcast).not.toHaveBeenCalled()
  })

  it('still opens the newest broadcast on a wide screen when the page stays', async () => {
    broadcasts.fetchBroadcasts.mockResolvedValueOnce(undefined)

    const wrapper = shallowMount(BroadcastView)
    await flushPromises()

    expect(broadcasts.fetchBroadcast).toHaveBeenCalledWith('b1')
    wrapper.unmount()
  })

  it('puts the composer and the log in two cards, with a phone-only bar that opens the composer', async () => {
    broadcasts.fetchBroadcasts.mockResolvedValueOnce(undefined)

    const wrapper = shallowMount(BroadcastView, { global: { stubs: { AppLayout: { template: '<div><slot /></div>' } } } })
    await flushPromises()

    expect(wrapper.findAll('section.ui-card').map(card => card.classes())).toEqual([
      expect.arrayContaining(['bench']),
      expect.arrayContaining(['log'])
    ])
    const toggle = wrapper.find('.bench-bar button')
    expect(toggle.text()).toBe('新增群發')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.find('.bench').classes()).toContain('is-open')
    expect(wrapper.find('.bench-bar button').text()).toBe('收合')
    wrapper.unmount()
  })
})
