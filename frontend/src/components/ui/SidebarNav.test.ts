// 通知中心 must be reachable from the sidebar for every role (it holds the
// per-device desktop notification settings), and inserting it must not move
// 群發訊息 away from its spot right after 標籤管理.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SidebarNav from './SidebarNav.vue'

const auth = { currentAgent: { role: 'agent' } as { role: string } | null, teamRoles: {} as Record<string, string> }
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/dashboard' }) }))

function labels(role: string, teamRoles: Record<string, string> = {}) {
  auth.currentAgent = { role }
  auth.teamRoles = teamRoles
  const wrapper = mount(SidebarNav, {
    props: { sidebarCollapsed: false, isMobile: false },
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ExpandableNavGroup: { props: ['label'], template: '<div>{{ label }}</div>' }
      }
    }
  })
  return wrapper.findAll('a, div').map((el) => el.text()).filter(Boolean)
}

describe('SidebarNav', () => {
  it('shows 通知中心 right after 對話管理 for a regular agent', () => {
    const items = labels('agent')
    expect(items.slice(0, 4)).toEqual(['儀表板', '對話管理', '通知中心', '標籤管理'])
    expect(items).not.toContain('系統設定')
  })

  it('keeps 群發訊息 right after 標籤管理 for a team lead', () => {
    const items = labels('agent', { 1: 'lead' })
    expect(items.indexOf('群發訊息')).toBe(items.indexOf('標籤管理') + 1)
    expect(items).toContain('通知中心')
  })

  it('shows 通知中心 and keeps 群發訊息 after 標籤管理 for an admin', () => {
    const items = labels('admin')
    expect(items).toContain('通知中心')
    expect(items).toContain('系統設定')
    expect(items.indexOf('群發訊息')).toBe(items.indexOf('標籤管理') + 1)
  })
})
