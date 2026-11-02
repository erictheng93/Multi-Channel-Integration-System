// The section children live in the sidebar, which a collapsed desktop sidebar hides as well
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useSidebarState } from '@/composables/useSidebarState'
import UiSectionNav from './UiSectionNav.vue'

vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/reports/dashboard' }) }))

const mountNav = () =>
  mount(UiSectionNav, { props: { section: 'reports' }, global: { stubs: { RouterLink: true } } })

describe('UiSectionNav', () => {
  const { sidebarCollapsed } = useSidebarState()
  afterEach(() => { sidebarCollapsed.value = false })

  it('stays out of the way while the sidebar shows the children', () => {
    expect(mountNav().find('.ui-section-nav').classes()).not.toContain('is-sidebar-collapsed')
  })

  it('appears when the sidebar is collapsed', () => {
    sidebarCollapsed.value = true
    expect(mountNav().find('.ui-section-nav').classes()).toContain('is-sidebar-collapsed')
  })
})
