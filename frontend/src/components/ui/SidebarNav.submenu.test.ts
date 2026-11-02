// A section's parent row collapses and reopens its submenu in place; only another section's row navigates.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SidebarNav from './SidebarNav.vue'

const route = { path: '/reports/dashboard' }
const push = vi.fn()
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ currentAgent: { role: 'agent' }, teamRoles: {} }) }))
vi.mock('@/stores/unread', () => ({ useUnreadStore: () => ({ total: 0 }) }))
vi.mock('@/stores/notifications', () => ({ useNotificationsStore: () => ({ unreadCount: 0 }) }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push }) }))

function mountAt(path: string) {
  route.path = path
  const wrapper = mount(SidebarNav, {
    props: { sidebarCollapsed: false, isMobile: false },
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ExpandableNavGroup: {
          props: ['label', 'expanded'],
          emits: ['toggle'],
          template: '<button class="group-row" :data-label="label" :aria-expanded="expanded" @click="$emit(\'toggle\')" />'
        }
      }
    }
  })
  const row = wrapper.find('.group-row[data-label="報表"]')
  return { wrapper, row }
}

describe('SidebarNav submenus', () => {
  beforeEach(() => {
    push.mockClear()
  })

  it('reopens the current section after collapsing it, on its first child', async () => {
    const { row } = mountAt('/reports/dashboard')
    expect(row.attributes('aria-expanded')).toBe('true')

    await row.trigger('click')
    expect(row.attributes('aria-expanded')).toBe('false')

    await row.trigger('click')
    expect(row.attributes('aria-expanded')).toBe('true')
    expect(push).not.toHaveBeenCalled()
  })

  it('stays on the current page when reopening from a later child', async () => {
    const { row } = mountAt('/reports/templates')

    await row.trigger('click')
    await row.trigger('click')

    expect(row.attributes('aria-expanded')).toBe('true')
    expect(push).not.toHaveBeenCalled()
  })

  it("navigates to another section's first child", async () => {
    const { row } = mountAt('/dashboard')

    await row.trigger('click')

    expect(push).toHaveBeenCalledWith('/reports/dashboard')
  })
})
