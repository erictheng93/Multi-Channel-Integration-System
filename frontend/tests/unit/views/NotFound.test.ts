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
vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/conversations/archive-2025?x=1' }),
  useRouter: () => ({ go: vi.fn(), push: vi.fn() })
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

describe('NotFound.vue', () => {
  beforeEach(() => {
    state.isAuthenticated.value = true
    state.isAdmin.value = false
  })

  it('shows the path the user asked for', () => {
    expect(mountPage().find('.asked .mono').text()).toBe('/conversations/archive-2025?x=1')
  })

  it('lists only links the role can open', () => {
    const agent = mountPage().findAll('.go').map(a => a.attributes('href'))
    expect(agent).toEqual(['/conversations', '/notifications', '/tags'])

    state.isAdmin.value = true
    const admin = mountPage().findAll('.go').map(a => a.attributes('href'))
    expect(admin).toContain('/settings')
  })

  it('offers no workspace links when signed out', () => {
    state.isAuthenticated.value = false
    const wrapper = mountPage()
    expect(wrapper.findAll('.go')).toHaveLength(0)
    expect(wrapper.text()).toContain('前往登入')
  })
})
