// On tablet the sidebar is always the icon rail, so everything that lives in it must stay reachable from there:
// the user menu (個人設定 / 登出 have no other entry point) and the children of each section.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SidebarUserProfile from './SidebarUserProfile.vue'
import dataExportSource from '@/components/data-management/DataExport.vue?raw'
import dataBackupSource from '@/components/data-management/DataBackup.vue?raw'

vi.mock('vue-router', () => ({ useRoute: () => reactive({ path: '/dashboard' }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ currentAgent: { name: 'Amy', role: 'agent' }, logout: vi.fn() })
}))
vi.mock('@/stores/websocket', () => ({ useWebSocketStore: () => ({}) }))
vi.mock('@/composables/useConnectionStatus', () => ({
  useConnectionStatus: () => ({ tone: 'online', label: '已連線' })
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showError: vi.fn() }) }))
vi.mock('@/composables/useConfirmDialog', () => ({ useConfirmDialog: () => ({ showInfo: vi.fn() }) }))

const mountRail = () => mount(SidebarUserProfile, { props: { sidebarCollapsed: true, isMobile: false } })

describe('tablet icon rail', () => {
  it('opens the user menu from the avatar', async () => {
    const wrapper = mountRail()
    expect(wrapper.find('.user-menu').exists()).toBe(false)

    await wrapper.find('.user-profile').trigger('click')

    expect(wrapper.text()).toContain('登出')
  })

  it('opens the user menu from the keyboard', async () => {
    const wrapper = mountRail()
    const profile = wrapper.find('.user-profile')
    expect(profile.attributes('tabindex')).toBe('0')

    await profile.trigger('keydown.enter')

    expect(wrapper.find('.user-menu').exists()).toBe(true)
  })

  it('offers the 資料管理 children inside both pages, like 報表 and 系統設定', () => {
    expect(dataExportSource).toContain('<UiSectionNav section="data" />')
    expect(dataBackupSource).toContain('<UiSectionNav section="data" />')
  })
})
