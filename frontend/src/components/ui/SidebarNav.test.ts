// 通知 must be reachable from the sidebar for every role (it holds the
// per-device desktop notification settings), and inserting it must not move
// 群發訊息 away from its spot right after 客戶標籤.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SidebarNav from './SidebarNav.vue'

const auth = { currentAgent: { role: 'agent' } as { role: string } | null, teamRoles: {} as Record<string, string> }
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/stores/unread', () => ({ useUnreadStore: () => ({ total: 4 }) }))
vi.mock('@/stores/notifications', () => ({ useNotificationsStore: () => ({ unreadCount: 2 }) }))
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
  return wrapper.findAll('a, div').map((el) => el.find('.nav-text').exists() ? el.find('.nav-text').text() : el.text()).filter(Boolean)
}

describe('SidebarNav', () => {
  it('shows 通知 right after 對話 for a regular agent', () => {
    const items = labels('agent')
    expect(items.slice(0, 4)).toEqual(['儀表板', '對話', '通知', '客戶標籤'])
    expect(items).not.toContain('系統設定')
  })

  it('keeps 群發訊息 right after 客戶標籤 for an agent with no team role', () => {
    const items = labels('agent', {})
    expect(items.indexOf('群發訊息')).toBe(items.indexOf('客戶標籤') + 1)
    expect(items).toContain('通知')
  })

  it('shows 通知 and keeps 群發訊息 after 客戶標籤 for an admin', () => {
    const items = labels('admin')
    expect(items).toContain('通知')
    expect(items).toContain('系統設定')
    expect(items.indexOf('群發訊息')).toBe(items.indexOf('客戶標籤') + 1)
  })

  it('shows 未讀 and notification counts as badges with a definition tooltip', () => {
    const wrapper = mount(SidebarNav, {
      props: { sidebarCollapsed: false, isMobile: false },
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, ExpandableNavGroup: true } }
    })
    const counts = wrapper.findAll('.nav-count')
    expect(counts.map((c) => c.text())).toEqual(['4', '2'])
    expect(counts[0]?.attributes('title')).toBe('未讀對話：你尚未開啟')
  })
})
