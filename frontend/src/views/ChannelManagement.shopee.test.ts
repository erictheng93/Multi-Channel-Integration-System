import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChannelManagement from './ChannelManagement.vue'
import { useAuthStore } from '@/stores/auth'

const h = vi.hoisted(() => ({ list: vi.fn(), authUrl: vi.fn(), success: vi.fn(), error: vi.fn(), replace: vi.fn(), query: {} as Record<string, string> }))

vi.mock('@/api/channels', async (orig) => ({ ...(await orig<object>()), channelsApi: { list: h.list }, getShopeeAuthorizeUrl: h.authUrl }))
vi.mock('@/composables/useToast', () => ({ default: { success: h.success, error: h.error } }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: h.query }), useRouter: () => ({ push: vi.fn(), replace: h.replace }) }))
vi.mock('@/stores/team', () => ({ useTeamStore: () => ({ teams: [], loadTeams: vi.fn() }) }))

const shop = (authStatus: string) => ({
  id: 7, teamId: 3, platform: 'shopee', isActive: true, isVerified: true, errorCount: 0, createdAt: '', updatedAt: '',
  config: JSON.stringify({ shopId: 555, env: 'sandbox', shopName: '測試商店', authStatus })
})

async function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().currentAgent = { role: 'admin' } as never
  const wrapper = mount(ChannelManagement, { global: { plugins: [pinia], stubs: { AppLayout: { template: '<div><slot /></div>' }, ChannelConfigDialog: true, ChannelDetailsModal: true, ChannelBalance: true } } })
  await flushPromises()
  return wrapper
}

describe('ChannelManagement Shopee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.query = {}
    Object.defineProperty(window, 'location', { value: { assign: vi.fn() }, configurable: true })
  })

  it('shows status labels and reauthorizes via the authorize-url endpoint', async () => {
    h.list.mockResolvedValue({ success: true, data: [shop('reauth_required')] })
    h.authUrl.mockResolvedValue('https://shopee.example/auth')
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('需要重新授權')
    expect(wrapper.text()).toContain('測試商店')
    const btn = wrapper.findAll('button').find(b => b.text() === '重新授權')!
    await btn.trigger('click')
    await flushPromises()
    expect(h.authUrl).toHaveBeenCalledWith(3)
    expect(window.location.assign).toHaveBeenCalledWith('https://shopee.example/auth')
  })

  it('offers no reauthorize action when active', async () => {
    h.list.mockResolvedValue({ success: true, data: [shop('active')] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('已授權')
    expect(wrapper.findAll('button').some(b => b.text() === '重新授權')).toBe(false)
  })

  it('shows a notice from ?shopee=error and cleans the query', async () => {
    h.list.mockResolvedValue({ success: true, data: [] })
    h.query = { shopee: 'error', reason: 'access_denied', keep: '1' }
    await mountPage()
    expect(h.error).toHaveBeenCalledWith('蝦皮授權失敗', expect.any(String))
    expect(h.replace).toHaveBeenCalledWith({ query: { keep: '1' } })
  })
})
