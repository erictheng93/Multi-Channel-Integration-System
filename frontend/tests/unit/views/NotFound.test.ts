import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type * as pinia from 'pinia'

const state = { isAuthenticated: ref(true), isAdmin: ref(false) }

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => state
}))
vi.mock('pinia', async (importOriginal) => ({
  ...(await importOriginal<typeof pinia>()),
  storeToRefs: (store: typeof state) => store
}))
const current = { path: '/conversations/archive-2025', fullPath: '/conversations/archive-2025?x=1' }
const push = vi.fn()
// Only these paths exist; everything else resolves to the catch-all NotFound route
const KNOWN = new Set(['/conversations', '/conversations/archive-2025', '/settings', '/settings/general', '/tags'])

vi.mock('vue-router', () => ({
  useRoute: () => current,
  useRouter: () => ({
    go: vi.fn(),
    push,
    resolve: (path: string) => ({ matched: [{ name: KNOWN.has(path) ? 'Page' : 'NotFound' }] })
  })
}))
vi.mock('@/components/ui/AppLayout.vue', () => ({
  default: { template: '<div class="shell"><slot /></div>' }
}))

import NotFound from '@/views/NotFound.vue'

function mountPage() {
  return mount(NotFound, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } }
  })
}

const hrefs = (wrapper: ReturnType<typeof mountPage>) => wrapper.findAll('.find-item').map(a => a.attributes('href'))

describe('NotFound.vue', () => {
  beforeEach(() => {
    state.isAuthenticated.value = true
    state.isAdmin.value = false
    current.path = '/conversations/archive-2025'
    current.fullPath = '/conversations/archive-2025?x=1'
    push.mockClear()
  })

  it('shows the path the user asked for, with the query kept apart', () => {
    const wrapper = mountPage()
    expect(wrapper.find('.trace-path').text()).toBe('/conversations/archive-2025?x=1')
    expect(wrapper.find('.trace-extra').text()).toBe('?x=1')
  })

  it('lists only pages the role can open', async () => {
    expect(hrefs(mountPage())).not.toContain('/team')
    expect(hrefs(mountPage())).toContain('/conversations')

    // the first six are offered up front; the rest sit behind "show all"
    expect(hrefs(mountPage())).toHaveLength(6)

    state.isAdmin.value = true
    const wrapper = mountPage()
    expect(hrefs(wrapper)).not.toContain('/team')
    await wrapper.find('.find-more').trigger('click')
    expect(hrefs(wrapper)).toEqual(expect.arrayContaining(['/team', '/settings', '/monitoring/api']))
  })

  it('names the first part of the address that does not exist and keeps the good prefix', () => {
    current.path = '/settings/gneral'
    current.fullPath = '/settings/gneral'
    state.isAdmin.value = true
    const wrapper = mountPage()
    expect(wrapper.find('.seg.is-ok').text()).toBe('settings')
    expect(wrapper.find('.seg.is-bad').text()).toBe('gneral')
    expect(wrapper.find('.trace-note').text()).toContain('/settings')
  })

  it('suggests the closest real page for a typo and says nothing when nothing is close', () => {
    current.path = '/conversation'
    current.fullPath = '/conversation'
    expect(mountPage().find('.guess').attributes('href')).toBe('/conversations')

    current.path = '/nope'
    current.fullPath = '/nope'
    expect(mountPage().find('.guess').exists()).toBe(false)
  })

  it('narrows the list as you type and opens the first match on Enter', async () => {
    current.path = '/nope'
    current.fullPath = '/nope'
    const wrapper = mountPage()
    const input = wrapper.find('#nf-search')
    await input.setValue('標籤')
    expect(hrefs(wrapper)).toEqual(['/tags'])
    await input.trigger('keydown.enter')
    expect(push).toHaveBeenCalledWith('/tags')
    await input.setValue('zzz')
    expect(wrapper.find('.find-empty').exists()).toBe(true)
  })

  it('offers no workspace pages when signed out', () => {
    state.isAuthenticated.value = false
    const wrapper = mountPage()
    expect(wrapper.findAll('.find-item')).toHaveLength(0)
    expect(wrapper.text()).toContain('前往登入')
  })
})
