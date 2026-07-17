/**
 * System Settings Components Unit Tests
 *
 * Tests for all 8 reusable system settings components
 * Verifies props, events, rendering, and user interactions
 *
 * Total: 20 tests
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsHeader from '@/components/system-settings/SettingsHeader.vue'
import SettingsNav from '@/components/system-settings/SettingsNav.vue'
import GeneralSettingsForm from '@/components/system-settings/GeneralSettingsForm.vue'
import LineIntegrationForm from '@/components/system-settings/LineIntegrationForm.vue'
import FacebookIntegrationForm from '@/components/system-settings/FacebookIntegrationForm.vue'
import AdvancedSettingsForm from '@/components/system-settings/AdvancedSettingsForm.vue'

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('System Settings Components', () => {
  describe('SettingsHeader', () => {
    it('should render title and subtitle', () => {
      const wrapper = mount(SettingsHeader, {
        props: {
          loading: false,
          message: '',
          messageType: 'success'
        }
      })

      expect(wrapper.find('.header-title').exists()).toBe(true)
      expect(wrapper.find('.header-subtitle').exists()).toBe(true)
    })

    it('should emit refresh event when button clicked', async () => {
      const wrapper = mount(SettingsHeader, {
        props: {
          loading: false,
          message: '',
          messageType: 'success'
        }
      })

      await wrapper.find('.refresh-button').trigger('click')

      expect(wrapper.emitted('refresh')).toBeTruthy()
    })

    it('should display message banner when message provided', () => {
      const wrapper = mount(SettingsHeader, {
        props: {
          loading: false,
          message: 'Test message',
          messageType: 'success'
        }
      })

      expect(wrapper.find('.message-banner').exists()).toBe(true)
      expect(wrapper.find('.message-text').text()).toBe('Test message')
    })
  })

  describe('SettingsNav', () => {
    it('should render all tabs', () => {
      const tabs = [
        { key: 'general' as const, label: 'General', icon: {} as any },
        { key: 'integrations' as const, label: 'Integrations', icon: {} as any }
      ]

      const wrapper = mount(SettingsNav, {
        props: {
          modelValue: 'general',
          tabs
        }
      })

      expect(wrapper.findAll('.nav-tab')).toHaveLength(2)
    })

    it('should emit update:modelValue when tab clicked', async () => {
      const tabs = [
        { key: 'general' as const, label: 'General', icon: {} as any },
        { key: 'integrations' as const, label: 'Integrations', icon: {} as any }
      ]

      const wrapper = mount(SettingsNav, {
        props: {
          modelValue: 'general',
          tabs
        }
      })

      await wrapper.findAll('.nav-tab')[1].trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['integrations'])
    })
  })

  describe('GeneralSettingsForm', () => {
    const mockSettings = {
      systemName: 'Test System',
      contactEmail: 'test@example.com',
      timezone: 'Asia/Taipei',
      language: 'zh-TW'
    }

    it('should render all form fields', () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      expect(wrapper.find('#systemName').exists()).toBe(true)
      expect(wrapper.find('#contactEmail').exists()).toBe(true)
      expect(wrapper.find('#timezone').exists()).toBe(true)
      expect(wrapper.find('#language').exists()).toBe(true)
    })

    it('should populate fields with settings data', () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      const systemNameInput = wrapper.find<HTMLInputElement>('#systemName')
      expect(systemNameInput.element.value).toBe('Test System')
    })

    it('should emit save event on form submit', async () => {
      const wrapper = mount(GeneralSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')).toBeTruthy()
    })
  })

  describe('LineIntegrationForm', () => {
    const mockSettings = {
      channelId: 'test-channel',
      channelSecret: 'test-secret',
      accessToken: 'test-token',
      status: 'connected' as const
    }

    it('should render LINE integration fields', () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      expect(wrapper.find('#lineChannelId').exists()).toBe(true)
      expect(wrapper.find('#lineChannelSecret').exists()).toBe(true)
      expect(wrapper.find('#lineAccessToken').exists()).toBe(true)
    })

    it('should emit test event when test button clicked', async () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-secondary').trigger('click')

      expect(wrapper.emitted('test')).toBeTruthy()
    })

    it('should emit clear event when clear button clicked', async () => {
      const wrapper = mount(LineIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-danger').trigger('click')

      expect(wrapper.emitted('clear')).toBeTruthy()
    })
  })

  describe('FacebookIntegrationForm', () => {
    const mockSettings = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      pageId: 'test-page-id',
      pageToken: 'test-page-token',
      status: 'disconnected' as const
    }

    it('should render Facebook integration fields', () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      expect(wrapper.find('#facebookAppId').exists()).toBe(true)
      expect(wrapper.find('#facebookAppSecret').exists()).toBe(true)
      expect(wrapper.find('#facebookPageId').exists()).toBe(true)
      expect(wrapper.find('#facebookPageToken').exists()).toBe(true)
    })

    it('should emit test event when test button clicked', async () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-secondary').trigger('click')

      expect(wrapper.emitted('test')).toBeTruthy()
    })

    it('should emit clear event when clear button clicked', async () => {
      const wrapper = mount(FacebookIntegrationForm, {
        props: {
          settings: mockSettings,
          saving: false,
          testing: false
        }
      })

      await wrapper.find('.btn-danger').trigger('click')

      expect(wrapper.emitted('clear')).toBeTruthy()
    })
  })

  describe('AdvancedSettingsForm', () => {
    const mockSettings = {
      messageQueueSize: 100,
      messageTimeout: 30000,
      cacheExpiry: 3600,
      sessionExpiry: 86400,
      enableRateLimit: true,
      enableLogging: true,
      enableMetrics: true,
      recallWindowSeconds: 0
    }

    it('should render all advanced settings fields', () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      expect(wrapper.find('#messageQueueSize').exists()).toBe(true)
      expect(wrapper.find('#messageTimeout').exists()).toBe(true)
      expect(wrapper.find('#cacheExpiry').exists()).toBe(true)
      expect(wrapper.find('#sessionExpiry').exists()).toBe(true)
    })

    it('should display backend time values using the label units', () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      const messageTimeoutInput = wrapper.find<HTMLInputElement>('#messageTimeout')
      const cacheExpiryInput = wrapper.find<HTMLInputElement>('#cacheExpiry')
      const sessionExpiryInput = wrapper.find<HTMLInputElement>('#sessionExpiry')

      expect(messageTimeoutInput.element.value).toBe('30')
      expect(messageTimeoutInput.attributes('min')).toBe('1')
      expect(messageTimeoutInput.attributes('max')).toBe('300')
      expect(cacheExpiryInput.element.value).toBe('60')
      expect(cacheExpiryInput.attributes('min')).toBe('1')
      expect(cacheExpiryInput.attributes('max')).toBe('1440')
      expect(sessionExpiryInput.element.value).toBe('24')
      expect(sessionExpiryInput.attributes('min')).toBe('1')
      expect(sessionExpiryInput.attributes('max')).toBe('168')
    })

    it('should emit backend time values when saving user-facing units', async () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find<HTMLInputElement>('#messageTimeout').setValue(45)
      await wrapper.find<HTMLInputElement>('#cacheExpiry').setValue(90)
      await wrapper.find<HTMLInputElement>('#sessionExpiry').setValue(48)
      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')![0][0]).toMatchObject({
        messageTimeout: 45000,
        cacheExpiry: 5400,
        sessionExpiry: 172800
      })
    })

    it('should emit save event on form submit', async () => {
      const wrapper = mount(AdvancedSettingsForm, {
        props: {
          settings: mockSettings,
          saving: false
        }
      })

      await wrapper.find('form').trigger('submit.prevent')

      expect(wrapper.emitted('save')).toBeTruthy()
    })
  })

})
