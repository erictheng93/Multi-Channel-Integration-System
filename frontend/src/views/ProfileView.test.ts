import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from './ProfileView.vue'
import { useAuthStore } from '@/stores/auth'

const { mockPut, mockShowSuccess, mockShowError } = vi.hoisted(() => ({
  mockPut: vi.fn(),
  mockShowSuccess: vi.fn(),
  mockShowError: vi.fn(),
}))

vi.mock('@/api/base', () => ({
  apiClient: {
    put: mockPut,
    getCurrentToken: vi.fn(() => null),
    removeAuthHeader: vi.fn(),
    setAuthHeader: vi.fn(),
  },
}))

vi.mock('@/api/auth', () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ hash: '' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/ui/AppLayout.vue', () => ({
  default: {
    template: '<div><slot /></div>',
  },
}))

describe('ProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('treats apiClient.put success body as a successful profile update', async () => {
    const authStore = useAuthStore()
    const agent = {
      id: 'agent-1',
      name: 'Olivia',
      displayName: 'Olivia',
      email: 'olivia@dacit.net',
      role: 'agent' as const,
      isActive: true,
      createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
    }
    authStore.currentAgent = agent

    mockPut.mockResolvedValue({
      success: true,
      data: {
        ...authStore.currentAgent,
        name: 'Olivia QA',
        displayName: 'Olivia QA',
      },
    })

    const wrapper = mount(ProfileView)
    await flushPromises()

    await wrapper.get('#display-name').setValue('Olivia QA')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mockPut).toHaveBeenCalledWith('/auth/me', { displayName: 'Olivia QA' })
    expect(mockShowSuccess).toHaveBeenCalledWith('已儲存', '個人資料已更新')
    expect(mockShowError).not.toHaveBeenCalled()
    expect(authStore.currentAgent?.displayName).toBe('Olivia QA')
  })
  it('draws one role ladder per team with the held role marked', async () => {
    const authStore = useAuthStore()
    authStore.currentAgent = {
      id: 'agent-2',
      name: 'Lee',
      displayName: 'Lee',
      email: 'lee@dacit.net',
      role: 'agent' as const,
      isActive: true,
      createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
      primaryTeamId: 1,
      teams: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      teamRoles: { 1: 'lead', 2: 'member' },
    } as never

    const wrapper = mount(ProfileView)
    await flushPromises()

    const ladders = wrapper.findAll('.ladder')
    expect(ladders).toHaveLength(2)
    expect(ladders[0]?.find('.is-here .rung-label').text()).toBe('組長')
    expect(ladders[0]?.findAll('.is-passed')).toHaveLength(1)
    expect(ladders[1]?.find('.is-here .rung-label').text()).toBe('成員')
    expect(ladders[1]?.findAll('.is-passed')).toHaveLength(0)
  })
})
