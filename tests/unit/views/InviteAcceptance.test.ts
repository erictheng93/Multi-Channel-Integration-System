import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import InviteAcceptance from '@/views/InviteAcceptance.vue'

// Mock the API
vi.mock('@/api/team', () => ({
  teamApi: {
    validateInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn()
  }
}))

// Mock composables
vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn()
  })
}))

describe('InviteAcceptance', () => {
  let pinia: any
  let router: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/invite/:token', component: InviteAcceptance }
      ]
    })
  })

  it('renders loading state initially', async () => {
    const wrapper = mount(InviteAcceptance, {
      global: {
        plugins: [pinia, router]
      }
    })

    expect(wrapper.find('.loading-state').exists()).toBe(true)
    expect(wrapper.find('.spinner').exists()).toBe(true)
    expect(wrapper.text()).toContain('驗證邀請中...')
  })

  it('shows invalid state for invalid invitation', async () => {
    const { teamApi } = await import('@/api/team')
    vi.mocked(teamApi.validateInvitation).mockResolvedValue({
      success: true,
      data: { valid: false }
    })

    // Push route with token
    await router.push('/invite/invalid-token')

    const wrapper = mount(InviteAcceptance, {
      global: {
        plugins: [pinia, router]
      }
    })

    // Wait for validation to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.invalid-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('邀請無效')
  })

  it('shows valid invitation form for valid invitation', async () => {
    const { teamApi } = await import('@/api/team')
    vi.mocked(teamApi.validateInvitation).mockResolvedValue({
      success: true,
      data: {
        valid: true,
        invitation: {
          email: 'test@example.com',
          role: 'agent',
          teamName: 'Test Team',
          inviterName: 'Admin User',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      }
    })

    await router.push('/invite/valid-token')

    const wrapper = mount(InviteAcceptance, {
      global: {
        plugins: [pinia, router]
      }
    })

    // Wait for validation to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.valid-invitation').exists()).toBe(true)
    expect(wrapper.text()).toContain('邀請加入團隊')
    expect(wrapper.text()).toContain('test@example.com')
    expect(wrapper.text()).toContain('客服')
  })

  it('validates form inputs', async () => {
    const { teamApi } = await import('@/api/team')
    vi.mocked(teamApi.validateInvitation).mockResolvedValue({
      success: true,
      data: {
        valid: true,
        invitation: {
          email: 'test@example.com',
          role: 'agent',
          teamName: 'Test Team',
          inviterName: 'Admin User',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      }
    })

    await router.push('/invite/valid-token')

    const wrapper = mount(InviteAcceptance, {
      global: {
        plugins: [pinia, router]
      }
    })

    // Wait for validation to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    const nameInput = wrapper.find('#name')
    const passwordInput = wrapper.find('#password')
    const confirmPasswordInput = wrapper.find('#confirmPassword')

    expect(nameInput.attributes('required')).toBeDefined()
    expect(passwordInput.attributes('required')).toBeDefined()
    expect(passwordInput.attributes('minlength')).toBe('6')
    expect(confirmPasswordInput.attributes('required')).toBeDefined()
  })

  it('shows password mismatch error', async () => {
    const { teamApi } = await import('@/api/team')
    vi.mocked(teamApi.validateInvitation).mockResolvedValue({
      success: true,
      data: {
        valid: true,
        invitation: {
          email: 'test@example.com',
          role: 'agent',
          teamName: 'Test Team',
          inviterName: 'Admin User',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      }
    })

    await router.push('/invite/valid-token')

    const wrapper = mount(InviteAcceptance, {
      global: {
        plugins: [pinia, router]
      }
    })

    // Wait for validation to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    const passwordInput = wrapper.find('#password')
    const confirmPasswordInput = wrapper.find('#confirmPassword')

    await passwordInput.setValue('password123')
    await confirmPasswordInput.setValue('different')

    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toBe('密碼不一致')
  })

  it('submits form with valid data', async () => {
    const { teamApi } = await import('@/api/team')
    const { useAuth } = await import('@/composables/useAuth')
    
    vi.mocked(teamApi.validateInvitation).mockResolvedValue({
      success: true,
      data: {
        valid: true,
        invitation: {
          email: 'test@example.com',
          role: 'agent',
          teamName: 'Test Team',
          inviterName: 'Admin User',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      }
    })

    vi.mocked(teamApi.acceptInvitation).mockResolvedValue({
      success: true,
      data: {
        token: 'jwt-token',
        agent: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
          role: 'agent'
        }
      }
    })

    const mockLogin = vi.fn()
    vi.mocked(useAuth).mockReturnValue({ login: mockLogin } as any)

    await router.push('/invite/valid-token')

    const wrapper = mount(InviteAcceptance, {
      global: {
        plugins: [pinia, router]
      }
    })

    // Wait for validation to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    await wrapper.vm.$nextTick()

    // Fill form
    await wrapper.find('#name').setValue('Test User')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('#confirmPassword').setValue('password123')

    // Submit form
    await wrapper.find('form').trigger('submit')

    expect(teamApi.acceptInvitation).toHaveBeenCalledWith('valid-token', {
      name: 'Test User',
      password: 'password123'
    })
  })
})